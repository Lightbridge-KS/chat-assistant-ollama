"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProjectInstructionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruction: string;
  onSave: (instruction: string) => void;
}

export function ProjectInstructionDialog({
  open,
  onOpenChange,
  instruction,
  onSave,
}: ProjectInstructionDialogProps) {
  const [draftInstruction, setDraftInstruction] = useState(instruction);

  const handleSave = () => {
    onSave(draftInstruction);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraftInstruction(instruction); // Reset to original
    onOpenChange(false);
  };

  // Sync draft with prop when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setDraftInstruction(instruction);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Project Instruction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="instruction">Instruction</Label>
            <Textarea
              id="instruction"
              placeholder="Describe how you want the assistant to behave in this project..."
              value={draftInstruction}
              onChange={(e) => setDraftInstruction(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This instruction will be used as additional context for all conversations in this project.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
