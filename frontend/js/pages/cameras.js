/**
 * VisionTrack — Cameras Page
 */
import { MOCK_CAMERAS } from '../mock-data.js';
import { showToast, confirmModal, showContextMenu } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Cameras</h1>
        <p class="page-subtitle">${MOCK_CAMERAS.length} cameras configured · ${MOCK_CAMERAS.filter(c=>c.status==='live').length} live</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btn-test-all">Test All</button>
        <button class="btn btn-primary" id="btn-add-camera">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10" stroke-linecap="round"/></svg>
          Add Camera
        </button>
      </div>
    </div>

    <div class="camera-grid fade-in">
      ${MOCK_CAMERAS.map(cam => renderCameraCard(cam)).join('')}
    </div>
  `;

  // Add Camera modal
  document.getElementById('btn-add-camera')?.addEventListener('click', () => {
    import('../components.js').then(({ openModal }) => {
      openModal({
        title: 'Add Camera',
        size: '',
        body: `
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="form-group">
              <label class="form-label">Camera Name</label>
              <input class="form-input" placeholder="e.g. Main Entrance" />
            </div>
            <div class="form-group">
              <label class="form-label">Source Type</label>
              <select class="form-select">
                <option>RTSP Stream</option>
                <option>Webcam</option>
                <option>Network Camera</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">URL / Device ID</label>
              <input class="form-input" placeholder="rtsp://192.168.1.x:554/stream" />
            </div>
            <div class="form-group">
              <label class="form-label">Resolution</label>
              <select class="form-select">
                <option>1920×1080</option>
                <option>1280×720</option>
                <option>640×480</option>
              </select>
            </div>
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancel</button>
          <button class="btn btn-secondary" id="btn-test-conn">Test Connection</button>
          <button class="btn btn-primary" id="btn-save-camera">Add Camera</button>
        `,
      });
      document.getElementById('btn-test-conn')?.addEventListener('click', () => {
        showToast('Testing…', 'Connecting to camera', 'info');
        setTimeout(() => showToast('Connection Failed', 'Camera not reachable at this address', 'error'), 1500);
      });
      document.getElementById('btn-save-camera')?.addEventListener('click', () => {
        document.getElementById('modal-overlay')?.classList.remove('open');
        showToast('Camera Added', 'New camera configured successfully', 'success');
      });
    });
  });

  // Test All
  document.getElementById('btn-test-all')?.addEventListener('click', () => {
    showToast('Testing Connections', 'Pinging all cameras…', 'info');
  });

  // Camera card interactions
  document.querySelectorAll('.camera-card').forEach(card => {
    const camId = card.dataset.camId;
    const cam = MOCK_CAMERAS.find(c => c.id === camId);

    card.addEventListener('contextmenu', e => {
      showContextMenu(e, [
        { label: 'Start Stream', action: 'start', handler: () => showToast('Stream Started', cam.name, 'success'),
          icon: '<path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/>' },
        { label: 'Edit Camera', action: 'edit', handler: () => showToast('Edit Camera', cam.name, 'info'),
          icon: '<path d="M11 2.5l2.5 2.5-7.5 7.5H3.5V10L11 2.5z"/>' },
        { label: 'Test Connection', action: 'test', handler: () => showToast('Testing…', cam.name, 'info'),
          icon: '<path d="M2 8h3M11 8h3M8 2v3M8 11v3" stroke-linecap="round"/>' },
        'sep',
        { label: 'Delete Camera', action: 'delete', danger: true, handler: () => {
          confirmModal({
            title: 'Delete Camera',
            message: `Are you sure you want to delete <strong>${cam.name}</strong>? This cannot be undone.`,
            confirmText: 'Delete',
            danger: true,
            onConfirm: () => showToast('Camera Deleted', cam.name, 'info'),
          });
        }, icon: '<path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/>' },
      ]);
    });

    card.querySelector('.btn-start-stream')?.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Stream Starting', cam.name, 'info');
    });
  });
}

function renderCameraCard(cam) {
  const statusClass = { live:'live', idle:'idle', offline:'offline', warning:'warning', error:'offline' }[cam.status] || 'idle';
  return `
    <div class="camera-card" data-cam-id="${cam.id}">
      <div class="camera-thumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8">
          <path d="M15 10l4.553-2.277A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="camera-thumb-overlay"></div>
        <div class="camera-thumb-status">
          <span class="status-pill ${statusClass}">${cam.status}</span>
        </div>
        ${cam.fps > 0 ? `<div class="camera-thumb-fps">${cam.fps.toFixed(1)} FPS</div>` : ''}
      </div>
      <div class="camera-info">
        <div class="camera-name">${cam.name}</div>
        <div class="camera-meta">
          <span>${cam.source}</span>
          <span>·</span>
          <span>${cam.res}</span>
          ${cam.lastSeen ? `<span>·</span><span>${cam.lastSeen}</span>` : ''}
        </div>
      </div>
      <div class="camera-actions">
        <button class="btn btn-secondary btn-sm btn-start-stream">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5l7 4.5-7 4.5V3.5z"/></svg>
          ${cam.status === 'live' ? 'View' : 'Start'}
        </button>
        <button class="btn btn-ghost btn-sm">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5" stroke-linecap="round"/></svg>
          ${cam.session || 'No session'}
        </button>
      </div>
    </div>
  `;
}
