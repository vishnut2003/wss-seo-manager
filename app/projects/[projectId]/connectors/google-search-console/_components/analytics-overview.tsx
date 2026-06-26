import { MousePointerClick, Eye, Percent, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DateRange,
  SearchAnalyticsTotals,
} from "@/lib/google/search-console";
import { formatCtr, formatNumber, formatPosition } from "./format";

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
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

export function AnalyticsOverview({
  totals,
  range,
}: {
  totals: SearchAnalyticsTotals;
  range: DateRange;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {range.startDate} – {range.endDate}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={MousePointerClick}
          label="Clicks"
          value={formatNumber(totals.clicks)}
        />
        <MetricCard
          icon={Eye}
          label="Impressions"
          value={formatNumber(totals.impressions)}
        />
        <MetricCard icon={Percent} label="Avg. CTR" value={formatCtr(totals.ctr)} />
        <MetricCard
          icon={TrendingUp}
          label="Avg. position"
          value={formatPosition(totals.position)}
        />
      </div>
    </div>
  );
}
