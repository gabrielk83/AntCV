/* AntCV demo preview watermark (v1.50.182)
 * ============================================================================
 * When the active proxy reports demo_mode:true, overlay a faint diagonal
 * "DEMO" watermark on the CV/CL preview page(s). This is the screen-side
 * counterpart to the server-side DEMO watermark the docx/pdf worker already
 * stamps on exported documents (it stamps when /config reports demo_mode).
 *
 * Coverage:
 *   - on-screen preview          -> this CSS overlay
 *   - browser print-to-PDF       -> this CSS overlay (intentionally NOT
 *                                   no-print, so the saved PDF carries it)
 *   - worker-rendered DOCX/PDF   -> worker stamps "DEMO" server-side
 *
 * Demo detection: the previous build (<=1.50.175) read ONLY
 * localStorage.proxyUrl and asked its /config for demo_mode. That key is
 * empty for signed-in users (antcv-auth getProxyUrl falls back to
 * window.ANTCV_RELAY_URL from relay-config.json), so on the demo account the
 * preview watermark never appeared even though the EXPORT did — app.js drives
 * the export through the relay with the correct demo_mode, while this sidecar
 * was querying an empty origin and silently resolving false.
 *
 * 1.50.182 fix: resolve demo_mode the way the rest of the app does — query
 * EVERY known origin (relay URL, proxyUrl, docx-worker origin) and treat demo
 * as on if ANY of them reports demo_mode:true. Mirrors the privacy-LED
 * readOwnProxyHosts() lesson (v1.40.194). Additive, idempotent, removable in
 * one <script> line.
 */
(function () {
  'use strict';
  var VERSION = '1.50.184-no-docx-config';
  if (window.__antcvDemoWatermark === VERSION) return;
  window.__antcvDemoWatermark = VERSION;

  var CSS_ID = 'antcv-demo-watermark-css';
  var ATTR = 'data-antcv-demo-wm';
  var OVERLAY_CLASS = 'antcv-demo-wm-overlay';
  // 1.50.182 (demo-multi-origin): /config (which reports demo_mode) can be
  // served by any of several origins depending on how the user is configured —
  // the access-relay (signed-in / demo users, via window.ANTCV_RELAY_URL or
  // localStorage.relayUrl), a custom proxyUrl, or the docx worker. Query every
  // known origin and treat demo as ON if ANY reports demo_mode:true, so a stale
  // or mis-set proxyUrl can't suppress the watermark.
  var demoPromise = null;

  // Tolerant unwrap: some app.js versions JSON-wrap localStorage strings,
  // some don't. Strip surrounding quotes + trailing slashes; return ''.
  function unwrap(raw) {
    if (!raw) return '';
    try {
      var u = raw;
      try { var p = JSON.parse(raw); if (typeof p === 'string') u = p; } catch (_) {}
      return String(u).trim().replace(/\/+$/, '');
    } catch (_) { return ''; }
  }

  function originOf(u) {
    if (!u) return '';
    try { return new URL(u).origin; } catch (_) { return ''; }
  }

  // Every origin the app might route /config through. De-duped, order-
  // independent (we query them all and OR the results). Signed-in users
  // typically have an empty proxyUrl and route through ANTCV_RELAY_URL, so
  // that one is the load-bearing addition vs the old proxyUrl-only read.
  function configOrigins() {
    var set = {};
    // NEVER query the docx-worker: it has NO /config route (that lives on the
    // access-relay), so hitting it only yields a 404 + a CORS failure (it sends
    // no Access-Control-Allow-Credentials). Skip any origin whose host is the
    // docx-worker — even if a stale proxyUrl/docxWorkerUrl points there. The
    // docx worker stamps DEMO during EXPORT from the watermark flag the PWA
    // sends; it is not a demo-detection /config source.
    var add = function (u) {
      var o = originOf(u);
      if (!o) return;
      try { if (new URL(o).hostname.indexOf('docx-worker') !== -1) return; } catch (_) {}
      set[o] = 1;
    };
    try { add(unwrap(localStorage.getItem('proxyUrl'))); } catch (_) {}
    try { add(unwrap(localStorage.getItem('relayUrl'))); } catch (_) {}
    try { if (typeof window.ANTCV_RELAY_URL === 'string') add(window.ANTCV_RELAY_URL); } catch (_) {}
    try { if (typeof window.ANTCV_UPSTREAM_URL === 'string') add(window.ANTCV_UPSTREAM_URL); } catch (_) {}
    return Object.keys(set);
  }

  function fetchDemo(origin) {
    return fetch(origin + '/config', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return !!(j && j.demo_mode); })
      .catch(function () { return false; });
  }

  // 1.50.307: a BYOK user (their OWN key present) is NOT a demo user even on a
  // demo-capable deployment — their generations run on their own key. So the DEMO
  // preview watermark must be suppressed for them (matches the app's
  // __antcvDemoActive gate for the badge / export watermark).
  function hasOwnKey() {
    try {
      return !!(
        unwrap(localStorage.getItem('apiKey')) ||
        unwrap(localStorage.getItem('openaiKey')) ||
        unwrap(localStorage.getItem('mistralKey')) ||
        unwrap(localStorage.getItem('geminiKey'))
      );
    } catch (_) { return false; }
  }
  function resolveDemo() {
    if (demoPromise) return demoPromise;
    if (hasOwnKey()) { demoPromise = Promise.resolve(false); return demoPromise; }
    var origins = configOrigins();
    if (!origins.length) { demoPromise = Promise.resolve(false); return demoPromise; }
    // Query every origin; demo is ON if ANY reports demo_mode:true. Don't let
    // one slow/failed origin block the others — Promise.all with per-origin
    // catch (fetchDemo already catches) resolves once they've all settled.
    demoPromise = Promise.all(origins.map(fetchDemo))
      .then(function (results) {
        for (var i = 0; i < results.length; i++) { if (results[i]) return true; }
        return false;
      })
      .catch(function () { return false; });
    return demoPromise;
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    // 1.50.175: render the DEMO tiling as a ::after pseudo-element at the MAX
    // z-index. Two earlier tries failed on the cover-letter preview: ::after at
    // z-index:6 (1.50.159) was painted over by the CL's full-bleed letter body,
    // and an injected child overlay (1.50.173) showed on the CV but not the CL
    // (React reconciliation can drop an injected child when the CL re-renders).
    // ::after can't be wiped by React, and a top-of-stack z-index beats any CL
    // content layer (the app stacks dropdowns/overlays at ~9000). pointer-events
    // :none keeps the preview editable beneath it.
    s.textContent =
      '.antcv-preview-paper[' + ATTR + '="1"]{position:relative;}' +
      '.antcv-preview-paper[' + ATTR + '="1"]::after{content:"";position:absolute;inset:0;' +
      'pointer-events:none;z-index:2147483000;' +
      "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><text x='150' y='110' font-family='Arial,sans-serif' font-size='44' font-weight='800' fill='rgba(220,50,50,0.10)' text-anchor='middle' transform='rotate(-30 150 100)'>DEMO</text></svg>\");" +
      'background-repeat:repeat;}';
    (document.head || document.documentElement).appendChild(s);
  }

  function apply(on) {
    var papers = document.querySelectorAll('.antcv-preview-paper, [data-antcv-preview-paper]');
    for (var i = 0; i < papers.length; i++) {
      var p = papers[i];
      if (on) {
        p.setAttribute(ATTR, '1');
        try {
          var cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
          if (cs && cs.position === 'static') p.style.position = 'relative';
        } catch (_) {}
      } else {
        p.removeAttribute(ATTR);
      }
      // Clean up any 1.50.173 injected child overlays (superseded by ::after).
      for (var d = p.children.length - 1; d >= 0; d--) {
        if (p.children[d].classList && p.children[d].classList.contains(OVERLAY_CLASS)) p.removeChild(p.children[d]);
      }
    }
  }

  function applyIfDemo() {
    resolveDemo().then(function (on) { if (on) { injectCss(); apply(true); } });
  }

  // Debounced via setTimeout (NOT requestAnimationFrame — rAF is paused in
  // hidden/background tabs, which would leave the watermark unapplied).
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; applyIfDemo(); }, 50);
  }

  applyIfDemo();
  [200, 600, 1500, 3500].forEach(function (d) { setTimeout(applyIfDemo, d); });
  try {
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target;
        if (t && t.nodeType === 1 && t.hasAttribute && t.hasAttribute(ATTR)) continue;
        schedule(); return;
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvDemoWatermark = { version: VERSION, _resolveDemo: resolveDemo, _apply: apply, _origins: configOrigins };
  try { console.debug('[demo-watermark] installed v' + VERSION); } catch (_) {}
})();
