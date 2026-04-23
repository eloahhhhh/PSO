import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
RENDER_DIR = BASE_DIR / "renders"
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
SCENE_FILE = BASE_DIR / "pso_scene.py"

RENDER_DIR.mkdir(exist_ok=True)

app = FastAPI(title="PSO Manim Visualizer")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/renders", StaticFiles(directory=str(RENDER_DIR)), name="renders")


class RenderRequest(BaseModel):
    function_name: str = Field(pattern="^(ackley|rosenbrock)$")
    particles: int = Field(ge=5, le=120)
    iterations: int = Field(ge=5, le=300)
    inertia_weight: float = Field(ge=0.0, le=1.4)
    cognitive_factor: float = Field(ge=0.0, le=4.0)
    social_factor: float = Field(ge=0.0, le=4.0)
    seed: int = Field(ge=0, le=999999)


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.post("/api/render")
def render_animation(payload: RenderRequest):
    render_id = str(uuid.uuid4())
    config_file = RENDER_DIR / f"{render_id}.json"
    output_file = f"{render_id}.mp4"

    with config_file.open("w", encoding="utf-8") as f:
        json.dump(payload.model_dump(), f)

    cmd = [
        sys.executable,
        "-m",
        "manim",
        "-qh",
        str(SCENE_FILE),
        "PSOScene",
        "--disable_caching",
        "--media_dir",
        str(RENDER_DIR),
        "-o",
        output_file,
    ]

    try:
        env = os.environ.copy()
        env["PSO_CONFIG_PATH"] = str(config_file)
        result = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )
    finally:
        if config_file.exists():
            config_file.unlink()

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Rendering fehlgeschlagen.",
                "stderr": result.stderr[-2000:],
            },
        )

    video_paths = list(RENDER_DIR.rglob(output_file))
    if not video_paths:
        raise HTTPException(status_code=500, detail={"message": "Video nicht gefunden."})

    latest_video = max(video_paths, key=lambda p: p.stat().st_mtime)
    relative_path = latest_video.relative_to(RENDER_DIR).as_posix()
    return {"video_url": f"/renders/{relative_path}"}
