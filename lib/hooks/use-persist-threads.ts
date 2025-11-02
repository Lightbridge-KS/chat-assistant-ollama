/**
 * Persist Threads Hook
 *
 * Event-driven persistence using assistant-ui Context API.
 * Automatically saves thread state to localStorage when changes occur.
 */

import { useAssistantApi, useAssistantEvent } from "@assistant-ui/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { saveThreads } from "@/lib/storage/thread-storage";
import { useModelStore } from "@/lib/stores/model-store";

/**
 * Debounce utility for delaying function execution
 */
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  // Add flush method to immediately execute pending call
  (debouncedFn as typeof debouncedFn & { flush: () => void }).flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFn;
}

/**
 * Hook to persist thread conversations using Context API events
 *
 * Usage:
 * ```tsx
 * function PersistenceManager() {
 *   usePersistThreads();
 *   return null;
 * }
 * ```
 */
export function usePersistThreads() {
  const api = useAssistantApi();
  const selectedModel = useModelStore((state) => state.selectedModel);

  // Track if we've made our first save to avoid unnecessary initial saves
  const hasInitialized = useRef(false);

  /**
   * Save current thread state to localStorage
   */
  const saveCurrentThread = useCallback(() => {
    try {
      // Get current thread state from Context API
      const threadState = api.thread().getState();

      // Extract messages from thread state (convert readonly to mutable array)
      const messages = [...(threadState.messages || [])];

      // Skip save if no messages (empty thread)
      if (messages.length === 0) {
        console.log("[PersistThreads] Skipping save: no messages");
        return;
      }

      // Generate a consistent thread ID
      // For LocalRuntime, we don't have a real thread ID, so use "main"
      const threadId = "main";

      // Save to localStorage
      saveThreads({
        threadId,
        messages,
        model: selectedModel,
      });

      console.log("[PersistThreads] Saved thread:", {
        messageCount: messages.length,
        model: selectedModel,
      });
    } catch (error) {
      console.error("[PersistThreads] Failed to save thread:", error);
    }
  }, [api, selectedModel]);

  /**
   * Debounced save function - waits 1 second after last change
   */
  const debouncedSave = useMemo(
    () => debounce(saveCurrentThread, 1000),
    [saveCurrentThread]
  );

  /**
   * Event: User sends a message
   * Save after user message is sent
   */
  useAssistantEvent("composer.send", () => {
    console.log("[PersistThreads] Event: composer.send");
    debouncedSave();
  });

  /**
   * Event: Assistant finishes generating response
   * Save after assistant completes response
   */
  useAssistantEvent("thread.run-end", () => {
    console.log("[PersistThreads] Event: thread.run-end");
    debouncedSave();
  });

  /**
   * Event: Thread is initialized (when component mounts)
   * Skip saving on initial mount to avoid overwriting with empty state
   */
  useAssistantEvent("thread.initialize", () => {
    console.log("[PersistThreads] Event: thread.initialize");

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      console.log("[PersistThreads] First initialization, skipping save");
      return;
    }

    // Save on subsequent initializations (e.g., thread switches)
    debouncedSave();
  });

  /**
   * Cleanup: Flush any pending saves when component unmounts
   */
  useEffect(() => {
    return () => {
      // Flush pending saves before unmounting
      const flush = (debouncedSave as typeof debouncedSave & { flush?: () => void }).flush;
      if (flush) {
        flush();
      }

      // Do one final save to ensure we don't lose data
      saveCurrentThread();
    };
  }, [debouncedSave, saveCurrentThread]);

  console.log("[PersistThreads] Hook mounted");
}
