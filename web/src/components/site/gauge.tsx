import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GaugeSeries {
  key: string;
  label: string;
  /** dot = measured, ring = nominal/reference, square = alternate series */
  shape: "dot" | "ring" | "square";
  color?: string;
}

export interface GaugeRow {
  id: string;
  label: ReactNode;
  values: Record<string, number | null | undefined>;
  note?: ReactNode;
}

function niceDomain(values: number[], pad = 0.6): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = Math.floor(lo - pad);
  const max = Math.min(100, Math.ceil(hi + pad));
  return [min, max === min ? min + 1 : max];
}

function ticks([min, max]: [number, number]) {
  const span = max - min;
  const step = [0.5, 1, 2, 5, 10, 20].find((s) => span / s <= 5) ?? 25;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(2)));
  return out;
}

function Marker({ shape, color }: { shape: GaugeSeries["shape"]; color: string }) {
  return (
    <span
      className={cn(
        "block size-3",
        shape === "square" ? "rounded-[2px]" : "rounded-full",
        shape === "ring" ? "border-2 bg-background" : ""
      )}
      style={shape === "ring" ? { borderColor: color } : { background: color }}
      aria-hidden
    />
  );
}

/**
 * Measured-vs-nominal dot plot on a shared, non-zero scale. Bars would hide
 * one-point differences in the 90–100 band; markers on a scale do not.
 */
export function Gauge({
  rows,
  series,
  format = (v) => v.toFixed(1),
  domain,
  caption,
  labelWidth = "min(11rem, 34%)",
}: {
  rows: GaugeRow[];
  series: GaugeSeries[];
  format?: (v: number) => string;
  domain?: [number, number];
  caption?: string;
  labelWidth?: string;
}) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? (i === 0 ? "var(--foreground)" : i === 1 ? "var(--muted-foreground)" : "var(--chart-2)") }));
  const all = rows.flatMap((r) => colored.map((s) => r.values[s.key]).filter((v): v is number => typeof v === "number"));
  if (!all.length) return <p className="text-sm text-muted-foreground">No data for this selection.</p>;
  const d = domain ?? niceDomain(all);
  const pos = (v: number) => `${((Math.max(d[0], Math.min(d[1], v)) - d[0]) / (d[1] - d[0])) * 100}%`;
  const t = ticks(d);

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
        {caption && <span className="text-muted-foreground">{caption}</span>}
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          {colored.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-2">
              <Marker shape={s.shape} color={s.color} />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="grid gap-y-0" style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr) auto` }}>
        <div />
        <div className="relative mb-2 h-5 font-mono text-[0.6875rem] text-muted-foreground tabular-nums" aria-hidden>
          {t.map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: pos(v) }}>
              {v}
            </span>
          ))}
        </div>
        <div />
        {rows.map((r) => (
          <div key={r.id} className="contents">
            <div className="flex items-center border-t border-border py-3 pr-4 text-sm">{r.label}</div>
            <div className="relative border-t border-border" role="img" aria-label={colored.map((s) => `${s.label} ${typeof r.values[s.key] === "number" ? format(r.values[s.key] as number) : "n/a"}`).join(", ")}>
              {t.map((v) => (
                <span key={v} className="absolute inset-y-0 w-px bg-border" style={{ left: pos(v) }} aria-hidden />
              ))}
              {colored.map((s) => {
                const v = r.values[s.key];
                if (typeof v !== "number") return null;
                return (
                  <span key={s.key} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(v) }} title={`${s.label}: ${format(v)}`}>
                    <Marker shape={s.shape} color={s.color} />
                  </span>
                );
              })}
            </div>
            <div className="flex items-center justify-end border-t border-border py-3 pl-4 font-mono text-xs whitespace-nowrap tabular-nums">{r.note}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}
