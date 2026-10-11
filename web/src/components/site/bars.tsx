"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { cn } from "@/lib/utils";

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
}

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

/** Thin wrapper over the bklit BarChart with the site's defaults and a series legend. */
export function Bars({
  data,
  xKey,
  series,
  format = (v) => v.toFixed(1),
  orientation = "vertical",
  aspectRatio = "2 / 1",
  maxLabels,
  legend = series.length > 1,
  className,
  title,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: BarSeries[];
  format?: (v: number) => string;
  orientation?: "vertical" | "horizontal";
  aspectRatio?: string;
  maxLabels?: number;
  legend?: boolean;
  className?: string;
  title?: string;
}) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }));
  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      {(title || legend) && (
        <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
          {title && <span className="text-muted-foreground">{title}</span>}
          {legend && (
            <span className="flex flex-wrap gap-x-5 gap-y-1">
              {colored.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </span>
              ))}
            </span>
          )}
        </figcaption>
      )}
      <BarChart
        data={data}
        xDataKey={xKey}
        orientation={orientation}
        aspectRatio={aspectRatio}
        barGap={orientation === "horizontal" ? 0.3 : 0.25}
        margin={orientation === "horizontal" ? { left: 120, right: 16, top: 8, bottom: 24 } : undefined}
      >
        <Grid horizontal={orientation === "vertical"} vertical={orientation === "horizontal"} />
        {colored.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} lineCap={3} fadedOpacity={0.35} />
        ))}
        {orientation === "horizontal" ? <BarYAxis /> : <BarXAxis maxLabels={maxLabels} showAllLabels={!maxLabels} />}
        <ChartTooltip
          showDatePill={false}
          showCrosshair={false}
          rows={(p) =>
            colored
              .filter((s) => typeof p[s.key] === "number")
              .map((s) => ({ color: s.color, label: s.label, value: format(p[s.key] as number) }))
          }
        />
      </BarChart>
    </figure>
  );
}
