"""Anomaly score aggregation and map post-processing."""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F
from scipy.ndimage import gaussian_filter


def tvar_score(patch_map: np.ndarray | torch.Tensor, rho: float = 0.01) -> float:
    """Mean of the top rho fraction of patch scores (tail VaR)."""
    if isinstance(patch_map, torch.Tensor):
        flat = patch_map.detach().float().cpu().numpy().ravel()
    else:
        flat = np.asarray(patch_map, dtype=np.float64).ravel()
    if flat.size == 0:
        return 0.0
    k = max(1, int(np.ceil(rho * flat.size)))
    # partition so top-k are at the end
    if k >= flat.size:
        return float(flat.mean())
    part = np.partition(flat, -k)
    return float(part[-k:].mean())


def upsample_and_smooth(
    patch_map: np.ndarray | torch.Tensor,
    out_size_hw: tuple[int, int],
    sigma: float = 4.0,
) -> np.ndarray:
    """Bilinear upsample to out_size then Gaussian smooth."""
    if isinstance(patch_map, np.ndarray):
        t = torch.from_numpy(patch_map.astype(np.float32))
    else:
        t = patch_map.detach().float().cpu()
    if t.ndim == 2:
        t = t.unsqueeze(0).unsqueeze(0)
    elif t.ndim == 3:
        t = t.unsqueeze(1)
    h, w = out_size_hw
    up = F.interpolate(t, size=(h, w), mode="bilinear", align_corners=False)
    arr = up.squeeze().numpy()
    if sigma and sigma > 0:
        arr = gaussian_filter(arr, sigma=sigma)
    return arr.astype(np.float32)


def minmax_normalize(arr: np.ndarray) -> np.ndarray:
    lo, hi = float(arr.min()), float(arr.max())
    if hi - lo < 1e-12:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)
