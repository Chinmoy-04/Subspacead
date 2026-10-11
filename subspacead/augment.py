"""Augmentations for few-shot support sets."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np
from PIL import Image


def rotation_angles(
    n_augmentations: int = 30,
    step: int = 15,
    rng: np.random.Generator | None = None,
) -> list[float]:
    """
    Sample n_augmentations rotation angles in [0, 345].

    Uses a 15-degree grid by default (matching the paper's 0..345 wording)
    so features can be cached per (image, angle) across seeds.
    """
    grid = list(range(0, 360, step))
    if 0 not in grid:
        grid.insert(0, 0)
    # Drop 360 if present; max is 345 when step=15
    grid = [a for a in grid if a < 360]
    if rng is None:
        # Deterministic take of first n (excluding 0 which is the original)
        extras = [a for a in grid if a != 0][:n_augmentations]
        return extras
    extras = [a for a in grid if a != 0]
    if n_augmentations >= len(extras):
        # With replacement if needed
        return list(rng.choice(extras, size=n_augmentations, replace=True))
    return list(rng.choice(extras, size=n_augmentations, replace=False))


def rotate_image(img: Image.Image, angle: float, fill: int = 0) -> Image.Image:
    """Rotate PIL image counterclockwise by angle degrees; expand=False keeps size."""
    if abs(angle) < 1e-6:
        return img.copy()
    return img.rotate(angle, resample=Image.BILINEAR, expand=False, fillcolor=(fill, fill, fill))


def make_support_views(
    images: Sequence[Image.Image],
    n_augmentations: int = 30,
    step: int = 15,
    apply_rotation: bool = True,
    seed: int = 0,
) -> list[tuple[Image.Image, float]]:
    """
    Return list of (image, angle) including originals at angle 0.

    Total views = len(images) * (1 + n_augmentations) when rotation is on,
    else just the originals.
    """
    views: list[tuple[Image.Image, float]] = []
    for i, img in enumerate(images):
        views.append((img, 0.0))
        if not apply_rotation or n_augmentations <= 0:
            continue
        rng = np.random.default_rng(seed + i * 10007)
        angles = rotation_angles(n_augmentations, step=step, rng=rng)
        for a in angles:
            views.append((rotate_image(img, float(a)), float(a)))
    return views
