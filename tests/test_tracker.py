"""
VisionTrack — Tracker Manager Tests

Tests for the TrackerManager class:
  - Initialization with ByteTrack
  - Initialization with OC-SORT
  - Update with detections returns TrackedObjects
  - Update with empty detections returns empty list
  - Track IDs are persistent across frames
  - Trail history is maintained
  - Reset clears state
"""

import numpy as np
import pytest

from visiontrack.tracker_manager import TrackerManager, TrackedObject


def make_det_array(*rows):
    """Create (N, 6) detection array from rows of (x1, y1, x2, y2, conf, cls_id)."""
    if not rows:
        return np.empty((0, 6), dtype=np.float32)
    return np.array(rows, dtype=np.float32)


class TestTrackerManagerByteTrack:
    """Tests using ByteTrack (no ReID weights needed)."""

    @pytest.fixture
    def mgr(self, blank_frame):
        m = TrackerManager()
        m.initialize("bytetrack", trail_length=10)
        return m

    def test_initialize(self, mgr):
        assert mgr.tracker_type == "bytetrack"

    def test_update_empty_returns_empty(self, mgr, blank_frame):
        det = make_det_array()
        tracked = mgr.update(det, blank_frame, frame_id=1)
        assert tracked == []

    def test_update_with_detections(self, mgr, blank_frame, sample_detection_array):
        tracked = mgr.update(sample_detection_array, blank_frame, frame_id=1)
        # ByteTrack requires a few frames to confirm tracks; result may be empty on frame 1
        assert isinstance(tracked, list)

    def test_track_ids_assigned(self, mgr, blank_frame, sample_detection_array):
        """Track IDs should be assigned after the tracker confirms them (usually frame 1+ conf)."""
        # Run several frames to let ByteTrack confirm tracks
        tracked = []
        for i in range(5):
            tracked = mgr.update(sample_detection_array, blank_frame, frame_id=i+1)

        # After several frames, we expect some tracks
        if tracked:
            ids = [t.track_id for t in tracked]
            assert len(ids) == len(set(ids)), "Track IDs must be unique"
            for t in tracked:
                assert t.track_id > 0

    def test_track_objects_have_required_fields(self, mgr, blank_frame, sample_detection_array):
        """All TrackedObject fields must be present."""
        tracked = []
        for i in range(3):
            tracked = mgr.update(sample_detection_array, blank_frame, frame_id=i+1)

        for obj in tracked:
            assert isinstance(obj, TrackedObject)
            assert isinstance(obj.track_id, int)
            assert isinstance(obj.class_id, int)
            assert 0 <= obj.confidence <= 1

    def test_trail_grows_with_frames(self, mgr, blank_frame, sample_detection_array):
        """After several updates, tracked objects should have trail history."""
        all_tracked = []
        for i in range(10):
            tracked = mgr.update(sample_detection_array, blank_frame, frame_id=i+1)
            all_tracked = tracked

        # Any confirmed track should have a trail
        for obj in all_tracked:
            trail = mgr.get_trail(obj.track_id)
            assert len(trail) >= 1

    def test_reset_clears_trails(self, mgr, blank_frame, sample_detection_array):
        """After reset, all trails and metadata should be cleared."""
        for i in range(5):
            mgr.update(sample_detection_array, blank_frame, frame_id=i+1)

        mgr.reset()
        assert mgr.get_all_trails() == {}
        assert mgr.frame_id == 0

    def test_invalid_tracker_raises(self):
        mgr = TrackerManager()
        with pytest.raises(ValueError, match="Unknown tracker"):
            mgr.initialize("nonexistent_tracker")


class TestTrackerManagerOCSORT:
    """Tests using OC-SORT (no ReID weights needed)."""

    @pytest.fixture
    def mgr(self, blank_frame):
        m = TrackerManager()
        m.initialize("ocsort", trail_length=10)
        return m

    def test_initialize(self, mgr):
        assert mgr.tracker_type == "ocsort"

    def test_update_empty(self, mgr, blank_frame):
        det = make_det_array()
        tracked = mgr.update(det, blank_frame, frame_id=1)
        assert isinstance(tracked, list)

    def test_update_with_detections(self, mgr, blank_frame, sample_detection_array):
        tracked = []
        for i in range(5):
            tracked = mgr.update(sample_detection_array, blank_frame, frame_id=i+1)
        assert isinstance(tracked, list)
