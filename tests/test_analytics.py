"""
VisionTrack — Analytics Engine Tests

Tests for the AnalyticsEngine class:
  - Initial state
  - Update with tracked objects
  - FPS computation
  - Class counts accumulation
  - Unique ID tracking
  - Timeline events
  - Reset
"""

import time
import pytest

from visiontrack.analytics import AnalyticsEngine, TimelineEvent
from visiontrack.tracker_manager import TrackedObject


def make_obj(track_id, cls_name="person", cls_id=0, conf=0.9):
    return TrackedObject(
        track_id=track_id,
        x1=10, y1=10, x2=100, y2=200,
        class_id=cls_id,
        class_name=cls_name,
        confidence=conf,
        frame_id=1,
    )


class TestAnalyticsEngine:

    def test_initial_state(self):
        eng = AnalyticsEngine()
        snap = eng.snapshot()
        assert snap.fps == 0.0
        assert snap.current_objects == 0
        assert snap.unique_tracked == 0
        assert snap.frame_id == 0
        assert snap.class_counts_current == {}
        assert snap.class_counts_total == {}
        assert snap.active_track_ids == []

    def test_update_current_objects(self):
        eng = AnalyticsEngine()
        objs = [make_obj(1), make_obj(2), make_obj(3)]
        eng.update(objs, frame_id=1)
        snap = eng.snapshot()
        assert snap.current_objects == 3
        assert snap.unique_tracked == 3

    def test_class_counts_accumulate(self):
        eng = AnalyticsEngine()
        eng.update([make_obj(1, "person"), make_obj(2, "person")], frame_id=1)
        eng.update([make_obj(1, "person"), make_obj(3, "car", cls_id=2)], frame_id=2)
        snap = eng.snapshot()
        assert snap.class_counts_total["person"] == 3
        assert snap.class_counts_total["car"] == 1

    def test_unique_ids_across_frames(self):
        eng = AnalyticsEngine()
        # IDs 1 and 2 in frame 1, ID 3 added in frame 2
        eng.update([make_obj(1), make_obj(2)], frame_id=1)
        eng.update([make_obj(1), make_obj(3)], frame_id=2)
        snap = eng.snapshot()
        assert snap.unique_tracked == 3   # IDs 1, 2, 3 all seen

    def test_fps_increases_with_frames(self):
        eng = AnalyticsEngine()
        for i in range(15):
            eng.update([], frame_id=i)
            time.sleep(0.01)  # 10ms delay = ~100 fps theoretical
        snap = eng.snapshot()
        assert snap.fps > 0.0

    def test_timeline_appeared_event(self):
        eng = AnalyticsEngine()
        eng.update([make_obj(1)], frame_id=1)
        snap = eng.snapshot()
        # Should have an 'appeared' event for ID 1
        events = snap.timeline
        appeared = [e for e in events if e["event_type"] == "appeared" and e["track_id"] == 1]
        assert len(appeared) == 1

    def test_timeline_lost_event(self):
        eng = AnalyticsEngine()
        eng.update([make_obj(1)], frame_id=1)
        eng.update([],           frame_id=2)   # ID 1 disappears
        snap = eng.snapshot()
        lost = [e for e in snap.timeline if e["event_type"] == "lost" and e["track_id"] == 1]
        assert len(lost) == 1

    def test_zone_event(self):
        eng = AnalyticsEngine()
        eng.add_zone_event(track_id=5, class_name="person", event_type="zone_entered", zone_name="Gate A")
        snap = eng.snapshot()
        events = snap.timeline
        zone_ev = [e for e in events if e["event_type"] == "zone_entered"]
        assert len(zone_ev) >= 1
        assert zone_ev[0]["zone_name"] == "Gate A"

    def test_reset_clears_state(self):
        eng = AnalyticsEngine()
        eng.update([make_obj(1), make_obj(2)], frame_id=1)
        eng.reset()
        snap = eng.snapshot()
        assert snap.current_objects == 0
        assert snap.unique_tracked == 0
        assert snap.class_counts_total == {}
        assert snap.frame_id == 0

    def test_snapshot_to_dict(self):
        eng = AnalyticsEngine()
        eng.update([make_obj(1)], frame_id=1, inference_ms=15.5)
        d = eng.snapshot().to_dict()
        assert "fps" in d
        assert "current_objects" in d
        assert "unique_tracked" in d
        assert "class_counts_total" in d
        assert "inference_ms" in d
        assert d["inference_ms"] == pytest.approx(15.5, abs=0.1)

    def test_set_metadata(self):
        eng = AnalyticsEngine()
        eng.set_metadata(device="cpu", model_name="yolov8n", tracker_name="bytetrack")
        snap = eng.snapshot()
        assert snap.device == "cpu"
        assert snap.model_name == "yolov8n"
        assert snap.tracker_name == "bytetrack"

    def test_active_track_ids_correct(self):
        eng = AnalyticsEngine()
        objs = [make_obj(10), make_obj(20), make_obj(30)]
        eng.update(objs, frame_id=1)
        snap = eng.snapshot()
        assert set(snap.active_track_ids) == {10, 20, 30}
