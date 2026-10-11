"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bars } from "@/components/site/bars";
import { PillButton } from "@/components/site/magnetic";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api } from "@/lib/api";
import { BACKBONE_SHORT, DATASET_LABEL, categoryLabel, defectLabel } from "@/lib/content";
import type { Dataset, DatasetsInfo, FitResult, Health, ScoreResult, ScoreSource, TestImage, TestImages } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Choice, FilePicker, Field, NumberField, RangeField, Segmented, categoryOptions } from "./controls";

type Mode = "fast" | "paper";
interface Settings {
  preset: string;
  mode: Mode;
  backbone: string;
  dataset: Dataset;
  category: string;
  k: 1 | 2 | 4;
  seed: number;
  image_size: 448 | 672;
  n_aug: number;
}

const CUSTOM = "custom";
const settingsKey = (s: Settings, normals: File[]) =>
  JSON.stringify([s.backbone, s.dataset, s.category, s.k, s.seed, s.image_size, s.n_aug, normals.map((f) => f.name + f.size)]);

export function LiveDemo() {
  const [health, setHealth] = useState<Health | null>(null);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [info, setInfo] = useState<DatasetsInfo | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [normals, setNormals] = useState<File[]>([]);

  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitKey, setFitKey] = useState<string | null>(null);
  const [fitting, setFitting] = useState(false);
  const [fitError, setFitError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [tests, setTests] = useState<TestImages | null>(null);
  const [tab, setTab] = useState<ScoreSource>("anomalous");
  const [selected, setSelected] = useState<{ source: ScoreSource; index: number } | null>(null);
  const [testUpload, setTestUpload] = useState<File[]>([]);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const scoreSeq = useRef(0);

  const [attempt, setAttempt] = useState(0);

  const apply = useCallback((h: Health, d: DatasetsInfo) => {
    setHealth(h);
      setInfo(d);
      setStatus("online");
      setS((prev) => {
        if (prev) return prev;
        const p = d.presets[0];
        const m = d.modes.fast;
        const dataset = (p?.dataset ?? "mvtec") as Dataset;
        return {
          preset: p?.id ?? CUSTOM,
          mode: "fast",
          backbone: m.backbone,
          dataset,
          category: p?.category ?? d.datasets[dataset][0] ?? "",
          k: (p?.k ?? 1) as 1 | 2 | 4,
          seed: 0,
          image_size: m.image_size as 448 | 672,
          n_aug: m.n_aug,
        };
      });
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.health(), api.datasets()])
      .then(([h, d]) => alive && apply(h, d))
      .catch(() => alive && setStatus("offline"));
    return () => {
      alive = false;
    };
  }, [attempt, apply]);

  const connect = () => {
    setStatus("checking");
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    if (!fitting) return;
    const t0 = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - t0) / 1000), 200);
    return () => clearInterval(id);
  }, [fitting]);

  const update = (patch: Partial<Settings>, keepPreset = false) =>
    setS((prev) => (prev ? { ...prev, ...patch, preset: keepPreset ? prev.preset : CUSTOM } : prev));

  const applyPreset = (id: string) => {
    if (!info || !s) return;
    const p = info.presets.find((x) => x.id === id);
    if (!p) return setS({ ...s, preset: CUSTOM });
    setS({ ...s, preset: id, dataset: p.dataset, category: p.category, k: p.k as 1 | 2 | 4 });
  };

  const applyMode = (mode: Mode) => {
    if (!info) return;
    const m = info.modes[mode];
    update({ mode, backbone: m.backbone, image_size: m.image_size as 448 | 672, n_aug: m.n_aug }, true);
  };

  const runScore = useCallback(
    async (session: string, source: ScoreSource, index: number, file?: File | null) => {
      const seq = ++scoreSeq.current;
      setScoring(true);
      setScoreError(null);
      setSelected({ source, index });
      try {
        const res = await api.score({ session_id: session, source, index, file });
        if (seq === scoreSeq.current) setScore(res);
      } catch (e) {
        if (seq === scoreSeq.current) setScoreError(e instanceof ApiError ? e.message : "Scoring failed.");
      } finally {
        if (seq === scoreSeq.current) setScoring(false);
      }
    },
    []
  );

  const doFit = async () => {
    if (!s) return;
    setFitting(true);
    setFitError(null);
    setElapsed(0);
    try {
      const res = await api.fit({
        backbone: s.backbone,
        dataset: s.dataset,
        category: s.category,
        k: s.k,
        seed: s.seed,
        image_size: s.image_size,
        n_aug: s.n_aug,
        normals: normals.slice(0, s.k),
      });
      setFit(res);
      setFitKey(settingsKey(s, normals));
      setScore(null);
      const t = await api.testImages(res.settings.dataset, res.settings.category);
      setTests(t);
      const first: ScoreSource = t.anomalous.length ? "anomalous" : "normal";
      setTab(first);
      if (t[first].length) runScore(res.session_id, first, 0);
    } catch (e) {
      setFitError(e instanceof ApiError ? e.message : "Fitting failed.");
      if (e instanceof ApiError && e.status === 0) setStatus("offline");
    } finally {
      setFitting(false);
    }
  };

  const stale = fit && s && fitKey !== settingsKey(s, normals);
  const noRotation = !!s && !!info && (info.no_rotation_categories.includes(s.category) || s.n_aug <= 0);

  if (status === "offline") return <Offline onRetry={connect} />;
  if (status === "checking" || !info || !s) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-muted-foreground">
        <Spinner /> Connecting to the model server…
      </div>
    );
  }

  const cats = info.datasets[s.dataset] ?? [];

  return (
    <div className="grid gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-14">
      {/* Controls */}
      <aside
        className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain"
        data-lenis-prevent
      >
        <form
          className="flex flex-col gap-6 rounded-[1.5rem] bg-surface p-6"
          onSubmit={(e) => {
            e.preventDefault();
            doFit();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Setup</h2>
            <span className="inline-flex items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              {health?.cuda ? health.device_name : "CPU"}
            </span>
          </div>

          <Field label="Preset" htmlFor="preset">
            <Choice
              id="preset"
              value={s.preset}
              onChange={applyPreset}
              options={[{ value: CUSTOM, label: "Custom" }, ...info.presets.map((p) => ({ value: p.id, label: p.label }))]}
            />
          </Field>

          <Field label="Speed" hint={info.modes[s.mode].label + ": " + `${BACKBONE_SHORT[info.modes[s.mode].backbone]} @ ${info.modes[s.mode].image_size}, ${info.modes[s.mode].n_aug} rotations`}>
            <Segmented label="Speed" value={s.mode} options={["fast", "paper"] as const} onChange={applyMode} format={(m) => (m === "fast" ? "Fast" : "Paper")} />
          </Field>

          <Field label="Backbone" htmlFor="backbone">
            <Choice id="backbone" value={s.backbone} onChange={(v) => update({ backbone: v }, true)} options={info.backbones.map((b) => ({ value: b.id, label: b.label }))} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dataset">
              <Segmented
                label="Dataset"
                value={s.dataset}
                options={["mvtec", "visa"] as const}
                onChange={(d) => update({ dataset: d, category: info.datasets[d][0] ?? "" })}
                format={(d) => (d === "mvtec" ? "MVTec" : "VisA")}
              />
            </Field>
            <Field label="Shots (k)">
              <Segmented label="Shots" value={s.k} options={[1, 2, 4] as const} onChange={(k) => update({ k })} />
            </Field>
          </div>

          <Field label="Category" htmlFor="category">
            {cats.length ? (
              <Choice id="category" value={s.category} onChange={(c) => update({ category: c })} options={categoryOptions(cats)} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No {DATASET_LABEL[s.dataset]} data under <code className="font-mono">{info.data_root}</code>. Run{" "}
                <code className="font-mono">scripts/download_data.py</code> first.
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Seed" htmlFor="seed">
              <NumberField id="seed" value={s.seed} min={0} max={100} onChange={(seed) => update({ seed }, true)} />
            </Field>
            <Field label="Resolution">
              <Segmented label="Resolution" value={s.image_size} options={[448, 672] as const} onChange={(image_size) => update({ image_size }, true)} />
            </Field>
          </div>

          <Field
            label="Rotation augmentations"
            hint={
              info.no_rotation_categories.includes(s.category)
                ? `Skipped for ${categoryLabel(s.category)}: orientation matters for this class.`
                : "The paper uses 30."
            }
          >
            <RangeField label="Rotation augmentations" value={s.n_aug} min={0} max={30} onChange={(n_aug) => update({ n_aug }, true)} />
          </Field>

          <Field label="Normal references (optional)" hint={`Uses the first ${s.k} instead of sampled train images.`}>
            <FilePicker files={normals} onChange={setNormals} multiple label="Upload normal images" />
          </Field>

          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <PillButton type="submit" disabled={fitting || !cats.length} className="w-full">
              {fitting ? (
                <>
                  <Spinner /> Fitting… {elapsed.toFixed(0)} s
                </>
              ) : fit ? (
                "Refit subspace"
              ) : (
                "Fit subspace"
              )}
            </PillButton>
            <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
              {BACKBONE_SHORT[s.backbone]} · {s.dataset}/{s.category} · k={s.k} · {s.image_size}px · aug=
              {noRotation ? 0 : s.n_aug}
            </p>
            {fitError && <ErrorNote message={fitError} />}
          </div>
        </form>
        <p className="mt-4 px-2 text-xs leading-relaxed text-muted-foreground">
          MVTec AD images are CC BY-NC-SA 4.0, for non-commercial research only.
        </p>
      </aside>

      {/* Results */}
      <div className="flex min-w-0 flex-col gap-14">
        {!fit ? (
          <EmptySheet fitting={fitting} />
        ) : (
          <>
            {stale && (
              <div role="status" className="flex items-start gap-3 rounded-2xl border border-border px-5 py-4 text-sm">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Controls changed since the last fit. Results below still use the fitted subspace; fit again to apply the
                new settings.
              </div>
            )}
            <SubspaceSheet fit={fit} />
            <section className="flex flex-col gap-6" aria-labelledby="test-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h2 id="test-heading" className="text-subtitle">
                  Score a test image
                </h2>
                <span className="text-sm text-muted-foreground">Click any thumbnail to rescore.</span>
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as ScoreSource)}>
                <TabsList className="h-11 rounded-full p-1">
                  <TabsTrigger value="anomalous" className="rounded-full px-4">
                    Anomalous ({tests?.anomalous.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="normal" className="rounded-full px-4">
                    Normal ({tests?.normal.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="rounded-full px-4">
                    Upload
                  </TabsTrigger>
                </TabsList>
                {(["anomalous", "normal"] as const).map((kind) => (
                  <TabsContent key={kind} value={kind} className="mt-5">
                    <Thumbs
                      items={tests?.[kind] ?? []}
                      selected={selected?.source === kind ? selected.index : null}
                      onPick={(i) => runScore(fit.session_id, kind, i)}
                    />
                  </TabsContent>
                ))}
                <TabsContent value="upload" className="mt-5 max-w-md">
                  <FilePicker
                    files={testUpload}
                    onChange={(f) => {
                      setTestUpload(f.slice(0, 1));
                      if (f[0]) runScore(fit.session_id, "upload", 0, f[0]);
                    }}
                    label="Upload a test image"
                  />
                </TabsContent>
              </Tabs>
            </section>
            <ScoreSheet score={score} scoring={scoring} error={scoreError} />
          </>
        )}
      </div>
    </div>
  );
}

function SubspaceSheet({ fit }: { fit: FitResult }) {
  const variance = useMemo(() => {
    const cum = fit.cumulative_variance;
    if (!cum.length) return [];
    const step = Math.max(1, Math.ceil(cum.length / 48));
    const out: { r: string; v: number }[] = [];
    for (let i = step - 1; i < cum.length; i += step) out.push({ r: String(i + 1), v: cum[i] * 100 });
    return out;
  }, [fit.cumulative_variance]);
  const st = fit.settings;

  return (
    <section className="flex flex-col gap-8" aria-labelledby="subspace-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="subspace-heading" className="text-subtitle">
          Subspace ready
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {DATASET_LABEL[st.dataset]} / {categoryLabel(st.category)} · fitted in {fit.elapsed_s.toFixed(1)} s on {fit.device}
        </span>
      </div>
      <div>
        <p className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Normal support{st.uploaded ? " (uploaded)" : ""}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fit.support.slice(0, 4).map((src, i) => (
            <figure key={i} className="flex flex-col gap-1.5">
              <img src={src} alt={`Normal reference ${i + 1}`} className="aspect-square w-full rounded-xl bg-surface object-cover" />
              <figcaption className="font-mono text-[0.6875rem] text-muted-foreground">ref {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 border-y border-border md:grid-cols-4">
        <Stat term="Components r" value={String(fit.n_components)} />
        <Stat term="Support views" value={String(fit.n_views)} />
        <Stat term="Feature dim" value={String(fit.feature_dim || "—")} />
        <Stat term="τ / ρ" value={`${fit.tau} / ${fit.rho}`} />
      </dl>
      {variance.length > 0 && (
        <Bars
          title={`Cumulative explained variance (%) by number of components; τ = ${fit.tau} is reached at r = ${fit.n_components}`}
          data={variance}
          xKey="r"
          series={[{ key: "v", label: "Cumulative variance" }]}
          aspectRatio="2.6 / 1"
          maxLabels={8}
          format={(v) => `${v.toFixed(2)}%`}
        />
      )}
    </section>
  );
}

function ScoreSheet({ score, scoring, error }: { score: ScoreResult | null; scoring: boolean; error: string | null }) {
  const hist = useMemo(
    () =>
      score
        ? score.histogram.counts.map((c, i) => ({
            bin: score.histogram.edges[i].toFixed(score.histogram.edges[i] > 100 ? 0 : 1),
            count: c,
          }))
        : [],
    [score]
  );
  if (error) return <ErrorNote message={error} />;
  if (!score) {
    return scoring ? (
      <div className="flex items-center gap-3 text-muted-foreground">
        <Spinner /> Scoring…
      </div>
    ) : null;
  }
  const source = score.source === "upload" ? "upload" : `${score.name}${score.defect && score.source === "anomalous" ? ` · ${defectLabel(score.defect)}` : ""}`;
  return (
    <section className={cn("flex flex-col gap-8 transition-opacity duration-300", scoring && "opacity-50")} aria-labelledby="score-heading" aria-busy={scoring}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="score-heading" className="text-subtitle">
          Result
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {score.source} · {score.size[0]}×{score.size[1]} · scored in {(score.elapsed_s * 1000).toFixed(0)} ms
        </span>
      </div>
      <dl className="grid grid-cols-2 border-y border-border md:grid-cols-4">
        <Stat term="Image score (TVaR)" value={score.image_score.toFixed(4)} strong />
        <Stat term="Patch max" value={score.patch_max.toFixed(4)} />
        <Stat term="Patch mean" value={score.patch_mean.toFixed(4)} />
        <Stat term="Source" value={source} small />
      </dl>
      <p className="-mt-4 text-sm text-muted-foreground">Higher image score means more anomalous: the mean of the top 1% patch residuals.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Panel label="Input" src={score.images.input} />
        <Panel label="Ground truth" src={score.has_mask ? score.images.mask : null} empty={score.source === "upload" ? "No mask for uploads" : "Normal: no defect"} />
        <Panel label="Residual heatmap" src={score.images.heatmap} />
        <Panel label="Overlay" src={score.images.overlay} />
      </div>
      <Bars
        title="Patch score distribution (40 bins)"
        data={hist}
        xKey="bin"
        series={[{ key: "count", label: "Patches" }]}
        aspectRatio="2.6 / 1"
        maxLabels={8}
        format={(v) => v.toFixed(0)}
      />
    </section>
  );
}

function Panel({ label, src, empty }: { label: string; src: string | null; empty?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{label}</figcaption>
      {src ? (
        <img src={src} alt={label} className="aspect-square w-full rounded-xl bg-surface object-contain" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-black p-4 text-center text-xs text-white/60">
          {empty}
        </div>
      )}
    </figure>
  );
}

function Thumbs({ items, selected, onPick }: { items: TestImage[]; selected: number | null; onPick: (i: number) => void }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No test images of this kind in the split.</p>;
  return (
    <div className="max-h-[26rem] overflow-y-auto pr-1" data-lenis-prevent>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-7">
        {items.map((t) => (
          <li key={t.index}>
            <button
              type="button"
              onClick={() => onPick(t.index)}
              data-cursor="Score"
              aria-pressed={selected === t.index}
              aria-label={`Score ${t.name}${t.defect ? `, ${defectLabel(t.defect)}` : ""}`}
              className={cn(
                "group relative block w-full overflow-hidden rounded-lg ring-offset-2 ring-offset-background transition-shadow",
                selected === t.index ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/40"
              )}
            >
              <img src={api.imageUrl(t.url, 192)} alt="" loading="lazy" className="aspect-square w-full bg-surface object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left font-mono text-[0.625rem] text-white">
                {t.index} · {defectLabel(t.defect)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ term, value, strong, small }: { term: string; value: string; strong?: boolean; small?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 border-border py-4 pr-4 not-first:md:border-l not-first:md:pl-5 max-md:even:border-l max-md:even:pl-5">
      <dt className={cn("text-[0.6875rem] tracking-wide text-muted-foreground", /[τρσμ]/.test(term) ? "font-sans text-xs" : "font-mono uppercase")}>
        {term}
      </dt>
      <dd className={cn("font-mono tabular-nums", strong ? "text-2xl" : small ? "truncate text-sm" : "text-xl")} title={small ? value : undefined}>
        {value}
      </dd>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-sm">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      {message}
    </p>
  );
}

function EmptySheet({ fitting }: { fitting: boolean }) {
  return (
    <div className="flex min-h-[28rem] flex-col justify-between gap-10 rounded-[1.5rem] border border-dashed border-border p-8 md:p-12">
      <p className="font-mono text-xs text-muted-foreground">No subspace fitted</p>
      <div className="flex max-w-lg flex-col gap-4">
        <h2 className="text-subtitle text-balance">
          {fitting ? "Extracting features and fitting the PCA…" : "Choose a preset or custom settings, then fit the subspace."}
        </h2>
        <p className="text-muted-foreground text-pretty">
          The first fit with a new backbone also downloads and loads DINOv2, which takes longer. After that, every test
          image you click is scored in well under a second.
        </p>
      </div>
      <ol className="grid gap-4 font-mono text-xs text-muted-foreground sm:grid-cols-3">
        <li>1 · Fit on k normal images</li>
        <li>2 · Pick a test image</li>
        <li>3 · Read the score and heatmap</li>
      </ol>
    </div>
  );
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="inverse flex flex-col gap-8 rounded-[2rem] p-8 md:p-14">
      <p className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-destructive" aria-hidden /> Model server offline
      </p>
      <h2 className="text-title max-w-[16ch] text-balance">The demo needs the local model server.</h2>
      <p className="max-w-xl text-lg text-muted-foreground text-pretty">
        Inference runs on your GPU through the FastAPI backend. Start it from the repository root, then retry. Results,
        ablations and the gallery work without it.
      </p>
      <code className="block max-w-xl rounded-xl border border-border bg-surface px-4 py-3 font-mono text-sm">
        uv run uvicorn server.main:app --port 8000
      </code>
      <div>
        <PillButton onClick={onRetry} variant="outline">
          <RefreshCwIcon className="size-4" aria-hidden /> Retry connection
        </PillButton>
      </div>
    </div>
  );
}
