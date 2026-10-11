"""SubspaceAD Streamlit home page."""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]

st.set_page_config(
    page_title="SubspaceAD",
    page_icon="▣",
    layout="wide",
)

st.title("SubspaceAD")
st.subheader("Training-Free Few-Shot Anomaly Detection via Subspace Modeling")

st.markdown(
    """
Reproduction of
[Lendering, Akdag & Bondarev (arXiv:2602.23013)](https://arxiv.org/abs/2602.23013).

**Idea:** extract patch features with a frozen DINOv2 backbone, fit a PCA subspace
on a few normal images, and score anomalies by reconstruction residual.
"""
)

col1, col2, col3 = st.columns(3)
results_path = ROOT / "results" / "results.json"
paper = {
    "mvtec_1shot_i": 97.1,
    "mvtec_1shot_p": 97.5,
    "visa_1shot_i": 93.2,
}
ours = {}
partial = True
if results_path.exists():
    data = json.loads(results_path.read_text(encoding="utf-8"))
    partial = data.get("partial", True)
    summary = data.get("summary", {})
    try:
        ours["mvtec_1shot_i"] = summary["mvtec"]["1"]["mean"]["image_auroc"]["mean"]
        ours["mvtec_1shot_p"] = summary["mvtec"]["1"]["mean"]["pixel_auroc"]["mean"]
        ours["visa_1shot_i"] = summary["visa"]["1"]["mean"]["image_auroc"]["mean"]
    except KeyError:
        pass

with col1:
    st.metric(
        "MVTec 1-shot I-AUROC",
        f"{ours.get('mvtec_1shot_i', float('nan')):.1f}%" if "mvtec_1shot_i" in ours else "—",
        delta=f"paper {paper['mvtec_1shot_i']}%",
        delta_color="off",
    )
with col2:
    st.metric(
        "MVTec 1-shot P-AUROC",
        f"{ours.get('mvtec_1shot_p', float('nan')):.1f}%" if "mvtec_1shot_p" in ours else "—",
        delta=f"paper {paper['mvtec_1shot_p']}%",
        delta_color="off",
    )
with col3:
    st.metric(
        "VisA 1-shot I-AUROC",
        f"{ours.get('visa_1shot_i', float('nan')):.1f}%" if "visa_1shot_i" in ours else "—",
        delta=f"paper {paper['visa_1shot_i']}%",
        delta_color="off",
    )

if partial:
    st.info("Results are partial or not yet aggregated. Run the benchmark, then `scripts/aggregate.py`.")

st.markdown("### Pipeline")
st.code(
    """
k normal images
  → 30 random rotations (skip transistor)
  → DINOv2-G @ 672px, mean of blocks 22–28
  → PCA (τ = 0.99)
  → residual map → TVaR (top 1%) image score
  → upsample + Gaussian σ=4 for pixel map
""",
    language="text",
)

st.markdown("### Pages")
st.markdown(
    """
- **Live Demo** — fit on a category and inspect heatmaps
- **Results** — paper vs reproduction tables
- **Ablations** — τ, layers, backbone, resolution
- **Gallery** — qualitative figures
- **Runs** — pause / resume long jobs
"""
)
