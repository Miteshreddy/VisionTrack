/**
 * VisionTrack — Recordings Page
 */
import { MOCK_RECORDINGS } from '../mock-data.js';
import { showToast, confirmModal } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Recordings</h1>
        <p class="page-subtitle">${MOCK_RECORDINGS.length} recordings · ${MOCK_RECORDINGS.reduce((s,r)=>s+parseSize(r.size),0).toFixed(1)} GB total</p>
      </div>
      <div class="page-actions">
        <div class="search-input-inline">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>
          <input type="text" id="rec-search" placeholder="Search recordings…"/>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-icon" id="rec-view-grid" title="Grid view">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/><rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon" id="rec-view-list" title="List view">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M2 8h12M2 12h12" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="recording-grid fade-in" id="recording-grid">
      ${MOCK_RECORDINGS.map(r => renderRecordingCard(r)).join('')}
    </div>
  `;

  document.getElementById('rec-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = MOCK_RECORDINGS.filter(r => r.name.toLowerCase().includes(q) || r.camera.toLowerCase().includes(q));
    document.getElementById('recording-grid').innerHTML = filtered.length
      ? filtered.map(r => renderRecordingCard(r)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;min-height:300px">
           <div class="empty-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/></svg></div>
           <div class="empty-title">No Recordings Found</div>
           <div class="empty-desc">Try a different search term</div>
         </div>`;
    wireActions();
  });

  wireActions();
}

function wireActions() {
  document.querySelectorAll('.rec-play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = btn.closest('[data-rec-name]')?.dataset.recName;
      showToast('Playing', name || 'Recording', 'info');
    });
  });
  document.querySelectorAll('.rec-download-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Download Started', 'Preparing file…', 'info');
    });
  });
  document.querySelectorAll('.rec-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name = btn.closest('[data-rec-name]')?.dataset.recName;
      confirmModal({
        title: 'Delete Recording',
        message: `Delete <strong>${name}</strong>? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
        onConfirm: () => showToast('Deleted', name, 'info'),
      });
    });
  });
}

function renderRecordingCard(r) {
  return `
    <div class="recording-card" data-rec-name="${r.name}">
      <div class="recording-thumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8">
          <rect x="2" y="2" width="20" height="20" rx="2"/>
          <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none"/>
        </svg>
        <div class="recording-duration">${r.duration}</div>
      </div>
      <div class="recording-info">
        <div class="recording-name truncate">${r.name}</div>
        <div class="recording-meta">${r.date} · ${r.camera}</div>
        <div class="recording-meta">${r.events} events · ${r.size}</div>
      </div>
      <div class="camera-actions">
        <button class="btn btn-primary btn-sm rec-play-btn">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg>
          Play
        </button>
        <button class="btn btn-secondary btn-sm rec-download-btn">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm btn-icon rec-delete-btn" style="color:var(--red)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `;
}

function parseSize(s) {
  const m = s.match(/([\d.]+)\s*(MB|GB)/i);
  if (!m) return 0;
  return parseFloat(m[1]) * (m[2].toUpperCase() === 'GB' ? 1 : 0.001);
}
