# SubspaceAD — Full Reproduction

Training-free few-shot anomaly detection via subspace modeling.

This repository is a **from-scratch reproduction** of
**SubspaceAD** (Lendering, Akdag & Bondarev —
[arXiv:2602.23013](https://arxiv.org/abs/2602.23013)).

We ran the full public protocol on **MVTec-AD** and **VisA**
(`k ∈ {1,2,4}`, **5 seeds**), plus the paper’s main ablations
(layers, τ, backbone, resolution, batched 0-shot). Results land within
roughly **0.6–1.4 points** of the published I-AUROC means; pixel metrics
match almost exactly.

| Resource | Path |
|----------|------|
| Human-readable findings page | [`findings.html`](findings.html) (open in a browser) |
| Aggregated tables | [`results/tables.md`](results/tables.md) |
| Machine-readable summary | [`results/results.json`](results/results.json) |
| Qualitative figures | [`results/figures/`](results/figures/) |
| Interactive demo | Website in [`web/`](web/) with a FastAPI backend in [`server/`](server/) |

---

## What is SubspaceAD? (plain English)

Factories need to spot defects with almost no labeled “bad” examples.
SubspaceAD does this **without training a new network**:

1. Show it a few **normal** images (1, 2, or 4).
2. A frozen **DINOv2** model turns them into patch features.
3. **PCA** learns a “normal subspace” (keep 99% of variance).
4. A new image is scored by how much its patches **stick out** of that subspace.
5. An image score uses the worst 1% of patches (**TVaR**); a blurred upsample becomes the heatmap.

No fine-tuning. The heavy vision model stays frozen.

---

## Method (paper settings)

| Setting | Value |
|---------|-------|
| Backbone | DINOv2-G (`dinov2_vitg14`) |
| Resolution | 672×672 |
| Layers | mean of blocks 22–28 (0-indexed `[21..27]`) |
| Support augmentations | 30 random rotations (15° steps); **skipped** for `transistor` |
| PCA threshold τ | 0.99 |
| Image score | TVaR, ρ = 1% |
| Pixel map | bilinear upsample + Gaussian σ = 4 |
| Shots / seeds | k = 1, 2, 4 · seeds 0–4 |

Pipeline sketch:

```
k normal images
  → rotations (×30; skip orientation-critical classes)
  → DINOv2-G @ 672px · mean of blocks 22–28
  → PCA subspace (τ = 0.99)
  → patch residual → TVaR image score (top 1%)
  → upsample + Gaussian σ=4 → pixel heatmap
```

---

## Findings vs paper

Open [`findings.html`](findings.html) for a narrative write-up with charts.
Headline numbers below are **mean over categories** after full aggregation
(not partial).

### Image detection (I-AUROC)

| Dataset | k | Paper | Ours | Δ |
|---------|--:|------:|-----:|--:|
| MVTec | 1 | 97.1 | 96.0 ±5.4 | −1.1 |
| MVTec | 2 | 97.5 | 96.7 ±4.4 | −0.8 |
| MVTec | 4 | 98.0 | 97.4 ±3.6 | −0.6 |
| VisA | 1 | 93.2 | 91.8 ±6.2 | −1.4 |
| VisA | 2 | 93.8 | 93.2 ±4.7 | −0.6 |
| VisA | 4 | 94.7 | 94.0 ±4.9 | −0.7 |

### Localization (selected)

| Dataset | k | Metric | Paper | Ours | Δ |
|---------|--:|--------|------:|-----:|--:|
| MVTec | 1 | P-AUROC | 97.5 | 97.6 ±2.6 | +0.1 |
| MVTec | 1 | PRO | 94.5 | 94.3 ±7.6 | −0.2 |
| MVTec | 4 | P-AUROC | 97.9 | 97.9 ±1.9 | 0.0 |
| VisA | 1 | P-AUROC | 98.2 | 98.1 ±1.7 | −0.1 |
| VisA | 4 | P-AUROC | 98.4 | 98.3 ±1.5 | −0.1 |
| VisA | 4 | PRO | 96.0 | 95.8 ±1.7 | −0.2 |

**Read:** image AUROC is slightly under the paper (still close); pixel
localization essentially matches. Gaps of ~1pp are consistent with seed
sampling, library/stack differences, and running the giant model on an 8GB GPU
(with memory-safe paths for wide concat features).

Full metric table (all k × I-AUROC / I-AUPR / P-AUROC / PRO): see
[`results/tables.md`](results/tables.md).

### Easy vs hard (MVTec, 1-shot I-AUROC)

| Tier | Categories (ours) |
|------|-------------------|
| Near-perfect | bottle, carpet, leather, metal_nut, tile (≈100) |
| Strong | grid, wood, zipper, hazelnut, pill, toothbrush (≈96–99) |
| Harder | capsule 84.8 · screw 86.6 · transistor 87.5 · cable 90.7 |

### Ablation highlights (4-shot, mean I-AUROC over categories)

**Layer aggregation**

| Variant | MVTec | VisA |
|---------|------:|-----:|
| mean (paper default) | 97.6 | 93.8 |
| concat | 97.8 | 93.4 |
| final7 | 97.0 | 92.1 |
| last only | 96.1 | 89.7 |

**Backbone capacity**

| Backbone | MVTec | VisA |
|----------|------:|-----:|
| ViT-S | 97.2 | 89.3 |
| ViT-B | 97.5 | 91.8 |
| ViT-L | 97.5 | 92.9 |
| ViT-G (paper) | 97.6 | 93.8 |

Takeaways: middle-layer aggregation beats last-layer only; MVTec stays strong
even with smaller backbones, while VisA benefits more from ViT-G.

### Smoke test (early sanity check vs paper Table 5)

| Category | Metric | Ours | Paper | Δ |
|----------|--------|-----:|------:|--:|
| bottle | I-AUROC | 100.0 | 100.0 | 0.0 |
| bottle | P-AUROC | 98.8 | 98.6 | +0.2 |
| bottle | PRO | 96.8 | 96.5 | +0.3 |
| screw | I-AUROC | 89.2 | 88.4 | +0.8 |
| screw | P-AUROC | 99.0 | 99.1 | −0.1 |
| screw | PRO | 95.3 | 96.2 | −0.9 |

Single-image DINOv2-G @ 672px (fp16): ~**0.7 s** on RTX 5060 Laptop after warmup.

### Hardware notes (this reproduction)

- **GPU:** RTX 5060 Laptop 8GB (Blackwell) · PyTorch **cu128** via `uv`
- **Feature cache:** disk cache kept for mean@672@ViT-G; other ablation variants extract on the fly to save disk
- **Concat ablation:** layer-wise extract + float16 memmap + streaming PCA (wide D≈10k features OOM otherwise)
- **Backbone ablation:** absolute Giant layer indices `[21..27]` are cleared so S/B/L use relative middle/last-7 blocks

---

## Setup

Requires **Python 3.12** and a **CUDA 12.8+** PyTorch build (RTX 50-series / Blackwell).

```bash
uv sync

# Datasets (~7 GB compressed; resumable)
uv run python scripts/download_data.py --data-root data
```

If MVTec auto-download fails, place `mvtec_anomaly_detection.tar.xz` in `data/`
and re-run with `--mvtec-archive`.

---

## Reproduce the paper

```bash
# Smoke test (bottle + screw, 1-shot)
uv run python scripts/smoke_test.py

# Full benchmark (pausable / resumable) — multi-hour on RTX 5060 Laptop
uv run python scripts/run_benchmark.py --run-id main

# Control from another terminal
uv run python scripts/runctl.py status main
uv run python scripts/runctl.py pause main
uv run python scripts/runctl.py resume main

# Optional scheduled pause
uv run python scripts/run_benchmark.py --run-id main --max-hours 6
uv run python scripts/run_benchmark.py --run-id main --until 08:00
uv run python scripts/run_benchmark.py --run-id main --pause-on-battery
```

### Ablations + aggregate + figures

```bash
# Individual ablations (each has its own run-id for pause/resume)
uv run python scripts/run_ablations.py --run-id ablations-layers --ablation layers
uv run python scripts/run_ablations.py --run-id ablations-tau --ablation tau
uv run python scripts/run_ablations.py --run-id ablations-res --ablation resolution
uv run python scripts/run_ablations.py --run-id ablations-b0 --ablation batched0
uv run python scripts/run_ablations.py --run-id ablations-bb --ablation backbone

# Or chained overnight (Windows)
powershell -File scripts/run_ablations_chain.ps1
# older helper:
powershell -File scripts/overnight_chain.ps1

uv run python scripts/aggregate.py
uv run python scripts/make_figures.py
```

Soft pause waits until the **current unit** finishes. For an immediate stop,
kill the process and reset any `running` unit to `pending` (see `scripts/runctl.py`).

---

## Website and live demo

The showcase site is a Next.js app in `web/` backed by a FastAPI server in `server/`
that wraps the `subspacead` package. Run both, from the repo root:

```bash
# 1. API on :8000 (loads DINOv2 on the GPU on first fit)
uv run uvicorn server.main:app --port 8000

# 2. Website on :3000 (proxies /api/* to :8000)
cd web
npm i
npm run sync-assets   # converts results/figures into web/public/gallery
npm run dev
```

Open http://localhost:3000. Use the palette button in the header to switch
between light (Mono Inverse) and dark (Thermal Graphite).

| Route | Purpose |
|-------|---------|
| `/` | Home: specimen panel, paper-vs-ours readings, method, cases |
| `/demo` | Fit a subspace on a category, score anomalous/normal/uploaded images |
| `/method` | The five pipeline steps with this run's settings |
| `/results` | Paper vs ours gauge, Table 1, per-category scores, raw `tables.md` |
| `/ablations` | Layers / τ / backbone / resolution / batched 0-shot |
| `/gallery` | Successes and failure cases with a lightbox |
| `/lab/runs` | Pause / resume / monitor long jobs (linked from the footer) |

Results, ablations and the gallery read the live API when it is up and fall
back to the snapshot bundled in `web/src/content/` when it is not, so the site
still renders without a GPU. The home page cases come from
`uv run python scripts/export_showcase.py`, which writes `web/public/showcase/`
and `web/src/content/showcase.json`.

Demo tip: start with preset **MVTec · bottle** in **Fast** mode (ViT-B @ 448),
press **Fit subspace**, then click test thumbnails to score them without refitting.

---

## Project layout

```
subspacead/          # core library (backbone, PCA, metrics, runner, cache)
scripts/             # download, benchmark, ablations, aggregate, figures, runctl
server/              # FastAPI wrapper: fit, score, results, ablations, gallery, runs
web/                 # Next.js showcase site and live demo
configs/default.yaml # paper hyperparameters
findings.html        # standalone findings write-up
results/             # metrics JSON, tables.md, figures/
runs/                # pause/resume state per run-id
cache/               # fp16 feature cache (large; gitignored)
data/                # MVTec-AD + VisA (gitignored)
```

---

## Citation

```bibtex
@article{lendering2026subspacead,
  title={SubspaceAD: Training-Free Few-Shot Anomaly Detection via Subspace Modeling},
  author={Lendering, Camile and Akdag, Erkut and Bondarev, Egor},
  journal={arXiv preprint arXiv:2602.23013},
  year={2026}
}
```

---

## License notes

- Code in this repo: MIT (reproduction).
- DINOv2 weights: Apache 2.0 (Meta).
- MVTec-AD: CC BY-NC-SA 4.0 (**non-commercial**).
- VisA: CC BY 4.0.
