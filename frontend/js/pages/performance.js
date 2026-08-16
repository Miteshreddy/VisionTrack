/**
 * VisionTrack — Performance Monitor Page
 */
import { getMockPerfSample, generateTimeSeries, generateMinuteLabels } from '../mock-data.js';

const HISTORY_LEN = 60;
let _perfHistory = {
  cpu:   Array.from({length: HISTORY_LEN}, () => 35 + Math.random() * 25),
  gpu:   Array.from({length: HISTORY_LEN}, () => 55 + Math.random() * 20),
  vram:  Array.from({length: HISTORY_LEN}, () => 65 + Math.random() * 15),
  fps:   Array.from({length: HISTORY_LEN}, () => 24 + Math.random() * 8),
};

let _charts = {};
let _interval = null;

export function render(container) {
  const labels = generateMinuteLabels(HISTORY_LEN);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Performance Monitor</h1>
        <p class="page-subtitle">Real-time system resource and pipeline metrics</p>
      </div>
      <div class="page-actions">
        <span style="font-size:11.5px;color:var(--text-muted)">Sampling every 1s</span>
        <button class="btn btn-secondary" id="perf-reset">Reset</button>
      </div>
    </div>

    <div class="perf-layout">

      <!-- Gauge Row -->
      <div class="full-width">
        <div class="metrics-row">
          <div class="metric-cell">
            <div class="metric-cell-label">CPU Usage</div>
            <div class="metric-cell-value accent" id="p-cpu">—</div>
            <div class="metric-cell-sub">12-core</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">GPU Usage</div>
            <div class="metric-cell-value green" id="p-gpu">—</div>
            <div class="metric-cell-sub">RTX 4090</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">VRAM</div>
            <div class="metric-cell-value" id="p-vram">—</div>
            <div class="metric-cell-sub">24 GB total</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Processing FPS</div>
            <div class="metric-cell-value" id="p-fps">—</div>
            <div class="metric-cell-sub">current stream</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Inference</div>
            <div class="metric-cell-value" id="p-inf">—</div>
            <div class="metric-cell-sub">avg ms</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Decode</div>
            <div class="metric-cell-value" id="p-dec">—</div>
            <div class="metric-cell-sub">avg ms</div>
          </div>
        </div>
      </div>

      <!-- CPU/GPU Timeline (full width) -->
      <div class="chart-card full-width">
        <div class="chart-card-header">
          <div class="chart-card-title">CPU & GPU Usage Over Time</div>
          <div class="chart-legend">
            <span class="chart-legend-item cpu">CPU</span>
            <span class="chart-legend-item gpu">GPU</span>
          </div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="perf-chart-cpugpu"></canvas>
        </div>
      </div>

      <!-- FPS Timeline -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Processing FPS</div>
        </div>
        <div class="chart-container" style="height:150px">
          <canvas id="perf-chart-fps"></canvas>
        </div>
      </div>

      <!-- Pipeline Breakdown -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Pipeline Breakdown</div>
        </div>
        <div style="padding:12px 0" id="pipeline-breakdown">
          <!-- Filled by JS -->
        </div>
      </div>

      <!-- VRAM donut -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Memory Usage</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="chart-container" style="height:140px;width:140px;flex-shrink:0">
            <canvas id="perf-chart-vram"></canvas>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary)" id="vram-pct-label">68%</div>
            <div style="font-size:11.5px;color:var(--text-muted)">of 24 GB used</div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
              ${[['Model weights','3.2 GB','#3b82f6'],['Frame buffer','2.8 GB','#22c55e'],['Reserved','0.4 GB','#f59e0b']].map(([label,val,color])=>`
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>
                  <span style="font-size:11.5px;color:var(--text-secondary)">${label}</span>
                  <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-left:auto">${val}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    initCharts(labels);
    startSampling();
  }, 50);

  document.getElementById('perf-reset')?.addEventListener('click', () => {
    _perfHistory = {
      cpu:  Array(HISTORY_LEN).fill(0),
      gpu:  Array(HISTORY_LEN).fill(0),
      vram: Array(HISTORY_LEN).fill(0),
      fps:  Array(HISTORY_LEN).fill(0),
    };
    updateChartData();
  });

  return cleanup;
}

function initCharts(labels) {
  const opts = (min=0, max=100) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#64748b', font:{ size:9 }, maxTicksLimit:8 } },
      y: { grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#64748b', font:{ size:10 } }, min, max },
    },
    elements: { point:{ radius:0 }, line:{ tension:0.4, borderWidth:1.5 } },
    animation: { duration:0 },
  });

  const ctx1 = document.getElementById('perf-chart-cpugpu');
  if (ctx1) _charts.cpugpu = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'CPU', data:[..._perfHistory.cpu], borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.06)', fill:true },
        { label:'GPU', data:[..._perfHistory.gpu], borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.06)', fill:true },
      ],
    },
    options: opts(0, 100),
  });

  const ctx2 = document.getElementById('perf-chart-fps');
  if (ctx2) _charts.fps = new Chart(ctx2, {
    type: 'line',
    data: {
      labels,
      datasets: [{ data:[..._perfHistory.fps], borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.07)', fill:true }],
    },
    options: opts(0, 35),
  });

  const ctx3 = document.getElementById('perf-chart-vram');
  if (ctx3) _charts.vram = new Chart(ctx3, {
    type: 'doughnut',
    data: {
      labels: ['Used','Free'],
      datasets: [{ data:[68,32], backgroundColor:['#3b82f6','rgba(59,130,246,0.1)'], borderWidth:0 }],
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'75%',
      plugins:{ legend:{ display:false } },
      animation:{ duration:0 },
    },
  });
}

function startSampling() {
  function tick() {
    const s = getMockPerfSample();

    _perfHistory.cpu.push(s.cpu);   _perfHistory.cpu.shift();
    _perfHistory.gpu.push(s.gpu);   _perfHistory.gpu.shift();
    _perfHistory.vram.push(s.vram); _perfHistory.vram.shift();
    _perfHistory.fps.push(s.fps);   _perfHistory.fps.shift();

    // Update gauges
    setEl('p-cpu',  s.cpu.toFixed(1) + '%');
    setEl('p-gpu',  s.gpu.toFixed(1) + '%');
    setEl('p-vram', s.vram.toFixed(1) + '%');
    setEl('p-fps',  s.fps.toFixed(1));
    setEl('p-inf',  s.inference.toFixed(1) + 'ms');
    setEl('p-dec',  s.decode.toFixed(1) + 'ms');

    // Update charts
    updateChartData();

    // Pipeline breakdown
    const breakdown = document.getElementById('pipeline-breakdown');
    if (breakdown) {
      const stages = [
        { name:'Decode',    val: s.decode,    color:'#06b6d4' },
        { name:'Preprocess',val: 1.2,         color:'#f59e0b' },
        { name:'Inference', val: s.inference, color:'#3b82f6' },
        { name:'Tracking',  val: s.tracking,  color:'#a855f7' },
        { name:'Render',    val: s.render,    color:'#22c55e' },
      ];
      const total = stages.reduce((s,x)=>s+x.val,0);
      breakdown.innerHTML = stages.map(stage => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <span style="font-size:11.5px;color:var(--text-secondary);min-width:72px">${stage.name}</span>
          <div style="flex:1;height:5px;background:var(--bg-raised);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.round(stage.val/total*100)}%;background:${stage.color};border-radius:3px;transition:width .3s"></div>
          </div>
          <span style="font-size:10.5px;color:var(--text-muted);font-family:var(--font-mono);min-width:38px;text-align:right">${stage.val.toFixed(1)}ms</span>
        </div>
      `).join('');
    }
  }

  _interval = setInterval(tick, 1000);
  tick();
}

function updateChartData() {
  if (_charts.cpugpu) {
    _charts.cpugpu.data.datasets[0].data = [..._perfHistory.cpu];
    _charts.cpugpu.data.datasets[1].data = [..._perfHistory.gpu];
    _charts.cpugpu.update('none');
  }
  if (_charts.fps) {
    _charts.fps.data.datasets[0].data = [..._perfHistory.fps];
    _charts.fps.update('none');
  }
  const vramPct = _perfHistory.vram[_perfHistory.vram.length - 1];
  if (_charts.vram) {
    _charts.vram.data.datasets[0].data = [vramPct, 100 - vramPct];
    _charts.vram.update('none');
  }
  setEl('vram-pct-label', vramPct?.toFixed(0) + '%');
}

function cleanup() {
  if (_interval) clearInterval(_interval);
  _interval = null;
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch(e){} });
  _charts = {};
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
