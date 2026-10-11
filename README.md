# SubspaceAD Reproduction

Training-free few-shot anomaly detection via subspace modeling.

Reproduction of **SubspaceAD** (Lendering, Akdag, Bondarev — [arXiv:2602.23013](https://arxiv.org/abs/2602.23013)).

## Method (short)

1. Extract multi-layer DINOv2 patch features from *k* normal images (+ 30 rotations; skipped for `transistor`).
2. Fit PCA with explained-variance threshold τ = 0.99.
3. Score test patches by squared reconstruction residual; image score = mean of top 1% (TVaR).
4. Upsample + Gaussian σ=4 for pixel maps.

## Setup

Requires Python 3.12 and a CUDA 12.8+ PyTorch build (RTX 50-series / Blackwell).

```bash
uv sync

# Datasets (~7 GB compressed; resumable downloads)
uv run python scripts/download_data.py --data-root data
```

If MVTec auto-download fails, place `mvtec_anomaly_detection.tar.xz` in `data/` and re-run with `--mvtec-archive`.

## Reproduce the paper

```bash
# Smoke test (bottle + screw, 1-shot) — expect ~paper Table 5
uv run python scripts/smoke_test.py

# Full benchmark (pausable / resumable) — ~7–15 h on RTX 5060 Laptop
uv run python scripts/run_benchmark.py --run-id main

# Pause / resume / status from another terminal
uv run python scripts/runctl.py status main
uv run python scripts/runctl.py pause main
uv run python scripts/runctl.py resume main

# Optional scheduled pause
uv run python scripts/run_benchmark.py --run-id main --max-hours 6
uv run python scripts/run_benchmark.py --run-id main --until 08:00
uv run python scripts/run_benchmark.py --run-id main --pause-on-battery

# After main completes (or overnight chain):
uv run python scripts/run_ablations.py --run-id ablations-layers --ablation layers
uv run python scripts/aggregate.py
uv run python scripts/make_figures.py

# Or one-shot overnight watcher:
powershell -File scripts/overnight_chain.ps1
```

### Smoke-test snapshot (this machine)

| Category | Metric | Ours | Paper | delta |
|----------|--------|-----:|------:|------:|
| bottle | I-AUROC | 100.0 | 100.0 | +0.0 |
| bottle | P-AUROC | 98.8 | 98.6 | +0.2 |
| bottle | PRO | 96.8 | 96.5 | +0.3 |
| screw | I-AUROC | 89.2 | 88.4 | +0.8 |
| screw | P-AUROC | 99.0 | 99.1 | −0.1 |
| screw | PRO | 95.3 | 96.2 | −0.9 |

Single-image DINOv2-G @ 672px (fp16): ~0.7 s on RTX 5060 Laptop after warmup.

## Streamlit app

```bash
uv run streamlit run app/Home.py
```

Open http://localhost:8501 — pages: **Live Demo**, **Results**, **Ablations**, **Gallery**, **Runs** (pause/resume UI).

## Results

See [`results/tables.md`](results/tables.md) after aggregation (auto-marked *partial* until all seeds finish).

Paper 1-shot headline numbers (SubspaceAD):

| Dataset | I-AUROC | P-AUROC | PRO |
|---------|--------:|--------:|----:|
| MVTec-AD | 97.1 | 97.5 | 94.5 |
| VisA | 93.2 | 98.2 | 95.5 |

## Project layout

```
subspacead/          # core library (backbone, PCA, metrics, runner)
scripts/             # download, benchmark, ablations, aggregate, runctl
app/                 # Streamlit multipage UI
configs/default.yaml # paper hyperparameters
results/             # metrics JSON + tables.md + figures
runs/                # pause/resume state per run-id
cache/               # fp16 feature cache
data/                # MVTec-AD + VisA
```

## Citation

```bibtex
@article{lendering2026subspacead,
  title={SubspaceAD: Training-Free Few-Shot Anomaly Detection via Subspace Modeling},
  author={Lendering, Camile and Akdag, Erkut and Bondarev, Egor},
  journal={arXiv preprint arXiv:2602.23013},
  year={2026}
}
```

## License notes

- Code in this repo: MIT (reproduction).
- DINOv2 weights: Apache 2.0 (Meta).
- MVTec-AD: CC BY-NC-SA 4.0 (non-commercial).
- VisA: CC BY 4.0.
