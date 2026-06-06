/* AntCV demo preview watermark (v1.50.159)
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
 * Demo detection: reads the configured proxyUrl from localStorage and asks its
 * /config for demo_mode (cached for the session). No app.js dependency.
 * Additive, idempotent, removable in one <script> line.
 */
(function () {
  'use strict';
  var VERSION = '1.50.182-relay-config';
  if (window.__antcvDemoWatermark === VERSION) return;
  window.__antcvDemoWatermark = VERSION;

  var CSS_ID = 'antcv-demo-watermark-css';
  var ATTR = 'data-antcv-demo-wm';
  var OVERLAY_CLASS = 'antcv-demo-wm-overlay';
  // 1.50.182: /config (which reports demo_mode) is served by the ACCESS-RELAY,
  // NOT by the user-settable proxyUrl. A stale/mis-set proxyUrl (e.g. pointed at
  // the docx-worker, which has no /config and 404s) used to break demo detection
  // and spam the console. Resolve the base from the relay first
  // (window.ANTCV_RELAY_URL → localStorage.relayUrl), falling back to proxyUrl
  // only as a last resort. Cache the answer ONLY on a successful response so an
  // early call (before relay-config.json has loaded) doesn't pin a wrong value;
  // the retry ticks (200/600/1500/3500ms) then succeed once the relay is known.
  var demoSettled = false, demoValue = false, inFlight = null;

  function readLs(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return '';
      try { return String(JSON.parse(raw)).trim().replace(/\/+$/, ''); }
      catch (_) { return String(raw).trim().replace(/\/+$/, ''); }
    } catch (_) { return ''; }
  }

  function configBase() {
    try {
      if (typeof window !== 'undefined' && window.ANTCV_RELAY_URL) {
        var r = String(window.ANTCV_RELAY_URL).trim().replace(/\/+$/, '');
        if (r) return r;
      }
    } catch (_) {}
    return readLs('relayUrl') || readLs('proxyUrl');
  }

  function resolveDemo() {
    if (demoSettled) return Promise.resolve(demoValue);
    if (inFlight) return inFlight;
    var base = configBase();
    if (!base) return Promise.resolve(false); // relay not known yet — retry later, don't cache
    inFlight = fetch(base + '/config', { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP_' + r.status); return r.json(); })
      .then(function (j) { demoSettled = true; demoValue = !!(j && j.demo_mode); inFlight = null; return demoValue; })
      .catch(function () { inFlight = null; return false; });
    return inFlight;
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

  window.AntcvDemoWatermark = { version: VERSION, _resolveDemo: resolveDemo, _apply: apply };
  try { console.debug('[demo-watermark] installed v' + VERSION); } catch (_) {}
})();
