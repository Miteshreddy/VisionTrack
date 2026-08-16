"""
VisionTrack — Zone Manager

Handles configurable Regions of Interest (ROI) and counting lines.
Zone events (enter/exit) and line crossings are computed from actual
tracked object positions — nothing is fabricated.

Responsibilities:
  - Store polygon zones defined by the user (via frontend)
  - Detect when a tracked object enters or exits a zone
  - Implement a bi-directional counting line (objects counted crossing direction)
  - Return zone events for the analytics timeline
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import numpy as np
import cv2

logger = logging.getLogger("visiontrack.zone_manager")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Zone:
    """A polygon zone on the video frame."""
    name: str
    points: List[Tuple[int, int]]   # list of (x, y) polygon vertices
    color: Tuple[int, int, int] = (0, 255, 100)  # BGR
    alpha: float = 0.25             # overlay transparency

    def contains_point(self, x: float, y: float) -> bool:
        """Check if point (x, y) is inside this polygon zone."""
        if len(self.points) < 3:
            return False
        pt = (float(x), float(y))
        poly = np.array(self.points, dtype=np.float32)
        result = cv2.pointPolygonTest(poly, pt, False)
        return result >= 0


@dataclass
class CountingLine:
    """A horizontal or diagonal line that counts object crossings."""
    name: str
    pt1: Tuple[int, int]    # start point (x, y)
    pt2: Tuple[int, int]    # end point (x, y)
    color: Tuple[int, int, int] = (255, 200, 0)  # BGR yellow

    # Cumulative counts
    count_a: int = 0        # crossed left-to-right / top-to-bottom
    count_b: int = 0        # crossed right-to-left / bottom-to-top

    def _side(self, x: float, y: float) -> int:
        """
        Return which side of the line a point is on.
        Uses the sign of the cross product.
        """
        dx = self.pt2[0] - self.pt1[0]
        dy = self.pt2[1] - self.pt1[1]
        # Cross product of (pt2-pt1) × (point-pt1)
        val = dx * (y - self.pt1[1]) - dy * (x - self.pt1[0])
        return 1 if val > 0 else -1


# ---------------------------------------------------------------------------
# Zone Manager
# ---------------------------------------------------------------------------

class ZoneManager:
    """
    Manages zones and counting lines for a tracking session.

    Usage:
        zm = ZoneManager()
        zm.add_zone("Entrance", [(100,100),(400,100),(400,300),(100,300)])
        zm.add_line("Counter", (0, 300), (640, 300))
        events = zm.update(tracked_objects, frame_id)
        zm.draw_zones(frame)
    """

    def __init__(self):
        self._zones: Dict[str, Zone] = {}
        self._lines: Dict[str, CountingLine] = {}
        # Track state for zone occupancy: track_id → set of zone names it's in
        self._zone_state: Dict[int, set] = {}
        # Track state for line crossing: track_id → {line_name: last_side}
        self._line_state: Dict[int, Dict[str, int]] = {}

    # ------------------------------------------------------------------
    # Zone management
    # ------------------------------------------------------------------

    def add_zone(
        self,
        name: str,
        points: List[Tuple[int, int]],
        color: Tuple[int, int, int] = (0, 200, 100),
    ) -> None:
        self._zones[name] = Zone(name=name, points=points, color=color)
        logger.info(f"Zone added: {name} with {len(points)} vertices")

    def remove_zone(self, name: str) -> None:
        self._zones.pop(name, None)

    def clear_zones(self) -> None:
        self._zones.clear()
        self._zone_state.clear()

    def add_line(
        self,
        name: str,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        color: Tuple[int, int, int] = (255, 200, 0),
    ) -> None:
        self._lines[name] = CountingLine(name=name, pt1=pt1, pt2=pt2, color=color)
        logger.info(f"Counting line added: {name}")

    def remove_line(self, name: str) -> None:
        self._lines.pop(name, None)

    def clear_lines(self) -> None:
        self._lines.clear()
        self._line_state.clear()

    def clear_all(self) -> None:
        self.clear_zones()
        self.clear_lines()

    # ------------------------------------------------------------------
    # Update (called each frame)
    # ------------------------------------------------------------------

    def update(self, tracked_objects: list, frame_id: int) -> List[dict]:
        """
        Compute zone and line events for the current frame.

        Args:
            tracked_objects: List[TrackedObject] from TrackerManager
            frame_id:        Current frame index

        Returns:
            List of event dicts: {track_id, class_name, event_type, zone_name}
        """
        events = []

        for obj in tracked_objects:
            tid = obj.track_id
            cx, cy = obj.center

            # --- Zone check ---
            if tid not in self._zone_state:
                self._zone_state[tid] = set()

            currently_in = set()
            for zone_name, zone in self._zones.items():
                if zone.contains_point(cx, cy):
                    currently_in.add(zone_name)

            prev_in = self._zone_state[tid]
            entered = currently_in - prev_in
            exited = prev_in - currently_in

            for zone_name in entered:
                events.append({
                    "track_id": tid,
                    "class_name": obj.class_name,
                    "event_type": "zone_entered",
                    "zone_name": zone_name,
                })
            for zone_name in exited:
                events.append({
                    "track_id": tid,
                    "class_name": obj.class_name,
                    "event_type": "zone_exited",
                    "zone_name": zone_name,
                })

            self._zone_state[tid] = currently_in

            # --- Line crossing check ---
            if tid not in self._line_state:
                self._line_state[tid] = {}

            for line_name, line in self._lines.items():
                side = line._side(cx, cy)
                prev_side = self._line_state[tid].get(line_name)

                if prev_side is not None and prev_side != side:
                    # Object crossed the line
                    if side == 1:
                        line.count_a += 1
                        direction = "A→B"
                    else:
                        line.count_b += 1
                        direction = "B→A"

                    events.append({
                        "track_id": tid,
                        "class_name": obj.class_name,
                        "event_type": "line_crossed",
                        "zone_name": line_name,
                        "direction": direction,
                        "count_a": line.count_a,
                        "count_b": line.count_b,
                    })

                self._line_state[tid][line_name] = side

        return events

    # ------------------------------------------------------------------
    # Drawing
    # ------------------------------------------------------------------

    def draw_zones(self, frame: np.ndarray) -> np.ndarray:
        """Draw all zones and counting lines onto the frame in-place."""
        overlay = frame.copy()

        for zone in self._zones.values():
            pts = np.array(zone.points, dtype=np.int32)
            cv2.fillPoly(overlay, [pts], zone.color)
            cv2.polylines(frame, [pts], isClosed=True, color=zone.color, thickness=2)
            # Label
            if zone.points:
                cx = int(np.mean([p[0] for p in zone.points]))
                cy = int(np.mean([p[1] for p in zone.points]))
                cv2.putText(
                    frame, zone.name, (cx - 30, cy),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, zone.color, 2
                )

        # Blend overlay for zone fill transparency
        cv2.addWeighted(overlay, zone.alpha if self._zones else 0, frame, 1, 0, frame)

        for line in self._lines.values():
            cv2.line(frame, line.pt1, line.pt2, line.color, 2)
            mid_x = (line.pt1[0] + line.pt2[0]) // 2
            mid_y = (line.pt1[1] + line.pt2[1]) // 2
            label = f"{line.name}  ↓{line.count_a}  ↑{line.count_b}"
            cv2.putText(
                frame, label, (mid_x - 60, mid_y - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, line.color, 2
            )

        return frame

    def get_line_counts(self) -> Dict[str, dict]:
        """Return current counts for all counting lines."""
        return {
            name: {"count_a": line.count_a, "count_b": line.count_b}
            for name, line in self._lines.items()
        }

    def get_zone_occupancy(self) -> Dict[str, int]:
        """Return number of tracked objects currently in each zone."""
        occupancy: Dict[str, int] = {name: 0 for name in self._zones}
        for zones_in in self._zone_state.values():
            for z in zones_in:
                if z in occupancy:
                    occupancy[z] += 1
        return occupancy


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_zone_manager: Optional[ZoneManager] = None


def get_zone_manager() -> ZoneManager:
    global _zone_manager
    if _zone_manager is None:
        _zone_manager = ZoneManager()
    return _zone_manager
