"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/stores/project-store";

export default function CreateProjectPage() {
  const router = useRouter();
  const addProject = useProjectStore((state) => state.addProject);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");

  const handleCancel = () => {
    router.push("/projects");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!projectName.trim()) {
      return;
    }

    // Save project to store and get the generated ID
    const projectId = addProject({
      name: projectName,
      description: description || "",
      instruction: "", // Empty instruction initially
    });

    // Navigate to the new project page using query parameter
    router.push(`/projects?id=${projectId}`);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 px-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Create a project
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project name field */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="What are you working on?"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Button group */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
