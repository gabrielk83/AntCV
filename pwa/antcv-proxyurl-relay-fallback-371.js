/* AntCV proxyUrl relay fallback (v1.50.330-jdurl-demo)
 * ============================================================================
 * Bug (reported 2026-06-09, mobile demo)
 * --------------------------------------
 * On the home screen, the "OR PASTE A JD URL → Fetch JD" control errors with
 *   "Configure Worker URL in Settings → API Keys first."
 * even when the app is in demo mode. Repro: user was in BYOK mode in the demo,
 * deleted their API keys to force a return to demo. The UI flipped to demo
 * styling immediately (demo detection reads /config.demo_mode + key presence,
 * not proxyUrl), but the home Fetch-JD handler in the minified app.js gates on
 * a NON-EMPTY localStorage.proxyUrl and shows the "Configure Worker URL" error
 * when it's empty. Deleting the keys also cleared proxyUrl, so the gate trips.
 *
 * Why the other JD paths work but this one doesn't
 * ------------------------------------------------
 * The Analyse-JD block (antcv-analysis-panel-jd-block-356.js) and
 * antcv-recheck-fit.js (v1.50.161-proxy-relay) already resolve their endpoint
 * with a relay fallback: read localStorage.proxyUrl, and if empty fall back to
 * window.ANTCV_RELAY_URL (the access-relay base from relay-config.json, which
 * forwards to the demo-proxy). The HOME Fetch-JD button predates that pattern
 * and has no fallback. Generate also works in demo because it resolves the demo
 * endpoint through the same relay path.
 *
 * Fix
 * ---
 * When localStorage.proxyUrl is empty AND window.ANTCV_RELAY_URL is available,
 * seed proxyUrl with the relay base. This makes the home Fetch-JD gate pass and
 * routes the request through the relay → demo-proxy, exactly like every other
 * JD path and like Generate.
 *
 * Why this is safe (does NOT flip the UI out of demo)
 * ---------------------------------------------------
 *   - Demo detection (antcv-demo-watermark.js, app.js demo gate) reads
 *     /config.demo_mode from the relay/proxy origins — NOT whether proxyUrl is
 *     set. The relay reports demo_mode:true, so demo stays on.
 *   - BYOK detection reads the actual key fields (apiKey / openaiKey /
 *     mistralKey / geminiKey) via hasOwnKey() — NOT proxyUrl. Those were
 *     deleted, so the app correctly stays in demo.
 *   - The seeded value is exactly what antcv-auth getProxyUrl() already falls
 *     back to for signed-in users, so it introduces no new origin.
 *
 * Guards
 * ------
 *   - Only fills when proxyUrl is empty (never clobbers a real BYOK proxy URL).
 *   - Only fills with a valid https:// origin that is not this page's host and
 *     not a *.pages.dev origin (same usability test the index.html overlay-cfg
 *     hydrator and docx-worker hydrator apply).
 *   - Re-checks on boot, on focus/pageshow, and on storage changes to proxyUrl
 *     / the key fields, so deleting keys mid-session re-seeds promptly.
 *   - Removable in one <script> line. Escape hatch:
 *     localStorage['antcv:disable-proxyurl-relay-fallback'] = '1'.
 * ============================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.50.330-jdurl-demo';
  if (window.__antcvProxyUrlRelayFallback === VERSION) return;
  window.__antcvProxyUrlRelayFallback = VERSION;

  var TAG = '[proxyurl-relay-fallback]';
  var DISABLE_KEY = 'antcv:disable-proxyurl-relay-fallback';

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  // Tolerant unwrap: some app.js versions JSON-wrap localStorage strings, some
  // don't. Strip surrounding quotes + trailing slashes; return ''.
  function unwrap(raw) {
    if (!raw) return '';
    try {
      var u = raw;
      try { var p = JSON.parse(raw); if (typeof p === 'string') u = p; } catch (_) {}
      return String(u).trim().replace(/\/+$/, '');
    } catch (_) { return ''; }
  }

  function readProxyUrl() {
    try { return unwrap(localStorage.getItem('proxyUrl')); } catch (_) { return ''; }
  }

  // Same usability test app.js's own hydrators apply: a real worker origin is
  // https, not this page, not a *.pages.dev host (the PWA's own origin).
  function isUsableOrigin(u) {
    if (!u) return false;
    try {
      var p = new URL(u);
      if (p.protocol !== 'https:') return false;
      if (p.hostname === location.hostname) return false;
      if (/\.pages\.dev$/i.test(p.hostname)) return false;
      return true;
    } catch (_) { return false; }
  }

  function relayUrl() {
    try {
      if (typeof window.ANTCV_RELAY_URL === 'string' && window.ANTCV_RELAY_URL) {
        return window.ANTCV_RELAY_URL.trim().replace(/\/+$/, '');
      }
    } catch (_) {}
    return '';
  }

  // Seed proxyUrl from the relay when empty. Returns true if a write happened.
  function seedIfEmpty(reason) {
    if (disabled()) return false;
    var current = readProxyUrl();
    if (current) return false; // never clobber a real (BYOK) proxy URL
    var relay = relayUrl();
    if (!isUsableOrigin(relay)) return false;
    try {
      // Write the plain string form. The home Fetch-JD gate and getProxyUrl()
      // both tolerate quoted or unquoted; plain is the safer default and is
      // what antcv-auth writes.
      localStorage.setItem('proxyUrl', relay);
      try { console.debug(TAG, 'seeded empty proxyUrl from relay (' + reason + '):', relay); } catch (_) {}
      // Let same-tab listeners (and our own demo-mode-aware sidecars) react.
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'proxyUrl', newValue: relay, oldValue: '', storageArea: window.localStorage,
        }));
      } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  // Boot: the relay URL is set by index.html's fetchRelayConfig() before
  // app.js loads, but it's async. Try immediately, then a few backoff retries
  // in case relay-config.json resolves slightly after this sidecar runs.
  seedIfEmpty('init');
  [150, 500, 1200, 3000].forEach(function (d) { setTimeout(function () { seedIfEmpty('retry-' + d); }, d); });

  // Re-seed when the user deletes keys mid-session (which clears proxyUrl) or
  // returns to the tab. Key-field deletions don't always fire a proxyUrl
  // storage event in the same tab, so focus/pageshow act as a catch-all.
  ['focus', 'pageshow'].forEach(function (e) {
    window.addEventListener(e, function () { seedIfEmpty(e); });
  });
  window.addEventListener('storage', function (ev) {
    if (!ev) return;
    // proxyUrl cleared, or any key field changed (BYOK → demo transition).
    var watched = ['proxyUrl', 'apiKey', 'openaiKey', 'mistralKey', 'geminiKey'];
    if (watched.indexOf(ev.key) >= 0) {
      // Defer a tick so the clearing write settles before we read.
      setTimeout(function () { seedIfEmpty('storage:' + ev.key); }, 0);
    }
  });

  window.AntcvProxyUrlRelayFallback = {
    version: VERSION,
    seedIfEmpty: seedIfEmpty,
    _relayUrl: relayUrl,
    _isUsableOrigin: isUsableOrigin,
  };

  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
