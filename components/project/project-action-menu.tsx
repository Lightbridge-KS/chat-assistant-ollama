"use client";

import { MoreVertical, PencilIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  triggerClassName?: string;
  stopPropagation?: boolean;
}

export function ProjectActionMenu({
  onEdit,
  onDelete,
  triggerClassName = "",
  stopPropagation = false,
}: ProjectActionMenuProps) {
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
  };

  return (
    <div className={triggerClassName}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleTriggerClick}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon className="mr-2 size-4" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
