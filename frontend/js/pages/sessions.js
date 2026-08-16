/**
 * VisionTrack — Sessions Page
 */
import { MOCK_SESSIONS } from '../mock-data.js';
import { showToast, confirmModal, showContextMenu } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Sessions</h1>
        <p class="page-subtitle">${MOCK_SESSIONS.length} sessions · ${MOCK_SESSIONS.filter(s=>s.status==='running').length} active</p>
      </div>
      <div class="page-actions">
        <div class="search-input-inline">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>
          <input type="text" id="session-search" placeholder="Search sessions…" />
        </div>
        <select class="form-select" id="session-filter" style="width:140px">
          <option value="all">All Status</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
        </select>
        <button class="btn btn-secondary" id="btn-export-all">Export All</button>
      </div>
    </div>

    <div style="padding:0 24px 24px">
      <div class="card" style="margin-top:16px">
        <div class="data-table-wrap">
          <table class="data-table" id="sessions-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Date / Time</th>
                <th>Duration</th>
                <th>Camera</th>
                <th>Model</th>
                <th>Avg FPS</th>
                <th>Detections</th>
                <th>Tracks</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="sessions-tbody">
              ${renderRows(MOCK_SESSIONS)}
            </tbody>
          </table>
        </div>
        <div class="card-footer flex-between">
          <span style="font-size:11.5px;color:var(--text-muted)">${MOCK_SESSIONS.length} sessions total</span>
          <div class="pagination">
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Search filter
  let query = '';
  let filterStatus = 'all';

  function applyFilter() {
    const tbody = document.getElementById('sessions-tbody');
    const filtered = MOCK_SESSIONS.filter(s => {
      const matchQ = !query || s.id.toLowerCase().includes(query) || s.camera.toLowerCase().includes(query);
      const matchS = filterStatus === 'all' || s.status === filterStatus;
      return matchQ && matchS;
    });
    tbody.innerHTML = renderRows(filtered);
    wireRows(filtered);
  }

  document.getElementById('session-search')?.addEventListener('input', e => { query = e.target.value.toLowerCase(); applyFilter(); });
  document.getElementById('session-filter')?.addEventListener('change', e => { filterStatus = e.target.value; applyFilter(); });
  document.getElementById('btn-export-all')?.addEventListener('click', () => {
    window.location.href = '/api/session/export/csv';
  });

  wireRows(MOCK_SESSIONS);
}

function renderRows(sessions) {
  if (!sessions.length) return `<tr><td colspan="10" style="text-align:center;padding:32px"><div style="color:var(--text-faint);font-size:12px">No sessions found</div></td></tr>`;
  return sessions.map(s => `
    <tr data-session-id="${s.id}" style="cursor:pointer">
      <td class="td-primary td-mono">${s.id}</td>
      <td style="font-size:11.5px">${s.date}</td>
      <td class="td-mono">${s.duration}</td>
      <td>${s.camera}</td>
      <td><span class="badge badge-info">${s.model}</span></td>
      <td class="td-mono">${s.avgFps.toFixed(1)}</td>
      <td class="td-mono">${s.detections.toLocaleString()}</td>
      <td class="td-mono">${s.tracks}</td>
      <td><span class="status-pill ${s.status === 'running' ? 'live' : 'inactive'}">${s.status}</span></td>
      <td class="td-actions">
        <button class="btn btn-ghost btn-sm btn-icon session-open-btn" title="Open session">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1v-3M9 2h5v5M14 2L8 8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm btn-icon session-export-btn" title="Export">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm btn-icon session-delete-btn" title="Delete" style="color:var(--red)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function wireRows(sessions) {
  document.querySelectorAll('tr[data-session-id]').forEach(row => {
    const id = row.dataset.sessionId;
    const s = sessions.find(x => x.id === id);
    if (!s) return;

    row.querySelector('.session-open-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Opening Session', `Loading ${s.id}…`, 'info');
    });
    row.querySelector('.session-export-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      window.location.href = '/api/session/export/csv';
    });
    row.querySelector('.session-delete-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      confirmModal({
        title: 'Delete Session',
        message: `Delete session <strong>${s.id}</strong>? This will permanently remove all associated data.`,
        confirmText: 'Delete',
        danger: true,
        onConfirm: () => showToast('Session Deleted', s.id, 'info'),
      });
    });

    row.addEventListener('contextmenu', e => {
      showContextMenu(e, [
        { label: 'Open Session',  action: 'open',   handler: () => showToast('Opening', s.id, 'info'), icon: '<path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1v-3M9 2h5v5M14 2L8 8" stroke-linecap="round" stroke-linejoin="round"/>' },
        { label: 'Export CSV',   action: 'export', handler: () => { window.location.href='/api/session/export/csv'; }, icon: '<path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/>' },
        'sep',
        { label: 'Delete', action: 'delete', danger: true, handler: () => confirmModal({ title:'Delete Session', message:`Delete ${s.id}?`, confirmText:'Delete', danger:true, onConfirm:()=>showToast('Deleted',s.id,'info') }), icon: '<path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/>' },
      ]);
    });
  });
}
