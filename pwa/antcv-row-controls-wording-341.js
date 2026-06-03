/* AntCV row-controls wording sweep (v1.40.357-p1b2)
 * ============================================================
 *
 * P1-B partial — GEN-004 / TB-003 / PB-005 wording
 * ------------------------------------------------
 * Acceptance per plan §4.6:
 *   TB-003: "Update visible help text: describe the actual
 *           controls (hide where supported, Fit, Enhance, CJLR,
 *           Page Break). No 'compress' wording."
 *   PB-005: "Update help text, tooltip, accessible label, and any
 *           visible legend. Replace Compress with Fit."
 *   PP-003 (HIGH-RISK): "Refactor Publications & Patent controls
 *           ONLY through the shared row-control model. No ad-hoc
 *           absolute positioning. No duplicated render paths."
 *
 * What changed in p1b2 (this revision)
 * ------------------------------------
 * The original p1b swept only <button> elements (text / title /
 * aria-label). TB-003 and PB-005 also call out *help text* and
 * *visible legends* that are NOT buttons — short hint/caption
 * nodes near the row controls that still say "compress". This
 * revision adds a SECOND, equally conservative sweep over those
 * help/legend text nodes:
 *
 *   - Only leaf elements (no child elements) whose tag is a known
 *     hint/caption/label container, OR which carry a hint-like
 *     class/role. We never rewrite a node that has element
 *     children (would risk collapsing structure / breaking
 *     listeners) — same rule the button sweep already follows.
 *   - Editor-panel scope only: never inside .antcv-preview-paper.
 *   - Same idempotent per-element marker + loose [Cc]omp gate.
 *
 * Layout, positioning, ordering, and every existing sidecar's
 * state machine remain untouched (PP-003 safety).
 *
 * Out of scope for this PR
 * ------------------------
 * The full SectionControlBar.mount() migration and the Page-Break
 * ICON swap (down-arrow -> page glyph) are handled elsewhere
 * (icon swap: antcv-page-break-icon-357.js). This file is wording
 * only.
 *
 * Hazards
 * -------
 *   - No \s in regex literals.
 *   - No \u escapes.
 *   - Idempotency: per-element marker + check.
 *   - PP-003: no positioning / ordering / DOM-structure changes.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.357-p1b2';
  if (window.__antcvRowControlsWording341 === SCRIPT_VERSION) return;
  window.__antcvRowControlsWording341 = SCRIPT_VERSION;

  var MARK = 'data-antcv-row-wording-fixed';
  var MARK_HINT = 'data-antcv-hint-wording-fixed';

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Loose case-insensitive substring rewrite. We don't use \b
  // boundaries — the editor button titles are short and
  // controlled; the broad sweep is safer than missing variants.
  function rewriteCompressToFit(s) {
    if (!s || typeof s !== 'string') return s;
    var out = s;
    // Cycle through case variants. Preserve the case of the
    // FIRST letter where present, lowercase elsewhere.
    out = out.replace(/Compress/g, 'Fit');
    out = out.replace(/compress/g, 'fit');
    out = out.replace(/COMPRESS/g, 'FIT');
    out = out.replace(/Comp\./g, 'Fit');
    out = out.replace(/comp\./g, 'fit');
    return out;
  }

  function sweepButtons() {
    var paper = findPreviewPaper();
    var buttons = document.querySelectorAll('button');
    var fixed = 0;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!b.isConnected) continue;
      if (b.getAttribute(MARK) === '1') continue;
      // Editor-panel scope only.
      if (paper && paper.contains(b)) continue;
      var changed = false;
      // Title
      var t = b.getAttribute && b.getAttribute('title');
      if (t && /[Cc]omp/.test(t)) {
        var nt = rewriteCompressToFit(t);
        if (nt !== t) { b.setAttribute('title', nt); changed = true; }
      }
      // aria-label
      var al = b.getAttribute && b.getAttribute('aria-label');
      if (al && /[Cc]omp/.test(al)) {
        var nal = rewriteCompressToFit(al);
        if (nal !== al) { b.setAttribute('aria-label', nal); changed = true; }
      }
      // Visible textContent — only when the button has NO child
      // elements (pure text). Modifying nested DOM textContent
      // would collapse children and break event listeners.
      if (b.children && b.children.length === 0) {
        var tc = b.textContent || '';
        if (/[Cc]omp/.test(tc)) {
          var ntc = rewriteCompressToFit(tc);
          if (ntc !== tc) { b.textContent = ntc; changed = true; }
        }
      }
      if (changed) {
        b.setAttribute(MARK, '1');
        fixed++;
      }
    }
    if (fixed > 0) {
      try { console.debug('[row-controls-wording] rewrote', fixed, 'button(s)'); } catch (_) {}
    }
    return fixed;
  }

  // p1b2: help-text / legend sweep. Targets short hint/caption/label
  // leaf nodes that still say "compress" but are NOT buttons (TB-003,
  // PB-005 "visible legend"). Conservative: leaf-only (no element
  // children), editor-scoped, idempotent, title/aria-label included.
  var HINT_SELECTOR = [
    'small',
    'figcaption',
    'legend',
    'label',
    '.antcv-help',
    '.antcv-hint',
    '.antcv-help-text',
    '.antcv-controls-help',
    '.antcv-legend',
    '[data-antcv-help]',
    '[data-antcv-hint]',
    '[role="note"]',
  ].join(',');

  function sweepHints() {
    var paper = findPreviewPaper();
    var nodes;
    try { nodes = document.querySelectorAll(HINT_SELECTOR); }
    catch (_) { return 0; }
    var fixed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.isConnected) continue;
      if (el.getAttribute(MARK_HINT) === '1') continue;
      if (paper && paper.contains(el)) continue;
      // Leaf-only: never touch a node that has element children, to
      // avoid collapsing structure or breaking listeners.
      if (el.children && el.children.length > 0) continue;
      var changed = false;
      // title
      var t = el.getAttribute && el.getAttribute('title');
      if (t && /[Cc]omp/.test(t)) {
        var nt = rewriteCompressToFit(t);
        if (nt !== t) { el.setAttribute('title', nt); changed = true; }
      }
      // aria-label
      var al = el.getAttribute && el.getAttribute('aria-label');
      if (al && /[Cc]omp/.test(al)) {
        var nal = rewriteCompressToFit(al);
        if (nal !== al) { el.setAttribute('aria-label', nal); changed = true; }
      }
      // visible text (leaf only)
      var tc = el.textContent || '';
      if (/[Cc]omp/.test(tc)) {
        var ntc = rewriteCompressToFit(tc);
        if (ntc !== tc) { el.textContent = ntc; changed = true; }
      }
      if (changed) {
        el.setAttribute(MARK_HINT, '1');
        fixed++;
      }
    }
    if (fixed > 0) {
      try { console.debug('[row-controls-wording] rewrote', fixed, 'hint/legend node(s)'); } catch (_) {}
    }
    return fixed;
  }

  function sweepAll() {
    var n = 0;
    try { n += sweepButtons(); } catch (_) {}
    try { n += sweepHints(); } catch (_) {}
    return n;
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
      // Filter: schedule only on additions / title-changes. We
      // ignore mutations whose only effect was setting our own
      // marker (avoid feedback loop).
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (rec.type === 'attributes' &&
            (rec.attributeName === MARK || rec.attributeName === MARK_HINT)) continue;
        meaningful = true;
        break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['title', 'aria-label'],
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvRowControlsWording341 = {
    version: SCRIPT_VERSION,
    sweepButtons: sweepButtons,
    sweepHints: sweepHints,
    sweep: sweepAll,
    _rewriteCompressToFit: rewriteCompressToFit,
  };

  try { console.debug('[row-controls-wording] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
