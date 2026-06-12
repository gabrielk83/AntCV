/* AntCV — DATA-PORTABILITY-CLOUD (v1.50.385)
 * ============================================================
 *
 * Persist corrected defaults (stylePackage / toneRegister) to the cloud so
 * the per-load orphan migrations stop being per-device.
 *
 * Background: the orphan migrations fix localStorage ONLY —
 * antcv-login-loading-gate.js rewrites toneRegister 'scandinavian' →
 * 'nordic-minimal', antcv-package-orphan-apply.js drives the package picker
 * to 'copenhagen-modern'. The corrected values never reached the relay, so
 * every device re-detected and re-migrated on each sign-in.
 *
 * This sidecar pushes the two keys to the existing relay endpoint
 * (PUT /api/prefs → D1 user_kernel.preferences — the relay already routes
 * stylePackage/toneRegister there) whenever their local values CHANGE from
 * what was last pushed:
 *   - boot (+5s, post-auth) — covers the migrations, which run before this;
 *   - storage events on the two keys — covers live changes from any tab;
 *   - never pushes the known-orphan value 'scandinavian' or empty values;
 *   - marker antcv:orphanSync:v1 records the last-pushed pair, 60s throttle.
 *
 * Fire-and-forget; the existing cloud-restore GET then serves the corrected
 * values to every device. Uses the same relay-base/token lookup as
 * antcv-ai-consent-cloud-sync-224.js, and PUTs pass through the shrink
 * guard (355) like every other prefs write.
 */
(function () {
  'use strict';

  if (window.__antcvOrphanCloudPersistInstalled) return;
  var VERSION = '1.50.385';
  window.__antcvOrphanCloudPersistInstalled = VERSION;

  var MARKER = 'antcv:orphanSync:v1';
  var LAST_TRY = 'antcv:orphanSync:lastTry';
  var KEYS = ['stylePackage', 'toneRegister'];
  var ORPHAN = 'scandinavian';

  function readRaw(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function readVal(k) {
    var v = readRaw(k);
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim();
  }
  function readUrlKey(k) {
    var v = readVal(k);
    return v.replace(/\/+$/, '');
  }
  function relay() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = String(window.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
    return v;
  }
  function token() { return readRaw('antcv:auth:token'); }

  function currentClean() {
    var out = {};
    KEYS.forEach(function (k) {
      var v = readVal(k);
      if (v && v.toLowerCase() !== ORPHAN) out[k] = v;
    });
    return out;
  }

  var inFlight = false;
  function maybePush(reason) {
    if (inFlight) return;
    var base = relay(), tok = token();
    if (!base || !tok) return;
    var cur = currentClean();
    if (!Object.keys(cur).length) return;
    var lastPushed = {};
    try { lastPushed = JSON.parse(readRaw(MARKER) || '{}') || {}; } catch (_) {}
    var dirty = {};
    Object.keys(cur).forEach(function (k) { if (lastPushed[k] !== cur[k]) dirty[k] = cur[k]; });
    if (!Object.keys(dirty).length) return;
    var last = Number(readRaw(LAST_TRY) || 0);
    if (last && Date.now() - last < 60000 && reason !== 'forced') return;
    try { localStorage.setItem(LAST_TRY, String(Date.now())); } catch (_) {}
    inFlight = true;
    fetch(base + '/api/prefs', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + tok },
      body: JSON.stringify(dirty),
    }).then(function (res) {
      inFlight = false;
      if (res && res.ok) {
        var merged = {};
        Object.keys(lastPushed).forEach(function (k) { merged[k] = lastPushed[k]; });
        Object.keys(dirty).forEach(function (k) { merged[k] = dirty[k]; });
        try { localStorage.setItem(MARKER, JSON.stringify(merged)); } catch (_) {}
        try { console.log('[orphan-cloud-persist] pushed', Object.keys(dirty).join(','), 'to the cloud'); } catch (_) {}
      }
    }).catch(function () { inFlight = false; });
  }

  window.addEventListener('storage', function (ev) {
    if (ev && KEYS.indexOf(ev.key) >= 0) setTimeout(function () { maybePush('storage'); }, 800);
  });
  setTimeout(function () { maybePush('boot'); }, 5000);
  // late-auth backstop: token may arrive after boot (OAuth return)
  setTimeout(function () { maybePush('late'); }, 20000);

  window.AntcvOrphanCloudPersist = { version: VERSION, push: function () { maybePush('forced'); } };
})();
