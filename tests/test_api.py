"""
VisionTrack — API Tests

Tests for the FastAPI REST endpoints:
  - Health check
  - Model loading
  - Session start / stop / reset
  - Settings update
  - Session status
  - Track detail (missing ID)
  - CSV export
  - Invalid requests
"""

import pytest
from fastapi.testclient import TestClient

# Use TestClient from httpx/starlette
from api.main import app

client = TestClient(app, raise_server_exceptions=False)


class TestHealth:
    def test_health_returns_200(self):
        res = client.get("/api/health")
        assert res.status_code == 200

    def test_health_contains_status(self):
        res = client.get("/api/health")
        data = res.json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_health_contains_session_state(self):
        res = client.get("/api/health")
        data = res.json()
        assert "session_state" in data


class TestModelLoading:
    def test_load_valid_model(self):
        res = client.post("/api/video/load-model", json={"weights": "yolov8n.pt"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "yolov8n" in data["message"].lower()

    def test_load_model_returns_class_count(self):
        res = client.post("/api/video/load-model", json={"weights": "yolov8n.pt"})
        data = res.json()
        assert data["data"]["num_classes"] == 80

    def test_load_model_returns_device(self):
        res = client.post("/api/video/load-model", json={"weights": "yolov8n.pt"})
        data = res.json()
        assert "device" in data["data"]


class TestSessionControl:
    def test_reset_returns_success(self):
        res = client.post("/api/video/reset")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

    def test_stop_before_start_is_ok(self):
        res = client.post("/api/video/stop")
        assert res.status_code == 200

    def test_pause_before_start_is_ok(self):
        res = client.post("/api/video/pause")
        assert res.status_code == 200

    def test_resume_before_start_is_ok(self):
        res = client.post("/api/video/resume")
        assert res.status_code == 200


class TestSettings:
    def test_update_settings_valid(self):
        res = client.post("/api/video/settings", json={"conf_thres": 0.5})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

    def test_update_settings_invalid_conf(self):
        # conf_thres > 1.0 is invalid per Pydantic schema
        res = client.post("/api/video/settings", json={"conf_thres": 2.0})
        assert res.status_code == 422   # Pydantic validation error

    def test_update_settings_negative_conf(self):
        res = client.post("/api/video/settings", json={"conf_thres": -0.1})
        assert res.status_code == 422


class TestSessionStatus:
    def test_status_returns_200(self):
        res = client.get("/api/session/status")
        assert res.status_code == 200

    def test_status_has_expected_keys(self):
        res = client.get("/api/session/status")
        data = res.json()
        assert "state" in data
        assert "analytics" in data

    def test_analytics_endpoint(self):
        res = client.get("/api/session/analytics")
        assert res.status_code == 200
        data = res.json()
        assert "fps" in data
        assert "current_objects" in data
        assert "unique_tracked" in data


class TestTrackDetail:
    def test_nonexistent_track_returns_404(self):
        res = client.get("/api/session/track/99999")
        assert res.status_code == 404

    def test_tracks_list_returns_200(self):
        res = client.get("/api/session/tracks")
        assert res.status_code == 200
        data = res.json()
        assert "tracks" in data
        assert isinstance(data["tracks"], list)


class TestZoneManagement:
    def test_add_zone(self):
        res = client.post("/api/session/zone", json={
            "name": "TestZone",
            "points": [[100, 100], [300, 100], [300, 300], [100, 300]],
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_add_zone_invalid_no_name(self):
        res = client.post("/api/session/zone", json={
            "points": [[0, 0], [100, 100]],
        })
        assert res.status_code == 422

    def test_remove_zone(self):
        client.post("/api/session/zone", json={
            "name": "ToRemove",
            "points": [[0, 0], [100, 0], [100, 100], [0, 100]],
        })
        res = client.delete("/api/session/zone/ToRemove")
        assert res.status_code == 200

    def test_add_counting_line(self):
        res = client.post("/api/session/line", json={
            "name": "Gate",
            "pt1": [0, 240],
            "pt2": [640, 240],
        })
        assert res.status_code == 200
        assert res.json()["success"] is True


class TestExport:
    def test_csv_export_returns_200(self):
        res = client.get("/api/session/export/csv")
        assert res.status_code == 200

    def test_csv_content_type(self):
        res = client.get("/api/session/export/csv")
        assert "text/csv" in res.headers.get("content-type", "")


class TestUpload:
    def test_upload_invalid_extension(self):
        content = b"not a real file"
        files = {"file": ("test.xyz", content, "application/octet-stream")}
        res = client.post("/api/video/upload", files=files)
        assert res.status_code == 400

    def test_upload_valid_extension_but_corrupt(self):
        # MP4 extension but invalid content — OpenCV will fail to open it
        content = b"not real mp4 data"
        files = {"file": ("test.mp4", content, "video/mp4")}
        res = client.post("/api/video/upload", files=files)
        # Upload itself may succeed (file saved), but opening will fail
        # Accept either 200 (file saved) or 400 (open failed)
        assert res.status_code in (200, 400)
