"use client";

import { Accordion as A } from "radix-ui";
import { PlusIcon } from "lucide-react";

const FAQ = [
  {
    q: "Is it really training-free?",
    a: "Yes. No gradient step is taken anywhere. The backbone is the public DINOv2 checkpoint, frozen. “Fitting” is a single PCA over the patch features of the k normal images and their rotations, which takes seconds on a GPU.",
  },
  {
    q: "What does it need to see?",
    a: "Between one and four defect-free images of the same object class. No defective examples and no masks. Ground-truth masks only enter the evaluation metrics.",
  },
  {
    q: "How close is this to the paper, and why the gap?",
    a: "Image AUROC lands 0.6 to 1.4 points under the published means; pixel AUROC and PRO are within 0.2. The likely causes are support sampling across seeds, library and stack differences, and the memory-safe code paths needed to run ViT-G on an 8 GB GPU.",
  },
  {
    q: "What hardware did this run on?",
    a: "A laptop RTX 5060 with 8 GB. The benchmark uses the paper settings, ViT-G/14 at 672 px with 30 rotations. The live demo's fast mode uses ViT-B/14 at 448 px so a fit finishes in seconds.",
  },
  {
    q: "Is this the authors' project?",
    a: "No. It is an independent, from-scratch reproduction of SubspaceAD by Lendering, Akdag and Bondarev (arXiv:2602.23013). The method is theirs; the code, runs and numbers here are not.",
  },
  {
    q: "Can I reuse the images?",
    a: "The photographs come from MVTec AD (CC BY-NC-SA 4.0, non-commercial research only) and VisA (CC BY 4.0). The heatmaps and overlays are produced by this reproduction.",
  },
];

export function Faq() {
  return (
    <A.Root type="single" collapsible className="border-t border-border">
      {FAQ.map((item, i) => (
        <A.Item key={item.q} value={`q${i}`} className="border-b border-border">
          <A.Header>
            <A.Trigger className="group flex w-full items-center justify-between gap-6 py-7 text-left">
              <span className="text-subtitle text-balance">{item.q}</span>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border transition-[background-color,color,border-color,rotate] duration-500 ease-[var(--ease-out-expo)] group-hover:border-foreground group-data-[state=open]:rotate-45 group-data-[state=open]:border-foreground group-data-[state=open]:bg-foreground group-data-[state=open]:text-background">
                <PlusIcon className="size-5" aria-hidden />
              </span>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <p className="max-w-[65ch] pb-8 text-lg leading-relaxed text-muted-foreground">{item.a}</p>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}
