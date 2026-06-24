import { FolderPlus } from "lucide-react";
import { NewProjectDialog } from "./new-project-dialog";

export function ProjectsEmptyState() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white p-12 text-center shadow-xl shadow-purple-900/5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-400/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
          <FolderPlus className="size-7" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            No projects yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start tracking keywords, traffic, and
            site health.
          </p>
        </div>
        <NewProjectDialog />
      </div>
    </div>
  );
}
