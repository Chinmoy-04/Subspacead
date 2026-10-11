"""DINOv2 feature extractor with multi-layer aggregation."""

from __future__ import annotations

from typing import Literal, Sequence

import torch
import torch.nn as nn
import torch.nn.functional as F

Aggregation = Literal["mean", "concat", "final7", "last"]

BACKBONE_NAMES = {
    "dinov2_vits14": "dinov2_vits14",
    "dinov2_vitb14": "dinov2_vitb14",
    "dinov2_vitl14": "dinov2_vitl14",
    "dinov2_vitg14": "dinov2_vitg14",
    "s": "dinov2_vits14",
    "b": "dinov2_vitb14",
    "l": "dinov2_vitl14",
    "g": "dinov2_vitg14",
}

# Number of transformer blocks per backbone
N_BLOCKS = {
    "dinov2_vits14": 12,
    "dinov2_vitb14": 12,
    "dinov2_vitl14": 24,
    "dinov2_vitg14": 40,
}

# Feature dimension
FEAT_DIM = {
    "dinov2_vits14": 384,
    "dinov2_vitb14": 768,
    "dinov2_vitl14": 1024,
    "dinov2_vitg14": 1536,
}


def resolve_layers(
    backbone: str,
    aggregation: Aggregation,
    layers: Sequence[int] | None = None,
) -> list[int]:
    """Return 0-indexed block indices to extract."""
    name = BACKBONE_NAMES[backbone]
    n = N_BLOCKS[name]
    if aggregation == "last":
        return [n - 1]
    if aggregation == "final7":
        return list(range(n - 7, n))
    if layers is not None:
        return list(layers)
    # Default middle-7 for giant (blocks 22-28 -> indices 21-27)
    if name == "dinov2_vitg14":
        return list(range(21, 28))
    if name == "dinov2_vitl14":
        return list(range(17, 24))
    # S/B: last 7 of 12
    return list(range(max(0, n - 7), n))


class DINOv2Backbone(nn.Module):
    """Frozen DINOv2 with multi-layer patch-token aggregation."""

    def __init__(
        self,
        name: str = "dinov2_vitg14",
        layers: Sequence[int] | None = None,
        aggregation: Aggregation = "mean",
        device: str | torch.device = "cuda",
        dtype: torch.dtype = torch.float16,
    ) -> None:
        super().__init__()
        key = BACKBONE_NAMES.get(name, name)
        if key not in BACKBONE_NAMES.values():
            raise ValueError(f"Unknown backbone: {name}")
        self.backbone_name = key
        self.aggregation: Aggregation = aggregation
        self.layers = resolve_layers(key, aggregation, layers)
        self.device = torch.device(device)
        self.dtype = dtype
        self.feat_dim = FEAT_DIM[key]
        if aggregation == "concat":
            self.out_dim = self.feat_dim * len(self.layers)
        else:
            self.out_dim = self.feat_dim

        self.model = torch.hub.load("facebookresearch/dinov2", key, pretrained=True)
        self.model.eval()
        self.model.to(self.device)
        for p in self.model.parameters():
            p.requires_grad = False
        if self.dtype == torch.float16:
            self.model.half()

    @torch.inference_mode()
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, 3, H, W) ImageNet-normalized images.
        Returns:
            (B, H_p, W_p, D) patch features.
        """
        x = x.to(device=self.device, dtype=self.dtype)
        if self.aggregation == "concat":
            # Extract one layer at a time and concat on CPU to avoid OOM on 8GB GPUs.
            parts = []
            for li in self.layers:
                feat = self.model.get_intermediate_layers(
                    x, n=[li], reshape=True, norm=True
                )[0]  # (B, D, h, w)
                parts.append(feat.float().cpu())
                del feat
                if self.device.type == "cuda":
                    torch.cuda.empty_cache()
            stacked = torch.cat(parts, dim=1)  # (B, D*L, h, w) on CPU
            return stacked.permute(0, 2, 3, 1).contiguous()

        feats = self.model.get_intermediate_layers(
            x, n=self.layers, reshape=True, norm=True
        )
        # each: (B, D, h, w)
        if self.aggregation == "last":
            stacked = feats[-1]
        else:
            stacked = torch.stack(feats, dim=0).mean(dim=0)

        # (B, D, h, w) -> (B, h, w, D)
        return stacked.permute(0, 2, 3, 1).contiguous()

    def extract(self, x: torch.Tensor) -> torch.Tensor:
        """Alias for forward; returns fp32 features on CPU for caching."""
        out = self.forward(x)
        if out.device.type != "cpu":
            out = out.float().cpu()
        else:
            out = out.float()
        return out
