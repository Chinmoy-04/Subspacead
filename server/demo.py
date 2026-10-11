"""Live demo service: backbone cache, few-shot fit, per-image scoring."""

from __future__ import annotations

import tempfile
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image

from server.utils import ROOT, colored_heatmap, overlay, to_data_url
from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config
from subspacead.data import (
    Sample,
    get_samples,
    list_categories,
    load_mask,
    load_pil,
    test_images,
    train_images,
)
from subspacead.pipeline import SubspaceAD

MAX_SESSIONS = 2
MAX_BACKBONES = 2

CFG = load_config()
DATA_ROOT = ROOT / CFG["paths"]["data_root"]


class DemoError(ValueError):
    """User-facing error (bad parameters or missing data)."""


@dataclass
class Session:
    ad: SubspaceAD
    settings: dict[str, Any]
    support: list[Sample]
    created: float = field(default_factory=time.time)


@lru_cache(maxsize=64)
def _samples(dataset: str, category: str) -> tuple[Sample, ...]:
    return tuple(get_samples(DATA_ROOT, dataset, category))  # type: ignore[arg-type]


def available_categories(dataset: str) -> list[str]:
    cats = list_categories(dataset)  # type: ignore[arg-type]
    existing = [c for c in cats if (DATA_ROOT / dataset / c).exists()]
    if dataset == "visa" and not existing and (DATA_ROOT / "visa").exists():
        existing = cats
    return existing


def split_lists(dataset: str, category: str) -> dict[str, list[Sample]]:
    _check_dataset(dataset, category)
    samples = list(_samples(dataset, category))
    tests = test_images(samples)
    return {
        "train": train_images(samples),
        "anomalous": [s for s in tests if s.label == 1],
        "normal": [s for s in tests if s.label == 0],
    }


def _check_dataset(dataset: str, category: str) -> None:
    if dataset not in ("mvtec", "visa"):
        raise DemoError(f"Unknown dataset '{dataset}'")
    if category not in list_categories(dataset):  # type: ignore[arg-type]
        raise DemoError(f"Unknown category '{category}' for {dataset}")


def _defect(sample: Sample) -> str:
    return sample.image_path.parent.name


def describe_test_images(dataset: str, category: str) -> dict[str, list[dict[str, Any]]]:
    lists = split_lists(dataset, category)
    out: dict[str, list[dict[str, Any]]] = {}
    for kind in ("anomalous", "normal"):
        out[kind] = [
            {
                "index": i,
                "name": s.image_path.name,
                "defect": _defect(s),
                "has_mask": bool(s.mask_path),
                "url": f"/api/images/{dataset}/{category}/{kind}/{i}",
            }
            for i, s in enumerate(lists[kind])
        ]
    return out


def image_path(dataset: str, category: str, kind: str, index: int) -> Path:
    lists = split_lists(dataset, category)
    if kind not in lists:
        raise DemoError(f"Unknown image kind '{kind}'")
    pool = lists[kind]
    if not 0 <= index < len(pool):
        raise DemoError(f"Index {index} out of range for {kind} ({len(pool)})")
    return pool[index].image_path


class DemoService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._backbones: OrderedDict[str, DINOv2Backbone] = OrderedDict()
        self._sessions: OrderedDict[str, Session] = OrderedDict()

    @property
    def device(self) -> str:
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _backbone(self, name: str) -> DINOv2Backbone:
        if name in self._backbones:
            self._backbones.move_to_end(name)
            return self._backbones[name]
        while len(self._backbones) >= MAX_BACKBONES:
            self._backbones.popitem(last=False)
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        bb = DINOv2Backbone(name=name, device=self.device, dtype=dtype, layers=None)
        self._backbones[name] = bb
        return bb

    def _store(self, session: Session) -> str:
        sid = uuid.uuid4().hex[:12]
        while len(self._sessions) >= MAX_SESSIONS:
            self._sessions.popitem(last=False)
        self._sessions[sid] = session
        return sid

    def get(self, sid: str) -> Session:
        sess = self._sessions.get(sid)
        if sess is None:
            raise DemoError("Session expired — fit the subspace again.")
        self._sessions.move_to_end(sid)
        return sess

    def fit(
        self,
        *,
        backbone: str,
        dataset: str,
        category: str,
        k: int,
        seed: int,
        image_size: int,
        n_aug: int,
        uploads: list[bytes],
    ) -> dict[str, Any]:
        _check_dataset(dataset, category)
        if k not in (1, 2, 4):
            raise DemoError("k must be 1, 2 or 4")
        if image_size not in (448, 672):
            raise DemoError("Resolution must be 448 or 672")
        n_aug = max(0, min(30, int(n_aug)))

        local_cfg = dict(CFG)
        local_cfg.update(backbone=backbone, image_size=image_size, n_augmentations=n_aug, layers=None)

        if uploads:
            tmpdir = Path(tempfile.mkdtemp(prefix="subspacead_web_"))
            support: list[Sample] = []
            for i, raw in enumerate(uploads[:k]):
                p = tmpdir / f"n_{i}.png"
                Image.open(_bytes_io(raw)).convert("RGB").save(p)
                support.append(Sample(p, None, 0, category, "train"))
        else:
            train = split_lists(dataset, category)["train"]
            if len(train) < k:
                raise DemoError(f"Only {len(train)} train images for {category}. Download the dataset first.")
            support = sample_support(train, k, int(seed), dataset, category)

        no_rot = category in set(CFG.get("no_rotation_categories", [])) or n_aug <= 0
        t0 = time.perf_counter()
        with self._lock:
            bb = self._backbone(backbone)
            use_disk = backbone == CFG.get("backbone") and image_size == int(CFG.get("image_size", 672))
            cache = (
                FeatureCache(
                    ROOT / CFG["paths"]["cache_root"],
                    backbone=backbone,
                    image_size=image_size,
                    aggregation=local_cfg.get("aggregation", "mean"),
                )
                if use_disk and not uploads
                else None
            )
            ad = SubspaceAD(backbone=bb, cfg=local_cfg, cache=cache)
            model = ad.fit_from_samples(support, apply_rotation=not no_rot, seed=int(seed), show_progress=False)
        elapsed = time.perf_counter() - t0

        settings = {
            "backbone": backbone,
            "dataset": dataset,
            "category": category,
            "k": k,
            "seed": seed,
            "image_size": image_size,
            "n_aug": 0 if no_rot else n_aug,
            "rotation": not no_rot,
            "uploaded": bool(uploads),
        }
        sid = self._store(Session(ad=ad, settings=settings, support=support))

        evr = model.explained_variance_ratio
        cumulative = np.cumsum(evr)[: max(model.n_components + 8, 24)].round(5).tolist() if evr is not None else []
        n_views = len(support) * (1 + settings["n_aug"])
        return {
            "session_id": sid,
            "settings": settings,
            "n_components": int(model.n_components),
            "n_views": n_views,
            "feature_dim": int(getattr(bb, "out_dim", 0) or 0),
            "tau": float(local_cfg["tau"]),
            "rho": float(local_cfg.get("rho", 0.01)),
            "cumulative_variance": cumulative,
            "support": [to_data_url(load_pil(s.image_path), "JPEG", max_side=320) for s in support],
            "elapsed_s": round(elapsed, 2),
            "device": self.device,
        }

    def score(self, *, session_id: str, source: str, index: int, upload: bytes | None) -> dict[str, Any]:
        sess = self.get(session_id)
        ds, cat = sess.settings["dataset"], sess.settings["category"]

        if source == "upload":
            if not upload:
                raise DemoError("No test image uploaded.")
            test_img = Image.open(_bytes_io(upload)).convert("RGB")
            mask = np.zeros((test_img.size[1], test_img.size[0]), dtype=np.uint8)
            name, defect, has_mask = "upload", "upload", False
        elif source in ("anomalous", "normal"):
            pool = split_lists(ds, cat)[source]
            if not pool:
                raise DemoError(f"No {source} test images in this split.")
            s = pool[max(0, min(int(index), len(pool) - 1))]
            test_img = load_pil(s.image_path)
            ow, oh = test_img.size
            has_mask = source == "anomalous" and bool(s.mask_path)
            mask = load_mask(s.mask_path, (oh, ow)) if has_mask else np.zeros((oh, ow), dtype=np.uint8)
            name, defect = s.image_path.name, _defect(s)
        else:
            raise DemoError(f"Unknown source '{source}'")

        ow, oh = test_img.size
        t0 = time.perf_counter()
        with self._lock:
            pred = sess.ad.predict_image(test_img, out_size_hw=(oh, ow))
        elapsed = time.perf_counter() - t0

        img_np = np.asarray(test_img)
        hist, edges = np.histogram(pred.patch_map.ravel(), bins=40)
        return {
            "image_score": float(pred.image_score),
            "patch_max": float(pred.patch_map.max()),
            "patch_mean": float(pred.patch_map.mean()),
            "source": source,
            "name": name,
            "defect": defect,
            "has_mask": has_mask,
            "size": [ow, oh],
            "elapsed_s": round(elapsed, 3),
            "images": {
                "input": to_data_url(img_np, "JPEG", max_side=640),
                "mask": to_data_url((mask * 255).astype(np.uint8), "PNG", max_side=640),
                "heatmap": to_data_url(colored_heatmap(pred.pixel_map), "JPEG", max_side=640),
                "overlay": to_data_url(overlay(img_np, pred.pixel_map), "JPEG", max_side=640),
            },
            "histogram": {"counts": hist.astype(int).tolist(), "edges": edges.round(6).tolist()},
        }


def _bytes_io(raw: bytes):
    import io

    return io.BytesIO(raw)
