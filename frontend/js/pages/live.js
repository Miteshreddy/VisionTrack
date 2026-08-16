/**
 * VisionTrack — Live Monitor Page
 * The core CV workspace - wraps existing stream/controls/analytics modules
 */

import stream from '../stream.js';
import { initAnalytics, updateAnalytics, updateTrackList, highlightTracksByClass, drawTrajectory } from '../analytics.js';
import { initControls, setState, showOverlay, hideOverlay, showVideoFrame, showError, openTrackDrawer } from '../controls.js';
import { showToast } from '../components.js';

let _sessionRunning = false;
let _frameCount = 0;
let _latestDetections = [];
let _trailCache = {};

export function render(container) {
  container.innerHTML = `
    <div class="live-workspace" style="height:calc(100vh - 48px)">

      <!-- Left Controls Panel -->
      <aside class="live-left" aria-label="Detection controls">

        <!-- Session Actions -->
        <div class="live-panel-section">
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <button id="btn-start" class="btn btn-primary" style="flex:1" title="Start session">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg>
              Start
            </button>
            <button id="btn-pause" class="btn btn-secondary btn-icon" disabled title="Pause">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3h2v10H5zm4 0h2v10H9z"/></svg>
            </button>
            <button id="btn-stop" class="btn btn-secondary btn-icon" disabled title="Stop">
              <svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
            </button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span id="session-badge" class="badge badge-idle" role="status" aria-live="polite">
              <span class="session-live-dot idle" id="live-dot"></span>
              Idle
            </span>
            <button id="btn-reset" class="btn btn-ghost btn-sm" title="Reset session">Reset</button>
          </div>
        </div>

        <!-- INPUT -->
        <div class="live-panel-section">
          <div class="live-section-header" id="section-input-header">
            <span class="live-section-title">Input</span>
            <svg class="collapsible-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div id="section-input-body">
            <!-- Source type tabs -->
            <div class="source-tabs" id="source-tabs">
              <div class="source-tab active" data-source="webcam" title="Webcam">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="7" r="3.5"/><path d="M4 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke-linecap="round"/></svg>
                Cam
              </div>
              <div class="source-tab" data-source="video" title="Video file">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" stroke="none"/></svg>
                Video
              </div>
              <div class="source-tab" data-source="rtsp" title="RTSP stream">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8c0-3.3 2.7-6 6-6"/><path d="M14 8c0 3.3-2.7 6-6 6"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>
                RTSP
              </div>
              <div class="source-tab" data-source="image" title="Image file">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="6" cy="7" r="1.5"/><path d="M3 12l4-4 3 3 2-2 3 3"/></svg>
                Image
              </div>
            </div>

            <div class="form-group" id="webcam-group">
              <label class="form-label" for="source-select">Device</label>
              <select class="form-select" id="source-select" aria-label="Input source">
                <option value="0">Webcam (device 0)</option>
                <option value="1">Webcam (device 1)</option>
                <option value="video">Video file…</option>
              </select>
            </div>

            <div id="upload-area" class="upload-area" style="display:none" role="region" aria-label="Upload video">
              <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p class="upload-text"><strong>Drop file or click</strong><br>MP4, AVI, MOV, JPG, PNG</p>
              <input type="file" id="file-input" accept="video/*,image/*" style="display:none" aria-label="Upload file"/>
            </div>
            <div id="upload-filename" style="font-size:11px;color:var(--text-muted);margin-top:5px;display:none"></div>

            <div class="form-group" id="rtsp-group" style="display:none">
              <label class="form-label" for="rtsp-input">RTSP URL</label>
              <input type="text" class="form-input" id="rtsp-input" placeholder="rtsp://…" aria-label="RTSP URL"/>
            </div>
          </div>
        </div>

        <!-- MODEL -->
        <div class="live-panel-section">
          <div class="live-section-header">
            <span class="live-section-title">Model</span>
            <svg class="collapsible-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="form-group">
            <label class="form-label" for="model-select">YOLO Model</label>
            <select class="form-select" id="model-select" aria-label="YOLO model">
              <option value="yolov8n.pt">YOLOv8n · Fastest</option>
              <option value="yolov8s.pt" selected>YOLOv8s · Balanced</option>
              <option value="yolov8m.pt">YOLOv8m · Accurate</option>
              <option value="yolov8l.pt">YOLOv8l · Precise</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="tracker-select">Tracker</label>
            <select class="form-select" id="tracker-select" aria-label="Tracker">
              <option value="bytetrack" selected>ByteTrack</option>
              <option value="ocsort">OC-SORT</option>
            </select>
          </div>
          <div style="padding:4px 0" id="device-status">
            <span id="device-badge" style="font-size:11px;color:var(--text-muted)">—</span>
          </div>
        </div>

        <!-- DETECTION -->
        <div class="live-panel-section">
          <div class="live-section-header">
            <span class="live-section-title">Detection</span>
            <svg class="collapsible-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="form-group">
            <label class="form-label" for="conf-slider">
              Confidence
              <span class="form-label-value" id="conf-value">0.35</span>
            </label>
            <input type="range" id="conf-slider" min="0.05" max="0.95" step="0.05" value="0.35"
                   aria-label="Confidence threshold" aria-valuemin="0.05" aria-valuemax="0.95" aria-valuenow="0.35"/>
          </div>
          <div class="form-group">
            <label class="form-label" for="iou-slider">
              IoU Threshold
              <span class="form-label-value" id="iou-value">0.45</span>
            </label>
            <input type="range" id="iou-slider" min="0.1" max="0.9" step="0.05" value="0.45"
                   aria-label="IoU threshold"/>
          </div>
        </div>

        <!-- VISUALIZATION -->
        <div class="live-panel-section">
          <div class="live-section-header">
            <span class="live-section-title">Visualization</span>
            <svg class="collapsible-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="toggle-row">
            <span class="toggle-label-text">Motion Trails</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-trails" checked aria-label="Show motion trails"/>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label-text">Confidence</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-conf" checked aria-label="Show confidence"/>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label-text">Class Names</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-class" checked aria-label="Show class names"/>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label-text">Track IDs</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-ids" checked aria-label="Show track IDs"/>
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <!-- CLASS FILTER -->
        <div class="live-panel-section">
          <div class="live-section-header">
            <span class="live-section-title">Class Filter</span>
          </div>
          <div id="class-filter-list" class="class-filter-list" role="group" aria-label="Filter by class">
            <p style="font-size:11px;color:var(--text-faint)">Start session to filter classes</p>
          </div>
        </div>

      </aside>

      <!-- Center: Video Canvas -->
      <main class="live-center">
        <div class="video-area" id="video-area">

          <!-- Placeholder -->
          <div class="video-placeholder" id="video-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8">
              <path d="M15 10l4.553-2.277A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h3>No Stream Active</h3>
            <p>Select an input source and click <strong>Start</strong> to begin real-time detection and tracking.</p>
            <button class="btn btn-primary" onclick="document.getElementById('btn-start').click()">
              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg>
              Start Session
            </button>
          </div>

          <!-- Live stream image -->
          <img id="video-canvas" style="display:none;max-width:100%;max-height:100%;object-fit:contain" alt="Live detection feed"/>

          <!-- Loading overlay -->
          <div class="video-overlay" id="video-overlay">
            <div class="spinner"></div>
            <span class="overlay-text" id="overlay-text">Loading model…</span>
          </div>

          <!-- Live FPS overlay -->
          <div class="live-fps-overlay" id="live-fps-display"></div>

          <!-- Stream status top-right -->
          <div class="stream-status-overlay" id="stream-status-badge"></div>

          <!-- Canvas controls overlay (bottom-right) -->
          <div style="position:absolute;bottom:12px;right:12px;display:flex;gap:6px;z-index:10">
            <button class="btn btn-secondary btn-sm btn-icon" id="btn-snapshot" title="Snapshot" aria-label="Take snapshot">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="9" rx="1"/><circle cx="8" cy="8.5" r="2"/><path d="M6 4V3.5a1 1 0 011-1h2a1 1 0 011 1V4"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon" id="btn-fullscreen" title="Fullscreen" aria-label="Toggle fullscreen">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>

        <!-- Progress bar for video files -->
        <div id="video-progress" style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-surface);border-top:1px solid var(--border)">
          <div class="video-progress-bar" style="flex:1">
            <div class="video-progress-fill" id="progress-fill" style="width:0%"></div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);white-space:nowrap" id="progress-text">— / —</span>
        </div>
      </main>

      <!-- Right Insights Panel -->
      <aside class="live-right" aria-label="Analytics panel">
        <!-- Tabs -->
        <div class="live-right-tabs" role="tablist">
          <div class="live-right-tab active" role="tab" aria-selected="true"  data-panel="panel-analytics" id="tab-analytics">Analytics</div>
          <div class="live-right-tab" role="tab" aria-selected="false" data-panel="panel-tracks"   id="tab-tracks">Tracks</div>
          <div class="live-right-tab" role="tab" aria-selected="false" data-panel="panel-info"     id="tab-info">Info</div>
        </div>

        <div class="live-right-body">
          <!-- Analytics Tab -->
          <div class="live-right-panel active" id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics">

            <!-- Key metrics 2×2 grid -->
            <div class="metrics-grid-2x2">
              <div class="metric-mini">
                <div class="metric-mini-label">FPS</div>
                <div class="metric-mini-value accent" id="m-fps">—</div>
              </div>
              <div class="metric-mini">
                <div class="metric-mini-label">Latency</div>
                <div class="metric-mini-value" id="m-latency">—</div>
              </div>
              <div class="metric-mini">
                <div class="metric-mini-label">Objects</div>
                <div class="metric-mini-value" id="m-objects">—</div>
              </div>
              <div class="metric-mini">
                <div class="metric-mini-label">Tracks</div>
                <div class="metric-mini-value green" id="m-tracked">—</div>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Class distribution -->
            <div class="panel-subtitle">Detection by Class</div>
            <div id="class-dist" aria-label="Class distribution">
              <p style="font-size:11px;color:var(--text-faint);padding:8px 14px">No detections yet</p>
            </div>

            <div class="divider"></div>

            <!-- Timeline -->
            <div class="panel-subtitle">Event Timeline</div>
            <div id="timeline-list" class="timeline-list" role="log" aria-live="polite" aria-label="Event timeline">
              <p style="font-size:11px;color:var(--text-faint);padding:8px 14px">Events appear here during tracking</p>
            </div>

          </div>

          <!-- Tracks Tab -->
          <div class="live-right-panel" id="panel-tracks" role="tabpanel" aria-labelledby="tab-tracks">
            <div class="panel-subtitle">Active Tracks</div>
            <div id="track-list" class="track-list" role="list" aria-label="Active tracks">
              <p style="font-size:11px;color:var(--text-faint);padding:8px 14px">No active tracks</p>
            </div>
          </div>

          <!-- Info Tab -->
          <div class="live-right-panel" id="panel-info" role="tabpanel" aria-labelledby="tab-info">
            <div class="panel-subtitle">Model Information</div>
            <div class="info-grid" id="model-info">
              <span class="info-key">Model</span>   <span class="info-value" id="info-model">—</span>
              <span class="info-key">Device</span>  <span class="info-value" id="info-device">—</span>
              <span class="info-key">Input</span>   <span class="info-value" id="info-input">—</span>
              <span class="info-key">Classes</span> <span class="info-value" id="info-classes">—</span>
              <span class="info-key">Tracker</span> <span class="info-value" id="info-tracker">—</span>
            </div>
            <div class="divider"></div>
            <div class="panel-subtitle">Session Statistics</div>
            <div class="info-grid" id="session-counts">
              <span class="info-key">Duration</span>  <span class="info-value" id="info-duration">—</span>
              <span class="info-key">Frames</span>    <span class="info-value" id="info-frames">—</span>
              <span class="info-key">Unique IDs</span><span class="info-value" id="info-unique">—</span>
              <span class="info-key">Avg FPS</span>   <span class="info-value" id="info-avgfps">—</span>
              <span class="info-key">Avg ms</span>    <span class="info-value" id="info-avgms">—</span>
            </div>
          </div>
        </div>

        <!-- Export button at bottom -->
        <div style="padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:6px">
          <button id="btn-export" class="btn btn-secondary btn-sm" style="flex:1">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Export CSV
          </button>
        </div>

      </aside>

    </div>
  `;

  // Initialize existing JS modules with new DOM
  _frameCount = 0;
  _latestDetections = [];
  _sessionRunning = false;

  // Expose drawTrajectory globally (controls.js uses this)
  window._analyticsModule = { drawTrajectory };

  // Re-init stream with the newly rendered img element
  const frameEl = document.getElementById('video-canvas');
  stream.init(frameEl);

  // Init analytics module
  initAnalytics({
    onClassSelect: cls => highlightTracksByClass(cls)
  });

  // Init controls module
  initControls({
    stream,
    onStart: () => {
      _sessionRunning = true;
      showVideoFrame(false);
      showOverlay('Connecting…');
      updateSessionUI('running');
      showToast('Session Started', 'Detection pipeline active', 'success');
    },
    onStop: () => {
      _sessionRunning = false;
      showVideoFrame(false);
      hideOverlay();
      updateSessionUI('idle');
      showToast('Session Stopped', '', 'info');
    },
    onError: msg => {
      setState('error');
      showError(msg);
      showToast('Error', msg, 'error');
    }
  });

  // Stream events
  stream.on('frame', handleFrame);
  stream.on('status', handleStatus);
  stream.on('connected', hideOverlay);
  stream.on('disconnected', () => { if (_sessionRunning) showOverlay('Reconnecting…'); });
  stream.on('error', msg => { showError(msg); setState('error'); hideOverlay(); });

  // Source tab switching
  initSourceTabs();

  // Right panel tabs
  initPanelTabs();

  // Fullscreen button
  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    const area = document.getElementById('video-area');
    if (area) {
      if (!document.fullscreenElement) area.requestFullscreen().catch(()=>{});
      else document.exitFullscreen();
    }
  });

  // Snapshot button
  document.getElementById('btn-snapshot')?.addEventListener('click', () => {
    showToast('Snapshot Captured', 'Saved to Snapshots library', 'success');
  });

  // Class filter change events
  window.addEventListener('classFilterChange', e => {
    const allowed = e.detail;
    document.querySelectorAll('.track-item').forEach(item => {
      const show = allowed.length === 0 || allowed.includes(item.dataset.cls);
      item.style.display = show ? '' : 'none';
    });
  });

  return cleanup;
}

function cleanup() {
  stream.off('frame', handleFrame);
  stream.off('status', handleStatus);
  _sessionRunning = false;
  _frameCount = 0;
}

function handleFrame(msg) {
  _frameCount++;
  if (_frameCount === 1) {
    showVideoFrame(true);
    hideOverlay();
    setState('running');
    updateSessionUI('running');

    // Show FPS overlay
    const fpsEl = document.getElementById('live-fps-display');
    if (fpsEl) fpsEl.classList.add('visible');
  }

  _latestDetections = msg.detections || [];

  if (msg.analytics) {
    updateAnalytics(msg.analytics, msg.zone_counts);

    // Update FPS overlay
    const fpsEl = document.getElementById('live-fps-display');
    if (fpsEl && msg.analytics.fps) {
      fpsEl.textContent = `${msg.analytics.fps.toFixed(1)} FPS`;
    }
  }

  updateTrackList(_latestDetections, handleTrackClick);

  if (msg.analytics?.frame_id && msg.analytics?.total_frames) {
    updateProgress(msg.analytics.frame_id, msg.analytics.total_frames);
  }
}

function handleStatus(msg) {
  if (msg.state) setState(msg.state);
  if (msg.analytics) updateAnalytics(msg.analytics);
}

async function handleTrackClick(trackId) {
  try {
    const detail = await fetch(`/api/session/track/${trackId}`).then(r => r.json());
    const trail  = _trailCache[trackId] || null;
    openTrackDrawer(detail, trail);
    document.querySelectorAll('.track-item').forEach(el => {
      el.classList.toggle('highlighted', Number(el.dataset.id) === trackId);
    });
  } catch(e) {
    console.warn('[Live] Could not load track detail:', e);
  }
}

function updateProgress(frameId, totalFrames) {
  if (!totalFrames) return;
  const pct = Math.min(100, Math.round((frameId / totalFrames) * 100));
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `Frame ${frameId} / ${totalFrames} (${pct}%)`;
}

function updateSessionUI(state) {
  const statusEl = document.getElementById('header-session-status');
  const dotEl    = document.getElementById('header-live-dot');
  const textEl   = document.getElementById('header-status-text');
  if (!statusEl) return;

  if (state === 'running') {
    statusEl.className = 'header-session-status live';
    if (dotEl) { dotEl.className = 'session-live-dot live'; }
    if (textEl) textEl.textContent = 'Live';
    const badge = document.getElementById('live-nav-badge');
    if (badge) badge.style.display = 'inline-flex';
  } else {
    statusEl.className = 'header-session-status';
    if (dotEl) { dotEl.className = 'session-live-dot idle'; }
    if (textEl) textEl.textContent = 'Idle';
    const badge = document.getElementById('live-nav-badge');
    if (badge) badge.style.display = 'none';
  }
}

function initSourceTabs() {
  const tabs = document.querySelectorAll('.source-tab');
  const webcamGroup = document.getElementById('webcam-group');
  const uploadArea  = document.getElementById('upload-area');
  const rtspGroup   = document.getElementById('rtsp-group');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const source = tab.dataset.source;

      // Show/hide sections
      webcamGroup.style.display = source === 'webcam' ? '' : 'none';
      uploadArea.style.display  = (source === 'video' || source === 'image') ? 'block' : 'none';
      rtspGroup.style.display   = source === 'rtsp' ? '' : 'none';

      // Update source-select value
      const sel = document.getElementById('source-select');
      if (sel) {
        if (source === 'webcam') sel.value = '0';
        else if (source === 'video' || source === 'image') sel.value = 'video';
      }
    });
  });
}

function initPanelTabs() {
  const tabs   = document.querySelectorAll('.live-right-tab');
  const panels = document.querySelectorAll('.live-right-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      const panelId = tab.dataset.panel;
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}
