/* AntCV help-text wording sweep (v1.40.357-p1b2)
 * ============================================================
 *
 * GEN-004 / TB-003 / PB-005 — non-button "Compress" wording
 * ---------------------------------------------------------
 * antcv-row-controls-wording-341.js already rewrites "Compress"
 * to "Fit" on every editor BUTTON (title, aria-label, pure-text
 * label). But the spec also calls out help text, legends, and
 * captions that still say "compress" / use older arrow wording:
 *
 *   TB-003: "Update visible help text to describe the actual
 *            controls (hide where supported, Fit, Enhance, CJLR,
 *            Page Break). Do not call Fit 'compress'."
 *   PB-005: "Update help text, tooltip, accessible label, and
 *            any visible legend. Replace Compress with Fit."
 *
 * Those strings live in <small>, <figcaption>, <legend>,
 * <label>, and helper <span>/<p> nodes — not <button> — so the
 * 341 sweep never touches them. This sidecar covers exactly that
 * gap and nothing else.
 *
 * Behaviour
 * ---------
 *   1. On every tick (rAF-debounced + delayed sweeps +
 *      MutationObserver), find editor-panel leaf nodes that are
 *      help/caption/legend/label text and whose textContent
 *      contains a "compress" variant.
 *   2. Rewrite "Compress"/"compress"/"COMPRESS"/"Comp."/"comp."
 *      to the matching "Fit" case, preserving surrounding text.
 *   3. Skip Preview (.antcv-preview-paper) entirely.
 *   4. Leaf-only: never rewrite a node that has element
 *      children (avoids collapsing nested DOM / breaking
 *      listeners). Per-element marker for idempotency.
 *
 * Hazards
 * -------
 *   - No \s in regex literals.
 *   - No \u escapes.
 *   - PP-003 safety: pure text rewrite, no layout/positioning
 *     or DOM-structure change.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.357-p1b2';
  if (window.__antcvHelpTextWording357 === SCRIPT_VERSION) return;
  window.__antcvHelpTextWording357 = SCRIPT_VERSION;

  var MARK = 'data-antcv-help-wording-fixed';

  // Candidate help/caption/legend/label selectors. Buttons are
  // intentionally excluded — they are owned by the 341 sweep.
  var SEL = [
    'small', 'figcaption', 'legend', 'label',
    '.antcv-help', '.antcv-hint', '.antcv-help-text',
    '.antcv-legend', '.antcv-caption', '.antcv-row-hint',
    '[data-antcv-help]', '[data-antcv-hint]',
  ].join(',');

  function findPreviewPaper() {
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

  function isLeafText(el) {
    // Leaf = no element children. Text-only nodes are safe to
    // rewrite via textContent without collapsing structure.
    if (!el || el.nodeType !== 1) return false;
    return el.children == null || el.children.length === 0;
  }

  function sweepHints() {
    var paper = findPreviewPaper();
    var nodes = document.querySelectorAll(SEL);
    var fixed = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.isConnected) continue;
      if (n.getAttribute(MARK) === '1') continue;
      if (paper && paper.contains(n)) continue; // editor scope only
      if (!isLeafText(n)) continue;
      var tc = n.textContent || '';
      if (!/[Cc]omp/.test(tc)) continue;
      var ntc = rewriteCompressToFit(tc);
      if (ntc !== tc) {
        n.textContent = ntc;
        n.setAttribute(MARK, '1');
        fixed++;
      } else {
        // No actual change (matched "comp" inside an unrelated
        // word) — mark anyway so we don't re-test every tick.
        n.setAttribute(MARK, '1');
      }
    }
    if (fixed > 0) {
      try { console.debug('[help-text-wording] rewrote', fixed, 'node(s)'); } catch (_) {}
    }
    return fixed;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepHints(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1500, 3000, 6000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(function (records) {
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        if (records[r].type === 'attributes' && records[r].attributeName === MARK) continue;
        meaningful = true;
        break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvHelpTextWording357 = {
    version: SCRIPT_VERSION,
    sweepHints: sweepHints,
    _rewriteCompressToFit: rewriteCompressToFit,
  };

  try { console.debug('[help-text-wording] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
