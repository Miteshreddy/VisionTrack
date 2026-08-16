"""
VisionTrack — Detector Tests

Tests for the YOLODetector class:
  - Model loading (available model)
  - Model loading (fallback for missing weights)
  - detect_frame on a real frame
  - detect_frame before model loaded raises RuntimeError
  - InferenceResult.to_tracker_input()
  - Detection dataclass properties
"""

import numpy as np
import pytest

from visiontrack.detector import (
    YOLODetector,
    Detection,
    InferenceResult,
    get_detector,
)


# ---------------------------------------------------------------------------
# Detection dataclass tests (no model needed)
# ---------------------------------------------------------------------------

class TestDetection:
    def test_bbox_property(self):
        d = Detection(10, 20, 50, 80, 0.9, 0, "person")
        assert d.bbox == [10, 20, 50, 80]

    def test_width_height(self):
        d = Detection(10, 20, 50, 80, 0.9, 0, "person")
        assert d.width == 40
        assert d.height == 60

    def test_to_dict_keys(self):
        d = Detection(10, 20, 50, 80, 0.9, 0, "person")
        keys = d.to_dict().keys()
        assert "bbox" in keys
        assert "confidence" in keys
        assert "class_id" in keys
        assert "class_name" in keys


# ---------------------------------------------------------------------------
# InferenceResult tests
# ---------------------------------------------------------------------------

class TestInferenceResult:
    def _make_result(self):
        dets = [
            Detection(0, 0, 100, 100, 0.9, 0, "person"),
            Detection(50, 50, 150, 150, 0.7, 2, "car"),
        ]
        return InferenceResult(detections=dets, inference_ms=12.5, preprocess_ms=1.0, frame_shape=(480, 640, 3))

    def test_count(self):
        r = self._make_result()
        assert r.count == 2

    def test_filter_by_classes_none(self):
        r = self._make_result()
        filtered = r.filter_by_classes(None)
        assert filtered.count == 2

    def test_filter_by_classes_subset(self):
        r = self._make_result()
        filtered = r.filter_by_classes({0})  # only person
        assert filtered.count == 1
        assert filtered.detections[0].class_name == "person"

    def test_filter_by_classes_empty(self):
        r = self._make_result()
        filtered = r.filter_by_classes({99})  # non-existent class
        assert filtered.count == 0

    def test_to_tracker_input_shape(self):
        r = self._make_result()
        arr = r.to_tracker_input()
        assert arr.shape == (2, 6)
        assert arr.dtype == np.float32

    def test_to_tracker_input_empty(self):
        r = InferenceResult(detections=[], inference_ms=0, preprocess_ms=0, frame_shape=(480, 640, 3))
        arr = r.to_tracker_input()
        assert arr.shape == (0, 6)

    def test_to_tracker_input_values(self):
        r = self._make_result()
        arr = r.to_tracker_input()
        # First detection is person: x1=0, y1=0, x2=100, y2=100, conf=0.9, cls=0
        assert arr[0, 4] == pytest.approx(0.9, abs=1e-4)
        assert arr[0, 5] == 0.0  # class 0


# ---------------------------------------------------------------------------
# YOLODetector tests
# ---------------------------------------------------------------------------

class TestYOLODetector:
    def test_not_loaded_initially(self):
        d = YOLODetector()
        assert not d.is_loaded()

    def test_detect_before_load_raises(self, blank_frame):
        d = YOLODetector()
        with pytest.raises(RuntimeError, match="not loaded"):
            d.detect_frame(blank_frame)

    def test_load_model(self):
        """Test that yolov8n.pt loads successfully (downloads if needed)."""
        d = YOLODetector()
        info = d.load_model("yolov8n.pt")
        assert d.is_loaded()
        assert info.model_name == "yolov8n"
        assert info.num_classes == 80
        assert len(info.class_names) == 80
        assert 0 in info.class_names  # person
        assert info.class_names[0] == "person"

    def test_detect_frame_returns_inference_result(self, colored_frame):
        """Test that detect_frame returns an InferenceResult with timing data."""
        d = YOLODetector()
        d.load_model("yolov8n.pt")
        result = d.detect_frame(colored_frame, conf_thres=0.25)
        assert isinstance(result, InferenceResult)
        assert result.inference_ms >= 0
        assert result.frame_shape == colored_frame.shape
        # We don't assert detections (depends on model and input)

    def test_detect_blank_frame(self, blank_frame):
        """Blank frame should produce no detections."""
        d = YOLODetector()
        d.load_model("yolov8n.pt")
        result = d.detect_frame(blank_frame, conf_thres=0.5)
        assert result.count == 0

    def test_high_conf_fewer_detections(self, colored_frame):
        """Higher confidence should give fewer or equal detections."""
        d = YOLODetector()
        d.load_model("yolov8n.pt")
        low  = d.detect_frame(colored_frame, conf_thres=0.10)
        high = d.detect_frame(colored_frame, conf_thres=0.90)
        assert low.count >= high.count

    def test_get_detector_singleton(self):
        """get_detector() should return the same instance each call."""
        d1 = get_detector()
        d2 = get_detector()
        assert d1 is d2
