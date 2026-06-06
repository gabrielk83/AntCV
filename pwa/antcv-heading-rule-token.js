/* AntCV preview section-heading rule tokenization (v1.50.182)
 * ===========================================================================
 * Goal
 * ----
 * Make the horizontal RULE under each main-column section heading (the line
 * above PROFILE and under every section title) match the candidate header
 * band colour, so it reads as native to the band — in the preview, matching
 * the DOCX/PDF worker change of the same date (headingParagraph rule bound to
 * style.headerBg).
 *
 * Why a sidecar
 * -------------
 * app.js bakes the heading rule colour inline (default #1B627F, == mainHeadColor),
 * the same way it baked the header band before antcv-preview-header-tokens.js.
 * In the package/default path mainHeadColor === headerBg so they already match,
 * but a visual-style / alt-circle / palette quick-change can override the band
 * (headerBg) without moving the heading rule (mainHeadColor) — the rule then
 * diverges from the band. Binding the preview rule to var(--header-bg) keeps the
 * two identical under every override, exactly like the export side.
 *
 * Scope (deliberately narrow)
 * ---------------------------
 *   - MAIN column only. The SIDEBAR keeps its own contrasting heading rule
 *     (sidebarHeadColor / teal) — a band-coloured rule on the band-coloured
 *     sidebar panel would be invisible. We scope by excluding any element
 *     inside the sidebar subtree.
 *   - The border-bottom (the rule) ONLY. Heading TEXT colour is left untouched.
 *   - Matches by COMPUTED border-bottom-colour == the current heading colour,
 *     so it's robust to which exact element app.js attaches the border to.
 *
 * --header-bg is set by the body[data-package] cascade (the islands) and is the
 * SAME token antcv-preview-header-tokens.js binds the band to, so the rule and
 * band always resolve to one value. Custom styles (no --header-bg) fall back to
 * the live headerBg/navy value so nothing breaks.
 *
 * Escape hatch: localStorage['antcv:disable-heading-rule-token'] = '1'.
 * Failure mode: nothing matches -> rules keep their current colour. No crash.
 */
(function () {
  'use strict';

  var VERSION = '1.50.182';
  if (window.__antcvHeadingRuleToken === VERSION) return;
  window.__antcvHeadingRuleToken = VERSION;

  var TAG = 'data-antcv-heading-rule-token';
  var DISABLE = 'antcv:disable-heading-rule-token';

  function disabled() {
    try { var v = localStorage.getItem(DISABLE); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }

  function unwrap(raw, fallback) {
    if (raw == null) return fallback;
    var s = String(raw).trim();
    if (s.charAt(0) === '"') { try { s = JSON.parse(s); } catch (_) {} }
    s = String(s).trim();
    return s || fallback;
  }

  // The heading rule colour the preview bakes. app.js derives it from the
  // user's mainHeadColor; default is the same #1B627F navy the band uses.
  function readHeadColor() {
    var c;
    try { c = unwrap(localStorage.getItem('mainHeadColor'), ''); } catch (_) { c = ''; }
    if (!c) { try { c = unwrap(localStorage.getItem('navyColor'), ''); } catch (_) {} }
    return c || '#1B627F';
  }

  // The candidate band colour we want the rule to match.
  function readHeaderBg() {
    var c;
    try { c = unwrap(localStorage.getItem('headerBg'), ''); } catch (_) { c = ''; }
    if (!c) { try { c = unwrap(localStorage.getItem('navyColor'), ''); } catch (_) {} }
    return c || '#1B627F';
  }

  function hexToRgbString(hex) {
    var h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  }

  function findPaper() { return document.querySelector('.antcv-preview-paper'); }

  // Is el inside the sidebar subtree? We must NOT retint sidebar heading rules.
  function inSidebar(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      if (n.classList && (
        n.classList.contains('antcv-document-sidebar') ||
        n.classList.contains('antcv-sidebar')
      )) return true;
      // Fallback: a data attribute some bundles set on the sidebar cell.
      if (n.getAttribute && n.getAttribute('data-antcv-col') === 'sidebar') return true;
      n = n.parentElement;
    }
    return false;
  }

  function applyOnce() {
    if (disabled()) return;
    var paper = findPaper();
    if (!paper) return;
    var headRgb = hexToRgbString(readHeadColor());
    if (!headRgb) return;
    var headerBg = readHeaderBg();
    var tokenValue = 'var(--header-bg, ' + headerBg + ')';

    var els = paper.querySelectorAll('div, td, th, h1, h2, h3, h4, p, span');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute(TAG) === '1') continue;
      if (inSidebar(el)) continue;
      var cs;
      try { cs = window.getComputedStyle(el); } catch (_) { continue; }
      // Only elements that actually draw a bottom rule in the heading colour.
      if (!cs) continue;
      var bw = parseFloat(cs.borderBottomWidth || '0');
      if (!(bw > 0)) continue;
      if (cs.borderBottomStyle === 'none') continue;
      if (cs.borderBottomColor !== headRgb) continue;
      try {
        el.style.setProperty('border-bottom-color', tokenValue, 'important');
        el.setAttribute(TAG, '1');
      } catch (_) {}
    }
  }

  function retag() {
    // Clear tags so a colour change re-matches against the new value.
    try {
      var p = findPaper();
      if (p) Array.prototype.forEach.call(p.querySelectorAll('[' + TAG + '="1"]'),
        function (el) { el.removeAttribute(TAG); });
    } catch (_) {}
  }

  var pending = null;
  function schedule() {
    if (pending != null) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      try { applyOnce(); } catch (e) {
        try { console.warn('[antcv-heading-rule-token] apply failed', e); } catch (_) {}
      }
    });
  }

  function boot() {
    schedule();
    try {
      var obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['style', 'class', 'data-package'],
      });
    } catch (_) {}
    window.addEventListener('antcv:package-changed', function () { retag(); schedule(); });
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('storage', function (ev) {
      if (ev && (ev.key === 'navyColor' || ev.key === 'headerBg' || ev.key === 'mainHeadColor' || ev.key === 'personalInfo')) {
        retag(); schedule();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AntcvHeadingRuleToken = {
    version: VERSION,
    apply: applyOnce,
    _readHeadColor: readHeadColor,
    _readHeaderBg: readHeaderBg,
  };
})();
