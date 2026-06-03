/* AntCV page-break help-text + icon sweep (v1.40.357-pb005)
 * ============================================================
 *
 * PB-005 + TB-003 (the non-button remainder)
 * ------------------------------------------
 * antcv-row-controls-wording-341.js already rewrites
 * "Compress" -> "Fit" on row-control BUTTONS (title,
 * aria-label, pure-text). Two gaps from the spec remain:
 *
 *   (a) PB-005 / TB-003: help text, captions, legends, and
 *       table hint lines can still read "compress" and can
 *       still describe the page-break action with a down
 *       arrow. These are not <button>s, so the 341 sweep
 *       skips them.
 *   (b) PB-005 / GEN-003: the page-break control glyph itself
 *       can be a downward arrow. The spec requires a semantic
 *       page-change symbol, never a down arrow.
 *
 * This sidecar handles both, additively and conservatively.
 *
 * Behaviour
 * ---------
 *   1. Wording sweep on NON-button leaf text nodes in the
 *      editor (small, figcaption, legend, label, .antcv-hint,
 *      .antcv-help, p, span, li) — rewrites "Compress"/"Comp."
 *      to "Fit" preserving case. Leaf-only (no element
 *      children) so we never collapse nested DOM.
 *
 *   2. Page-break icon swap: ONLY on elements positively
 *      identified as page-break controls — i.e. an element
 *      carrying one of the page-break data-attributes, OR whose
 *      title / aria-label mentions "page break" / "page-break".
 *      On such an element (and its leaf descendants) any
 *      down-arrow glyph is replaced with the semantic page
 *      glyph U+2398 (next page). Down arrows ANYWHERE ELSE are
 *      left untouched — this never rewrites a generic arrow.
 *
 * Scope + safety
 * --------------
 *   - Editor-panel scope: never inside .antcv-preview-paper.
 *   - Leaf-only text edits; idempotent per-node marker.
 *   - Glyphs matched/produced via String.fromCharCode — no \u
 *     escapes anywhere (house rule).
 *   - No \s regex literals.
 *   - No layout, ordering, or structural changes (PP-003 safe).
 *
 * Glyph reference (built without \u):
 *   down arrows handled: 2193, 2B07, 21E9, 2913, 21E3, 25BC, FE0F
 *   semantic page glyph: 2398  (next page)
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.357-pb005';
  if (window.__antcvPageBreakHelpIcon357 === SCRIPT_VERSION) return;
  window.__antcvPageBreakHelpIcon357 = SCRIPT_VERSION;

  var MARK_TEXT = 'data-antcv-pb-help-fixed';
  var MARK_ICON = 'data-antcv-pb-icon-fixed';

  var cc = String.fromCharCode;
  var PAGE_GLYPH = cc(0x2398);           // next-page symbol
  var DOWN_ARROWS = [0x2193, 0x2B07, 0x21E9, 0x2913, 0x21E3, 0x25BC].map(cc);
  var VS16 = cc(0xFE0F);                 // emoji variation selector

  function previewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function rewriteCompressToFit(s) {
    if (!s || typeof s !== 'string') return s;
    var out = s;
    out = out.replace(/Compress/g, 'Fit');
    out = out.replace(/compress/g, 'fit');
    out = out.replace(/COMPRESS/g, 'FIT');
    out = out.replace(/Comp\./g, 'Fit');
    out = out.replace(/comp\./g, 'fit');
    return out;
  }

  // ---- (1) wording on non-button leaf text nodes -------------
  var TEXT_SEL = [
    'small', 'figcaption', 'legend', 'label',
    '.antcv-hint', '.antcv-help', '.antcv-caption', '.antcv-legend',
    'p', 'span', 'li'
  ].join(',');

  function sweepHelpText() {
    var paper = previewPaper();
    var nodes;
    try { nodes = document.querySelectorAll(TEXT_SEL); } catch (_) { return 0; }
    var fixed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.isConnected) continue;
      if (el.getAttribute(MARK_TEXT) === '1') continue;
      if (el.tagName === 'BUTTON') continue;           // 341 owns buttons
      if (paper && paper.contains(el)) continue;        // editor only
      if (el.children && el.children.length > 0) continue; // leaf only
      var tc = el.textContent || '';
      if (!/[Cc]omp/.test(tc)) continue;
      var ntc = rewriteCompressToFit(tc);
      if (ntc !== tc) {
        el.textContent = ntc;
        el.setAttribute(MARK_TEXT, '1');
        fixed++;
      }
    }
    return fixed;
  }

  // ---- (2) page-break icon swap on identified controls -------
  function isPageBreakControl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute('data-antcv-page-break') ||
        el.hasAttribute('data-page-break') ||
        el.hasAttribute('data-antcv-pagebreak')) return true;
    var t = (el.getAttribute && (el.getAttribute('title') || '')) || '';
    var a = (el.getAttribute && (el.getAttribute('aria-label') || '')) || '';
    var hay = (t + ' ' + a).toLowerCase();
    if (hay.indexOf('page break') >= 0) return true;
    if (hay.indexOf('page-break') >= 0) return true;
    if (hay.indexOf('next page') >= 0 && hay.indexOf('move') >= 0) return true;
    return false;
  }

  function swapArrowsInText(s) {
    if (!s || typeof s !== 'string') return s;
    var out = s, changed = false;
    for (var k = 0; k < DOWN_ARROWS.length; k++) {
      var arrow = DOWN_ARROWS[k];
      if (out.indexOf(arrow) >= 0) {
        // strip a trailing emoji variation selector if present
        out = out.split(arrow + VS16).join(PAGE_GLYPH);
        out = out.split(arrow).join(PAGE_GLYPH);
        changed = true;
      }
    }
    return changed ? out : s;
  }

  function swapIconOnControl(ctrl) {
    if (ctrl.getAttribute(MARK_ICON) === '1') return false;
    var changed = false;
    // The glyph may live in the control's own text or in a leaf
    // child (icon span). Walk leaf descendants + the control.
    var targets = [ctrl];
    var kids = ctrl.querySelectorAll ? ctrl.querySelectorAll('*') : [];
    for (var i = 0; i < kids.length; i++) {
      if (!kids[i].children || kids[i].children.length === 0) targets.push(kids[i]);
    }
    for (var t = 0; t < targets.length; t++) {
      var el = targets[t];
      if (el.children && el.children.length > 0) continue; // leaf text only
      var tc = el.textContent || '';
      var ntc = swapArrowsInText(tc);
      if (ntc !== tc) { el.textContent = ntc; changed = true; }
    }
    // Also clean title/aria mention of a "down arrow" wording.
    if (changed) ctrl.setAttribute(MARK_ICON, '1');
    return changed;
  }

  function sweepIcons() {
    var paper = previewPaper();
    // Identified controls only: scan buttons + role=button + the
    // data-attr carriers. Narrow on purpose.
    var sel = 'button,[role="button"],[data-antcv-page-break],[data-page-break],[data-antcv-pagebreak]';
    var nodes;
    try { nodes = document.querySelectorAll(sel); } catch (_) { return 0; }
    var fixed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.isConnected) continue;
      if (paper && paper.contains(el)) continue;
      if (!isPageBreakControl(el)) continue;
      try { if (swapIconOnControl(el)) fixed++; } catch (_) {}
    }
    return fixed;
  }

  function sweepAll() {
    var a = 0, b = 0;
    try { a = sweepHelpText(); } catch (_) {}
    try { b = sweepIcons(); } catch (_) {}
    if (a || b) {
      try { console.debug('[pb-help-icon] help-text', a, 'icon', b); } catch (_) {}
    }
    return a + b;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepAll(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1500, 3000, 6000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(function (records) {
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (rec.type === 'attributes' &&
            (rec.attributeName === MARK_TEXT || rec.attributeName === MARK_ICON)) continue;
        meaningful = true; break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['title', 'aria-label'],
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvPageBreakHelpIcon357 = {
    version: SCRIPT_VERSION,
    sweepAll: sweepAll,
    sweepHelpText: sweepHelpText,
    sweepIcons: sweepIcons,
    _swapArrowsInText: swapArrowsInText,
    _isPageBreakControl: isPageBreakControl,
  };

  try { console.debug('[pb-help-icon] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
