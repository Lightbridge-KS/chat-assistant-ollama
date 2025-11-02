/**
 * Ollama External Runtime Provider
 *
 * Connects Zustand chat store with assistant-ui's ExternalStoreRuntime.
 * Handles message streaming from Ollama and automatic persistence.
 */

"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type AppendMessage,
} from "@assistant-ui/react";
import { useChatStore, type ThreadMessageLike } from "@/lib/stores/chat-store";
import { useModelStore } from "@/lib/stores/model-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { ollamaClient } from "@/lib/ollama-client";
import { VisionImageAdapter } from "@/lib/vision-image-adapter";

/**
 * Ollama message format for API requests
 */
type OllamaMsg = {
  role: string;
  content: string;
  images?: string[];
};

/**
 * Convert assistant-ui messages to Ollama format
 */
function convertToOllamaMessages(messages: ThreadMessageLike[]): OllamaMsg[] {
  return messages.map((msg) => {
    // Extract text content with type guard
    let textContent = "";

    if (typeof msg.content === "string") {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .filter((c): c is { type: string; text: string } => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("");
    }

    // Extract images from attachments (strip data URL prefix)
    const imageContent =
      msg.attachments
        ?.filter((att) => att.type === "image")
        .flatMap((att) =>
          att.content
            .filter((c): c is { type: string; image: string } => c.type === "image" && typeof c.image === "string")
            .map((c) => {
              const base64Only = c.image.includes(",")
                ? c.image.split(",")[1]
                : c.image;
              return base64Only;
            })
        ) || [];

    const ollamaMsg: OllamaMsg = {
      role: msg.role === "user" ? "user" : "assistant",
      content: textContent || "",
    };

    if (imageContent.length > 0) {
      ollamaMsg.images = imageContent;
    }

    return ollamaMsg;
  });
}

/**
 * Generate unique ID for messages
 */
function generateMessageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Shared helper to stream Ollama response and update chat store
 * Used by onNew, onReload, and onEdit handlers
 */
async function streamOllamaResponse(
  messagesToSend: ThreadMessageLike[],
  chatStore: {
    addMessage: (message: ThreadMessageLike) => void;
    updateMessage: (id: string, updates: Partial<ThreadMessageLike>) => void;
    setIsRunning: (running: boolean) => void;
  },
  selectedModel: string,
  systemPrompt: string
): Promise<void> {
  // 1. Create assistant message (optimistic)
  const assistantId = generateMessageId();
  const assistantMessage: ThreadMessageLike = {
    id: assistantId,
    role: "assistant",
    content: [{ type: "text", text: "" }],
    createdAt: new Date(),
    status: {
      type: "running",
    },
  };

  chatStore.addMessage(assistantMessage);
  chatStore.setIsRunning(true);

  try {
    // 2. Prepare messages for Ollama (including system prompt)
    const systemMessage: OllamaMsg = {
      role: "system",
      content: systemPrompt,
    };

    const ollamaMessages = [
      systemMessage,
      ...convertToOllamaMessages(messagesToSend),
    ];

    console.log("[OllamaRuntime] Sending to Ollama:", {
      model: selectedModel,
      messageCount: ollamaMessages.length,
      hasImages: ollamaMessages.some((m) => m.images && m.images.length > 0),
    });

    // 3. Stream from Ollama
    let accumulatedText = "";

    const stream = await ollamaClient.chat({
      model: selectedModel || "gemma3:latest",
      messages: ollamaMessages,
      stream: true,
    });

    // 4. Update message progressively as chunks arrive
    for await (const chunk of stream) {
      const delta = chunk.message.content;
      accumulatedText += delta;

      chatStore.updateMessage(assistantId, {
        content: [{ type: "text", text: accumulatedText }],
      });
    }

    // 5. Mark as complete
    chatStore.updateMessage(assistantId, {
      status: {
        type: "complete",
        reason: "stop",
      },
    });

    chatStore.setIsRunning(false);

    console.log("[OllamaRuntime] Streaming complete:", {
      assistantId,
      textLength: accumulatedText.length,
    });
  } catch (error) {
    console.error("[OllamaRuntime] Error during streaming:", error);

    // Mark as incomplete with error
    chatStore.setIsRunning(false);

    chatStore.updateMessage(assistantId, {
      status: {
        type: "incomplete",
        reason: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/**
 * Provider component that wraps the app with ExternalStoreRuntime
 */
export function OllamaRuntimeProvider({ children }: { children: ReactNode }) {
  const chatStore = useChatStore();
  const selectedModel = useModelStore((state) => state.selectedModel);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const systemPrompt = useSettingsStore((state) => state.systemPrompt);

  // Get current messages from store
  const messages = chatStore.getCurrentMessages();

  // Track initial mount to distinguish from thread switches
  const isInitialMount = useRef(true);

  /**
   * Bidirectional model sync between model-store and thread
   * - Initial mount: model-store → thread (preserve user's last selection)
   * - Thread switch: thread → model-store (preserve conversation context)
   * IMPORTANT: Only triggers on currentThreadId change, NOT on every render
   */
  useEffect(() => {
    const currentThread = chatStore.getCurrentThread();

    if (!currentThread) return;

    if (isInitialMount.current) {
      // On initial mount: model-store wins (user's last selection)
      if (selectedModel && selectedModel !== currentThread.model) {
        console.log("[OllamaRuntime] Initial load - updating thread model to match selection:", selectedModel);
        chatStore.updateThreadModel(chatStore.currentThreadId, selectedModel);
      } else if (currentThread.model && !selectedModel) {
        console.log("[OllamaRuntime] Initial load - updating selection to match thread:", currentThread.model);
        setSelectedModel(currentThread.model);
      }
      isInitialMount.current = false;
    } else {
      // On thread switch: thread model wins (conversation context)
      if (currentThread.model && currentThread.model !== selectedModel) {
        console.log("[OllamaRuntime] Thread switch - syncing model from thread:", currentThread.model);
        setSelectedModel(currentThread.model);
      }
    }

    // CRITICAL: Only depend on currentThreadId to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStore.currentThreadId]);

  /**
   * Handle new messages (when user sends a message)
   */
  const onNew = useCallback(
    async (message: AppendMessage) => {
      // 0. Update thread model to current selected model (if changed)
      const currentThread = chatStore.getCurrentThread();
      if (currentThread && selectedModel && currentThread.model !== selectedModel) {
        console.log("[OllamaRuntime] Updating thread model to:", selectedModel);
        chatStore.updateThreadModel(chatStore.currentThreadId, selectedModel);
      }

      // 1. Add user message to store
      const userMessage: ThreadMessageLike = {
        id: generateMessageId(),
        role: "user",
        content: [...message.content], // Convert readonly to mutable
        attachments: message.attachments ? [...message.attachments] : undefined,
        createdAt: new Date(),
      };

      chatStore.addMessage(userMessage);

      console.log("[OllamaRuntime] User message added:", {
        id: userMessage.id,
        contentLength: userMessage.content.length,
        hasAttachments: (userMessage.attachments?.length || 0) > 0,
      });

      // 2. Stream response using shared logic
      await streamOllamaResponse(
        [...messages, userMessage],
        chatStore,
        selectedModel || "gemma3:latest",
        systemPrompt
      );
    },
    [chatStore, messages, selectedModel, systemPrompt]
  );

  /**
   * Handle reload (regenerate assistant message from a specific point)
   */
  const onReload = useCallback(
    async (parentId: string | null) => {
      console.log("[OllamaRuntime] Reloading from parentId:", parentId);

      const currentMessages = chatStore.getCurrentMessages();

      // Find the parent message (the user message before the assistant message to reload)
      let cutoffIndex: number;

      if (parentId === null) {
        // No parent means this is the first assistant message
        // Remove everything after index 0 (if there's a first user message)
        cutoffIndex = 0;
      } else {
        // Find the parent message
        const parentIndex = currentMessages.findIndex((m) => m.id === parentId);

        if (parentIndex === -1) {
          console.error("[OllamaRuntime] Parent message not found:", parentId);
          return;
        }

        // Keep messages up to and including the parent
        cutoffIndex = parentIndex + 1;
      }

      // Remove all messages after the parent (including the old assistant response)
      const messagesUpToParent = currentMessages.slice(0, cutoffIndex);

      console.log("[OllamaRuntime] Reloading from cutoff index:", cutoffIndex, "keeping", messagesUpToParent.length, "messages");

      chatStore.setMessages(messagesUpToParent);

      // Stream new response using shared logic
      await streamOllamaResponse(
        messagesUpToParent,
        chatStore,
        selectedModel || "gemma3:latest",
        systemPrompt
      );
    },
    [chatStore, selectedModel, systemPrompt]
  );

  /**
   * Handle edit (edit user message and regenerate)
   */
  const onEdit = useCallback(
    async (message: AppendMessage) => {
      console.log("[OllamaRuntime] Editing message:", {
        parentId: message.parentId,
        contentLength: message.content.length,
      });

      const currentMessages = chatStore.getCurrentMessages();

      // Handle parentId (null means this is the first message)
      let messagesUpToParent: ThreadMessageLike[];

      if (message.parentId === null) {
        // This is the first message, start with empty array
        messagesUpToParent = [];
        console.log("[OllamaRuntime] Editing first message");
      } else {
        // Find the index of the parent message
        const parentIndex = currentMessages.findIndex((m) => m.id === message.parentId);

        if (parentIndex === -1) {
          console.error("[OllamaRuntime] Parent message not found:", message.parentId);
          return;
        }

        // Keep messages up to and including the parent
        messagesUpToParent = currentMessages.slice(0, parentIndex + 1);
      }

      // Create the edited user message
      const editedMessage: ThreadMessageLike = {
        id: generateMessageId(),
        role: "user",
        content: [...message.content], // Convert readonly to mutable
        attachments: message.attachments ? [...message.attachments] : undefined,
        createdAt: new Date(),
      };

      // Update store with edited message
      const newMessages = [...messagesUpToParent, editedMessage];

      console.log("[OllamaRuntime] Setting edited messages, count:", newMessages.length);

      chatStore.setMessages(newMessages);

      // Stream new response using shared logic
      await streamOllamaResponse(
        newMessages,
        chatStore,
        selectedModel || "gemma3:latest",
        systemPrompt
      );
    },
    [chatStore, selectedModel, systemPrompt]
  );

  /**
   * Convert message for assistant-ui (identity function since types match)
   */
  const convertMessage = useCallback((message: ThreadMessageLike) => {
    // Our messages are already in the correct format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return message as any;  // Type assertion required by ExternalStoreRuntime
  }, []);

  /**
   * Thread list adapter for multi-thread support
   */
  const threadListAdapter = useCallback(() => {
    const regularThreads = chatStore.getRegularThreads();
    const archivedThreads = chatStore.getArchivedThreads();

    return {
      // Current state
      threadId: chatStore.currentThreadId,

      // Thread lists (map to assistant-ui format)
      threads: regularThreads.map((t) => ({
        id: t.id,
        title: t.title,
        status: "regular" as const,
      })),

      archivedThreads: archivedThreads.map((t) => ({
        id: t.id,
        title: t.title,
        status: "archived" as const,
      })),

      // Thread actions
      onSwitchToNewThread: () => {
        console.log("[OllamaRuntime] Creating new thread");
        chatStore.createNewThread(selectedModel);
        // Note: createNewThread automatically sets it as current, no need to return
      },

      onSwitchToThread: (threadId: string) => {
        console.log("[OllamaRuntime] Switching to thread:", threadId);
        chatStore.setCurrentThreadId(threadId);
      },

      onRename: (threadId: string, newTitle: string) => {
        console.log("[OllamaRuntime] Renaming thread:", threadId, "to:", newTitle);
        chatStore.renameThread(threadId, newTitle);
      },

      onArchive: (threadId: string) => {
        console.log("[OllamaRuntime] Archiving thread:", threadId);
        chatStore.archiveThread(threadId);
      },

      onUnarchive: (threadId: string) => {
        console.log("[OllamaRuntime] Unarchiving thread:", threadId);
        chatStore.unarchiveThread(threadId);
      },

      onDelete: (threadId: string) => {
        console.log("[OllamaRuntime] Deleting thread:", threadId);
        chatStore.deleteThread(threadId);
      },
    };
  }, [chatStore, selectedModel]);

  /**
   * Wrapper for setMessages to handle readonly -> mutable conversion
   */
  const setMessages = useCallback(
    (messages: readonly ThreadMessageLike[]) => {
      chatStore.setMessages([...messages]); // Convert readonly to mutable
    },
    [chatStore]
  );

  /**
   * Create ExternalStoreRuntime with our Zustand store
   */
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: chatStore.isRunning,
    setMessages,
    onNew,
    onReload,
    onEdit,
    convertMessage,
    adapters: {
      attachments: new VisionImageAdapter(),
      threadList: threadListAdapter(),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
