"""
VisionTrack — Pydantic API Schemas

Defines the request/response models for all API endpoints.
Using Pydantic v2 syntax (FastAPI 0.100+).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class LoadModelRequest(BaseModel):
    weights: str = Field(default="yolov8n.pt", description="YOLO weights filename or path")
    device: str = Field(default="", description="Device: '' for auto, 'cpu', '0' for GPU 0")
    imgsz: int = Field(default=640, description="Inference image size (square)")


class StartSessionRequest(BaseModel):
    source: str = Field(default="0", description="Source: '0' for webcam, path for video file")
    conf_thres: float = Field(default=0.35, ge=0.01, le=1.0)
    iou_thres: float = Field(default=0.45, ge=0.01, le=1.0)
    tracker_type: str = Field(default="bytetrack")
    show_trails: bool = Field(default=True)
    trail_length: int = Field(default=30, ge=5, le=100)
    classes: Optional[List[int]] = Field(default=None, description="Filter by class IDs (None = all)")
    frame_skip: int = Field(default=1, ge=1, le=10)
    output_width: int = Field(default=0, description="Output frame width, 0=native")


class UpdateSettingsRequest(BaseModel):
    conf_thres: Optional[float] = Field(default=None, ge=0.01, le=1.0)
    iou_thres: Optional[float] = Field(default=None, ge=0.01, le=1.0)
    classes: Optional[List[int]] = None
    show_trails: Optional[bool] = None
    trail_length: Optional[int] = Field(default=None, ge=5, le=100)
    show_conf: Optional[bool] = None
    show_id: Optional[bool] = None
    show_class: Optional[bool] = None
    frame_skip: Optional[int] = Field(default=None, ge=1, le=10)
    output_width: Optional[int] = None


class ZoneRequest(BaseModel):
    name: str
    points: List[List[int]] = Field(..., description="List of [x, y] polygon vertices")
    color: Optional[List[int]] = Field(default=None, description="BGR color [B, G, R]")


class LineRequest(BaseModel):
    name: str
    pt1: List[int] = Field(..., description="[x, y] start point")
    pt2: List[int] = Field(..., description="[x, y] end point")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ModelInfoResponse(BaseModel):
    model_name: str
    device: str
    task: str
    num_classes: int
    input_size: List[int]
    class_names: Dict[int, str]

    class Config:
        # Allow dict keys to be int (COCO class IDs)
        pass


class SessionStatusResponse(BaseModel):
    state: str
    error: str
    video_info: Dict[str, Any]
    analytics: Dict[str, Any]
    zone_counts: Dict[str, Any]
    zone_occupancy: Dict[str, Any]


class TrackDetailResponse(BaseModel):
    track_id: int
    class_name: str
    class_id: int
    first_seen_frame: int
    frames_tracked: int
    last_bbox: List[float]
    confidence: float
    status: str


class GenericResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
