from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from widgets import eps_trend, finrl_signal

app = FastAPI(title="OpenBB x AI4Finance workbench backend")
app.add_middleware(CORSMiddleware, allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+", allow_methods=["*"], allow_headers=["*"])
app.include_router(finrl_signal.router)
app.include_router(eps_trend.router)


@app.get("/widgets.json")
def widgets_json():
    return FileResponse(Path(__file__).parent / "widgets.json")


# Phase 6 dashboard: `cd ui && npm run build` produces ui/dist; serve it at / (mounted last so API routes win).
UI_DIST = Path(__file__).resolve().parents[1] / "ui" / "dist"
if UI_DIST.is_dir():
    app.mount("/", StaticFiles(directory=UI_DIST, html=True), name="ui")
