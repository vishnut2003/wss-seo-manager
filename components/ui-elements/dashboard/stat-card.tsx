import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard KPI card: gradient icon tile, optional month-over-month trend badge,
 * big value, label, and sub-label. Optionally wraps in a link with a hover lift.
 * Ported from the wd-sales reference, recolored to the purple brand.
 */

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Sub-label under the value, e.g. "vs last month". */
  hint?: string;
  /** MoM percent change; null hides the badge. */
  trend?: number | null;
  href?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend = null,
  href,
}: StatCardProps) {
  const positive = (trend ?? 0) >= 0;

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
          <Icon className="h-5 w-5" />
        </span>
        {trend !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
              positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/70">{hint}</p>}
    </>
  );

  const className = cn(
    "group relative block overflow-hidden rounded-3xl border border-purple-100 bg-white p-5 shadow-xl shadow-purple-900/5 transition",
    href && "hover:-translate-y-0.5 hover:shadow-lg hover:ring-4 hover:ring-purple-100"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}
