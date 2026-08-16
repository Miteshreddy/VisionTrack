"""
VisionTrack — Analytics Engine

Computes real-time analytics derived from tracked objects.
All metrics come from actual detection/tracking data — nothing fabricated.

Responsibilities:
  - FPS measurement (rolling window over real frame timestamps)
  - Objects currently visible (active tracked IDs this frame)
  - Unique objects tracked (distinct IDs seen over the session)
  - Class counts (current frame + cumulative)
  - Session duration
  - Timeline events (new track appeared, track lost, zone crossed)
  - Inference latency (passed in from detector)
"""

from __future__ import annotations

import time
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Deque
import threading

logger = logging.getLogger("visiontrack.analytics")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TimelineEvent:
    """A single event in the session timeline."""
    timestamp: float        # unix time
    frame_id: int
    track_id: int
    class_name: str
    event_type: str         # 'appeared', 'lost', 'zone_entered', 'zone_exited', 'line_crossed'
    zone_name: str = ""

    def to_dict(self) -> dict:
        import datetime
        dt = datetime.datetime.fromtimestamp(self.timestamp)
        return {
            "timestamp": dt.strftime("%H:%M:%S"),
            "frame_id": self.frame_id,
            "track_id": self.track_id,
            "class_name": self.class_name,
            "event_type": self.event_type,
            "zone_name": self.zone_name,
        }


@dataclass
class AnalyticsSnapshot:
    """Point-in-time analytics snapshot sent to the frontend."""
    fps: float
    current_objects: int
    unique_tracked: int
    class_counts_current: Dict[str, int]    # classes in current frame
    class_counts_total: Dict[str, int]       # cumulative detections by class
    active_track_ids: List[int]
    inference_ms: float
    frame_id: int
    session_duration_s: float
    device: str
    model_name: str
    tracker_name: str
    timeline: List[dict]                     # last N events

    def to_dict(self) -> dict:
        return {
            "fps": round(self.fps, 1),
            "current_objects": self.current_objects,
            "unique_tracked": self.unique_tracked,
            "class_counts_current": self.class_counts_current,
            "class_counts_total": self.class_counts_total,
            "active_track_ids": self.active_track_ids,
            "inference_ms": round(self.inference_ms, 1),
            "frame_id": self.frame_id,
            "session_duration_s": round(self.session_duration_s, 1),
            "device": self.device,
            "model_name": self.model_name,
            "tracker_name": self.tracker_name,
            "timeline": self.timeline,
        }


# ---------------------------------------------------------------------------
# Analytics Engine
# ---------------------------------------------------------------------------

class AnalyticsEngine:
    """
    Stateful analytics accumulator.

    Call update() after each frame's tracking output.
    Call snapshot() to get the current analytics state.
    """

    # Rolling window size for FPS calculation
    FPS_WINDOW = 30
    # Maximum timeline events to keep
    TIMELINE_MAX = 100

    def __init__(self):
        self._lock = threading.Lock()
        self.reset()

    def reset(self):
        """Reset all analytics to initial state."""
        with self._lock if hasattr(self, '_lock') else _NullCtx():
            self._frame_timestamps: Deque[float] = deque(maxlen=self.FPS_WINDOW)
            self._session_start: float = time.time()
            self._frame_id: int = 0

            # Per-session cumulative
            self._unique_ids: set = set()
            self._class_counts_total: Dict[str, int] = defaultdict(int)

            # Per-frame current state
            self._current_ids: List[int] = []
            self._current_class_counts: Dict[str, int] = {}
            self._last_inference_ms: float = 0.0

            # Timeline
            self._timeline: Deque[TimelineEvent] = deque(maxlen=self.TIMELINE_MAX)
            self._active_ids_prev: set = set()

            # Info strings
            self._device: str = "cpu"
            self._model_name: str = "unknown"
            self._tracker_name: str = "unknown"

    def set_metadata(self, device: str, model_name: str, tracker_name: str):
        """Set model/tracker info for display in analytics."""
        self._device = device
        self._model_name = model_name
        self._tracker_name = tracker_name

    def update(
        self,
        tracked_objects: list,          # List[TrackedObject]
        frame_id: int,
        inference_ms: float = 0.0,
    ) -> None:
        """
        Process one frame's tracking output and update all metrics.

        Args:
            tracked_objects: List of TrackedObject from TrackerManager.update()
            frame_id:        Current frame index
            inference_ms:    Inference latency in milliseconds from detector
        """
        now = time.time()

        with self._lock:
            self._frame_id = frame_id
            self._frame_timestamps.append(now)
            self._last_inference_ms = inference_ms

            # Current frame IDs and class counts
            current_ids = set()
            class_counts: Dict[str, int] = defaultdict(int)

            for obj in tracked_objects:
                current_ids.add(obj.track_id)
                class_counts[obj.class_name] += 1
                self._unique_ids.add(obj.track_id)
                self._class_counts_total[obj.class_name] += 1

            self._current_ids = sorted(current_ids)
            self._current_class_counts = dict(class_counts)

            # Timeline events: new tracks
            new_ids = current_ids - self._active_ids_prev
            lost_ids = self._active_ids_prev - current_ids

            for obj in tracked_objects:
                if obj.track_id in new_ids:
                    self._timeline.append(TimelineEvent(
                        timestamp=now,
                        frame_id=frame_id,
                        track_id=obj.track_id,
                        class_name=obj.class_name,
                        event_type="appeared",
                    ))

            for tid in lost_ids:
                self._timeline.append(TimelineEvent(
                    timestamp=now,
                    frame_id=frame_id,
                    track_id=tid,
                    class_name="",
                    event_type="lost",
                ))

            self._active_ids_prev = current_ids

    def add_zone_event(
        self,
        track_id: int,
        class_name: str,
        event_type: str,
        zone_name: str = "",
    ) -> None:
        """Record a zone or line-crossing event from ZoneManager."""
        with self._lock:
            self._timeline.append(TimelineEvent(
                timestamp=time.time(),
                frame_id=self._frame_id,
                track_id=track_id,
                class_name=class_name,
                event_type=event_type,
                zone_name=zone_name,
            ))

    def snapshot(self) -> AnalyticsSnapshot:
        """Return a point-in-time snapshot of all analytics."""
        with self._lock:
            fps = self._compute_fps()
            duration = time.time() - self._session_start
            timeline_dicts = [e.to_dict() for e in reversed(self._timeline)]

            return AnalyticsSnapshot(
                fps=fps,
                current_objects=len(self._current_ids),
                unique_tracked=len(self._unique_ids),
                class_counts_current=dict(self._current_class_counts),
                class_counts_total=dict(self._class_counts_total),
                active_track_ids=list(self._current_ids),
                inference_ms=self._last_inference_ms,
                frame_id=self._frame_id,
                session_duration_s=duration,
                device=self._device,
                model_name=self._model_name,
                tracker_name=self._tracker_name,
                timeline=timeline_dicts[:30],  # last 30 events for UI
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_fps(self) -> float:
        """
        Compute FPS from the rolling window of frame timestamps.
        Returns 0.0 if fewer than 2 frames have been processed.
        """
        timestamps = list(self._frame_timestamps)
        if len(timestamps) < 2:
            return 0.0
        elapsed = timestamps[-1] - timestamps[0]
        if elapsed <= 0:
            return 0.0
        return (len(timestamps) - 1) / elapsed


# ---------------------------------------------------------------------------
# Null context manager for reset() before lock exists
# ---------------------------------------------------------------------------

class _NullCtx:
    def __enter__(self): return self
    def __exit__(self, *a): pass


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_analytics: Optional[AnalyticsEngine] = None


def get_analytics() -> AnalyticsEngine:
    global _analytics
    if _analytics is None:
        _analytics = AnalyticsEngine()
    return _analytics
