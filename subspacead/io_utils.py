"""Atomic file I/O helpers for crash-safe writes."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np


def atomic_write_bytes(path: Path | str, data: bytes) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_bytes(data)
        os.replace(tmp, path)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


def atomic_write_text(path: Path | str, text: str, encoding: str = "utf-8") -> None:
    atomic_write_bytes(path, text.encode(encoding))


def atomic_write_json(path: Path | str, obj: Any, indent: int = 2) -> None:
    text = json.dumps(obj, indent=indent, sort_keys=True, default=str)
    atomic_write_text(path, text)


def atomic_save_npy(path: Path | str, array: np.ndarray) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with open(tmp, "wb") as f:
            np.save(f, array)
        os.replace(tmp, path)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


def cleanup_tmp_files(root: Path | str) -> int:
    """Remove orphaned *.tmp files under root. Returns count removed."""
    root = Path(root)
    if not root.exists():
        return 0
    n = 0
    for p in root.rglob("*.tmp"):
        try:
            p.unlink()
            n += 1
        except OSError:
            pass
    return n
