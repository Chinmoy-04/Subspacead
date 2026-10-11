"""Paper-reported numbers for comparison tables."""

from __future__ import annotations

# Table 1 means (SubspaceAD ours) — from the paper
PAPER_TABLE1 = {
    "mvtec": {
        1: {"image_auroc": 97.1, "image_aupr": 98.6, "pixel_auroc": 97.5, "pro": 94.5},
        2: {"image_auroc": 97.5, "image_aupr": 98.8, "pixel_auroc": 97.8, "pro": 94.9},
        4: {"image_auroc": 98.0, "image_aupr": 99.0, "pixel_auroc": 97.9, "pro": 95.1},
    },
    "visa": {
        1: {"image_auroc": 93.2, "image_aupr": 93.0, "pixel_auroc": 98.2, "pro": 95.5},
        2: {"image_auroc": 93.8, "image_aupr": 93.4, "pixel_auroc": 98.3, "pro": 95.7},
        4: {"image_auroc": 94.7, "image_aupr": 94.3, "pixel_auroc": 98.4, "pro": 96.0},
    },
}

# Table 5 — MVTec per-category 1-shot (means)
PAPER_MVTEC_1SHOT = {
    "bottle": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 98.6, "pro": 96.5},
    "cable": {"image_auroc": 92.1, "image_aupr": 95.5, "pixel_auroc": 95.6, "pro": 90.3},
    "capsule": {"image_auroc": 88.1, "image_aupr": 96.8, "pixel_auroc": 98.0, "pro": 96.7},
    "carpet": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 99.2, "pro": 98.2},
    "grid": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 99.5, "pro": 98.1},
    "hazelnut": {"image_auroc": 97.6, "image_aupr": 98.6, "pixel_auroc": 99.5, "pro": 97.1},
    "leather": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 98.9, "pro": 98.3},
    "metal_nut": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 97.2, "pro": 95.9},
    "pill": {"image_auroc": 96.2, "image_aupr": 99.2, "pixel_auroc": 95.5, "pro": 97.8},
    "screw": {"image_auroc": 88.4, "image_aupr": 95.4, "pixel_auroc": 99.1, "pro": 96.2},
    "tile": {"image_auroc": 100.0, "image_aupr": 100.0, "pixel_auroc": 97.7, "pro": 94.8},
    "toothbrush": {"image_auroc": 98.8, "image_aupr": 99.5, "pixel_auroc": 98.9, "pro": 97.0},
    "transistor": {"image_auroc": 96.6, "image_aupr": 94.5, "pixel_auroc": 90.4, "pro": 68.9},
    "wood": {"image_auroc": 99.6, "image_aupr": 99.9, "pixel_auroc": 96.7, "pro": 96.5},
    "zipper": {"image_auroc": 99.1, "image_aupr": 99.8, "pixel_auroc": 98.3, "pro": 95.4},
}

# Table 2 batched 0-shot image AUROC
PAPER_BATCHED_0SHOT = {"mvtec": 96.6, "visa": 94.1}

# AnomalyDINO 1-shot baselines (Table 1)
PAPER_ANOMALYDINO_1SHOT = {
    "mvtec": {"image_auroc": 96.6, "image_aupr": 98.2, "pixel_auroc": 96.8, "pro": 92.7},
    "visa": {"image_auroc": 87.4, "image_aupr": 89.0, "pixel_auroc": 97.8, "pro": 92.5},
}
