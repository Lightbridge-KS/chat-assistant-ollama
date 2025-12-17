"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, PencilIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { ProjectThread } from "@/components/project/project-thread";
import { OllamaProjectRuntimeProvider } from "@/lib/ollama-project-runtime";
import { ProjectActionMenu } from "@/components/project/project-action-menu";
import { ProjectInstructionDialog } from "@/components/project/project-instruction-dialog";
import { ProjectEditDialog } from "@/components/project/project-edit-dialog";
import { useProjectStore } from "@/lib/stores/project-store";

interface ProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
}

export function ProjectDetailView({
  projectId,
  onBack,
}: ProjectDetailViewProps) {
  const getProject = useProjectStore((state) => state.getProject);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const project = getProject(projectId);
  const [isInstructionDialogOpen, setIsInstructionDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Redirect to gallery if project not found
  useEffect(() => {
    if (!project) {
      console.warn("[ProjectDetailView] Project not found:", projectId);
      onBack();
    }
  }, [project, projectId, onBack]);

  const handleSaveInstruction = (newInstruction: string) => {
    if (project) {
      updateProject(projectId, { instruction: newInstruction });
    }
  };

  const handleSaveEdit = (name: string, description: string) => {
    if (project) {
      updateProject(projectId, { name, description });
    }
  };

  const handleConfirmDelete = () => {
    deleteProject(projectId);
    setDeleteDialogOpen(false);
    onBack(); // Redirect to gallery
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  // Show loading or return null if project doesn't exist
  if (!project) {
    return null;
  }

  return (
    <OllamaProjectRuntimeProvider projectId={projectId}>
      <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <Link
            href="/projects"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Projects
          </Link>

          <div className="text-sm text-muted-foreground">/</div>

          <h2 className="text-sm font-medium">{project.name}</h2>

          <div className="ml-auto">
            <ModelSelector />
          </div>
        </header>

        {/* Main content - two columns */}
        <main className="flex flex-1 overflow-hidden">
          {/* Left section - Project Thread (Composer + Thread List) */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Project header */}
            <div className="border-b px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-xl font-semibold">{project.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {project.description}
                  </p>
                </div>

                {/* Three-dots dropdown menu */}
                <ProjectActionMenu
                  onEdit={() => setIsEditDialogOpen(true)}
                  onDelete={() => setDeleteDialogOpen(true)}
                />
              </div>
            </div>

            {/* Project Thread with composer and thread list */}
            <div className="flex-1 overflow-hidden">
              <ProjectThread projectId={projectId} />
            </div>
          </div>

          {/* Right sidebar - Fixed width */}
          <aside className="w-96 border-l overflow-auto p-6">
            {/* Project Instruction Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Project Instruction</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setIsInstructionDialogOpen(true)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-10">
                  {project.instruction || "No instruction provided yet."}
                </p>
              </CardContent>
            </Card>
          </aside>
        </main>

        {/* Edit Instruction Dialog */}
        <ProjectInstructionDialog
          open={isInstructionDialogOpen}
          onOpenChange={setIsInstructionDialogOpen}
          instruction={project.instruction}
          onSave={handleSaveInstruction}
        />

        {/* Edit Project Details Dialog */}
        <ProjectEditDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          name={project.name}
          description={project.description}
          onSave={handleSaveEdit}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{project.name}&quot;? This
                will permanently delete the project and all its conversations.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OllamaProjectRuntimeProvider>
  );
}
