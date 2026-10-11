"""Read-only access to aggregated results, ablations and gallery figures."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from server.utils import ROOT

RESULTS_DIR = ROOT / "results"
FIGURES_DIR = RESULTS_DIR / "figures"
ABLATIONS_DIR = RESULTS_DIR / "ablations"

ABLATION_LABELS = {
    "layers": "Layer aggregation",
    "tau": "PCA threshold τ",
    "backbone": "Backbone capacity",
    "resolution": "Input resolution",
    "batched0": "Batched 0-shot",
}

_ablation_cache: dict[str, Any] = {"at": 0.0, "rows": None}


def load_results() -> dict[str, Any] | None:
    path = RESULTS_DIR / "results.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    tables = RESULTS_DIR / "tables.md"
    data["tables_md"] = tables.read_text(encoding="utf-8") if tables.exists() else None
    return data


def load_ablation_rows(ttl_s: float = 60.0) -> list[dict[str, Any]]:
    now = time.time()
    if _ablation_cache["rows"] is not None and now - _ablation_cache["at"] < ttl_s:
        return _ablation_cache["rows"]
    rows: list[dict[str, Any]] = []
    if ABLATIONS_DIR.exists():
        for p in ABLATIONS_DIR.rglob("*.json"):
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            metrics = d.get("metrics")
            if not metrics:
                continue
            rows.append(
                {
                    "ablation": d.get("ablation"),
                    "variant": str(d.get("variant")),
                    "dataset": d.get("dataset"),
                    "category": d.get("category"),
                    "k": d.get("k"),
                    "image_auroc": metrics.get("image_auroc"),
                    "pixel_auroc": metrics.get("pixel_auroc"),
                    "pro": metrics.get("pro"),
                }
            )
    _ablation_cache.update(at=now, rows=rows)
    return rows


def list_figures() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not FIGURES_DIR.exists():
        return out
    for section in ("gallery", "failures"):
        base = FIGURES_DIR / section
        if not base.exists():
            continue
        for p in sorted(base.rglob("*.png")):
            rel = p.relative_to(FIGURES_DIR)
            parts = rel.parts
            if len(parts) < 4:
                continue
            out.append(
                {
                    "section": section,
                    "dataset": parts[1],
                    "category": parts[2],
                    "name": p.stem,
                    "url": "/api/figures/" + rel.as_posix(),
                }
            )
    return out


def figure_path(rel: str) -> Path:
    p = (FIGURES_DIR / rel).resolve()
    if FIGURES_DIR.resolve() not in p.parents or p.suffix.lower() != ".png":
        raise FileNotFoundError(rel)
    return p
