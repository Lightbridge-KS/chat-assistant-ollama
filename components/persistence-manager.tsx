"use client";

import { useEffect, useState } from "react";
import { useAssistantApi } from "@assistant-ui/react";
import { usePersistThreads } from "@/lib/hooks/use-persist-threads";
import { loadThreads } from "@/lib/storage/thread-storage";
import { RestoreSessionDialog } from "@/components/restore-session-dialog";

/**
 * Persistence Manager Component
 *
 * Handles:
 * 1. Auto-saving threads using event-driven hook
 * 2. Restoring saved sessions on mount
 * 3. Showing restore dialog to user
 *
 * This component has no visible UI (just side effects)
 */
export function PersistenceManager() {
  const api = useAssistantApi();

  // Auto-save hook (listens to events and saves)
  usePersistThreads();

  // Dialog state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedData, setSavedData] = useState<{
    messageCount: number;
    lastSavedDate: string;
  } | null>(null);

  /**
   * Check for saved data on mount
   */
  useEffect(() => {
    const data = loadThreads();

    if (data && data.threads.main && data.threads.main.messages.length > 0) {
      // Found saved data
      setSavedData({
        messageCount: data.threads.main.messages.length,
        lastSavedDate: data.savedAt,
      });

      // Show restore dialog
      setShowRestoreDialog(true);

      console.log("[PersistenceManager] Found saved session:", {
        messageCount: data.threads.main.messages.length,
        savedAt: data.savedAt,
      });
    } else {
      console.log("[PersistenceManager] No saved session found");
    }
  }, []);

  /**
   * Handle restore - append saved messages to thread
   */
  const handleRestore = () => {
    try {
      const data = loadThreads();

      if (!data || !data.threads.main) {
        console.error("[PersistenceManager] No data to restore");
        setShowRestoreDialog(false);
        return;
      }

      const messages = data.threads.main.messages;

      console.log("[PersistenceManager] Restoring messages:", {
        messageCount: messages.length,
      });

      // Append each message to the thread
      for (const message of messages) {
        api.thread().append(message);
      }

      console.log("[PersistenceManager] Restoration complete");

      // Close dialog
      setShowRestoreDialog(false);
    } catch (error) {
      console.error("[PersistenceManager] Failed to restore session:", error);
      setShowRestoreDialog(false);
    }
  };

  /**
   * Handle start fresh - just close dialog (localStorage already cleared by dialog)
   */
  const handleStartFresh = () => {
    console.log("[PersistenceManager] Starting fresh session");
    setShowRestoreDialog(false);
  };

  // Render dialog if needed
  if (showRestoreDialog && savedData) {
    return (
      <RestoreSessionDialog
        open={showRestoreDialog}
        onRestore={handleRestore}
        onStartFresh={handleStartFresh}
        messageCount={savedData.messageCount}
        lastSavedDate={savedData.lastSavedDate}
      />
    );
  }

  // No UI otherwise (just side effects from hooks)
  return null;
}
