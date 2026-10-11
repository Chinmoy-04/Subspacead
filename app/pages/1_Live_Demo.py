"""Interactive SubspaceAD demo — fit few-shot subspace, inspect heatmaps."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np
import streamlit as st
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import PRESETS, backbone_label, inject_css, overlay
from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config
from subspacead.data import (
    Sample,
    get_samples,
    list_categories,
    load_mask,
    load_pil,
    test_images,
    train_images,
)
from subspacead.pipeline import SubspaceAD
from subspacead.scoring import minmax_normalize

st.set_page_config(page_title="Live Demo · SubspaceAD", layout="wide", page_icon="▣")
inject_css()

st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">Interactive</div>
  <h1>Live Demo</h1>
  <p>Fit a PCA subspace on a few normal images, then score a test image.
  Hotter colors = higher residual = more anomalous. Use a fast backbone for
  interaction; switch to ViT-G for paper settings.</p>
</div>
""",
    unsafe_allow_html=True,
)

cfg = load_config()
data_root = ROOT / cfg["paths"]["data_root"]

# --- Sidebar controls ---
st.sidebar.markdown("### Setup")
preset_labels = ["Custom"] + [p["label"] for p in PRESETS]
preset_name = st.sidebar.selectbox("Preset", preset_labels, index=1)
preset = next((p for p in PRESETS if p["label"] == preset_name), None)

mode = st.sidebar.radio(
    "Speed",
    ["Fast demo", "Paper settings"],
    index=0,
    help="Fast: ViT-B @ 448, fewer rotations. Paper: ViT-G @ 672, 30 rotations.",
)

if mode == "Paper settings":
    default_bb, default_size, default_aug = "dinov2_vitg14", 672, 30
else:
    default_bb, default_size, default_aug = "dinov2_vitb14", 448, 8

bb_options = ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"]
bb_choice = st.sidebar.selectbox(
    "Backbone",
    bb_options,
    index=bb_options.index(default_bb),
    format_func=backbone_label,
)

dataset = st.sidebar.selectbox(
    "Dataset",
    ["mvtec", "visa"],
    index=0 if not preset else ["mvtec", "visa"].index(preset["dataset"]),
)
cats = list_categories(dataset)
existing = [c for c in cats if (data_root / dataset / c).exists()]
if dataset == "visa" and not existing:
    existing = cats
if not existing:
    st.warning(f"No data under `{data_root / dataset}`. Run `scripts/download_data.py` first.")
    st.stop()

default_cat = preset["category"] if preset and preset["dataset"] == dataset else existing[0]
if default_cat not in existing:
    default_cat = existing[0]
category = st.sidebar.selectbox("Category", existing, index=existing.index(default_cat))
k = st.sidebar.selectbox(
    "Shots (k)",
    [1, 2, 4],
    index=[1, 2, 4].index(preset["k"]) if preset else 0,
)
seed = st.sidebar.number_input("Seed", min_value=0, max_value=100, value=0)
image_size = st.sidebar.selectbox(
    "Resolution",
    [448, 672],
    index=[448, 672].index(default_size),
)
n_aug = st.sidebar.slider("Rotation augmentations", 0, 30, default_aug, help="Paper uses 30.")

uploaded_normals = st.sidebar.file_uploader(
    "Optional: upload normal references",
    type=["png", "jpg", "jpeg"],
    accept_multiple_files=True,
)

st.sidebar.caption("Fit once, then click any test thumbnail to rescore instantly.")


@st.cache_resource(show_spinner="Loading DINOv2…")
def load_backbone(name: str) -> DINOv2Backbone:
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return DINOv2Backbone(name=name, device=device, dtype=dtype, layers=None)


def fit_key() -> tuple:
    return (bb_choice, dataset, category, int(k), int(seed), int(image_size), int(n_aug))


def build_support() -> list[Sample]:
    if uploaded_normals:
        tmpdir = Path(tempfile.mkdtemp(prefix="subspacead_demo_"))
        support: list[Sample] = []
        for i, f in enumerate(uploaded_normals[:k]):
            p = tmpdir / f"n_{i}.png"
            Image.open(f).convert("RGB").save(p)
            support.append(Sample(p, None, 0, category, "train"))
        return support
    samples = get_samples(data_root, dataset, category)
    train = train_images(samples)
    if len(train) < k:
        raise RuntimeError(f"Only {len(train)} train images for {category}")
    return sample_support(train, k, int(seed), dataset, category)


col_fit, col_hint = st.columns([1, 3])
with col_fit:
    do_fit = st.button("Fit subspace", type="primary", use_container_width=True)
with col_hint:
    st.markdown(
        f'<span class="sa-chip">{backbone_label(bb_choice)}</span>'
        f'<span class="sa-chip">{dataset}/{category}</span>'
        f'<span class="sa-chip">k={k}</span>'
        f'<span class="sa-chip">{image_size}px</span>'
        f'<span class="sa-chip">aug={n_aug}</span>',
        unsafe_allow_html=True,
    )

if do_fit:
    local_cfg = dict(cfg)
    local_cfg["backbone"] = bb_choice
    local_cfg["image_size"] = image_size
    local_cfg["n_augmentations"] = n_aug
    local_cfg["layers"] = None  # relative layers per backbone
    backbone = load_backbone(bb_choice)
    use_disk = bb_choice == cfg.get("backbone") and image_size == int(cfg.get("image_size", 672))
    cache = (
        FeatureCache(
            ROOT / cfg["paths"]["cache_root"],
            backbone=bb_choice,
            image_size=image_size,
            aggregation=local_cfg.get("aggregation", "mean"),
        )
        if use_disk
        else None
    )
    ad = SubspaceAD(backbone=backbone, cfg=local_cfg, cache=cache)
    try:
        support = build_support()
    except RuntimeError as e:
        st.error(str(e))
        st.stop()

    no_rot = category in set(cfg.get("no_rotation_categories", [])) or n_aug <= 0
    with st.spinner("Extracting features & fitting PCA…"):
        model = ad.fit_from_samples(
            support, apply_rotation=not no_rot, seed=int(seed), show_progress=False
        )

    st.session_state["demo_fit"] = {
        "key": fit_key(),
        "ad": ad,
        "model": model,
        "support": support,
        "local_cfg": local_cfg,
    }
    st.success(f"Subspace ready — r = {model.n_components} components (τ = {local_cfg['tau']})")

fit = st.session_state.get("demo_fit")
if fit is None:
    st.info("Choose a preset (or custom settings), then **Fit subspace**.")
    st.stop()

if fit["key"] != fit_key():
    st.warning("Controls changed since the last fit — click **Fit subspace** again.")
    st.stop()

ad: SubspaceAD = fit["ad"]
model = fit["model"]
support: list[Sample] = fit["support"]

# Support strip
st.markdown('<div class="sa-caption">Normal support</div>', unsafe_allow_html=True)
scols = st.columns(min(len(support), 4))
for i, s in enumerate(support[:4]):
    scols[i % len(scols)].image(str(s.image_path), use_container_width=True, caption=f"ref {i+1}")

n_aug_eff = 0 if category in set(cfg.get("no_rotation_categories", [])) else int(fit["local_cfg"]["n_augmentations"])
n_views = len(support) * (1 + n_aug_eff)
m1, m2, m3, m4 = st.columns(4)
m1.metric("Components r", model.n_components)
m2.metric("Support views", n_views)
m3.metric("Feature dim", getattr(ad.backbone, "out_dim", "—"))
m4.metric("τ / ρ", f"{fit['local_cfg']['tau']} / {fit['local_cfg'].get('rho', 0.01)}")

if model.explained_variance_ratio is not None:
    with st.expander("Explained variance", expanded=False):
        cum = np.cumsum(model.explained_variance_ratio)[: max(model.n_components + 8, 24)]
        st.line_chart({"cumulative": cum})

# Test image picker
samples = get_samples(data_root, dataset, category)
all_test = test_images(samples)
anom = [s for s in all_test if s.label == 1]
good = [s for s in all_test if s.label == 0]

tab_a, tab_n, tab_u = st.tabs(
    [f"Anomalous ({len(anom)})", f"Normal ({len(good)})", "Upload"]
)

upload_img: Image.Image | None = None

with tab_a:
    if not anom:
        st.caption("No labeled anomalies in this split.")
    else:
        labels = [f"{i}: {Path(s.image_path).name}" for i, s in enumerate(anom)]
        st.selectbox(
            "Anomalous test image",
            range(len(anom)),
            format_func=lambda i: labels[i],
            key="anom_sel",
        )
        nshow = min(6, len(anom))
        tcols = st.columns(nshow)
        for i in range(nshow):
            tcols[i].image(str(anom[i].image_path), use_container_width=True)

with tab_n:
    if not good:
        st.caption("No labeled normals in this split.")
    else:
        labels = [f"{i}: {Path(s.image_path).name}" for i, s in enumerate(good)]
        st.selectbox(
            "Normal test image",
            range(len(good)),
            format_func=lambda i: labels[i],
            key="good_sel",
        )
        nshow = min(6, len(good))
        tcols = st.columns(nshow)
        for i in range(nshow):
            tcols[i].image(str(good[i].image_path), use_container_width=True)

with tab_u:
    uploaded_test = st.file_uploader("Test image", type=["png", "jpg", "jpeg"], key="test_up")
    if uploaded_test is not None:
        upload_img = Image.open(uploaded_test).convert("RGB")

sources = ["Anomalous", "Normal"]
if upload_img is not None:
    sources.append("Upload")
active_source = st.radio("Score from", sources, horizontal=True, index=0)

if active_source == "Upload" and upload_img is not None:
    test_img = upload_img
    ow, oh = test_img.size
    mask = np.zeros((oh, ow), dtype=np.uint8)
    img_np = np.array(test_img)
    caption_src = "upload"
elif active_source == "Normal":
    if not good:
        st.error("No normal test images in this split.")
        st.stop()
    s = good[int(st.session_state.get("good_sel", 0))]
    test_img = load_pil(s.image_path)
    ow, oh = test_img.size
    mask = np.zeros((oh, ow), dtype=np.uint8)
    img_np = np.array(test_img)
    caption_src = Path(s.image_path).name
else:
    pool = anom if anom else all_test
    if not pool:
        st.error("No test images available.")
        st.stop()
    sel = int(st.session_state.get("anom_sel", 0)) if anom else 0
    sel = min(sel, len(pool) - 1)
    s = pool[sel]
    test_img = load_pil(s.image_path)
    ow, oh = test_img.size
    mask = (
        load_mask(s.mask_path, (oh, ow))
        if getattr(s, "label", 0) == 1 and s.mask_path
        else np.zeros((oh, ow), dtype=np.uint8)
    )
    img_np = np.array(test_img)
    caption_src = Path(s.image_path).name

with st.spinner("Scoring…"):
    pred = ad.predict_image(test_img, out_size_hw=(oh, ow))

score = float(pred.image_score)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Image score (TVaR)", f"{score:.4f}")
c2.metric("Patch max", f"{float(pred.patch_map.max()):.4f}")
c3.metric("Patch mean", f"{float(pred.patch_map.mean()):.4f}")
c4.metric("Source", caption_src[:18] + ("…" if len(caption_src) > 18 else ""))

st.caption("Higher image score ⇒ more anomalous (top-1% residual average).")

a, b, c, d = st.columns(4)
a.markdown('<div class="sa-caption">Input</div>', unsafe_allow_html=True)
a.image(img_np, use_container_width=True)
b.markdown('<div class="sa-caption">Ground truth</div>', unsafe_allow_html=True)
b.image((mask * 255).astype(np.uint8), use_container_width=True)
c.markdown('<div class="sa-caption">Residual heatmap</div>', unsafe_allow_html=True)
heat_u8 = (minmax_normalize(pred.pixel_map) * 255).astype(np.uint8)
c.image(heat_u8, use_container_width=True)
d.markdown('<div class="sa-caption">Overlay</div>', unsafe_allow_html=True)
d.image(overlay(img_np, pred.pixel_map), use_container_width=True)

with st.expander("Patch score distribution"):
    hist, _ = np.histogram(pred.patch_map.ravel(), bins=40)
    st.bar_chart(hist)
