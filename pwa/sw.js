const CACHE = 'antcv-1.51.300-tab-doc-iso';
const SHELL = [
  './manifest.json',
  './antcv-debug-logger.js',
  './antcv-mobile-controls.css',
  './antcv-docx-client.js',
  './antcv-data-importer.js',
  './antcv-packages-registry.css',
  './antcv-react-islands.js',
  './antcv-react-islands-panels.js',
  './antcv-react-dom-guard.js',
  './antcv-personal-info-anti-thinning-353.js',
  './antcv-section-align.js',
  './antcv-recheck-fit.js',
  './antcv-gap-closure-342.js',
  './antcv-bottom-fusion-343.js',
  './antcv-analysis-merge-344.js',
  './antcv-analysis-panel-jd-block-356.js',
  './antcv-analysis-report-pdf-360.js',
  './antcv-sections-icon-346.js',
  './antcv-topbar-tools-347.js',
  './antcv-cl-ai-notice-inline.js',
  './antcv-mobile-fab-cleanup-351.js',
  './antcv-pub-injected-reaper-352.js',
  './antcv-cloud-put-shrink-guard-355.js',
  './antcv-jd-watch.js',
  './antcv-spell-annotator-384.js',
  './antcv-orphan-cloud-persist-385.js',
  './antcv-confidence-overlay-386.js',
  './antcv-row-controls-dedupe-388.js',
  './antcv-outcomes-metric-guard-390.js',
  './antcv-outcome-role-select.js',
  './antcv-group-name-visibility.js',
  './antcv-heading-label-dedup.js',
  './antcv-publications-dedup.js',
  './antcv-tables-core-dedup.js',
  './antcv-tools-hidden-residue.js',
  './antcv-sidebar-visibility-ux.js',
  './antcv-tables-partition.js',
  './antcv-orphan-measure-bind.js',
  './antcv-orphan-export-preflight.js',
  './antcv-preview-paper-memo.js',
  './antcv-empty-role-hide.js',
  './antcv-roles-active-floor.js',
  './antcv-role-merge-stored.js',
  './antcv-sidebar-group-merge-stored.js',
  './antcv-lang-fabrication-guard.js',
  './antcv-outcomes-loss-guard.js',
  './antcv-gabriel-results-pin.js',
  './antcv-unsolicited-cv-completeness.js',
  './antcv-profile-disclosure-strip.js',
  './antcv-outcomes-metric-order.js',
  './antcv-experience-order.js',
  './antcv-kernel-ingest.js',
  './antcv-kernel-import.js',
  './vendor/nspell.browser.js',
  './antcv-share-target-jd-375.js',
  './antcv-privacy-led.js',
  './antcv-demo-watermark.js',
  './antcv-bullet-targets.js',
  './antcv-photo-ui-427.js',
  './antcv-preview-header-tokens.js',
  './antcv-pdf-preview-gate.js',
  './antcv-tone-helper.js',
  './antcv-jd-image-ocr.js',
  './antcv-panel-bottom-pad.js',
  './antcv-sidebar-position.js',
  './antcv-page-fit.js',
  './antcv-main-overflow-detect-364.js',
  './antcv-main-overflow-squeeze-365.js',
  './antcv-unified-pagination-probe-366.js',
  './antcv-auto-pagebreak-block-001.js',
  './antcv-table-fast-drag.js',
  './antcv-settings-history-guard.js',
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
// HTML / navigations use network-first so updates aren't stuck behind cache.
// v1.38: relay-config.json is also network-first AND skip-cache, so admin
// URL changes propagate without forcing a service-worker bump.
const NETWORK_FIRST = /\.html(\?|$)|\/$|relay-config\.json/;
// PERF-SW-CACHE-001: .js/.css/.jsx are network-first ONLY when requested
// WITHOUT a `?v=` cache-bust query. index.html's script tags already carry
// `?v=` on (almost) every sidecar (CLAUDE.md cache-bust protocol requires a
// bump on every hotfix), so "foo.js?v=1.51.157" is a DIFFERENT cache key
// from any prior version — cache-first can never serve stale content for
// it, and a warm reload skips the network round-trip entirely. A .js/.css
// request WITHOUT a version query (should not happen for anything wired
// through the protocol, but a safe fallback for anything that slips through)
// keeps the old network-first behaviour.
const CODE_ASSET = /\.(js|css|jsx)$/;

self.addEventListener('install', e => {
  // Resilient precache: add each asset INDEPENDENTLY so a single missing
  // or failing resource (a 404 on a retired sidecar, a CDN hiccup, a CORS
  // rejection on a cross-origin URL) cannot abort the whole install — which
  // is exactly what caches.addAll(SHELL) used to do (one bad entry rejected
  // the batch and the app shell was never precached, breaking offline).
  // Skipped assets are logged and left to the runtime fetch handler to cache
  // on first use.
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(SHELL.map(u =>
        c.add(u).catch(err => {
          try { console.warn('[sw] precache skipped:', u, (err && err.message) || err); } catch (_) {}
        })
      ))
    ).then(() => self.skipWaiting())
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

  const isVersionedCodeAsset = CODE_ASSET.test(url.pathname) && url.searchParams.has('v');
  const isNavOrSource = !isVersionedCodeAsset &&
    (e.request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname) || CODE_ASSET.test(url.pathname));

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
