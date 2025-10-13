"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ModelSelector } from "@/components/assistant-ui/model-selector";
import { useModelStore } from "@/lib/stores/model-store";
import { Skeleton } from "@/components/ui/skeleton";
import { useOllamaRuntime } from "@/lib/ollama-runtime";

export const Assistant = () => {
  const selectedModel = useModelStore((state) => state.selectedModel);

  // Use custom Ollama runtime for static SPA
  const runtime = useOllamaRuntime();

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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="https://www.assistant-ui.com/docs/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Build Your Own Ollama UX
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Ollama Chat</BreadcrumbPage>
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
    </AssistantRuntimeProvider>
  );
};
