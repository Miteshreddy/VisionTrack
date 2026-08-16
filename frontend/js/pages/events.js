/**
 * VisionTrack — Events Page
 */
import { MOCK_EVENTS } from '../mock-data.js';

const ICON_MAP = {
  detection: `<path d="M8 3a5 5 0 100 10A5 5 0 008 3z"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>`,
  tracking:  `<circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="4" r="1.5"/><path d="M5.5 10.5C6 9 8 8 9 7s2.5-2 2-3.5" stroke-linecap="round"/>`,
  warning:   `<path d="M8 2L14 14H2L8 2z" stroke-linejoin="round"/><path d="M8 7v3M8 12v.5" stroke-linecap="round"/>`,
  error:     `<circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4" stroke-linecap="round"/>`,
  camera:    `<path d="M1.5 5.5a1 1 0 011-1h9a1 1 0 011 1v6a1 1 0 01-1 1h-9a1 1 0 01-1-1v-6z"/><path d="M12.5 6.5l2.5-1.5v6l-2.5-1.5"/>`,
  info:      `<circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5" stroke-linecap="round"/>`,
};

const SEV_BADGE = {
  success: 'badge-live',
  warning: 'badge-warning',
  error:   'badge-error',
  info:    'badge-info',
};

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Event Feed</h1>
        <p class="page-subtitle">Real-time system and detection events</p>
      </div>
      <div class="page-actions">
        <div class="search-input-inline">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>
          <input type="text" id="ev-search" placeholder="Search events…"/>
        </div>
        <select class="form-select" style="width:130px" id="ev-type-filter">
          <option value="">All Types</option>
          <option value="detection">Detection</option>
          <option value="tracking">Tracking</option>
          <option value="camera">Camera</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select class="form-select" style="width:120px" id="ev-sev-filter">
          <option value="">All Severity</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
      </div>
    </div>

    <div id="event-feed" class="event-feed" style="padding-top:16px">
      ${renderEvents(MOCK_EVENTS)}
    </div>
  `;

  let typeFilter = '';
  let sevFilter  = '';
  let query      = '';

  function applyFilter() {
    const filtered = MOCK_EVENTS.filter(e => {
      const matchQ = !query || e.title.toLowerCase().includes(query) || e.desc.toLowerCase().includes(query);
      const matchT = !typeFilter || e.type === typeFilter;
      const matchS = !sevFilter || e.severity === sevFilter;
      return matchQ && matchT && matchS;
    });
    document.getElementById('event-feed').innerHTML = renderEvents(filtered);
  }

  document.getElementById('ev-search')?.addEventListener('input', e => { query = e.target.value.toLowerCase(); applyFilter(); });
  document.getElementById('ev-type-filter')?.addEventListener('change', e => { typeFilter = e.target.value; applyFilter(); });
  document.getElementById('ev-sev-filter')?.addEventListener('change', e => { sevFilter = e.target.value; applyFilter(); });
}

function renderEvents(events) {
  if (!events.length) return `
    <div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2L10 6h4l-3 3 1 4-4-2.5L4 13l1-4L2 6h4z" stroke-linejoin="round"/></svg></div>
      <div class="empty-title">No Events Found</div>
      <div class="empty-desc">Try adjusting your filters</div>
    </div>
  `;
  return events.map(e => `
    <div class="event-item fade-in" data-ev-id="${e.id}">
      <div class="event-icon ${e.type}">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">${ICON_MAP[e.type] || ICON_MAP.info}</svg>
      </div>
      <div class="event-body">
        <div class="event-title">${e.title}</div>
        <div class="event-desc">${e.desc}${e.camera ? ` · <span style="color:var(--accent)">${e.camera}</span>` : ''}</div>
      </div>
      <div class="event-severity"><span class="badge ${SEV_BADGE[e.severity] || 'badge-info'}">${e.severity}</span></div>
      <div class="event-time">${e.time}</div>
    </div>
  `).join('');
}
