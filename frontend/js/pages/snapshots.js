/**
 * VisionTrack — Snapshots Gallery Page
 */
import { MOCK_SNAPSHOTS } from '../mock-data.js';
import { showToast, confirmModal } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Snapshots</h1>
        <p class="page-subtitle">${MOCK_SNAPSHOTS.length} snapshots captured</p>
      </div>
      <div class="page-actions">
        <div class="search-input-inline">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>
          <input type="text" id="snap-search" placeholder="Search snapshots…"/>
        </div>
        <select class="form-select" style="width:130px" id="snap-camera-filter">
          <option value="">All Cameras</option>
          ${[...new Set(MOCK_SNAPSHOTS.map(s=>s.camera))].map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <button class="btn btn-secondary" id="snap-export-all">Export All</button>
      </div>
    </div>

    <div class="snapshot-grid fade-in" id="snapshot-grid">
      ${MOCK_SNAPSHOTS.map(s => renderSnapshotCard(s)).join('')}
    </div>
  `;

  let query = '';
  let cameraFilter = '';

  function applyFilter() {
    const filtered = MOCK_SNAPSHOTS.filter(s => {
      const matchQ = !query || s.camera.toLowerCase().includes(query) || s.objects.some(o=>o.includes(query));
      const matchC = !cameraFilter || s.camera === cameraFilter;
      return matchQ && matchC;
    });
    const grid = document.getElementById('snapshot-grid');
    if (!grid) return;
    grid.innerHTML = filtered.length
      ? filtered.map(s => renderSnapshotCard(s)).join('')
      : `<div class="empty-state" style="grid-column:1/-1;min-height:300px">
           <div class="empty-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="9" rx="1"/><circle cx="8" cy="8.5" r="2"/><path d="M6 4V3.5a1 1 0 011-1h2a1 1 0 011 1V4"/></svg></div>
           <div class="empty-title">No Snapshots Found</div>
           <div class="empty-desc">Try different filters</div>
         </div>`;
    wireSnapActions();
  }

  document.getElementById('snap-search')?.addEventListener('input', e => { query = e.target.value.toLowerCase(); applyFilter(); });
  document.getElementById('snap-camera-filter')?.addEventListener('change', e => { cameraFilter = e.target.value; applyFilter(); });
  document.getElementById('snap-export-all')?.addEventListener('click', () => showToast('Export Started', 'Preparing ZIP archive…', 'info'));

  wireSnapActions();
}

function wireSnapActions() {
  document.querySelectorAll('.snap-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmModal({
        title: 'Delete Snapshot',
        message: 'Delete this snapshot? This cannot be undone.',
        confirmText: 'Delete',
        danger: true,
        onConfirm: () => { btn.closest('.snapshot-card')?.remove(); showToast('Deleted', 'Snapshot removed', 'info'); },
      });
    });
  });
  document.querySelectorAll('.snap-download-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Download', 'Preparing image…', 'info');
    });
  });
}

function renderSnapshotCard(s) {
  return `
    <div class="snapshot-card" data-snap-id="${s.id}">
      <div class="snapshot-thumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" style="width:26px;height:26px;color:var(--text-faint)">
          <rect x="2" y="3" width="20" height="18" rx="2"/>
          <circle cx="8.5" cy="9.5" r="2.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <div style="position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0;transition:opacity .15s" class="snap-actions">
          <button class="btn btn-secondary btn-sm btn-icon snap-download-btn" title="Download">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn btn-danger btn-sm btn-icon snap-delete-btn" title="Delete">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="snapshot-info">
        <div class="snapshot-time">${s.date} ${s.time} · ${s.camera}</div>
        <div class="snapshot-tags">
          ${s.objects.map(o=>`<span class="snapshot-tag">${o}</span>`).join('')}
          ${s.tags.map(t=>`<span class="snapshot-tag" style="border-color:var(--accent);color:var(--accent)">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}
