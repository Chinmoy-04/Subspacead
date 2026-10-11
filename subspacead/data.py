"""Dataset loaders for MVTec-AD and VisA."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

DatasetName = Literal["mvtec", "visa"]

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

MVTEC_CATEGORIES = [
    "bottle",
    "cable",
    "capsule",
    "carpet",
    "grid",
    "hazelnut",
    "leather",
    "metal_nut",
    "pill",
    "screw",
    "tile",
    "toothbrush",
    "transistor",
    "wood",
    "zipper",
]

VISA_CATEGORIES = [
    "candle",
    "capsules",
    "cashew",
    "chewinggum",
    "fryum",
    "macaroni1",
    "macaroni2",
    "pcb1",
    "pcb2",
    "pcb3",
    "pcb4",
    "pipe_fryum",
]


@dataclass
class Sample:
    image_path: Path
    mask_path: Path | None
    label: int  # 0 normal, 1 anomalous
    category: str
    split: str  # train | test


def build_transform(image_size: int = 672) -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize(
                (image_size, image_size),
                interpolation=transforms.InterpolationMode.BICUBIC,
            ),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def load_pil(path: Path | str) -> Image.Image:
    return Image.open(path).convert("RGB")


def load_mask(path: Path | str | None, size_hw: tuple[int, int] | None = None) -> np.ndarray:
    """Return binary mask HxW uint8 {0,1}. All-zero if path is None."""
    if path is None or not Path(path).exists():
        if size_hw is None:
            raise ValueError("size_hw required when mask is missing")
        return np.zeros(size_hw, dtype=np.uint8)
    m = Image.open(path).convert("L")
    if size_hw is not None:
        h, w = size_hw
        m = m.resize((w, h), Image.NEAREST)
    arr = np.array(m)
    return (arr > 0).astype(np.uint8)


def discover_mvtec(root: Path, category: str) -> list[Sample]:
    cat = root / category
    samples: list[Sample] = []
    train_good = cat / "train" / "good"
    for p in sorted(train_good.glob("*")):
        if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".bmp"}:
            samples.append(Sample(p, None, 0, category, "train"))
    test_root = cat / "test"
    gt_root = cat / "ground_truth"
    for defect_dir in sorted(test_root.iterdir()):
        if not defect_dir.is_dir():
            continue
        label = 0 if defect_dir.name == "good" else 1
        for p in sorted(defect_dir.glob("*")):
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp"}:
                continue
            mask = None
            if label == 1:
                cand = gt_root / defect_dir.name / f"{p.stem}_mask.png"
                if not cand.exists():
                    cand = gt_root / defect_dir.name / f"{p.stem}.png"
                mask = cand if cand.exists() else None
            samples.append(Sample(p, mask, label, category, "test"))
    return samples


def _visa_category_match(obj: str, category: str) -> bool:
    a = obj.lower().replace(" ", "").replace("_", "")
    b = category.lower().replace(" ", "").replace("_", "")
    return a == b


def discover_visa(root: Path, category: str, split_csv: Path | None = None) -> list[Sample]:
    """
    VisA 1-class layout via split CSV (preferred) or folder fallback.
    """
    samples: list[Sample] = []
    csv_path = split_csv or (root / "split_csv" / "1cls.csv")
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        cols = {c.lower(): c for c in df.columns}
        obj_col = cols.get("object") or cols.get("category") or list(df.columns)[0]
        split_col = cols.get("split")
        label_col = cols.get("label")
        img_col = cols.get("image") or cols.get("image_path")
        mask_col = cols.get("mask") or cols.get("mask_path")
        for _, row in df.iterrows():
            obj = str(row[obj_col])
            if not _visa_category_match(obj, category):
                continue
            split = str(row[split_col]).lower() if split_col else "test"
            lab_raw = str(row[label_col]).lower() if label_col else "normal"
            label = 0 if lab_raw in {"normal", "good", "0", "ok"} else 1
            img = root / str(row[img_col])
            mask = None
            if mask_col is not None and pd.notna(row[mask_col]) and str(row[mask_col]).strip():
                mp = root / str(row[mask_col])
                mask = mp if label == 1 else None
            samples.append(
                Sample(img, mask, label, category, "train" if split == "train" else "test")
            )
        if samples:
            return samples

    cat_dir = root / category
    # Folder fallback: treat all Normal as train; Anomaly as test; also add Normal to test
    normal_dirs = [
        cat_dir / "Data" / "Images" / "Normal",
        cat_dir / "Images" / "Normal",
    ]
    anomaly_dirs = [
        cat_dir / "Data" / "Images" / "Anomaly",
        cat_dir / "Images" / "Anomaly",
    ]
    mask_roots = [
        cat_dir / "Data" / "Masks" / "Anomaly",
        cat_dir / "Masks",
    ]
    for nd in normal_dirs:
        if not nd.exists():
            continue
        for p in sorted(nd.rglob("*")):
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp"}:
                continue
            samples.append(Sample(p, None, 0, category, "train"))
            samples.append(Sample(p, None, 0, category, "test"))
        break
    for ad in anomaly_dirs:
        if not ad.exists():
            continue
        for p in sorted(ad.rglob("*")):
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".bmp"}:
                continue
            mask = None
            for mroot in mask_roots:
                if not mroot.exists():
                    continue
                try:
                    rel = p.relative_to(ad)
                    cand = mroot / rel
                except ValueError:
                    cand = mroot / f"{p.stem}.png"
                if cand.exists():
                    mask = cand
                    break
                alt = mroot / f"{p.stem}.png"
                if alt.exists():
                    mask = alt
                    break
            samples.append(Sample(p, mask, 1, category, "test"))
        break
    return samples


def list_categories(dataset: DatasetName) -> list[str]:
    return list(MVTEC_CATEGORIES if dataset == "mvtec" else VISA_CATEGORIES)


def get_samples(data_root: Path | str, dataset: DatasetName, category: str) -> list[Sample]:
    root = Path(data_root) / dataset
    if dataset == "mvtec":
        return discover_mvtec(root, category)
    return discover_visa(root, category)


def train_images(samples: list[Sample]) -> list[Sample]:
    return [s for s in samples if s.split == "train" and s.label == 0]


def test_images(samples: list[Sample]) -> list[Sample]:
    return [s for s in samples if s.split == "test"]


class AnomalyDataset(Dataset):
    def __init__(
        self,
        samples: list[Sample],
        image_size: int = 672,
        return_mask: bool = True,
    ) -> None:
        self.samples = samples
        self.tf = build_transform(image_size)
        self.image_size = image_size
        self.return_mask = return_mask

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        s = self.samples[idx]
        img = load_pil(s.image_path)
        tensor = self.tf(img)
        if not self.return_mask:
            return tensor, s.label, str(s.image_path)
        mask = load_mask(s.mask_path, (self.image_size, self.image_size))
        return tensor, mask, s.label, str(s.image_path)
