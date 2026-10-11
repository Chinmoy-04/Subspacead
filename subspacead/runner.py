"""Pausable / resumable run engine."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import psutil

from subspacead.config import config_hash
from subspacead.io_utils import atomic_write_json, cleanup_tmp_files


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class WorkUnit:
    unit_id: str
    payload: dict[str, Any]
    status: str = "pending"  # pending | running | done | failed
    started_at: str | None = None
    finished_at: str | None = None
    error: str | None = None
    elapsed_s: float = 0.0
    result_path: str | None = None


@dataclass
class RunState:
    run_id: str
    config_hash: str
    status: str = "pending"  # pending | running | paused | completed | failed
    created_at: str = field(default_factory=_utc_now)
    updated_at: str = field(default_factory=_utc_now)
    units: list[WorkUnit] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "config_hash": self.config_hash,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "meta": self.meta,
            "units": [asdict(u) for u in self.units],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "RunState":
        units = [WorkUnit(**u) for u in d.get("units", [])]
        return cls(
            run_id=d["run_id"],
            config_hash=d["config_hash"],
            status=d.get("status", "pending"),
            created_at=d.get("created_at", _utc_now()),
            updated_at=d.get("updated_at", _utc_now()),
            units=units,
            meta=d.get("meta", {}),
        )


class PauseRequested(Exception):
    pass


class RunEngine:
    def __init__(
        self,
        run_id: str,
        runs_root: Path | str,
        cfg: dict[str, Any],
        force: bool = False,
        max_hours: float | None = None,
        until: str | None = None,
        pause_on_battery: bool = False,
    ) -> None:
        self.run_id = run_id
        self.runs_root = Path(runs_root)
        self.run_dir = self.runs_root / run_id
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.run_dir / "state.json"
        self.pause_path = self.run_dir / "PAUSE"
        self.pid_path = self.run_dir / "pid.txt"
        self.cfg = cfg
        self.cfg_hash = config_hash(cfg)
        self.force = force
        self.max_hours = max_hours
        self.until = until
        self.pause_on_battery = pause_on_battery
        self._start_wall = time.time()
        self._pause_flag = False
        self._hard_stop = False
        self.state = self._load_or_create()

    def _load_or_create(self) -> RunState:
        cleanup_tmp_files(self.run_dir)
        if self.state_path.exists():
            state = RunState.from_dict(json.loads(self.state_path.read_text(encoding="utf-8")))
            if state.config_hash != self.cfg_hash and not self.force:
                raise RuntimeError(
                    f"Config hash mismatch for run '{self.run_id}': "
                    f"stored={state.config_hash} current={self.cfg_hash}. "
                    "Use a new --run-id or pass --force."
                )
            # Reset interrupted running units
            for u in state.units:
                if u.status == "running":
                    u.status = "pending"
                    u.started_at = None
                    u.error = "reset after interrupted run"
            state.config_hash = self.cfg_hash
            return state
        return RunState(run_id=self.run_id, config_hash=self.cfg_hash)

    def save(self) -> None:
        self.state.updated_at = _utc_now()
        atomic_write_json(self.state_path, self.state.to_dict())

    def set_units(self, units: Iterable[WorkUnit]) -> None:
        existing = {u.unit_id: u for u in self.state.units}
        merged: list[WorkUnit] = []
        for u in units:
            if u.unit_id in existing and existing[u.unit_id].status == "done":
                merged.append(existing[u.unit_id])
            elif u.unit_id in existing and existing[u.unit_id].status == "failed":
                # keep failed unless force; allow retry as pending
                old = existing[u.unit_id]
                if self.force:
                    merged.append(u)
                else:
                    merged.append(old)
            else:
                merged.append(u)
        self.state.units = merged
        self.save()

    def request_pause(self) -> None:
        self.pause_path.write_text("pause\n", encoding="utf-8")

    def clear_pause(self) -> None:
        if self.pause_path.exists():
            self.pause_path.unlink()

    def _install_signals(self) -> None:
        def handler(signum, frame):
            if self._pause_flag:
                self._hard_stop = True
                print("\n[runner] Second interrupt — hard stop.", flush=True)
                sys.exit(130)
            self._pause_flag = True
            self.request_pause()
            print("\n[runner] Pause requested — finishing current unit…", flush=True)

        signal.signal(signal.SIGINT, handler)
        if hasattr(signal, "SIGTERM"):
            try:
                signal.signal(signal.SIGTERM, handler)
            except Exception:
                pass

    def should_pause(self) -> bool:
        if self._pause_flag or self.pause_path.exists():
            return True
        if self.max_hours is not None:
            if (time.time() - self._start_wall) / 3600.0 >= self.max_hours:
                return True
        if self.until:
            # until as HH:MM local
            now = datetime.now().strftime("%H:%M")
            if now >= self.until:
                return True
        if self.pause_on_battery:
            try:
                batt = psutil.sensors_battery()
                if batt is not None and not batt.power_plugged:
                    return True
            except Exception:
                pass
        return False

    def progress(self) -> dict[str, Any]:
        total = len(self.state.units)
        done = sum(1 for u in self.state.units if u.status == "done")
        failed = sum(1 for u in self.state.units if u.status == "failed")
        pending = sum(1 for u in self.state.units if u.status == "pending")
        running = sum(1 for u in self.state.units if u.status == "running")
        elapsed = sum(u.elapsed_s for u in self.state.units if u.status == "done")
        avg = elapsed / done if done else 0.0
        eta = avg * pending
        return {
            "total": total,
            "done": done,
            "failed": failed,
            "pending": pending,
            "running": running,
            "elapsed_s": elapsed,
            "eta_s": eta,
            "status": self.state.status,
        }

    def run(self, worker: Callable[[WorkUnit, "RunEngine"], dict[str, Any] | None]) -> RunState:
        self.clear_pause()
        self._install_signals()
        self.state.status = "running"
        self.pid_path.write_text(str(os.getpid()), encoding="utf-8")
        self.save()
        try:
            for u in self.state.units:
                if u.status == "done":
                    continue
                if self.should_pause():
                    self.state.status = "paused"
                    self.save()
                    print(f"[runner] Paused at unit {u.unit_id}", flush=True)
                    return self.state
                u.status = "running"
                u.started_at = _utc_now()
                u.error = None
                self.save()
                t0 = time.time()
                try:
                    result = worker(u, self)
                    u.elapsed_s = time.time() - t0
                    u.finished_at = _utc_now()
                    u.status = "done"
                    if result and "result_path" in result:
                        u.result_path = result["result_path"]
                except PauseRequested:
                    u.status = "pending"
                    u.started_at = None
                    self.state.status = "paused"
                    self.save()
                    return self.state
                except Exception as e:
                    u.elapsed_s = time.time() - t0
                    u.finished_at = _utc_now()
                    u.status = "failed"
                    u.error = repr(e)
                    self.save()
                    print(f"[runner] FAILED {u.unit_id}: {e}", flush=True)
                self.save()
            # All done?
            if all(u.status in {"done", "failed"} for u in self.state.units):
                self.state.status = "completed" if all(u.status == "done" for u in self.state.units) else "failed"
            self.save()
            return self.state
        finally:
            if self.pid_path.exists():
                try:
                    self.pid_path.unlink()
                except OSError:
                    pass


def make_unit_id(*parts: Any) -> str:
    return "/".join(str(p) for p in parts)


def add_run_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--run-id", type=str, required=True)
    parser.add_argument("--config", type=str, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--max-hours", type=float, default=None)
    parser.add_argument("--until", type=str, default=None, help="HH:MM local time to pause")
    parser.add_argument("--pause-on-battery", action="store_true")
