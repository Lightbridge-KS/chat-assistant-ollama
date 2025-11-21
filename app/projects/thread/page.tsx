/**
 * Project Thread Page
 *
 * Route: /projects/thread?id={threadId}
 * Displays full conversation for a project-specific thread.
 */

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectThreadView } from "@/components/project/project-thread-view";
import { useProjectStore } from "@/lib/stores/project-store";
import Link from "next/link";

function ProjectThreadPageContent() {
  const searchParams = useSearchParams();
  const threadId = searchParams.get("id");

  // Find which project this thread belongs to
  // Select raw Record to avoid infinite loop
  const projectsRecord = useProjectStore((state) => state.projects);
  const projects = Object.values(projectsRecord);
  const projectId = projects.find((p) =>
    p.projectThreads && Object.keys(p.projectThreads).includes(threadId || "")
  )?.id;

  // If no threadId or projectId found, show error
  if (!threadId || !projectId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Thread not found</p>
        <Link
          href="/projects"
          className="text-sm text-primary hover:underline"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  return <ProjectThreadView projectId={projectId} threadId={threadId} />;
}

export default function ProjectThreadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <ProjectThreadPageContent />
    </Suspense>
  );
}
