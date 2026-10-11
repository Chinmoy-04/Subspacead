"""Shared helpers for the SubspaceAD Streamlit demo."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# Technical dark theme — graphite + amber (not purple/glow)
CUSTOM_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

html, body, [class*="css"] {
  font-family: "IBM Plex Sans", sans-serif;
}
h1, h2, h3 {
  font-family: "IBM Plex Sans", sans-serif !important;
  letter-spacing: -0.02em;
}
code, pre, .stCode {
  font-family: "IBM Plex Mono", monospace !important;
}
.block-container {
  padding-top: 1.5rem;
  max-width: 1200px;
}
div[data-testid="stMetric"] {
  background: linear-gradient(165deg, #1a1d21 0%, #121418 100%);
  border: 1px solid #2a3038;
  border-radius: 6px;
  padding: 0.85rem 1rem;
}
div[data-testid="stMetric"] label {
  color: #9aa3ad !important;
  font-size: 0.8rem !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
div[data-testid="stMetric"] [data-testid="stMetricValue"] {
  font-family: "IBM Plex Mono", monospace !important;
  color: #f0f2f5 !important;
}
.sa-hero {
  background:
    radial-gradient(ellipse 80% 60% at 10% 0%, rgba(212,160,74,0.12), transparent 55%),
    linear-gradient(180deg, #16191e 0%, #0e1013 100%);
  border: 1px solid #2a3038;
  border-radius: 10px;
  padding: 1.75rem 2rem 1.5rem;
  margin-bottom: 1.25rem;
}
.sa-hero h1 {
  margin: 0 0 0.35rem 0;
  font-size: 2.1rem;
  color: #f5f6f8;
}
.sa-hero .sa-tag {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.75rem;
  color: #d4a04a;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.5rem;
}
.sa-hero p {
  color: #a8b0ba;
  max-width: 52rem;
  margin: 0.4rem 0 0 0;
  line-height: 1.55;
}
.sa-chip {
  display: inline-block;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  color: #c9d0d8;
  background: #1e2329;
  border: 1px solid #343b45;
  border-radius: 4px;
  padding: 0.2rem 0.55rem;
  margin: 0.15rem 0.25rem 0.15rem 0;
}
.sa-panel {
  border: 1px solid #2a3038;
  border-radius: 8px;
  padding: 1rem 1.1rem;
  background: #14171b;
  margin-bottom: 0.75rem;
}
.sa-caption {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.72rem;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}
.sa-score-high { color: #e86a5c !important; }
.sa-score-low { color: #6fcf97 !important; }
</style>
"""

PRESETS = [
    {
        "label": "MVTec · bottle (crack)",
        "dataset": "mvtec",
        "category": "bottle",
        "k": 1,
        "prefer_anomalous": True,
    },
    {
        "label": "MVTec · cable",
        "dataset": "mvtec",
        "category": "cable",
        "k": 1,
        "prefer_anomalous": True,
    },
    {
        "label": "MVTec · screw",
        "dataset": "mvtec",
        "category": "screw",
        "k": 2,
        "prefer_anomalous": True,
    },
    {
        "label": "VisA · candle",
        "dataset": "visa",
        "category": "candle",
        "k": 1,
        "prefer_anomalous": True,
    },
    {
        "label": "VisA · pcb1",
        "dataset": "visa",
        "category": "pcb1",
        "k": 2,
        "prefer_anomalous": True,
    },
]


def inject_css() -> None:
    import streamlit as st

    st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


def load_summary() -> dict[str, Any]:
    path = ROOT / "results" / "results.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def metric_mean(summary: dict, dataset: str, k: int | str, metric: str) -> float | None:
    try:
        block = summary["summary"][dataset][str(k)]["mean"][metric]
        return float(block["mean"])
    except (KeyError, TypeError, ValueError):
        return None


def overlay(img: np.ndarray, heat: np.ndarray, alpha: float = 0.48) -> np.ndarray:
    import matplotlib

    from subspacead.scoring import minmax_normalize

    heat_n = minmax_normalize(heat)
    if heat_n.shape[:2] != img.shape[:2]:
        heat_n = (
            np.array(
                Image.fromarray((heat_n * 255).astype(np.uint8)).resize(
                    (img.shape[1], img.shape[0]), Image.BILINEAR
                )
            )
            / 255.0
        )
    try:
        cmap = matplotlib.colormaps["turbo"]
    except Exception:
        cmap = matplotlib.colormaps["jet"]
    colored = (cmap(heat_n)[..., :3] * 255).astype(np.uint8)
    return (
        img.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha
    ).astype(np.uint8)


def backbone_label(name: str) -> str:
    return {
        "dinov2_vits14": "ViT-S (fast)",
        "dinov2_vitb14": "ViT-B (balanced)",
        "dinov2_vitl14": "ViT-L",
        "dinov2_vitg14": "ViT-G (paper)",
    }.get(name, name)
