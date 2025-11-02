/**
 * Thread Storage Utilities
 *
 * Handles saving, loading, and managing thread conversations in localStorage.
 * Implements cleanup strategies and storage quota management.
 */

import type { ThreadMessage } from "@assistant-ui/react";

// Storage key for persisted threads
const STORAGE_KEY = "ollama-threads-storage";

// Storage configuration
export const STORAGE_CONFIG = {
  maxThreads: 10, // Keep last 10 threads
  maxStorageBytes: 5 * 1024 * 1024, // 5MB limit
  warningThreshold: 0.8, // Warn at 80% capacity
};

/**
 * Type for a single thread's data
 */
export interface ThreadData {
  id: string;
  messages: ThreadMessage[];
  createdAt: string;
  updatedAt: string;
  model?: string;
}

/**
 * Type for the complete persisted storage structure
 */
export interface PersistedThreadsData {
  threads: Record<string, ThreadData>;
  mainThreadId: string | null;
  savedAt: string;
  version: string; // For future migration support
}

/**
 * Save threads to localStorage with cleanup
 */
export function saveThreads(data: {
  threadId: string;
  messages: ThreadMessage[];
  model?: string;
}): void {
  try {
    // Load existing data
    const existing = loadThreads();

    // Update or create thread
    const thread: ThreadData = {
      id: data.threadId,
      messages: data.messages,
      createdAt: existing?.threads[data.threadId]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: data.model,
    };

    // Merge with existing threads
    const updatedThreads = {
      ...existing?.threads,
      [data.threadId]: thread,
    };

    // Cleanup old threads if needed
    const cleanedThreads = cleanupOldThreads(updatedThreads);

    // Create final data structure
    const persistedData: PersistedThreadsData = {
      threads: cleanedThreads,
      mainThreadId: data.threadId,
      savedAt: new Date().toISOString(),
      version: "1.0",
    };

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedData));

    // Check storage quota
    checkStorageQuota();

    console.log("[ThreadStorage] Saved thread:", data.threadId, {
      messageCount: data.messages.length,
      totalThreads: Object.keys(cleanedThreads).length,
    });
  } catch (error) {
    console.error("[ThreadStorage] Failed to save threads:", error);

    // If quota exceeded, try aggressive cleanup
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn("[ThreadStorage] Quota exceeded, attempting aggressive cleanup");
      tryAggressiveCleanup();
    }
  }
}

/**
 * Load threads from localStorage
 */
export function loadThreads(): PersistedThreadsData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as PersistedThreadsData;

    console.log("[ThreadStorage] Loaded threads:", {
      threadCount: Object.keys(data.threads).length,
      mainThreadId: data.mainThreadId,
      savedAt: data.savedAt,
    });

    return data;
  } catch (error) {
    console.error("[ThreadStorage] Failed to load threads:", error);
    return null;
  }
}

/**
 * Clear all threads from localStorage
 */
export function clearThreads(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("[ThreadStorage] Cleared all threads");
  } catch (error) {
    console.error("[ThreadStorage] Failed to clear threads:", error);
  }
}

/**
 * Cleanup old threads to keep only the most recent N threads
 */
function cleanupOldThreads(
  threads: Record<string, ThreadData>,
  maxThreads: number = STORAGE_CONFIG.maxThreads
): Record<string, ThreadData> {
  const threadArray = Object.values(threads);

  // If under limit, no cleanup needed
  if (threadArray.length <= maxThreads) {
    return threads;
  }

  // Sort by updatedAt (most recent first)
  const sortedThreads = threadArray.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Keep only the most recent N threads
  const threadsToKeep = sortedThreads.slice(0, maxThreads);

  console.log("[ThreadStorage] Cleanup: keeping", maxThreads, "of", threadArray.length, "threads");

  // Convert back to record
  return Object.fromEntries(
    threadsToKeep.map((thread) => [thread.id, thread])
  );
}

/**
 * Aggressive cleanup when quota is exceeded
 * Reduces to half the max threads and compresses images
 */
function tryAggressiveCleanup(): void {
  try {
    const data = loadThreads();
    if (!data) return;

    // Keep only half the max threads
    const reducedMax = Math.floor(STORAGE_CONFIG.maxThreads / 2);
    const cleanedThreads = cleanupOldThreads(data.threads, reducedMax);

    // Remove images from older messages (keep only text)
    const threadsWithoutImages = Object.fromEntries(
      Object.entries(cleanedThreads).map(([id, thread]) => [
        id,
        {
          ...thread,
          messages: thread.messages.map((msg) => ({
            ...msg,
            attachments: [], // Remove all attachments to save space
          })),
        },
      ])
    );

    const persistedData: PersistedThreadsData = {
      threads: threadsWithoutImages,
      mainThreadId: data.mainThreadId,
      savedAt: new Date().toISOString(),
      version: "1.0",
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedData));

    console.warn("[ThreadStorage] Aggressive cleanup completed:", {
      threadsRemaining: Object.keys(threadsWithoutImages).length,
      imagesRemoved: true,
    });
  } catch (error) {
    console.error("[ThreadStorage] Aggressive cleanup failed:", error);
  }
}

/**
 * Check storage quota and warn if approaching limit
 */
function checkStorageQuota(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const usedBytes = new Blob([stored]).size;
    const usagePercent = usedBytes / STORAGE_CONFIG.maxStorageBytes;

    if (usagePercent >= STORAGE_CONFIG.warningThreshold) {
      console.warn("[ThreadStorage] Storage warning:", {
        usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
        limitMB: (STORAGE_CONFIG.maxStorageBytes / (1024 * 1024)).toFixed(2),
        usagePercent: (usagePercent * 100).toFixed(1) + "%",
      });
    }
  } catch (error) {
    console.error("[ThreadStorage] Failed to check storage quota:", error);
  }
}

/**
 * Get current storage usage statistics
 */
export function getStorageStats(): {
  usedBytes: number;
  usedMB: number;
  limitMB: number;
  usagePercent: number;
  threadCount: number;
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const usedBytes = stored ? new Blob([stored]).size : 0;
    const limitMB = STORAGE_CONFIG.maxStorageBytes / (1024 * 1024);
    const usedMB = usedBytes / (1024 * 1024);
    const usagePercent = (usedBytes / STORAGE_CONFIG.maxStorageBytes) * 100;

    const data = loadThreads();
    const threadCount = data ? Object.keys(data.threads).length : 0;

    return {
      usedBytes,
      usedMB: parseFloat(usedMB.toFixed(2)),
      limitMB: parseFloat(limitMB.toFixed(2)),
      usagePercent: parseFloat(usagePercent.toFixed(1)),
      threadCount,
    };
  } catch (error) {
    console.error("[ThreadStorage] Failed to get storage stats:", error);
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
 * Export threads as JSON file (for backup)
 */
export function exportThreadsToFile(): void {
  try {
    const data = loadThreads();
    if (!data) {
      console.warn("[ThreadStorage] No data to export");
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `ollama-chat-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    console.log("[ThreadStorage] Exported threads to file");
  } catch (error) {
    console.error("[ThreadStorage] Failed to export threads:", error);
  }
}
