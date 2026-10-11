"""Ablation experiments with pause/resume."""

from __future__ import annotations

import argparse
import copy
from pathlib import Path

import numpy as np
import torch

from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import evaluate_category, sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config, project_root
from subspacead.data import get_samples, list_categories, load_mask, test_images, train_images
from subspacead.io_utils import atomic_write_json
from subspacead.pipeline import SubspaceAD
from subspacead.runner import RunEngine, WorkUnit, add_run_args, make_unit_id


def main() -> None:
    parser = argparse.ArgumentParser()
    add_run_args(parser)
    parser.add_argument(
        "--ablation",
        choices=["layers", "tau", "backbone", "resolution", "batched0", "all"],
        default="all",
    )
    parser.add_argument("--datasets", nargs="*", default=None)
    args = parser.parse_args()

    base_cfg = load_config(args.config)
    root = project_root()
    data_root = root / base_cfg["paths"]["data_root"]
    cache_root = root / base_cfg["paths"]["cache_root"]
    results_root = root / base_cfg["paths"]["results_root"] / "ablations"
    runs_root = root / base_cfg["paths"]["runs_root"]

    datasets = args.datasets or base_cfg["datasets"]
    units: list[WorkUnit] = []

    def add(ablation: str, variant: str, payload: dict):
        uid = make_unit_id(ablation, variant, payload["dataset"], payload["category"])
        units.append(WorkUnit(unit_id=uid, payload={**payload, "ablation": ablation, "variant": variant}))

    # Layer aggregation — Table 3, 4-shot, mean over categories later
    if args.ablation in ("layers", "all"):
        for agg in ["mean", "final7", "concat", "last"]:
            for ds in datasets:
                for cat in list_categories(ds):
                    add("layers", agg, {"dataset": ds, "category": cat, "k": 4, "seed": 0, "aggregation": agg})

    if args.ablation in ("tau", "all"):
        for tau in [0.95, 0.96, 0.97, 0.99, 1.0]:
            for ds in datasets:
                for cat in list_categories(ds):
                    for k in [1, 2, 4]:
                        add(
                            "tau",
                            f"{tau}",
                            {"dataset": ds, "category": cat, "k": k, "seed": 0, "tau": tau},
                        )

    if args.ablation in ("backbone", "all"):
        for bb in ["dinov2_vits14", "dinov2_vitb14", "dinov2_vitl14", "dinov2_vitg14"]:
            for ds in datasets:
                for cat in list_categories(ds):
                    for k in [1, 2, 4]:
                        add(
                            "backbone",
                            bb,
                            {"dataset": ds, "category": cat, "k": k, "seed": 0, "backbone": bb},
                        )

    if args.ablation in ("resolution", "all"):
        for res in [448, 672]:
            for ds in datasets:
                for cat in list_categories(ds):
                    for k in [1, 2, 4]:
                        add(
                            "resolution",
                            str(res),
                            {"dataset": ds, "category": cat, "k": k, "seed": 0, "image_size": res},
                        )

    if args.ablation in ("batched0", "all"):
        for ds in datasets:
            for cat in list_categories(ds):
                add("batched0", "default", {"dataset": ds, "category": cat, "k": 0, "seed": 0})

    engine = RunEngine(
        run_id=args.run_id,
        runs_root=runs_root,
        cfg=base_cfg,
        force=args.force,
        max_hours=args.max_hours,
        until=args.until,
        pause_on_battery=args.pause_on_battery,
    )
    engine.set_units(units)
    engine.state.meta["kind"] = "ablations"
    engine.save()

    backbone_cache: dict[str, DINOv2Backbone] = {}
    no_rot = set(base_cfg.get("no_rotation_categories", []))

    def get_backbone(cfg: dict) -> DINOv2Backbone:
        key = f"{cfg['backbone']}|{cfg.get('aggregation','mean')}|{cfg.get('layers')}"
        if key not in backbone_cache:
            dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            device = "cuda" if torch.cuda.is_available() else "cpu"
            backbone_cache[key] = DINOv2Backbone(
                name=cfg["backbone"],
                layers=cfg.get("layers"),
                aggregation=cfg.get("aggregation", "mean"),
                device=device,
                dtype=dtype,
            )
        return backbone_cache[key]

    def worker(unit: WorkUnit, eng: RunEngine) -> dict:
        p = unit.payload
        cfg = copy.deepcopy(base_cfg)
        for key in ("backbone", "aggregation", "tau", "image_size"):
            if key in p:
                cfg[key] = p[key]
        # Adjust layers for aggregation variants
        if p.get("ablation") == "layers":
            cfg["aggregation"] = p["aggregation"]
        # Backbone ablation: drop Giant's absolute [21..27] so resolve_layers()
        # picks relative middle/last-7 for S/B/L (12/12/24 blocks).
        if p.get("ablation") == "backbone":
            cfg["layers"] = None

        ds, cat = p["dataset"], p["category"]
        samples = get_samples(data_root, ds, cat)
        test = test_images(samples)
        # Only persist the default mean@672@primary-backbone cache. Other ablation
        # variants (concat/last/final7, other resolutions/backbones) are one-off and
        # would refill the disk; extract on the fly instead.
        use_disk_cache = (
            cfg.get("aggregation", "mean") == "mean"
            and cfg.get("backbone") == base_cfg.get("backbone")
            and int(cfg.get("image_size", 672)) == int(base_cfg.get("image_size", 672))
        )
        cache = (
            FeatureCache(
                cache_root,
                backbone=cfg["backbone"],
                image_size=cfg["image_size"],
                aggregation=cfg.get("aggregation", "mean"),
            )
            if use_disk_cache
            else None
        )
        # Concat features are wide (D~10k); keep extraction batch size at 1.
        if cfg.get("aggregation") == "concat":
            cfg["batch_size"] = 1
        ad = SubspaceAD(backbone=get_backbone(cfg), cfg=cfg, cache=cache)

        if p.get("ablation") == "batched0":
            # Fit PCA on all test patches (assuming majority normal)
            from PIL import Image

            feats = []
            for s in test:
                feats.append(ad.extract_cached(s.image_path))
            X = np.stack(feats, axis=0)
            from subspacead.model import SubspaceModel

            ad.model = SubspaceModel(tau=cfg["tau"], device=ad.device)
            ad.model.fit(X)
            image_scores, image_labels, pixel_maps, pixel_masks = [], [], [], []
            for s in test:
                with Image.open(s.image_path) as im:
                    ow, oh = im.size
                result = ad.predict_path(s.image_path, out_size_hw=(oh, ow))
                image_scores.append(result.image_score)
                image_labels.append(s.label)
                mask = load_mask(s.mask_path, (oh, ow)) if s.label == 1 else np.zeros((oh, ow), dtype=np.uint8)
                pixel_maps.append(result.pixel_map)
                pixel_masks.append(mask)
            from subspacead.metrics import compute_all_metrics

            metrics = compute_all_metrics(image_scores, image_labels, pixel_maps, pixel_masks)
            metrics = {k: float(v) * 100.0 if v == v else float("nan") for k, v in metrics.items()}
        else:
            train = train_images(samples)
            k = int(p["k"])
            seed = int(p["seed"])
            support = sample_support(train, k, seed, ds, cat)
            metrics = evaluate_category(
                ad,
                support,
                test,
                apply_rotation=cat not in no_rot,
                seed=seed,
            )

        out = {
            "ablation": p["ablation"],
            "variant": p["variant"],
            "dataset": ds,
            "category": cat,
            "k": p.get("k"),
            "seed": p.get("seed", 0),
            "metrics": metrics,
        }
        out_dir = results_root / p["ablation"] / str(p["variant"]) / ds
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{cat}_k{p.get('k', 0)}.json"
        atomic_write_json(out_path, out)
        print(f"[{unit.unit_id}] I-AUROC={metrics['image_auroc']:.1f}", flush=True)
        return {"result_path": str(out_path)}

    engine.run(worker)
    print(f"Ablations status={engine.state.status}")


if __name__ == "__main__":
    main()
