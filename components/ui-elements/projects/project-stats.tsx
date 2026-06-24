import { FolderKanban, Activity, KeyRound, CircleCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ProjectsSummary {
  total: number;
  avgHealth: number;
  totalKeywords: number;
  active: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-purple-100 bg-white p-5 shadow-xl shadow-purple-900/5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ProjectStats({ summary }: { summary: ProjectsSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={FolderKanban}
        label="Total projects"
        value={summary.total.toLocaleString()}
      />
      <StatCard
        icon={CircleCheck}
        label="Active projects"
        value={summary.active.toLocaleString()}
      />
      <StatCard
        icon={Activity}
        label="Avg. health score"
        value={summary.total ? `${summary.avgHealth}` : "—"}
      />
      <StatCard
        icon={KeyRound}
        label="Keywords tracked"
        value={summary.totalKeywords.toLocaleString()}
      />
    </div>
  );
}
