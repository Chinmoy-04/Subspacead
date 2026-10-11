import type { Metadata } from "next";
import { LiveDemo } from "@/components/demo/live-demo";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Fit a SubspaceAD PCA subspace on a few normal images and score test images with heatmaps, live on your GPU.",
};

export default function DemoPage() {
  return (
    <div className="container-site flex flex-col gap-12 pt-8 pb-28 md:gap-16 md:pt-14">
      <header className="flex flex-col gap-5">
        <h1 className="text-title">Live demo</h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
          Fit a PCA subspace on a few normal images, then score any test image. Hotter colors mean a larger residual,
          which means more anomalous. Use the fast backbone to explore; switch to paper settings for ViT-G at 672 px.
        </p>
      </header>
      <LiveDemo />
    </div>
  );
}
