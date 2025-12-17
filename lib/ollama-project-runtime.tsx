/**
 * Ollama Project Runtime Provider
 *
 * Specialized runtime for project-specific chats.
 * Connects project-store with assistant-ui's ExternalStoreRuntime.
 * Injects project instruction into system prompt.
 */

"use client";

import * as React from "react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type AppendMessage,
} from "@assistant-ui/react";
import {
  useProjectStore,
  type ProjectThreadMessage,
} from "@/lib/stores/project-store";
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
function convertToOllamaMessages(messages: ProjectThreadMessage[]): OllamaMsg[] {
  return messages.map((msg) => {
    // Extract text content
    let textContent = "";

    if (typeof msg.content === "string") {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .filter((c): c is { type: string; text: string } => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("");
    }

    // Extract images from attachments
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
 * Shared helper to stream Ollama response
 */
async function streamOllamaResponse(
  messagesToSend: ProjectThreadMessage[],
  projectStore: {
    addProjectMessage: (projectId: string, threadId: string, message: ProjectThreadMessage) => void;
    updateProjectMessage: (
      projectId: string,
      threadId: string,
      messageId: string,
      updates: Partial<ProjectThreadMessage>
    ) => void;
  },
  projectId: string,
  threadId: string,
  selectedModel: string,
  systemPrompt: string,
  projectInstruction: string,
  setIsRunning: (running: boolean) => void
): Promise<void> {
  // Create assistant message (optimistic)
  const assistantId = generateMessageId();
  const assistantMessage: ProjectThreadMessage = {
    id: assistantId,
    role: "assistant",
    content: [{ type: "text", text: "" }],
    createdAt: new Date(),
    status: {
      type: "running",
    },
    metadata: { model: selectedModel },
  };

  projectStore.addProjectMessage(projectId, threadId, assistantMessage);
  setIsRunning(true);

  try {
    // Prepare system prompt with project instruction appended
    const combinedSystemPrompt = projectInstruction
      ? `${systemPrompt}\n\n${projectInstruction}`
      : systemPrompt;

    const systemMessage: OllamaMsg = {
      role: "system",
      content: combinedSystemPrompt,
    };

    const ollamaMessages = [
      systemMessage,
      ...convertToOllamaMessages(messagesToSend),
    ];

    console.log("[OllamaProjectRuntime] Sending to Ollama:", {
      projectId,
      threadId,
      model: selectedModel,
      messageCount: ollamaMessages.length,
      hasProjectInstruction: !!projectInstruction,
    });

    // Stream from Ollama
    let accumulatedText = "";

    const stream = await ollamaClient.chat({
      model: selectedModel || "gemma3:latest",
      messages: ollamaMessages,
      stream: true,
    });

    // Update message progressively
    for await (const chunk of stream) {
      const delta = chunk.message.content;
      accumulatedText += delta;

      projectStore.updateProjectMessage(projectId, threadId, assistantId, {
        content: [{ type: "text", text: accumulatedText }],
      });
    }

    // Mark as complete
    projectStore.updateProjectMessage(projectId, threadId, assistantId, {
      status: {
        type: "complete",
        reason: "stop",
      },
    });

    setIsRunning(false);

    console.log("[OllamaProjectRuntime] Streaming complete:", {
      assistantId,
      textLength: accumulatedText.length,
    });
  } catch (error) {
    console.error("[OllamaProjectRuntime] Error during streaming:", error);

    setIsRunning(false);

    projectStore.updateProjectMessage(projectId, threadId, assistantId, {
      status: {
        type: "incomplete",
        reason: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/**
 * Provider component for project-specific runtime
 */
export function OllamaProjectRuntimeProvider({
  projectId,
  threadId,
  children,
}: {
  projectId: string;
  threadId?: string; // Optional - if provided, load existing thread
  children: ReactNode;
}) {
  const projectStore = useProjectStore();
  const selectedModel = useModelStore((state) => state.selectedModel);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const systemPrompt = useSettingsStore((state) => state.systemPrompt);

  // Get project and instruction
  const project = projectStore.getProject(projectId);
  const projectInstruction = project?.instruction || "";

  // Track current thread ID
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);
  const [isRunning, setIsRunning] = useState(false);

  // Sync threadId prop changes (for thread switching via URL)
  React.useEffect(() => {
    if (threadId && threadId !== currentThreadId) {
      console.log("[OllamaProjectRuntime] Switching to thread:", threadId);
      setCurrentThreadId(threadId);
    }
  }, [threadId, currentThreadId]);

  // Sync model from thread (similar to global runtime)
  React.useEffect(() => {
    if (currentThreadId) {
      const thread = projectStore.getProjectThread(projectId, currentThreadId);
      if (thread?.model && thread.model !== selectedModel) {
        console.log("[OllamaProjectRuntime] Syncing model from thread:", thread.model);
        setSelectedModel(thread.model);
      }
    }
  }, [currentThreadId, projectId, projectStore, selectedModel, setSelectedModel]);

  // Get messages for current thread (memoized to prevent dependency changes)
  const messages = useMemo(
    () => (currentThreadId
      ? projectStore.getProjectThreadMessages(projectId, currentThreadId)
      : []),
    [currentThreadId, projectId, projectStore]
  );

  /**
   * Handle new messages (when user sends a message)
   */
  const onNew = useCallback(
    async (message: AppendMessage) => {
      // Create new thread if none exists
      let threadId = currentThreadId;
      if (!threadId) {
        threadId = projectStore.createProjectThread(projectId, selectedModel);
        setCurrentThreadId(threadId);
      }

      // Add user message
      const userMessage: ProjectThreadMessage = {
        id: generateMessageId(),
        role: "user",
        content: [...message.content],
        attachments: message.attachments ? [...message.attachments] : undefined,
        createdAt: new Date(),
      };

      projectStore.addProjectMessage(projectId, threadId, userMessage);

      console.log("[OllamaProjectRuntime] User message added:", {
        projectId,
        threadId,
        messageId: userMessage.id,
      });

      // Stream response
      await streamOllamaResponse(
        [...messages, userMessage],
        projectStore,
        projectId,
        threadId,
        selectedModel || "gemma3:latest",
        systemPrompt,
        projectInstruction,
        setIsRunning
      );
    },
    [currentThreadId, projectId, projectStore, selectedModel, systemPrompt, projectInstruction, messages]
  );

  /**
   * Handle reload (regenerate assistant message)
   */
  const onReload = useCallback(
    async (parentId: string | null) => {
      if (!currentThreadId) return;

      console.log("[OllamaProjectRuntime] Reloading from parentId:", parentId);

      const currentMessages = projectStore.getProjectThreadMessages(projectId, currentThreadId);

      // Find cutoff index
      let cutoffIndex: number;

      if (parentId === null) {
        cutoffIndex = 0;
      } else {
        const parentIndex = currentMessages.findIndex((m) => m.id === parentId);
        if (parentIndex === -1) {
          console.error("[OllamaProjectRuntime] Parent message not found:", parentId);
          return;
        }
        cutoffIndex = parentIndex + 1;
      }

      const messagesUpToParent = currentMessages.slice(0, cutoffIndex);

      projectStore.setProjectMessages(projectId, currentThreadId, messagesUpToParent);

      // Stream new response
      await streamOllamaResponse(
        messagesUpToParent,
        projectStore,
        projectId,
        currentThreadId,
        selectedModel || "gemma3:latest",
        systemPrompt,
        projectInstruction,
        setIsRunning
      );
    },
    [currentThreadId, projectId, projectStore, selectedModel, systemPrompt, projectInstruction]
  );

  /**
   * Handle edit (edit user message and regenerate)
   */
  const onEdit = useCallback(
    async (message: AppendMessage) => {
      if (!currentThreadId) return;

      console.log("[OllamaProjectRuntime] Editing message:", {
        parentId: message.parentId,
      });

      const currentMessages = projectStore.getProjectThreadMessages(projectId, currentThreadId);

      // Handle parentId
      let messagesUpToParent: ProjectThreadMessage[];

      if (message.parentId === null) {
        messagesUpToParent = [];
      } else {
        const parentIndex = currentMessages.findIndex((m) => m.id === message.parentId);
        if (parentIndex === -1) {
          console.error("[OllamaProjectRuntime] Parent message not found:", message.parentId);
          return;
        }
        messagesUpToParent = currentMessages.slice(0, parentIndex + 1);
      }

      // Create edited message
      const editedMessage: ProjectThreadMessage = {
        id: generateMessageId(),
        role: "user",
        content: [...message.content],
        attachments: message.attachments ? [...message.attachments] : undefined,
        createdAt: new Date(),
      };

      const newMessages = [...messagesUpToParent, editedMessage];

      projectStore.setProjectMessages(projectId, currentThreadId, newMessages);

      // Stream new response
      await streamOllamaResponse(
        newMessages,
        projectStore,
        projectId,
        currentThreadId,
        selectedModel || "gemma3:latest",
        systemPrompt,
        projectInstruction,
        setIsRunning
      );
    },
    [currentThreadId, projectId, projectStore, selectedModel, systemPrompt, projectInstruction]
  );

  /**
   * Convert message for assistant-ui
   * Maps our custom metadata to assistant-ui's metadata.custom field
   */
  const convertMessage = useCallback((message: ProjectThreadMessage) => {
    // Map our metadata to assistant-ui's expected structure
    // Our metadata (e.g., { model: "gemma3:latest" }) goes into metadata.custom
    return {
      ...message,
      metadata: {
        custom: message.metadata || {},
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any; // Type assertion required by ExternalStoreRuntime
  }, []);

  /**
   * Wrapper for setMessages
   */
  const setMessages = useCallback(
    (messages: readonly ProjectThreadMessage[]) => {
      if (!currentThreadId) return;
      projectStore.setProjectMessages(projectId, currentThreadId, [...messages]);
    },
    [currentThreadId, projectId, projectStore]
  );

  /**
   * Thread list adapter for project threads
   */
  const projectThreadListAdapter = useCallback(() => {
    // Select raw projectThreads Record to avoid infinite loop
    // (getProjectThreads returns new array every call)
    const projectThreadsRecord = projectStore.projects[projectId]?.projectThreads || {};
    const threads = Object.values(projectThreadsRecord).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return {
      // Current state
      threadId: currentThreadId,

      // Thread lists (only regular, no archived for project threads)
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        status: "regular" as const,
      })),

      archivedThreads: [], // No archived threads for projects

      // Thread actions
      onSwitchToNewThread: () => {
        console.log("[OllamaProjectRuntime] Creating new project thread");
        const newThreadId = projectStore.createProjectThread(projectId, selectedModel);
        setCurrentThreadId(newThreadId);
      },

      onSwitchToThread: (threadId: string) => {
        console.log("[OllamaProjectRuntime] Switching to thread:", threadId);
        setCurrentThreadId(threadId);
      },

      onRename: (threadId: string, newTitle: string) => {
        console.log("[OllamaProjectRuntime] Renaming thread:", threadId, "to:", newTitle);
        // Update thread title in project store
        const thread = projectStore.getProjectThread(projectId, threadId);
        if (thread) {
          projectStore.setProjectMessages(projectId, threadId, thread.messages); // Trigger update
          // Note: We don't have a dedicated renameThread action, but we can extend project-store if needed
        }
      },

      onArchive: (threadId: string) => {
        console.log("[OllamaProjectRuntime] Archiving thread (delete for projects):", threadId);
        projectStore.deleteProjectThread(projectId, threadId);

        // If deleted current thread, switch to another or create new
        if (currentThreadId === threadId) {
          // Re-fetch after deletion
          const remainingThreadsRecord = projectStore.projects[projectId]?.projectThreads || {};
          const remainingThreads = Object.values(remainingThreadsRecord);
          if (remainingThreads.length > 0) {
            setCurrentThreadId(remainingThreads[0].id);
          } else {
            setCurrentThreadId(undefined);
          }
        }
      },

      onUnarchive: () => {
        // Not applicable for project threads
      },

      onDelete: (threadId: string) => {
        console.log("[OllamaProjectRuntime] Deleting thread:", threadId);
        projectStore.deleteProjectThread(projectId, threadId);

        // If deleted current thread, switch to another or create new
        if (currentThreadId === threadId) {
          // Re-fetch after deletion
          const remainingThreadsRecord = projectStore.projects[projectId]?.projectThreads || {};
          const remainingThreads = Object.values(remainingThreadsRecord);
          if (remainingThreads.length > 0) {
            setCurrentThreadId(remainingThreads[0].id);
          } else {
            setCurrentThreadId(undefined);
          }
        }
      },
    };
  }, [projectStore, projectId, currentThreadId, selectedModel]);

  /**
   * Create ExternalStoreRuntime
   */
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    setMessages,
    onNew,
    onReload,
    onEdit,
    convertMessage,
    adapters: {
      attachments: new VisionImageAdapter(),
      threadList: projectThreadListAdapter(),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
