/**
 * VisionTrack — Heatmap Page
 * Canvas-based Gaussian blob heatmap visualization
 */

let _canvas = null;
let _animFrame = null;
let _blobs = [];

export function render(container) {
  container.innerHTML = `
    <div class="heatmap-layout" style="height:calc(100vh - 48px)">

      <!-- Sidebar Controls -->
      <div class="heatmap-sidebar">
        <div>
          <div class="form-group">
            <label class="form-label">Time Range</label>
            <select class="form-select" id="hm-time">
              <option>Last 1 hour</option>
              <option selected>Last 24 hours</option>
              <option>Last 7 days</option>
            </select>
          </div>
        </div>

        <div>
          <div class="form-group">
            <label class="form-label">Camera</label>
            <select class="form-select" id="hm-camera">
              <option>Main Entrance</option>
              <option>Parking Lot A</option>
              <option>Rooftop View</option>
              <option>All Cameras</option>
            </select>
          </div>
        </div>

        <div>
          <div class="form-group">
            <label class="form-label">Class Filter</label>
            <select class="form-select" id="hm-class">
              <option>All Classes</option>
              <option>Person</option>
              <option>Vehicle</option>
              <option>Bicycle</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            Intensity
            <span class="form-label-value" id="hm-intensity-val">0.7</span>
          </label>
          <input type="range" id="hm-intensity" min="0.1" max="1.0" step="0.05" value="0.7"/>
        </div>

        <div class="form-group">
          <label class="form-label">
            Radius
            <span class="form-label-value" id="hm-radius-val">40</span>
          </label>
          <input type="range" id="hm-radius" min="10" max="100" step="5" value="40"/>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">
          <button class="btn btn-secondary" id="hm-regenerate">Regenerate</button>
          <button class="btn btn-ghost" id="hm-reset">Reset View</button>
          <button class="btn btn-ghost" id="hm-fullscreen">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Fullscreen
          </button>
        </div>
      </div>

      <!-- Heatmap Canvas -->
      <div class="heatmap-main" id="heatmap-container">
        <canvas id="heatmap-canvas" aria-label="Activity heatmap visualization"></canvas>
        <div style="position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:8px 12px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;font-weight:500;text-transform:uppercase;letter-spacing:.07em">Activity Level</div>
          <div style="display:flex;align-items:center;gap:4px">
            <span style="font-size:10px;color:var(--text-faint)">Low</span>
            <div style="width:100px;height:8px;border-radius:4px;background:linear-gradient(90deg,#06b6d4,#22c55e,#f59e0b,#ef4444)"></div>
            <span style="font-size:10px;color:var(--text-faint)">High</span>
          </div>
        </div>
      </div>

    </div>
  `;

  // Init canvas
  const heatmapContainer = document.getElementById('heatmap-container');
  _canvas = document.getElementById('heatmap-canvas');

  function resizeCanvas() {
    if (!_canvas || !heatmapContainer) return;
    _canvas.width  = heatmapContainer.clientWidth;
    _canvas.height = heatmapContainer.clientHeight;
    generateBlobs();
    drawHeatmap();
  }

  // Controls
  document.getElementById('hm-intensity')?.addEventListener('input', e => {
    document.getElementById('hm-intensity-val').textContent = e.target.value;
    drawHeatmap();
  });
  document.getElementById('hm-radius')?.addEventListener('input', e => {
    document.getElementById('hm-radius-val').textContent = e.target.value;
    drawHeatmap();
  });
  document.getElementById('hm-regenerate')?.addEventListener('click', () => {
    generateBlobs();
    drawHeatmap();
  });
  document.getElementById('hm-reset')?.addEventListener('click', () => {
    generateBlobs();
    drawHeatmap();
  });
  document.getElementById('hm-fullscreen')?.addEventListener('click', () => {
    heatmapContainer?.requestFullscreen?.().catch(()=>{});
  });

  const resizeObs = new ResizeObserver(resizeCanvas);
  resizeObs.observe(heatmapContainer);
  resizeCanvas();

  return () => {
    resizeObs.disconnect();
    if (_animFrame) cancelAnimationFrame(_animFrame);
  };
}

function generateBlobs() {
  if (!_canvas) return;
  const W = _canvas.width;
  const H = _canvas.height;
  _blobs = [];

  // Generate clusters simulating pedestrian/vehicle activity
  const clusters = [
    { cx: W * 0.2,  cy: H * 0.5,  spread: 0.12, count: 40, weight: 0.9 },  // entrance
    { cx: W * 0.6,  cy: H * 0.3,  spread: 0.15, count: 30, weight: 0.7 },  // midzone
    { cx: W * 0.8,  cy: H * 0.7,  spread: 0.10, count: 25, weight: 0.8 },  // exit area
    { cx: W * 0.4,  cy: H * 0.6,  spread: 0.08, count: 15, weight: 0.5 },  // random
    { cx: W * 0.75, cy: H * 0.2,  spread: 0.09, count: 20, weight: 0.6 },  // corner
  ];

  clusters.forEach(cl => {
    for (let i = 0; i < cl.count; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const r     = Math.random() * cl.spread * Math.min(W, H);
      _blobs.push({
        x: cl.cx + Math.cos(angle) * r,
        y: cl.cy + Math.sin(angle) * r,
        weight: cl.weight * (0.5 + Math.random() * 0.5),
      });
    }
  });
}

function drawHeatmap() {
  if (!_canvas) return;
  const ctx = _canvas.getContext('2d');
  const W = _canvas.width;
  const H = _canvas.height;
  const radius    = parseInt(document.getElementById('hm-radius')?.value || '40');
  const intensity = parseFloat(document.getElementById('hm-intensity')?.value || '0.7');

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, W, H);

  // Draw blobs with radial gradients
  _blobs.forEach(blob => {
    const r = radius * blob.weight;
    const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, r);
    const alpha = intensity * blob.weight;
    grad.addColorStop(0,   `rgba(239,68,68,${alpha})`);
    grad.addColorStop(0.4, `rgba(245,158,11,${alpha * 0.6})`);
    grad.addColorStop(0.7, `rgba(34,197,94,${alpha * 0.3})`);
    grad.addColorStop(1,   'rgba(6,182,212,0)');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = 'source-over';
}
