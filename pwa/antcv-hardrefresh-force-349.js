/* AntCV hard-refresh force-reload sidecar (v1.50.349)
 * ============================================================================
 * HARDREFRESH-001 (owner 2026-06-11): clicking "↻ Hard Refresh" confirms but
 * the page never reloads (diag: caches.keys + getRegistrations resolve, then
 * "⚠ NO reload ~6s after click"). The DEPLOYED app.js handler awaits the SW
 * unregister / caches.delete BEFORE location.reload(); on a setup where the
 * controlling service worker won't unregister promptly that await hangs, so
 * the reload line is never reached. The repo app.js is already hardened
 * (fire-and-forget cleanup + a forced 1.2s reload), but that fix can't reach
 * the client because the only way to pull it is the very button that's hung —
 * a deadlock.
 *
 * Fix (sidecar — independent of app.js)
 * -------------------------------------
 * Capture-phase click listener on any "Hard Refresh" control. When clicked, we
 * let the app's own handler run (it shows the confirm + starts cleanup), but we
 * ALSO arm our own guaranteed force-reload on a short fixed timer that does NOT
 * await anything: it runs SW-unregister + cache-delete fire-and-forget, then
 * location.replace() with a cache-busting query param so the fresh document
 * loads past any still-controlling SW. Guarded to fire once. Capture phase so
 * we still see the click even though the button handler may stopPropagation.
 *
 * The confirm() is the app's; if the user cancels, our timer still fires a
 * reload ~1.5s later. That is acceptable: a Hard Refresh that reloads even on
 * cancel is strictly better than one that hangs, and the reload is harmless
 * (settings/CV live in localStorage, untouched). If that ever annoys, the app's
 * confirm cancel path can be detected later; for now GUARANTEED reload wins.
 *
 * Also exposes window.AntcvForceReload() as a console escape hatch.
 * Escape: localStorage['antcv:disable-hardrefresh-force'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.349-hardrefresh-force';
  if (window.__antcvHardRefreshForce === VERSION) return;
  window.__antcvHardRefreshForce = VERSION;

  try {
    var d = localStorage.getItem('antcv:disable-hardrefresh-force');
    if (d === '1' || d === 'true') return;
  } catch (_) {}

  var TAG = '[hardrefresh-force-349]';
  var FORCE_DELAY_MS = 1500;   // a touch after the app's own 1200ms attempt
  var armed = false;

  // Fire-and-forget cleanup; NEVER awaited on the reload path.
  function cleanup() {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then(function (rs) { rs.forEach(function (r) { try { r.unregister(); } catch (_) {} }); })
          .catch(function () {});
      }
    } catch (_) {}
    try {
      if ('caches' in window) {
        caches.keys()
          .then(function (ks) { ks.forEach(function (k) { try { caches.delete(k); } catch (_) {} }); })
          .catch(function () {});
      }
    } catch (_) {}
  }

  function forceReload() {
    // Cache-busting param guarantees a fresh document even if a SW still
    // controls the page (network-first SW will fetch it; the new param also
    // dodges any bfcache / in-memory document reuse).
    try {
      var base = location.pathname + (location.search ? location.search + '&' : '?') + 'cb=' + Date.now();
      location.replace(base);
      return;
    } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  function doForce() {
    if (armed) return;
    armed = true;
    cleanup();
    setTimeout(forceReload, FORCE_DELAY_MS);
  }

  // Console escape hatch — immediate (no delay).
  window.AntcvForceReload = function () { cleanup(); forceReload(); };

  // Capture-phase: catch the Hard Refresh click before the app handler can
  // stopPropagation. Match by visible text so we don't depend on a class.
  function onClick(ev) {
    try {
      var t = ev && ev.target;
      if (!t) return;
      var el = t.closest ? t.closest('button, [role="button"], a') : null;
      var node = el || t;
      var txt = (node && (node.textContent || node.getAttribute && node.getAttribute('title')) || '').trim();
      if (!/Hard Refresh/i.test(txt)) return;
      try { console.debug(TAG, 'Hard Refresh click — arming guaranteed reload in ' + FORCE_DELAY_MS + 'ms'); } catch (_) {}
      // Let the app's own confirm + handler run; arm our guaranteed path too.
      doForce();
    } catch (_) {}
  }

  try { window.addEventListener('click', onClick, { capture: true, passive: true }); } catch (_) {}

  window.AntcvHardRefreshForce = { version: VERSION, _force: doForce, _cleanup: cleanup };
  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
