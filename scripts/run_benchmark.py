"""Run few-shot SubspaceAD benchmark with pause/resume support."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import evaluate_category, sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config, project_root
from subspacead.data import get_samples, list_categories, test_images, train_images
from subspacead.io_utils import atomic_write_json
from subspacead.pipeline import SubspaceAD
from subspacead.runner import RunEngine, WorkUnit, add_run_args, make_unit_id


def build_units(cfg: dict, datasets=None, categories=None, shots=None, seeds=None) -> list[WorkUnit]:
    datasets = datasets or cfg["datasets"]
    shots = shots or cfg["shots"]
    seeds = seeds or cfg["seeds"]
    units = []
    for ds in datasets:
        cats = categories or list_categories(ds)
        for cat in cats:
            for k in shots:
                for seed in seeds:
                    uid = make_unit_id(ds, cat, f"k{k}", f"s{seed}")
                    units.append(
                        WorkUnit(
                            unit_id=uid,
                            payload={
                                "dataset": ds,
                                "category": cat,
                                "k": int(k),
                                "seed": int(seed),
                            },
                        )
                    )
    return units


def main() -> None:
    parser = argparse.ArgumentParser()
    add_run_args(parser)
    parser.add_argument("--datasets", nargs="*", default=None)
    parser.add_argument("--categories", nargs="*", default=None)
    parser.add_argument("--shots", nargs="*", type=int, default=None)
    parser.add_argument("--seeds", nargs="*", type=int, default=None)
    parser.add_argument("--backbone", type=str, default=None)
    args = parser.parse_args()

    cfg = load_config(args.config)
    if args.backbone:
        cfg["backbone"] = args.backbone
    root = project_root()
    data_root = root / cfg["paths"]["data_root"]
    cache_root = root / cfg["paths"]["cache_root"]
    results_root = root / cfg["paths"]["results_root"]
    runs_root = root / cfg["paths"]["runs_root"]

    engine = RunEngine(
        run_id=args.run_id,
        runs_root=runs_root,
        cfg=cfg,
        force=args.force,
        max_hours=args.max_hours,
        until=args.until,
        pause_on_battery=args.pause_on_battery,
    )
    units = build_units(
        cfg,
        datasets=args.datasets,
        categories=args.categories,
        shots=args.shots,
        seeds=args.seeds,
    )
    engine.set_units(units)
    engine.state.meta["kind"] = "benchmark"
    engine.save()

    # Shared backbone + cache across units
    dtype = torch.float16 if cfg.get("dtype") == "float16" and torch.cuda.is_available() else torch.float32
    device = cfg.get("device", "cuda") if torch.cuda.is_available() else "cpu"
    backbone = DINOv2Backbone(
        name=cfg["backbone"],
        layers=cfg.get("layers"),
        aggregation=cfg.get("aggregation", "mean"),
        device=device,
        dtype=dtype,
    )
    cache = FeatureCache(
        cache_root,
        backbone=cfg["backbone"],
        image_size=cfg["image_size"],
        aggregation=cfg.get("aggregation", "mean"),
    )
    no_rot = set(cfg.get("no_rotation_categories", []))

    def worker(unit: WorkUnit, eng: RunEngine) -> dict:
        p = unit.payload
        ds, cat, k, seed = p["dataset"], p["category"], p["k"], p["seed"]
        samples = get_samples(data_root, ds, cat)
        train = train_images(samples)
        test = test_images(samples)
        support = sample_support(train, k, seed, ds, cat)
        ad = SubspaceAD(backbone=backbone, cfg=cfg, cache=cache)
        metrics = evaluate_category(
            ad,
            support,
            test,
            apply_rotation=cat not in no_rot,
            seed=seed,
        )
        out = {
            "dataset": ds,
            "category": cat,
            "k": k,
            "seed": seed,
            "metrics": metrics,
            "n_components": ad.model.n_components if ad.model else None,
            "n_support_views": None,
        }
        out_dir = results_root / ds / f"k{k}" / f"seed{seed}"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{cat}.json"
        atomic_write_json(out_path, out)
        # Save model for seed 0
        if seed == 0 and ad.model is not None:
            model_dir = results_root / "models" / ds / f"k{k}" / cat
            ad.model.save(model_dir)
        print(
            f"[{unit.unit_id}] I-AUROC={metrics['image_auroc']:.1f} "
            f"P-AUROC={metrics['pixel_auroc']:.1f} PRO={metrics['pro']:.1f}",
            flush=True,
        )
        return {"result_path": str(out_path)}

    engine.run(worker)
    prog = engine.progress()
    print(f"Finished with status={engine.state.status}  {prog['done']}/{prog['total']} done")


if __name__ == "__main__":
    main()
