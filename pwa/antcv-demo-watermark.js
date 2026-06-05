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
  var VERSION = '1.50.159';
  if (window.__antcvDemoWatermark === VERSION) return;
  window.__antcvDemoWatermark = VERSION;

  var CSS_ID = 'antcv-demo-watermark-css';
  var ATTR = 'data-antcv-demo-wm';
  // Cache the PROMISE (not a flag) so every caller — including ones that fire
  // while the /config fetch is still in flight — awaits the same resolution
  // and gets the final value. A plain "resolving" flag returned a stale null
  // mid-flight, which made an early apply() clear the watermark.
  var demoPromise = null;

  function readProxyUrl() {
    try {
      var raw = localStorage.getItem('proxyUrl');
      if (!raw) return '';
      try { return String(JSON.parse(raw)).trim().replace(/\/+$/, ''); }
      catch (_) { return String(raw).trim().replace(/\/+$/, ''); }
    } catch (_) { return ''; }
  }

  function resolveDemo() {
    if (demoPromise) return demoPromise;
    var px = readProxyUrl();
    if (!px) { demoPromise = Promise.resolve(false); return demoPromise; }
    demoPromise = fetch(px + '/config', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return !!(j && j.demo_mode); })
      .catch(function () { return false; });
    return demoPromise;
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    // Tiled, faint, rotated "DEMO" so it covers the whole page (incl. long
    // multi-page papers) without obscuring the content. pointer-events:none
    // keeps the preview fully editable beneath it.
    s.textContent =
      '.antcv-preview-paper[' + ATTR + '="1"]{position:relative;}' +
      '.antcv-preview-paper[' + ATTR + '="1"]::after{content:"";position:absolute;inset:0;' +
      'pointer-events:none;z-index:6;' +
      "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><text x='150' y='110' font-family='Arial,sans-serif' font-size='44' font-weight='800' fill='rgba(220,50,50,0.10)' text-anchor='middle' transform='rotate(-30 150 100)'>DEMO</text></svg>\");" +
      'background-repeat:repeat;}';
    (document.head || document.documentElement).appendChild(s);
  }

  function apply(on) {
    var papers = document.querySelectorAll('.antcv-preview-paper, [data-antcv-preview-paper]');
    for (var i = 0; i < papers.length; i++) {
      if (on) papers[i].setAttribute(ATTR, '1');
      else papers[i].removeAttribute(ATTR);
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
