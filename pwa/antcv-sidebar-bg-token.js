/* AntCV preview sidebar background tokenization (v1.50.159)
 * ===========================================================================
 * Problem
 * -------
 * The preview's candidate HEADER band recolours per visual package (handled by
 * antcv-preview-header-tokens.js via var(--header-bg) + the body[data-package]
 * cascade the islands set). The SIDEBAR does NOT: app.js bakes the sidebar
 * background as the user's `navyColor` (default #1B627F), independent of the
 * package. So switching to e.g. Warm Terracotta recolours everything EXCEPT the
 * sidebar, which stays blue.
 *
 * Fix (sidecar — app.js is built externally)
 * ------------------------------------------
 * The per-package brand colour lives in CSS as var(--package-base) under
 * `body[data-package="<id>"]` (Terracotta #8C4A32, Navy Executive #1D2B45, ...)
 * — the SAME value the DOCX exporter uses for the sidebar (style.sidebarBg =
 * base). We find whichever preview element actually computes to the current
 * navyColor (that's the sidebar fill, wherever app.js put it) and rewrite its
 * background to:
 *     var(--package-base, <navyColor>)
 * so the body[data-package] cascade recolours it for every shipping style, and
 * a Custom style (no --package-base) falls back to navyColor unchanged.
 *
 * Matching by COMPUTED colour (not a fixed hex list) makes this robust to the
 * exact element/derivation, and keeps it scoped to the sidebar: navyColor
 * (#1B627F) differs from the header default (#283556 -> var(--header-bg)), so we
 * never recolour the header.
 *
 * Escape hatch: localStorage['antcv:disable-sidebar-bg-token'] = '1'.
 * Failure mode: nothing matches -> sidebar keeps its current colour. No crash.
 */
(function () {
  'use strict';

  var VERSION = '1.50.159';
  if (window.__antcvSidebarBgToken === VERSION) return;
  window.__antcvSidebarBgToken = VERSION;

  var TAG = 'data-antcv-sidebar-bg-token';
  var DISABLE = 'antcv:disable-sidebar-bg-token';
  var SIDEBAR_VAR = '--package-base';

  function disabled() {
    try { var v = localStorage.getItem(DISABLE); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }

  function readNavyColor() {
    var raw;
    try { raw = localStorage.getItem('navyColor'); } catch (_) { return '#1B627F'; }
    if (raw == null) return '#1B627F';
    raw = String(raw).trim();
    if (raw.charAt(0) === '"') { try { raw = JSON.parse(raw); } catch (_) {} }
    raw = String(raw).trim();
    return raw || '#1B627F';
  }

  // "#1B627F" / "1B627F" -> "rgb(27, 98, 127)" (Chrome's getComputedStyle form).
  function hexToRgbString(hex) {
    var h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  function computedBg(el) {
    try { return window.getComputedStyle(el).backgroundColor; } catch (_) { return ''; }
  }

  function findPaper() { return document.querySelector('.antcv-preview-paper'); }

  function applyOnce() {
    if (disabled()) return;
    var paper = findPaper();
    if (!paper) return;
    var navy = readNavyColor();
    var navyRgb = hexToRgbString(navy);
    if (!navyRgb) return;

    var tokenValue = 'var(' + SIDEBAR_VAR + ', ' + navy + ')';
    var els = paper.querySelectorAll('td, th, div, table');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute(TAG) === '1') continue;
      // Only act on elements whose CURRENT fill is the sidebar navy.
      if (computedBg(el) !== navyRgb) continue;
      try {
        el.style.setProperty('background-color', tokenValue, 'important');
        // Drop a legacy bgcolor attr so the inline background-color wins.
        var bg = (el.getAttribute('bgcolor') || '').toLowerCase().replace(/^#/, '');
        if (bg && bg === navy.toLowerCase().replace(/^#/, '')) el.removeAttribute('bgcolor');
        el.setAttribute(TAG, '1');
      } catch (_) {}
    }
  }

  var pending = null;
  function schedule() {
    if (pending != null) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      try { applyOnce(); } catch (e) {
        try { console.warn('[antcv-sidebar-bg-token] apply failed', e); } catch (_) {}
      }
    });
  }

  function boot() {
    schedule();
    try {
      var obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['style', 'bgcolor', 'class', 'data-package'],
      });
    } catch (_) {}
    window.addEventListener('antcv:package-changed', schedule);
    // navyColor change (custom style) -> re-token the fallback.
    window.addEventListener('storage', function (ev) {
      if (ev && (ev.key === 'navyColor' || ev.key === 'personalInfo')) {
        // Clear tags so the new navyColor is re-matched/re-tokenized.
        try {
          var p = findPaper();
          if (p) Array.prototype.forEach.call(p.querySelectorAll('[' + TAG + '="1"]'),
            function (el) { el.removeAttribute(TAG); });
        } catch (_) {}
        schedule();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AntcvSidebarBgToken = {
    version: VERSION,
    apply: applyOnce,
    _readNavyColor: readNavyColor,
    _hexToRgbString: hexToRgbString,
  };
})();
