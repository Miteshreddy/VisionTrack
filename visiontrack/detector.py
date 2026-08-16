"""
VisionTrack — Detector Module

Wraps the ultralytics YOLO public API to provide a clean, stateless
detection interface. Keeps all model logic out of the API/UI layers.

Responsibilities:
  - Load a YOLO model once and keep it in memory
  - Run inference on a single BGR frame (as returned by OpenCV)
  - Return structured detection results (xyxy, conf, cls, class_name)
  - Report model metadata (name, input size, classes, device)
"""

from __future__ import annotations

import time
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
import torch

logger = logging.getLogger("visiontrack.detector")

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Detection:
    """A single raw detection from YOLO (before tracking)."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    class_name: str

    @property
    def bbox(self) -> list[float]:
        return [self.x1, self.y1, self.x2, self.y2]

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    def to_dict(self) -> dict:
        return {
            "bbox": self.bbox,
            "confidence": round(self.confidence, 4),
            "class_id": self.class_id,
            "class_name": self.class_name,
        }


@dataclass
class InferenceResult:
    """Result of running detect_frame() on one frame."""
    detections: List[Detection]
    inference_ms: float          # time for YOLO forward pass only
    preprocess_ms: float         # time for preprocessing
    frame_shape: tuple           # (H, W, C) of original frame

    @property
    def count(self) -> int:
        return len(self.detections)

    def filter_by_classes(self, class_ids: Optional[set]) -> "InferenceResult":
        """Return a copy with only the requested class_ids (None = all)."""
        if class_ids is None:
            return self
        filtered = [d for d in self.detections if d.class_id in class_ids]
        return InferenceResult(
            detections=filtered,
            inference_ms=self.inference_ms,
            preprocess_ms=self.preprocess_ms,
            frame_shape=self.frame_shape,
        )

    def to_tracker_input(self) -> np.ndarray:
        """
        Convert detections to the format expected by ByteTrack / OC-SORT:
        numpy array of shape (N, 6): [x1, y1, x2, y2, conf, cls_id]
        """
        if not self.detections:
            return np.empty((0, 6), dtype=np.float32)
        rows = []
        for d in self.detections:
            rows.append([d.x1, d.y1, d.x2, d.y2, d.confidence, d.class_id])
        return np.array(rows, dtype=np.float32)


# ---------------------------------------------------------------------------
# Model info
# ---------------------------------------------------------------------------

@dataclass
class ModelInfo:
    model_name: str
    input_size: tuple            # (H, W)
    num_classes: int
    class_names: dict            # {id: name}
    device: str                  # "cuda:0" or "cpu"
    task: str                    # "detect" or "segment"


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class YOLODetector:
    """
    Stateless YOLO detector built on the ultralytics public API.

    Usage:
        detector = YOLODetector()
        detector.load_model("yolov8n.pt")
        result = detector.detect_frame(bgr_frame, conf_thres=0.5)
    """

    def __init__(self):
        self._model = None
        self._model_name: str = ""
        self._class_names: dict = {}
        self._device: str = "cpu"
        self._task: str = "detect"
        self._imgsz: int = 640

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def load_model(
        self,
        weights: str = "yolov8n.pt",
        device: str = "",
        imgsz: int = 640,
    ) -> ModelInfo:
        """
        Load a YOLO model. Automatically downloads from ultralytics if not found locally.

        Args:
            weights:  Path to .pt file or model name (e.g. 'yolov8n.pt')
            device:   '' for auto-select, 'cpu', or '0' for GPU 0
            imgsz:    Inference image size (square)

        Returns:
            ModelInfo with metadata about the loaded model.
        """
        try:
            from ultralytics import YOLO
        except ImportError as e:
            raise RuntimeError(
                "ultralytics is not installed. Run: pip install ultralytics"
            ) from e

        logger.info(f"Loading YOLO model: {weights}")
        weights_path = Path(weights)

        # If user provides a local path that doesn't exist, fall back to yolov8n
        if not weights_path.exists() and "/" not in weights and "\\" not in weights:
            # It's a model name (e.g. 'yolov8n.pt'), ultralytics will auto-download
            pass
        elif not weights_path.exists():
            logger.warning(f"Weights not found at {weights}, falling back to yolov8n.pt")
            weights = "yolov8n.pt"

        self._model = YOLO(weights)
        self._model_name = Path(weights).stem
        self._imgsz = imgsz
        self._class_names = self._model.names  # {0: 'person', 1: 'bicycle', ...}

        # Determine device
        if device == "":
            self._device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            self._device = device

        self._task = self._model.task  # 'detect' or 'segment'

        logger.info(
            f"Model loaded: {self._model_name} | "
            f"Classes: {len(self._class_names)} | "
            f"Device: {self._device} | "
            f"Task: {self._task}"
        )

        return self.get_model_info()

    def detect_frame(
        self,
        frame: np.ndarray,
        conf_thres: float = 0.25,
        iou_thres: float = 0.45,
        classes: Optional[List[int]] = None,
        max_det: int = 300,
    ) -> InferenceResult:
        """
        Run YOLO inference on a single BGR frame (as returned by cv2.VideoCapture).

        Args:
            frame:      BGR numpy array (H, W, 3)
            conf_thres: Minimum confidence to keep a detection
            iou_thres:  IoU threshold for NMS
            classes:    List of class IDs to detect (None = all)
            max_det:    Maximum number of detections per frame

        Returns:
            InferenceResult with all detections above conf_thres.
        """
        if self._model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        t_pre = time.perf_counter()
        # The ultralytics API handles all preprocessing internally
        # verbose=False suppresses per-frame console output
        t_inf = time.perf_counter()
        results = self._model.predict(
            source=frame,
            conf=conf_thres,
            iou=iou_thres,
            classes=classes,
            max_det=max_det,
            verbose=False,
            device=self._device,
            imgsz=self._imgsz,
        )
        t_done = time.perf_counter()

        detections = self._parse_results(results)

        return InferenceResult(
            detections=detections,
            inference_ms=(t_done - t_inf) * 1000,
            preprocess_ms=(t_inf - t_pre) * 1000,
            frame_shape=frame.shape,
        )

    def get_model_info(self) -> ModelInfo:
        """Return current model metadata."""
        if self._model is None:
            raise RuntimeError("Model not loaded.")
        return ModelInfo(
            model_name=self._model_name,
            input_size=(self._imgsz, self._imgsz),
            num_classes=len(self._class_names),
            class_names=self._class_names,
            device=self._device,
            task=self._task,
        )

    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def class_names(self) -> dict:
        return self._class_names

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _parse_results(self, results) -> List[Detection]:
        """
        Parse ultralytics Results objects into our Detection dataclass.
        Results is a list with one element per image (we always pass 1 frame).
        """
        detections = []
        if not results:
            return detections

        result = results[0]  # single-frame inference
        boxes = result.boxes

        if boxes is None or len(boxes) == 0:
            return detections

        # boxes.xyxy: (N, 4) tensor [x1, y1, x2, y2] in pixel coords
        # boxes.conf: (N,) tensor  confidence scores
        # boxes.cls:  (N,) tensor  class IDs

        xyxy = boxes.xyxy.cpu().numpy()
        confs = boxes.conf.cpu().numpy()
        clss = boxes.cls.cpu().numpy().astype(int)

        for i in range(len(xyxy)):
            cls_id = int(clss[i])
            det = Detection(
                x1=float(xyxy[i][0]),
                y1=float(xyxy[i][1]),
                x2=float(xyxy[i][2]),
                y2=float(xyxy[i][3]),
                confidence=float(confs[i]),
                class_id=cls_id,
                class_name=self._class_names.get(cls_id, f"class_{cls_id}"),
            )
            detections.append(det)

        return detections


# ---------------------------------------------------------------------------
# Module-level singleton (shared across the FastAPI app)
# ---------------------------------------------------------------------------

_detector: Optional[YOLODetector] = None


def get_detector() -> YOLODetector:
    """Return the module-level detector singleton."""
    global _detector
    if _detector is None:
        _detector = YOLODetector()
    return _detector
