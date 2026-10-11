"""Control pausable runs: list / status / pause / resume."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from subspacead.config import load_config, project_root


def runs_root(cfg_path: str | None = None) -> Path:
    cfg = load_config(cfg_path)
    return project_root() / cfg["paths"]["runs_root"]


def list_runs(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted([p for p in root.iterdir() if p.is_dir() and (p / "state.json").exists()])


def load_state(run_dir: Path) -> dict:
    return json.loads((run_dir / "state.json").read_text(encoding="utf-8"))


def cmd_list(args: argparse.Namespace) -> None:
    root = runs_root(args.config)
    runs = list_runs(root)
    if not runs:
        print("No runs found.")
        return
    for r in runs:
        st = load_state(r)
        units = st.get("units", [])
        done = sum(1 for u in units if u["status"] == "done")
        print(f"{r.name:20s}  status={st.get('status'):10s}  {done}/{len(units)} done")


def cmd_status(args: argparse.Namespace) -> None:
    root = runs_root(args.config)
    run_dir = root / args.run_id
    if not (run_dir / "state.json").exists():
        print(f"Run not found: {args.run_id}")
        sys.exit(1)
    st = load_state(run_dir)
    units = st.get("units", [])
    done = sum(1 for u in units if u["status"] == "done")
    failed = sum(1 for u in units if u["status"] == "failed")
    pending = sum(1 for u in units if u["status"] == "pending")
    running = sum(1 for u in units if u["status"] == "running")
    elapsed = sum(u.get("elapsed_s", 0) for u in units if u["status"] == "done")
    avg = elapsed / done if done else 0
    eta = avg * pending
    print(f"Run: {args.run_id}")
    print(f"  status:  {st.get('status')}")
    print(f"  config:  {st.get('config_hash')}")
    print(f"  progress:{done}/{len(units)} done, {failed} failed, {pending} pending, {running} running")
    print(f"  elapsed: {elapsed/60:.1f} min  ETA: {eta/60:.1f} min")
    if (run_dir / "PAUSE").exists():
        print("  PAUSE sentinel present")
    pid_file = run_dir / "pid.txt"
    if pid_file.exists():
        print(f"  pid:     {pid_file.read_text().strip()}")
    # Per dataset/k summary
    from collections import defaultdict

    buckets: dict[str, list] = defaultdict(list)
    for u in units:
        p = u["payload"]
        key = f"{p.get('dataset')}/k{p.get('k')}"
        buckets[key].append(u)
    for key, us in sorted(buckets.items()):
        d = sum(1 for u in us if u["status"] == "done")
        bar_n = 20
        filled = int(bar_n * d / max(len(us), 1))
        bar = "#" * filled + "-" * (bar_n - filled)
        print(f"  [{bar}] {key}: {d}/{len(us)}")
    fails = [u for u in units if u["status"] == "failed"]
    if fails:
        print("  Recent failures:")
        for u in fails[-5:]:
            print(f"    {u['unit_id']}: {u.get('error')}")


def cmd_pause(args: argparse.Namespace) -> None:
    root = runs_root(args.config)
    run_dir = root / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "PAUSE").write_text("pause\n", encoding="utf-8")
    print(f"Pause requested for run '{args.run_id}'.")


def cmd_resume(args: argparse.Namespace) -> None:
    root = runs_root(args.config)
    run_dir = root / args.run_id
    pause = run_dir / "PAUSE"
    if pause.exists():
        pause.unlink()
    # Launch background process
    cmd = args.command or [
        sys.executable,
        str(project_root() / "scripts" / "run_benchmark.py"),
        "--run-id",
        args.run_id,
    ]
    if args.config:
        cmd.extend(["--config", args.config])
    log = run_dir / "resume.log"
    print(f"Resuming: {' '.join(cmd)}")
    # Detach on Windows
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS  # type: ignore
    with open(log, "a", encoding="utf-8") as lf:
        subprocess.Popen(
            cmd,
            cwd=str(project_root()),
            stdout=lf,
            stderr=subprocess.STDOUT,
            creationflags=creationflags,
            close_fds=True,
        )
    print(f"Started in background. Log: {log}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Control SubspaceAD runs")
    parser.add_argument("--config", type=str, default=None)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list")
    p_list.set_defaults(func=cmd_list)

    p_status = sub.add_parser("status")
    p_status.add_argument("run_id")
    p_status.set_defaults(func=cmd_status)

    p_pause = sub.add_parser("pause")
    p_pause.add_argument("run_id")
    p_pause.set_defaults(func=cmd_pause)

    p_resume = sub.add_parser("resume")
    p_resume.add_argument("run_id")
    p_resume.add_argument("--command", nargs=argparse.REMAINDER, default=None)
    p_resume.set_defaults(func=cmd_resume)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
