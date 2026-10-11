"use client";

import { useLenis } from "lenis/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { Choice } from "@/components/demo/controls";
import { PageHeader } from "@/components/site/page-header";
import { Pills } from "@/components/site/pills";
import { ToleranceMark } from "@/components/site/tolerance";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DATASET_LABEL, categoryLabel, galleryItems } from "@/lib/content";
import type { GalleryItem } from "@/lib/types";

type Section = "all" | "gallery" | "failures";
type DsFilter = "all" | "mvtec" | "visa";
const SECTION_LABEL: Record<Section, string> = { all: "All", gallery: "Successes", failures: "Failures" };
const DS_LABEL: Record<DsFilter, string> = { all: "Both", mvtec: "MVTec-AD", visa: "VisA" };

function Card({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  const failed = item.section === "failures";
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <figure className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onOpen}
        onPointerMove={onMove}
        data-cursor="Open"
        aria-label={`${categoryLabel(item.category)}, ${DATASET_LABEL[item.dataset]}, ${failed ? "failure case" : "success"} ${item.name}: open input, ground truth and prediction`}
        className="develop group relative block aspect-square w-full overflow-hidden rounded-2xl bg-surface"
      >
        <img src={item.input} alt="" loading="lazy" draggable={false} className="absolute inset-0 size-full object-contain transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" />
        <img src={item.pred} alt="" loading="lazy" draggable={false} className="develop-layer absolute inset-0 size-full object-contain transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" />
      </button>
      <figcaption className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium capitalize">{categoryLabel(item.category)}</span>
          <span className="text-sm text-muted-foreground">{DATASET_LABEL[item.dataset]}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
          <ToleranceMark state={failed ? "outside" : "match"} />
          {failed ? "Failure" : "Success"}
        </span>
      </figcaption>
    </figure>
  );
}

function Lightbox({ items, index, onIndex }: { items: GalleryItem[]; index: number | null; onIndex: (i: number | null) => void }) {
  const lenis = useLenis();
  const open = index != null && !!items[index];
  const item = open ? items[index] : null;

  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex(((index ?? 0) + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex(((index ?? 0) - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lenis?.start();
    };
  }, [open, index, items.length, onIndex, lenis]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent className="inverse max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl border-0 bg-background p-5 text-foreground ring-0 sm:max-w-5xl md:p-8" data-lenis-prevent>
        {item && (
          <>
            <div className="flex flex-col gap-1 pr-10">
              <DialogTitle className="text-2xl font-medium capitalize md:text-3xl">
                {categoryLabel(item.category)} <span className="text-muted-foreground">· {DATASET_LABEL[item.dataset]}</span>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {item.section === "failures" ? "Failure case" : "Success"} {item.name} · {(index ?? 0) + 1} of {items.length} · paper settings
              </DialogDescription>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(
                [
                  ["Input", item.input],
                  ["Ground truth", item.gt],
                  ["Prediction", item.pred],
                ] as const
              ).map(([label, src]) => (
                <figure key={label} className="flex flex-col gap-2">
                  <img src={src} alt={`${label} for ${categoryLabel(item.category)} ${item.name}`} className="aspect-square w-full rounded-xl bg-surface object-contain" />
                  <figcaption className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{label}</figcaption>
                </figure>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              <a href={item.full} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                Open the original figure
              </a>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onIndex(((index ?? 0) - 1 + items.length) % items.length)}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-border hover:border-foreground"
                  aria-label="Previous case"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onIndex(((index ?? 0) + 1) % items.length)}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-border hover:border-foreground"
                  aria-label="Next case"
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function GalleryView() {
  const [section, setSection] = useState<Section>("all");
  const [ds, setDs] = useState<DsFilter>("all");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<number | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set(galleryItems.filter((i) => (section === "all" || i.section === section) && (ds === "all" || i.dataset === ds)).map((i) => i.category))).sort(),
    [section, ds]
  );
  const cat = category === "all" || categories.includes(category) ? category : "all";
  const items = useMemo(
    () =>
      galleryItems
        .filter((i) => (section === "all" || i.section === section) && (ds === "all" || i.dataset === ds) && (cat === "all" || i.category === cat))
        .sort((a, b) => (a.section === b.section ? 0 : a.section === "failures" ? 1 : -1)),
    [section, ds, cat]
  );
  const failures = galleryItems.filter((i) => i.section === "failures").length;

  return (
    <>
      <PageHeader
        title="Gallery"
        lede={
          <p>
            Figures from the full benchmark run at paper settings: {galleryItems.length - failures} successes and{" "}
            {failures} failure cases. Hover a case to develop its prediction; open it for input, ground truth and
            prediction side by side.
          </p>
        }
      />
      <section className="container-site flex flex-col gap-10 pb-24 md:pb-32">
        <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-end">
          <Pills label="Section" value={section} options={["all", "gallery", "failures"] as const} onChange={setSection} format={(s) => SECTION_LABEL[s]} />
          <Pills label="Dataset" value={ds} options={["all", "mvtec", "visa"] as const} onChange={setDs} format={(d) => DS_LABEL[d]} />
          <div className="flex w-full flex-col gap-2 md:w-60">
            <label htmlFor="gallery-category" className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Category
            </label>
            <Choice
              id="gallery-category"
              value={cat}
              onChange={setCategory}
              options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: categoryLabel(c) }))]}
            />
          </div>
          <p className="font-mono text-xs text-muted-foreground md:ml-auto" aria-live="polite">
            {items.length} {items.length === 1 ? "case" : "cases"}
          </p>
        </div>
        {items.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item, i) => (
              <Card key={item.id} item={item} onOpen={() => setOpen(i)} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No figures match these filters.</p>
        )}
      </section>
      <Lightbox items={items} index={open} onIndex={setOpen} />
    </>
  );
}
