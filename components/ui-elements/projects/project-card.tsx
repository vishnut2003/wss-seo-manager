"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Trash2,
  Search,
  TrendingUp,
  Link2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { deleteProject } from "@/app/projects/actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProjectStatus, ProjectView } from "./types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  archived: "bg-zinc-100 text-zinc-600",
};

function HealthRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 80
      ? "text-emerald-500"
      : pct >= 50
        ? "text-amber-500"
        : "text-rose-500";

  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-purple-100"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("stroke-current transition-all", color)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
        {pct}
      </span>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Search;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export function ProjectCard({
  project,
  canDelete,
}: {
  project: ProjectView;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function onDelete() {
    setDeleting(true);
    const res = await deleteProject(project.id);
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error ?? "Failed to delete project");
      return;
    }
    toast.success("Project deleted");
    router.refresh();
  }

  return (
    <>
      <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border border-purple-100 bg-white p-5 shadow-xl shadow-purple-900/5 transition",
        "hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-2xl hover:shadow-purple-900/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        deleting && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <HealthRing score={project.metrics.healthScore} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground group-hover:text-primary">
              {project.name}
            </h3>
            <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <Globe className="size-3.5 shrink-0" />
              <span className="truncate">{project.domain}</span>
            </span>
          </div>
        </div>

        {canDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-purple-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Project actions"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Badge
        className={cn(
          "capitalize",
          STATUS_STYLES[project.status]
        )}
      >
        {project.status}
      </Badge>

      <div className="grid grid-cols-3 gap-3 border-t border-purple-50 pt-4">
        <Metric icon={Search} label="Keywords" value={project.metrics.keywords} />
        <Metric
          icon={TrendingUp}
          label="Traffic"
          value={project.metrics.organicTraffic}
        />
        <Metric
          icon={Link2}
          label="Backlinks"
          value={project.metrics.backlinks}
        />
      </div>
      </Link>

      {canDelete && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes{" "}
                <span className="font-medium text-foreground">
                  {project.name}
                </span>{" "}
                and its data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void onDelete()}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
