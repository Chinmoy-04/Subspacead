"""Shared benchmark helpers."""

from __future__ import annotations

import hashlib
import random
from typing import Sequence

import numpy as np
from PIL import Image
from tqdm import tqdm

from subspacead.data import Sample, load_mask
from subspacead.metrics import compute_all_metrics
from subspacead.pipeline import SubspaceAD


def stable_seed(*parts: object) -> int:
    """Process-stable seed (unlike Python's salted hash())."""
    blob = "|".join(str(p) for p in parts).encode()
    return int(hashlib.sha256(blob).hexdigest()[:8], 16)


def sample_support(
    train_samples: Sequence[Sample],
    k: int,
    seed: int,
    dataset: str,
    category: str,
) -> list[Sample]:
    h = stable_seed(seed, dataset, category, k)
    rng = random.Random(h)
    pool = list(train_samples)
    if k > len(pool):
        raise ValueError(f"Need {k} train images, found {len(pool)} for {category}")
    return rng.sample(pool, k)


def evaluate_category(
    ad: SubspaceAD,
    support: Sequence[Sample],
    test_samples: Sequence[Sample],
    apply_rotation: bool,
    seed: int,
) -> dict[str, float]:
    ad.fit_from_samples(support, apply_rotation=apply_rotation, seed=seed, show_progress=True)
    image_scores: list[float] = []
    image_labels: list[int] = []
    pixel_maps: list[np.ndarray] = []
    pixel_masks: list[np.ndarray] = []
    for s in tqdm(test_samples, desc="test", leave=False):
        with Image.open(s.image_path) as im:
            ow, oh = im.size
        result = ad.predict_path(s.image_path, out_size_hw=(oh, ow))
        image_scores.append(result.image_score)
        image_labels.append(s.label)
        mask = (
            load_mask(s.mask_path, (oh, ow))
            if s.label == 1
            else np.zeros((oh, ow), dtype=np.uint8)
        )
        pixel_maps.append(result.pixel_map)
        pixel_masks.append(mask)
    metrics = compute_all_metrics(image_scores, image_labels, pixel_maps, pixel_masks)
    return {k: (float(v) * 100.0 if v == v else float("nan")) for k, v in metrics.items()}
