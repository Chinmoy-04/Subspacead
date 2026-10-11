"""Run monitor with pause/resume."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parents[1].parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.demo_utils import inject_css

st.set_page_config(page_title="Runs · SubspaceAD", layout="wide", page_icon="▣")
inject_css()
st.markdown(
    """
<div class="sa-hero">
  <div class="sa-tag">Dev</div>
  <h1>Runs</h1>
  <p>Pause / resume long benchmark and ablation jobs. Soft pause waits for the
  current unit; use terminal kill for an immediate stop.</p>
</div>
""",
    unsafe_allow_html=True,
)

runs_root = ROOT / "runs"
runs_root.mkdir(exist_ok=True)

run_dirs = sorted([p for p in runs_root.iterdir() if p.is_dir() and (p / "state.json").exists()])
if not run_dirs:
    st.info("No runs yet. Start with `uv run python scripts/run_benchmark.py --run-id main`.")
    st.stop()

names = [p.name for p in run_dirs]
run_id = st.selectbox("Run", names)
run_dir = runs_root / run_id
state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
units = state.get("units", [])
done = sum(1 for u in units if u["status"] == "done")
failed = sum(1 for u in units if u["status"] == "failed")
pending = sum(1 for u in units if u["status"] == "pending")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Status", state.get("status", "?"))
c2.metric("Done", f"{done}/{len(units)}")
c3.metric("Failed", failed)
c4.metric("Pending", pending)
st.progress(done / max(len(units), 1))

col_a, col_b, col_c = st.columns(3)
with col_a:
    if st.button("Pause", type="secondary"):
        (run_dir / "PAUSE").write_text("pause\n", encoding="utf-8")
        st.success("Pause sentinel written.")
with col_b:
    if st.button("Resume", type="primary"):
        pause = run_dir / "PAUSE"
        if pause.exists():
            pause.unlink()
        log = run_dir / "resume.log"
        cmd = [
            sys.executable,
            str(ROOT / "scripts" / "run_benchmark.py"),
            "--run-id",
            run_id,
        ]
        # If ablations meta, use ablations script
        if state.get("meta", {}).get("kind") == "ablations":
            cmd[1] = str(ROOT / "scripts" / "run_ablations.py")
        with open(log, "a", encoding="utf-8") as lf:
            flags = 0
            if sys.platform == "win32":
                flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS  # type: ignore
            subprocess.Popen(cmd, cwd=str(ROOT), stdout=lf, stderr=subprocess.STDOUT, creationflags=flags)
        st.success(f"Resume launched. Log: {log}")
with col_c:
    if st.button("Refresh"):
        st.rerun()

st.subheader("Units")
# Show compact table
import pandas as pd

df = pd.DataFrame(
    [
        {
            "unit": u["unit_id"],
            "status": u["status"],
            "elapsed_s": round(u.get("elapsed_s", 0), 1),
            "error": u.get("error") or "",
        }
        for u in units
    ]
)
st.dataframe(df, use_container_width=True, height=400)

# Auto-refresh every 10s while running
if state.get("status") == "running":
    time.sleep(5)
    st.rerun()
