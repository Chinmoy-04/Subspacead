"use client";

import Link from "next/link";
import { useState } from "react";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tolerance, formatDelta, TOLERANCE } from "@/components/site/tolerance";
import { RoundArrow } from "@/components/site/magnetic";
import {
  DATASET_LABEL,
  METRICS,
  METRIC_LABEL,
  SHOTS,
  bundledResults,
  metricMean,
  paperValue,
  sheetRef,
} from "@/lib/content";
import type { Dataset, MetricKey } from "@/lib/types";
import { ArrowUpRightIcon } from "lucide-react";

const DATASETS: Dataset[] = ["mvtec", "visa"];

export function Readings() {
  const [metric, setMetric] = useState<MetricKey>("image_auroc");
  const data = bundledResults;

  const rows = DATASETS.flatMap((ds) =>
    SHOTS.map((k) => {
      const ours = metricMean(data, ds, k, metric);
      const std = data.summary?.[ds]?.[String(k)]?.mean?.[metric]?.std ?? null;
      const paper = paperValue(data, ds, k, metric);
      return { ds, k, ours, std, paper, delta: ours != null && paper != null ? ours - paper : null };
    })
  );
  const deltas = rows.map((r) => r.delta).filter((d): d is number => d != null);
  const worst = deltas.length ? Math.min(...deltas) : 0;
  const best = deltas.length ? Math.max(...deltas) : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-20">
      <div className="flex flex-col gap-8">
        <h2 className="text-title text-balance">Measured against the paper.</h2>
        <p className="max-w-md text-lg text-muted-foreground text-pretty">
          Every value is the mean over all categories and five seeds, from {data.n_result_files} result files. The
          published mean is the nominal; the deviation is ours. For {METRIC_LABEL[metric]}, the reproduction lands
          between <span className="font-mono text-foreground">{formatDelta(worst)}</span> and{" "}
          <span className="font-mono text-foreground">{formatDelta(best)}</span> points of it.
        </p>
        <Link
          href="/results"
          className="group inline-flex items-center gap-3 self-start text-[0.9375rem] font-medium"
          data-cursor="Open"
        >
          <RoundArrow>
            <ArrowUpRightIcon className="size-4" />
          </RoundArrow>
          Full results and per-category gauges
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        <ToggleGroup
          type="single"
          value={metric}
          onValueChange={(v) => v && setMetric(v as MetricKey)}
          aria-label="Metric"
          className="flex flex-wrap justify-start gap-2"
        >
          {METRICS.map((m) => (
            <ToggleGroupItem
              key={m}
              value={m}
              className="h-10 rounded-full border border-border px-4 font-mono text-xs tracking-wide data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              {METRIC_LABEL[m]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full border-collapse font-mono text-[0.8125rem] tabular-nums sm:min-w-[36rem]">
            <caption className="sr-only">
              {METRIC_LABEL[metric]}: paper value, reproduction mean ± standard deviation, deviation and tolerance
            </caption>
            <thead>
              <tr className="border-b border-foreground text-left text-muted-foreground">
                <th scope="col" className="hidden py-3 pr-4 font-normal sm:table-cell">Sheet</th>
                <th scope="col" className="py-3 pr-2 font-normal sm:pr-4">Setting</th>
                <th scope="col" className="py-3 pr-2 text-right font-normal sm:pr-4">
                  <span className="sm:hidden">Paper</span>
                  <span className="max-sm:hidden">Nominal</span>
                </th>
                <th scope="col" className="py-3 pr-2 text-right font-normal sm:pr-4">
                  <span className="sm:hidden">Ours</span>
                  <span className="max-sm:hidden">Measured</span>
                </th>
                <th scope="col" className="py-3 pr-2 text-right font-normal sm:pr-4">Δ</th>
                <th scope="col" className="py-3 font-normal">Band</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ds}-${r.k}`} className="border-b border-border">
                  <td className="hidden py-4 pr-4 text-left text-muted-foreground sm:table-cell">{sheetRef(r.ds, r.k)}</td>
                  <th scope="row" className="py-4 pr-2 text-left font-sans text-sm font-normal whitespace-nowrap sm:pr-4">
                    <span className="sm:hidden">
                      {r.ds === "mvtec" ? "MVTec" : "VisA"} <span className="text-muted-foreground">k{r.k}</span>
                    </span>
                    <span className="max-sm:hidden">
                      {DATASET_LABEL[r.ds]} <span className="text-muted-foreground">· {r.k}-shot</span>
                    </span>
                  </th>
                  <td className="py-4 pr-2 text-right text-muted-foreground sm:pr-4">{r.paper?.toFixed(1) ?? "—"}</td>
                  <td className="py-4 pr-2 text-right sm:pr-4">
                    {r.ours != null ? (
                      <>
                        <NumberTicker
                          key={`${metric}-${r.ds}-${r.k}`}
                          value={r.ours}
                          startValue={Math.max(0, r.ours - 6)}
                          decimalPlaces={1}
                          className="text-base text-foreground"
                        />
                        {r.std != null && <span className="ml-1.5 text-muted-foreground max-sm:hidden">±{r.std.toFixed(1)}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-4 pr-2 text-right sm:pr-4">{r.delta != null ? formatDelta(r.delta) : "—"}</td>
                  <td className="py-4">
                    {r.delta != null ? <Tolerance delta={r.delta} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Band is a reading aid, not a paper claim: match within ±{TOLERANCE.match.toFixed(1)}, within ±
          {TOLERANCE.within.toFixed(1)}, otherwise outside. Std is across categories.
        </p>
      </div>
    </div>
  );
}
