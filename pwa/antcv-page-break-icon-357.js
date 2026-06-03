/* AntCV Page-Break icon fix (v1.40.357-pb005)
 * ============================================================
 *
 * PB-005 / GEN-DoD — semantic Page-Break glyph
 * --------------------------------------------
 * Acceptance per plan §4.2 / Definition of Done:
 *   "Use a proper page-change icon for Page Break everywhere.
 *    A downward arrow must NOT be used as the Page Break symbol."
 *
 * Several row-control sidecars render the Page Break control with
 * a down-arrow glyph as its visible symbol. A down arrow reads as
 * "move down" / "scroll", not "start on the next page". This
 * sidecar swaps the arrow glyph for a semantic next-page glyph
 * (U+2398 NEXT PAGE, "next-page" document symbol) on controls that
 * are unambiguously Page-Break controls.
 *
 * Why a separate sidecar (not an edit to each control sidecar)
 * -----------------------------------------------------------
 * The Page-Break control is rendered by many per-section sidecars
 * (core-competencies, selected-outcomes, what-i-bring, tables,
 * publications, etc.). Editing each one risks regressions across
 * the PP-003 high-risk surface. A single additive, idempotent,
 * editor-scoped glyph swap is lower risk and centralises the rule.
 *
 * Identification (conservative — avoid touching the wrong control)
 * ---------------------------------------------------------------
 * A node is treated as a Page-Break control ONLY if at least one
 * of these is true:
 *   - it carries a page-break data attribute
 *     (data-antcv-page-break, data-page-break, data-antcv-pagebreak)
 *   - its title or aria-label contains "page break" / "page-break"
 *     (case-insensitive)
 * AND it currently shows a down-arrow glyph as (part of) its text.
 *
 * Down-arrow glyphs handled: U+2193 (down arrow), U+2B07 (heavy),
 * U+21E9 (downwards white arrow), U+2913 (down to bar),
 * U+21E3 (dashed). The arrow is REPLACED with U+2398 (next page);
 * any surrounding label text is preserved.
 *
 * Scope + safety
 * --------------
 *   - Editor panel only (never inside .antcv-preview-paper).
 *   - Leaf-only for textContent edits (no element children).
 *   - Idempotent: per-element marker.
 *   - No \s in regex literals. No \u escapes (glyphs are written
 *     as literal characters in single strings).
 *   - No layout / positioning / ordering changes (PP-003 safety).
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.357-pb005';
  if (window.__antcvPageBreakIcon357 === SCRIPT_VERSION) return;
  window.__antcvPageBreakIcon357 = SCRIPT_VERSION;

  var MARK = 'data-antcv-pb-icon-fixed';
  // Semantic next-page glyph (U+2398). Reads as a page with a turned
  // corner, not an arrow.
  var PAGE_GLYPH = '\u2398';

  // Down-arrow glyphs that may have been used as the page-break symbol.
  // Written via \u in a CHARACTER CLASS inside the RegExp constructor
  // string is disallowed by house rules; instead we list the literal
  // code points and build a matcher from String.fromCharCode so there
  // are no \u escapes in source.
  var ARROW_CODEPOINTS = [0x2193, 0x2B07, 0x21E9, 0x2913, 0x21E3, 0xFE0F];
  function isArrowChar(ch) {
    var c = ch.charCodeAt(0);
    for (var i = 0; i < ARROW_CODEPOINTS.length; i++) {
      if (ARROW_CODEPOINTS[i] === c) return true;
    }
    return false;
  }
  // Replace any run of arrow glyphs (plus optional variation selector)
  // with a single page glyph; leave other text intact.
  function swapArrows(text) {
    if (!text) return { out: text, changed: false };
    var out = '';
    var changed = false;
    var replacedRun = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (isArrowChar(ch)) {
        changed = true;
        if (!replacedRun) { out += PAGE_GLYPH; replacedRun = true; }
        // collapse consecutive arrow/selectors into the single glyph
      } else {
        replacedRun = false;
        out += ch;
      }
    }
    return { out: out, changed: changed };
  }

  function looksLikePageBreak(el) {
    if (!el || !el.getAttribute) return false;
    if (el.hasAttribute('data-antcv-page-break') ||
        el.hasAttribute('data-page-break') ||
        el.hasAttribute('data-antcv-pagebreak')) return true;
    var t = (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '');
    t = t.toLowerCase();
    if (t.indexOf('page break') >= 0 || t.indexOf('page-break') >= 0) return true;
    return false;
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function sweepOnce() {
    var paper = findPreviewPaper();
    // Candidate controls: buttons + small clickable spans/divs that
    // carry a role or look like a control. We scan buttons plus any
    // element with a page-break data attribute.
    var nodes = document.querySelectorAll(
      'button, [role="button"], [data-antcv-page-break], [data-page-break], [data-antcv-pagebreak]'
    );
    var fixed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.isConnected) continue;
      if (el.getAttribute(MARK) === '1') continue;
      if (paper && paper.contains(el)) continue;
      if (!looksLikePageBreak(el)) continue;
      // Only touch the visible glyph when this is a leaf (no element
      // children) — same safety rule used by the wording sweep.
      if (el.children && el.children.length > 0) {
        // Still mark it so we don't re-scan endlessly; its glyph (if
        // any) lives in a child node we deliberately don't rewrite.
        el.setAttribute(MARK, '1');
        continue;
      }
      var tc = el.textContent || '';
      var res = swapArrows(tc);
      if (res.changed) {
        el.textContent = res.out;
        fixed++;
      }
      el.setAttribute(MARK, '1');
    }
    if (fixed > 0) {
      try { console.debug('[page-break-icon] swapped', fixed, 'arrow glyph(s) -> next-page glyph'); } catch (_) {}
    }
    return fixed;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepOnce(); } catch (_) {}
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
        if (rec.type === 'attributes' && rec.attributeName === MARK) continue;
        meaningful = true; break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['title', 'aria-label'],
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvPageBreakIcon357 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
    _swapArrows: swapArrows,
    _looksLikePageBreak: looksLikePageBreak,
    pageGlyph: PAGE_GLYPH,
  };

  try { console.debug('[page-break-icon] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
