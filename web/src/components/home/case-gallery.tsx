"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ToleranceMark } from "@/components/site/tolerance";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DATASET_LABEL, categoryLabel, defectLabel, galleryItems, showcase } from "@/lib/content";
import type { ShowcaseItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER = ["mvtec-hazelnut", "visa-candle", "mvtec-screw", "mvtec-carpet", "visa-pcb1", "visa-macaroni2", "mvtec-metal_nut", "mvtec-bottle", "mvtec-transistor"];
const ITEMS = ORDER.map((id) => showcase.items.find((i) => i.id === id)).filter((i): i is ShowcaseItem => !!i);

export function CaseGallery() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [90, -90]);

  const left = ITEMS.filter((_, i) => i % 2 === 0);
  const right = ITEMS.filter((_, i) => i % 2 === 1);

  return (
    <div ref={ref}>
      <div className="flex flex-col gap-12 md:hidden">
        {ITEMS.map((item) => (
          <CaseCard key={item.id} item={item} />
        ))}
        <MoreCard />
      </div>
      <div className="hidden grid-cols-2 gap-x-10 md:grid lg:gap-x-16">
        <div className="flex flex-col gap-16">
          {left.map((item) => (
            <CaseCard key={item.id} item={item} />
          ))}
        </div>
        <motion.div className="mt-[150px] flex flex-col gap-16" style={reduced ? undefined : { y: drift }}>
          {right.map((item) => (
            <CaseCard key={item.id} item={item} />
          ))}
          <MoreCard />
        </motion.div>
      </div>
    </div>
  );
}

function MoreCard() {
  const failures = galleryItems.filter((i) => i.section === "failures").length;
  const categories = new Set(galleryItems.map((i) => `${i.dataset}/${i.category}`)).size;
  return (
    <Link
      href="/gallery"
      data-cursor="Open"
      className="group flex flex-col gap-8 rounded-2xl border border-border p-8 transition-colors duration-500 ease-[var(--ease-soft)] hover:border-foreground hover:bg-foreground hover:text-background"
    >
      <span className="flex items-start justify-between gap-6">
        <span className="text-subtitle max-w-[18ch] text-balance">Every category at paper settings, failures included</span>
        <ArrowUpRightIcon className="size-8 shrink-0 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:rotate-45" aria-hidden />
      </span>
      <dl className="grid grid-cols-3 border-t border-current/20 pt-5 font-mono tabular-nums">
        {(
          [
            ["Figures", galleryItems.length],
            ["Categories", categories],
            ["Failures", failures],
          ] as const
        ).map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground transition-colors group-hover:text-background/70">{term}</dt>
            <dd className="text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function CaseCard({ item }: { item: ShowcaseItem }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tapped, setTapped] = useState<boolean | null>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const inView = useInView(ref, { amount: 0.6 });
  const ratio = item.image_score / item.normal_score_max;
  const detected = item.outcome === "detected";

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Touch has no hover, so a case develops on its own once it is mostly on screen; a tap overrides.
  const developed = tapped ?? (coarse && inView);
  const active = developed || hover || focus;

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <figure className="flex flex-col gap-4">
      <button
        ref={ref}
        type="button"
        className="develop group relative block w-full overflow-hidden rounded-2xl bg-surface text-left"
        style={{ aspectRatio: String(Math.max(item.aspect, 0.9)) }}
        data-developed={developed}
        data-cursor={developed ? "Hide" : "Develop"}
        onPointerMove={onMove}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onPointerDown={(e) => e.pointerType !== "mouse" && setTapped(!developed)}
        onClick={(e) => e.detail === 0 && setTapped(!developed)}
        aria-pressed={developed}
        aria-label={`${categoryLabel(item.category)}, ${defectLabel(item.defect)}: show residual map`}
      >
        <img
          src={item.frames.input}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-contain transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
          draggable={false}
        />
        <img
          src={item.frames.overlay}
          alt=""
          loading="lazy"
          className="develop-layer absolute inset-0 size-full object-contain transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
          draggable={false}
        />
        <span className="absolute top-4 left-4 rounded-full bg-black/70 px-3 py-1.5 font-mono text-[0.6875rem] tracking-wide text-white uppercase">
          {DATASET_LABEL[item.dataset]}
        </span>
      </button>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="flex items-baseline gap-3">
          <span className="text-subtitle capitalize">{categoryLabel(item.category)}</span>
          <span className="text-sm text-muted-foreground">{defectLabel(item.defect)}</span>
        </span>
        <span className="sr-only">
          {detected ? "Detected" : "Missed"}: score {item.image_score.toFixed(0)} against a normal ceiling of {item.normal_score_max.toFixed(0)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-2 font-mono text-xs tabular-nums transition-colors duration-500",
            active ? (detected ? "text-foreground" : "text-primary") : "text-muted-foreground"
          )}
          aria-hidden
        >
          <ToleranceMark state={detected ? "match" : "outside"} />
          {detected ? "Detected" : "Missed"} · score{" "}
          {active ? (
            <NumberTicker value={item.image_score} startValue={item.normal_score_max} decimalPlaces={0} className="text-inherit" />
          ) : (
            item.image_score.toFixed(0)
          )}{" "}
          vs ceiling {item.normal_score_max.toFixed(0)} ({ratio.toFixed(2)}×)
        </span>
      </figcaption>
    </figure>
  );
}

export function CaseGalleryIntro() {
  return (
    <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
      <h2 className="text-title max-w-[12ch] text-balance">Cases, misses included.</h2>
      <div className="flex max-w-md flex-col gap-5">
        <p className="text-lg text-muted-foreground text-pretty">
          Hover or tap a case to develop its residual map. Each was scored with the fast settings (ViT-B/14, 448 px,
          one normal image) against a ceiling set by the highest-scoring of eight normal test images. Three come from
          the classes the benchmark finds hardest, and they miss.
        </p>
        <Link href="/gallery" className="self-start text-[0.9375rem] font-medium underline underline-offset-4 hover:text-primary">
          Benchmark gallery, paper settings
        </Link>
      </div>
    </div>
  );
}
