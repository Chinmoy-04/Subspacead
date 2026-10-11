"""Smoke test: bottle + screw 1-shot vs paper Table 5."""

from __future__ import annotations

import argparse
import time

import torch

from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import evaluate_category, sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config, project_root
from subspacead.data import get_samples, test_images, train_images
from subspacead.paper_reference import PAPER_MVTEC_1SHOT
from subspacead.pipeline import SubspaceAD


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--categories", nargs="*", default=["bottle", "screw"])
    parser.add_argument("--backbone", type=str, default=None)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    cfg = load_config()
    if args.backbone:
        cfg["backbone"] = args.backbone
    root = project_root()
    data_root = root / cfg["paths"]["data_root"]

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device={device} dtype={dtype} backbone={cfg['backbone']}")

    t0 = time.time()
    backbone = DINOv2Backbone(
        name=cfg["backbone"],
        layers=cfg.get("layers"),
        aggregation=cfg.get("aggregation", "mean"),
        device=device,
        dtype=dtype,
    )
    print(f"Backbone loaded in {time.time() - t0:.1f}s")

    cache = FeatureCache(
        root / cfg["paths"]["cache_root"],
        backbone=cfg["backbone"],
        image_size=cfg["image_size"],
        aggregation=cfg.get("aggregation", "mean"),
    )
    no_rot = set(cfg.get("no_rotation_categories", []))

    # Time one forward
    from PIL import Image
    import numpy as np
    from subspacead.data import build_transform

    tf = build_transform(cfg["image_size"])
    dummy = Image.fromarray(np.zeros((cfg["image_size"], cfg["image_size"], 3), dtype=np.uint8))
    x = tf(dummy).unsqueeze(0)
    if device == "cuda":
        torch.cuda.synchronize()
    t1 = time.time()
    _ = backbone.extract(x)
    if device == "cuda":
        torch.cuda.synchronize()
    print(f"Single-image forward: {(time.time() - t1)*1000:.0f} ms")

    for cat in args.categories:
        samples = get_samples(data_root, "mvtec", cat)
        train = train_images(samples)
        test = test_images(samples)
        print(f"\n=== {cat}: train={len(train)} test={len(test)} ===")
        if len(train) < 1:
            print("SKIP — no train data")
            continue
        support = sample_support(train, 1, args.seed, "mvtec", cat)
        ad = SubspaceAD(backbone=backbone, cfg=cfg, cache=cache)
        t2 = time.time()
        metrics = evaluate_category(
            ad,
            support,
            test,
            apply_rotation=cat not in no_rot,
            seed=args.seed,
        )
        elapsed = time.time() - t2
        paper = PAPER_MVTEC_1SHOT.get(cat, {})
        print(f"Elapsed {elapsed:.1f}s")
        for m in ["image_auroc", "image_aupr", "pixel_auroc", "pro"]:
            o = metrics.get(m, float("nan"))
            p = paper.get(m)
            delta = f"  paper={p:.1f}  d={o-p:+.1f}" if p is not None else ""
            print(f"  {m}: {o:.1f}{delta}")


if __name__ == "__main__":
    main()
