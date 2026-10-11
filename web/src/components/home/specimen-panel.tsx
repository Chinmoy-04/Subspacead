"use client";

import { PauseIcon, PlayIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BACKBONE_SHORT, DATASET_LABEL, categoryLabel, defectLabel, sheetRef, showcase } from "@/lib/content";
import { cn } from "@/lib/utils";
import { ToleranceMark } from "@/components/site/tolerance";

const PHASES = [
  { key: "input", label: "Input", note: "Test image as captured" },
  { key: "heatmap", label: "Residual", note: "Distance of each patch from the normal subspace" },
  { key: "overlay", label: "Overlay", note: "Residual upsampled, smoothed σ = 4, laid over the input" },
] as const;

const HOLD_MS = 2600;
const SNAP = [0.4, 0, 0, 1] as const;

const CASES = showcase.items.filter((i) => i.outcome === "detected");

export function SpecimenPanel() {
  const reduced = useReducedMotion();
  const [caseIdx, setCaseIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 30%"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible || reduced) return;
    const t = setTimeout(() => {
      if (phase < PHASES.length - 1) setPhase(phase + 1);
      else {
        setPhase(0);
        setCaseIdx((c) => (c + 1) % CASES.length);
      }
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, caseIdx, playing, visible, reduced]);

  const item = CASES[caseIdx];
  const s = showcase.settings;
  const go = (d: number) => {
    setCaseIdx((c) => (c + d + CASES.length) % CASES.length);
    setPhase(0);
  };

  return (
    <motion.div
      ref={ref}
      style={reduced ? undefined : { scale }}
      className="inverse relative overflow-hidden rounded-[2rem] will-change-transform"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Specimen */}
        <div className="relative aspect-square bg-surface lg:aspect-auto lg:min-h-[44rem]">
          {PHASES.map((p, i) => (
            <motion.img
              key={`${item.id}-${p.key}`}
              src={item.frames[p.key]}
              alt={i === 0 ? `${categoryLabel(item.category)} test image with a ${defectLabel(item.defect)} defect` : ""}
              aria-hidden={i !== 0}
              className="absolute inset-0 size-full object-contain"
              initial={false}
              animate={{ clipPath: i <= phase ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
              transition={{ duration: reduced ? 0 : 1.1, ease: SNAP }}
              draggable={false}
            />
          ))}
          {!reduced && (
            <motion.span
              key={`${item.id}-${phase}`}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-white/90"
              initial={{ left: "0%", opacity: phase === 0 ? 0 : 1 }}
              animate={{ left: "100%", opacity: 0 }}
              transition={{ duration: 1.1, ease: SNAP }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent p-5 text-white md:p-7">
            <ol className="flex gap-1.5" aria-label="Phase">
              {PHASES.map((p, i) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setPhase(i);
                      setPlaying(false);
                    }}
                    aria-current={i === phase ? "step" : undefined}
                    className={cn(
                      "h-9 rounded-full px-3.5 font-mono text-xs uppercase tracking-wider transition-colors duration-300",
                      i === phase ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"
                    )}
                  >
                    <span className="tabular-nums opacity-60">{i + 1}</span> {p.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Readout */}
        <div className="flex flex-col justify-between gap-10 p-6 md:p-10">
          <div className="flex items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              Sheet {sheetRef(item.dataset, s.k)} · <span className="max-sm:hidden">Case </span>
              {String(caseIdx + 1).padStart(2, "0")}/{String(CASES.length).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-1">
              <IconButton label="Previous case" onClick={() => go(-1)}>
                <ChevronLeftIcon className="size-4" />
              </IconButton>
              <IconButton label={playing ? "Pause cycle" : "Play cycle"} onClick={() => setPlaying((p) => !p)}>
                {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              </IconButton>
              <IconButton label="Next case" onClick={() => go(1)}>
                <ChevronRightIcon className="size-4" />
              </IconButton>
            </div>
          </div>

          <div aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-subtitle capitalize">{categoryLabel(item.category)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {DATASET_LABEL[item.dataset]} · {defectLabel(item.defect)} · {item.file}
                </p>
                <dl className="mt-8 divide-y divide-border border-y border-border font-mono text-[0.8125rem]">
                  <Reading term="Support" value={`${s.k} normal image × ${item.n_views} views`} />
                  <Reading term="Backbone" value={`${BACKBONE_SHORT[s.backbone]} @ ${s.image_size} px`} />
                  <Reading term="Subspace" value={`${item.n_components} components`} note="at 99% variance" />
                  <Reading term="Normal ceiling" value={item.normal_score_max.toFixed(1)} note={`max of ${item.normal_count} normals`} />
                  <Reading term="Image score" value={item.image_score.toFixed(1)} strong />
                </dl>
                <p className="mt-4 flex items-center gap-2 text-sm">
                  <ToleranceMark state="match" />
                  Detected: score is {(item.image_score / item.normal_score_max).toFixed(2)}× the normal ceiling
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{PHASES[phase].label}.</span> {PHASES[phase].note}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Reading({ term, value, note, strong }: { term: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 py-2.5 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className={cn("tabular-nums", strong && "text-xl text-foreground")}>
        {value}
        {note && <span className="ml-2 text-muted-foreground">{note}</span>}
      </dd>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors duration-300 hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
