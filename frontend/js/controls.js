/**
 * VisionTrack — Controls Module
 *
 * Handles all UI control interactions:
 * - Start / Stop / Pause / Resume session via REST API
 * - File upload (drag & drop + click)
 * - Settings changes (conf, iou, tracker, trails, etc.)
 * - Session state badge updates
 * - Panel tab switching
 * - Track detail drawer open/close
 */

// -------------------------------------------------------------------------
// API helpers
// -------------------------------------------------------------------------

const API = {
  async post(path, body = {}) {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  },

  async get(path) {
    const res = await fetch(`/api${path}`);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  },

  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/video/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  },
};

// -------------------------------------------------------------------------
// Controls state
// -------------------------------------------------------------------------

let _state = 'idle';     // idle | loading | running | paused | stopped | error
let _uploadedPath = null;
let _onStart = null;
let _onStop  = null;
let _stream  = null;

// -------------------------------------------------------------------------
// Init
// -------------------------------------------------------------------------

export function initControls({ stream, onStart, onStop, onError }) {
  _stream  = stream;
  _onStart = onStart;
  _onStop  = onStop;

  setupSessionButtons(onError);
  setupSourceSelector();
  setupUploadArea(onError);
  setupSliders(stream);
  setupToggles(stream);
  setupTabs();
  setupExport();
  setupDrawer();
}

// -------------------------------------------------------------------------
// Session control buttons
// -------------------------------------------------------------------------

function setupSessionButtons(onError) {
  document.getElementById('btn-start')?.addEventListener('click', async () => {
    await handleStart(onError);
  });

  document.getElementById('btn-pause')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-pause');
    try {
      if (_state === 'running') {
        await API.post('/video/pause');
        setState('paused');
      } else if (_state === 'paused') {
        await API.post('/video/resume');
        setState('running');
      }
      // Update button label
      btn.innerHTML = _state === 'paused'
        ? `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3h2v10H5zm4 0h2v10H9z"/></svg> Pause`
        : `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg> Resume`;
    } catch (e) {
      showError(e.message);
    }
  });

  document.getElementById('btn-stop')?.addEventListener('click', async () => {
    try {
      await API.post('/video/stop');
      setState('stopped');
      if (_onStop) _onStop();
    } catch (e) {
      showError(e.message);
    }
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    try {
      await API.post('/video/reset');
      setState('idle');
      _uploadedPath = null;
      document.getElementById('upload-filename').style.display = 'none';
      if (_onStop) _onStop();
    } catch (e) {
      showError(e.message);
    }
  });
}

async function handleStart(onError) {
  const source = _uploadedPath || getSourceValue();
  const model  = document.getElementById('model-select')?.value || 'yolov8n.pt';
  const tracker = document.getElementById('tracker-select')?.value || 'bytetrack';
  const conf   = parseFloat(document.getElementById('conf-slider')?.value || '0.35');
  const iou    = parseFloat(document.getElementById('iou-slider')?.value || '0.45');
  const trails = document.getElementById('toggle-trails')?.checked ?? true;

  try {
    setState('loading');
    showOverlay('Loading model…');

    // 1. Load model
    await API.post('/video/load-model', { weights: model });

    showOverlay('Opening source…');

    // 2. Start session
    await API.post('/video/start', {
      source,
      conf_thres: conf,
      iou_thres: iou,
      tracker_type: tracker,
      show_trails: trails,
    });

    setState('running');
    hideOverlay();
    if (_onStart) _onStart();

  } catch (e) {
    setState('error');
    hideOverlay();
    const msg = e.message || 'Failed to start session';
    showError(msg);
    if (onError) onError(msg);
  }
}

// -------------------------------------------------------------------------
// Source selector
// -------------------------------------------------------------------------

function setupSourceSelector() {
  const sel = document.getElementById('source-select');
  const uploadArea = document.getElementById('upload-area');

  sel?.addEventListener('change', () => {
    const isFile = sel.value === 'video';
    uploadArea.style.display = isFile ? 'block' : 'none';
    _uploadedPath = null;
  });
}

function getSourceValue() {
  const val = document.getElementById('source-select')?.value || '0';
  return val === 'video' ? '0' : val;
}

// -------------------------------------------------------------------------
// File upload
// -------------------------------------------------------------------------

function setupUploadArea(onError) {
  const area     = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const nameEl   = document.getElementById('upload-filename');

  if (!area || !fileInput) return;

  area.addEventListener('click', () => fileInput.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0], onError, nameEl);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileUpload(fileInput.files[0], onError, nameEl);
  });
}

async function handleFileUpload(file, onError, nameEl) {
  try {
    nameEl.style.display = 'block';
    nameEl.textContent = `Uploading ${file.name}…`;

    const result = await API.upload(file);
    _uploadedPath = result.data?.saved_path || null;
    nameEl.textContent = `✓ ${file.name}`;
  } catch (e) {
    nameEl.textContent = `✗ Upload failed`;
    if (onError) onError(e.message);
  }
}

// -------------------------------------------------------------------------
// Sliders
// -------------------------------------------------------------------------

function setupSliders(stream) {
  setupSlider('conf-slider', 'conf-value', (val) => {
    if (stream) stream.sendSettings({ conf_thres: val });
    // Also update via REST if session is running
    if (_state === 'running') {
      API.post('/video/settings', { conf_thres: val }).catch(() => {});
    }
  });

  setupSlider('iou-slider', 'iou-value', (val) => {
    if (_state === 'running') {
      API.post('/video/settings', { iou_thres: val }).catch(() => {});
    }
  });
}

function setupSlider(sliderId, valueId, onChange) {
  const slider = document.getElementById(sliderId);
  const valEl  = document.getElementById(valueId);
  if (!slider) return;

  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    if (valEl) valEl.textContent = val.toFixed(2);
    if (onChange) onChange(val);
  });
}

// -------------------------------------------------------------------------
// Toggle switches
// -------------------------------------------------------------------------

function setupToggles(stream) {
  const toggMap = {
    'toggle-trails': 'show_trails',
    'toggle-conf':   'show_conf',
    'toggle-class':  'show_class',
    'toggle-ids':    'show_id',
  };

  Object.entries(toggMap).forEach(([id, settingKey]) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const val = e.target.checked;
      if (stream) stream.sendSettings({ [settingKey]: val });
      if (_state === 'running') {
        API.post('/video/settings', { [settingKey]: val }).catch(() => {});
      }
    });
  });
}

// -------------------------------------------------------------------------
// Panel tabs
// -------------------------------------------------------------------------

function setupTabs() {
  const tabs = document.querySelectorAll('.panel-tab');
  const panels = document.querySelectorAll('.panel-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const panelId = tab.getAttribute('aria-controls');
      document.getElementById(panelId)?.classList.add('active');
    });
  });
}

// -------------------------------------------------------------------------
// Export
// -------------------------------------------------------------------------

function setupExport() {
  document.getElementById('btn-export')?.addEventListener('click', () => {
    window.location.href = '/api/session/export/csv';
  });
}

// -------------------------------------------------------------------------
// Track detail drawer
// -------------------------------------------------------------------------

let _drawerOpen = false;

function setupDrawer() {
  const overlay = document.getElementById('drawer-overlay');
  const drawer  = document.getElementById('track-drawer');
  const closeBtn = document.getElementById('drawer-close');

  function close() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-hidden', 'true');
    _drawerOpen = false;
  }

  overlay?.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _drawerOpen) close();
  });
}

export function openTrackDrawer(trackDetail, trail) {
  const overlay = document.getElementById('drawer-overlay');
  const drawer  = document.getElementById('track-drawer');

  if (!trackDetail) return;

  // Populate fields
  setText('d-track-id',   `#${trackDetail.track_id}`);
  setText('d-class',      trackDetail.class_name || '—');
  setText('d-conf',       trackDetail.confidence !== undefined ? `${(trackDetail.confidence * 100).toFixed(1)}%` : '—');
  setText('d-first-seen', `Frame ${trackDetail.first_seen_frame || '—'}`);
  setText('d-frames',     trackDetail.frames_tracked?.toString() || '—');
  setText('d-bbox',       trackDetail.last_bbox ? trackDetail.last_bbox.map(v => Math.round(v)).join(', ') : '—');

  const statusEl = document.getElementById('d-status');
  if (statusEl) {
    statusEl.className = `status-pill ${trackDetail.status === 'active' ? 'active' : 'inactive'}`;
    statusEl.textContent = trackDetail.status || 'unknown';
  }

  // Draw trajectory
  if (trail && trail.length >= 2) {
    const { drawTrajectory } = window._analyticsModule || {};
    if (drawTrajectory) drawTrajectory(trail);
  }

  overlay.classList.add('open');
  drawer.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  drawer.setAttribute('aria-hidden', 'false');
  _drawerOpen = true;
}

// -------------------------------------------------------------------------
// State management
// -------------------------------------------------------------------------

export function setState(newState) {
  _state = newState;
  updateBadge(newState);
  updateButtons(newState);
}

function updateBadge(state) {
  const badge = document.getElementById('session-badge');
  const dot   = document.getElementById('live-dot');
  if (!badge || !dot) return;

  const labels = {
    idle: 'Idle', loading: 'Loading…', running: 'Live',
    paused: 'Paused', stopped: 'Stopped', error: 'Error',
  };
  const dotClasses = {
    idle: 'stopped', loading: '', running: '', paused: 'paused', stopped: 'stopped', error: 'stopped',
  };

  badge.className = `badge badge-${state}`;
  badge.innerHTML = `<span class="live-dot ${dotClasses[state] || ''}"></span> ${labels[state] || state}`;
}

function updateButtons(state) {
  const btnStart  = document.getElementById('btn-start');
  const btnPause  = document.getElementById('btn-pause');
  const btnStop   = document.getElementById('btn-stop');
  const pauseBtn  = document.getElementById('btn-pause');

  if (!btnStart) return;

  if (state === 'running') {
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnStop.disabled  = false;
    pauseBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3h2v10H5zm4 0h2v10H9z"/></svg> Pause`;
  } else if (state === 'paused') {
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnStop.disabled  = false;
    pauseBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg> Resume`;
  } else {
    btnStart.disabled = state === 'loading';
    btnPause.disabled = true;
    btnStop.disabled  = true;
  }
}

// -------------------------------------------------------------------------
// Video overlay helpers
// -------------------------------------------------------------------------

export function showOverlay(text) {
  const overlay = document.getElementById('video-overlay');
  const textEl  = document.getElementById('overlay-text');
  if (overlay) overlay.classList.add('visible');
  if (textEl) textEl.textContent = text || '';
}

export function hideOverlay() {
  document.getElementById('video-overlay')?.classList.remove('visible');
}

export function showVideoFrame(show) {
  const img  = document.getElementById('video-canvas');
  const ph   = document.getElementById('video-placeholder');
  if (img) img.style.display = show ? 'block' : 'none';
  if (ph)  ph.style.display  = show ? 'none' : 'flex';
}

// -------------------------------------------------------------------------
// Error
// -------------------------------------------------------------------------

export function showError(message, duration = 5000) {
  const el = document.getElementById('error-banner');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), duration);
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
