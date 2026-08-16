# VisionTrack

## Real-Time Object Detection & Tracking Analytics

A computer vision analytics platform built on **YOLOv8** and **multi-object tracking**. VisionTrack detects, tracks, and analyzes objects in real time from webcam or video files, with a professional web interface for monitoring and control.

---

## What It Does

```
Webcam / Video
      ↓
Frame Processing (OpenCV)
      ↓
YOLOv8 Detection (ultralytics)
      ↓
Multi-Object Tracker (ByteTrack / OC-SORT)
      ↓
Persistent Object IDs + Trails
      ↓
Live Analytics (FPS, counts, class dist, timeline)
      ↓
Web Dashboard (FastAPI + WebSocket + SPA)
```

---

## Features

- **Real-time detection**: YOLOv8 on webcam or video files
- **Persistent tracking**: ByteTrack assigns stable IDs across frames
- **Motion trails**: Visual history of each tracked object's path
- **Live analytics**: FPS, object counts, class distribution, session timeline
- **Zone analytics**: Draw polygon ROIs; detect enter/exit events
- **Counting lines**: Bi-directional line crossing counter
- **Class filtering**: Toggle object classes in real time
- **Confidence control**: Adjustable detection threshold (0.05–0.95)
- **Video file support**: Upload and process any video; progress tracking
- **CSV export**: Export session analytics
- **Track detail**: Click any tracked object to see its full history
- **API-first**: Full REST + WebSocket API; Swagger docs at `/api/docs`

---

## Architecture

```
visiontrack/
├── detector.py          — YOLODetector: load_model(), detect_frame()
├── tracker_manager.py   — TrackerManager: ByteTrack / OC-SORT wrapper
├── analytics.py         — AnalyticsEngine: FPS, counts, timeline
├── zone_manager.py      — ZoneManager: polygon zones, counting lines
├── session.py           — TrackingSession: frame pipeline + WS broadcast
└── utils.py             — Shared helpers

api/
├── main.py              — FastAPI application
├── schemas.py           — Pydantic request/response models
└── routes/
    ├── video.py         — /api/video/* (start, stop, upload, settings)
    ├── session.py       — /api/session/* (status, tracks, zones, export)
    └── stream.py        — /ws/stream (WebSocket frame streaming)

frontend/
├── index.html           — Single-page application
├── css/app.css          — Design system
└── js/
    ├── app.js           — Main controller
    ├── stream.js        — WebSocket client
    ├── analytics.js     — Charts and metrics
    └── controls.js      — Settings, controls, interactions

trackers/                — Original tracker implementations (preserved)
├── bytetrack/           — ByteTrack (default, IoU-only)
├── ocsort/              — OC-SORT
├── strongsort/          — StrongSORT + ReID
├── botsort/             — BoT-SORT + ReID
└── deepocsort/          — DeepOCSORT + ReID
```

---

## Detection Pipeline

1. `YOLODetector.detect_frame(bgr_frame, conf_thres)` calls `model.predict()` via ultralytics
2. Detections are parsed into `Detection` objects: `[x1, y1, x2, y2, conf, class_id, class_name]`
3. NMS is applied by ultralytics internally (configurable IoU threshold)
4. Results are returned as an `InferenceResult` with timing data

---

## Tracking Pipeline

1. `InferenceResult.to_tracker_input()` converts detections to `(N, 6)` numpy array
2. `TrackerManager.update(det_array, frame)` feeds this to ByteTrack
3. ByteTrack associates detections to existing tracks via Kalman Filter + IoU matching
4. Returns `List[TrackedObject]` with persistent `track_id` values
5. `TrackerManager` maintains trail history (configurable length) per track

---

## Analytics

All analytics come from actual inference data:

| Metric | Source |
|--------|--------|
| FPS | Rolling window of real frame timestamps |
| Current objects | Active track count in the latest frame |
| Unique tracked | Distinct IDs seen since session start |
| Inference latency | Measured from `model.predict()` call |
| Class distribution | Cumulative detection counts by class |
| Timeline events | New/lost tracks, zone enter/exit, line crossings |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Detection | YOLOv8 (ultralytics 8.4+) |
| Tracking | ByteTrack, OC-SORT (+ StrongSORT, BoT-SORT, DeepOCSORT optional) |
| Video | OpenCV 4.8+ |
| Deep learning | PyTorch 2.0+ |
| Backend | FastAPI + uvicorn |
| Real-time | WebSocket (native Python websockets) |
| Frontend | Vanilla HTML/CSS/JS (ES modules, no build step) |
| Charts | Chart.js |
| Testing | pytest |

---

## Setup

```bash
# Clone
git clone https://github.com/yourusername/visiontrack.git
cd visiontrack

# Install dependencies (Python 3.10+)
pip install -r requirements.txt
```

For GPU inference (optional, much faster):
```bash
# Uninstall CPU torch and install GPU version
pip uninstall torch torchvision -y
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

---

## Running

```bash
python run.py
```

Browser opens automatically at `http://localhost:8000`.

Options:
```bash
python run.py --model yolov8n.pt   # Fastest model (default)
python run.py --model yolov8s.pt   # Better accuracy
python run.py --port 8080          # Different port
python run.py --no-browser         # Don't open browser
python run.py --reload             # Hot-reload for development
```

---

## GPU / CUDA

VisionTrack automatically detects CUDA:

```python
device = "cuda:0" if torch.cuda.is_available() else "cpu"
```

The device is shown in the UI header. If CUDA is not available, inference runs on CPU (slower but fully functional).

---

## API

Full Swagger docs at `http://localhost:8000/api/docs`

### Key endpoints

```
GET  /api/health                    — Health check
POST /api/video/load-model          — Load YOLO model
POST /api/video/start               — Start tracking session
POST /api/video/stop                — Stop session
POST /api/video/pause               — Pause session
POST /api/video/resume              — Resume session
POST /api/video/upload              — Upload video file
POST /api/video/settings            — Update inference settings
GET  /api/session/status            — Session status + analytics
GET  /api/session/tracks            — All known tracks
GET  /api/session/track/{id}        — Track detail
POST /api/session/zone              — Add polygon zone
POST /api/session/line              — Add counting line
GET  /api/session/export/csv        — Export analytics CSV

WS   /ws/stream                     — WebSocket stream (frames + analytics)
```

---

## Performance

Approximate FPS on CPU (Intel i7, yolov8n at 640×640):

| Input | FPS |
|-------|-----|
| Webcam 640px | 4–8 |
| Video 640px  | 5–10 |
| Video 320px  | 10–18 |

With NVIDIA GPU (yolov8n):
- RTX 3060: ~120 FPS
- GTX 1660: ~70 FPS

---

## Testing

```bash
pip install pytest httpx
python -m pytest tests/ -v
```

Test coverage:
- `test_detector.py` — YOLODetector, Detection, InferenceResult
- `test_tracker.py` — TrackerManager with ByteTrack and OC-SORT
- `test_analytics.py` — AnalyticsEngine (FPS, counts, events)
- `test_api.py` — All REST endpoints, validation, export

---

## Limitations

- CPU-only on machines without CUDA (4–10 FPS typical)
- ID switches can occur during long occlusions (inherent to IoU-based tracking)
- Detection limited to 80 COCO classes without custom training
- No audio processing

---

## Future Improvements

- ONNX / TensorRT export for faster inference
- Custom class training workflow
- Multi-camera support
- Alert system (zone dwell time, perimeter breach)
- Historical analytics database
- Heatmap visualization of object movement

---

## Open-Source Attribution

This project uses the following open-source frameworks and algorithms:

| Project | Authors | License |
|---------|---------|---------|
| [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) | Ultralytics | AGPL-3.0 |
| [ByteTrack](https://github.com/ifzhang/ByteTrack) | Zhang et al. | MIT |
| [OC-SORT](https://github.com/noahcao/OC_SORT) | Cao et al. | MIT |
| [StrongSORT](https://github.com/dyhBUPT/StrongSORT) | Du et al. | MIT |
| [BoT-SORT](https://github.com/NirAharon/BoT-SORT) | Aharon et al. | MIT |
| [yolov8_tracking](https://github.com/mikel-brostrom/yolov8_tracking) | Mikel Brostrom | AGPL-3.0 |
| FastAPI | Sebastián Ramírez | MIT |
| OpenCV | OpenCV team | Apache 2.0 |
| PyTorch | Meta AI | BSD |
| Chart.js | Chart.js contributors | MIT |

The original tracker implementations in `trackers/` are preserved from the [yolov8_tracking](https://github.com/mikel-brostrom/yolov8_tracking) repository by Mikel Brostrom.

---

## My Contributions

The VisionTrack application layer built on top of these frameworks:

- Modular application architecture (`visiontrack/` package)
- `YOLODetector` — clean wrapper over ultralytics public API
- `TrackerManager` — unified interface over 5 tracker implementations
- `AnalyticsEngine` — real-time analytics from actual tracking data
- `ZoneManager` — polygon zones and counting lines
- `TrackingSession` — background thread pipeline with WebSocket broadcast
- FastAPI REST API with WebSocket streaming
- Professional web frontend (HTML/CSS/JS SPA with design system)
- Interactive cross-panel interactions (class filter, track detail drawer)
- CSV analytics export
- Complete test suite
- README and interview documentation

---

## License

The tracker implementations in `trackers/` are subject to their original licenses.  
VisionTrack application code (`visiontrack/`, `api/`, `frontend/`) is MIT licensed.
