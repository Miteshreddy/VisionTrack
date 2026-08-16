/**
 * VisionTrack — Analytics Overview Page
 */
import { generateTimeSeries, generateHourLabels, generateMinuteLabels, MOCK_CLASS_COUNTS } from '../mock-data.js';

const CHART_OPT = (color = '#3b82f6') => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 8 } },
    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 10 } }, beginAtZero: true },
  },
  elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.4 } },
  animation: { duration: 300 },
});

export function render(container) {
  const hours = generateHourLabels(24);
  const mins  = generateMinuteLabels(30);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Analytics Overview</h1>
        <p class="page-subtitle">Real-time and historical performance data</p>
      </div>
      <div class="page-actions">
        <select class="form-select" style="width:140px" id="time-range">
          <option value="1h">Last hour</option>
          <option value="6h">Last 6 hours</option>
          <option value="24h" selected>Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>
    </div>

    <div class="analytics-layout">

      <!-- Detections over time -->
      <div class="chart-card full-width">
        <div class="chart-card-header">
          <div class="chart-card-title">Detections Over Time</div>
          <div class="badge badge-live">Live</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="ao-chart-detect"></canvas>
        </div>
      </div>

      <!-- FPS over time -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Processing FPS</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="ao-chart-fps"></canvas>
        </div>
      </div>

      <!-- Latency over time -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Inference Latency (ms)</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="ao-chart-latency"></canvas>
        </div>
      </div>

      <!-- Class distribution donut -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Class Distribution</div>
        </div>
        <div style="display:flex;gap:16px;align-items:center">
          <div class="chart-container" style="height:160px;width:160px;flex-shrink:0">
            <canvas id="ao-chart-donut"></canvas>
          </div>
          <div style="flex:1">
            ${Object.entries(MOCK_CLASS_COUNTS).slice(0,6).map(([cls,count],i) => {
              const colors = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4'];
              const total = Object.values(MOCK_CLASS_COUNTS).reduce((a,b)=>a+b,0);
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:3px 0">
                  <div style="width:8px;height:8px;border-radius:50%;background:${colors[i]};flex-shrink:0"></div>
                  <span style="font-size:12px;color:var(--text-secondary);flex:1">${cls}</span>
                  <span style="font-size:11.5px;color:var(--text-muted);font-family:var(--font-mono)">${Math.round(count/total*100)}%</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Tracking stability -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Active Tracks Over Time</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="ao-chart-tracks"></canvas>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    initChart('ao-chart-detect', hours, generateTimeSeries(24,5000,3000,true), '#3b82f6', true);
    initChart('ao-chart-fps',    hours, generateTimeSeries(24,27,8,true),       '#22c55e', false);
    initChart('ao-chart-latency',hours, generateTimeSeries(24,13,5,true),       '#f59e0b', false);
    initChart('ao-chart-tracks', hours, generateTimeSeries(24,40,20,true),      '#a855f7', false);
    initDonut();
  }, 50);
}

function initChart(id, labels, data, color, fill=false) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: fill ? color.replace(')',',0.08)').replace('rgb','rgba') : 'transparent',
        borderWidth: 1.5,
        fill,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: CHART_OPT(color),
  });
}

function initDonut() {
  const ctx = document.getElementById('ao-chart-donut');
  if (!ctx) return;
  const entries = Object.entries(MOCK_CLASS_COUNTS).slice(0,6);
  const colors = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4'];
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k])=>k),
      datasets: [{ data: entries.map(([,v])=>v), backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      animation: { duration: 600 },
    },
  });
}
