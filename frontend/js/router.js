/**
 * VisionTrack — Hash-based SPA Router
 * Maps URL hashes to page modules and renders them into #page-content
 */

// Lazy-load page modules
const PAGE_MODULES = {
  'dashboard':            () => import('./pages/dashboard.js'),
  'live':                 () => import('./pages/live.js'),
  'cameras':              () => import('./pages/cameras.js'),
  'sessions':             () => import('./pages/sessions.js'),
  'analytics-overview':   () => import('./pages/analytics-overview.js'),
  'analytics-detection':  () => import('./pages/analytics-detection.js'),
  'analytics-tracking':   () => import('./pages/analytics-tracking.js'),
  'analytics-heatmap':    () => import('./pages/analytics-heatmap.js'),
  'events':               () => import('./pages/events.js'),
  'models':               () => import('./pages/models.js'),
  'benchmarks':           () => import('./pages/benchmarks.js'),
  'recordings':           () => import('./pages/recordings.js'),
  'snapshots':            () => import('./pages/snapshots.js'),
  'exports':              () => import('./pages/exports.js'),
  'performance':          () => import('./pages/performance.js'),
  'settings':             () => import('./pages/settings.js'),
};

const PAGE_NAMES = {
  'dashboard':            'Dashboard',
  'live':                 'Live Monitor',
  'cameras':              'Cameras',
  'sessions':             'Sessions',
  'analytics-overview':   'Analytics Overview',
  'analytics-detection':  'Detection Analytics',
  'analytics-tracking':   'Tracking Analytics',
  'analytics-heatmap':    'Heatmaps',
  'events':               'Events',
  'models':               'Model Library',
  'benchmarks':           'Benchmarks',
  'recordings':           'Recordings',
  'snapshots':            'Snapshots',
  'exports':              'Export Center',
  'performance':          'Performance',
  'settings':             'Settings',
};

class Router {
  constructor() {
    this._currentRoute = null;
    this._currentCleanup = null;
  }

  init() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  }

  navigate(route) {
    window.location.hash = '#' + route;
  }

  _handleRoute() {
    const hash  = window.location.hash.slice(1) || 'dashboard';
    const route = PAGE_MODULES[hash] ? hash : 'dashboard';
    this._render(route);
  }

  async _render(route) {
    if (this._currentRoute === route) return;

    // Cleanup previous page
    if (this._currentCleanup) {
      try { this._currentCleanup(); } catch(e) {}
      this._currentCleanup = null;
    }

    this._currentRoute = route;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    // Update header breadcrumb
    const pageName = PAGE_NAMES[route] || route;
    const nameEl = document.getElementById('header-page-name');
    if (nameEl) nameEl.textContent = pageName;

    // Update page title
    document.title = `${pageName} — VisionTrack`;

    // Show loading state in content area
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = `
      <div class="page-loading">
        <div class="spinner"></div>
        <span class="page-loading-text">Loading ${pageName}…</span>
      </div>
    `;

    try {
      const loader = PAGE_MODULES[route];
      if (!loader) {
        content.innerHTML = this._notFoundPage(route);
        return;
      }

      const module = await loader();
      if (this._currentRoute !== route) return; // Route changed while loading

      const cleanup = module.render(content);
      if (typeof cleanup === 'function') {
        this._currentCleanup = cleanup;
      }

      // Fade in
      content.classList.remove('fade-in');
      void content.offsetWidth; // force reflow
      content.classList.add('fade-in');

    } catch (err) {
      console.error('[Router] Failed to load page:', route, err);
      content.innerHTML = this._errorPage(route, err);
    }
  }

  _notFoundPage(route) {
    return `
      <div class="empty-state" style="min-height:60vh">
        <div class="empty-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6"/>
            <path d="M6 6l4 4M10 6l-4 4" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-title">Page Not Found</div>
        <div class="empty-desc">The page <code>${route}</code> doesn't exist.</div>
        <button class="btn btn-primary" onclick="window.location.hash='#dashboard'">Go to Dashboard</button>
      </div>
    `;
  }

  _errorPage(route, err) {
    return `
      <div class="empty-state" style="min-height:60vh">
        <div class="empty-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2L14 14H2L8 2z" stroke-linejoin="round"/>
            <path d="M8 7v3M8 12v.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-title" style="color:var(--red)">Failed to Load Page</div>
        <div class="empty-desc">${err?.message || 'An unexpected error occurred.'}</div>
        <button class="btn btn-secondary" onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}

export const router = new Router();
export default router;
