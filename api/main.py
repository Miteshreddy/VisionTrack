"""
VisionTrack — FastAPI Application

Main entry point for the VisionTrack backend.
Mounts the frontend static files, registers all API routers,
and configures CORS for local development.

Architecture:
  - Static files served from /frontend/ at the root URL
  - REST API at /api/...
  - WebSocket at /ws/stream
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure the project root is importable
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.routes import stream, video, session as session_routes

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("visiontrack.api")


# ---------------------------------------------------------------------------
# Application lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan: runs at startup and shutdown.
    We pre-load the default YOLO model so the first request is fast.
    """
    from visiontrack.session import get_session

    logger.info("=" * 60)
    logger.info("  VisionTrack — Real-Time Object Detection & Tracking")
    logger.info("=" * 60)

    # Pre-load default model
    try:
        sess = get_session()
        info = sess.load_model(weights="yolov8n.pt")
        logger.info(
            f"Model ready: {info['model_name']} | "
            f"Device: {info['device']} | "
            f"Classes: {info['num_classes']}"
        )
    except Exception as e:
        logger.warning(f"Could not pre-load model at startup: {e}")
        logger.info("Model will be loaded on first /video/load-model request.")

    yield

    # Shutdown: stop any running session
    try:
        from visiontrack.session import get_session
        sess = get_session()
        if sess.is_running:
            sess.stop()
            logger.info("Session stopped on shutdown.")
    except Exception:
        pass

    logger.info("VisionTrack server shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="VisionTrack",
    description="Real-Time Object Detection & Tracking Analytics",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS — allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------

# Prefix all REST endpoints under /api
app.include_router(video.router, prefix="/api")
app.include_router(session_routes.router, prefix="/api")

# WebSocket has no /api prefix (WebSocket URLs are cleaner without it)
app.include_router(stream.router)

# ---------------------------------------------------------------------------
# Static file serving (frontend)
# ---------------------------------------------------------------------------

FRONTEND_DIR = ROOT / "frontend"

# ---------------------------------------------------------------------------
# Health check  (declared BEFORE the catch-all SPA route)
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
async def health():
    """API health check."""
    from visiontrack.session import get_session
    sess = get_session()
    return {
        "status": "ok",
        "service": "VisionTrack",
        "version": "1.0.0",
        "model_loaded": sess.detector.is_loaded(),
        "session_state": sess.state.value,
    }

# ---------------------------------------------------------------------------
# Static file serving (frontend)
# ---------------------------------------------------------------------------

if FRONTEND_DIR.exists():
    # Mount CSS and JS subdirectories
    if (FRONTEND_DIR / "css").exists():
        app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    if (FRONTEND_DIR / "js").exists():
        app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_frontend(path: str):
        """Serve frontend files; fall back to index.html for SPA routing."""
        # Never intercept API routes
        if path.startswith("api/") or path.startswith("ws/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        file_path = FRONTEND_DIR / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # SPA fallback
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/", include_in_schema=False)
    async def no_frontend():
        return {"message": "VisionTrack API running. Frontend not found.", "docs": "/api/docs"}
