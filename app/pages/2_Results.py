"""Paper vs reproduction results."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
st.set_page_config(page_title="Results · SubspaceAD", layout="wide")
st.title("Results")

results_path = ROOT / "results" / "results.json"
if not results_path.exists():
    st.warning("No results.json yet. Run the benchmark and `uv run python scripts/aggregate.py`.")
    tables = ROOT / "results" / "tables.md"
    if tables.exists():
        st.markdown(tables.read_text(encoding="utf-8"))
    st.stop()

data = json.loads(results_path.read_text(encoding="utf-8"))
if data.get("partial"):
    st.info("Showing **partial** results — the run may still be in progress.")

summary = data["summary"]
paper = data.get("paper_table1", {})

rows = []
for ds, by_k in summary.items():
    for k, block in by_k.items():
        for m, stats in block.get("mean", {}).items():
            p = paper.get(ds, {}).get(int(k), {}).get(m)
            rows.append(
                {
                    "dataset": ds,
                    "k": int(k),
                    "metric": m,
                    "ours": stats["mean"],
                    "ours_std": stats["std"],
                    "paper": p,
                    "delta": (stats["mean"] - p) if p is not None else None,
                }
            )
df = pd.DataFrame(rows)
st.subheader("Table 1 — mean over categories")
st.dataframe(df, use_container_width=True)

# Per-category bars
st.subheader("Per-category I-AUROC")
ds = st.selectbox("Dataset", sorted(summary.keys()))
k_options = sorted(int(x) for x in summary[ds].keys())
k = st.selectbox("Shots", k_options)
block = summary[ds].get(k, summary[ds].get(str(k)))
cats = block["categories"]

bar_rows = []
for cat, mets in cats.items():
    if "image_auroc" in mets:
        bar_rows.append({"category": cat, "I-AUROC": mets["image_auroc"]["mean"]})
bar_df = pd.DataFrame(bar_rows).sort_values("I-AUROC")
fig = px.bar(bar_df, x="I-AUROC", y="category", orientation="h", title=f"{ds} k={k}")
st.plotly_chart(fig, use_container_width=True)

# k-shot trend
st.subheader("k-shot trend")
trend = df[df["metric"] == "image_auroc"].copy()
fig2 = px.line(trend, x="k", y="ours", color="dataset", markers=True, title="I-AUROC vs k")
st.plotly_chart(fig2, use_container_width=True)
