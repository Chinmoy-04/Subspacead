"""Qualitative gallery."""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import inject_css

st.set_page_config(page_title="Gallery · SubspaceAD", layout="wide", page_icon="▣")
inject_css()

st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">Qualitative</div>
  <h1>Gallery</h1>
  <p>Pre-rendered success cases and failure modes from the full reproduction run.</p>
</div>
""",
    unsafe_allow_html=True,
)

fig_root = ROOT / "results" / "figures"
if not fig_root.exists():
    st.warning("No figures yet. Run `uv run python scripts/make_figures.py`.")
    st.stop()

section = st.radio("Section", ["gallery", "failures"], horizontal=True, format_func=lambda s: "Successes" if s == "gallery" else "Failure cases")
base = fig_root / section
if not base.exists():
    st.info(f"Nothing under {base}")
    st.stop()

images = sorted(base.rglob("*.png"))
if not images:
    st.info("No PNG figures found.")
    st.stop()

groups: dict[str, list[Path]] = defaultdict(list)
for p in images:
    # .../gallery/{dataset}/{category}/{n}.png
    parts = p.parts
    try:
        key = f"{parts[-3]}/{parts[-2]}"
    except IndexError:
        key = str(p.parent.relative_to(fig_root))
    groups[key].append(p)

ds_filter = st.selectbox("Dataset", ["all", "mvtec", "visa"])
keys = sorted(groups.keys())
if ds_filter != "all":
    keys = [k for k in keys if k.startswith(ds_filter + "/")]
if not keys:
    st.info("No figures for that filter.")
    st.stop()

cat = st.selectbox("Category", keys)
cols = st.columns(2)
for i, p in enumerate(groups[cat]):
    with cols[i % 2]:
        st.markdown(
            f'<div class="sa-caption">{p.stem}</div>',
            unsafe_allow_html=True,
        )
        st.image(str(p), use_container_width=True)
