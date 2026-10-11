"""SubspaceAD website API.

Run: uv run uvicorn server.main:app --port 8000
"""

from __future__ import annotations

import io
from functools import lru_cache

import torch
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image

from server import data, runs
from server.demo import CFG, DATA_ROOT, DemoError, DemoService, available_categories, describe_test_images, image_path
from server.utils import BACKBONES, MODES, PRESETS, backbone_label

app = FastAPI(title="SubspaceAD API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

demo = DemoService()


def _bad_request(e: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


@app.get("/api/health")
def health() -> dict:
    cuda = torch.cuda.is_available()
    return {
        "ok": True,
        "cuda": cuda,
        "device_name": torch.cuda.get_device_name(0) if cuda else "CPU",
        "data": {ds: bool(available_categories(ds)) for ds in ("mvtec", "visa")},
        "results": data.load_results() is not None,
    }


@app.get("/api/datasets")
def datasets() -> dict:
    return {
        "presets": PRESETS,
        "modes": MODES,
        "backbones": [{"id": b, "label": backbone_label(b)} for b in BACKBONES],
        "datasets": {ds: available_categories(ds) for ds in ("mvtec", "visa")},
        "no_rotation_categories": CFG.get("no_rotation_categories", []),
        "tau": CFG.get("tau"),
        "rho": CFG.get("rho"),
        "data_root": str(DATA_ROOT),
    }


@app.get("/api/test-images")
def test_images(dataset: str, category: str) -> dict:
    try:
        return describe_test_images(dataset, category)
    except DemoError as e:
        raise _bad_request(e)


@lru_cache(maxsize=512)
def _thumb(dataset: str, category: str, kind: str, index: int, size: int) -> bytes:
    img = Image.open(image_path(dataset, category, kind, index)).convert("RGB")
    img.thumbnail((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@app.get("/api/images/{dataset}/{category}/{kind}/{index}")
def dataset_image(dataset: str, category: str, kind: str, index: int, size: int = Query(320, ge=64, le=1024)):
    try:
        body = _thumb(dataset, category, kind, index, size)
    except DemoError as e:
        raise _bad_request(e)
    return Response(body, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/fit")
def fit(
    backbone: str = Form(...),
    dataset: str = Form(...),
    category: str = Form(...),
    k: int = Form(1),
    seed: int = Form(0),
    image_size: int = Form(448),
    n_aug: int = Form(8),
    normals: list[UploadFile] | None = File(None),
) -> dict:
    if backbone not in BACKBONES:
        raise HTTPException(400, f"Unknown backbone '{backbone}'")
    uploads = [f.file.read() for f in (normals or []) if f.filename]
    try:
        return demo.fit(
            backbone=backbone,
            dataset=dataset,
            category=category,
            k=k,
            seed=seed,
            image_size=image_size,
            n_aug=n_aug,
            uploads=uploads,
        )
    except DemoError as e:
        raise _bad_request(e)


@app.post("/api/score")
def score(
    session_id: str = Form(...),
    source: str = Form("anomalous"),
    index: int = Form(0),
    file: UploadFile | None = File(None),
) -> dict:
    upload = file.file.read() if file is not None and file.filename else None
    try:
        return demo.score(session_id=session_id, source=source, index=index, upload=upload)
    except DemoError as e:
        raise _bad_request(e)


@app.get("/api/results")
def results() -> dict:
    res = data.load_results()
    if res is None:
        raise HTTPException(404, "No results.json yet. Run the benchmark and scripts/aggregate.py.")
    return res


@app.get("/api/ablations")
def ablations() -> dict:
    return {"labels": data.ABLATION_LABELS, "rows": data.load_ablation_rows()}


@app.get("/api/gallery")
def gallery() -> dict:
    return {"figures": data.list_figures()}


@app.get("/api/figures/{rel:path}")
def figure(rel: str):
    try:
        return FileResponse(data.figure_path(rel), media_type="image/png")
    except FileNotFoundError:
        raise HTTPException(404, "Figure not found")


@app.get("/api/runs")
def list_runs() -> dict:
    return {"runs": runs.list_runs()}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict:
    try:
        return runs.get_run(run_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Run '{run_id}' not found")


@app.post("/api/runs/{run_id}/pause")
def pause_run(run_id: str) -> dict:
    try:
        return runs.pause(run_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Run '{run_id}' not found")


@app.post("/api/runs/{run_id}/resume")
def resume_run(run_id: str) -> dict:
    try:
        return runs.resume(run_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Run '{run_id}' not found")
