"""
VisionTrack — Utility Functions

Shared helpers used across visiontrack modules.
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Tuple, Optional

import cv2
import numpy as np

logger = logging.getLogger("visiontrack.utils")

# Supported video/image extensions
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".ts", ".m4v"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}


def is_video_file(path: str) -> bool:
    return Path(path).suffix.lower() in VIDEO_EXTENSIONS


def is_image_file(path: str) -> bool:
    return Path(path).suffix.lower() in IMAGE_EXTENSIONS


def encode_frame_to_b64(frame: np.ndarray, quality: int = 80) -> str:
    """Encode a BGR numpy frame to a base64 JPEG data URL."""
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    _, buf = cv2.imencode(".jpg", frame, encode_params)
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def resize_frame(
    frame: np.ndarray, target_width: int
) -> np.ndarray:
    """Resize frame to target_width while preserving aspect ratio."""
    h, w = frame.shape[:2]
    if w == target_width:
        return frame
    scale = target_width / w
    new_h = int(h * scale)
    return cv2.resize(frame, (target_width, new_h), interpolation=cv2.INTER_LINEAR)


def read_image_from_upload(data: bytes) -> Optional[np.ndarray]:
    """Decode image bytes (from file upload) to BGR numpy array."""
    try:
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error(f"Failed to decode uploaded image: {e}")
        return None


def ensure_dir(path: Path) -> Path:
    """Create directory if it doesn't exist; return the path."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def format_duration(seconds: float) -> str:
    """Format seconds as HH:MM:SS string."""
    s = int(seconds)
    h, remainder = divmod(s, 3600)
    m, sec = divmod(remainder, 60)
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m:02d}:{sec:02d}"
