"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ProjectsGalleryView } from "@/components/project/projects-gallery-view";
import { ProjectDetailView } from "@/components/project/project-detail-view";

export default function ProjectsPage() {
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
