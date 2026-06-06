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
  var VERSION = '1.50.173-cl-overlay';
  if (window.__antcvDemoWatermark === VERSION) return;
  window.__antcvDemoWatermark = VERSION;

  var CSS_ID = 'antcv-demo-watermark-css';
  var ATTR = 'data-antcv-demo-wm';
  var OVERLAY_CLASS = 'antcv-demo-wm-overlay';
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
    // 1.50.173: paint the DEMO tiling onto a REAL appended overlay child rather
    // than a ::after pseudo-element. On the cover letter the single full-bleed
    // white letter body painted over the ::after (z-index:6), so the watermark
    // was invisible in the CL preview. A real last child with a high z-index
    // and pointer-events:none reliably stacks above the content (same approach
    // the AI-disclosure sidecar uses, which DOES show on the CL). Tiled, faint,
    // rotated, non-interactive so the preview stays editable beneath it.
    s.textContent =
      '.antcv-preview-paper[' + ATTR + '="1"]{position:relative;}' +
      '.' + OVERLAY_CLASS + '{position:absolute;inset:0;pointer-events:none;z-index:50;' +
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
        // Ensure the paper is a positioning context for the absolute overlay.
        try {
          var cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
          if (cs && cs.position === 'static') p.style.position = 'relative';
        } catch (_) {}
        // Append exactly one overlay child (idempotent). querySelector with a
        // direct-child guard so nested papers don't share one.
        var existing = null;
        for (var c = 0; c < p.children.length; c++) {
          if (p.children[c].classList && p.children[c].classList.contains(OVERLAY_CLASS)) { existing = p.children[c]; break; }
        }
        if (!existing) {
          var ov = document.createElement('div');
          ov.className = OVERLAY_CLASS;
          ov.setAttribute('aria-hidden', 'true');
          p.appendChild(ov);
        }
      } else {
        p.removeAttribute(ATTR);
        for (var d = p.children.length - 1; d >= 0; d--) {
          if (p.children[d].classList && p.children[d].classList.contains(OVERLAY_CLASS)) p.removeChild(p.children[d]);
        }
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
