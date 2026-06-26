import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface Metric {
  icon: LucideIcon;
  label: string;
  value: string;
}

function MetricCard({ icon: Icon, label, value }: Metric) {
  return (
    <Card className="border-purple-100 shadow-xl shadow-purple-900/5">
      <CardContent className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

export function MetricCards({
  metrics,
  rangeLabel,
}: {
  metrics: Metric[];
  rangeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{rangeLabel}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}
