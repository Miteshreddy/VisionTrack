/**
 * VisionTrack — Detection Analytics Page
 */
import { generateTimeSeries, generateHourLabels, MOCK_CLASS_COUNTS } from '../mock-data.js';

export function render(container) {
  const hours = generateHourLabels(24);
  const entries = Object.entries(MOCK_CLASS_COUNTS).sort((a,b)=>b[1]-a[1]);
  const total   = entries.reduce((s,[,v])=>s+v,0);
  const colors  = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4','#f97316','#84cc16'];

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-info">
        <h1 class="page-title">Detection Analytics</h1>
        <p class="page-subtitle">Object detection statistics and class distribution</p>
      </div>
      <div class="page-actions">
        <select class="form-select" style="width:140px">
          <option selected>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
        </select>
        <button class="btn btn-secondary" onclick="window.location.href='/api/session/export/csv'">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Export
        </button>
      </div>
    </div>

    <div class="analytics-layout" style="padding-top:16px">

      <!-- Summary stats -->
      <div class="full-width">
        <div class="metrics-row">
          <div class="metric-cell">
            <div class="metric-cell-label">Total Detections</div>
            <div class="metric-cell-value">${total.toLocaleString()}</div>
            <div class="metric-cell-sub">across all classes</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Detection Rate</div>
            <div class="metric-cell-value accent">142 /s</div>
            <div class="metric-cell-sub">avg per second</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Avg Confidence</div>
            <div class="metric-cell-value green">87.4%</div>
            <div class="metric-cell-sub">mean score</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Unique Classes</div>
            <div class="metric-cell-value">${entries.length}</div>
            <div class="metric-cell-sub">detected today</div>
          </div>
        </div>
      </div>

      <!-- Detection trend -->
      <div class="chart-card full-width">
        <div class="chart-card-header">
          <div class="chart-card-title">Detections Over Time</div>
        </div>
        <div class="chart-container" style="height:180px">
          <canvas id="det-chart-trend"></canvas>
        </div>
      </div>

      <!-- Class count bars -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Top Classes by Count</div>
        </div>
        <div style="padding-top:4px">
          ${entries.map(([cls,count],i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:12px;color:var(--text-secondary);min-width:80px">${cls}</span>
              <div style="flex:1;height:6px;background:var(--bg-raised);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${Math.round(count/entries[0][1]*100)}%;background:${colors[i%8]};border-radius:3px;transition:width .4s ease"></div>
              </div>
              <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);min-width:40px;text-align:right">${count.toLocaleString()}</span>
              <span style="font-size:10.5px;color:var(--text-faint);min-width:36px;text-align:right">${Math.round(count/total*100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Confidence distribution -->
      <div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">Confidence Distribution</div>
        </div>
        <div class="chart-container" style="height:200px">
          <canvas id="det-chart-conf"></canvas>
        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    // Trend
    const ctx1 = document.getElementById('det-chart-trend');
    if (ctx1) new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: hours,
        datasets: [{
          data: generateTimeSeries(24,5000,3000,true),
          backgroundColor: 'rgba(59,130,246,0.25)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color:'#64748b', font:{ size:10 }, maxTicksLimit:8 } },
          y: { grid: { color:'rgba(255,255,255,0.03)' }, ticks: { color:'#64748b', font:{ size:10 } }, beginAtZero: true },
        },
        animation: { duration: 400 },
      },
    });

    // Confidence distribution histogram
    const confBins = [50,60,70,75,80,85,90,92,95,97,99];
    const confData = [12,28,45,63,84,92,78,55,32,18,8];
    const ctx2 = document.getElementById('det-chart-conf');
    if (ctx2) new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: confBins.map(b=>b+'%'),
        datasets: [{
          label: 'Detections',
          data: confData,
          backgroundColor: confBins.map(b => b >= 90 ? 'rgba(34,197,94,0.4)' : b >= 75 ? 'rgba(59,130,246,0.3)' : 'rgba(100,116,139,0.25)'),
          borderColor:      confBins.map(b => b >= 90 ? '#22c55e' : b >= 75 ? '#3b82f6' : '#64748b'),
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color:'#64748b', font:{ size:10 } } },
          y: { grid: { color:'rgba(255,255,255,0.03)' }, ticks: { color:'#64748b', font:{ size:10 } }, beginAtZero: true },
        },
        animation: { duration: 400 },
      },
    });
  }, 50);
}
