/* AntCV row-controls wording sweep (v1.40.341-p1b)
 * ============================================================
 *
 * P1-B partial — GEN-004 wording in row controls
 * ----------------------------------------------
 * Acceptance per plan §4.6:
 *   TB-003: "Update visible help text: describe the actual
 *           controls (hide where supported, Fit, Enhance, CJLR,
 *           Page Break). No 'compress' wording."
 *   PP-003 (HIGH-RISK): "Refactor Publications & Patent controls
 *           ONLY through the shared row-control model. No ad-hoc
 *           absolute positioning. No duplicated render paths.
 *           Buttons remain row-bound, ordered, and stable through
 *           long text, many rows, narrow widths, route changes,
 *           hard refresh, and while generation status is active."
 *
 * Scope decision (see docs/plan/PP-003-regression-history.md)
 * ----------------------------------------------------------
 * Publications row-controls have seven prior iterations that
 * failed and were removed; the eighth (the current 273 + 278
 * pair) is finally stable. Per PP-003's HIGH-RISK warning,
 * touching the layout primitives now risks an eighth regression.
 *
 * This P1-B deliberately scopes to the SAFEST subset that still
 * advances the plan: sweep user-facing "Compress" wording out
 * of every row-control title / aria-label / button text in the
 * editor panel. Layout, positioning, ordering, and the existing
 * sidecars' state machines are untouched.
 *
 * Out of scope for this PR
 * ------------------------
 * The full SectionControlBar.mount() migration for table /
 * outcome / publication rows is documented as a follow-up. The
 * SO-001 / TB-001..002 / PP-001..002 acceptance criteria are
 * already mostly met by the existing per-section sidecars
 * (CJLR per line, per-row Page Break, etc.) — they just emit
 * the wrong word ("Compress") which this sidecar fixes.
 *
 * Behaviour
 * ---------
 *   1. On every tick (MutationObserver + delayed sweeps), find
 *      every button whose visible text, title, OR aria-label
 *      contains "compress" / "Compress" / "Comp." (loose
 *      match: any of these substrings; case-insensitive).
 *   2. Replace the offending substring with "Fit" / "fit" /
 *      "Fit" preserving case style.
 *   3. Skip elements with a prior-pass marker
 *      (data-antcv-row-wording-fixed) to keep the sweep O(new
 *      elements) per tick.
 *   4. Operate ONLY in editor panels — never inside
 *      .antcv-preview-paper (the Preview never gets a
 *      "Compress" button; if it does that's CL-001's domain).
 *
 * Hazards
 * -------
 *   - No \s in regex literals.
 *   - No \u escapes.
 *   - Idempotency: per-element marker + check.
 *   - PP-003: this sidecar does NOT add positioning, ordering,
 *     or DOM-structure changes. Layout is owned by the
 *     existing row-control sidecars and is untouched.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p1b';
  if (window.__antcvRowControlsWording341 === SCRIPT_VERSION) return;
  window.__antcvRowControlsWording341 = SCRIPT_VERSION;

  var MARK = 'data-antcv-row-wording-fixed';

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

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepButtons(); } catch (_) {}
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
        if (rec.type === 'attributes' && rec.attributeName === MARK) continue;
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
    _rewriteCompressToFit: rewriteCompressToFit,
  };

  try { console.debug('[row-controls-wording] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
