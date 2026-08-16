/**
 * VisionTrack — Shared Components Module
 * Toast notifications, Modal system, Command Palette, Global Search, Context Menu
 */

// ─── Toast System ─────────────────────────────────────────────────────────────

const TOAST_DURATION = 4000;

export function showToast(title, msg = '', type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 11v.5" stroke-linecap="round"/></svg>`,
    warning: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L14 14H2L8 2z" stroke-linejoin="round"/><path d="M8 7v3M8 12v.5" stroke-linecap="round"/></svg>`,
    info:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5" stroke-linecap="round"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/></svg>
    </button>
  `;

  const dismiss = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, TOAST_DURATION);
}

// ─── Modal System ─────────────────────────────────────────────────────────────

export function openModal({ title = '', body = '', footer = '', size = '' } = {}) {
  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const bodyEl  = document.getElementById('modal-body');
  const footerEl= document.getElementById('modal-footer');

  if (!overlay || !modal) return;

  titleEl.textContent = title;
  bodyEl.innerHTML  = body;
  footerEl.innerHTML= footer;

  modal.className = `modal ${size ? 'modal-' + size : ''}`;
  overlay.classList.add('open');

  // Wire close button
  document.getElementById('modal-close')?.addEventListener('click', closeModal, { once: true });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); }, { once: true });
}

export function closeModal() {
  document.getElementById('modal-overlay')?.classList.remove('open');
}

// Confirm dialog helper
export function confirmModal({ title, message, confirmText = 'Confirm', onConfirm, danger = false }) {
  openModal({
    title,
    body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.6">${message}</p>`,
    footer: `
      <button class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>
    `,
  });

  setTimeout(() => {
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
      closeModal();
      if (onConfirm) onConfirm();
    });
  }, 10);
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

let _contextMenuOpen = false;

export function showContextMenu(e, items = []) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  menu.innerHTML = items.map(item => {
    if (item === 'sep') return `<div class="ctx-separator"></div>`;
    return `
      <div class="ctx-item${item.danger ? ' danger' : ''}" data-action="${item.action || ''}">
        ${item.icon ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:13px;height:13px">${item.icon}</svg>` : ''}
        ${item.label}
      </div>
    `;
  }).join('');

  // Position
  let x = e.clientX;
  let y = e.clientY;
  if (x + 180 > window.innerWidth) x = x - 180;
  if (y + items.length * 34 > window.innerHeight) y = y - items.length * 34;

  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
  menu.style.display = 'block';
  _contextMenuOpen = true;

  // Wire actions
  items.forEach(item => {
    if (item === 'sep') return;
    const el = menu.querySelector(`[data-action="${item.action}"]`);
    el?.addEventListener('click', () => {
      hideContextMenu();
      if (item.handler) item.handler();
    }, { once: true });
  });
}

export function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.style.display = 'none';
  _contextMenuOpen = false;
}

document.addEventListener('click', () => { if (_contextMenuOpen) hideContextMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _contextMenuOpen) hideContextMenu(); });

// ─── Notification Center ──────────────────────────────────────────────────────

import { MOCK_NOTIFICATIONS } from './mock-data.js';

let _notifs = [...MOCK_NOTIFICATIONS];
let _notifPanelOpen = false;

export function initNotifications() {
  const trigger = document.getElementById('notif-trigger');
  const panel   = document.getElementById('notif-panel');
  const closeBtn= document.getElementById('notif-close');

  updateNotifBadge();
  renderNotifList();

  trigger?.addEventListener('click', () => {
    _notifPanelOpen = !_notifPanelOpen;
    panel.classList.toggle('open', _notifPanelOpen);
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    _notifPanelOpen = false;
  });
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const unread = _notifs.filter(n => !n.read).length;
  if (badge) badge.style.display = unread > 0 ? 'block' : 'none';
}

function renderNotifList() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  const icons = {
    success: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8l4 4 6-7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warning: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L14 14H2z" stroke-linejoin="round"/><path d="M8 7v3M8 12v.5" stroke-linecap="round"/></svg>`,
    error:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4" stroke-linecap="round"/></svg>`,
    info:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5" stroke-linecap="round"/></svg>`,
  };

  list.innerHTML = _notifs.map(n => `
    <div class="notif-item${n.read ? '' : ' unread'}" data-notif-id="${n.id}">
      <div class="notif-icon ${n.type}">${icons[n.type] || icons.info}</div>
      <div class="notif-body">
        <div class="notif-body-title">${n.title}</div>
        <div class="notif-body-msg">${n.msg}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.notifId;
      const n = _notifs.find(x => x.id === id);
      if (n) { n.read = true; el.classList.remove('unread'); updateNotifBadge(); }
    });
  });
}

export function addNotification(type, title, msg) {
  const n = {
    id: 'n-' + Date.now(),
    type, title, msg,
    time: 'now',
    read: false,
  };
  _notifs.unshift(n);
  renderNotifList();
  updateNotifBadge();
  showToast(title, msg, type);
}

// ─── Command Palette ──────────────────────────────────────────────────────────

const CMD_COMMANDS = [
  { label: 'Open Dashboard',     sub: 'Navigate',   route: 'dashboard',           kbd: null,   icon: '<rect x="2" y="2" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="2" width="5.5" height="5.5" rx="1"/><rect x="2" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/>' },
  { label: 'Open Live Monitor',  sub: 'Navigate',   route: 'live',                kbd: null,   icon: '<circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="6" stroke-dasharray="2 2"/>' },
  { label: 'Open Cameras',       sub: 'Navigate',   route: 'cameras',             kbd: null,   icon: '<path d="M1.5 5.5a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-6z"/><path d="M12.5 6.5l2.5-1.5v6l-2.5-1.5"/>' },
  { label: 'Open Sessions',      sub: 'Navigate',   route: 'sessions',            kbd: null,   icon: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5" stroke-linecap="round"/>' },
  { label: 'Start Session',      sub: 'Action',     action: 'start-session',      kbd: null,   icon: '<path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/>' },
  { label: 'Stop Session',       sub: 'Action',     action: 'stop-session',       kbd: null,   icon: '<rect x="3" y="3" width="10" height="10" rx="1"/>' },
  { label: 'Toggle Tracking',    sub: 'Action',     action: 'toggle-tracking',    kbd: null,   icon: '<circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="4" r="1.5"/><path d="M5.5 10.5C6 9 8 8 9 7s2.5-2 2-3.5" stroke-linecap="round"/>' },
  { label: 'Take Snapshot',      sub: 'Action',     action: 'take-snapshot',      kbd: null,   icon: '<rect x="2" y="4" width="12" height="9" rx="1"/><circle cx="8" cy="8.5" r="2"/>' },
  { label: 'Start Recording',    sub: 'Action',     action: 'start-recording',    kbd: null,   icon: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/>' },
  { label: 'Open Analytics',     sub: 'Navigate',   route: 'analytics-overview',  kbd: null,   icon: '<path d="M2 12l3-4 3 2 3-5 3 3" stroke-linecap="round" stroke-linejoin="round"/>' },
  { label: 'Open Model Library', sub: 'Navigate',   route: 'models',              kbd: null,   icon: '<path d="M8 1l6 3.5v4L8 12l-6-3.5v-4L8 1z"/>' },
  { label: 'Open Performance',   sub: 'Navigate',   route: 'performance',         kbd: null,   icon: '<circle cx="8" cy="8" r="5"/><path d="M8 8l3-2" stroke-linecap="round"/>' },
  { label: 'Open Settings',      sub: 'Navigate',   route: 'settings',            kbd: null,   icon: '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7"/>' },
  { label: 'Export Session CSV', sub: 'Action',     action: 'export-csv',         kbd: null,   icon: '<path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/>' },
  { label: 'Toggle Theme',       sub: 'Interface',  action: 'toggle-theme',       kbd: null,   icon: '<path d="M13.5 10A6.5 6.5 0 016 2.5 6 6 0 1013.5 10z"/>' },
];

let _cmdOpen = false;

export function initCommandPalette(router) {
  const overlay  = document.getElementById('cmd-overlay');
  const input    = document.getElementById('cmd-input');
  const trigger  = document.getElementById('cmd-trigger');

  function open() {
    overlay.classList.add('open');
    input.value = '';
    renderCmdResults('', router);
    setTimeout(() => input.focus(), 20);
    _cmdOpen = true;
  }

  function close() {
    overlay.classList.remove('open');
    _cmdOpen = false;
  }

  trigger?.addEventListener('click', open);
  overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      _cmdOpen ? close() : open();
    }
    if (e.key === 'Escape' && _cmdOpen) close();
  });

  input?.addEventListener('input', () => renderCmdResults(input.value, router));
}

function renderCmdResults(query, router) {
  const results = document.getElementById('cmd-results');
  if (!results) return;

  const q = query.toLowerCase().trim();
  const filtered = CMD_COMMANDS.filter(c => c.label.toLowerCase().includes(q));

  if (filtered.length === 0) {
    results.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-desc">No commands found for "${query}"</div></div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(c => {
    const g = c.sub || 'General';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  });

  results.innerHTML = Object.entries(grouped).map(([group, cmds]) => `
    <div class="cmd-section-label">${group}</div>
    ${cmds.map((c, i) => `
      <div class="cmd-item" data-route="${c.route || ''}" data-action="${c.action || ''}">
        <div class="cmd-item-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${c.icon}</svg>
        </div>
        <div>
          <div class="cmd-item-label">${c.label}</div>
        </div>
        ${c.kbd ? `<span class="cmd-item-kbd">${c.kbd}</span>` : ''}
      </div>
    `).join('')}
  `).join('');

  results.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => {
      const route  = el.dataset.route;
      const action = el.dataset.action;

      document.getElementById('cmd-overlay').classList.remove('open');
      _cmdOpen = false;

      if (route && router) {
        router.navigate(route);
      } else if (action) {
        handleCmdAction(action);
      }
    });
  });
}

function handleCmdAction(action) {
  switch (action) {
    case 'start-session':
      document.getElementById('btn-start')?.click();
      break;
    case 'stop-session':
      document.getElementById('btn-stop')?.click();
      break;
    case 'export-csv':
      window.location.href = '/api/session/export/csv';
      break;
    case 'toggle-theme': {
      const html = document.documentElement;
      const isDark = html.dataset.theme !== 'light';
      html.dataset.theme = isDark ? 'light' : 'dark';
      localStorage.setItem('vt-theme', html.dataset.theme);
      updateThemeIcon(html.dataset.theme);
      break;
    }
    case 'take-snapshot':
      showToast('Snapshot Captured', 'Saved to Snapshots library', 'success');
      break;
    case 'start-recording':
      showToast('Recording Started', 'Writing to disk…', 'info');
      break;
    case 'toggle-tracking': {
      const toggle = document.getElementById('toggle-ids');
      if (toggle) { toggle.checked = !toggle.checked; toggle.dispatchEvent(new Event('change')); }
      showToast('Tracking Toggled', '', 'info');
      break;
    }
  }
}

// ─── Global Search ────────────────────────────────────────────────────────────

import {
  MOCK_CAMERAS, MOCK_SESSIONS, MOCK_MODELS,
  MOCK_RECORDINGS, MOCK_SNAPSHOTS, MOCK_EVENTS
} from './mock-data.js';

export function initSearch(router) {
  const overlay = document.getElementById('search-overlay');
  const trigger = document.getElementById('search-trigger');
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  trigger?.addEventListener('click', () => {
    overlay.classList.add('open');
    input.value = '';
    results.innerHTML = '';
    setTimeout(() => input.focus(), 20);
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      overlay.classList.add('open');
      input?.focus();
    }
    if (e.key === 'Escape') overlay.classList.remove('open');
  });

  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  input?.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { results.innerHTML = ''; return; }
    renderSearchResults(q, results, router, overlay);
  });
}

function renderSearchResults(q, container, router, overlay) {
  const cams    = MOCK_CAMERAS.filter(c => c.name.toLowerCase().includes(q));
  const sessions= MOCK_SESSIONS.filter(s => s.id.toLowerCase().includes(q) || s.camera.toLowerCase().includes(q));
  const models  = MOCK_MODELS.filter(m => m.name.toLowerCase().includes(q));
  const recs    = MOCK_RECORDINGS.filter(r => r.name.toLowerCase().includes(q));
  const events  = MOCK_EVENTS.filter(e => e.title.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q));

  const cameraIcon  = `<path d="M1.5 5.5a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-6z"/><path d="M12.5 6.5l2.5-1.5v6l-2.5-1.5"/>`;
  const sessionIcon = `<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5" stroke-linecap="round"/>`;
  const modelIcon   = `<path d="M8 1l6 3.5v4L8 12l-6-3.5v-4L8 1z"/>`;
  const recordIcon  = `<rect x="2" y="2" width="12" height="12" rx="1.5"/>`;
  const eventIcon   = `<path d="M8 2L10 6h4l-3 3 1 4-4-2.5L4 13l1-4L2 6h4z" stroke-linejoin="round"/>`;

  let html = '';

  if (cams.length) {
    html += `<div class="search-category">Cameras</div>`;
    html += cams.slice(0,3).map(c => `
      <div class="search-result-item" data-route="cameras">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${cameraIcon}</svg>
        <span class="search-result-label">${c.name}</span>
        <span class="search-result-meta">${c.status}</span>
      </div>
    `).join('');
  }
  if (sessions.length) {
    html += `<div class="search-category">Sessions</div>`;
    html += sessions.slice(0,3).map(s => `
      <div class="search-result-item" data-route="sessions">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${sessionIcon}</svg>
        <span class="search-result-label">${s.id}</span>
        <span class="search-result-meta">${s.camera}</span>
      </div>
    `).join('');
  }
  if (models.length) {
    html += `<div class="search-category">Models</div>`;
    html += models.slice(0,3).map(m => `
      <div class="search-result-item" data-route="models">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${modelIcon}</svg>
        <span class="search-result-label">${m.name}</span>
        <span class="search-result-meta">${m.fps} FPS</span>
      </div>
    `).join('');
  }
  if (events.length) {
    html += `<div class="search-category">Events</div>`;
    html += events.slice(0,3).map(e => `
      <div class="search-result-item" data-route="events">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${eventIcon}</svg>
        <span class="search-result-label">${e.title}</span>
        <span class="search-result-meta">${e.time}</span>
      </div>
    `).join('');
  }

  if (!html) {
    html = `<div class="empty-state" style="padding:20px"><div class="empty-desc">No results for "${q}"</div></div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.search-result-item[data-route]').forEach(el => {
    el.addEventListener('click', () => {
      overlay.classList.remove('open');
      router?.navigate(el.dataset.route);
    });
  });
}

// ─── Theme utilities ──────────────────────────────────────────────────────────

export function initTheme() {
  const saved = localStorage.getItem('vt-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  updateThemeIcon(saved);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('vt-theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  const dark  = document.getElementById('theme-icon-dark');
  const light = document.getElementById('theme-icon-light');
  if (dark)  dark.style.display  = theme === 'dark'  ? 'block' : 'none';
  if (light) light.style.display = theme === 'light' ? 'block' : 'none';
}
