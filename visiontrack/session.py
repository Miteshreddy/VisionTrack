"""
VisionTrack — Session Manager

Manages the complete lifecycle of a tracking session:
  - Webcam or video file capture
  - Per-frame pipeline: capture → detect → track → annotate → encode
  - Broadcasting processed frames and analytics to connected WebSocket clients
  - Session state machine: IDLE → RUNNING → PAUSED → STOPPED

This is the core integration layer. It wires together the detector,
tracker manager, analytics engine, and zone manager into a single
frame-processing loop running in a background thread.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import threading
import time
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

import cv2
import numpy as np
import torch

from visiontrack.detector import YOLODetector, InferenceResult, get_detector
from visiontrack.tracker_manager import TrackerManager, TrackedObject
from visiontrack.analytics import AnalyticsEngine, get_analytics
from visiontrack.zone_manager import ZoneManager, get_zone_manager
from visiontrack import utils

logger = logging.getLogger("visiontrack.session")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# COCO class color palette (BGR) — cycle through if ID > len
_COLOR_PALETTE = [
    (86, 180, 233),   # sky blue
    (230, 159, 0),    # orange
    (0, 158, 115),    # teal
    (204, 121, 167),  # pink
    (213, 94, 0),     # vermilion
    (0, 114, 178),    # blue
    (240, 228, 66),   # yellow
    (0, 204, 153),    # green
]

# Trail colors (lighter versions of palette)
_TRAIL_ALPHA = 0.6


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

class SessionState(str, Enum):
    IDLE = "idle"
    LOADING = "loading"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


# ---------------------------------------------------------------------------
# Session settings (user-configurable)
# ---------------------------------------------------------------------------

class SessionSettings:
    def __init__(self):
        self.conf_thres: float = 0.35
        self.iou_thres: float = 0.45
        self.max_det: int = 300
        self.classes: Optional[List[int]] = None    # None = all classes
        self.tracker_type: str = "bytetrack"
        self.show_trails: bool = True
        self.trail_length: int = 30
        self.show_conf: bool = True
        self.show_id: bool = True
        self.show_class: bool = True
        self.frame_skip: int = 1                    # process every N-th frame
        self.output_width: int = 0                  # 0 = native, else resize
        self.jpeg_quality: int = 80                 # encode quality

    def update(self, **kwargs) -> None:
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)


# ---------------------------------------------------------------------------
# Main Session class
# ---------------------------------------------------------------------------

class TrackingSession:
    """
    Manages one complete tracking session from open to close.

    After calling start(), frames are processed in a background thread.
    Subscribers can register callbacks to receive annotated frames and
    analytics snapshots. The FastAPI WebSocket handler uses this.
    """

    def __init__(self):
        # Core components
        self.detector: YOLODetector = get_detector()
        self.tracker: TrackerManager = TrackerManager()
        self.analytics: AnalyticsEngine = get_analytics()
        self.zones: ZoneManager = get_zone_manager()

        # Settings
        self.settings: SessionSettings = SessionSettings()

        # State
        self._state: SessionState = SessionState.IDLE
        self._state_lock = threading.Lock()
        self._error_message: str = ""

        # Capture
        self._cap: Optional[cv2.VideoCapture] = None
        self._source: Any = None
        self._is_webcam: bool = False
        self._video_info: dict = {}

        # Processing thread
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # not paused initially

        # Frame broadcasting
        self._frame_callbacks: List[Callable] = []
        self._frame_id: int = 0
        self._latest_frame_b64: str = ""
        self._latest_analytics: dict = {}

        # Track detail store (track_id → detailed info)
        self._track_details: Dict[int, dict] = {}

        # For ReID-based trackers, track class names by ID
        self._id_to_class: Dict[int, str] = {}

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def load_model(
        self,
        weights: str = "yolov8n.pt",
        device: str = "",
        imgsz: int = 640,
    ) -> dict:
        """Load YOLO model. Returns model info dict."""
        with self._state_lock:
            self._state = SessionState.LOADING
        try:
            info = self.detector.load_model(weights, device, imgsz)
            self.analytics.set_metadata(
                device=info.device,
                model_name=info.model_name,
                tracker_name=self.settings.tracker_type,
            )
            return {
                "model_name": info.model_name,
                "device": info.device,
                "task": info.task,
                "num_classes": info.num_classes,
                "input_size": list(info.input_size),
                "class_names": info.class_names,
            }
        except Exception as e:
            with self._state_lock:
                self._state = SessionState.ERROR
                self._error_message = str(e)
            raise
        finally:
            with self._state_lock:
                if self._state == SessionState.LOADING:
                    self._state = SessionState.IDLE

    def open_source(self, source: Any) -> dict:
        """
        Open a video source (webcam index, file path, or URL).
        Returns info about the source.
        """
        if self._cap is not None:
            self._cap.release()

        # Determine webcam vs file
        if isinstance(source, int) or (isinstance(source, str) and source.isnumeric()):
            self._is_webcam = True
            idx = int(source)
            self._cap = cv2.VideoCapture(idx)
        else:
            self._is_webcam = False
            self._cap = cv2.VideoCapture(str(source))

        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open source: {source}")

        # Gather source info
        fps = self._cap.get(cv2.CAP_PROP_FPS) or 30
        width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))

        self._video_info = {
            "source": str(source),
            "is_webcam": self._is_webcam,
            "fps": fps,
            "width": width,
            "height": height,
            "total_frames": total_frames if total_frames > 0 else None,
            "duration_s": (total_frames / fps) if (total_frames > 0 and fps > 0) else None,
        }
        self._source = source
        logger.info(f"Source opened: {source} | {width}×{height} @ {fps:.1f}fps")
        return self._video_info

    def start(self) -> None:
        """Start the background processing thread."""
        if self._state in (SessionState.RUNNING,):
            return

        if not self.detector.is_loaded():
            raise RuntimeError("Model not loaded. Call load_model() first.")
        if self._cap is None or not self._cap.isOpened():
            raise RuntimeError("Source not opened. Call open_source() first.")

        # Initialize tracker
        self.tracker.initialize(
            tracker_type=self.settings.tracker_type,
            device=self.detector._device,
            trail_length=self.settings.trail_length,
        )
        self.analytics.reset()
        self.analytics.set_metadata(
            device=self.detector._device,
            model_name=self.detector._model_name,
            tracker_name=self.settings.tracker_type,
        )

        self._stop_event.clear()
        self._pause_event.set()
        self._frame_id = 0
        self._track_details.clear()

        self._thread = threading.Thread(target=self._processing_loop, daemon=True)
        self._thread.start()

        with self._state_lock:
            self._state = SessionState.RUNNING

        logger.info("Processing session started.")

    def stop(self) -> None:
        """Stop the processing thread and release capture."""
        self._stop_event.set()
        self._pause_event.set()  # unblock if paused

        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

        if self._cap is not None:
            self._cap.release()
            self._cap = None

        with self._state_lock:
            self._state = SessionState.STOPPED

        logger.info("Processing session stopped.")

    def pause(self) -> None:
        self._pause_event.clear()
        with self._state_lock:
            self._state = SessionState.PAUSED

    def resume(self) -> None:
        self._pause_event.set()
        with self._state_lock:
            self._state = SessionState.RUNNING

    def reset(self) -> None:
        """Stop current session and reset everything."""
        self.stop()
        self.analytics.reset()
        self.zones.clear_all()
        self._id_to_class.clear()
        self._track_details.clear()
        with self._state_lock:
            self._state = SessionState.IDLE

    # ------------------------------------------------------------------
    # Frame subscription
    # ------------------------------------------------------------------

    def subscribe(self, callback: Callable[[dict], None]) -> None:
        """Register a callback that receives each processed frame payload."""
        if callback not in self._frame_callbacks:
            self._frame_callbacks.append(callback)

    def unsubscribe(self, callback: Callable) -> None:
        self._frame_callbacks = [cb for cb in self._frame_callbacks if cb != callback]

    # ------------------------------------------------------------------
    # State accessors
    # ------------------------------------------------------------------

    @property
    def state(self) -> SessionState:
        with self._state_lock:
            return self._state

    @property
    def is_running(self) -> bool:
        return self.state == SessionState.RUNNING

    def get_status(self) -> dict:
        s = self.analytics.snapshot()
        return {
            "state": self.state.value,
            "error": self._error_message,
            "video_info": self._video_info,
            "analytics": s.to_dict(),
            "zone_counts": self.zones.get_line_counts(),
            "zone_occupancy": self.zones.get_zone_occupancy(),
        }

    def get_track_detail(self, track_id: int) -> Optional[dict]:
        return self._track_details.get(track_id)

    def get_latest_frame(self) -> Tuple[str, dict]:
        """Return (base64_jpeg, analytics_dict) for polling clients."""
        return self._latest_frame_b64, self._latest_analytics

    # ------------------------------------------------------------------
    # Processing loop (background thread)
    # ------------------------------------------------------------------

    def _processing_loop(self) -> None:
        """
        Main frame processing loop, runs in a daemon thread.

        Each iteration:
          1. Read frame from capture
          2. Run YOLO detection
          3. Run tracker update
          4. Compute zone events
          5. Update analytics
          6. Annotate frame (bboxes, labels, trails, zones)
          7. Encode to JPEG base64
          8. Broadcast to subscribers
        """
        frame_count = 0

        while not self._stop_event.is_set():
            # Respect pause
            self._pause_event.wait()
            if self._stop_event.is_set():
                break

            # Read frame
            if self._cap is None or not self._cap.isOpened():
                break

            ret, frame = self._cap.read()
            if not ret:
                if self._is_webcam:
                    # Transient webcam failure — wait and retry
                    time.sleep(0.05)
                    continue
                else:
                    # Video file ended
                    logger.info("Video file processing complete.")
                    with self._state_lock:
                        self._state = SessionState.STOPPED
                    break

            frame_count += 1
            self._frame_id += 1

            # Frame skip
            if self.settings.frame_skip > 1 and (frame_count % self.settings.frame_skip != 0):
                continue

            # Optional resize for performance
            if self.settings.output_width > 0:
                h, w = frame.shape[:2]
                scale = self.settings.output_width / w
                frame = cv2.resize(frame, (self.settings.output_width, int(h * scale)))

            try:
                payload = self._process_frame(frame, self._frame_id)
                self._latest_frame_b64 = payload.get("frame", "")
                self._latest_analytics = payload.get("analytics", {})

                # Notify subscribers (WebSocket handlers)
                for cb in list(self._frame_callbacks):
                    try:
                        cb(payload)
                    except Exception as e:
                        logger.warning(f"Subscriber callback error: {e}")

            except Exception as e:
                logger.error(f"Frame processing error (frame {self._frame_id}): {e}", exc_info=True)
                time.sleep(0.01)

    def _process_frame(self, frame: np.ndarray, frame_id: int) -> dict:
        """Run the full detection → tracking → analytics → annotation pipeline on one frame."""

        # 1. YOLO detection
        result: InferenceResult = self.detector.detect_frame(
            frame,
            conf_thres=self.settings.conf_thres,
            iou_thres=self.settings.iou_thres,
            classes=self.settings.classes,
            max_det=self.settings.max_det,
        )

        # 2. Tracker update
        det_array = result.to_tracker_input()
        tracked: List[TrackedObject] = self.tracker.update(det_array, frame, frame_id)

        # Enrich class names from detector (tracker only knows class IDs)
        for obj in tracked:
            name = self.detector.class_names.get(obj.class_id, f"class_{obj.class_id}")
            obj.class_name = name
            self._id_to_class[obj.track_id] = name

        # 3. Zone events
        zone_events = self.zones.update(tracked, frame_id)
        for ev in zone_events:
            self.analytics.add_zone_event(
                track_id=ev["track_id"],
                class_name=ev.get("class_name", ""),
                event_type=ev["event_type"],
                zone_name=ev.get("zone_name", ""),
            )

        # 4. Analytics update
        self.analytics.update(tracked, frame_id, inference_ms=result.inference_ms)

        # 5. Update track details store
        for obj in tracked:
            self._track_details[obj.track_id] = {
                "track_id": obj.track_id,
                "class_name": obj.class_name,
                "class_id": obj.class_id,
                "first_seen_frame": obj.first_seen_frame,
                "frames_tracked": obj.frames_tracked,
                "last_bbox": obj.bbox,
                "confidence": round(obj.confidence, 4),
                "status": "active",
            }

        # 6. Annotate frame
        annotated = self._annotate_frame(frame.copy(), tracked)

        # 7. Draw zones
        self.zones.draw_zones(annotated)

        # 8. Draw HUD overlay
        snap = self.analytics.snapshot()
        self._draw_hud(annotated, snap)

        # 9. Encode to JPEG base64
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), self.settings.jpeg_quality]
        _, buf = cv2.imencode(".jpg", annotated, encode_params)
        b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

        return {
            "frame": f"data:image/jpeg;base64,{b64}",
            "frame_id": frame_id,
            "detections": [t.to_dict() for t in tracked],
            "analytics": snap.to_dict(),
            "zone_counts": self.zones.get_line_counts(),
        }

    # ------------------------------------------------------------------
    # Frame annotation
    # ------------------------------------------------------------------

    def _annotate_frame(
        self, frame: np.ndarray, tracked: List[TrackedObject]
    ) -> np.ndarray:
        """Draw bounding boxes, labels, and motion trails on the frame."""

        # Draw trails first (underneath boxes)
        if self.settings.show_trails:
            all_trails = self.tracker.get_all_trails()
            for tid, trail_pts in all_trails.items():
                if len(trail_pts) < 2:
                    continue
                color = _get_color(tid)
                # Draw fading trail
                for i in range(1, len(trail_pts)):
                    alpha = i / len(trail_pts)
                    thickness = max(1, int(3 * alpha))
                    pt1 = (int(trail_pts[i - 1][0]), int(trail_pts[i - 1][1]))
                    pt2 = (int(trail_pts[i][0]), int(trail_pts[i][1]))
                    cv2.line(frame, pt1, pt2, color, thickness, cv2.LINE_AA)

        # Draw bounding boxes and labels
        for obj in tracked:
            color = _get_color(obj.track_id)

            x1, y1, x2, y2 = int(obj.x1), int(obj.y1), int(obj.x2), int(obj.y2)

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Build label string
            parts = []
            if self.settings.show_id:
                parts.append(f"#{obj.track_id}")
            if self.settings.show_class:
                parts.append(obj.class_name)
            if self.settings.show_conf:
                parts.append(f"{obj.confidence:.2f}")
            label = " ".join(parts)

            if label:
                # Label background
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
                lx, ly = x1, max(y1 - 8, th + 4)
                cv2.rectangle(frame, (lx, ly - th - 4), (lx + tw + 6, ly + 2), color, -1)
                cv2.putText(
                    frame, label,
                    (lx + 3, ly - 1),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (255, 255, 255), 1, cv2.LINE_AA
                )

        return frame

    def _draw_hud(self, frame: np.ndarray, snap) -> None:
        """Draw a minimal HUD with FPS and object count on the frame."""
        h, w = frame.shape[:2]

        # Semi-transparent bar at top
        bar_h = 28
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, bar_h), (17, 24, 39), -1)
        cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

        info = (
            f"VisionTrack  |  FPS: {snap.fps:.1f}  |  "
            f"Objects: {snap.current_objects}  |  "
            f"Tracked: {snap.unique_tracked}  |  "
            f"{snap.model_name.upper()}  {snap.device.upper()}"
        )
        cv2.putText(
            frame, info, (8, 18),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 210, 220), 1, cv2.LINE_AA
        )


# ---------------------------------------------------------------------------
# Helper: consistent color per track ID
# ---------------------------------------------------------------------------

def _get_color(track_id: int) -> Tuple[int, int, int]:
    return _COLOR_PALETTE[track_id % len(_COLOR_PALETTE)]


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_session: Optional[TrackingSession] = None
_session_lock = threading.Lock()


def get_session() -> TrackingSession:
    global _session
    with _session_lock:
        if _session is None:
            _session = TrackingSession()
    return _session
