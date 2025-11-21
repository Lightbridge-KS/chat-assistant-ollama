/**
 * Project Store - Zustand store for managing projects
 *
 * Stores project configurations with automatic localStorage persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

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

  // Actions
  addProject: (
    project: Omit<Project, "id" | "createdAt" | "updatedAt">
  ) => string;
  updateProject: (id: string, updates: Partial<Omit<Project, "id">>) => void;
  deleteProject: (id: string) => void;

  // Utility
  clearAllProjects: () => void;
}

/**
 * Generate unique ID for projects
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

      // Actions
      addProject: (project) => {
        const newId = generateProjectId();
        const now = new Date().toISOString();

        set((state) => {
          state.projects[newId] = {
            ...project,
            id: newId,
            createdAt: now,
            updatedAt: now,
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
