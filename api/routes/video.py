"""
VisionTrack — Video / Source Routes

REST endpoints for managing the video source, uploading files,
and controlling the session (start, stop, pause, resume).

Endpoints:
  POST /video/load-model     — Load YOLO model
  POST /video/open           — Open webcam or video source
  POST /video/upload         — Upload a video file for processing
  POST /video/start          — Start processing
  POST /video/stop           — Stop processing
  POST /video/pause          — Pause processing
  POST /video/resume         — Resume processing
  POST /video/reset          — Reset entire session
  GET  /video/frame          — Get latest frame (polling fallback)
  POST /video/settings       — Update inference settings
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from api.schemas import (
    GenericResponse,
    LoadModelRequest,
    ModelInfoResponse,
    StartSessionRequest,
    UpdateSettingsRequest,
)
from visiontrack.session import get_session, SessionState
from visiontrack.utils import is_video_file, is_image_file

logger = logging.getLogger("visiontrack.routes.video")

router = APIRouter(prefix="/video", tags=["Video"])

# Temporary directory for uploaded files
_UPLOAD_DIR = Path(tempfile.gettempdir()) / "visiontrack_uploads"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

@router.post("/load-model", response_model=GenericResponse)
async def load_model(req: LoadModelRequest):
    """Load a YOLO model into the detector."""
    session = get_session()
    try:
        info = session.load_model(
            weights=req.weights,
            device=req.device,
            imgsz=req.imgsz,
        )
        return GenericResponse(
            success=True,
            message=f"Model '{info['model_name']}' loaded on {info['device']}",
            data=info,
        )
    except Exception as e:
        logger.error(f"Model load error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Model load failed: {e}")


# ---------------------------------------------------------------------------
# Source management
# ---------------------------------------------------------------------------

@router.post("/open", response_model=GenericResponse)
async def open_source(source: str = "0"):
    """Open a video source (webcam index or file path)."""
    session = get_session()
    try:
        info = session.open_source(source)
        return GenericResponse(
            success=True,
            message=f"Source opened: {source}",
            data=info,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload", response_model=GenericResponse)
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a video file for processing.
    File is saved to a temp directory, then opened as the current source.
    """
    # Validate file type
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()

    if suffix not in {".mp4", ".avi", ".mov", ".mkv", ".webm", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix}. Supported: mp4, avi, mov, mkv, webm, jpg, png",
        )

    # Save uploaded file
    dest = _UPLOAD_DIR / filename
    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Open as source
    session = get_session()
    try:
        info = session.open_source(str(dest))
        return GenericResponse(
            success=True,
            message=f"File uploaded and opened: {filename}",
            data={**info, "saved_path": str(dest)},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Session control
# ---------------------------------------------------------------------------

@router.post("/start", response_model=GenericResponse)
async def start_session(req: StartSessionRequest):
    """
    Configure and start a tracking session.
    Applies settings then starts the background processing thread.
    """
    session = get_session()

    # Apply settings from request
    session.settings.update(
        conf_thres=req.conf_thres,
        iou_thres=req.iou_thres,
        tracker_type=req.tracker_type,
        show_trails=req.show_trails,
        trail_length=req.trail_length,
        classes=req.classes,
        frame_skip=req.frame_skip,
        output_width=req.output_width,
    )

    # Open source if not already open
    try:
        if session._cap is None or not session._cap.isOpened():
            session.open_source(req.source)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Start processing
    try:
        session.start()
        return GenericResponse(
            success=True,
            message="Session started",
            data={"state": session.state.value},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stop", response_model=GenericResponse)
async def stop_session():
    """Stop the current tracking session."""
    session = get_session()
    session.stop()
    return GenericResponse(success=True, message="Session stopped")


@router.post("/pause", response_model=GenericResponse)
async def pause_session():
    """Pause the current tracking session."""
    session = get_session()
    session.pause()
    return GenericResponse(success=True, message="Session paused")


@router.post("/resume", response_model=GenericResponse)
async def resume_session():
    """Resume a paused tracking session."""
    session = get_session()
    session.resume()
    return GenericResponse(success=True, message="Session resumed")


@router.post("/reset", response_model=GenericResponse)
async def reset_session():
    """Stop session, reset all state, clear analytics and zones."""
    session = get_session()
    session.reset()
    return GenericResponse(success=True, message="Session reset")


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@router.post("/settings", response_model=GenericResponse)
async def update_settings(req: UpdateSettingsRequest):
    """Update inference / display settings while session is running."""
    session = get_session()
    update_dict = {k: v for k, v in req.model_dump().items() if v is not None}
    session.settings.update(**update_dict)
    return GenericResponse(
        success=True,
        message="Settings updated",
        data=update_dict,
    )


# ---------------------------------------------------------------------------
# Polling endpoint (fallback for no-WebSocket clients)
# ---------------------------------------------------------------------------

@router.get("/frame")
async def get_latest_frame():
    """Return the latest processed frame and analytics as JSON (polling fallback)."""
    session = get_session()
    b64, analytics = session.get_latest_frame()
    return {
        "frame": b64,
        "analytics": analytics,
        "state": session.state.value,
    }
