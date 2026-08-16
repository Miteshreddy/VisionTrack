/**
 * VisionTrack — Settings Page
 */
import { showToast } from '../components.js';

export function render(container) {
  container.innerHTML = `
    <div class="settings-layout">

      <!-- Left navigation -->
      <div class="settings-nav">
        <div class="settings-nav-item active" data-settings-section="general">General</div>
        <div class="settings-nav-item" data-settings-section="detection">Detection</div>
        <div class="settings-nav-item" data-settings-section="streaming">Streaming</div>
        <div class="settings-nav-item" data-settings-section="storage">Storage</div>
        <div class="settings-nav-item" data-settings-section="notifications">Notifications</div>
        <div class="settings-nav-item" data-settings-section="advanced">Advanced</div>
      </div>

      <!-- Settings content -->
      <div class="settings-content">

        <!-- General -->
        <div class="settings-section active" id="settings-general">
          <h2 class="settings-section-title">General</h2>

          <div class="settings-group">
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Appearance</div>
                <div class="settings-row-desc">Choose dark or light mode for the interface</div>
              </div>
              <select class="form-select" style="width:130px" id="setting-theme" onchange="
                document.documentElement.dataset.theme=this.value;
                localStorage.setItem('vt-theme',this.value);
                document.getElementById('theme-icon-dark').style.display=this.value==='dark'?'block':'none';
                document.getElementById('theme-icon-light').style.display=this.value==='light'?'block':'none';
              ">
                <option value="dark" ${localStorage.getItem('vt-theme') !== 'light' ? 'selected' : ''}>Dark</option>
                <option value="light" ${localStorage.getItem('vt-theme') === 'light' ? 'selected' : ''}>Light</option>
              </select>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Sidebar</div>
                <div class="settings-row-desc">Default state when the application loads</div>
              </div>
              <select class="form-select" style="width:130px">
                <option>Expanded</option>
                <option>Collapsed</option>
                <option>Remember</option>
              </select>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Default Page</div>
                <div class="settings-row-desc">Page shown when the app loads</div>
              </div>
              <select class="form-select" style="width:130px">
                <option>Dashboard</option>
                <option>Live Monitor</option>
                <option>Analytics</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Performance</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Animation Speed</div>
                <div class="settings-row-desc">Reduce motion for better performance</div>
              </div>
              <label class="toggle-switch"><input type="checkbox" checked/><span class="toggle-track"></span></label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Live Metrics Refresh</div>
                <div class="settings-row-desc">Interval for dashboard metrics</div>
              </div>
              <select class="form-select" style="width:100px">
                <option>1s</option>
                <option selected>3s</option>
                <option>5s</option>
                <option>10s</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Detection -->
        <div class="settings-section" id="settings-detection">
          <h2 class="settings-section-title">Detection</h2>

          <div class="settings-group">
            <div class="settings-group-title">Default Thresholds</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Confidence Threshold</div>
                <div class="settings-row-desc">Minimum confidence to show a detection</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <input type="range" min="0.05" max="0.95" step="0.05" value="0.35" style="width:100px" id="st-conf"/>
                <span id="st-conf-val" style="font-size:12px;font-family:var(--font-mono);color:var(--text-muted);min-width:32px">0.35</span>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">IoU Threshold</div>
                <div class="settings-row-desc">Overlap threshold for NMS</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <input type="range" min="0.1" max="0.9" step="0.05" value="0.45" style="width:100px" id="st-iou"/>
                <span id="st-iou-val" style="font-size:12px;font-family:var(--font-mono);color:var(--text-muted);min-width:32px">0.45</span>
              </div>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">Tracking</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Default Tracker</div>
                <div class="settings-row-desc">Algorithm used for multi-object tracking</div>
              </div>
              <select class="form-select" style="width:130px">
                <option selected>ByteTrack</option>
                <option>OC-SORT</option>
                <option>DeepSORT</option>
              </select>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Motion Trails</div>
                <div class="settings-row-desc">Show trajectory history on canvas</div>
              </div>
              <label class="toggle-switch"><input type="checkbox" checked/><span class="toggle-track"></span></label>
            </div>
          </div>
        </div>

        <!-- Streaming -->
        <div class="settings-section" id="settings-streaming">
          <h2 class="settings-section-title">Streaming</h2>

          <div class="settings-group">
            <div class="settings-group-title">WebSocket</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">WebSocket URL</div>
                <div class="settings-row-desc">Server address for live stream</div>
              </div>
              <input class="form-input" value="ws://localhost:8000/ws/stream" style="width:240px"/>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Auto Reconnect</div>
                <div class="settings-row-desc">Reconnect on connection drop</div>
              </div>
              <label class="toggle-switch"><input type="checkbox" checked/><span class="toggle-track"></span></label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Max Frame Rate</div>
                <div class="settings-row-desc">Client-side frame rate cap</div>
              </div>
              <select class="form-select" style="width:100px">
                <option>Unlimited</option>
                <option>60 FPS</option>
                <option selected>30 FPS</option>
                <option>15 FPS</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Storage -->
        <div class="settings-section" id="settings-storage">
          <h2 class="settings-section-title">Storage</h2>

          <div class="settings-group">
            <div class="settings-group-title">Recording</div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Auto Record</div>
                <div class="settings-row-desc">Automatically record when session starts</div>
              </div>
              <label class="toggle-switch"><input type="checkbox"/><span class="toggle-track"></span></label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Storage Path</div>
                <div class="settings-row-desc">Where recordings are saved</div>
              </div>
              <input class="form-input" value="./recordings" style="width:200px"/>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Max Storage</div>
                <div class="settings-row-desc">Auto-delete oldest recordings when reached</div>
              </div>
              <select class="form-select" style="width:100px">
                <option>Unlimited</option>
                <option>100 GB</option>
                <option selected>50 GB</option>
                <option>10 GB</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-row">
              <div>
                <div style="font-size:12.5px;color:var(--text-primary);font-weight:500">Storage Usage</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">8.8 GB used of 50 GB</div>
              </div>
            </div>
            <div style="height:8px;background:var(--bg-raised);border-radius:4px;overflow:hidden;margin-top:8px">
              <div style="height:100%;width:17.6%;background:var(--accent);border-radius:4px"></div>
            </div>
          </div>
        </div>

        <!-- Notifications -->
        <div class="settings-section" id="settings-notifications">
          <h2 class="settings-section-title">Notifications</h2>
          <div class="settings-group">
            ${[
              ['Detection Events', 'New objects detected on active cameras'],
              ['Zone Crossings',   'Objects crossing defined zones or lines'],
              ['Camera Alerts',    'Connection drops, low FPS warnings'],
              ['Session Events',   'Session start, stop, export complete'],
              ['System Alerts',    'High CPU/GPU, storage warnings'],
            ].map(([title, desc]) => `
              <div class="settings-row">
                <div class="settings-row-info">
                  <div class="settings-row-title">${title}</div>
                  <div class="settings-row-desc">${desc}</div>
                </div>
                <label class="toggle-switch"><input type="checkbox" checked/><span class="toggle-track"></span></label>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Advanced -->
        <div class="settings-section" id="settings-advanced">
          <h2 class="settings-section-title">Advanced</h2>
          <div class="settings-group">
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Debug Mode</div>
                <div class="settings-row-desc">Show raw WebSocket frames and verbose logging</div>
              </div>
              <label class="toggle-switch"><input type="checkbox" id="st-debug"/><span class="toggle-track"></span></label>
            </div>
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-title">Reset All Settings</div>
                <div class="settings-row-desc">Restore defaults and clear local storage</div>
              </div>
              <button class="btn btn-danger btn-sm" id="btn-reset-settings">Reset</button>
            </div>
          </div>

          <div class="settings-group">
            <div class="settings-group-title">About</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${[
                ['Platform', 'VisionTrack v2.0'],
                ['Detection', 'YOLOv8 / YOLOv11'],
                ['Tracking', 'ByteTrack'],
                ['Backend', 'FastAPI + WebSocket'],
                ['Frontend', 'SPA (Vanilla JS)'],
                ['Build', new Date().toDateString()],
              ].map(([k,v]) => `
                <span style="font-size:11.5px;color:var(--text-muted)">${k}</span>
                <span style="font-size:11.5px;color:var(--text-secondary);font-family:var(--font-mono)">${v}</span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Save button -->
        <div class="settings-footer">
          <button class="btn btn-ghost" id="btn-discard">Discard Changes</button>
          <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
        </div>

      </div>
    </div>
  `;

  // Settings nav
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.settings-nav-item').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      const sec = item.dataset.settingsSection;
      document.getElementById('settings-' + sec)?.classList.add('active');
    });
  });

  // Live slider values
  document.getElementById('st-conf')?.addEventListener('input', e => {
    document.getElementById('st-conf-val').textContent = e.target.value;
    const live = document.getElementById('conf-slider');
    if (live) { live.value = e.target.value; live.dispatchEvent(new Event('input')); }
  });
  document.getElementById('st-iou')?.addEventListener('input', e => {
    document.getElementById('st-iou-val').textContent = e.target.value;
    const live = document.getElementById('iou-slider');
    if (live) { live.value = e.target.value; live.dispatchEvent(new Event('input')); }
  });

  // Save
  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    showToast('Settings Saved', 'All preferences updated', 'success');
  });
  document.getElementById('btn-discard')?.addEventListener('click', () => {
    showToast('Changes Discarded', '', 'info');
  });
  document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    import('../components.js').then(({ confirmModal }) => {
      confirmModal({
        title: 'Reset All Settings',
        message: 'This will reset all settings to factory defaults and clear local storage. Continue?',
        confirmText: 'Reset',
        danger: true,
        onConfirm: () => {
          localStorage.clear();
          showToast('Settings Reset', 'Reload the page to apply defaults', 'info');
        }
      });
    });
  });
}
