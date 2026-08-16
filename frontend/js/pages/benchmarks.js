/**
 * VisionTrack — Benchmarks Page
 */
import { MOCK_BENCHMARKS } from '../mock-data.js';
import { showToast } from '../components.js';

export function render(container) {
  const maxFps = Math.max(...MOCK_BENCHMARKS.map(b => b.fps));

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Model Benchmarks</h1>
        <p class="page-subtitle">Performance comparison across models and hardware configurations</p>
      </div>
      <div class="page-actions">
        <select class="form-select" style="width:130px" id="bm-gpu">
          <option>RTX 4090</option>
          <option>RTX 3080</option>
          <option>CPU (i9)</option>
        </select>
        <select class="form-select" style="width:110px" id="bm-res">
          <option>640×640</option>
          <option>1280×1280</option>
          <option>320×320</option>
        </select>
        <button class="btn btn-primary" id="btn-run-benchmark">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3h8M5 8h8M5 13h5" stroke-linecap="round"/><path d="M2 3v.01M2 8v.01M2 13v.01" stroke-linecap="round" stroke-width="2"/></svg>
          Run Benchmark
        </button>
      </div>
    </div>

    <div style="padding:16px 24px 24px;display:grid;gap:16px">

      <!-- Benchmark table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Performance Results</div>
          <div style="font-size:11.5px;color:var(--text-muted)">RTX 4090 · 640×640 · Batch 1</div>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>FPS ↑</th>
                <th>Latency ↓</th>
                <th>Precision ↑</th>
                <th>Recall ↑</th>
                <th>mAP@50 ↑</th>
                <th>Throughput</th>
              </tr>
            </thead>
            <tbody>
              ${MOCK_BENCHMARKS.map((b, i) => `
                <tr>
                  <td class="td-primary">${b.model}</td>
                  <td>
                    <div class="benchmark-bar-wrap">
                      <div class="benchmark-bar"><div class="benchmark-bar-fill" style="width:${Math.round(b.fps/maxFps*100)}%"></div></div>
                      <span class="td-mono" style="min-width:36px">${b.fps}</span>
                    </div>
                  </td>
                  <td class="td-mono">${b.latency}ms</td>
                  <td>
                    <div class="benchmark-bar-wrap">
                      <div class="benchmark-bar"><div class="benchmark-bar-fill" style="width:${Math.round(b.precision)}%;background:var(--green)"></div></div>
                      <span class="td-mono" style="min-width:40px">${b.precision.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td class="td-mono">${b.recall.toFixed(1)}%</td>
                  <td class="td-mono">${b.map50}%</td>
                  <td class="td-mono">${(b.fps * 1).toFixed(0)} img/s</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- FPS comparison bar chart -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">FPS Comparison</div>
        </div>
        <div class="chart-container" style="height:200px">
          <canvas id="bm-chart-fps"></canvas>
        </div>
      </div>

      <!-- Precision vs Recall scatter -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Precision vs Recall</div>
        </div>
        <div class="chart-container" style="height:200px">
          <canvas id="bm-chart-prec"></canvas>
        </div>
      </div>

    </div>
  `;

  document.getElementById('btn-run-benchmark')?.addEventListener('click', () => {
    showToast('Benchmark Running', 'This may take a few minutes…', 'info');
    setTimeout(() => showToast('Benchmark Complete', 'Results updated', 'success'), 3000);
  });

  setTimeout(() => {
    const colors = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4'];

    // FPS bar chart
    const ctx1 = document.getElementById('bm-chart-fps');
    if (ctx1) new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: MOCK_BENCHMARKS.map(b=>b.model),
        datasets: [{
          label: 'FPS',
          data: MOCK_BENCHMARKS.map(b=>b.fps),
          backgroundColor: colors.map(c => c + '55'),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid:{ display:false }, ticks:{ color:'#64748b', font:{ size:11 } } },
          y: { grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#64748b', font:{ size:10 } }, beginAtZero:true },
        },
      },
    });

    // Precision scatter
    const ctx2 = document.getElementById('bm-chart-prec');
    if (ctx2) new Chart(ctx2, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Models',
          data: MOCK_BENCHMARKS.map((b,i) => ({ x: b.recall, y: b.precision, label: b.model })),
          backgroundColor: colors.map(c=>c+'aa'),
          borderColor: colors,
          borderWidth: 1.5,
          pointRadius: 8,
          pointHoverRadius: 10,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: P=${ctx.raw.y}% R=${ctx.raw.x}%` } },
        },
        scales: {
          x: { title:{ display:true, text:'Recall (%)', color:'#64748b', font:{ size:10 } }, grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#64748b', font:{ size:10 } } },
          y: { title:{ display:true, text:'Precision (%)', color:'#64748b', font:{ size:10 } }, grid:{ color:'rgba(255,255,255,0.03)' }, ticks:{ color:'#64748b', font:{ size:10 } } },
        },
      },
    });
  }, 50);
}
