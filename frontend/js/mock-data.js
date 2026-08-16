/**
 * VisionTrack — Mock Data Module
 * Realistic mock data for pages where no backend data exists.
 * This keeps the UI visually complete during development.
 */

export const MOCK_CAMERAS = [
  { id: 'cam-001', name: 'Main Entrance',    status: 'live',    fps: 28.4, res: '1920×1080', source: 'RTSP',   lastSeen: '2s ago',    session: 'SES-0042' },
  { id: 'cam-002', name: 'Parking Lot A',    status: 'live',    fps: 24.1, res: '1280×720',  source: 'RTSP',   lastSeen: '1s ago',    session: 'SES-0041' },
  { id: 'cam-003', name: 'Rear Gate',        status: 'idle',    fps: 0,    res: '1920×1080', source: 'RTSP',   lastSeen: '4m ago',    session: null },
  { id: 'cam-004', name: 'Lobby Camera',     status: 'offline', fps: 0,    res: '1280×720',  source: 'Webcam', lastSeen: '1h ago',    session: null },
  { id: 'cam-005', name: 'Rooftop View',     status: 'live',    fps: 30.0, res: '3840×2160', source: 'RTSP',   lastSeen: 'now',       session: 'SES-0043' },
  { id: 'cam-006', name: 'Side Entrance',    status: 'warning', fps: 12.3, res: '1280×720',  source: 'RTSP',   lastSeen: '10s ago',   session: 'SES-0040' },
];

export const MOCK_SESSIONS = [
  { id: 'SES-0043', date: '2026-08-16 02:10', duration: '00:22:14', camera: 'Rooftop View',    model: 'YOLOv8s', avgFps: 29.8, detections: 4812, tracks: 73,  status: 'running' },
  { id: 'SES-0042', date: '2026-08-16 01:55', duration: '00:35:02', camera: 'Main Entrance',   model: 'YOLOv8n', avgFps: 27.2, detections: 8234, tracks: 141, status: 'running' },
  { id: 'SES-0041', date: '2026-08-16 01:30', duration: '01:02:45', camera: 'Parking Lot A',   model: 'YOLOv8s', avgFps: 23.5, detections: 14201,tracks: 287, status: 'running' },
  { id: 'SES-0040', date: '2026-08-15 23:14', duration: '02:15:33', camera: 'Side Entrance',   model: 'YOLOv11s',avgFps: 26.1, detections: 32810, tracks: 412, status: 'stopped' },
  { id: 'SES-0039', date: '2026-08-15 21:00', duration: '02:00:00', camera: 'Main Entrance',   model: 'YOLOv8m', avgFps: 18.3, detections: 21045, tracks: 334, status: 'stopped' },
  { id: 'SES-0038', date: '2026-08-15 18:30', duration: '00:45:12', camera: 'Lobby Camera',    model: 'YOLOv8n', avgFps: 30.0, detections: 9832,  tracks: 156, status: 'stopped' },
  { id: 'SES-0037', date: '2026-08-15 16:00', duration: '03:12:00', camera: 'Rear Gate',       model: 'YOLOv8s', avgFps: 24.8, detections: 51290, tracks: 718, status: 'stopped' },
  { id: 'SES-0036', date: '2026-08-15 12:00', duration: '04:00:00', camera: 'Parking Lot A',   model: 'YOLOv8l', avgFps: 15.2, detections: 72341, tracks: 982, status: 'stopped' },
];

export const MOCK_MODELS = [
  { id: 'yolov8n', name: 'YOLOv8n',  version: '8.0.0',  framework: 'PyTorch', classes: 80, acc: 37.3, fps: 112, latency: 8,  size: '6.2 MB',  active: false },
  { id: 'yolov8s', name: 'YOLOv8s',  version: '8.0.0',  framework: 'PyTorch', classes: 80, acc: 44.9, fps: 78,  latency: 13, size: '21.5 MB', active: true  },
  { id: 'yolov8m', name: 'YOLOv8m',  version: '8.0.0',  framework: 'PyTorch', classes: 80, acc: 50.2, fps: 45,  latency: 22, size: '49.7 MB', active: false },
  { id: 'yolov8l', name: 'YOLOv8l',  version: '8.0.0',  framework: 'PyTorch', classes: 80, acc: 52.9, fps: 28,  latency: 36, size: '83.7 MB', active: false },
  { id: 'yolov11s',name: 'YOLOv11s', version: '11.0.0', framework: 'PyTorch', classes: 80, acc: 47.1, fps: 74,  latency: 14, size: '19.4 MB', active: false },
  { id: 'yolov11m',name: 'YOLOv11m', version: '11.0.0', framework: 'PyTorch', classes: 80, acc: 51.4, fps: 40,  latency: 25, size: '38.8 MB', active: false },
];

export const MOCK_RECORDINGS = [
  { id: 'rec-001', name: 'Main_Entrance_0816_0210.mp4', duration: '00:22:14', date: '2026-08-16 02:10', camera: 'Main Entrance',   session: 'SES-0042', events: 12, size: '412 MB' },
  { id: 'rec-002', name: 'Parking_Lot_A_0816_0130.mp4', duration: '01:02:45', date: '2026-08-16 01:30', camera: 'Parking Lot A',   session: 'SES-0041', events: 34, size: '1.1 GB' },
  { id: 'rec-003', name: 'Side_Entrance_0815_2314.mp4', duration: '02:15:33', date: '2026-08-15 23:14', camera: 'Side Entrance',   session: 'SES-0040', events: 89, size: '2.3 GB' },
  { id: 'rec-004', name: 'Main_Entrance_0815_2100.mp4', duration: '02:00:00', date: '2026-08-15 21:00', camera: 'Main Entrance',   session: 'SES-0039', events: 56, size: '1.8 GB' },
  { id: 'rec-005', name: 'Lobby_Camera_0815_1830.mp4',  duration: '00:45:12', date: '2026-08-15 18:30', camera: 'Lobby Camera',    session: 'SES-0038', events: 21, size: '734 MB' },
  { id: 'rec-006', name: 'Rear_Gate_0815_1600.mp4',     duration: '03:12:00', date: '2026-08-15 16:00', camera: 'Rear Gate',       session: 'SES-0037', events: 145,size: '3.4 GB' },
];

export const MOCK_SNAPSHOTS = [
  { id: 'snap-001', time: '02:32:14', date: '2026-08-16', camera: 'Main Entrance',  session: 'SES-0042', objects: ['person','car'],     tags: ['auto'] },
  { id: 'snap-002', time: '02:18:40', date: '2026-08-16', camera: 'Parking Lot A', session: 'SES-0041', objects: ['car','truck'],       tags: ['manual'] },
  { id: 'snap-003', time: '01:55:22', date: '2026-08-16', camera: 'Rooftop View',  session: 'SES-0043', objects: ['person'],            tags: ['zone-entry'] },
  { id: 'snap-004', time: '01:33:08', date: '2026-08-16', camera: 'Side Entrance', session: 'SES-0040', objects: ['person','bicycle'],  tags: ['alert'] },
  { id: 'snap-005', time: '23:47:01', date: '2026-08-15', camera: 'Main Entrance', session: 'SES-0039', objects: ['person'],            tags: ['auto'] },
  { id: 'snap-006', time: '22:12:33', date: '2026-08-15', camera: 'Lobby Camera',  session: 'SES-0038', objects: ['person','handbag'],  tags: ['manual'] },
  { id: 'snap-007', time: '21:05:55', date: '2026-08-15', camera: 'Rear Gate',     session: 'SES-0037', objects: ['truck'],             tags: ['alert'] },
  { id: 'snap-008', time: '19:30:14', date: '2026-08-15', camera: 'Parking Lot A', session: 'SES-0036', objects: ['car','car','person'],tags: ['auto'] },
];

export const MOCK_EVENTS = [
  { id: 'ev-001', time: '02:32:15', type: 'detection', severity: 'info',    title: 'New object detected',       desc: 'Person #087 appeared in Main Entrance',       camera: 'Main Entrance' },
  { id: 'ev-002', time: '02:31:58', type: 'tracking',  severity: 'success', title: 'Track established',         desc: 'Vehicle #032 tracked for 5 min 20 sec',       camera: 'Parking Lot A' },
  { id: 'ev-003', time: '02:30:44', type: 'warning',   severity: 'warning', title: 'Low FPS detected',          desc: 'Side Entrance dropped below 15 FPS threshold', camera: 'Side Entrance'  },
  { id: 'ev-004', time: '02:29:10', type: 'camera',    severity: 'error',   title: 'Camera connection lost',    desc: 'Lobby Camera temporarily disconnected',        camera: 'Lobby Camera'   },
  { id: 'ev-005', time: '02:28:33', type: 'detection', severity: 'info',    title: 'Zone entry event',          desc: 'Person #042 entered Zone A at Main Entrance',  camera: 'Main Entrance' },
  { id: 'ev-006', time: '02:27:20', type: 'tracking',  severity: 'info',    title: 'Track lost',               desc: 'Person #017 track lost after 8 min 14 sec',   camera: 'Rooftop View'  },
  { id: 'ev-007', time: '02:26:55', type: 'info',      severity: 'info',    title: 'Recording started',        desc: 'Session SES-0043 recording to disk',          camera: 'Rooftop View'  },
  { id: 'ev-008', time: '02:25:40', type: 'detection', severity: 'warning', title: 'Line crossing detected',   desc: 'Vehicle #008 crossed counting line B',        camera: 'Parking Lot A' },
  { id: 'ev-009', time: '02:24:15', type: 'info',      severity: 'success', title: 'Model loaded',            desc: 'YOLOv8s loaded in 1.2s on CPU',               camera: null           },
  { id: 'ev-010', time: '02:23:08', type: 'camera',    severity: 'success', title: 'Camera reconnected',      desc: 'Lobby Camera reconnected after 3 min',        camera: 'Lobby Camera' },
];

export const MOCK_EXPORTS = [
  { id: 'exp-001', name: 'SES-0040_detections.csv',     type: 'Detection CSV',     date: '2026-08-15 23:30', size: '2.4 MB',  status: 'complete' },
  { id: 'exp-002', name: 'SES-0039_tracks.json',        type: 'Track JSON',        date: '2026-08-15 22:00', size: '8.1 MB',  status: 'complete' },
  { id: 'exp-003', name: 'SES-0038_events.log',         type: 'Event Log',         date: '2026-08-15 19:30', size: '142 KB',  status: 'complete' },
  { id: 'exp-004', name: 'SES-0037_annotated.mp4',      type: 'Annotated Video',   date: '2026-08-15 19:15', size: '4.2 GB',  status: 'complete' },
  { id: 'exp-005', name: 'SES-0036_analytics_report.pdf', type: 'Analytics Report', date: '2026-08-15 17:00', size: '1.8 MB',  status: 'complete' },
  { id: 'exp-006', name: 'Main_snap_0816.zip',          type: 'Snapshots',         date: '2026-08-16 00:10', size: '48 MB',   status: 'complete' },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'n-001', type: 'warning', title: 'Low FPS Warning',      msg: 'Side Entrance dropped to 12.3 FPS', time: '2 min ago',  read: false },
  { id: 'n-002', type: 'error',   title: 'Camera Disconnected',  msg: 'Lobby Camera connection lost',       time: '4 min ago',  read: false },
  { id: 'n-003', type: 'success', title: 'Export Complete',       msg: 'SES-0040_detections.csv ready',     time: '8 min ago',  read: false },
  { id: 'n-004', type: 'info',    title: 'Model Loaded',          msg: 'YOLOv8s ready on CPU',              time: '12 min ago', read: true  },
  { id: 'n-005', type: 'success', title: 'Session Started',       msg: 'SES-0043 recording to Rooftop View','time': '22 min ago', read: true },
  { id: 'n-006', type: 'info',    title: 'Recording Complete',    msg: 'SES-0040 saved (2.3 GB)',           time: '1 hr ago',   read: true  },
];

// Dashboard metrics (supplemented by real API when available)
export const MOCK_DASHBOARD_METRICS = {
  liveFps: 28.4,
  activeObjects: 12,
  activeTracks: 47,
  avgLatency: 13.2,
  sessionsToday: 6,
  detectionsToday: 142318,
  activeStreams: 3,
  totalCameras: 6,
};

// Performance mock (animates in perf page)
export function getMockPerfSample() {
  return {
    cpu:   35 + Math.random() * 25,
    gpu:   52 + Math.random() * 20,
    vram:  68 + Math.random() * 12,
    fps:   24 + Math.random() * 8,
    latency: 10 + Math.random() * 8,
    decode: 2 + Math.random() * 2,
    inference: 8 + Math.random() * 5,
    tracking: 1 + Math.random() * 1.5,
    render: 0.5 + Math.random() * 1,
  };
}

// Generate time-series data for charts
export function generateTimeSeries(length = 30, base = 50, variance = 20, smooth = true) {
  const data = [];
  let val = base;
  for (let i = 0; i < length; i++) {
    val = smooth
      ? val + (Math.random() - 0.5) * variance * 0.5
      : base + (Math.random() - 0.5) * variance;
    val = Math.max(0, Math.min(base * 2, val));
    data.push(Math.round(val * 10) / 10);
  }
  return data;
}

export function generateHourLabels(hours = 24) {
  const labels = [];
  const now = new Date();
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now - i * 3600 * 1000);
    labels.push(`${String(d.getHours()).padStart(2,'0')}:00`);
  }
  return labels;
}

export function generateMinuteLabels(minutes = 30) {
  const labels = [];
  const now = new Date();
  for (let i = minutes - 1; i >= 0; i--) {
    const d = new Date(now - i * 60 * 1000);
    labels.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
  }
  return labels;
}

// Class distribution mock data
export const MOCK_CLASS_COUNTS = {
  'person':   412,
  'car':      198,
  'truck':    87,
  'bicycle':  45,
  'motorcycle': 23,
  'bus':      19,
  'dog':      8,
  'cat':      5,
};

// Benchmark results mock
export const MOCK_BENCHMARKS = [
  { model: 'YOLOv8n',   fps: 112, latency: 8,  precision: 91.2, recall: 87.8, map50: 37.3, gpu: 'RTX 4090', res: '640' },
  { model: 'YOLOv8s',   fps: 78,  latency: 13, precision: 93.8, recall: 91.4, map50: 44.9, gpu: 'RTX 4090', res: '640' },
  { model: 'YOLOv8m',   fps: 45,  latency: 22, precision: 95.1, recall: 93.2, map50: 50.2, gpu: 'RTX 4090', res: '640' },
  { model: 'YOLOv8l',   fps: 28,  latency: 36, precision: 96.0, recall: 94.5, map50: 52.9, gpu: 'RTX 4090', res: '640' },
  { model: 'YOLOv11s',  fps: 74,  latency: 14, precision: 94.5, recall: 92.8, map50: 47.1, gpu: 'RTX 4090', res: '640' },
  { model: 'YOLOv11m',  fps: 40,  latency: 25, precision: 95.8, recall: 94.1, map50: 51.4, gpu: 'RTX 4090', res: '640' },
];
