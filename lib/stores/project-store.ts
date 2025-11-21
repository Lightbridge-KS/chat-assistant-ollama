/**
 * Project Store - Zustand store for managing projects
 *
 * Stores project configurations with automatic localStorage persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

/**
 * Project thread message (reuse type from chat-store)
 */
export interface ProjectThreadMessage {
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
 * Project thread interface
 */
export interface ProjectThread {
  id: string;
  projectId: string;
  messages: ProjectThreadMessage[];
  model: string;
  createdAt: string;
  updatedAt: string;
  title: string;
}

/**
 * Project interface
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  instruction: string;
  createdAt: string;
  updatedAt: string;
  projectThreads: Record<string, ProjectThread>;
}

/**
 * Project store interface
 */
export interface ProjectStore {
  // State
  projects: Record<string, Project>;

  // Computed getters
  getAllProjects: () => Project[];
  getProject: (id: string) => Project | undefined;

  // Project actions
  addProject: (
    project: Omit<Project, "id" | "createdAt" | "updatedAt" | "projectThreads">
  ) => string;
  updateProject: (id: string, updates: Partial<Omit<Project, "id" | "projectThreads">>) => void;
  deleteProject: (id: string) => void;

  // Project thread getters
  getProjectThreads: (projectId: string) => ProjectThread[];
  getProjectThread: (projectId: string, threadId: string) => ProjectThread | undefined;
  getProjectThreadMessages: (projectId: string, threadId: string) => ProjectThreadMessage[];

  // Project thread actions
  createProjectThread: (projectId: string, model?: string) => string;
  deleteProjectThread: (projectId: string, threadId: string) => void;
  addProjectMessage: (projectId: string, threadId: string, message: ProjectThreadMessage) => void;
  updateProjectMessage: (
    projectId: string,
    threadId: string,
    messageId: string,
    updates: Partial<ProjectThreadMessage>
  ) => void;
  setProjectMessages: (
    projectId: string,
    threadId: string,
    messages: ProjectThreadMessage[]
  ) => void;

  // Utility
  clearAllProjects: () => void;
}

/**
 * Generate unique ID for projects and threads
 */
function generateProjectId(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers or non-secure contexts
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate thread title from first user message
 */
function generateThreadTitle(messages: ProjectThreadMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");

  if (!firstUserMessage) {
    return "New Conversation";
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
  return truncated.length < text.length ? `${truncated}...` : truncated || "New Conversation";
}

/**
 * Project Store with automatic localStorage persistence
 */
export const useProjectStore = create<ProjectStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      projects: {},

      // Computed getters
      getAllProjects: () => {
        const state = get();
        return (Object.values(state.projects) as Project[]).sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      },

      getProject: (id: string) => {
        const state = get();
        return state.projects[id];
      },

      // Project actions
      addProject: (project) => {
        const newId = generateProjectId();
        const now = new Date().toISOString();

        set((state) => {
          state.projects[newId] = {
            ...project,
            id: newId,
            createdAt: now,
            updatedAt: now,
            projectThreads: {}, // Initialize empty threads
          };
        });

        console.log("[ProjectStore] Created project:", newId);
        return newId;
      },

      updateProject: (id, updates) => {
        set((state) => {
          if (state.projects[id]) {
            state.projects[id] = {
              ...state.projects[id],
              ...updates,
              updatedAt: new Date().toISOString(),
            };
          }
        });

        console.log("[ProjectStore] Updated project:", id);
      },

      deleteProject: (id) => {
        set((state) => {
          delete state.projects[id];
        });

        console.log("[ProjectStore] Deleted project:", id);
      },

      // Project thread getters
      getProjectThreads: (projectId: string) => {
        const state = get();
        const project = state.projects[projectId];
        if (!project) return [];

        return (Object.values(project.projectThreads) as ProjectThread[]).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      },

      getProjectThread: (projectId: string, threadId: string) => {
        const state = get();
        const project = state.projects[projectId];
        return project?.projectThreads[threadId];
      },

      getProjectThreadMessages: (projectId: string, threadId: string) => {
        const state = get();
        const thread = state.projects[projectId]?.projectThreads[threadId];
        return thread?.messages || [];
      },

      // Project thread actions
      createProjectThread: (projectId: string, model?: string) => {
        const newThreadId = generateProjectId();
        const now = new Date().toISOString();

        set((state) => {
          const project = state.projects[projectId];
          if (project) {
            project.projectThreads[newThreadId] = {
              id: newThreadId,
              projectId,
              messages: [],
              model: model || "",
              createdAt: now,
              updatedAt: now,
              title: "New Conversation",
            };
            project.updatedAt = now;
          }
        });

        console.log("[ProjectStore] Created project thread:", newThreadId, "in project:", projectId);
        return newThreadId;
      },

      deleteProjectThread: (projectId: string, threadId: string) => {
        set((state) => {
          const project = state.projects[projectId];
          if (project) {
            delete project.projectThreads[threadId];
            project.updatedAt = new Date().toISOString();
          }
        });

        console.log("[ProjectStore] Deleted project thread:", threadId);
      },

      addProjectMessage: (projectId: string, threadId: string, message: ProjectThreadMessage) => {
        set((state) => {
          const thread = state.projects[projectId]?.projectThreads[threadId];
          if (thread) {
            thread.messages.push(message);
            thread.updatedAt = new Date().toISOString();

            // Update thread title if this is the first user message
            if (message.role === "user" && thread.messages.length === 1) {
              thread.title = generateThreadTitle(thread.messages);
            }

            // Update parent project timestamp
            state.projects[projectId].updatedAt = new Date().toISOString();
          }
        });
      },

      updateProjectMessage: (
        projectId: string,
        threadId: string,
        messageId: string,
        updates: Partial<ProjectThreadMessage>
      ) => {
        set((state) => {
          const thread = state.projects[projectId]?.projectThreads[threadId];
          if (thread) {
            const messageIndex = thread.messages.findIndex((m) => m.id === messageId);
            if (messageIndex !== -1) {
              thread.messages[messageIndex] = {
                ...thread.messages[messageIndex],
                ...updates,
              };
              thread.updatedAt = new Date().toISOString();
              state.projects[projectId].updatedAt = new Date().toISOString();
            }
          }
        });
      },

      setProjectMessages: (
        projectId: string,
        threadId: string,
        messages: ProjectThreadMessage[]
      ) => {
        set((state) => {
          const thread = state.projects[projectId]?.projectThreads[threadId];
          if (thread) {
            thread.messages = messages;
            thread.updatedAt = new Date().toISOString();
            state.projects[projectId].updatedAt = new Date().toISOString();
          }
        });
      },

      // Utility
      clearAllProjects: () => {
        set((state) => {
          state.projects = {};
        });

        console.log("[ProjectStore] Cleared all projects");
      },
    })),
    {
      name: "ollama-project-storage", // localStorage key
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Get storage statistics for UI display
 */
export function getProjectStorageStats(): {
  usedBytes: number;
  usedMB: number;
  projectCount: number;
} {
  // Only run in browser environment
  if (typeof window === "undefined") {
    return {
      usedBytes: 0,
      usedMB: 0,
      projectCount: 0,
    };
  }

  try {
    const stored = localStorage.getItem("ollama-project-storage");
    const usedBytes = stored ? new Blob([stored]).size : 0;
    const usedMB = usedBytes / (1024 * 1024);

    const state = useProjectStore.getState();
    const projectCount = Object.keys(state.projects).length;

    return {
      usedBytes,
      usedMB: parseFloat(usedMB.toFixed(2)),
      projectCount,
    };
  } catch (error) {
    console.error("[ProjectStore] Failed to get storage stats:", error);
    return {
      usedBytes: 0,
      usedMB: 0,
      projectCount: 0,
    };
  }
}
