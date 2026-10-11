export const METHOD_STEPS = [
  {
    title: "Patch features",
    body: "A frozen DINOv2 turns each image into a grid of patch features. No weights are trained.",
    readings: [
      ["Backbone", "DINOv2 ViT-G/14"],
      ["Input", "672 × 672 px → 48 × 48 patches"],
      ["Layers", "mean of blocks 22–28"],
    ],
  },
  {
    title: "Rotated views",
    body: "Each of the k normal images is rotated to widen what “normal” covers. Orientation-critical classes keep a single view.",
    readings: [
      ["Augment", "30 rotations, 15° steps"],
      ["Shots", "k = 1, 2 or 4"],
      ["Skipped for", "transistor"],
    ],
  },
  {
    title: "Normal subspace",
    body: "PCA on the pooled patch features keeps the fewest directions that explain 99% of their variance.",
    readings: [
      ["Threshold", "τ = 0.99 cumulative variance"],
      ["Fitted on", "k × 31 views × 2,304 patches"],
      ["Training", "none, one eigendecomposition"],
    ],
  },
  {
    title: "Residual",
    body: "Each test patch is projected onto the subspace. Whatever the subspace cannot reconstruct is that patch’s anomaly score.",
    readings: [
      ["Patch score", "‖(x − μ) − CCᵀ(x − μ)‖²"],
      ["C", "kept principal directions"],
      ["μ", "mean normal patch"],
    ],
  },
  {
    title: "Score and heatmap",
    body: "The image score is the mean of its worst 1% of patches. Upsampled and smoothed, the patch scores become the heatmap.",
    readings: [
      ["Image score", "TVaR, ρ = 1%"],
      ["Pixel map", "bilinear upsample + Gaussian σ = 4"],
      ["Metrics", "I-AUROC, I-AUPR, P-AUROC, PRO"],
    ],
  },
] as const;
