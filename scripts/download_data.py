"""
Download MVTec-AD and VisA datasets with resumable HTTP downloads.

VisA: public S3 tarball
MVTec: try Hugging Face mirror; fall back to instructions for official download
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import tarfile
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

VISA_URL = "https://amazon-visual-anomaly.s3.us-west-2.amazonaws.com/VisA_20220922.tar"
VISA_CSV_URL = "https://raw.githubusercontent.com/amazon-science/spot-diff/main/split_csv/1cls.csv"

# Common MVTec mirrors / HF
MVTEC_HF_REPO = "Voxel51/mvtec-ad"


def download_resumable(url: str, dest: Path, chunk_size: int = 1 << 20) -> Path:
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_suffix(dest.suffix + ".partial")
    headers = {}
    pos = 0
    if partial.exists():
        pos = partial.stat().st_size
        headers["Range"] = f"bytes={pos}-"
        print(f"Resuming {dest.name} from byte {pos}")

    with requests.get(url, stream=True, headers=headers, timeout=60) as r:
        if r.status_code == 416:
            # Already complete
            partial.rename(dest)
            return dest
        r.raise_for_status()
        # If server ignores Range and returns 200, restart
        if pos > 0 and r.status_code == 200:
            pos = 0
            mode = "wb"
        else:
            mode = "ab" if pos > 0 else "wb"
        total = r.headers.get("Content-Length")
        total_size = int(total) + pos if total and pos and r.status_code == 206 else (int(total) if total else None)
        if total and r.status_code == 200:
            total_size = int(total)

        with open(partial, mode) as f, tqdm(
            total=total_size,
            initial=pos,
            unit="B",
            unit_scale=True,
            desc=dest.name,
        ) as bar:
            for chunk in r.iter_content(chunk_size=chunk_size):
                if not chunk:
                    continue
                f.write(chunk)
                bar.update(len(chunk))
    partial.rename(dest)
    return dest


def extract_tar(archive: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting {archive} -> {out_dir}")
    with tarfile.open(archive, "r:*") as tar:
        tar.extractall(out_dir)


def download_visa(data_root: Path) -> None:
    visa_root = data_root / "visa"
    visa_root.mkdir(parents=True, exist_ok=True)
    archive = data_root / "VisA_20220922.tar"
    if not (visa_root / "split_csv").exists() and not any(visa_root.glob("*")):
        if not archive.exists():
            download_resumable(VISA_URL, archive)
        extract_tar(archive, visa_root)
        # Some tars extract into VisA_20220922/
        nested = list(visa_root.glob("VisA*"))
        if len(nested) == 1 and nested[0].is_dir():
            for child in nested[0].iterdir():
                target = visa_root / child.name
                if not target.exists():
                    shutil.move(str(child), str(target))
            shutil.rmtree(nested[0], ignore_errors=True)

    csv_dir = visa_root / "split_csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    csv_path = csv_dir / "1cls.csv"
    if not csv_path.exists():
        print("Downloading VisA 1cls.csv split…")
        r = requests.get(VISA_CSV_URL, timeout=60)
        r.raise_for_status()
        csv_path.write_bytes(r.content)
    print(f"VisA ready at {visa_root}")


def download_mvtec_hf(data_root: Path) -> bool:
    """Try to pull MVTec from Hugging Face. Returns True on success."""
    mvtec_root = data_root / "mvtec"
    if (mvtec_root / "bottle").exists():
        print(f"MVTec already present at {mvtec_root}")
        return True

    try:
        from huggingface_hub import hf_hub_download, snapshot_download
    except ImportError:
        print("huggingface_hub not available")
        return False

    # Prefer single-archive mirrors
    archive_repos = [
        ("micguida1/mvtech_anomaly_detection", "mvtec_anomaly_detection.tar.xz"),
    ]
    for repo, filename in archive_repos:
        try:
            print(f"Downloading {filename} from {repo}…")
            local_dir = data_root / "_hf_mvtec"
            path = hf_hub_download(
                repo_id=repo,
                repo_type="dataset",
                filename=filename,
                local_dir=str(local_dir),
            )
            print(f"Extracting {path}")
            mvtec_root.mkdir(parents=True, exist_ok=True)
            extract_tar(Path(path), mvtec_root)
            if _flatten_mvtec(mvtec_root):
                print(f"MVTec ready at {mvtec_root}")
                return True
        except Exception as e:
            print(f"  failed: {e}")

    # Folder-layout mirrors
    for repo in ["foersben/mvtec-ad", "Voxel51/mvtec-ad"]:
        try:
            print(f"Trying Hugging Face snapshot: {repo}")
            local_dir = data_root / "_hf_mvtec_snap"
            snapshot_download(repo_id=repo, repo_type="dataset", local_dir=str(local_dir))
            bottles = [
                p
                for p in local_dir.rglob("bottle")
                if p.is_dir() and (p / "train").exists()
            ]
            if not bottles:
                continue
            src_root = bottles[0].parent
            mvtec_root.mkdir(parents=True, exist_ok=True)
            import shutil

            for cat in src_root.iterdir():
                if cat.is_dir() and (cat / "train").exists():
                    dest = mvtec_root / cat.name
                    if not dest.exists():
                        shutil.copytree(cat, dest)
            if (mvtec_root / "bottle").exists():
                print(f"MVTec ready at {mvtec_root}")
                return True
        except Exception as e:
            print(f"  failed: {e}")
    return False


def _flatten_mvtec(mvtec_root: Path) -> bool:
    if (mvtec_root / "bottle").exists():
        return True
    bottles = [p for p in mvtec_root.rglob("bottle") if p.is_dir() and (p / "train").exists()]
    if not bottles:
        return False
    src_root = bottles[0].parent
    if src_root == mvtec_root:
        return True
    import shutil

    tmp = mvtec_root.parent / "_mvtec_flat"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()
    for cat in src_root.iterdir():
        if cat.is_dir():
            shutil.move(str(cat), str(tmp / cat.name))
    shutil.rmtree(mvtec_root, ignore_errors=True)
    tmp.rename(mvtec_root)
    return (mvtec_root / "bottle").exists()


def print_mvtec_manual(data_root: Path) -> None:
    print(
        """
MVTec-AD automatic download failed.

Please download manually (free, non-commercial):
  1. Visit https://www.mvtec.com/company/research/datasets/mvtec-ad
  2. Register / accept the license and download mvtec_anomaly_detection.tar.xz
  3. Place it at: {archive}
  4. Re-run: uv run python scripts/download_data.py --mvtec-archive {archive}

Or extract yourself into: {root}/mvtec/<category>/train|test|ground_truth
""".format(
            archive=data_root / "mvtec_anomaly_detection.tar.xz",
            root=data_root,
        )
    )


def extract_mvtec_archive(archive: Path, data_root: Path) -> None:
    mvtec_root = data_root / "mvtec"
    mvtec_root.mkdir(parents=True, exist_ok=True)
    extract_tar(archive, mvtec_root)
    print(f"MVTec extracted to {mvtec_root}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=str, default="data")
    parser.add_argument("--skip-visa", action="store_true")
    parser.add_argument("--skip-mvtec", action="store_true")
    parser.add_argument("--mvtec-archive", type=str, default=None)
    args = parser.parse_args()
    data_root = Path(args.data_root)
    data_root.mkdir(parents=True, exist_ok=True)

    if not args.skip_visa:
        download_visa(data_root)

    if not args.skip_mvtec:
        if args.mvtec_archive:
            extract_mvtec_archive(Path(args.mvtec_archive), data_root)
        elif not download_mvtec_hf(data_root):
            # Check for local archive
            for name in [
                "mvtec_anomaly_detection.tar.xz",
                "mvtec_anomaly_detection.tar.gz",
                "mvtec_anomaly_detection.zip",
            ]:
                cand = data_root / name
                if cand.exists():
                    extract_mvtec_archive(cand, data_root)
                    break
            else:
                print_mvtec_manual(data_root)
                sys.exit(2)

    print("Done.")


if __name__ == "__main__":
    main()
