export type Dataset = "mvtec" | "visa";
export type MetricKey = "image_auroc" | "image_aupr" | "pixel_auroc" | "pro";

export interface Stat {
  mean: number;
  std: number;
  n: number;
}

export interface SummaryBlock {
  mean: Partial<Record<MetricKey, Stat>>;
  categories: Record<string, Partial<Record<MetricKey, Stat>>>;
}

export interface ResultsData {
  n_result_files: number;
  partial: boolean;
  paper_table1: Record<string, Record<string, Partial<Record<MetricKey, number>>>>;
  summary: Record<string, Record<string, SummaryBlock>>;
  tables_md?: string | null;
}

export interface AblationRow {
  ablation: string;
  variant: string;
  dataset: Dataset;
  category: string;
  k: number;
  image_auroc: number | null;
  pixel_auroc: number | null;
  pro: number | null;
}

export interface GalleryItem {
  id: string;
  section: "gallery" | "failures";
  dataset: Dataset;
  category: string;
  name: string;
  full: string;
  input: string;
  gt: string;
  pred: string;
  aspect: number;
}

export interface ShowcaseItem {
  id: string;
  outcome: "detected" | "missed";
  dataset: Dataset;
  category: string;
  defect: string;
  file: string;
  aspect: number;
  image_score: number;
  normal_score_max: number;
  normal_count: number;
  n_components: number;
  n_views: number;
  frames: { input: string; heatmap: string; overlay: string; mask: string };
}

export interface ShowcaseData {
  settings: { backbone: string; image_size: number; n_aug: number; k: number; seed: number };
  items: ShowcaseItem[];
}

export interface Health {
  ok: boolean;
  cuda: boolean;
  device_name: string;
  data: Record<Dataset, boolean>;
  results: boolean;
}

export interface Preset {
  id: string;
  label: string;
  dataset: Dataset;
  category: string;
  k: number;
}

export interface DatasetsInfo {
  presets: Preset[];
  modes: Record<"fast" | "paper", { label: string; backbone: string; image_size: number; n_aug: number }>;
  backbones: { id: string; label: string }[];
  datasets: Record<Dataset, string[]>;
  no_rotation_categories: string[];
  tau: number;
  rho: number;
  data_root: string;
}

export interface TestImage {
  index: number;
  name: string;
  defect: string;
  has_mask: boolean;
  url: string;
}

export interface TestImages {
  anomalous: TestImage[];
  normal: TestImage[];
}

export interface FitSettings {
  backbone: string;
  dataset: Dataset;
  category: string;
  k: number;
  seed: number;
  image_size: number;
  n_aug: number;
  rotation: boolean;
  uploaded: boolean;
}

export interface FitResult {
  session_id: string;
  settings: FitSettings;
  n_components: number;
  n_views: number;
  feature_dim: number;
  tau: number;
  rho: number;
  cumulative_variance: number[];
  support: string[];
  elapsed_s: number;
  device: string;
}

export type ScoreSource = "anomalous" | "normal" | "upload";

export interface ScoreResult {
  image_score: number;
  patch_max: number;
  patch_mean: number;
  source: ScoreSource;
  name: string;
  defect: string;
  has_mask: boolean;
  size: [number, number];
  elapsed_s: number;
  images: { input: string; mask: string; heatmap: string; overlay: string };
  histogram: { counts: number[]; edges: number[] };
}

export interface RunSummary {
  run_id: string;
  status: string;
  kind: string;
  created_at?: string;
  total: number;
  done: number;
  failed: number;
  pending: number;
  running: number;
  paused: boolean;
}

export interface RunDetail extends RunSummary {
  units: { unit: string; status: string; elapsed_s: number; error: string }[];
}
