"""Config loading and hashing."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml


def load_config(path: Path | str | None = None) -> dict[str, Any]:
    if path is None:
        path = Path(__file__).resolve().parents[1] / "configs" / "default.yaml"
    path = Path(path)
    with open(path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    return cfg


def config_hash(cfg: dict[str, Any]) -> str:
    """Stable hash of settings that affect results (ignore paths)."""
    keys = [
        "image_size",
        "backbone",
        "layers",
        "aggregation",
        "n_augmentations",
        "rotation_step",
        "tau",
        "rho",
        "gaussian_sigma",
        "seeds",
        "shots",
        "no_rotation_categories",
        "datasets",
    ]
    subset = {k: cfg.get(k) for k in keys}
    blob = json.dumps(subset, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]
