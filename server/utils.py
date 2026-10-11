"""Shared helpers: presets, labels, image encoding, heatmap rendering."""

from __future__ import annotations

import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image

from subspacead.scoring import minmax_normalize

ROOT = Path(__file__).resolve().parents[1]

PRESETS = [
    {"id": "mvtec-bottle", "label": "MVTec · bottle (crack)", "dataset": "mvtec", "category": "bottle", "k": 1},
    {"id": "mvtec-cable", "label": "MVTec · cable", "dataset": "mvtec", "category": "cable", "k": 1},
    {"id": "mvtec-screw", "label": "MVTec · screw", "dataset": "mvtec", "category": "screw", "k": 2},
    {"id": "visa-candle", "label": "VisA · candle", "dataset": "visa", "category": "candle", "k": 1},
    {"id": "visa-pcb1", "label": "VisA · pcb1", "dataset": "visa", "category": "pcb1", "k": 2},
]

BACKBONES = ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"]

MODES = {
    "fast": {"label": "Fast demo", "backbone": "dinov2_vitb14", "image_size": 448, "n_aug": 8},
    "paper": {"label": "Paper settings", "backbone": "dinov2_vitg14", "image_size": 672, "n_aug": 30},
}


def backbone_label(name: str) -> str:
    return {
        "dinov2_vits14": "ViT-S (fast)",
        "dinov2_vitb14": "ViT-B (balanced)",
        "dinov2_vitl14": "ViT-L",
        "dinov2_vitg14": "ViT-G (paper)",
    }.get(name, name)


def _colormap(name: str):
    import matplotlib

    try:
        return matplotlib.colormaps[name]
    except KeyError:
        return matplotlib.colormaps["jet"]


def _resize_like(heat_n: np.ndarray, shape_hw: tuple[int, int]) -> np.ndarray:
    if heat_n.shape[:2] == shape_hw:
        return heat_n
    im = Image.fromarray((heat_n * 255).astype(np.uint8)).resize((shape_hw[1], shape_hw[0]), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32) / 255.0


def overlay(img: np.ndarray, heat: np.ndarray, alpha: float = 0.48) -> np.ndarray:
    heat_n = _resize_like(minmax_normalize(heat), img.shape[:2])
    colored = (_colormap("turbo")(heat_n)[..., :3] * 255).astype(np.uint8)
    return (img.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha).astype(np.uint8)


def colored_heatmap(heat: np.ndarray) -> np.ndarray:
    heat_n = minmax_normalize(heat)
    return (_colormap("inferno")(heat_n)[..., :3] * 255).astype(np.uint8)


def to_data_url(arr_or_img: np.ndarray | Image.Image, fmt: str = "PNG", max_side: int | None = None) -> str:
    img = arr_or_img if isinstance(arr_or_img, Image.Image) else Image.fromarray(arr_or_img)
    if max_side and max(img.size) > max_side:
        img = img.copy()
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    if fmt.upper() == "JPEG" and img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=88) if fmt.upper() == "JPEG" else img.save(buf, format=fmt)
    mime = "image/jpeg" if fmt.upper() == "JPEG" else "image/png"
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"
