"""Evaluation metrics: image/pixel AUROC, AUPR, PRO."""

from __future__ import annotations

from typing import Sequence

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score


def image_auroc(scores: Sequence[float], labels: Sequence[int]) -> float:
    y = np.asarray(labels, dtype=np.int32)
    s = np.asarray(scores, dtype=np.float64)
    if len(np.unique(y)) < 2:
        return float("nan")
    return float(roc_auc_score(y, s))


def image_aupr(scores: Sequence[float], labels: Sequence[int]) -> float:
    y = np.asarray(labels, dtype=np.int32)
    s = np.asarray(scores, dtype=np.float64)
    if len(np.unique(y)) < 2:
        return float("nan")
    return float(average_precision_score(y, s))


def pixel_auroc(maps: Sequence[np.ndarray], masks: Sequence[np.ndarray]) -> float:
    scores = []
    labels = []
    for m, gt in zip(maps, masks):
        scores.append(np.asarray(m, dtype=np.float64).ravel())
        labels.append(np.asarray(gt).ravel().astype(np.int32))
    s = np.concatenate(scores)
    y = np.concatenate(labels)
    if y.max() == 0 or y.min() == 1:
        return float("nan")
    if s.size > 5_000_000:
        rng = np.random.default_rng(0)
        idx = rng.choice(s.size, size=5_000_000, replace=False)
        s, y = s[idx], y[idx]
    return float(roc_auc_score(y, s))


def compute_pro(
    maps: Sequence[np.ndarray],
    masks: Sequence[np.ndarray],
    max_fpr: float = 0.3,
    num_thresholds: int = 100,
) -> float:
    """
    Per-Region Overlap (PRO) as used in MVTec evaluation.

    Area under the PRO-vs-FPR curve up to max_fpr, normalized by max_fpr.
    Optimized: stores flat region index lists and evaluates thresholds in a vectorized way.
    """
    from scipy import ndimage

    region_scores: list[np.ndarray] = []
    normal_scores: list[np.ndarray] = []

    for amap, gt in zip(maps, masks):
        amap = np.asarray(amap, dtype=np.float32)
        gt = np.asarray(gt, dtype=bool)
        normal_scores.append(amap[~gt].ravel())
        labeled, nlab = ndimage.label(gt)
        for i in range(1, nlab + 1):
            region_scores.append(amap[labeled == i].ravel())

    if not region_scores:
        return float("nan")
    if not normal_scores or all(len(n) == 0 for n in normal_scores):
        return float("nan")

    normals = np.concatenate(normal_scores)
    # Thresholds from percentiles of all scores (stable, fewer than linspace grid)
    all_scores = np.concatenate([normals] + region_scores)
    if all_scores.size == 0:
        return float("nan")
    qs = np.linspace(0, 100, num_thresholds)
    thresholds = np.unique(np.percentile(all_scores, qs))

    n_normal = float(normals.size)
    fprs = np.empty(len(thresholds), dtype=np.float64)
    pros = np.empty(len(thresholds), dtype=np.float64)

    # Precompute region sizes
    region_sizes = np.array([r.size for r in region_scores], dtype=np.float64)

    for t_idx, thr in enumerate(thresholds):
        fprs[t_idx] = float((normals >= thr).sum()) / n_normal
        overlaps = np.empty(len(region_scores), dtype=np.float64)
        for i, r in enumerate(region_scores):
            overlaps[i] = (r >= thr).sum() / region_sizes[i]
        pros[t_idx] = float(overlaps.mean())

    order = np.argsort(fprs)
    fprs, pros = fprs[order], pros[order]
    mask = fprs <= max_fpr
    if not mask.any():
        return 0.0
    fprs_c = fprs[mask]
    pros_c = pros[mask]
    if fprs_c[0] > 0:
        fprs_c = np.concatenate([[0.0], fprs_c])
        pros_c = np.concatenate([[pros_c[0]], pros_c])
    if fprs_c[-1] < max_fpr:
        fprs_c = np.concatenate([fprs_c, [max_fpr]])
        pros_c = np.concatenate([pros_c, [pros_c[-1]]])
    trapz = getattr(np, "trapezoid", None) or getattr(np, "trapz")
    return float(trapz(pros_c, fprs_c) / max_fpr)


def compute_all_metrics(
    image_scores: Sequence[float],
    image_labels: Sequence[int],
    pixel_maps: Sequence[np.ndarray],
    pixel_masks: Sequence[np.ndarray],
) -> dict[str, float]:
    return {
        "image_auroc": image_auroc(image_scores, image_labels),
        "image_aupr": image_aupr(image_scores, image_labels),
        "pixel_auroc": pixel_auroc(pixel_maps, pixel_masks),
        "pro": compute_pro(pixel_maps, pixel_masks),
    }
