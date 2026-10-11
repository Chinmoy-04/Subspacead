"""On-disk feature cache (fp16) keyed by image path and optional rotation angle."""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import torch

from subspacead.io_utils import atomic_save_npy


def _key(path: str | Path, angle: float = 0.0, tag: str = "") -> str:
    raw = f"{Path(path).resolve()}|{angle:.4f}|{tag}"
    return hashlib.sha1(raw.encode()).hexdigest()


class FeatureCache:
    def __init__(self, root: Path | str, backbone: str, image_size: int, aggregation: str) -> None:
        self.root = Path(root) / f"{backbone}_s{image_size}_{aggregation}"
        self.root.mkdir(parents=True, exist_ok=True)

    def path_for(self, image_path: str | Path, angle: float = 0.0) -> Path:
        return self.root / f"{_key(image_path, angle)}.npy"

    def has(self, image_path: str | Path, angle: float = 0.0) -> bool:
        return self.path_for(image_path, angle).exists()

    def load(self, image_path: str | Path, angle: float = 0.0) -> np.ndarray | None:
        p = self.path_for(image_path, angle)
        if not p.exists():
            return None
        return np.load(p)

    def save(self, image_path: str | Path, feats: np.ndarray | torch.Tensor, angle: float = 0.0) -> Path:
        if isinstance(feats, torch.Tensor):
            arr = feats.detach().float().cpu().numpy()
        else:
            arr = np.asarray(feats)
        # Store fp16 to save disk
        arr16 = arr.astype(np.float16)
        p = self.path_for(image_path, angle)
        atomic_save_npy(p, arr16)
        return p
