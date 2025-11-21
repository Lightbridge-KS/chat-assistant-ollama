/**
 * Project Thread List Sidebar
 *
 * Sidebar for project-specific thread view with project context.
 */

"use client";

import * as React from "react";
import { FolderKanban, Settings, ChevronUp } from "lucide-react";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectThreadList } from "@/components/project/project-threadlist";
import { useProjectStore } from "@/lib/stores/project-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

interface ProjectThreadListSidebarProps extends React.ComponentProps<typeof Sidebar> {
  projectId: string;
}

export function ProjectThreadListSidebar({
  projectId,
  ...props
}: ProjectThreadListSidebarProps) {
  // Get project details
  const project = useProjectStore((state) => state.getProject(projectId));

  // Get Ollama host URL from settings store
  const ollamaHostUrl = useSettingsStore((state) => state.ollamaHostUrl);

  // Extract hostname from URL
  const getHostnameFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname; // "localhost" or "10.6.34.95"
    } catch {
      return "localhost"; // Fallback if URL is invalid
    }
  };

  const hostname = getHostnameFromUrl(ollamaHostUrl);
  const projectName = project?.name || "Project";

  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link
                  href={`/projects?id=${projectId}`}
                >
                  <div className="aui-sidebar-header-icon-wrapper flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <FolderKanban className="aui-sidebar-header-icon size-4" />
                  </div>
                  <div className="aui-sidebar-header-heading mr-6 flex flex-col gap-0.5 leading-none">
                    <span className="aui-sidebar-header-title font-semibold">
                      {projectName}
                    </span>
                    <span className="text-xs text-muted-foreground">Project</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <ProjectThreadList />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="aui-sidebar-footer border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <div className="aui-sidebar-footer-icon-wrapper flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <FolderKanban className="aui-sidebar-footer-icon size-4" />
                  </div>
                  <div className="aui-sidebar-footer-heading flex flex-col gap-0.5 leading-none">
                    <span className="aui-sidebar-footer-title font-semibold">
                      {projectName}
                    </span>
                    <span className="text-xs">{hostname}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
