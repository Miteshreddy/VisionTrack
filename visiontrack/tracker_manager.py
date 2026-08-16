"""
VisionTrack — Tracker Manager

Wraps the existing tracker implementations in trackers/ with a clean,
unified interface. All trackers (ByteTrack, OC-SORT, etc.) take raw
numpy detection arrays and return tracked object outputs.

Responsibilities:
  - Initialize the correct tracker based on user selection
  - Accept InferenceResult / raw numpy detections
  - Return TrackedObject list with persistent IDs
  - Manage tracker lifecycle (reset, reinitialize)
  - Maintain trail history for motion visualization
"""

from __future__ import annotations

import sys
import logging
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Deque
from collections import deque

import numpy as np
import torch

# Ensure the project root is on the path so trackers/ is importable
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "trackers" / "strongsort") not in sys.path:
    sys.path.insert(0, str(ROOT / "trackers" / "strongsort"))

logger = logging.getLogger("visiontrack.tracker_manager")

# Tracker names that require ReID model weights
REID_TRACKERS = {"strongsort", "botsort", "deepocsort"}
# Trackers that work with IoU only (no extra weights needed)
ION_TRACKERS = {"bytetrack", "ocsort"}

SUPPORTED_TRACKERS = list(ION_TRACKERS) + list(REID_TRACKERS)

# Default ReID weights name (must be present in weights/ directory)
DEFAULT_REID_WEIGHTS = ROOT / "weights" / "osnet_x0_25_msmt17.pt"


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TrackedObject:
    """A single tracked object output from the tracker."""
    track_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    class_id: int
    class_name: str
    confidence: float
    frame_id: int
    # Set by session layer, not the tracker itself
    first_seen_frame: int = 0
    frames_tracked: int = 0

    @property
    def bbox(self) -> list[float]:
        return [self.x1, self.y1, self.x2, self.y2]

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)

    def to_dict(self) -> dict:
        return {
            "track_id": self.track_id,
            "bbox": self.bbox,
            "class_id": self.class_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "frame_id": self.frame_id,
            "first_seen_frame": self.first_seen_frame,
            "frames_tracked": self.frames_tracked,
        }


# ---------------------------------------------------------------------------
# Tracker Manager
# ---------------------------------------------------------------------------

class TrackerManager:
    """
    Unified tracker interface over the implementations in trackers/.

    Usage:
        mgr = TrackerManager()
        mgr.initialize("bytetrack")
        tracked = mgr.update(inference_result, frame_id=42)
    """

    def __init__(self, trail_length: int = 30):
        self._tracker = None
        self._tracker_type: str = ""
        self._device = None
        self._half: bool = False
        self._trail_length = trail_length

        # Trail history: track_id → deque of (cx, cy) points
        self._trails: Dict[int, Deque] = {}
        # Track metadata: track_id → {first_seen, frames_tracked}
        self._track_meta: Dict[int, dict] = {}
        self._frame_id: int = 0

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def initialize(
        self,
        tracker_type: str = "bytetrack",
        reid_weights: Optional[str] = None,
        device: str = "cpu",
        half: bool = False,
        trail_length: int = 30,
    ) -> None:
        """
        Initialize (or reinitialize) the tracker.

        Args:
            tracker_type: One of 'bytetrack', 'ocsort', 'strongsort', 'botsort', 'deepocsort'
            reid_weights: Path to ReID .pt file (required for strongsort/botsort/deepocsort)
            device:       'cpu' or 'cuda:0'
            half:         Use FP16 (GPU only)
            trail_length: Number of past positions to keep per track
        """
        tracker_type = tracker_type.lower()
        if tracker_type not in SUPPORTED_TRACKERS:
            raise ValueError(
                f"Unknown tracker '{tracker_type}'. "
                f"Supported: {SUPPORTED_TRACKERS}"
            )

        self._tracker_type = tracker_type
        self._trail_length = trail_length
        self._device = torch.device(device)
        self._half = half

        # Reset state
        self._trails.clear()
        self._track_meta.clear()
        self._frame_id = 0

        cfg_path = (
            ROOT / "trackers" / tracker_type / "configs" / f"{tracker_type}.yaml"
        )

        if tracker_type == "bytetrack":
            self._tracker = self._init_bytetrack(cfg_path)
        elif tracker_type == "ocsort":
            self._tracker = self._init_ocsort(cfg_path)
        elif tracker_type in REID_TRACKERS:
            w = Path(reid_weights) if reid_weights else DEFAULT_REID_WEIGHTS
            if not w.exists():
                logger.warning(
                    f"ReID weights not found at {w}. "
                    f"Falling back to bytetrack."
                )
                self._tracker_type = "bytetrack"
                cfg_path = ROOT / "trackers" / "bytetrack" / "configs" / "bytetrack.yaml"
                self._tracker = self._init_bytetrack(cfg_path)
            else:
                self._tracker = self._init_reid_tracker(tracker_type, cfg_path, w)

        logger.info(f"Tracker initialized: {self._tracker_type}")

    # ------------------------------------------------------------------
    # Tracking update
    # ------------------------------------------------------------------

    def update(
        self,
        det_array: np.ndarray,
        frame: np.ndarray,
        frame_id: Optional[int] = None,
    ) -> List[TrackedObject]:
        """
        Update tracker with new detections and return active tracked objects.

        Args:
            det_array:  (N, 6) numpy array [x1, y1, x2, y2, conf, cls_id]
            frame:      Original BGR frame (used by some trackers for camera motion)
            frame_id:   Current frame index (auto-incremented if None)

        Returns:
            List of TrackedObject with persistent IDs.
        """
        if self._tracker is None:
            raise RuntimeError("Tracker not initialized. Call initialize() first.")

        if frame_id is not None:
            self._frame_id = frame_id
        else:
            self._frame_id += 1

        # Convert to torch tensor for trackers that expect it
        if len(det_array) == 0:
            det_tensor = torch.zeros((0, 6), dtype=torch.float32)
        else:
            det_tensor = torch.from_numpy(det_array.astype(np.float32))

        # Run tracker update
        try:
            outputs = self._tracker.update(det_tensor, frame)
        except Exception as e:
            logger.error(f"Tracker update error: {e}")
            return []

        # Parse outputs: each row is [x1, y1, x2, y2, track_id, cls_id, conf]
        tracked = []
        current_ids = set()

        for out in outputs:
            try:
                out = list(out)
                x1, y1, x2, y2 = float(out[0]), float(out[1]), float(out[2]), float(out[3])
                tid = int(out[4])
                cls_id = int(out[5])
                conf = float(out[6]) if len(out) > 6 else 0.5

                # Get class name from the det_array (match by class_id)
                # We import class names from the detector in session.py
                cls_name = f"class_{cls_id}"

                current_ids.add(tid)

                # Update trail
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                if tid not in self._trails:
                    self._trails[tid] = deque(maxlen=self._trail_length)
                    self._track_meta[tid] = {
                        "first_seen_frame": self._frame_id,
                        "frames_tracked": 0,
                    }
                self._trails[tid].append((cx, cy))
                self._track_meta[tid]["frames_tracked"] += 1

                tracked.append(
                    TrackedObject(
                        track_id=tid,
                        x1=x1, y1=y1, x2=x2, y2=y2,
                        class_id=cls_id,
                        class_name=cls_name,
                        confidence=conf,
                        frame_id=self._frame_id,
                        first_seen_frame=self._track_meta[tid]["first_seen_frame"],
                        frames_tracked=self._track_meta[tid]["frames_tracked"],
                    )
                )
            except (IndexError, ValueError) as e:
                logger.warning(f"Error parsing tracker output row: {e}")
                continue

        return tracked

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_trail(self, track_id: int) -> List[tuple]:
        """Return the trail (list of (cx, cy)) for a given track ID."""
        return list(self._trails.get(track_id, []))

    def get_all_trails(self) -> Dict[int, List[tuple]]:
        return {tid: list(trail) for tid, trail in self._trails.items()}

    def get_track_meta(self, track_id: int) -> Optional[dict]:
        return self._track_meta.get(track_id)

    @property
    def tracker_type(self) -> str:
        return self._tracker_type

    @property
    def frame_id(self) -> int:
        return self._frame_id

    def reset(self) -> None:
        """Reset tracker state (start a new tracking session)."""
        if self._tracker is not None:
            self.initialize(
                tracker_type=self._tracker_type,
                device=str(self._device),
                half=self._half,
                trail_length=self._trail_length,
            )

    # ------------------------------------------------------------------
    # Private init helpers
    # ------------------------------------------------------------------

    def _init_bytetrack(self, cfg_path: Path):
        from trackers.strongsort.utils.parser import get_config
        from trackers.bytetrack.byte_tracker import BYTETracker

        cfg = get_config()
        cfg.merge_from_file(str(cfg_path))
        return BYTETracker(
            track_thresh=cfg.bytetrack.track_thresh,
            match_thresh=cfg.bytetrack.match_thresh,
            track_buffer=cfg.bytetrack.track_buffer,
            frame_rate=cfg.bytetrack.frame_rate,
        )

    def _init_ocsort(self, cfg_path: Path):
        from trackers.strongsort.utils.parser import get_config
        from trackers.ocsort.ocsort import OCSort

        cfg = get_config()
        cfg.merge_from_file(str(cfg_path))
        return OCSort(
            det_thresh=cfg.ocsort.det_thresh,
            max_age=cfg.ocsort.max_age,
            min_hits=cfg.ocsort.min_hits,
            iou_threshold=cfg.ocsort.iou_thresh,
            delta_t=cfg.ocsort.delta_t,
            asso_func=cfg.ocsort.asso_func,
            inertia=cfg.ocsort.inertia,
            use_byte=cfg.ocsort.use_byte,
        )

    def _init_reid_tracker(self, tracker_type: str, cfg_path: Path, reid_weights: Path):
        from trackers.strongsort.utils.parser import get_config

        cfg = get_config()
        cfg.merge_from_file(str(cfg_path))

        if tracker_type == "strongsort":
            from trackers.strongsort.strong_sort import StrongSORT
            return StrongSORT(
                reid_weights,
                self._device,
                self._half,
                max_dist=cfg.strongsort.max_dist,
                max_iou_dist=cfg.strongsort.max_iou_dist,
                max_age=cfg.strongsort.max_age,
                max_unmatched_preds=cfg.strongsort.max_unmatched_preds,
                n_init=cfg.strongsort.n_init,
                nn_budget=cfg.strongsort.nn_budget,
                mc_lambda=cfg.strongsort.mc_lambda,
                ema_alpha=cfg.strongsort.ema_alpha,
            )
        elif tracker_type == "botsort":
            from trackers.botsort.bot_sort import BoTSORT
            return BoTSORT(
                reid_weights,
                self._device,
                self._half,
                track_high_thresh=cfg.botsort.track_high_thresh,
                new_track_thresh=cfg.botsort.new_track_thresh,
                track_buffer=cfg.botsort.track_buffer,
                match_thresh=cfg.botsort.match_thresh,
                proximity_thresh=cfg.botsort.proximity_thresh,
                appearance_thresh=cfg.botsort.appearance_thresh,
                cmc_method=cfg.botsort.cmc_method,
                frame_rate=cfg.botsort.frame_rate,
                lambda_=cfg.botsort.lambda_,
            )
        elif tracker_type == "deepocsort":
            from trackers.deepocsort.ocsort import OCSort as DeepOCSort
            return DeepOCSort(
                reid_weights,
                self._device,
                self._half,
                det_thresh=cfg.deepocsort.det_thresh,
                max_age=cfg.deepocsort.max_age,
                min_hits=cfg.deepocsort.min_hits,
                iou_threshold=cfg.deepocsort.iou_thresh,
                delta_t=cfg.deepocsort.delta_t,
                asso_func=cfg.deepocsort.asso_func,
                inertia=cfg.deepocsort.inertia,
            )
