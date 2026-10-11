import ablationsJson from "@/content/ablations.json";
import galleryJson from "@/content/gallery.json";
import resultsJson from "@/content/results.json";
import showcaseJson from "@/content/showcase.json";
import type { AblationRow, Dataset, GalleryItem, MetricKey, ResultsData, ShowcaseData } from "./types";

export const bundledResults = resultsJson as unknown as ResultsData;
export const bundledAblations = (ablationsJson as { rows: AblationRow[] }).rows;
export const galleryItems = (galleryJson as { items: GalleryItem[] }).items;
export const showcase = showcaseJson as ShowcaseData;

export const METRICS: MetricKey[] = ["image_auroc", "pixel_auroc", "pro", "image_aupr"];
export const SHOTS = [1, 2, 4] as const;

/** Sheet reference used on readings, e.g. SAD·MV·k1. */
export function sheetRef(ds: Dataset, k: number | string) {
  return `SAD·${ds === "mvtec" ? "MV" : "VA"}·k${k}`;
}

export const BACKBONE_SHORT: Record<string, string> = {
  dinov2_vits14: "ViT-S/14",
  dinov2_vitb14: "ViT-B/14",
  dinov2_vitl14: "ViT-L/14",
  dinov2_vitg14: "ViT-G/14",
};

export const METRIC_LABEL: Record<MetricKey, string> = {
  image_auroc: "I-AUROC",
  image_aupr: "I-AUPR",
  pixel_auroc: "P-AUROC",
  pro: "PRO",
};

export const DATASET_LABEL: Record<Dataset, string> = { mvtec: "MVTec-AD", visa: "VisA" };

export const ABLATION_LABELS: Record<string, string> = {
  layers: "Layer aggregation",
  tau: "PCA threshold τ",
  backbone: "Backbone capacity",
  resolution: "Input resolution",
  batched0: "Batched 0-shot",
};

export const ABLATION_ORDER: Record<string, string[]> = {
  layers: ["mean", "final7", "concat", "last"],
  backbone: ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"],
  resolution: ["448", "672"],
};

export function metricMean(data: ResultsData, ds: string, k: number | string, m: MetricKey): number | null {
  return data.summary?.[ds]?.[String(k)]?.mean?.[m]?.mean ?? null;
}

export function paperValue(data: ResultsData, ds: string, k: number | string, m: MetricKey): number | null {
  return data.paper_table1?.[ds]?.[String(k)]?.[m] ?? null;
}

export function categoryLabel(cat: string) {
  return cat.replace(/_/g, " ");
}

export function defectLabel(defect: string) {
  return defect.replace(/_/g, " ").toLowerCase();
}
