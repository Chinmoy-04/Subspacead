"""Aggregate result JSONs into tables vs paper numbers."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

from subspacead.config import project_root
from subspacead.io_utils import atomic_write_json, atomic_write_text
from subspacead.paper_reference import PAPER_TABLE1, PAPER_MVTEC_1SHOT


METRIC_KEYS = ["image_auroc", "image_aupr", "pixel_auroc", "pro"]
METRIC_LABELS = {
    "image_auroc": "I-AUROC",
    "image_aupr": "I-AUPR",
    "pixel_auroc": "P-AUROC",
    "pro": "PRO",
}


def load_results(results_root: Path) -> list[dict]:
    rows = []
    for p in results_root.rglob("*.json"):
        if "ablations" in p.parts or "models" in p.parts:
            continue
        try:
            rows.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    return [r for r in rows if "metrics" in r and "category" in r]


def summarize(rows: list[dict]) -> dict:
    """dataset -> k -> category -> metric -> {mean, std, n}"""
    buckets: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(list))))
    for r in rows:
        ds, k, cat = r["dataset"], int(r["k"]), r["category"]
        for m, v in r["metrics"].items():
            if v == v:  # not nan
                buckets[ds][k][cat][m].append(float(v))

    out: dict = {}
    for ds, by_k in buckets.items():
        out[ds] = {}
        for k, by_cat in by_k.items():
            out[ds][k] = {"categories": {}, "mean": {}}
            cat_means = defaultdict(list)
            for cat, by_m in by_cat.items():
                out[ds][k]["categories"][cat] = {}
                for m, vals in by_m.items():
                    mean = float(np.mean(vals))
                    std = float(np.std(vals)) if len(vals) > 1 else 0.0
                    out[ds][k]["categories"][cat][m] = {
                        "mean": mean,
                        "std": std,
                        "n": len(vals),
                    }
                    cat_means[m].append(mean)
            for m, vals in cat_means.items():
                out[ds][k]["mean"][m] = {
                    "mean": float(np.mean(vals)),
                    "std": float(np.std(vals)) if len(vals) > 1 else 0.0,
                    "n": len(vals),
                }
    return out


def fmt(mean: float, std: float | None = None) -> str:
    if std is None or std == 0:
        return f"{mean:.1f}"
    return f"{mean:.1f} +/- {std:.1f}"


def to_markdown(summary: dict, partial: bool = False) -> str:
    lines = []
    lines.append("# SubspaceAD Reproduction Results")
    if partial:
        lines.append("\n> **Partial results** - run still in progress.\n")
    lines.append("\n## Table 1 - Mean over categories\n")
    lines.append(
        "| Dataset | k | Metric | Paper | Ours | delta |"
    )
    lines.append("|---|---:|---|---:|---:|---:|")
    for ds in ["mvtec", "visa"]:
        if ds not in summary:
            continue
        for k in sorted(summary[ds].keys()):
            paper = PAPER_TABLE1.get(ds, {}).get(k, {})
            ours = summary[ds][k]["mean"]
            for m in METRIC_KEYS:
                if m not in ours:
                    continue
                p = paper.get(m)
                o = ours[m]["mean"]
                delta = "" if p is None else f"{o - p:+.1f}"
                p_s = "" if p is None else f"{p:.1f}"
                lines.append(
                    f"| {ds} | {k} | {METRIC_LABELS[m]} | {p_s} | {fmt(o, ours[m]['std'])} | {delta} |"
                )

    lines.append("\n## MVTec per-category (available seeds)\n")
    if "mvtec" in summary:
        for k in sorted(summary["mvtec"].keys()):
            lines.append(f"\n### k={k}\n")
            lines.append("| Category | I-AUROC | I-AUPR | P-AUROC | PRO |")
            lines.append("|---|---:|---:|---:|---:|")
            for cat, mets in sorted(summary["mvtec"][k]["categories"].items()):
                cells = []
                for m in METRIC_KEYS:
                    if m in mets:
                        cells.append(fmt(mets[m]["mean"], mets[m]["std"]))
                    else:
                        cells.append("-")
                # Paper compare for 1-shot
                note = ""
                if k == 1 and cat in PAPER_MVTEC_1SHOT:
                    note = ""
                lines.append(f"| {cat} | " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-root", type=str, default=None)
    parser.add_argument("--out-dir", type=str, default=None)
    args = parser.parse_args()
    root = project_root()
    results_root = Path(args.results_root) if args.results_root else root / "results"
    out_dir = Path(args.out_dir) if args.out_dir else results_root
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = load_results(results_root)
    summary = summarize(rows)
    from subspacead.data import MVTEC_CATEGORIES, VISA_CATEGORIES

    expected = {"mvtec": set(MVTEC_CATEGORIES), "visa": set(VISA_CATEGORIES)}
    partial = False
    for ds, by_k in summary.items():
        for k, kdata in by_k.items():
            cats = set(kdata["categories"].keys())
            if cats != expected.get(ds, cats):
                partial = True
            for cat in kdata["categories"].values():
                for m in cat.values():
                    if m["n"] < 5:
                        partial = True
                        break
    # Also partial if either dataset missing entirely for planned shots
    if "mvtec" not in summary or "visa" not in summary:
        partial = True
    if not rows:
        partial = True

    payload = {
        "partial": partial,
        "n_result_files": len(rows),
        "summary": summary,
        "paper_table1": PAPER_TABLE1,
    }
    atomic_write_json(out_dir / "results.json", payload)
    atomic_write_text(out_dir / "tables.md", to_markdown(summary, partial=partial))
    print(f"Wrote {out_dir / 'results.json'} and tables.md ({len(rows)} files, partial={partial})")


if __name__ == "__main__":
    main()
