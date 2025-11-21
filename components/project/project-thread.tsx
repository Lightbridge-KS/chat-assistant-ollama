/**
 * Project Thread Component
 *
 * Displays composer and list of project-specific chat threads.
 * Composer creates new threads. Thread cards are non-clickable placeholders.
 */

"use client";

import { type FC, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreVertical, Trash2 } from "lucide-react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ComposerAddAttachment,
  ComposerAttachments,
} from "@/components/assistant-ui/attachment";
import { ArrowUpIcon, Square } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ThreadPrimitive } from "@assistant-ui/react";
import { useProjectStore } from "@/lib/stores/project-store";

interface ProjectThreadProps {
  projectId: string;
}

/**
 * Main component: Composer + Thread List
 */
export const ProjectThread: FC<ProjectThreadProps> = ({ projectId }) => {
  const router = useRouter();

  // Get raw projectThreads object to avoid infinite loop
  // (getProjectThreads returns new array every call)
  const projectThreadsRecord = useProjectStore(
    (state) => state.projects[projectId]?.projectThreads || {}
  );
  const deleteProjectThread = useProjectStore((state) => state.deleteProjectThread);

  // Transform and sort in component
  const projectThreads = Object.values(projectThreadsRecord).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Track previous thread count to detect new thread creation
  const prevThreadCountRef = useRef(projectThreads.length);

  // Auto-redirect to newest thread when a new one is created
  useEffect(() => {
    const prevCount = prevThreadCountRef.current;
    const currentCount = projectThreads.length;

    // If thread was just created (count increased from 0 or more)
    if (currentCount > prevCount && currentCount > 0) {
      // Get the newest thread (first after sort by updatedAt)
      const newestThread = projectThreads[0];
      console.log("[ProjectThread] Auto-redirecting to new thread:", newestThread.id);
      router.push(`/projects/thread?id=${newestThread.id}`);
    }

    // Update ref for next render
    prevThreadCountRef.current = currentCount;
  }, [projectThreads, router]);

  const handleDeleteThread = (threadId: string) => {
    deleteProjectThread(projectId, threadId);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Composer at top */}
      <div className="border-b px-6 py-4">
        <ProjectComposer />
      </div>

      {/* Thread list below */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {projectThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-12">
            <p className="text-muted-foreground text-lg mb-2">
              No conversations yet
            </p>
            <p className="text-sm text-muted-foreground">
              Start a conversation by sending a messsage
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectThreads.map((thread) => (
              <Link
                key={thread.id}
                href={`/projects/thread?id=${thread.id}`}
                className="block"
              >
                <Card className="relative hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base">{thread.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(thread.updatedAt).toLocaleString()}
                        </CardDescription>
                      </div>

                      {/* Three-dot menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteThread(thread.id);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  <CardContent className="text-sm text-muted-foreground">
                    {thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Composer component (same pattern as thread.tsx)
 */
const ProjectComposer: FC = () => {
  return (
    <div className="mx-auto w-full max-w-[var(--thread-max-width)]">
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ProjectComposerAction />
      </ComposerPrimitive.Root>
    </div>
  );
};

/**
 * Composer action buttons (send/cancel)
 */
const ProjectComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-[34px] rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};
