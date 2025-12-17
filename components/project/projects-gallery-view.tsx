"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectActionMenu } from "@/components/project/project-action-menu";
import { ProjectEditDialog } from "@/components/project/project-edit-dialog";
import { useProjectStore } from "@/lib/stores/project-store";

interface ProjectsGalleryViewProps {
  onProjectClick: (projectId: string) => void;
}

export function ProjectsGalleryView({
  onProjectClick,
}: ProjectsGalleryViewProps) {
  // Get raw projects object and convert to array in component
  // This avoids infinite loop from getAllProjects() creating new array every render
  const projectsRecord = useProjectStore((state) => state.projects);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const projects = Object.values(projectsRecord).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Filter projects by search query (case-insensitive name match)
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleEditClick = (
    projectId: string,
    projectName: string,
    projectDescription: string
  ) => {
    setProjectToEdit({
      id: projectId,
      name: projectName,
      description: projectDescription,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (name: string, description: string) => {
    if (projectToEdit) {
      updateProject(projectToEdit.id, { name, description });
      setEditDialogOpen(false);
      setProjectToEdit(null);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setProjectToEdit(null);
  };

  const handleDeleteClick = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header with back navigation */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </div>

        {/* Title row with search and new project button */}
        <div className="mt-4 flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Projects Gallery</h1>

          <div className="ml-auto flex items-center gap-4">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                className="pl-9 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* New project button */}
            <Link href="/projects/create">
              <Button>
                <Plus className="size-4 mr-2" />
                New project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content - Project cards grid */}
      <main className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-6xl">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              {projects.length === 0 ? (
                <>
                  <p className="text-muted-foreground text-lg mb-4">
                    No projects yet
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Create your first project to get started
                  </p>
                  <Link href="/projects/create">
                    <Button>
                      <Plus className="size-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-lg mb-4">
                    No projects found
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No projects matching &quot;{searchQuery}&quot;
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <Card
                  key={project.id}
                  className="hover:shadow-lg transition-shadow relative"
                >
                  <Link
                    href={`/projects?id=${project.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onProjectClick(project.id);
                    }}
                    className="cursor-pointer"
                  >
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>{project.description}</CardDescription>
                    </CardHeader>
                  </Link>

                  {/* Three-dot menu in absolute top-right */}
                  <ProjectActionMenu
                    triggerClassName="absolute top-2 right-2 z-10"
                    stopPropagation={true}
                    onEdit={() =>
                      handleEditClick(
                        project.id,
                        project.name,
                        project.description
                      )
                    }
                    onDelete={() => handleDeleteClick(project.id, project.name)}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Project Details Dialog */}
      {projectToEdit && (
        <ProjectEditDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              handleCancelEdit();
            }
          }}
          name={projectToEdit.name}
          description={projectToEdit.description}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.name}
              &quot;? This action cannot be undone.
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
  );
}
