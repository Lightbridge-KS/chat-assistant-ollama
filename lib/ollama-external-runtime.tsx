/**
 * Ollama External Runtime Provider
 *
 * Connects Zustand chat store with assistant-ui's ExternalStoreRuntime.
 * Handles message streaming from Ollama and automatic persistence.
 */

"use client";

import { useCallback, useEffect, type ReactNode } from "react";
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
 * Provider component that wraps the app with ExternalStoreRuntime
 */
export function OllamaRuntimeProvider({ children }: { children: ReactNode }) {
  const chatStore = useChatStore();
  const selectedModel = useModelStore((state) => state.selectedModel);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const systemPrompt = useSettingsStore((state) => state.systemPrompt);

  // Get current messages from store
  const messages = chatStore.getCurrentMessages();

  /**
   * Sync model-store with current thread's model ONLY on thread switch
   * This ensures model selector shows correct model when switching threads
   * IMPORTANT: Only triggers on currentThreadId change, NOT on every render
   */
  useEffect(() => {
    const currentThread = chatStore.getCurrentThread();
    if (currentThread && currentThread.model) {
      console.log("[OllamaRuntime] Syncing model from thread:", currentThread.model);
      setSelectedModel(currentThread.model);
    }
    // CRITICAL: Only depend on currentThreadId to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStore.currentThreadId]);

  /**
   * Handle new messages (when user sends a message)
   */
  const onNew = useCallback(
    async (message: AppendMessage) => {
      try {
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

        // 2. Create assistant message (optimistic)
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

        // 3. Prepare messages for Ollama (including system prompt)
        const systemMessage: OllamaMsg = {
          role: "system",
          content: systemPrompt,
        };

        const ollamaMessages = [
          systemMessage,
          ...convertToOllamaMessages([...messages, userMessage]),
        ];

        console.log("[OllamaRuntime] Sending to Ollama:", {
          model: selectedModel,
          messageCount: ollamaMessages.length,
          hasImages: ollamaMessages.some((m) => m.images && m.images.length > 0),
        });

        // 4. Stream from Ollama
        let accumulatedText = "";

        const stream = await ollamaClient.chat({
          model: selectedModel || "gemma3:latest",
          messages: ollamaMessages,
          stream: true,
        });

        // 5. Update message progressively as chunks arrive
        for await (const chunk of stream) {
          const delta = chunk.message.content;
          accumulatedText += delta;

          chatStore.updateMessage(assistantId, {
            content: [{ type: "text", text: accumulatedText }],
          });
        }

        // 6. Mark as complete
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

        // Find the last assistant message and mark it with error
        const currentMessages = chatStore.getCurrentMessages();
        const lastAssistantMsg = currentMessages
          .slice()
          .reverse()
          .find((m) => m.role === "assistant");

        if (lastAssistantMsg) {
          chatStore.updateMessage(lastAssistantMsg.id, {
            status: {
              type: "incomplete",
              reason: "error",
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    },
    [chatStore, messages, selectedModel, systemPrompt]
  );

  /**
   * Convert message for assistant-ui (identity function since types match)
   */
  const convertMessage = useCallback((message: ThreadMessageLike) => {
    // Our messages are already in the correct format
    return message as any;  // Type assertion to satisfy ExternalStoreRuntime
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
   * Create ExternalStoreRuntime with our Zustand store
   */
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: chatStore.isRunning,
    onNew,
    convertMessage,
    adapters: {
      attachments: new VisionImageAdapter(),
      threadList: threadListAdapter(),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
