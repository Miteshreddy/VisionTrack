"""
VisionTrack — Session & Analytics Routes

REST endpoints for reading session state, analytics, track details,
zone management, and exporting data.

Endpoints:
  GET  /session/status         — Full session status + analytics snapshot
  GET  /session/analytics      — Analytics snapshot only
  GET  /session/tracks         — List all active tracks
  GET  /session/track/{id}     — Detail for a specific track
  POST /session/zone           — Add a zone
  DELETE /session/zone/{name}  — Remove a zone
  POST /session/line           — Add a counting line
  DELETE /session/line/{name}  — Remove a counting line
  GET  /session/export/csv     — Export analytics as CSV
"""

from __future__ import annotations

import csv
import io
import logging
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.schemas import (
    GenericResponse,
    LineRequest,
    SessionStatusResponse,
    TrackDetailResponse,
    ZoneRequest,
)
from visiontrack.session import get_session
from visiontrack.analytics import get_analytics
from visiontrack.zone_manager import get_zone_manager

logger = logging.getLogger("visiontrack.routes.session")

router = APIRouter(prefix="/session", tags=["Session"])


# ---------------------------------------------------------------------------
# Status & analytics
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_status():
    """Return complete session status including analytics snapshot."""
    session = get_session()
    return session.get_status()


@router.get("/analytics")
async def get_analytics_snapshot():
    """Return current analytics snapshot."""
    analytics = get_analytics()
    return analytics.snapshot().to_dict()


# ---------------------------------------------------------------------------
# Track management
# ---------------------------------------------------------------------------

@router.get("/tracks")
async def get_active_tracks():
    """Return list of all known tracks (active and recently lost)."""
    session = get_session()
    return {"tracks": list(session._track_details.values())}


@router.get("/track/{track_id}", response_model=TrackDetailResponse)
async def get_track_detail(track_id: int):
    """Return detailed info for a single tracked object."""
    session = get_session()
    detail = session.get_track_detail(track_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Track ID {track_id} not found")
    return detail


# ---------------------------------------------------------------------------
# Zone management
# ---------------------------------------------------------------------------

@router.post("/zone", response_model=GenericResponse)
async def add_zone(req: ZoneRequest):
    """Add a polygon ROI zone."""
    zm = get_zone_manager()
    points = [tuple(p) for p in req.points]
    color = tuple(req.color) if req.color else (0, 200, 100)
    zm.add_zone(req.name, points, color=color)
    return GenericResponse(success=True, message=f"Zone '{req.name}' added")


@router.delete("/zone/{name}", response_model=GenericResponse)
async def remove_zone(name: str):
    """Remove a named zone."""
    zm = get_zone_manager()
    zm.remove_zone(name)
    return GenericResponse(success=True, message=f"Zone '{name}' removed")


@router.delete("/zones", response_model=GenericResponse)
async def clear_zones():
    """Remove all zones."""
    get_zone_manager().clear_zones()
    return GenericResponse(success=True, message="All zones cleared")


# ---------------------------------------------------------------------------
# Counting line management
# ---------------------------------------------------------------------------

@router.post("/line", response_model=GenericResponse)
async def add_line(req: LineRequest):
    """Add a counting line."""
    zm = get_zone_manager()
    zm.add_line(req.name, tuple(req.pt1), tuple(req.pt2))
    return GenericResponse(success=True, message=f"Counting line '{req.name}' added")


@router.delete("/line/{name}", response_model=GenericResponse)
async def remove_line(name: str):
    """Remove a named counting line."""
    get_zone_manager().remove_line(name)
    return GenericResponse(success=True, message=f"Line '{name}' removed")


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.get("/export/csv")
async def export_csv():
    """Export current analytics summary as CSV."""
    analytics = get_analytics()
    snap = analytics.snapshot()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["VisionTrack Analytics Export"])
    writer.writerow(["Model", snap.model_name])
    writer.writerow(["Device", snap.device])
    writer.writerow(["Tracker", snap.tracker_name])
    writer.writerow(["Session Duration (s)", snap.session_duration_s])
    writer.writerow(["FPS", snap.fps])
    writer.writerow(["Total Unique Tracked", snap.unique_tracked])
    writer.writerow(["Frames Processed", snap.frame_id])
    writer.writerow([])

    # Class counts
    writer.writerow(["Class", "Total Detections"])
    for cls, count in sorted(snap.class_counts_total.items()):
        writer.writerow([cls, count])
    writer.writerow([])

    # Timeline events
    writer.writerow(["Timestamp", "Frame", "Track ID", "Class", "Event", "Zone"])
    for ev in snap.timeline:
        writer.writerow([
            ev.get("timestamp", ""),
            ev.get("frame_id", ""),
            ev.get("track_id", ""),
            ev.get("class_name", ""),
            ev.get("event_type", ""),
            ev.get("zone_name", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=visiontrack_analytics.csv"},
    )
