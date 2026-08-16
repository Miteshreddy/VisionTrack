/**
 * VisionTrack — Tracking Analytics Page
 */
import { generateTimeSeries, generateHourLabels } from '../mock-data.js';

export function render(container) {
  const hours = generateHourLabels(24);

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Tracking Analytics</h1>
        <p class="page-subtitle">Multi-object tracking performance and statistics</p>
      </div>
    </div>

    <div class="analytics-layout" style="padding-top:16px">

      <!-- Stats row -->
      <div class="full-width">
        <div class="metrics-row">
          <div class="metric-cell">
            <div class="metric-cell-label">Active Tracks</div>
            <div class="metric-cell-value green" id="trk-active">47</div>
            <div class="metric-cell-sub">current session</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Total Tracks</div>
            <div class="metric-cell-value">2,841</div>
            <div class="metric-cell-sub">all time</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Avg Duration</div>
            <div class="metric-cell-value">03:24</div>
            <div class="metric-cell-sub">min:sec per track</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Stability</div>
            <div class="metric-cell-value accent">94.2%</div>
            <div class="metric-cell-sub">ID consistency</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Avg Velocity</div>
            <div class="metric-cell-value">14.3 px/f</div>
            <div class="metric-cell-sub">pixels per frame</div>
          </div>
        </div>
      </div>

      <!-- Active tracks over time -->
      <div class="chart-card full-width">
        <div class="chart-card-header">
          <div class="chart-card-title">Active Tracks Over Time</div>
        </div>
        <div class="chart-container" style="height:160px">
          <canvas id="trk-chart-active"></canvas>
        </div>
      </div>

      <!-- Track duration distribution -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Track Duration Distribution</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="trk-chart-duration"></canvas>
        </div>
      </div>

      <!-- Movement direction radar -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Movement Direction</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="trk-chart-direction"></canvas>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    // Active tracks line
    const ctx1 = document.getElementById('trk-chart-active');
    if (ctx1) new Chart(ctx1, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          data: generateTimeSeries(24,40,20,true),
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.08)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color:'rgba(255,255,255,0.03)' }, ticks: { color:'#64748b', font:{ size:10 }, maxTicksLimit:8 } },
          y: { grid: { color:'rgba(255,255,255,0.03)' }, ticks: { color:'#64748b', font:{ size:10 } }, beginAtZero:true },
        },
      },
    });

    // Duration distribution
    const ctx2 = document.getElementById('trk-chart-duration');
    if (ctx2) new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['<5s','5-15s','15-30s','30s-1m','1-5m','5-15m','>15m'],
        datasets: [{
          data: [245,412,328,184,97,42,18],
          backgroundColor: 'rgba(59,130,246,0.3)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color:'#64748b', font:{ size:10 } } },
          y: { grid: { color:'rgba(255,255,255,0.03)' }, ticks: { color:'#64748b', font:{ size:10 } }, beginAtZero:true },
        },
      },
    });

    // Direction radar
    const ctx3 = document.getElementById('trk-chart-direction');
    if (ctx3) new Chart(ctx3, {
      type: 'radar',
      data: {
        labels: ['N','NE','E','SE','S','SW','W','NW'],
        datasets: [{
          data: [120, 85, 142, 98, 134, 72, 88, 61],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          borderWidth: 1.5,
          pointBackgroundColor: '#22c55e',
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            grid: { color:'rgba(255,255,255,0.06)' },
            ticks: { display: false },
            pointLabels: { color:'#64748b', font:{ size:10 } },
          }
        },
      },
    });
  }, 50);
}
