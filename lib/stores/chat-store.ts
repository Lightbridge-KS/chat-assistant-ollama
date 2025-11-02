/**
 * Chat Store - Zustand store for managing conversations
 *
 * Uses ExternalStoreRuntime pattern with automatic localStorage persistence.
 * Replaces the event-driven persistence approach with reactive state management.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Simplified message type for our store (will be converted for assistant-ui)
export interface ThreadMessageLike {
  id: string;
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image?: string; [key: string]: unknown }>;
  createdAt: Date;
  attachments?: Array<{
    id: string;
    type: string;
    name: string;
    contentType: string;
    content: Array<{ type: string; image?: string; [key: string]: unknown }>;
  }>;
  status?: {
    type: string;
    reason?: string;
    error?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Single thread data structure
 */
export interface ChatThread {
  id: string;
  messages: ThreadMessageLike[];
  model: string; // Model used for this thread
  createdAt: string;
  updatedAt: string;
  title: string; // Auto-generated from first message
  status: "regular" | "archived";
}

/**
 * Main chat store interface
 */
export interface ChatStore {
  // State
  currentThreadId: string;
  threads: Record<string, ChatThread>; // Using Record instead of Map for easier serialization
  isRunning: boolean;

  // Computed getters
  getCurrentThread: () => ChatThread | undefined;
  getCurrentMessages: () => ThreadMessageLike[];
  getRegularThreads: () => ChatThread[];
  getArchivedThreads: () => ChatThread[];

  // Thread management
  setCurrentThreadId: (id: string) => void;
  createNewThread: (model?: string) => string;
  deleteThread: (id: string) => void;
  archiveThread: (id: string) => void;
  unarchiveThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  updateThreadModel: (id: string, model: string) => void;

  // Message management
  setMessages: (messages: ThreadMessageLike[]) => void;
  addMessage: (message: ThreadMessageLike) => void;
  updateMessage: (id: string, updates: Partial<ThreadMessageLike>) => void;

  // Runtime state
  setIsRunning: (running: boolean) => void;

  // Utility
  clearAllThreads: () => void;
}

/**
 * Generate a unique ID for messages/threads
 */
function generateId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers or non-secure contexts
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate thread title from first user message
 */
function generateThreadTitle(messages: ThreadMessageLike[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");

  if (!firstUserMessage) {
    return "New Chat";
  }

  // Extract text from content
  let text = "";

  if (typeof firstUserMessage.content === "string") {
    text = firstUserMessage.content;
  } else if (Array.isArray(firstUserMessage.content)) {
    text = firstUserMessage.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join(" ");
  }

  // Truncate to 50 characters
  const truncated = text.substring(0, 50);
  return truncated.length < text.length ? `${truncated}...` : truncated || "New Chat";
}

/**
 * Migrate data from old event-driven persistence format
 */
function migrateOldData(): Record<string, ChatThread> | null {
  // Only run in browser environment
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const oldKey = "ollama-threads-storage";
    const oldData = localStorage.getItem(oldKey);

    if (!oldData) {
      return null;
    }

    console.log("[ChatStore] Migrating data from old format");

    const parsed = JSON.parse(oldData);
    const threads: Record<string, ChatThread> = {};

    // Convert old format to new format
    if (parsed.threads) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.entries(parsed.threads).forEach(([id, thread]: [string, any]) => {
        threads[id] = {
          id,
          messages: thread.messages || [],
          model: thread.model || "",
          createdAt: thread.createdAt || new Date().toISOString(),
          updatedAt: thread.updatedAt || new Date().toISOString(),
          title: generateThreadTitle(thread.messages || []),
          status: "regular",
        };
      });
    }

    // Clean up old data after successful migration
    localStorage.removeItem(oldKey);

    console.log("[ChatStore] Migration complete:", {
      threadCount: Object.keys(threads).length,
    });

    return threads;
  } catch (error) {
    console.error("[ChatStore] Migration failed:", error);
    return null;
  }
}

/**
 * Create initial thread
 */
function createInitialThread(): ChatThread {
  return {
    id: "main",
    messages: [],
    model: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: "New Chat",
    status: "regular",
  };
}

/**
 * Chat Store with automatic localStorage persistence
 */
export const useChatStore = create<ChatStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentThreadId: "main",
      threads: migrateOldData() || {
        main: createInitialThread(),
      },
      isRunning: false,

      // Computed getters
      getCurrentThread: () => {
        const state = get();
        return state.threads[state.currentThreadId];
      },

      getCurrentMessages: () => {
        const thread = get().getCurrentThread();
        return thread?.messages || [];
      },

      getRegularThreads: () => {
        const state = get();
        return (Object.values(state.threads) as ChatThread[])
          .filter((t) => t.status === "regular")
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },

      getArchivedThreads: () => {
        const state = get();
        return (Object.values(state.threads) as ChatThread[])
          .filter((t) => t.status === "archived")
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },

      // Thread management
      setCurrentThreadId: (id: string) => {
        set((state) => {
          if (!state.threads[id]) {
            console.error("[ChatStore] Thread not found:", id);
            return;
          }
          state.currentThreadId = id;
        });
      },

      createNewThread: (model?: string) => {
        const newId = generateId();

        set((state) => {
          state.threads[newId] = {
            id: newId,
            messages: [],
            model: model || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            title: "New Chat",
            status: "regular",
          };
          state.currentThreadId = newId;
        });

        console.log("[ChatStore] Created new thread:", newId);
        return newId;
      },

      deleteThread: (id: string) => {
        set((state) => {
          delete state.threads[id];

          // If deleted current thread, switch to another thread
          if (state.currentThreadId === id) {
            const regularThreads = (Object.values(state.threads) as ChatThread[]).filter(
              (t) => t.status === "regular"
            );

            if (regularThreads.length > 0) {
              state.currentThreadId = regularThreads[0].id;
            } else {
              // No threads left, create a new one
              const newId = generateId();
              state.threads[newId] = createInitialThread();
              state.threads[newId].id = newId;
              state.currentThreadId = newId;
            }
          }
        });

        console.log("[ChatStore] Deleted thread:", id);
      },

      archiveThread: (id: string) => {
        set((state) => {
          if (state.threads[id]) {
            state.threads[id].status = "archived";
            state.threads[id].updatedAt = new Date().toISOString();

            // Switch to another thread if current was archived
            if (state.currentThreadId === id) {
              const regularThreads = (Object.values(state.threads) as ChatThread[]).filter(
                (t) => t.status === "regular"
              );

              if (regularThreads.length > 0) {
                state.currentThreadId = regularThreads[0].id;
              } else {
                // No regular threads, create new one
                const newId = generateId();
                state.threads[newId] = createInitialThread();
                state.threads[newId].id = newId;
                state.currentThreadId = newId;
              }
            }
          }
        });

        console.log("[ChatStore] Archived thread:", id);
      },

      unarchiveThread: (id: string) => {
        set((state) => {
          if (state.threads[id]) {
            state.threads[id].status = "regular";
            state.threads[id].updatedAt = new Date().toISOString();
          }
        });

        console.log("[ChatStore] Unarchived thread:", id);
      },

      renameThread: (id: string, title: string) => {
        set((state) => {
          if (state.threads[id]) {
            state.threads[id].title = title;
            state.threads[id].updatedAt = new Date().toISOString();
          }
        });

        console.log("[ChatStore] Renamed thread:", id, "to:", title);
      },

      updateThreadModel: (id: string, model: string) => {
        set((state) => {
          if (state.threads[id]) {
            state.threads[id].model = model;
            state.threads[id].updatedAt = new Date().toISOString();
          }
        });

        console.log("[ChatStore] Updated thread model:", id, "to:", model);
      },

      // Message management
      setMessages: (messages: ThreadMessageLike[]) => {
        set((state) => {
          const thread = state.threads[state.currentThreadId];
          if (thread) {
            thread.messages = messages;
            thread.updatedAt = new Date().toISOString();
          }
        });
      },

      addMessage: (message: ThreadMessageLike) => {
        set((state) => {
          const thread = state.threads[state.currentThreadId];
          if (thread) {
            thread.messages.push(message);
            thread.updatedAt = new Date().toISOString();

            // Update thread title if this is the first user message
            if (message.role === "user" && thread.messages.length === 1) {
              thread.title = generateThreadTitle(thread.messages);
            }
          }
        });
      },

      updateMessage: (id: string, updates: Partial<ThreadMessageLike>) => {
        set((state) => {
          const thread = state.threads[state.currentThreadId];
          if (thread) {
            const messageIndex = thread.messages.findIndex((m: ThreadMessageLike) => m.id === id);
            if (messageIndex !== -1) {
              // Merge updates into existing message
              thread.messages[messageIndex] = {
                ...thread.messages[messageIndex],
                ...updates,
              };
              thread.updatedAt = new Date().toISOString();
            }
          }
        });
      },

      // Runtime state
      setIsRunning: (running: boolean) => {
        set((state) => {
          state.isRunning = running;
        });
      },

      // Utility
      clearAllThreads: () => {
        set((state) => {
          const newId = generateId();
          state.threads = {
            [newId]: createInitialThread(),
          };
          state.threads[newId].id = newId;
          state.currentThreadId = newId;
          state.isRunning = false;
        });

        console.log("[ChatStore] Cleared all threads");
      },
    })),
    {
      name: "ollama-chat-storage", // localStorage key
      version: 1,

      // Use JSON storage
      storage: createJSONStorage(() => localStorage),

      // Only persist these fields
      partialize: (state) => ({
        currentThreadId: state.currentThreadId,
        threads: state.threads,
        // Don't persist isRunning (should always start as false)
      }),
    }
  )
);

/**
 * Get storage statistics for UI display
 */
export function getChatStorageStats(): {
  usedBytes: number;
  usedMB: number;
  limitMB: number;
  usagePercent: number;
  threadCount: number;
} {
  // Only run in browser environment
  if (typeof window === "undefined") {
    return {
      usedBytes: 0,
      usedMB: 0,
      limitMB: 5,
      usagePercent: 0,
      threadCount: 0,
    };
  }

  try {
    const stored = localStorage.getItem("ollama-chat-storage");
    const usedBytes = stored ? new Blob([stored]).size : 0;
    const limitBytes = 5 * 1024 * 1024; // 5MB
    const usedMB = usedBytes / (1024 * 1024);
    const limitMB = limitBytes / (1024 * 1024);
    const usagePercent = (usedBytes / limitBytes) * 100;

    const state = useChatStore.getState();
    const threadCount = Object.keys(state.threads).length;

    return {
      usedBytes,
      usedMB: parseFloat(usedMB.toFixed(2)),
      limitMB: parseFloat(limitMB.toFixed(2)),
      usagePercent: parseFloat(usagePercent.toFixed(1)),
      threadCount,
    };
  } catch (error) {
    console.error("[ChatStore] Failed to get storage stats:", error);
    return {
      usedBytes: 0,
      usedMB: 0,
      limitMB: 5,
      usagePercent: 0,
      threadCount: 0,
    };
  }
}

/**
 * Export all conversations as JSON file
 */
export function exportChatData(): void {
  // Only run in browser environment
  if (typeof window === "undefined") {
    console.warn("[ChatStore] exportChatData can only run in browser");
    return;
  }

  try {
    const state = useChatStore.getState();

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      currentThreadId: state.currentThreadId,
      threads: state.threads,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `ollama-chat-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    console.log("[ChatStore] Exported chat data");
  } catch (error) {
    console.error("[ChatStore] Failed to export:", error);
  }
}
