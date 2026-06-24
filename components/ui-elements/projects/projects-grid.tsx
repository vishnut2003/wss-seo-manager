import { ProjectCard } from "./project-card";
import type { ProjectView } from "./types";

export function ProjectsGrid({
  projects,
  canDelete,
}: {
  projects: ProjectView[];
  canDelete: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          canDelete={canDelete}
        />
      ))}
    </div>
  );
}
