const CACHE = 'antcv-1.50.90';
const SHELL = [
  './manifest.json',
  './antcv-mobile-controls.css',
  './antcv-mobile-controls.js',
  './antcv-docx-client.js',
  './antcv-data-importer.js',
  './antcv-packages-registry.css',
  './antcv-react-islands.js',
  './antcv-personal-info-anti-thinning-353.js',
  './antcv-section-align.js',
  './antcv-recheck-fit.js',
  './antcv-gap-closure-342.js',
  './antcv-bottom-fusion-343.js',
  './antcv-analysis-merge-344.js',
  './antcv-analysis-panel-jd-block-356.js',
  './antcv-sections-icon-346.js',
  './antcv-topbar-tools-347.js',
  './antcv-mobile-fab-cleanup-351.js',
  './antcv-pub-injected-reaper-352.js',
  './antcv-cloud-put-shrink-guard-355.js',
  './antcv-jd-watch.js',
  './antcv-privacy-led.js',
  './antcv-bullet-targets.js',
  './antcv-photo-position.js',
  './antcv-preview-header-tokens.js',
  './antcv-photo-bridge-button.js',
  './antcv-pdf-preview-gate.js',
  './antcv-tone-helper.js',
  './antcv-jd-image-ocr.js',
  './antcv-panel-bottom-pad.js',
  './antcv-sidebar-position.js',
  './antcv-page-fit.js',
  './antcv-table-fast-drag.js',
  './antcv-tone-custom-slots.js',
  './antcv-auth.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/antcv-icon.svg',
  './icons/ant.svg',
  './icons/defaults/ant.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/mammoth/mammoth.browser.min.js',
];
// HTML / source files use network-first so updates aren't stuck behind cache.
// v1.38: relay-config.json is also network-first AND skip-cache, so admin
// URL changes propagate without forcing a service-worker bump.
const NETWORK_FIRST = /\.(html|js|css|jsx)(\?|$)|\/$|relay-config\.json/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle GETs. POSTs (LLM proxy, DOCX worker) fall through.
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Skip the SW entirely for auth-dependent API calls. /config, /me, /api/*,
  // /admin/*, /auth/* on cv-proxy or relay (any *.workers.dev host) all depend
  // on the user's session JWT. Caching them would let a stale "no admin" or
  // "session expired" response survive across reloads, requiring Hard Refresh
  // to clear. Pass-through means the browser handles them normally (with
  // cookies/Authorization) and the SW never stores the result.
  if (url.hostname.endsWith('.workers.dev')) return;

  const isNavOrSource = e.request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname);

  if (isNavOrSource) {
    // Network-first: try fresh, fall back to cache only if offline.
    // v1.40.165 SW audit: offline fallback uses {ignoreSearch:true} so
    // a cache entry for "./antcv-foo.js" still matches a request for
    // "./antcv-foo.js?v=1.40.165". Without this, SHELL pre-caching is
    // wasted because the runtime always queries with a version suffix.
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets (icons, libraries, css/js modules).
  // Note: NO ignoreSearch on the primary cache-match — assets that are
  // explicitly version-busted (?v=…) MUST go through to network so the
  // new version is fetched. The offline-fallback below DOES use
  // ignoreSearch so the user still gets SOMETHING when offline.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })))
  );
});
