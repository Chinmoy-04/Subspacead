"""Export qualitative figure triplets (image / GT / heatmap)."""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from PIL import Image

from subspacead.backbone import DINOv2Backbone
from subspacead.benchmark import sample_support
from subspacead.cache import FeatureCache
from subspacead.config import load_config, project_root
from subspacead.data import get_samples, list_categories, load_mask, load_pil, test_images, train_images
from subspacead.pipeline import SubspaceAD
from subspacead.scoring import minmax_normalize


def overlay_heatmap(img: np.ndarray, heat: np.ndarray, alpha: float = 0.45) -> np.ndarray:
    """img HxWx3 uint8, heat HxW float — return overlay uint8."""
    import matplotlib

    heat_n = minmax_normalize(heat)
    try:
        cmap = matplotlib.colormaps["jet"]
    except Exception:
        cmap = matplotlib.cm.get_cmap("jet")  # type: ignore[attr-defined]
    colored = (cmap(heat_n)[..., :3] * 255).astype(np.uint8)
    out = (img.astype(np.float32) * (1 - alpha) + colored.astype(np.float32) * alpha).astype(np.uint8)
    return out


def save_triplet(out_path: Path, image: Image.Image, mask: np.ndarray, heat: np.ndarray) -> None:
    img = np.array(image.convert("RGB"))
    # resize heat/mask to image
    if heat.shape[:2] != img.shape[:2]:
        heat_img = Image.fromarray(minmax_normalize(heat))
        heat = np.array(heat_img.resize((img.shape[1], img.shape[0]), Image.BILINEAR))
    if mask.shape[:2] != img.shape[:2]:
        mask = np.array(
            Image.fromarray((mask * 255).astype(np.uint8)).resize(
                (img.shape[1], img.shape[0]), Image.NEAREST
            )
        )
        mask = (mask > 0).astype(np.uint8)

    fig, axes = plt.subplots(1, 3, figsize=(9, 3))
    axes[0].imshow(img)
    axes[0].set_title("Input")
    axes[1].imshow(img)
    axes[1].imshow(mask, cmap="Reds", alpha=0.5)
    axes[1].set_title("Ground truth")
    axes[2].imshow(overlay_heatmap(img, heat))
    axes[2].set_title("Prediction")
    for ax in axes:
        ax.axis("off")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=120, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, default=None)
    parser.add_argument("--datasets", nargs="*", default=["mvtec"])
    parser.add_argument("--categories", nargs="*", default=None)
    parser.add_argument("--k", type=int, default=1)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--per-category", type=int, default=2)
    parser.add_argument("--backbone", type=str, default=None, help="Override backbone for faster figures")
    args = parser.parse_args()

    cfg = load_config(args.config)
    if args.backbone:
        cfg["backbone"] = args.backbone
    root = project_root()
    data_root = root / cfg["paths"]["data_root"]
    out_root = root / "results" / "figures"
    cache = FeatureCache(
        root / cfg["paths"]["cache_root"],
        backbone=cfg["backbone"],
        image_size=cfg["image_size"],
        aggregation=cfg.get("aggregation", "mean"),
    )
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    backbone = DINOv2Backbone(
        name=cfg["backbone"],
        layers=cfg.get("layers"),
        aggregation=cfg.get("aggregation", "mean"),
        device=device,
        dtype=dtype,
    )
    no_rot = set(cfg.get("no_rotation_categories", []))
    failure_cats = {"transistor", "macaroni2", "pcb3"}

    for ds in args.datasets:
        cats = args.categories or list_categories(ds)
        for cat in cats:
            samples = get_samples(data_root, ds, cat)
            train = train_images(samples)
            test = [s for s in test_images(samples) if s.label == 1]
            if not train or not test:
                print(f"Skip {ds}/{cat}: train={len(train)} test_anom={len(test)}")
                continue
            support = sample_support(train, args.k, args.seed, ds, cat)
            ad = SubspaceAD(backbone=backbone, cfg=cfg, cache=cache)
            ad.fit_from_samples(
                support,
                apply_rotation=cat not in no_rot,
                seed=args.seed,
                show_progress=True,
            )
            # Pick a few anomalous test images
            chosen = test[: args.per_category]
            for i, s in enumerate(chosen):
                img = load_pil(s.image_path)
                ow, oh = img.size
                pred = ad.predict_path(s.image_path, out_size_hw=(oh, ow))
                mask = load_mask(s.mask_path, (oh, ow))
                sub = "failures" if cat in failure_cats else "gallery"
                out = out_root / sub / ds / cat / f"{i}.png"
                save_triplet(out, img, mask, pred.pixel_map)
                print(f"Wrote {out}")


if __name__ == "__main__":
    main()
