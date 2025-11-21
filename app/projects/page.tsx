"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProjectsGalleryView } from "@/components/project/projects-gallery-view";
import { ProjectDetailView } from "@/components/project/project-detail-view";

function ProjectsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("id");

  const handleProjectClick = (id: string) => {
    router.push(`/projects?id=${id}`);
  };

  const handleBackToGallery = () => {
    router.push("/projects");
  };

  // Show project detail view if id parameter exists
  if (projectId) {
    return (
      <ProjectDetailView projectId={projectId} onBack={handleBackToGallery} />
    );
  }

  // Otherwise show gallery view
  return <ProjectsGalleryView onProjectClick={handleProjectClick} />;
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <ProjectsPageContent />
    </Suspense>
  );
}
