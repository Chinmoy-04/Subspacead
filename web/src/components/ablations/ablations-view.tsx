"use client";

import { useState } from "react";
import { Gauge } from "@/components/site/gauge";
import { PageHeader, SourceNote } from "@/components/site/page-header";
import { Pills } from "@/components/site/pills";
import { api } from "@/lib/api";
import {
  ABLATION_LABELS,
  ABLATION_ORDER,
  BACKBONE_SHORT,
  DATASET_LABEL,
  bundledAblations,
  categoryLabel,
} from "@/lib/content";
import type { AblationRow, Dataset } from "@/lib/types";
import { useLive } from "@/lib/use-live";

type AblMetric = "image_auroc" | "pixel_auroc" | "pro";
const ABL_METRICS: AblMetric[] = ["image_auroc", "pixel_auroc", "pro"];
const ABL_METRIC_LABEL: Record<AblMetric, string> = { image_auroc: "I-AUROC", pixel_auroc: "P-AUROC", pro: "PRO" };
const DATASETS: Dataset[] = ["mvtec", "visa"];

const PAPER_SETTING: Record<string, string> = { layers: "mean", tau: "0.99", backbone: "dinov2_vitg14", resolution: "672" };

const QUESTION: Record<string, string> = {
  layers: "Which blocks should the features come from? Run at 4-shot, as in the paper's layer table.",
  tau: "How much variance should the subspace keep? τ = 1.0 keeps every component, so nothing is left as residual.",
  backbone: "Does a larger DINOv2 help, at the same resolution and augmentation?",
  resolution: "Does the 672 px input earn its cost over 448 px?",
  batched0: "With no support images at all, fit the subspace on the test batch itself.",
};

function variantLabel(ablation: string, v: string) {
  if (ablation === "backbone") return BACKBONE_SHORT[v] ?? v;
  if (ablation === "resolution") return `${v} px`;
  if (ablation === "tau") return `τ = ${v}`;
  if (ablation === "batched0") return "Batched, no support";
  if (ablation === "layers")
    return { mean: "Mean of middle blocks", final7: "Mean of last 7", concat: "Concatenated", last: "Last block only" }[v] ?? v;
  return v;
}

function orderVariants(ablation: string, variants: string[]) {
  const order = ABLATION_ORDER[ablation];
  if (order) return [...variants].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const numeric = variants.every((v) => Number.isFinite(Number(v)));
  return [...variants].sort((a, b) => (numeric ? Number(a) - Number(b) : a.localeCompare(b)));
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

function aggregate(rows: AblationRow[], metric: AblMetric) {
  const out = new Map<string, number[]>();
  for (const r of rows) {
    const v = r[metric];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    const key = `${r.variant}|${r.dataset}|${r.k}`;
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(v);
  }
  return (variant: string, ds: string, k: number) => {
    const xs = out.get(`${variant}|${ds}|${k}`);
    return xs ? { mean: mean(xs)!, n: xs.length } : null;
  };
}

function VariantLabel({ ablation, variant }: { ablation: string; variant: string }) {
  return (
    <span className="flex flex-col">
      <span>{variantLabel(ablation, variant)}</span>
      {PAPER_SETTING[ablation] === variant && <span className="font-mono text-[0.6875rem] text-muted-foreground">paper setting</span>}
    </span>
  );
}

export function AblationsView() {
  const live = useLive(api.ablations, { labels: ABLATION_LABELS, rows: bundledAblations });
  const all = live.data.rows;
  const known = Object.keys(ABLATION_LABELS);
  const ablations = Array.from(new Set(all.map((r) => r.ablation))).sort(
    (a, b) => (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99)
  );

  const [ablation, setAblation] = useState<string>("backbone");
  const [metric, setMetric] = useState<AblMetric>("image_auroc");
  const abl = ablations.includes(ablation) ? ablation : ablations[0];
  const rows = all.filter((r) => r.ablation === abl);
  const variants = orderVariants(abl, Array.from(new Set(rows.map((r) => r.variant))));
  const shots = Array.from(new Set(rows.map((r) => r.k))).sort((a, b) => a - b);
  const datasets = DATASETS.filter((d) => rows.some((r) => r.dataset === d));
  const get = aggregate(rows, metric);

  const [detailDs, setDetailDs] = useState<Dataset>("mvtec");
  const [detailK, setDetailK] = useState<number>(shots[0] ?? 1);
  const dDs = datasets.includes(detailDs) ? detailDs : datasets[0];
  const dK = shots.includes(detailK) ? detailK : shots[0];
  const detailRows = rows.filter((r) => r.dataset === dDs && r.k === dK);
  const detail = {
    cats: Array.from(new Set(detailRows.map((r) => r.category))).sort(),
    lookup: new Map(detailRows.map((r) => [`${r.category}|${r.variant}`, r[metric]])),
  };

  const columns = datasets.flatMap((ds) => shots.map((k) => ({ ds, k })));
  const best = new Map(
    columns.map(({ ds, k }) => {
      const vals = variants.map((v) => get(v, ds, k)?.mean ?? -Infinity);
      return [`${ds}|${k}`, variants[vals.indexOf(Math.max(...vals))]];
    })
  );

  return (
    <>
      <PageHeader
        title="Ablations"
        lede={
          <p>
            How sensitive the method is to its few choices: which blocks, how much variance, which backbone, what
            resolution, and whether it works with no support at all. Each value is a mean over categories.
          </p>
        }
        aside={<SourceNote source={live.source} loading={live.loading} />}
      />

      <section className="container-site flex flex-col gap-8 pb-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Pills label="Ablation" value={abl} options={ablations} onChange={setAblation} format={(a) => ABLATION_LABELS[a] ?? a} />
          <Pills label="Metric" value={metric} options={ABL_METRICS} onChange={setMetric} format={(m) => ABL_METRIC_LABEL[m]} mono />
        </div>
        <p className="max-w-2xl text-lg text-pretty">{QUESTION[abl] ?? ABLATION_LABELS[abl]}</p>
      </section>

      <section className="container-site grid grid-cols-[minmax(0,1fr)] gap-14 pb-16 md:pb-24 lg:grid-cols-2 lg:gap-x-16">
        {shots.map((k) => (
          <Gauge
            key={`${abl}-${metric}-${k}`}
            rows={variants.map((v) => ({
              id: v,
              label: <VariantLabel ablation={abl} variant={v} />,
              values: Object.fromEntries(datasets.map((ds) => [ds, get(v, ds, k)?.mean ?? null])),
            }))}
            series={datasets.map((ds, i) => ({ key: ds, label: DATASET_LABEL[ds], shape: i === 0 ? "dot" : "square", color: i === 0 ? "var(--foreground)" : "var(--muted-foreground)" }))}
            caption={`${k === 0 ? "0-shot" : `${k}-shot`} · mean ${ABL_METRIC_LABEL[metric]}`}
          />
        ))}
      </section>

      <section className="container-site flex flex-col gap-6 pb-16 md:pb-24">
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">Aggregated table</h2>
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[40rem] border-collapse text-sm tabular-nums">
            <caption className="sr-only">
              Mean {ABL_METRIC_LABEL[metric]} per variant, dataset and shot count; the best variant per column is underlined
            </caption>
            <thead>
              <tr className="border-b border-foreground text-left font-mono text-xs text-muted-foreground">
                <th scope="col" className="py-3 pr-4 font-normal">Variant</th>
                {columns.map(({ ds, k }) => (
                  <th key={`${ds}-${k}`} scope="col" className="py-3 pr-4 text-right font-normal">
                    {ds === "mvtec" ? "MVTec" : "VisA"} · k{k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v} className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <VariantLabel ablation={abl} variant={v} />
                  </th>
                  {columns.map(({ ds, k }) => {
                    const cell = get(v, ds, k);
                    const isBest = best.get(`${ds}|${k}`) === v && variants.length > 1;
                    return (
                      <td key={`${ds}-${k}`} className="py-3 pr-4 text-right font-mono">
                        {cell ? (
                          <span className={isBest ? "underline decoration-2 underline-offset-4" : undefined} title={`${cell.n} categories`}>
                            {cell.mean.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="inverse rounded-t-[2.5rem] bg-background text-foreground">
        <div className="container-site flex flex-col gap-8 py-20 md:py-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-4xl font-medium tracking-tight md:text-5xl">Per-category detail</h2>
            <div className="flex flex-wrap gap-6">
              <Pills label="Dataset" value={dDs} options={datasets} onChange={setDetailDs} format={(d) => DATASET_LABEL[d]} />
              {shots.length > 1 && <Pills label="Shots" value={dK} options={shots} onChange={setDetailK} format={(k) => `${k}-shot`} />}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border" data-lenis-prevent>
            <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
              <caption className="sr-only">
                {ABL_METRIC_LABEL[metric]} per category for each variant, {DATASET_LABEL[dDs]} {dK}-shot
              </caption>
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-foreground text-left font-mono text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-normal">Category</th>
                  {variants.map((v) => (
                    <th key={v} scope="col" className="px-4 py-3 text-right font-normal">
                      {variantLabel(abl, v)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.cats.map((c) => (
                  <tr key={c} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">{categoryLabel(c)}</th>
                    {variants.map((v) => {
                      const val = detail.lookup.get(`${c}|${v}`);
                      return (
                        <td key={v} className="px-4 py-2.5 text-right font-mono">
                          {typeof val === "number" ? val.toFixed(1) : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
