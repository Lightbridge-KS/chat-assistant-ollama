"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clearThreads } from "@/lib/storage/thread-storage";
import { MessageSquare, Trash2 } from "lucide-react";

interface RestoreSessionDialogProps {
  open: boolean;
  onRestore: () => void;
  onStartFresh: () => void;
  messageCount: number;
  lastSavedDate: string;
}

/**
 * Dialog shown on app load when saved conversation exists
 *
 * Gives user choice to restore previous session or start fresh
 */
export function RestoreSessionDialog({
  open,
  onRestore,
  onStartFresh,
  messageCount,
  lastSavedDate,
}: RestoreSessionDialogProps) {
  const [isClearing, setIsClearing] = useState(false);

  const handleStartFresh = () => {
    setIsClearing(true);

    // Clear localStorage
    clearThreads();

    // Call callback
    onStartFresh();

    setIsClearing(false);
  };

  // Format date for display
  const formattedDate = new Date(lastSavedDate).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            Previous Session Found
          </DialogTitle>
          <DialogDescription className="text-left">
            You have a saved conversation from <strong>{formattedDate}</strong>{" "}
            with <strong>{messageCount} message{messageCount !== 1 ? "s" : ""}</strong>.
            <br />
            <br />
            Would you like to restore it or start fresh?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleStartFresh}
            disabled={isClearing}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            Start Fresh
          </Button>
          <Button onClick={onRestore} className="gap-2">
            <MessageSquare className="size-4" />
            Restore Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
