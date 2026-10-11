"""Benchmark / ablation run monitor with soft pause and resume."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from server.utils import ROOT

RUNS_DIR = ROOT / "runs"


def _run_dir(run_id: str) -> Path:
    for p in RUNS_DIR.iterdir() if RUNS_DIR.exists() else []:
        if p.is_dir() and p.name == run_id and (p / "state.json").exists():
            return p
    raise FileNotFoundError(run_id)


def _state(run_dir: Path) -> dict[str, Any]:
    return json.loads((run_dir / "state.json").read_text(encoding="utf-8"))


def _summary(run_dir: Path, state: dict[str, Any]) -> dict[str, Any]:
    units = state.get("units", [])
    counts = {s: sum(1 for u in units if u.get("status") == s) for s in ("done", "failed", "pending", "running")}
    return {
        "run_id": run_dir.name,
        "status": state.get("status", "unknown"),
        "kind": state.get("meta", {}).get("kind", "benchmark"),
        "created_at": state.get("created_at"),
        "total": len(units),
        "paused": (run_dir / "PAUSE").exists(),
        **counts,
    }


def list_runs() -> list[dict[str, Any]]:
    if not RUNS_DIR.exists():
        return []
    out = []
    for p in sorted(RUNS_DIR.iterdir()):
        if p.is_dir() and (p / "state.json").exists():
            try:
                out.append(_summary(p, _state(p)))
            except (OSError, json.JSONDecodeError):
                continue
    return out


def get_run(run_id: str) -> dict[str, Any]:
    run_dir = _run_dir(run_id)
    state = _state(run_dir)
    units = [
        {
            "unit": u.get("unit_id"),
            "status": u.get("status"),
            "elapsed_s": round(float(u.get("elapsed_s") or 0), 1),
            "error": u.get("error") or "",
        }
        for u in state.get("units", [])
    ]
    return {**_summary(run_dir, state), "units": units}


def pause(run_id: str) -> dict[str, Any]:
    run_dir = _run_dir(run_id)
    (run_dir / "PAUSE").write_text("pause\n", encoding="utf-8")
    return {"ok": True, "message": "Pause sentinel written. The current unit will finish first."}


def resume(run_id: str) -> dict[str, Any]:
    run_dir = _run_dir(run_id)
    state = _state(run_dir)
    (run_dir / "PAUSE").unlink(missing_ok=True)
    script = "run_ablations.py" if state.get("meta", {}).get("kind") == "ablations" else "run_benchmark.py"
    cmd = [sys.executable, str(ROOT / "scripts" / script), "--run-id", run_id]
    log = run_dir / "resume.log"
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS  # type: ignore[attr-defined]
    with open(log, "a", encoding="utf-8") as lf:
        subprocess.Popen(cmd, cwd=str(ROOT), stdout=lf, stderr=subprocess.STDOUT, creationflags=flags)
    return {"ok": True, "message": f"Resume launched. Log: {log.relative_to(ROOT).as_posix()}"}
