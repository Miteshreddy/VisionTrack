/**
 * VisionTrack — Application Bootstrap (app.js)
 *
 * Initializes the app shell:
 *   - Theme
 *   - Sidebar collapse
 *   - Router
 *   - Command palette & search
 *   - Notifications
 *   - Session status sync
 *   - WebSocket stream (background)
 */

import { router }                           from './router.js';
import { initTheme, initCommandPalette,
         initSearch, initNotifications,
         addNotification }                  from './components.js';
import stream                               from './stream.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // 1. Theme (must be first)
  initTheme();

  // 2. Sidebar collapse
  initSidebar();

  // 3. Router (hash-based SPA)
  router.init();

  // 4. Command palette
  initCommandPalette(router);

  // 5. Global search
  initSearch(router);

  // 6. Notifications
  initNotifications();

  // 7. Nav item clicks → router
  initNav();

  // 8. WebSocket stream (always connected in background)
  initStream();

  // 9. Health check → system status
  checkHealth();
  setInterval(checkHealth, 15000);
});

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');
  if (!sidebar || !toggle) return;

  const savedCollapsed = localStorage.getItem('vt-sidebar') === 'collapsed';
  if (savedCollapsed) sidebar.classList.add('collapsed');

  toggle.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('vt-sidebar', isCollapsed ? 'collapsed' : 'expanded');
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function initNav() {
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      router.navigate(item.dataset.route);
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') router.navigate(item.dataset.route);
    });
  });
}

// ─── WebSocket Stream ─────────────────────────────────────────────────────────

function initStream() {
  const frameEl = document.getElementById('video-canvas');

  // stream.js init — works regardless of whether <img> exists now
  // The live page will also call initStream when it mounts
  if (frameEl) stream.init(frameEl);

  stream.on('connected', () => {
    setSystemStatus('online');
  });

  stream.on('disconnected', () => {
    setSystemStatus('warning');
  });

  stream.on('error', () => {
    setSystemStatus('error');
  });

  stream.on('frame', (msg) => {
    const anal = msg.analytics;
    if (anal) {
      updateHeaderSessionStatus('running', anal.fps?.toFixed(1) || '—');
      const badge = document.getElementById('live-nav-badge');
      if (badge) badge.style.display = 'inline-flex';
    }
  });

  stream.on('status', (msg) => {
    if (msg.state === 'idle' || msg.state === 'stopped') {
      updateHeaderSessionStatus('idle', 'Idle');
      const badge = document.getElementById('live-nav-badge');
      if (badge) badge.style.display = 'none';
    }
  });

  // Connect
  stream.connect();
}

// ─── Session Status Header ────────────────────────────────────────────────────

export function updateHeaderSessionStatus(state, label) {
  const statusEl = document.getElementById('header-session-status');
  const dotEl    = document.getElementById('header-live-dot');
  const textEl   = document.getElementById('header-status-text');

  if (!statusEl || !dotEl || !textEl) return;

  statusEl.className = 'header-session-status';
  dotEl.className    = 'session-live-dot';

  if (state === 'running') {
    statusEl.classList.add('live');
    dotEl.classList.add('live');
    textEl.textContent = `Live · ${label} FPS`;
  } else if (state === 'error') {
    statusEl.classList.add('error');
    dotEl.classList.add('idle');
    textEl.textContent = 'Error';
  } else {
    dotEl.classList.add('idle');
    textEl.textContent = label || 'Idle';
  }
}

// ─── System Status Indicator ──────────────────────────────────────────────────

function setSystemStatus(state) {
  const dot   = document.getElementById('system-status-dot');
  const label = document.getElementById('system-status-label');
  if (!dot || !label) return;

  dot.className   = `status-dot ${state === 'online' ? '' : state}`;
  label.textContent = {
    online:  'System Online',
    warning: 'Reconnecting…',
    error:   'Connection Error',
    idle:    'Idle',
  }[state] || state;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

async function checkHealth() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      setSystemStatus('online');
    } else {
      setSystemStatus('warning');
    }
  } catch {
    setSystemStatus('warning');
  }
}
