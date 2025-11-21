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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  onSave: (name: string, description: string) => void;
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  name,
  description,
  onSave,
}: ProjectEditDialogProps) {
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);

  const handleSave = () => {
    // Validate name is not empty
    if (draftName.trim() === "") {
      return;
    }
    onSave(draftName.trim(), draftDescription.trim());
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setDraftName(name);
    setDraftDescription(description);
    onOpenChange(false);
  };

  // Sync draft with props when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setDraftName(name);
      setDraftDescription(description);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Project Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="Enter project name..."
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Describe your project..."
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={draftName.trim() === ""}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
