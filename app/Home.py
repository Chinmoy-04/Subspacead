"""SubspaceAD Streamlit home — portfolio-facing entry."""

from __future__ import annotations

from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
import sys

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import inject_css, load_summary, metric_mean

st.set_page_config(
    page_title="SubspaceAD",
    page_icon="▣",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_css()

data = load_summary()
summary = data.get("summary", {})
paper = {
    ("mvtec", 1, "image_auroc"): 97.1,
    ("mvtec", 1, "pixel_auroc"): 97.5,
    ("visa", 1, "image_auroc"): 93.2,
}

st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">arXiv:2602.23013 · full reproduction</div>
  <h1>SubspaceAD</h1>
  <p>Training-free few-shot anomaly detection: frozen DINOv2 features, a PCA
  subspace from k normal images, residual scoring. This app is the interactive
  demo of our MVTec + VisA reproduction — website redesign comes next.</p>
</div>
""",
    unsafe_allow_html=True,
)

c1, c2, c3, c4 = st.columns(4)
pairs = [
    ("MVTec 1-shot I-AUROC", "mvtec", 1, "image_auroc"),
    ("MVTec 1-shot P-AUROC", "mvtec", 1, "pixel_auroc"),
    ("VisA 1-shot I-AUROC", "visa", 1, "image_auroc"),
    ("MVTec 4-shot I-AUROC", "mvtec", 4, "image_auroc"),
]
for col, (label, ds, k, met) in zip([c1, c2, c3, c4], pairs):
    ours = metric_mean(data, ds, k, met) if summary else None
    p = paper.get((ds, k, met))
    if ours is None:
        col.metric(label, "—")
    elif p is None:
        col.metric(label, f"{ours:.1f}%")
    else:
        col.metric(label, f"{ours:.1f}%", delta=f"paper {p:.1f}%", delta_color="off")

st.markdown("")
a, b = st.columns([1, 1])
with a:
    st.page_link("pages/1_Live_Demo.py", label="Open Live Demo →", use_container_width=True)
with b:
    st.page_link("pages/2_Results.py", label="Paper vs ours →", use_container_width=True)

st.markdown("### Method (one pass)")
st.code(
    """k normal images
  → random rotations (×30; skip orientation-critical classes)
  → DINOv2-G @ 672px · mean of blocks 22–28
  → PCA subspace (τ = 0.99 explained variance)
  → patch residual → TVaR image score (top 1%)
  → upsample + Gaussian σ=4 → pixel heatmap""",
    language="text",
)

st.markdown("### Explore")
e1, e2, e3 = st.columns(3)
with e1:
    st.markdown(
        '<div class="sa-panel"><div class="sa-caption">Ablations</div>'
        "τ, layer aggregation, backbone S/B/L/G, resolution, batched 0-shot."
        "</div>",
        unsafe_allow_html=True,
    )
    st.page_link("pages/3_Ablations.py", label="Ablation explorer")
with e2:
    st.markdown(
        '<div class="sa-panel"><div class="sa-caption">Gallery</div>'
        "Qualitative successes and failure cases from the full run."
        "</div>",
        unsafe_allow_html=True,
    )
    st.page_link("pages/4_Gallery.py", label="Figure gallery")
with e3:
    st.markdown(
        '<div class="sa-panel"><div class="sa-caption">Runs</div>'
        "Pause / resume long benchmark jobs (dev tooling)."
        "</div>",
        unsafe_allow_html=True,
    )
    st.page_link("pages/5_Runs.py", label="Run control")

st.markdown("---")
st.caption(
    "Paper: Lendering, Akdag & Bondarev — "
    "[arXiv:2602.23013](https://arxiv.org/abs/2602.23013). "
    "Reproduction on RTX 5060 8GB · UV + PyTorch cu128."
)
