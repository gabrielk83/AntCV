/* AntCV hard-refresh force-reload + SW-freshness guard (v1.50.789)
 * ============================================================================
 * HARDREFRESH-001 (owner 2026-06-11): clicking "↻ Hard Refresh" confirms but
 * the page never reloads — the deployed app.js handler AWAITS the SW
 * unregister / caches.delete before location.reload(); on a setup where the
 * controlling service worker won't unregister promptly that await hangs, so
 * the reload line is never reached.
 *
 * STALE-SW-DEMASK-001 (owner 2026-06-22, the #1 systemic blocker): a stale
 * service worker can pin the tab to OLD app.js while antcv-version-override
 * rewrites the version chip to the LATEST number — so fixes look broken when
 * they simply are not loaded. See memory [[stale-sw-version-mask-hazard]].
 * Two halves are needed and both live here now:
 *
 *   (1) GUARANTEED-FRESH hard refresh. The cleanup (SW unregister + cache
 *       delete) is AWAITED — but BOUNDED by a hard timeout so it can never
 *       hang the reload (the original 349 bug). After cleanup the page is
 *       reloaded to a cache-busted URL so the next document loads with NO
 *       controlling SW → fresh index.html → fresh app.js + sidecars.
 *
 *   (2) DE-MASKING. On boot we fetch index.html DIRECTLY from the network
 *       (cache:'no-store' + a unique query → bypasses the SW *and* the HTTP
 *       cache) and read the DEPLOYED release version from its
 *       `window.ANTCV_VERSION = '…'` seed. We compare that to the release
 *       version this tab actually LOADED (`window.ANTCV_VERSION`, which the
 *       loaded version-override pins to the loaded TARGET). If the deployed
 *       version is NEWER than the loaded one, this tab is running stale code:
 *       we surface an honest, dismissible "Update" banner and (once per
 *       deployed-version, guarded against reload loops) auto-run the
 *       guaranteed-fresh reload.
 *
 *       NOTE — the comparison is loaded-release vs network-fresh-release of
 *       the SAME signal (the per-release ANTCV_VERSION seed, bumped every
 *       release). We deliberately do NOT compare TARGET_VERSION to the
 *       app.js?v script-tag: app.js?v only moves when app.js itself changes,
 *       so it legitimately lags the release number and would false-positive.
 *
 * Exposes:
 *   window.AntcvForceReload()      — immediate guaranteed-fresh reload.
 *   window.AntcvGuaranteedFresh()  — same (alias).
 *   window.AntcvCheckFreshness()   — re-run the staleness probe on demand.
 * Escapes (localStorage):
 *   antcv:disable-hardrefresh-force = '1'  → disable the button force-reload.
 *   antcv:disable-freshness-check   = '1'  → disable the auto staleness probe.
 *   antcv:disable-freshness-auto    = '1'  → keep the probe + banner but never
 *                                            auto-reload (banner only).
 */
(function () {
  'use strict';
  var VERSION = '1.50.789-freshness-guard';
  if (window.__antcvHardRefreshForce === VERSION) return;
  window.__antcvHardRefreshForce = VERSION;

  var TAG = '[freshness-guard-789]';
  var FORCE_DELAY_MS = 1500;   // a touch after the app's own ~1200ms attempt
  var CLEANUP_BUDGET_MS = 2500; // bounded await — never hang the reload
  var armed = false;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function disabled(k) { var d = lsGet(k); return d === '1' || d === 'true'; }

  // ── Bounded-await cleanup: unregister all SWs + delete all caches ─────────
  // Returns a promise that resolves when cleanup is done OR the budget expires,
  // whichever comes first — so the reload is GUARANTEED to proceed.
  function cleanup() {
    var tasks = [];
    try {
      if ('serviceWorker' in navigator) {
        tasks.push(
          navigator.serviceWorker.getRegistrations()
            .then(function (rs) {
              return Promise.all(rs.map(function (r) {
                try { return r.unregister().catch(function () {}); } catch (_) { return null; }
              }));
            })
            .catch(function () {})
        );
      }
    } catch (_) {}
    try {
      if ('caches' in window) {
        tasks.push(
          caches.keys()
            .then(function (ks) {
              return Promise.all(ks.map(function (k) {
                try { return caches.delete(k).catch(function () {}); } catch (_) { return null; }
              }));
            })
            .catch(function () {})
        );
      }
    } catch (_) {}
    var done = Promise.all(tasks).catch(function () {});
    var budget = new Promise(function (res) { setTimeout(res, CLEANUP_BUDGET_MS); });
    return Promise.race([done, budget]);
  }

  function bustedUrl() {
    var search = (location.search || '').replace(/[?&]cb=\d+/g, '').replace(/^&/, '?');
    if (search && search.charAt(0) !== '?') search = '?' + search.replace(/^[?&]/, '');
    var sep = search ? (search + '&') : '?';
    return location.pathname + sep + 'cb=' + Date.now();
  }

  function forceReload() {
    try { location.replace(bustedUrl()); return; } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  // Guaranteed-fresh: AWAIT (bounded) cleanup, THEN reload SW-less.
  function guaranteedFresh() {
    if (armed) return;
    armed = true;
    try { console.debug(TAG, 'guaranteed-fresh: cleanup then reload (budget ' + CLEANUP_BUDGET_MS + 'ms)'); } catch (_) {}
    cleanup().then(forceReload, forceReload);
  }

  window.AntcvForceReload = guaranteedFresh;
  window.AntcvGuaranteedFresh = guaranteedFresh;

  // ── Hard Refresh button hook (capture phase — beat any stopPropagation) ───
  function onClick(ev) {
    if (disabled('antcv:disable-hardrefresh-force')) return;
    try {
      var t = ev && ev.target;
      if (!t) return;
      var el = t.closest ? t.closest('button, [role="button"], a') : null;
      var node = el || t;
      var txt = (node && (node.textContent || (node.getAttribute && node.getAttribute('title'))) || '').trim();
      if (!/Hard Refresh/i.test(txt)) return;
      try { console.debug(TAG, 'Hard Refresh click — guaranteed reload'); } catch (_) {}
      guaranteedFresh();
    } catch (_) {}
  }
  try { window.addEventListener('click', onClick, { capture: true, passive: true }); } catch (_) {}

  // ── DE-MASKING: detect a tab running stale code ───────────────────────────
  function patchNum(v) {
    // Extract a comparable integer from "1.50.788" / "1.50.788-suffix".
    var m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
    if (!m) return null;
    return (parseInt(m[1], 10) * 1000000) + (parseInt(m[2], 10) * 1000) + parseInt(m[3], 10);
  }

  function loadedVersion() {
    // The release this tab actually loaded. version-override pins
    // window.ANTCV_VERSION to the LOADED TARGET; the inline seed sets it first.
    try {
      if (window.AntcvVersionOverride && window.AntcvVersionOverride.targetVersion) {
        return window.AntcvVersionOverride.targetVersion;
      }
    } catch (_) {}
    return window.ANTCV_VERSION || null;
  }

  function showBanner(loadedV, deployedV) {
    if (document.getElementById('antcv-stale-banner')) return;
    var bar;
    try {
      bar = document.createElement('div');
      bar.id = 'antcv-stale-banner';
      bar.setAttribute('role', 'status');
      bar.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483646',
        'background:#7a1f1f', 'color:#fff', 'font:600 13px/1.4 system-ui,sans-serif',
        'padding:10px 14px', 'display:flex', 'gap:12px', 'align-items:center',
        'justify-content:center', 'box-shadow:0 -2px 10px rgba(0,0,0,.35)'
      ].join(';');
      var msg = document.createElement('span');
      msg.textContent = 'A newer AntCV is live (' + deployedV + '). You are running ' +
        loadedV + ' — fixes may look missing until you update.';
      var update = document.createElement('button');
      update.textContent = 'Update now';
      update.style.cssText = 'background:#fff;color:#7a1f1f;border:0;border-radius:5px;' +
        'padding:6px 12px;font:inherit;font-weight:700;cursor:pointer';
      update.addEventListener('click', function () { guaranteedFresh(); });
      var dismiss = document.createElement('button');
      dismiss.textContent = '✕';
      dismiss.setAttribute('aria-label', 'Dismiss');
      dismiss.style.cssText = 'background:transparent;color:#fff;border:0;font:inherit;' +
        'font-size:16px;cursor:pointer;opacity:.85';
      dismiss.addEventListener('click', function () { try { bar.remove(); } catch (_) {} });
      bar.appendChild(msg); bar.appendChild(update); bar.appendChild(dismiss);
      (document.body || document.documentElement).appendChild(bar);
    } catch (_) {}
  }

  function checkFreshness() {
    if (disabled('antcv:disable-freshness-check')) return;
    var loadedV = loadedVersion();
    if (!loadedV) return; // version not settled yet — caller retries
    // Fetch the deployed index.html bypassing SW + HTTP cache.
    var url = './index.html?_fresh=' + Date.now();
    fetch(url, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r && r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var m = /window\.ANTCV_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(html);
        var deployedV = m && m[1];
        if (!deployedV) return;
        var lp = patchNum(loadedV), dp = patchNum(deployedV);
        if (lp == null || dp == null) return;
        if (dp <= lp) {
          try { console.debug(TAG, 'fresh — loaded', loadedV, '>= deployed', deployedV); } catch (_) {}
          return;
        }
        // STALE: deployed is newer than what we loaded.
        try { console.warn(TAG, 'STALE TAB — loaded', loadedV, 'but deployed', deployedV); } catch (_) {}
        showBanner(loadedV, deployedV);
        // Auto-recover ONCE per deployed-version (loop guard).
        if (disabled('antcv:disable-freshness-auto')) return;
        var guardKey = 'antcv:freshness-auto-attempted';
        var prev = null;
        try { prev = sessionStorage.getItem(guardKey); } catch (_) {}
        if (prev === deployedV) {
          try { console.warn(TAG, 'auto-recover already attempted for', deployedV, '— banner only'); } catch (_) {}
          return;
        }
        try { sessionStorage.setItem(guardKey, deployedV); } catch (_) {}
        try { console.warn(TAG, 'auto-recovering to', deployedV); } catch (_) {}
        guaranteedFresh();
      })
      .catch(function () { /* offline / blocked — ignore */ });
  }

  window.AntcvCheckFreshness = checkFreshness;

  // Run the probe once the loaded version has settled. version-override is
  // appended after app.js onload, so poll briefly for it.
  (function scheduleCheck() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (loadedVersion()) { clearInterval(t); checkFreshness(); return; }
      if (tries > 40) { clearInterval(t); } // ~8s then give up
    }, 200);
  })();

  window.AntcvHardRefreshForce = {
    version: VERSION,
    _force: guaranteedFresh,
    _cleanup: cleanup,
    _check: checkFreshness
  };
  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
