"""Qualitative gallery."""

from __future__ import annotations

from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
st.set_page_config(page_title="Gallery · SubspaceAD", layout="wide")
st.title("Gallery")

fig_root = ROOT / "results" / "figures"
if not fig_root.exists():
    st.warning("No figures yet. Run `uv run python scripts/make_figures.py`.")
    st.stop()

section = st.selectbox("Section", ["gallery", "failures"])
base = fig_root / section
if not base.exists():
    st.info(f"Nothing under {base}")
    st.stop()

images = sorted(base.rglob("*.png"))
if not images:
    st.info("No PNG figures found.")
    st.stop()

# Group by category
from collections import defaultdict

groups = defaultdict(list)
for p in images:
    groups[f"{p.parts[-3]}/{p.parts[-2]}"].append(p)

cat = st.selectbox("Category", sorted(groups.keys()))
cols = st.columns(2)
for i, p in enumerate(groups[cat]):
    cols[i % 2].image(str(p), caption=str(p.relative_to(fig_root)), use_container_width=True)
