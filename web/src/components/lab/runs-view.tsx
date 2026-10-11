"use client";

import { PauseIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Choice } from "@/components/demo/controls";
import { PageHeader } from "@/components/site/page-header";
import { Pills } from "@/components/site/pills";
import { api } from "@/lib/api";
import type { RunDetail, RunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type UnitFilter = "all" | "running" | "pending" | "failed" | "done";
const POLL_MS = 5000;

function ActionButton({ onClick, disabled, children, primary }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        primary ? "border-foreground bg-foreground text-background hover:opacity-85" : "border-border hover:border-foreground"
      )}
    >
      {children}
    </button>
  );
}

function statusLabel(r: RunSummary) {
  if (r.paused && r.status === "running") return "pausing after current unit";
  if (r.paused) return "paused";
  return r.status;
}

export function RunsView() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<UnitFilter>("all");

  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let alive = true;
    api
      .runs()
      .then(({ runs }) => {
        if (!alive) return;
        setRuns(runs);
        setOffline(false);
        setSelected((s) => s || runs.find((r) => r.status === "running")?.run_id || runs.at(-1)?.run_id || "");
      })
      .catch(() => alive && setOffline(true));
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    api
      .run(selected)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setOffline(false);
      })
      .catch(() => alive && setOffline(true));
    return () => {
      alive = false;
    };
  }, [selected, tick]);

  const running = detail?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setTick((x) => x + 1), POLL_MS);
    return () => window.clearInterval(t);
  }, [running]);

  const select = (id: string) => {
    setSelected(id);
    setDetail(null);
    setMessage(null);
  };

  const act = async (fn: (id: string) => Promise<{ message: string }>) => {
    setBusy(true);
    try {
      const res = await fn(selected);
      setMessage(res.message);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const units = (detail?.units ?? []).filter((u) => filter === "all" || u.status === filter);
  const progress = detail && detail.total ? detail.done / detail.total : 0;

  return (
    <>
      <PageHeader
        title="Runs"
        lede={
          <p>
            Pause and resume long benchmark and ablation jobs. Pause is soft: it writes a sentinel and the current unit
            finishes first. Resume relaunches the right script with the same run id, so finished units are skipped.
          </p>
        }
      />
      <section className="container-site flex flex-col gap-10 pb-24 md:pb-32">
        {offline && (
          <div className="inverse flex flex-col gap-4 rounded-3xl bg-background p-6 text-foreground md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex flex-col gap-2">
              <p className="text-lg font-medium">The API is not running.</p>
              <code className="font-mono text-sm text-muted-foreground">uv run uvicorn server.main:app --port 8000</code>
            </div>
            <ActionButton onClick={refresh} primary>
              <RotateCwIcon className="size-4" aria-hidden />
              Retry
            </ActionButton>
          </div>
        )}

        {runs && runs.length === 0 && (
          <p className="text-muted-foreground">
            No runs yet. Start one with <code className="font-mono text-foreground">uv run python scripts/run_benchmark.py --run-id main</code>.
          </p>
        )}

        {runs && runs.length > 0 && (
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex w-full flex-col gap-2 md:w-80">
              <label htmlFor="run-select" className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                Run
              </label>
              <Choice
                id="run-select"
                value={selected}
                onChange={select}
                options={runs.map((r) => ({ value: r.run_id, label: `${r.run_id} · ${r.kind} · ${statusLabel(r)}` }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => act(api.pauseRun)} disabled={busy || !detail || detail.paused}>
                <PauseIcon className="size-4" aria-hidden />
                Pause
              </ActionButton>
              <ActionButton onClick={() => act(api.resumeRun)} disabled={busy || !detail || (running && !detail.paused)} primary>
                <PlayIcon className="size-4" aria-hidden />
                Resume
              </ActionButton>
              <ActionButton onClick={refresh} disabled={busy}>
                <RotateCwIcon className="size-4" aria-hidden />
                Refresh
              </ActionButton>
            </div>
          </div>
        )}

        {message && (
          <p role="status" className="rounded-2xl border border-border bg-surface px-5 py-4 font-mono text-sm">
            {message}
          </p>
        )}

        {detail && (
          <>
            <dl className="grid grid-cols-2 border-t border-border md:grid-cols-5">
              {(
                [
                  ["Status", statusLabel(detail)],
                  ["Done", `${detail.done} / ${detail.total}`],
                  ["Running", detail.running],
                  ["Pending", detail.pending],
                  ["Failed", detail.failed],
                ] as const
              ).map(([term, value]) => (
                <div key={term} className="flex flex-col gap-2 border-b border-border py-5 pr-4 md:border-r md:pl-4 md:first:pl-0 md:last:border-r-0">
                  <dt className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{term}</dt>
                  <dd className="font-mono text-2xl tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2">
              <div
                className="h-2 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-label="Units done"
                aria-valuemin={0}
                aria-valuemax={detail.total}
                aria-valuenow={detail.done}
              >
                <div className="h-full rounded-full bg-foreground transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {(progress * 100).toFixed(1)}% · {running ? `refreshing every ${POLL_MS / 1000} s` : "not running, refresh manually"}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <h2 className="text-3xl font-medium tracking-tight">Units</h2>
                <Pills label="Show" value={filter} options={["all", "running", "pending", "failed", "done"] as const} onChange={setFilter} format={(f) => f[0].toUpperCase() + f.slice(1)} />
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-2xl border border-border" data-lenis-prevent>
                <table className="w-full min-w-[40rem] border-collapse text-sm tabular-nums">
                  <caption className="sr-only">Units of run {detail.run_id}</caption>
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-foreground text-left font-mono text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-normal">Unit</th>
                      <th scope="col" className="px-4 py-3 font-normal">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-normal">Elapsed</th>
                      <th scope="col" className="px-4 py-3 font-normal">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.unit} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs">{u.unit}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex items-center gap-2", u.status === "failed" && "font-medium")}>
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                u.status === "done" && "bg-foreground",
                                u.status === "running" && "animate-pulse bg-foreground",
                                u.status === "pending" && "border border-foreground/40",
                                u.status === "failed" && "bg-primary"
                              )}
                              aria-hidden
                            />
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{u.elapsed_s ? `${u.elapsed_s.toFixed(1)} s` : "—"}</td>
                        <td className="max-w-[24rem] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground" title={u.error || undefined}>
                          {u.error || ""}
                        </td>
                      </tr>
                    ))}
                    {!units.length && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                          No units with this status.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
