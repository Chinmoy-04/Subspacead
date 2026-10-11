"""High-level SubspaceAD fit / predict pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import torch
from PIL import Image
from tqdm import tqdm

from subspacead.augment import rotate_image, rotation_angles
from subspacead.backbone import DINOv2Backbone
from subspacead.cache import FeatureCache
from subspacead.data import Sample, build_transform, load_pil
from subspacead.model import SubspaceModel
from subspacead.scoring import minmax_normalize, tvar_score, upsample_and_smooth


@dataclass
class PredictResult:
    image_score: float
    patch_map: np.ndarray
    pixel_map: np.ndarray
    pixel_map_norm: np.ndarray


class SubspaceAD:
    def __init__(
        self,
        backbone: DINOv2Backbone | None = None,
        cfg: dict[str, Any] | None = None,
        cache: FeatureCache | None = None,
    ) -> None:
        self.cfg = cfg or {}
        self.backbone = backbone
        self.cache = cache
        self.model: SubspaceModel | None = None
        self.image_size = int(self.cfg.get("image_size", 672))
        self.tau = float(self.cfg.get("tau", 0.99))
        self.rho = float(self.cfg.get("rho", 0.01))
        self.sigma = float(self.cfg.get("gaussian_sigma", 4.0))
        self.n_aug = int(self.cfg.get("n_augmentations", 30))
        self.rot_step = int(self.cfg.get("rotation_step", 15))
        self.batch_size = int(self.cfg.get("batch_size", 2))
        self.tf = build_transform(self.image_size)
        device = self.cfg.get("device", "cuda")
        if device == "cuda" and not torch.cuda.is_available():
            device = "cpu"
        self.device = device

    def _ensure_backbone(self) -> DINOv2Backbone:
        if self.backbone is None:
            dtype = torch.float16 if self.cfg.get("dtype", "float16") == "float16" else torch.float32
            if self.device == "cpu":
                dtype = torch.float32
            self.backbone = DINOv2Backbone(
                name=self.cfg.get("backbone", "dinov2_vitg14"),
                layers=self.cfg.get("layers"),
                aggregation=self.cfg.get("aggregation", "mean"),
                device=self.device,
                dtype=dtype,
            )
        return self.backbone

    def _extract_batch(self, images: list[Image.Image]) -> np.ndarray:
        bb = self._ensure_backbone()
        tensors = torch.stack([self.tf(im) for im in images], dim=0)
        feats = bb.extract(tensors)
        return feats.numpy()

    def extract_cached(
        self,
        image_path: Path | str,
        angle: float = 0.0,
        image: Image.Image | None = None,
    ) -> np.ndarray:
        if self.cache is not None:
            hit = self.cache.load(image_path, angle)
            if hit is not None:
                return hit.astype(np.float32)
        if image is None:
            image = load_pil(image_path)
        if abs(angle) > 1e-6:
            image = rotate_image(image, angle)
        feats = self._extract_batch([image])[0]
        if self.cache is not None:
            self.cache.save(image_path, feats, angle)
        return feats

    def fit_from_samples(
        self,
        support: Sequence[Sample],
        apply_rotation: bool = True,
        seed: int = 0,
        show_progress: bool = True,
    ) -> SubspaceModel:
        import tempfile

        images = [load_pil(s.image_path) for s in support]
        paths = [s.image_path for s in support]

        view_specs: list[tuple[Path, float, Image.Image]] = []
        for i, img in enumerate(images):
            view_specs.append((paths[i], 0.0, img))
            if not apply_rotation or self.n_aug <= 0:
                continue
            rng = np.random.default_rng(seed + i * 10007)
            angles = rotation_angles(self.n_aug, step=self.rot_step, rng=rng)
            for a in angles:
                view_specs.append((paths[i], float(a), img))

        # Probe shape from cache or a single extract
        probe = None
        for p, ang, _img in view_specs:
            if self.cache is not None and self.cache.has(p, ang):
                probe = self.cache.load(p, ang)
                break
        if probe is None:
            p0, ang0, img0 = view_specs[0]
            im0 = img0 if abs(ang0) < 1e-6 else rotate_image(img0, ang0)
            probe = self._extract_batch([im0])[0]
            if self.cache is not None:
                self.cache.save(p0, probe, ang0)

        h, w, d = (int(x) for x in probe.shape)
        n_views = len(view_specs)
        n_patches = n_views * h * w
        # Concat D~10752 cannot live as a full float32 stack in RAM.
        use_memmap = d > 2048 or n_patches * d * 4 > 1_500_000_000
        mm_path = None
        if use_memmap:
            # Keep large feature memmaps on the project drive (D:), not %TEMP% on C:.
            tmp_dir = Path(self.cfg.get("paths", {}).get("tmp_root", "D:/SubspaceAD/.tmp"))
            tmp_dir.mkdir(parents=True, exist_ok=True)
            tmp = tempfile.NamedTemporaryFile(
                prefix="subspacead_feats_", suffix=".dat", delete=False, dir=str(tmp_dir)
            )
            tmp.close()
            mm_path = tmp.name
            X: np.ndarray = np.memmap(mm_path, dtype=np.float16, mode="w+", shape=(n_patches, d))
        else:
            X = np.empty((n_patches, d), dtype=np.float32)

        def _write_view(view_idx: int, feats_hw: np.ndarray) -> None:
            flat = np.asarray(feats_hw, dtype=np.float32).reshape(-1, d)
            start = view_idx * h * w
            X[start : start + flat.shape[0]] = flat.astype(X.dtype, copy=False)

        iterator = enumerate(view_specs)
        if show_progress:
            iterator = tqdm(list(iterator), desc="support features", leave=False)

        for j, (p, ang, img) in iterator:
            if self.cache is not None and self.cache.has(p, ang):
                f = self.cache.load(p, ang)
            else:
                im = img if abs(ang) < 1e-6 else rotate_image(img, ang)
                # Wide concat: always batch size 1
                f = self._extract_batch([im])[0]
                if self.cache is not None:
                    self.cache.save(p, f, ang)
                if d > 4096 and torch.cuda.is_available():
                    torch.cuda.empty_cache()
            _write_view(j, f)  # type: ignore[arg-type]
            del f

        if use_memmap:
            X.flush()  # type: ignore[attr-defined]

        self.model = SubspaceModel(tau=self.tau, device=self.device)
        try:
            self.model.fit(X, chunk_size=8_000 if d > 4096 else 50_000)
        finally:
            if mm_path is not None:
                del X
                try:
                    Path(mm_path).unlink(missing_ok=True)
                except OSError:
                    pass
        return self.model

    def predict_array(
        self, feats: np.ndarray, out_size_hw: tuple[int, int] | None = None
    ) -> PredictResult:
        assert self.model is not None
        scored = self.model.score(feats)
        if isinstance(scored, torch.Tensor):
            patch = scored.numpy()
        else:
            patch = np.asarray(scored)
        patch = np.asarray(patch, dtype=np.float32)
        if patch.ndim == 3:
            patch = patch[0]
        img_score = tvar_score(patch, rho=self.rho)
        h = out_size_hw[0] if out_size_hw else self.image_size
        w = out_size_hw[1] if out_size_hw else self.image_size
        pix = upsample_and_smooth(patch, (h, w), sigma=self.sigma)
        return PredictResult(
            image_score=img_score,
            patch_map=patch,
            pixel_map=pix,
            pixel_map_norm=minmax_normalize(pix),
        )

    def predict_path(
        self, image_path: Path | str, out_size_hw: tuple[int, int] | None = None
    ) -> PredictResult:
        feats = self.extract_cached(image_path, 0.0)
        return self.predict_array(feats, out_size_hw=out_size_hw)

    def predict_image(
        self, image: Image.Image, out_size_hw: tuple[int, int] | None = None
    ) -> PredictResult:
        feats = self._extract_batch([image])[0]
        return self.predict_array(feats, out_size_hw=out_size_hw)
