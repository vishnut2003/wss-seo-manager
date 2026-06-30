"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Shared dashboard charts (recharts). Recolored to the purple brand; light theme
 * only. Generic over their series/slices so both the projects landing and the
 * per-project dashboard can feed their own metrics.
 */

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #ebddff",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(46,4,99,0.08)",
} as const;

export interface TrendSeries {
  /** Object key in each data row. */
  key: string;
  /** Legend label. */
  name: string;
  /** Stroke / gradient color. */
  color: string;
}

export type TrendPoint = { label: string } & Record<string, string | number>;

export function TrendAreaChart({
  data,
  series,
  emptyMessage = "No activity in the last 6 months.",
}: {
  data: TrendPoint[];
  series: TrendSeries[];
  emptyMessage?: string;
}) {
  const empty =
    data.length === 0 ||
    data.every((d) => series.every((s) => Number(d[s.key] ?? 0) === 0));

  if (empty) {
    return (
      <div className="flex h-65 items-center justify-center rounded-2xl border border-dashed border-purple-100 bg-purple-50/40 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`fill-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="currentColor"
            className="text-purple-100"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="currentColor"
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            stroke="currentColor"
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: "#8C00FF", strokeOpacity: 0.15, strokeWidth: 24 }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              name={s.name}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2.5}
              fill={`url(#fill-${s.key})`}
              activeDot={{ r: 5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function StatusDonutChart({
  data,
  totalLabel = "Total",
  emptyMessage = "No data yet.",
}: {
  data: DonutSlice[];
  totalLabel?: string;
  emptyMessage?: string;
}) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-65 items-center justify-center rounded-2xl border border-dashed border-purple-100 bg-purple-50/40 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-56 w-full max-w-60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Pie
              data={slices.map((slice) => ({ ...slice, fill: slice.color }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {totalLabel}
          </span>
        </div>
      </div>
      <ul className="grid w-full gap-2 sm:grid-cols-2">
        {slices.map((slice) => {
          const pct = Math.round((slice.value / total) * 100);
          return (
            <li
              key={slice.name}
              className="flex items-center justify-between gap-3 rounded-xl bg-purple-50/50 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="truncate text-xs font-medium text-foreground/80">
                  {slice.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-foreground">
                {slice.value.toLocaleString()}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  {pct}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
