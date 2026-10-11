"use client";

import { useState } from "react";
import { Gauge } from "@/components/site/gauge";
import { MarkdownTables } from "@/components/site/markdown-tables";
import { PageHeader, SourceNote } from "@/components/site/page-header";
import { Pills } from "@/components/site/pills";
import { Reveal } from "@/components/site/reveal";
import { TOLERANCE, ToleranceMark, formatDelta, toleranceOf, TOLERANCE_LABEL } from "@/components/site/tolerance";
import { api } from "@/lib/api";
import {
  DATASET_LABEL,
  METRICS,
  METRIC_LABEL,
  bundledResults,
  categoryLabel,
  metricMean,
  paperValue,
  sheetRef,
} from "@/lib/content";
import type { Dataset, MetricKey, ResultsData } from "@/lib/types";
import { useLive } from "@/lib/use-live";

const DATASETS: Dataset[] = ["mvtec", "visa"];

function shotsOf(data: ResultsData, ds: string) {
  return Object.keys(data.summary?.[ds] ?? {})
    .map(Number)
    .filter((k) => k > 0)
    .sort((a, b) => a - b);
}

function DeltaNote({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-muted-foreground">no nominal</span>;
  const state = toleranceOf(delta);
  return (
    <span className="inline-flex items-center gap-2">
      {formatDelta(delta)}
      <ToleranceMark state={state} />
      <span className="sr-only">{TOLERANCE_LABEL[state]}</span>
    </span>
  );
}

function Comparison({ data }: { data: ResultsData }) {
  const [metric, setMetric] = useState<MetricKey>("image_auroc");
  const rows = DATASETS.flatMap((ds) =>
    shotsOf(data, ds).map((k) => {
      const ours = metricMean(data, ds, k, metric);
      const paper = paperValue(data, ds, k, metric);
      return {
        id: `${ds}-${k}`,
        label: (
          <span className="flex flex-col">
            <span>
              {DATASET_LABEL[ds]} <span className="whitespace-nowrap text-muted-foreground">· {k}-shot</span>
            </span>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{sheetRef(ds, k)}</span>
          </span>
        ),
        values: { paper, ours },
        note: <DeltaNote delta={ours != null && paper != null ? ours - paper : null} />,
      };
    })
  );

  return (
    <section className="container-site grid grid-cols-[minmax(0,1fr)] gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-20">
      <div className="flex flex-col gap-6">
        <h2 className="text-4xl font-medium tracking-tight text-balance md:text-5xl">Nominal against measured.</h2>
        <p className="max-w-md text-muted-foreground text-pretty">
          Rings are the paper&rsquo;s published means, dots are this reproduction. The scale starts where the data does,
          so a one-point gap stays visible.
        </p>
        <Pills label="Metric" value={metric} options={METRICS} onChange={setMetric} format={(m) => METRIC_LABEL[m]} mono />
      </div>
      <Gauge
        rows={rows}
        series={[
          { key: "paper", label: "Paper (nominal)", shape: "ring", color: "var(--foreground)" },
          { key: "ours", label: "Ours (measured)", shape: "dot", color: "var(--foreground)" },
        ]}
        caption={`${METRIC_LABEL[metric]}, mean over categories`}
      />
    </section>
  );
}

function TableOne({ data }: { data: ResultsData }) {
  return (
    <section className="container-site flex flex-col gap-8 py-16 md:py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h2 className="text-4xl font-medium tracking-tight md:text-5xl">Table 1, remeasured</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Mean ± std across categories, five seeds each. Under each value: the paper&rsquo;s number and our deviation from it.
          Marks: filled within ±{TOLERANCE.match.toFixed(1)}, half within ±{TOLERANCE.within.toFixed(1)}, ring outside.
        </p>
      </div>
      <Reveal className="overflow-x-auto" data-lenis-prevent>
        <table className="w-full min-w-[52rem] border-collapse text-sm tabular-nums">
          <caption className="sr-only">Reproduction against the paper&rsquo;s Table 1 for every dataset, shot count and metric</caption>
          <thead>
            <tr className="border-b border-foreground text-left font-mono text-xs text-muted-foreground">
              <th scope="col" className="py-3 pr-4 font-normal">Setting</th>
              {METRICS.map((m) => (
                <th key={m} scope="col" className="py-3 pr-4 text-right font-normal">
                  {METRIC_LABEL[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATASETS.flatMap((ds) =>
              shotsOf(data, ds).map((k) => (
                <tr key={`${ds}-${k}`} className="border-b border-border align-top">
                  <th scope="row" className="py-4 pr-4 text-left font-normal">
                    {DATASET_LABEL[ds]} <span className="text-muted-foreground">· {k}-shot</span>
                    <span className="block font-mono text-[0.6875rem] text-muted-foreground">{sheetRef(ds, k)}</span>
                  </th>
                  {METRICS.map((m) => {
                    const stat = data.summary?.[ds]?.[String(k)]?.mean?.[m];
                    const paper = paperValue(data, ds, k, m);
                    const delta = stat && paper != null ? stat.mean - paper : null;
                    return (
                      <td key={m} className="py-4 pr-4 text-right font-mono">
                        {stat ? (
                          <>
                            <span className="text-base">{stat.mean.toFixed(1)}</span>
                            <span className="ml-1 text-xs text-muted-foreground">±{stat.std.toFixed(1)}</span>
                            <span className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                              {paper != null ? (
                                <>
                                  paper {paper.toFixed(1)} · {formatDelta(delta!)}
                                  <ToleranceMark state={toleranceOf(delta!)} />
                                  <span className="sr-only">{TOLERANCE_LABEL[toleranceOf(delta!)]}</span>
                                </>
                              ) : (
                                "no paper value"
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Reveal>
    </section>
  );
}

function PerCategory({ data }: { data: ResultsData }) {
  const [ds, setDs] = useState<Dataset>("mvtec");
  const shots = shotsOf(data, ds);
  const [k, setK] = useState<number>(shots[0] ?? 1);
  const [metric, setMetric] = useState<MetricKey>("image_auroc");
  const kk = shots.includes(k) ? k : shots[0];
  const cats = data.summary?.[ds]?.[String(kk)]?.categories ?? {};
  const rows = Object.entries(cats)
    .map(([cat, m]) => ({ category: categoryLabel(cat), value: m[metric]?.mean ?? null, std: m[metric]?.std ?? null }))
    .filter((r): r is { category: string; value: number; std: number | null } => r.value != null)
    .sort((a, b) => b.value - a.value);
  const weakest = rows.slice(-3).reverse();

  return (
    <section className="inverse rounded-t-[2.5rem] bg-background text-foreground">
      <div className="container-site grid grid-cols-[minmax(0,1fr)] gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-20">
        <div className="flex flex-col gap-8">
          <h2 className="text-4xl font-medium tracking-tight text-balance md:text-5xl">Category by category.</h2>
          <div className="flex flex-col gap-5">
            <Pills label="Dataset" value={ds} options={DATASETS} onChange={setDs} format={(d) => DATASET_LABEL[d]} />
            <Pills label="Shots" value={kk} options={shots} onChange={setK} format={(v) => `${v}-shot`} />
            <Pills label="Metric" value={metric} options={METRICS} onChange={setMetric} format={(m) => METRIC_LABEL[m]} mono />
          </div>
          {weakest.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <p className="text-sm text-muted-foreground">Weakest categories here</p>
              <ul className="flex flex-col gap-1 font-mono text-sm tabular-nums">
                {weakest.map((r) => (
                  <li key={r.category} className="flex justify-between gap-4">
                    <span className="font-sans">{r.category}</span>
                    {r.value.toFixed(1)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Gauge
          rows={rows.map((r) => ({
            id: r.category,
            label: <span className="capitalize">{r.category}</span>,
            values: { value: r.value },
            note: (
              <span>
                {r.value.toFixed(1)}
                {r.std != null && <span className="ml-1 text-muted-foreground">±{r.std.toFixed(1)}</span>}
              </span>
            ),
          }))}
          series={[{ key: "value", label: `${METRIC_LABEL[metric]}, mean over seeds`, shape: "dot" }]}
          caption={`${DATASET_LABEL[ds]} · ${kk}-shot`}
          labelWidth="min(9rem, 30%)"
        />
      </div>
    </section>
  );
}

export function ResultsView() {
  const { data, source, loading } = useLive(api.results, bundledResults);

  return (
    <>
      <PageHeader
        title="Results"
        lede={
          <p>
            Full MVTec-AD and VisA at k ∈ {"{1, 2, 4}"}, five seeds per setting, {data.n_result_files} result files. The
            paper&rsquo;s published means are the nominal; every deviation is ours minus theirs, in points.
          </p>
        }
        aside={<SourceNote source={source} loading={loading} />}
      />
      {data.partial && (
        <div className="container-site">
          <p role="status" className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
            These are partial results; a run is still in progress, so some settings may be missing.
          </p>
        </div>
      )}
      <Comparison data={data} />
      <TableOne data={data} />
      <PerCategory data={data} />
      {data.tables_md && (
        <section className="inverse bg-background text-foreground">
          <div className="container-site pb-20 md:pb-28">
            <details className="group rounded-2xl border border-border p-5 md:p-6">
              <summary className="cursor-pointer list-none text-lg font-medium marker:hidden">
                <span className="inline-flex items-center gap-3">
                  <span className="inline-block transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                  Raw tables.md from the aggregator
                </span>
              </summary>
              <div className="mt-6">
                <MarkdownTables source={data.tables_md} />
              </div>
            </details>
          </div>
        </section>
      )}
    </>
  );
}
