"""Offline unit test for RunEngine pause/resume (no GPU)."""

from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path

from subspacead.runner import RunEngine, WorkUnit


def test_pause_resume() -> None:
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        cfg = {
            "image_size": 672,
            "backbone": "dinov2_vitg14",
            "layers": [21, 22, 23, 24, 25, 26, 27],
            "aggregation": "mean",
            "n_augmentations": 30,
            "rotation_step": 15,
            "tau": 0.99,
            "rho": 0.01,
            "gaussian_sigma": 4.0,
            "seeds": [0, 1],
            "shots": [1],
            "no_rotation_categories": ["transistor"],
            "datasets": ["mvtec"],
        }
        engine = RunEngine("t1", root, cfg)
        units = [
            WorkUnit("a", {"i": 0}),
            WorkUnit("b", {"i": 1}),
            WorkUnit("c", {"i": 2}),
        ]
        engine.set_units(units)

        def worker(u, eng):
            if u.unit_id == "b":
                eng.request_pause()
            time.sleep(0.05)
            path = root / "t1" / f"{u.unit_id}.json"
            path.write_text(json.dumps({"ok": True}))
            return {"result_path": str(path)}

        st = engine.run(worker)
        assert st.status == "paused"
        done = [u.unit_id for u in st.units if u.status == "done"]
        assert "a" in done
        # b may be done (pause checked before unit) or pending
        engine2 = RunEngine("t1", root, cfg)
        st2 = engine2.run(worker)
        assert st2.status == "completed"
        assert all(u.status == "done" for u in st2.units)
        assert not list((root / "t1").rglob("*.tmp"))
        print("offline pause/resume PASSED")


if __name__ == "__main__":
    test_pause_resume()
