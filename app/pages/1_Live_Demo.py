"""Live SubspaceAD demo."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import streamlit as st
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config
from subspacead.data import (
    get_samples,
    list_categories,
    load_mask,
    load_pil,
    test_images,
    train_images,
)
from subspacead.pipeline import SubspaceAD
from subspacead.scoring import minmax_normalize

st.set_page_config(page_title="Live Demo · SubspaceAD", layout="wide")
st.title("Live Demo")

cfg = load_config()
data_root = ROOT / cfg["paths"]["data_root"]

bb_choice = st.sidebar.selectbox(
    "Backbone",
    ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"],
    index=0,
    help="Use S/B for interactive speed; G matches the paper.",
)
dataset = st.sidebar.selectbox("Dataset", ["mvtec", "visa"])
cats = list_categories(dataset)
existing = [c for c in cats if (data_root / dataset / c).exists()]
# VisA may use CSV layout without per-cat folders fully populated
if dataset == "visa" and not existing:
    existing = cats
if not existing:
    st.warning(f"No data under {data_root / dataset}. Run scripts/download_data.py first.")
    st.stop()

category = st.sidebar.selectbox("Category", existing)
k = st.sidebar.selectbox("Shots (k)", [1, 2, 4], index=0)
seed = st.sidebar.number_input("Seed", min_value=0, max_value=100, value=0)
image_size = st.sidebar.selectbox("Resolution", [448, 672], index=1)


@st.cache_resource(show_spinner="Loading DINOv2…")
def load_backbone(name: str):
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return DINOv2Backbone(name=name, device=device, dtype=dtype)


def overlay(img: np.ndarray, heat: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    import matplotlib

    heat_n = minmax_normalize(heat)
    if heat_n.shape[:2] != img.shape[:2]:
        heat_n = np.array(
            Image.fromarray((heat_n * 255).astype(np.uint8)).resize(
                (img.shape[1], img.shape[0]), Image.BILINEAR
            )
        ) / 255.0
    try:
        cmap = matplotlib.colormaps["jet"]
    except Exception:
        cmap = matplotlib.cm.get_cmap("jet")  # type: ignore[attr-defined]
    colored = (cmap(heat_n)[..., :3] * 255).astype(np.uint8)
    return (img.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha).astype(
        np.uint8
    )


uploaded_normals = st.sidebar.file_uploader(
    "Or upload normal reference images",
    type=["png", "jpg", "jpeg"],
    accept_multiple_files=True,
)
uploaded_test = st.file_uploader("Upload a test image (optional)", type=["png", "jpg", "jpeg"])

run = st.button("Fit & predict", type="primary")

if run:
    local_cfg = dict(cfg)
    local_cfg["backbone"] = bb_choice
    local_cfg["image_size"] = image_size
    backbone = load_backbone(bb_choice)
    cache = FeatureCache(
        ROOT / cfg["paths"]["cache_root"],
        backbone=bb_choice,
        image_size=image_size,
        aggregation=local_cfg.get("aggregation", "mean"),
    )
    ad = SubspaceAD(backbone=backbone, cfg=local_cfg, cache=cache)

    if uploaded_normals:
        from subspacead.data import Sample
        import tempfile

        tmpdir = Path(tempfile.mkdtemp())
        support = []
        for i, f in enumerate(uploaded_normals[:k]):
            p = tmpdir / f"n_{i}.png"
            Image.open(f).convert("RGB").save(p)
            support.append(Sample(p, None, 0, category, "train"))
    else:
        samples = get_samples(data_root, dataset, category)
        train = train_images(samples)
        if len(train) < k:
            st.error(f"Only {len(train)} train images for {category}")
            st.stop()
        support = sample_support(train, k, int(seed), dataset, category)

    no_rot = category in set(cfg.get("no_rotation_categories", []))
    with st.spinner("Fitting PCA subspace…"):
        model = ad.fit_from_samples(support, apply_rotation=not no_rot, seed=int(seed))
    st.success(f"Fitted with r={model.n_components} components (τ={local_cfg['tau']})")

    if model.explained_variance_ratio is not None:
        cum = np.cumsum(model.explained_variance_ratio)[: max(model.n_components + 5, 20)]
        st.line_chart({"cumulative explained variance": cum})

    if uploaded_test is not None:
        test_img = Image.open(uploaded_test).convert("RGB")
        ow, oh = test_img.size
        pred = ad.predict_image(test_img, out_size_hw=(oh, ow))
        mask = np.zeros((oh, ow), dtype=np.uint8)
        img_np = np.array(test_img)
    else:
        samples = get_samples(data_root, dataset, category)
        test = [s for s in test_images(samples) if s.label == 1]
        if not test:
            test = test_images(samples)
        s = test[0]
        test_img = load_pil(s.image_path)
        ow, oh = test_img.size
        pred = ad.predict_path(s.image_path, out_size_hw=(oh, ow))
        mask = (
            load_mask(s.mask_path, (oh, ow))
            if s.label == 1
            else np.zeros((oh, ow), dtype=np.uint8)
        )
        img_np = np.array(test_img)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Image score", f"{pred.image_score:.4f}")
    c2.metric("Patch max", f"{pred.patch_map.max():.4f}")
    c3.metric("Components r", model.n_components)
    c4.metric("Support images", len(support))

    a, b, c = st.columns(3)
    a.image(img_np, caption="Input", use_container_width=True)
    b.image(mask * 255, caption="Ground truth", use_container_width=True)
    c.image(overlay(img_np, pred.pixel_map), caption="Heatmap overlay", use_container_width=True)

    st.subheader("Patch score histogram")
    st.bar_chart(np.histogram(pred.patch_map.ravel(), bins=40)[0])
