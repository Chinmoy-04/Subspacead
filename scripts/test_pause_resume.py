"""Quick pause/resume integrity test on a tiny run (1 category, 1 seed)."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    run_id = "pause_test"
    runs = ROOT / "runs" / run_id
    if runs.exists():
        import shutil

        shutil.rmtree(runs)

    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "run_benchmark.py"),
        "--run-id",
        run_id,
        "--datasets",
        "mvtec",
        "--categories",
        "bottle",
        "--shots",
        "1",
        "--seeds",
        "0",
        "1",
    ]
    print("Starting run…", flush=True)
    proc = subprocess.Popen(cmd, cwd=str(ROOT))
    # Wait until at least one unit is running/done, then pause
    state_path = runs / "state.json"
    for _ in range(120):
        time.sleep(2)
        if state_path.exists():
            st = json.loads(state_path.read_text(encoding="utf-8"))
            done = sum(1 for u in st["units"] if u["status"] == "done")
            if done >= 1 or st.get("status") == "running":
                break
    (runs / "PAUSE").write_text("pause\n", encoding="utf-8")
    print("PAUSE written, waiting for clean exit…", flush=True)
    try:
        proc.wait(timeout=600)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise SystemExit("Process did not pause in time")

    st = json.loads(state_path.read_text(encoding="utf-8"))
    print("After pause:", st["status"], flush=True)
    done_before = {u["unit_id"] for u in st["units"] if u["status"] == "done"}
    print("Done units:", done_before, flush=True)

    # Resume
    print("Resuming…", flush=True)
    if (runs / "PAUSE").exists():
        (runs / "PAUSE").unlink()
    proc2 = subprocess.Popen(cmd, cwd=str(ROOT))
    proc2.wait()
    st2 = json.loads(state_path.read_text(encoding="utf-8"))
    print("Final status:", st2["status"], flush=True)
    assert st2["status"] in {"completed", "failed"}
    done_after = {u["unit_id"] for u in st2["units"] if u["status"] == "done"}
    assert done_before.issubset(done_after)
    # No tmp leftovers
    tmps = list(runs.rglob("*.tmp"))
    assert not tmps, tmps
    print("Pause/resume test PASSED", flush=True)


if __name__ == "__main__":
    main()
