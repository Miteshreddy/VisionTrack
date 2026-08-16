/**
 * VisionTrack — Export Center Page
 */
import { MOCK_EXPORTS } from '../mock-data.js';
import { showToast } from '../components.js';

const EXPORT_TYPES = [
  { id: 'csv',      name: 'Detection CSV',    desc: 'All detected objects with timestamps and confidence scores',
    icon: `<path d="M3 3h10l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M7 8h4M7 11h4M5 8h.01M5 11h.01" stroke-linecap="round"/>` },
  { id: 'json',     name: 'Track JSON',        desc: 'Full tracking data with trajectories and metadata',
    icon: `<path d="M4 4c0-1 .5-1.5 1.5-1.5S7 3 7 4v4c0 1-.5 1.5-1.5 1.5M12 4c0-1 .5-1.5 1.5-1.5S15 3 15 4v4c0 1-.5 1.5-1.5 1.5M6 12l1 4M10 12l-1 4"/>` },
  { id: 'events',   name: 'Event Log',         desc: 'All events: zone crossings, appearances, alerts',
    icon: `<path d="M8 2L10 6h4l-3 3 1 4-4-2.5L4 13l1-4L2 6h4z" stroke-linejoin="round"/>` },
  { id: 'snapshot', name: 'Snapshots ZIP',     desc: 'All captured snapshot images bundled as ZIP',
    icon: `<rect x="2" y="4" width="12" height="9" rx="1"/><circle cx="8" cy="8.5" r="2"/>` },
  { id: 'video',    name: 'Annotated Video',   desc: 'Session video with bounding boxes and track overlays rendered',
    icon: `<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" stroke="none"/>` },
  { id: 'report',   name: 'Analytics Report',  desc: 'PDF report with charts, statistics and session summary',
    icon: `<path d="M4 1h8l4 4v10H4V1z" stroke-linejoin="round"/><path d="M12 1v4h4M7 8h5M7 11h4" stroke-linecap="round"/>` },
];

export function render(container) {
  let selectedType = 'csv';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Export Center</h1>
        <p class="page-subtitle">Export session data in multiple formats</p>
      </div>
    </div>

    <!-- Export type selector -->
    <div class="export-grid">
      ${EXPORT_TYPES.map(t => `
        <div class="export-type-card${t.id === selectedType ? ' selected' : ''}" data-type="${t.id}">
          <div class="export-type-icon">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${t.icon}</svg>
          </div>
          <div class="export-type-info">
            <div class="export-type-name">${t.name}</div>
            <div class="export-type-desc">${t.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Export options -->
    <div style="padding:0 24px 16px">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Export Options</div>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div class="form-group">
              <label class="form-label">Session</label>
              <select class="form-select" id="exp-session">
                <option>SES-0043 (current)</option>
                <option>SES-0042</option>
                <option>SES-0041</option>
                <option>All Sessions</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Time Range</label>
              <select class="form-select" id="exp-range">
                <option>Full Session</option>
                <option>Last 1 hour</option>
                <option>Last 24 hours</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Class Filter</label>
              <select class="form-select">
                <option>All Classes</option>
                <option>Person only</option>
                <option>Vehicles only</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Confidence Threshold</label>
              <input type="range" id="exp-conf" min="0" max="1" step="0.05" value="0.35"/>
            </div>
          </div>
          <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
            <button class="btn btn-secondary">Preview</button>
            <button class="btn btn-primary" id="btn-start-export">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Export history -->
    <div class="export-history">
      <div class="export-history-title">Export History</div>
      <div class="card">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Created</th>
                <th>Size</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${MOCK_EXPORTS.map(e => `
                <tr>
                  <td class="td-primary td-mono" style="font-size:11.5px">${e.name}</td>
                  <td><span class="badge badge-info">${e.type}</span></td>
                  <td style="font-size:11.5px">${e.date}</td>
                  <td class="td-mono">${e.size}</td>
                  <td><span class="status-pill ${e.status === 'complete' ? 'active' : 'idle'}">${e.status}</span></td>
                  <td class="td-actions">
                    <button class="btn btn-secondary btn-sm exp-dl-btn">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      Download
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Type selection
  document.querySelectorAll('.export-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.export-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedType = card.dataset.type;
    });
  });

  // Export button
  document.getElementById('btn-start-export')?.addEventListener('click', () => {
    if (selectedType === 'csv') {
      window.location.href = '/api/session/export/csv';
    } else {
      showToast('Export Started', `Preparing ${EXPORT_TYPES.find(t=>t.id===selectedType)?.name}…`, 'info');
      setTimeout(() => showToast('Export Complete', 'File ready for download', 'success'), 2000);
    }
  });

  // Download buttons in history
  document.querySelectorAll('.exp-dl-btn').forEach(btn => {
    btn.addEventListener('click', () => showToast('Download', 'Preparing file…', 'info'));
  });
}
