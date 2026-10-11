"""Ablation explorer."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
st.set_page_config(page_title="Ablations · SubspaceAD", layout="wide")
st.title("Ablations")

abl_root = ROOT / "results" / "ablations"
if not abl_root.exists():
    st.warning("No ablation results yet. Run `scripts/run_ablations.py --run-id ablations`.")
    st.stop()

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
            **{f"m_{k}": v for k, v in d["metrics"].items()},
        }
    )

if not rows:
    st.warning("No ablation JSON files found.")
    st.stop()

df = pd.DataFrame(rows)
abl = st.selectbox("Ablation", sorted(df["ablation"].dropna().unique()))
sub = df[df["ablation"] == abl]
# Mean over categories
agg = (
    sub.groupby(["variant", "dataset", "k"], dropna=False)["m_image_auroc"]
    .mean()
    .reset_index()
)
st.dataframe(agg, use_container_width=True)
fig = px.bar(
    agg,
    x="variant",
    y="m_image_auroc",
    color="dataset",
    barmode="group",
    facet_col="k" if agg["k"].nunique() > 1 else None,
    title=f"{abl}: mean I-AUROC",
)
st.plotly_chart(fig, use_container_width=True)
