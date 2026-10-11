"""PCA subspace model of normal patch features."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from subspacead.io_utils import atomic_write_json, atomic_save_npy


class SubspaceModel:
    """Fit PCA on normal features; score via reconstruction residual."""

    def __init__(self, tau: float = 0.99, device: str | torch.device = "cuda") -> None:
        self.tau = float(tau)
        self.device = torch.device(device if torch.cuda.is_available() or device == "cpu" else "cpu")
        self.mu: torch.Tensor | None = None
        self.C: torch.Tensor | None = None  # (D, r)
        self.eigenvalues: np.ndarray | None = None
        self.explained_variance_ratio: np.ndarray | None = None
        self.n_components: int = 0
        self.n_features: int = 0
        self.n_samples: int = 0

    def fit(self, X: torch.Tensor | np.ndarray, chunk_size: int = 20_000) -> "SubspaceModel":
        """
        Fit PCA on X of shape (N, D) or (N, H, W, D).

        Streams over X in chunks so large concat features (D~10k) do not need a
        full float32 materialization in RAM. Covariance for large D is accumulated
        on CPU to leave GPU memory for the backbone.
        """
        if isinstance(X, torch.Tensor):
            # Keep a numpy-like view when possible
            X_arr: np.ndarray | torch.Tensor = X.detach().cpu().numpy()
        else:
            X_arr = X

        # Infer flat shape without copying the full tensor when already 2D
        if getattr(X_arr, "ndim", 0) == 2:
            n, d = int(X_arr.shape[0]), int(X_arr.shape[1])

            def iter_chunks():
                for i in range(0, n, chunk_size):
                    yield np.asarray(X_arr[i : i + chunk_size], dtype=np.float32)

        else:
            # (..., D)
            d = int(X_arr.shape[-1])
            flat = np.asarray(X_arr, dtype=np.float32).reshape(-1, d)
            n = int(flat.shape[0])

            def iter_chunks():
                for i in range(0, n, chunk_size):
                    yield flat[i : i + chunk_size]

        self.n_samples = n
        self.n_features = d

        mu = np.zeros(d, dtype=np.float64)
        for chunk in iter_chunks():
            mu += chunk.sum(axis=0, dtype=np.float64)
        mu /= max(n, 1)
        self.mu = torch.from_numpy(mu.astype(np.float32))

        # Large-D covariance on CPU (10752^2 * 4B ≈ 462MB)
        cov_device = torch.device("cpu") if d > 4096 else self.device
        cov = torch.zeros(d, d, dtype=torch.float32, device=cov_device)
        mu_dev = self.mu.to(cov_device)
        for chunk in iter_chunks():
            c = torch.from_numpy(chunk).to(cov_device) - mu_dev
            cov = cov + c.T @ c
            del c
        cov /= max(n - 1, 1)

        evals, evecs = torch.linalg.eigh(cov)
        evals = evals.clamp(min=0)
        idx = torch.argsort(evals, descending=True)
        evals = evals[idx]
        evecs = evecs[:, idx]

        total = evals.sum().clamp(min=1e-12)
        ratios = (evals / total).cpu().numpy()
        cumsum = np.cumsum(ratios)
        if self.tau >= 1.0 - 1e-12:
            r = d
        else:
            r = int(np.searchsorted(cumsum, self.tau) + 1)
            r = max(1, min(r, d))

        self.C = evecs[:, :r].contiguous().cpu()
        self.eigenvalues = evals.cpu().numpy()
        self.explained_variance_ratio = ratios
        self.n_components = r
        del cov, evals, evecs, mu_dev
        if self.device.type == "cuda":
            torch.cuda.empty_cache()
        return self

    def project(self, X: torch.Tensor | np.ndarray) -> torch.Tensor:
        assert self.mu is not None and self.C is not None
        if isinstance(X, np.ndarray):
            X = torch.from_numpy(X)
        shape = X.shape
        flat = X.reshape(-1, shape[-1]).float()
        mu = self.mu
        C = self.C
        centered = flat - mu
        z = centered @ C
        recon = z @ C.T + mu
        return recon.reshape(shape)

    def score(self, X: torch.Tensor | np.ndarray) -> torch.Tensor:
        """Squared reconstruction residual per patch. Returns same leading dims as X without D."""
        assert self.mu is not None and self.C is not None
        if isinstance(X, np.ndarray):
            X = torch.from_numpy(X)
        shape = X.shape
        flat = X.reshape(-1, shape[-1]).float()
        centered = flat - self.mu
        z = centered @ self.C
        recon_c = z @ self.C.T
        resid = centered - recon_c
        scores = (resid * resid).sum(dim=-1)
        return scores.reshape(shape[:-1])

    def save(self, path: Path | str) -> None:
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        assert self.mu is not None and self.C is not None
        atomic_save_npy(path / "mu.npy", self.mu.numpy())
        atomic_save_npy(path / "C.npy", self.C.numpy())
        if self.eigenvalues is not None:
            atomic_save_npy(path / "eigenvalues.npy", self.eigenvalues)
        meta = {
            "tau": self.tau,
            "n_components": self.n_components,
            "n_features": self.n_features,
            "n_samples": self.n_samples,
        }
        atomic_write_json(path / "meta.json", meta)

    @classmethod
    def load(cls, path: Path | str, device: str | torch.device = "cpu") -> "SubspaceModel":
        path = Path(path)
        import json

        meta = json.loads((path / "meta.json").read_text())
        m = cls(tau=meta["tau"], device=device)
        m.mu = torch.from_numpy(np.load(path / "mu.npy"))
        m.C = torch.from_numpy(np.load(path / "C.npy"))
        if (path / "eigenvalues.npy").exists():
            m.eigenvalues = np.load(path / "eigenvalues.npy")
            total = m.eigenvalues.sum()
            m.explained_variance_ratio = m.eigenvalues / max(total, 1e-12)
        m.n_components = meta["n_components"]
        m.n_features = meta["n_features"]
        m.n_samples = meta["n_samples"]
        return m
