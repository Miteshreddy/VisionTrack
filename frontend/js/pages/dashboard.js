/**
 * VisionTrack — Dashboard Page
 */

import { MOCK_DASHBOARD_METRICS, MOCK_EVENTS, MOCK_SESSIONS,
         generateTimeSeries, generateHourLabels,
         MOCK_CLASS_COUNTS } from '../mock-data.js';

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
  animation: { duration: 400 },
};

export function render(container) {
  const labels = generateHourLabels(24);
  const detData = generateTimeSeries(24, 5000, 4000, true);
  const fpsData = generateTimeSeries(24, 27, 8, true);

  container.innerHTML = `
    <div class="dashboard-grid">

      <!-- Metrics row -->
      <div class="span-3">
        <div class="metrics-row">
          <div class="metric-cell">
            <div class="metric-cell-label">Live FPS</div>
            <div class="metric-cell-value accent" id="dash-fps">—</div>
            <div class="metric-cell-sub">avg across streams</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Active Objects</div>
            <div class="metric-cell-value" id="dash-objects">—</div>
            <div class="metric-cell-sub">current frame</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Active Tracks</div>
            <div class="metric-cell-value green" id="dash-tracks">—</div>
            <div class="metric-cell-sub">unique tracked</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Avg Latency</div>
            <div class="metric-cell-value" id="dash-latency">—</div>
            <div class="metric-cell-sub">inference ms</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Sessions Today</div>
            <div class="metric-cell-value">${MOCK_DASHBOARD_METRICS.sessionsToday}</div>
            <div class="metric-cell-sub">active & completed</div>
          </div>
          <div class="metric-cell">
            <div class="metric-cell-label">Detections Today</div>
            <div class="metric-cell-value">${MOCK_DASHBOARD_METRICS.detectionsToday.toLocaleString()}</div>
            <div class="metric-cell-sub">total objects seen</div>
          </div>
        </div>
      </div>

      <!-- Detection trend chart (2/3 width) -->
      <div class="span-2 card">
        <div class="card-header">
          <div>
            <div class="card-title">Detection Volume</div>
            <div class="card-subtitle">Objects detected per hour · last 24 hours</div>
          </div>
          <div class="badge badge-live">Live</div>
        </div>
        <div class="card-body" style="padding-bottom:8px">
          <div class="chart-container" style="height:160px">
            <canvas id="chart-detections"></canvas>
          </div>
        </div>
      </div>

      <!-- Class distribution (1/3 width) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Class Distribution</div>
        </div>
        <div class="card-body" style="padding:8px 16px">
          ${renderClassBars(MOCK_CLASS_COUNTS)}
        </div>
      </div>

      <!-- FPS chart (1/3 width) -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">FPS Trend</div>
            <div class="card-subtitle">Processing throughput</div>
          </div>
        </div>
        <div class="card-body" style="padding-bottom:8px">
          <div class="chart-container" style="height:120px">
            <canvas id="chart-fps"></canvas>
          </div>
        </div>
      </div>

      <!-- Recent events (1/3 width) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Events</div>
          <a href="#events" class="btn btn-ghost btn-sm">View all</a>
        </div>
        <div class="card-body" style="padding:0">
          <div class="activity-list">
            ${MOCK_EVENTS.slice(0, 5).map(e => `
              <div class="activity-item">
                <div class="activity-dot ${eventToClass(e.type)}"></div>
                <div class="activity-body">
                  <div class="activity-desc"><strong>${e.title}</strong></div>
                  <div class="activity-desc">${e.desc}</div>
                  <div class="activity-time">${e.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Recent sessions (1/3 width) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Sessions</div>
          <a href="#sessions" class="btn btn-ghost btn-sm">View all</a>
        </div>
        <div class="card-body" style="padding:0">
          <div style="display:flex;flex-direction:column;">
            ${MOCK_SESSIONS.slice(0, 5).map(s => `
              <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:500;color:var(--text-primary)">${s.id}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${s.camera} · ${s.model}</div>
                </div>
                <span class="status-pill ${s.status === 'running' ? 'live' : 'inactive'}">${s.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Model info + camera status (1/3 width) -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Active Models</div>
        </div>
        <div class="card-body" style="padding:0">
          <div style="padding:12px 16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">YOLOv8s</div>
                <div style="font-size:11px;color:var(--text-muted)">3 active streams · CPU</div>
              </div>
              <span class="badge badge-live">Active</span>
            </div>
          </div>
          <div class="divider"></div>
          <div style="padding:12px 16px">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--text-faint);margin-bottom:8px">Camera Status</div>
            ${renderCameraStatusList()}
          </div>
        </div>
      </div>

    </div>
  `;

  // Animate metrics from API if available
  loadLiveMetrics();

  // Init charts after DOM
  setTimeout(() => {
    initDetectionChart(labels, detData);
    initFpsChart(labels.slice(-12), fpsData.slice(-12));
  }, 50);

  // Refresh live metrics periodically
  const interval = setInterval(loadLiveMetrics, 3000);
  return () => clearInterval(interval);
}

function renderClassBars(counts) {
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const max = Math.max(...entries.map(([,v])=>v));
  const colors = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4','#f97316','#84cc16'];
  return entries.slice(0,8).map(([cls,count],i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
      <span style="font-size:11.5px;color:var(--text-secondary);min-width:72px">${cls}</span>
      <div style="flex:1;height:4px;background:var(--bg-raised);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${Math.round(count/max*100)}%;background:${colors[i%colors.length]};border-radius:2px;transition:width .4s"></div>
      </div>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);min-width:36px;text-align:right">${count}</span>
    </div>
  `).join('');
}

function renderCameraStatusList() {
  const cams = [
    { name: 'Main Entrance', status: 'live' },
    { name: 'Parking Lot A', status: 'live' },
    { name: 'Rooftop View',  status: 'live' },
    { name: 'Side Entrance', status: 'warning' },
    { name: 'Rear Gate',     status: 'idle' },
    { name: 'Lobby Camera',  status: 'offline' },
  ];
  return cams.map(c => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0">
      <span style="font-size:12px;color:var(--text-secondary)">${c.name}</span>
      <span class="status-pill ${c.status}">${c.status}</span>
    </div>
  `).join('');
}

function eventToClass(type) {
  return { detection:'appeared', tracking:'zone', warning:'line', error:'lost', camera:'camera' }[type] || 'info';
}

async function loadLiveMetrics() {
  try {
    const data = await fetch('/api/session/analytics').then(r => r.json());
    setMetric('dash-fps',     (data.fps || 0).toFixed(1));
    setMetric('dash-objects', data.current_objects ?? '—');
    setMetric('dash-tracks',  data.unique_tracked  ?? '—');
    setMetric('dash-latency', data.inference_ms ? data.inference_ms.toFixed(1) + ' ms' : '—');
  } catch {
    // Use mock
    setMetric('dash-fps',     MOCK_DASHBOARD_METRICS.liveFps.toFixed(1));
    setMetric('dash-objects', MOCK_DASHBOARD_METRICS.activeObjects);
    setMetric('dash-tracks',  MOCK_DASHBOARD_METRICS.activeTracks);
    setMetric('dash-latency', MOCK_DASHBOARD_METRICS.avgLatency.toFixed(1) + ' ms');
  }
}

function setMetric(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function initDetectionChart(labels, data) {
  const ctx = document.getElementById('chart-detections');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: { ...CHART_DEFAULTS },
  });
}

function initFpsChart(labels, data) {
  const ctx = document.getElementById('chart-fps');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.08)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: { ...CHART_DEFAULTS },
  });
}
