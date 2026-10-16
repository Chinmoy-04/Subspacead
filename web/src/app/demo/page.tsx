import type { Metadata } from "next";
import { LiveDemo } from "@/components/demo/live-demo";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Local GPU demo: fit a SubspaceAD PCA subspace on a few normal images and score test heatmaps. The hosted site shows measured results and the gallery without a backend.",
};

export default function DemoPage() {
  return (
    <div className="container-site flex flex-col gap-12 pt-8 pb-28 md:gap-16 md:pt-14">
      <header className="flex flex-col gap-5">
        <h1 className="text-title">Live demo</h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          Fit a PCA subspace on a few normal images, then score any test image. Hotter colors mean a larger residual.
          Needs the local model server on your GPU; use Fast mode to explore, Paper settings for ViT-G at 672 px.
        </p>
      </header>
      <LiveDemo />
    </div>
  );
}
