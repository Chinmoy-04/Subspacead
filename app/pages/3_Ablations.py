"""Ablation explorer."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import inject_css

st.set_page_config(page_title="Ablations · SubspaceAD", layout="wide", page_icon="▣")
inject_css()

st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">Sensitivity</div>
  <h1>Ablations</h1>
  <p>Mean I-AUROC over categories for layer aggregation, τ, backbone,
  resolution, and batched 0-shot variants.</p>
</div>
""",
    unsafe_allow_html=True,
)

abl_root = ROOT / "results" / "ablations"
if not abl_root.exists():
    st.warning("No ablation results yet.")
    st.stop()

ABL_LABELS = {
    "layers": "Layer aggregation",
    "tau": "PCA threshold τ",
    "backbone": "Backbone capacity",
    "resolution": "Input resolution",
    "batched0": "Batched 0-shot",
}

rows = []
for p in abl_root.rglob("*.json"):
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        continue
    if "metrics" not in d:
        continue
    rows.append(
        {
            "ablation": d.get("ablation"),
            "variant": str(d.get("variant")),
            "dataset": d.get("dataset"),
            "category": d.get("category"),
            "k": d.get("k"),
            "I-AUROC": d["metrics"].get("image_auroc"),
            "P-AUROC": d["metrics"].get("pixel_auroc"),
            "PRO": d["metrics"].get("pro"),
        }
    )

if not rows:
    st.warning("No ablation JSON files found.")
    st.stop()

df = pd.DataFrame(rows)
abl_keys = sorted(df["ablation"].dropna().unique(), key=lambda x: list(ABL_LABELS).index(x) if x in ABL_LABELS else 99)
abl = st.selectbox(
    "Ablation",
    abl_keys,
    format_func=lambda x: ABL_LABELS.get(x, x),
)
metric = st.selectbox("Metric", ["I-AUROC", "P-AUROC", "PRO"], index=0)
sub = df[df["ablation"] == abl]

agg = (
    sub.groupby(["variant", "dataset", "k"], dropna=False)[metric]
    .mean()
    .reset_index()
)

# Friendly variant order for known ablations
ORDER = {
    "layers": ["mean", "final7", "concat", "last"],
    "backbone": ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"],
    "resolution": ["448", "672"],
}
if abl in ORDER:
    cat = pd.Categorical(agg["variant"], categories=ORDER[abl], ordered=True)
    agg = agg.assign(variant=cat).sort_values(["k", "variant"])

c1, c2 = st.columns([1, 2])
with c1:
    st.dataframe(
        agg.rename(columns={metric: f"mean {metric}"}),
        use_container_width=True,
        hide_index=True,
    )
with c2:
    fig = px.bar(
        agg,
        x="variant",
        y=metric,
        color="dataset",
        barmode="group",
        facet_col="k" if agg["k"].nunique() > 1 else None,
        title=f"{ABL_LABELS.get(abl, abl)} · mean {metric}",
        color_discrete_map={"mvtec": "#d4a04a", "visa": "#6a9fb5"},
    )
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(20,23,27,1)",
        height=420,
    )
    st.plotly_chart(fig, use_container_width=True)

with st.expander("Per-category detail"):
    st.dataframe(
        sub.sort_values(["dataset", "variant", "category"]),
        use_container_width=True,
        hide_index=True,
    )
