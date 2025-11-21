import type { FC } from "react";
import Link from "next/link";
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAssistantState,
} from "@assistant-ui/react";
import { ArchiveIcon, PlusIcon, FolderKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Skeleton } from "@/components/ui/skeleton";

//  🗂️  ThreadList (threads) - Manages the list of conversations
export const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col items-stretch gap-1.5">
      <ThreadListNew />
      <ThreadListProject />
      <ThreadListItems />
    </ThreadListPrimitive.Root>
  );
};

const ThreadListNew: FC = () => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        className="aui-thread-list-new flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted data-active:bg-muted"
        variant="ghost"
      >
        <PlusIcon />
        New Chat
      </Button>
    </ThreadListPrimitive.New>
  );
};

const ThreadListProject: FC = () => {
  return (
    <Link href="/projects">
      <Button
        className="aui-thread-list-project flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted"
        variant="ghost"
      >
        <FolderKanban />
        Projects
      </Button>
    </Link>
  );
};

// 📄 ThreadListItem (threadListItem) - Individual thread in the list
const ThreadListItems: FC = () => {
  const isLoading = useAssistantState(({ threads }) => threads.isLoading);

  if (isLoading) {
    return <ThreadListSkeleton />;
  }

  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />;
};

const ThreadListSkeleton: FC = () => {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="Loading threads"
          aria-live="polite"
          className="aui-thread-list-skeleton-wrapper flex items-center gap-2 rounded-md px-3 py-2"
        >
          <Skeleton className="aui-thread-list-skeleton h-[22px] flex-grow" />
        </div>
      ))}
    </>
  );
};

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="aui-thread-list-item flex items-center gap-2 rounded-lg transition-all hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-active:bg-muted">
      <ThreadListItemPrimitive.Trigger className="aui-thread-list-item-trigger flex-grow px-3 py-2 text-start">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemArchive />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemTitle: FC = () => {
  return (
    <span className="aui-thread-list-item-title text-sm">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </span>
  );
};

const ThreadListItemArchive: FC = () => {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="aui-thread-list-item-archive mr-3 ml-auto size-4 p-0 text-foreground hover:text-primary"
        variant="ghost"
        tooltip="Archive thread"
      >
        <ArchiveIcon />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  );
};
