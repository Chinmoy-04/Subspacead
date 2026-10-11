"""Paper vs reproduction results."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import inject_css

st.set_page_config(page_title="Results · SubspaceAD", layout="wide", page_icon="▣")
inject_css()

st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">Benchmark</div>
  <h1>Results</h1>
  <p>Full MVTec + VisA, k ∈ {1,2,4}, 5 seeds. Deltas are ours − paper
  (percentage points on the reported mean).</p>
</div>
""",
    unsafe_allow_html=True,
)

results_path = ROOT / "results" / "results.json"
if not results_path.exists():
    st.warning("No results.json yet. Run the benchmark and `uv run python scripts/aggregate.py`.")
    tables = ROOT / "results" / "tables.md"
    if tables.exists():
        st.markdown(tables.read_text(encoding="utf-8"))
    st.stop()

import json

data = json.loads(results_path.read_text(encoding="utf-8"))
if data.get("partial"):
    st.info("Showing **partial** results — the run may still be in progress.")

summary = data["summary"]
paper = data.get("paper_table1", {})

METRIC_LABEL = {
    "image_auroc": "I-AUROC",
    "image_aupr": "I-AUPR",
    "pixel_auroc": "P-AUROC",
    "pro": "PRO",
}

rows = []
for ds, by_k in summary.items():
    for k, block in by_k.items():
        for m, stats in block.get("mean", {}).items():
            p = paper.get(ds, {}).get(int(k), {}).get(m)
            rows.append(
                {
                    "dataset": ds,
                    "k": int(k),
                    "metric": METRIC_LABEL.get(m, m),
                    "metric_key": m,
                    "ours": stats["mean"],
                    "std": stats["std"],
                    "paper": p,
                    "delta": (stats["mean"] - p) if p is not None else None,
                }
            )
df = pd.DataFrame(rows)

# Highlight strip: I-AUROC paper comparison
hi = df[df["metric_key"] == "image_auroc"].copy()
fig = go.Figure()
for ds, color in [("mvtec", "#d4a04a"), ("visa", "#6a9fb5")]:
    sub = hi[hi["dataset"] == ds].sort_values("k")
    fig.add_trace(
        go.Scatter(
            x=sub["k"],
            y=sub["ours"],
            mode="lines+markers",
            name=f"{ds} ours",
            line=dict(color=color, width=2),
        )
    )
    fig.add_trace(
        go.Scatter(
            x=sub["k"],
            y=sub["paper"],
            mode="lines+markers",
            name=f"{ds} paper",
            line=dict(color=color, width=1, dash="dot"),
        )
    )
fig.update_layout(
    title="I-AUROC vs k (solid = ours, dotted = paper)",
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(20,23,27,1)",
    xaxis_title="shots k",
    yaxis_title="I-AUROC",
    legend=dict(orientation="h", yanchor="bottom", y=1.02),
    margin=dict(l=40, r=20, t=60, b=40),
    height=360,
)
st.plotly_chart(fig, use_container_width=True)

st.subheader("Table 1 — mean over categories")
show = df.drop(columns=["metric_key"]).copy()
show["ours"] = show["ours"].map(lambda x: f"{x:.1f}")
show["std"] = show["std"].map(lambda x: f"±{x:.1f}")
show["paper"] = show["paper"].map(lambda x: f"{x:.1f}" if pd.notna(x) else "—")
show["delta"] = show["delta"].map(lambda x: f"{x:+.1f}" if pd.notna(x) else "—")
st.dataframe(show, use_container_width=True, hide_index=True)

st.subheader("Per-category I-AUROC")
ds = st.selectbox("Dataset", sorted(summary.keys()))
k_options = sorted(int(x) for x in summary[ds].keys())
k = st.selectbox("Shots", k_options)
block = summary[ds].get(k, summary[ds].get(str(k)))
cats = block["categories"]
bar_rows = [
    {"category": cat, "I-AUROC": mets["image_auroc"]["mean"]}
    for cat, mets in cats.items()
    if "image_auroc" in mets
]
bar_df = pd.DataFrame(bar_rows).sort_values("I-AUROC")
fig2 = px.bar(
    bar_df,
    x="I-AUROC",
    y="category",
    orientation="h",
    title=f"{ds} · k={k}",
    color="I-AUROC",
    color_continuous_scale=["#3d2a12", "#d4a04a"],
)
fig2.update_layout(
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(20,23,27,1)",
    height=max(360, 28 * len(bar_df)),
    coloraxis_showscale=False,
)
st.plotly_chart(fig2, use_container_width=True)

tables = ROOT / "results" / "tables.md"
if tables.exists():
    with st.expander("Raw tables.md"):
        st.markdown(tables.read_text(encoding="utf-8"))
