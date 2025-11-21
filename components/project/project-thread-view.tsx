/**
 * Project Thread View
 *
 * Main layout for project-specific thread conversation view.
 * Similar to Assistant component but with project context.
 */

"use client";

import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ProjectThreadListSidebar } from "@/components/project/project-threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbLink,
} from "@/components/ui/breadcrumb";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { useModelStore } from "@/lib/stores/model-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { Skeleton } from "@/components/ui/skeleton";
import { OllamaProjectRuntimeProvider } from "@/lib/ollama-project-runtime";
import Link from "next/link";

interface ProjectThreadViewProps {
  projectId: string;
  threadId: string;
}

export const ProjectThreadView = ({
  projectId,
  threadId,
}: ProjectThreadViewProps) => {
  const selectedModel = useModelStore((state) => state.selectedModel);
  const project = useProjectStore((state) => state.getProject(projectId));
  const thread = useProjectStore((state) =>
    state.getProjectThread(projectId, threadId)
  );

  // Wait for model to be selected before rendering thread
  if (!selectedModel) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Skeleton className="h-10 w-64" />
        {/* Render ModelSelector hidden to let it fetch models */}
        <div className="hidden">
          <ModelSelector />
        </div>
      </div>
    );
  }

  // Project or thread not found
  if (!project || !thread) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {!project ? "Project not found" : "Thread not found"}
        </p>
        <Link
          href="/projects"
          className="text-sm text-primary hover:underline"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <OllamaProjectRuntimeProvider projectId={projectId} threadId={threadId}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ProjectThreadListSidebar projectId={projectId} />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/projects">Projects</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={`/projects?id=${projectId}`}>
                        {project.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{thread.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto">
                <ModelSelector />
              </div>
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread key={selectedModel} />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </OllamaProjectRuntimeProvider>
  );
};
