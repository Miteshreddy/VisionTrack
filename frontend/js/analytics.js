/**
 * VisionTrack — Analytics Module
 *
 * Handles all analytics display:
 * - Metric cards (FPS, objects, tracked, latency)
 * - Class distribution bar chart
 * - Timeline events list
 * - Model info panel
 * - Session statistics
 *
 * This module receives analytics snapshots from the stream and
 * updates the DOM. All values displayed come directly from backend data.
 */

// -------------------------------------------------------------------------
// Class color palette (matches backend and track list)
// -------------------------------------------------------------------------

const CLASS_COLORS = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626',
  '#7C3AED', '#0891B2', '#DB2777', '#059669',
  '#EA580C', '#0284C7', '#65A30D', '#9333EA',
];

// Selected class for cross-highlight interaction
let _selectedClass = null;
let _onClassSelect = null;

// Animated number state
const _animState = {};

// -------------------------------------------------------------------------
// Init
// -------------------------------------------------------------------------

export function initAnalytics({ onClassSelect } = {}) {
  _onClassSelect = onClassSelect;
}

// -------------------------------------------------------------------------
// Main update entry point — called for each analytics snapshot
// -------------------------------------------------------------------------

export function updateAnalytics(analytics, zoneCounts = {}) {
  if (!analytics) return;

  // Metrics
  animateNumber('m-fps',     analytics.fps,             1);
  animateNumber('m-objects', analytics.current_objects, 0);
  animateNumber('m-tracked', analytics.unique_tracked,  0);
  animateNumber('m-latency', analytics.inference_ms,    1);

  // Info panel
  setTextContent('info-model',    analytics.model_name || '—');
  setTextContent('info-device',   analytics.device || '—');
  setTextContent('info-input',    '640 × 640');
  setTextContent('info-classes',  '80 (COCO)');
  setTextContent('info-tracker',  analytics.tracker_name || '—');
  setTextContent('info-duration', formatDuration(analytics.session_duration_s || 0));
  setTextContent('info-frames',   (analytics.frame_id || 0).toString());
  setTextContent('info-unique',   (analytics.unique_tracked || 0).toString());
  setTextContent('info-avgfps',   (analytics.fps || 0).toFixed(1));
  setTextContent('info-avgms',    (analytics.inference_ms || 0).toFixed(1));

  // Device badge in header
  updateDeviceBadge(analytics.device);

  // Class distribution
  updateClassDistribution(analytics.class_counts_total || {});

  // Timeline
  if (analytics.timeline && analytics.timeline.length > 0) {
    updateTimeline(analytics.timeline);
  }
}

// -------------------------------------------------------------------------
// Class distribution bars
// -------------------------------------------------------------------------

function updateClassDistribution(counts) {
  const container = document.getElementById('class-dist');
  if (!container) return;

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No detections yet</p>';
    return;
  }

  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  // Update class filter list in sidebar too
  updateClassFilterList(entries);

  container.innerHTML = '';
  entries.slice(0, 12).forEach(([cls, count], i) => {
    const color = CLASS_COLORS[i % CLASS_COLORS.length];
    const pct   = Math.round((count / maxVal) * 100);
    const isSelected = _selectedClass === cls;

    const item = document.createElement('div');
    item.className = `class-dist-item${isSelected ? ' selected' : ''}`;
    item.dataset.cls = cls;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `${cls}: ${count} detections`);
    item.innerHTML = `
      <span class="class-dist-name">${cls}</span>
      <div class="class-dist-bar-track">
        <div class="class-dist-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="class-dist-count">${count}</span>
    `;

    item.addEventListener('click', () => toggleClassSelect(cls));
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggleClassSelect(cls); });
    container.appendChild(item);
  });
}

function toggleClassSelect(cls) {
  _selectedClass = (_selectedClass === cls) ? null : cls;
  if (_onClassSelect) _onClassSelect(_selectedClass);

  // Refresh the distribution display
  const items = document.querySelectorAll('.class-dist-item');
  items.forEach(item => {
    const selected = item.dataset.cls === _selectedClass;
    item.classList.toggle('selected', selected);
  });

  // Highlight tracks in track list
  highlightTracksByClass(_selectedClass);
}

export function highlightTracksByClass(cls) {
  const trackItems = document.querySelectorAll('.track-item');
  trackItems.forEach(item => {
    const matchesCls = !cls || item.dataset.cls === cls;
    item.style.opacity = matchesCls ? '1' : '0.3';
  });
}

// -------------------------------------------------------------------------
// Class filter in sidebar
// -------------------------------------------------------------------------

let _availableClasses = new Set();

function updateClassFilterList(entries) {
  const classes = new Set(entries.map(([cls]) => cls));
  // Only rebuild if classes changed
  if (setsEqual(classes, _availableClasses)) return;
  _availableClasses = classes;

  const container = document.getElementById('class-filter-list');
  if (!container) return;

  // Preserve existing checked state
  const existingState = {};
  container.querySelectorAll('input[type=checkbox]').forEach(cb => {
    existingState[cb.value] = cb.checked;
  });

  container.innerHTML = '';
  entries.forEach(([cls, count]) => {
    const checked = existingState[cls] !== undefined ? existingState[cls] : true;
    const item = document.createElement('label');
    item.className = 'class-filter-item';
    item.innerHTML = `
      <input type="checkbox" value="${cls}" ${checked ? 'checked' : ''} aria-label="Show ${cls}" />
      <span class="class-filter-label">${cls}</span>
      <span class="class-filter-count">${count}</span>
    `;
    container.appendChild(item);
  });

  // Notify app of filter changes
  container.addEventListener('change', () => {
    const checked = [...container.querySelectorAll('input:checked')].map(el => el.value);
    window.dispatchEvent(new CustomEvent('classFilterChange', { detail: checked }));
  });
}

// -------------------------------------------------------------------------
// Timeline
// -------------------------------------------------------------------------

let _lastEventCount = 0;

function updateTimeline(events) {
  const container = document.getElementById('timeline-list');
  if (!container) return;

  if (events.length === _lastEventCount) return;
  _lastEventCount = events.length;

  container.innerHTML = '';
  events.slice(0, 25).forEach(ev => {
    const typeLabel = {
      appeared: 'appeared',
      lost: 'lost',
      zone_entered: `entered ${ev.zone_name}`,
      zone_exited: `left ${ev.zone_name}`,
      line_crossed: `crossed ${ev.zone_name}`,
    }[ev.event_type] || ev.event_type;

    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.innerHTML = `
      <div class="timeline-dot ${ev.event_type}" aria-hidden="true"></div>
      <div class="timeline-content">
        <div class="timeline-desc">
          <strong>#${ev.track_id}</strong> ${ev.class_name ? `(${ev.class_name})` : ''} ${typeLabel}
        </div>
        <div class="timeline-meta">${ev.timestamp} · frame ${ev.frame_id}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

// -------------------------------------------------------------------------
// Track list (active tracks tab)
// -------------------------------------------------------------------------

const _trackColors = {};
const _colorPalette = [
  '#2563EB','#16A34A','#D97706','#DC2626',
  '#7C3AED','#0891B2','#DB2777','#059669',
];

function getTrackColor(id) {
  if (!_trackColors[id]) {
    _trackColors[id] = _colorPalette[Object.keys(_trackColors).length % _colorPalette.length];
  }
  return _trackColors[id];
}

export function updateTrackList(detections, onTrackClick) {
  const container = document.getElementById('track-list');
  if (!container) return;

  if (!detections || detections.length === 0) {
    if (!container.querySelector('.empty-state')) {
      container.innerHTML = '<p class="empty-state">No active tracks</p>';
    }
    return;
  }

  // Check if IDs changed
  const newIds = new Set(detections.map(d => d.track_id));
  const existingIds = new Set(
    [...container.querySelectorAll('.track-item')].map(el => Number(el.dataset.id))
  );

  if (setsEqual(newIds, existingIds)) {
    // Just update class and conf values
    detections.forEach(det => {
      const el = container.querySelector(`[data-id="${det.track_id}"]`);
      if (el) {
        const confEl = el.querySelector('.track-conf');
        if (confEl) confEl.textContent = `${(det.confidence * 100).toFixed(0)}%`;
      }
    });
    return;
  }

  // Rebuild
  container.innerHTML = '';
  detections.forEach(det => {
    const color = getTrackColor(det.track_id);
    const item = document.createElement('div');
    item.className = 'track-item';
    item.dataset.id  = det.track_id;
    item.dataset.cls = det.class_name;
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `Track ${det.track_id}: ${det.class_name}`);
    item.innerHTML = `
      <span class="track-id-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
        #${det.track_id}
      </span>
      <span class="track-class">${det.class_name}</span>
      <span class="track-conf">${(det.confidence * 100).toFixed(0)}%</span>
    `;
    item.addEventListener('click', () => onTrackClick && onTrackClick(det.track_id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onTrackClick && onTrackClick(det.track_id);
    });
    container.appendChild(item);
  });
}

// -------------------------------------------------------------------------
// Animated number counter
// -------------------------------------------------------------------------

function animateNumber(id, target, decimals = 0) {
  const el = document.getElementById(id);
  if (!el) return;

  const current = parseFloat(el.textContent) || 0;
  if (Math.abs(current - target) < 0.01) {
    el.textContent = target.toFixed(decimals);
    return;
  }

  // Quick lerp animation
  const diff = target - current;
  const step = diff * 0.35;
  const next = current + step;
  el.textContent = next.toFixed(decimals);

  if (Math.abs(target - next) > 0.05) {
    if (_animState[id]) cancelAnimationFrame(_animState[id]);
    _animState[id] = requestAnimationFrame(() => animateNumber(id, target, decimals));
  } else {
    el.textContent = target.toFixed(decimals);
  }
}

// -------------------------------------------------------------------------
// Device badge
// -------------------------------------------------------------------------

function updateDeviceBadge(device) {
  const badge = document.getElementById('device-badge');
  if (!badge) return;

  const isCuda = device && device.toLowerCase().includes('cuda');
  badge.textContent = isCuda ? '⚡ ' + device.toUpperCase() : '🖥 ' + (device || 'CPU').toUpperCase();
  badge.className = isCuda ? 'device-badge cuda' : 'device-badge';
}

// -------------------------------------------------------------------------
// Trajectory canvas (in track detail drawer)
// -------------------------------------------------------------------------

export function drawTrajectory(trail) {
  const canvas = document.getElementById('trajectory-canvas');
  if (!canvas || !trail || trail.length < 2) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Normalize trail to canvas bounds
  const xs = trail.map(p => p[0]);
  const ys = trail.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);

  const pad = 12;
  const mapX = x => pad + ((x - minX) / rangeX) * (W - pad * 2);
  const mapY = y => pad + ((y - minY) / rangeY) * (H - pad * 2);

  ctx.lineWidth = 2;
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < trail.length; i++) {
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(37, 99, 235, ${0.3 + t * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(mapX(trail[i-1][0]), mapY(trail[i-1][1]));
    ctx.lineTo(mapX(trail[i][0]),   mapY(trail[i][1]));
    ctx.stroke();
  }

  // Draw endpoint dot
  const last = trail[trail.length - 1];
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.arc(mapX(last[0]), mapY(last[1]), 4, 0, Math.PI * 2);
  ctx.fill();
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
