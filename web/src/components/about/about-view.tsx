"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { ChapterSection, formatChapter } from "@/components/site/chapter";
import { Magnetic, PillButton } from "@/components/site/magnetic";
import { PAPER_PDF_URL, PAPER_REPO_URL, PAPER_URL, REPO_URL } from "@/components/site/nav-links";
import { Reveal, RevealWords } from "@/components/site/reveal";

const CHAPTERS = [
  {
    eyebrow: "Why this exists",
    title: "I wanted to see if the paper still works when you build it yourself.",
    body: [
      "On paper, SubspaceAD is almost stubbornly simple. Freeze DINOv2, fit PCA on a few normal images, score whatever does not fit. No training, no memory bank, no prompt tuning.",
      "That is either a real result or a lucky write-up. I reimplemented it from scratch, ran the full MVTec and VisA setup the authors describe (same shot counts, five seeds), and put my numbers next to theirs.",
    ],
  },
  {
    eyebrow: "The paper",
    title: "Describe “normal” with a small subspace, then look for leftovers.",
    body: [
      "Lendering, Akdag and Bondarev basically ask: if foundation-model features are already good, do you still need a complicated few-shot stack?",
      "SubspaceAD is their answer. Pull patch features from a few good images (often rotated, unless orientation is part of the defect). Fit a PCA subspace on those features. At test time, anything that reconstructs poorly (a scratch, a missing part, weird texture) shows up as residual. The image score uses the worst 1% of patches. The heatmap is just that residual, upsampled.",
      "Read it on arXiv. I only link out. There is no paper PDF on this site.",
    ],
  },
  {
    eyebrow: "The runs",
    title: "Paper settings, on a laptop GPU with 8 GB.",
    body: [
      "Main tables use DINOv2-G at 672px, mean of blocks 22-28, 30 rotations when that makes sense, PCA τ = 0.99, TVaR on the top 1% of patches. MVTec and VisA, k = 1 / 2 / 4, seeds 0 through 4.",
      "I ran that on an RTX 5060 laptop. Wide concat features do not fit comfortably in 8 GB, so some of the code is just careful memory handling. The live demo defaults to a smaller “fast” mode so a fit does not take forever.",
    ],
  },
  {
    eyebrow: "The numbers",
    title: "Same story as the paper, a little lower on image AUROC.",
    body: [
      "Image AUROC is about 0.6 to 1.4 points under the published means. Pixel AUROC and PRO are basically a match. Categories that are hard in the paper (capsule, screw, transistor, cable) are hard here too.",
      "I am not trying to beat the authors. The useful takeaway is that a careful rebuild gets you the same shape of result. The leftover gap is mostly seeds, stack differences, and the 8 GB path.",
    ],
  },
] as const;

const LINKS = [
  { href: PAPER_URL, label: "Paper abstract", note: "arXiv:2602.23013", external: true },
  { href: PAPER_PDF_URL, label: "Paper PDF", note: "On arXiv", external: true },
  { href: PAPER_REPO_URL, label: "Official code", note: "CLendering/SubspaceAD", external: true },
  { href: REPO_URL, label: "This reproduction", note: "Chinmoy-04/Subspacead", external: true },
  { href: "/method", label: "Method", note: "Step by step", external: false },
  { href: "/results", label: "Results", note: "Tables and deltas", external: false },
] as const;

export function AboutView() {
  return (
    <>
      <section className="container-site grid gap-12 pt-10 pb-20 md:pt-16 md:pb-28 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-end lg:gap-16">
        <div className="flex flex-col gap-8">
          <p className="text-eyebrow text-muted-foreground">About</p>
          <h1 className="text-display max-w-[11ch] text-balance">
            <RevealWords text="A solo paper reproduction." />
          </h1>
          <Reveal delay={0.15}>
            <p className="max-w-[32ch] text-subtitle text-muted-foreground text-pretty">
              Their method. My code. My benchmark runs.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <p className="max-w-[36ch] text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty lg:justify-self-end">
            I rebuilt SubspaceAD from{" "}
            <a href={PAPER_URL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
              Lendering, Akdag &amp; Bondarev
            </a>{" "}
            and ran the public few-shot protocol on MVTec-AD and VisA. This page is the context. The tables and demos
            are elsewhere on the site.
          </p>
        </Reveal>
      </section>

      <div className="border-t border-border">
        {CHAPTERS.map((ch, i) => (
          <ChapterSection key={ch.eyebrow} index={i} eyebrow={ch.eyebrow} title={ch.title}>
            {ch.body.map((p) => (
              <p key={p.slice(0, 32)} className="max-w-[52ch] text-[1.0625rem] leading-[1.65] text-muted-foreground text-pretty">
                {p}
              </p>
            ))}
            {i === 1 && (
              <div className="mt-2 flex flex-wrap gap-3">
                <PillButton href={PAPER_URL} external variant="outline">
                  Abstract <ArrowUpRightIcon className="size-4" aria-hidden />
                </PillButton>
                <PillButton href={PAPER_PDF_URL} external variant="outline">
                  PDF on arXiv <ArrowUpRightIcon className="size-4" aria-hidden />
                </PillButton>
              </div>
            )}
            {i === 3 && (
              <div className="mt-2 flex flex-wrap gap-3">
                <PillButton href="/results" variant="outline">
                  Results
                </PillButton>
                <PillButton href="/ablations" variant="outline">
                  Ablations
                </PillButton>
              </div>
            )}
          </ChapterSection>
        ))}
      </div>

      <section className="inverse">
        <div className="container-site flex flex-col gap-10 py-24 md:py-36">
          <Reveal>
            <p className="text-eyebrow text-muted-foreground">Bottom line</p>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="max-w-[16ch] text-display text-balance">
              <RevealWords text="It reproduces. The gaps are small." />
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="max-w-[42ch] text-lg text-muted-foreground text-pretty">
              I did not write the paper. The authors have their own repo if you want the official code. This site is
              my reproduction: how I ran it, how close it got, and links to the rest.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-site py-24 md:py-32">
        <Reveal>
          <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="text-title max-w-[12ch] text-balance">Links</h2>
            <p className="max-w-[30ch] text-sm text-muted-foreground text-pretty">
              Paper and official code first, then pages on this site.
            </p>
          </div>
        </Reveal>
        <ul className="border-t border-border">
          {LINKS.map((item, i) => (
            <li key={item.href} className="border-b border-border">
              <Reveal delay={i * 0.04}>
                <Magnetic strength={0.18} className="flex w-full">
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex w-full items-baseline justify-between gap-6 py-7 md:py-8"
                    >
                      <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                        <span className="font-mono text-sm text-muted-foreground tabular-nums">
                          {formatChapter(i)}
                        </span>
                        <span className="text-subtitle transition-colors duration-300 group-hover:text-primary">
                          {item.label}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                        <span className="hidden sm:inline">{item.note}</span>
                        <ArrowUpRightIcon className="size-4 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </a>
                  ) : (
                    <Link href={item.href} className="group flex w-full items-baseline justify-between gap-6 py-7 md:py-8">
                      <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
                        <span className="font-mono text-sm text-muted-foreground tabular-nums">
                          {formatChapter(i)}
                        </span>
                        <span className="text-subtitle transition-colors duration-300 group-hover:text-primary">
                          {item.label}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                        <span className="hidden sm:inline">{item.note}</span>
                        <ArrowUpRightIcon className="size-4 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </Link>
                  )}
                </Magnetic>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
