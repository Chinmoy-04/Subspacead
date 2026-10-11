import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { METHOD_STEPS } from "@/components/home/method-steps";
import { PAPER_URL } from "@/components/site/nav-links";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { categoryLabel, defectLabel, showcase } from "@/lib/content";

export const metadata: Metadata = {
  title: "Method",
  description: "How SubspaceAD scores anomalies: frozen DINOv2 patch features, rotated views, a PCA subspace and the residual.",
};

const DETAIL = [
  "Each block of the vision transformer gives a 48 × 48 grid of patch tokens at 672 px. The middle-to-late blocks carry the most transferable texture and part information, so their outputs are averaged into one feature per patch. The ablations page compares this against concatenation, the last seven blocks and the final block alone.",
  "With one image, the subspace only knows one pose. Rotating the support images makes the model indifferent to orientation for classes where orientation does not matter. For transistor, a rotated part is itself a defect, so rotation is switched off there.",
  "All patch features from all views are pooled and centred. The eigenvectors of their covariance are kept in order until they explain τ of the total variance. That handful of directions is the whole model: no classifier, no memory bank, no threshold learned from defects.",
  "Normal patches sit close to the subspace and reconstruct almost perfectly. A scratch, crack or missing part points in directions the normal images never used, so its residual is large. The score is a squared distance, not a probability.",
  "A defect may cover a few dozen patches out of two thousand, so a plain mean would dilute it and a plain max would be noisy. The tail mean of the top 1% balances the two. Pixel maps are upsampled to the input size and smoothed before the localisation metrics are computed.",
];

const CASE = showcase.items.find((i) => i.id === "mvtec-hazelnut") ?? showcase.items[0];

function Visual({ step }: { step: number }): ReactNode {
  if (!CASE) return null;
  const img = "aspect-square w-full rounded-2xl bg-surface object-contain";
  if (step === 0) return <img src={CASE.frames.input} alt={`${categoryLabel(CASE.category)} test image`} className={img} loading="lazy" />;
  if (step === 1)
    return (
      <div className="grid grid-cols-3 gap-5 p-2" aria-label="The same image at 0, 15 and 30 degrees" role="img">
        {[0, 15, 30].map((deg) => (
          <figure key={deg} className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-xl bg-surface" style={{ rotate: `${deg}deg` }}>
              <img src={CASE.frames.input} alt="" className="aspect-square w-full object-contain" loading="lazy" />
            </div>
            <figcaption className="font-mono text-xs text-muted-foreground">{deg}°</figcaption>
          </figure>
        ))}
      </div>
    );
  if (step === 3) return <img src={CASE.frames.heatmap} alt={`Residual heatmap for the ${defectLabel(CASE.defect)} ${categoryLabel(CASE.category)}`} className={img} loading="lazy" />;
  if (step === 4) return <img src={CASE.frames.overlay} alt={`Heatmap overlaid on the ${categoryLabel(CASE.category)}`} className={img} loading="lazy" />;
  return (
    <div className="flex aspect-square w-full flex-col justify-end gap-3 rounded-2xl border border-border p-6">
      <p className="font-mono text-5xl tabular-nums md:text-6xl">{CASE.n_components}</p>
      <p className="text-sm text-muted-foreground text-pretty">
        components kept for this {categoryLabel(CASE.category)} at τ = 0.99, from {CASE.n_views} views of one normal image (fast
        settings). Fit your own in the{" "}
        <Link href="/demo" className="underline underline-offset-4">
          live demo
        </Link>
        .
      </p>
    </div>
  );
}

export default function MethodPage() {
  return (
    <>
      <PageHeader
        title="Method"
        lede={
          <p>
            SubspaceAD learns nothing by gradient. It describes what normal looks like with a PCA subspace of frozen
            DINOv2 features, then scores whatever falls outside it. Five steps, each with the setting this reproduction
            used. The method is from{" "}
            <a href={PAPER_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
              Lendering, Akdag and Bondarev
            </a>
            .
          </p>
        }
      />
      <ol className="container-site flex flex-col pb-24 md:pb-32">
        {METHOD_STEPS.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[minmax(0,1fr)] gap-8 border-t border-border py-14 md:py-20 lg:grid-cols-[6rem_minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
            <span className="font-mono text-sm text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex flex-col gap-6">
              <h2 className="text-4xl font-medium tracking-tight md:text-5xl">{step.title}</h2>
              <p className="max-w-[60ch] text-xl text-pretty">{step.body}</p>
              <p className="max-w-[65ch] leading-relaxed text-muted-foreground text-pretty">{DETAIL[i]}</p>
              <dl className="mt-2 grid grid-cols-1 border-t border-border sm:grid-cols-3">
                {step.readings.map(([term, value]) => (
                  <div key={term} className="flex flex-col gap-1 border-b border-border py-4 sm:border-b-0 sm:pr-4">
                    <dt className={/[τρσμ]/.test(term) ? "text-xs text-muted-foreground" : "font-mono text-xs tracking-wide text-muted-foreground uppercase"}>
                      {term}
                    </dt>
                    <dd className="text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Reveal className="lg:pt-2">
              <Visual step={i} />
            </Reveal>
          </li>
        ))}
      </ol>
      <section className="inverse rounded-t-[2.5rem] bg-background text-foreground">
        <div className="container-site grid grid-cols-[minmax(0,1fr)] gap-10 py-20 md:py-28 lg:grid-cols-2 lg:gap-20">
          <h2 className="text-4xl font-medium tracking-tight text-balance md:text-5xl">What this reproduction does differently.</h2>
          <ul className="flex flex-col gap-6 text-lg text-muted-foreground">
            <li className="border-t border-border pt-6">
              <span className="text-foreground">Hardware.</span> ViT-G/14 at 672 px runs in fp16 on a laptop RTX 5060 with
              8 GB, about 0.7 s per image after warm-up.
            </li>
            <li className="border-t border-border pt-6">
              <span className="text-foreground">Memory-safe paths.</span> Concatenated features are around 10k dimensions
              wide, so they are extracted one image at a time and the covariance is accumulated on the CPU.
            </li>
            <li className="border-t border-border pt-6">
              <span className="text-foreground">Fast demo mode.</span> The live demo defaults to ViT-B/14 at 448 px with 8
              rotations so a fit takes seconds. Paper settings are one toggle away.
            </li>
            <li className="border-t border-border pt-6">
              <span className="text-foreground">Seeds.</span> Every benchmark setting is run with five support samples.{" "}
              <Link href="/results" className="text-foreground underline underline-offset-4">
                Results
              </Link>{" "}
              reports the mean and the spread.
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
