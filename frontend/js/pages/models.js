/**
 * VisionTrack — Model Library Page
 */
import { MOCK_MODELS } from '../mock-data.js';
import { showToast, confirmModal } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Model Library</h1>
        <p class="page-subtitle">${MOCK_MODELS.length} models available · 1 active</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btn-benchmark-all">Run Benchmark</button>
        <button class="btn btn-primary" id="btn-upload-model">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 4l3-3 3 3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Upload Model
        </button>
      </div>
    </div>

    <div class="model-cards fade-in">
      ${MOCK_MODELS.map(m => renderModelCard(m)).join('')}
    </div>
  `;

  document.getElementById('btn-upload-model')?.addEventListener('click', () => {
    import('../components.js').then(({ openModal }) => {
      openModal({
        title: 'Upload Model',
        body: `
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="upload-area" style="padding:24px;text-align:center;cursor:pointer">
              <svg style="width:32px;height:32px;margin:0 auto 10px;color:var(--text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div style="font-size:12.5px;color:var(--text-muted)">Drop .pt file or click to browse</div>
              <div style="font-size:11px;color:var(--text-faint);margin-top:4px">Supports YOLOv8, YOLOv11 PyTorch models</div>
            </div>
            <div class="form-group">
              <label class="form-label">Model Name</label>
              <input class="form-input" placeholder="e.g. Custom_YOLOv8n_v1"/>
            </div>
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancel</button>
          <button class="btn btn-primary" onclick="document.getElementById('modal-overlay').classList.remove('open');window.vt_toast?.('Model Uploaded','Ready for inference','success')">Upload</button>
        `,
      });
    });
  });

  document.getElementById('btn-benchmark-all')?.addEventListener('click', () => {
    showToast('Benchmark Started', 'Running on all models…', 'info');
  });

  document.querySelectorAll('.model-card').forEach(card => {
    const id = card.dataset.modelId;
    const model = MOCK_MODELS.find(m => m.id === id);
    if (!model) return;

    card.querySelector('.btn-select-model')?.addEventListener('click', e => {
      e.stopPropagation();
      // Update live model select
      const sel = document.getElementById('model-select');
      if (sel) {
        const opt = [...sel.options].find(o => o.value.startsWith(id));
        if (opt) sel.value = opt.value;
      }
      showToast('Model Selected', `${model.name} will be used on next session start`, 'success');
    });

    card.querySelector('.btn-benchmark-model')?.addEventListener('click', e => {
      e.stopPropagation();
      showToast('Benchmarking', `Running ${model.name}…`, 'info');
      setTimeout(() => showToast('Benchmark Complete', `${model.name}: ${model.fps} FPS · ${model.latency}ms`, 'success'), 2500);
    });

    card.querySelector('.btn-delete-model')?.addEventListener('click', e => {
      e.stopPropagation();
      if (model.active) { showToast('Cannot Delete', 'Cannot delete the active model', 'error'); return; }
      confirmModal({
        title: 'Delete Model',
        message: `Delete <strong>${model.name}</strong>? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
        onConfirm: () => showToast('Deleted', model.name, 'info'),
      });
    });
  });
}

function renderModelCard(m) {
  return `
    <div class="model-card${m.active ? ' active-model' : ''}" data-model-id="${m.id}">
      <div class="model-card-header">
        <div>
          <div class="model-name">${m.name}</div>
          <div class="model-version">v${m.version}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${m.active ? '<span class="badge badge-live">Active</span>' : ''}
          <span class="badge badge-info" style="font-family:var(--font-mono)">${m.framework}</span>
        </div>
      </div>

      <div class="model-stats">
        <div class="model-stat">
          <div class="model-stat-label">FPS</div>
          <div class="model-stat-value">${m.fps}</div>
        </div>
        <div class="model-stat">
          <div class="model-stat-label">Latency</div>
          <div class="model-stat-value">${m.latency}ms</div>
        </div>
        <div class="model-stat">
          <div class="model-stat-label">mAP@50</div>
          <div class="model-stat-value">${m.acc}%</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:var(--text-muted);margin-bottom:12px">
        <span>${m.classes} classes (COCO)</span>
        <span style="font-family:var(--font-mono)">${m.size}</span>
      </div>

      <div class="model-actions">
        <button class="btn btn-primary btn-sm btn-select-model" style="flex:1">${m.active ? 'Active' : 'Select'}</button>
        <button class="btn btn-secondary btn-sm btn-benchmark-model">Benchmark</button>
        <button class="btn btn-ghost btn-sm btn-icon btn-delete-model" style="color:var(--red)" title="Delete">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h10M6 6V4h4v2M5 6l1 8h4l1-8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  `;
}
