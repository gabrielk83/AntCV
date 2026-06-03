/* AntCV validation-severity consumer (v1.40.357-val001c)
 * ============================================================
 *
 * VAL-001 + VF-016 + GEN-010 (consumer half)
 * ------------------------------------------
 * antcv-validation-severity-341.js already:
 *   - defines the CSS tokens (--antcv-validation-error #dc2626,
 *     --antcv-validation-warning #d97706) and the
 *     [data-antcv-severity="error"|"warning"] rules, and
 *   - re-broadcasts the audits as a single CustomEvent
 *     `antcv:validation-severity` with detail = { source,
 *     severity, hits|signals, ariaText }.
 *
 * What was missing is the CONSUMER: nothing applied the
 * data-antcv-severity attribute to the rendered Set-menu
 * validation nodes, so warnings and errors still looked the
 * same (both red) per VF-016. This sidecar closes that gap
 * additively, without editing the token sidecar or app.js.
 *
 * Behaviour
 * ---------
 *   1. Listens for `antcv:validation-severity`. On each event,
 *      sweeps the Set-menu validation surface and tags every
 *      matching message node with the right severity, so the
 *      existing CSS tokens colour it (warning = yellow,
 *      error = red).
 *   2. Classification is content-based and conservative:
 *        - a node whose own text starts with / contains a
 *          leading "warning" marker is a warning;
 *        - a node that contains a leading "error"/"required"/
 *          "missing" marker is an error;
 *        - otherwise the node is left untouched (we never guess).
 *      The event's `severity` is used as the default when a
 *      node is clearly a validation message but carries no
 *      explicit error/warning word.
 *   3. Editor/Set-menu scope only. Never touches
 *      .antcv-preview-paper (the rendered document must not get
 *      severity tint).
 *   4. Idempotent: a per-node marker
 *      (data-antcv-severity-applied) plus a value check means
 *      re-sweeps are O(new nodes). Re-tagging only happens when
 *      the derived severity actually changes.
 *
 * Why content-based and not selector-based
 * ----------------------------------------
 * The Set-menu validation list is rendered by the minified
 * app.js / react-islands bundle, so its class names are not
 * stable across builds. Matching on the visible severity word
 * (which the product controls and localizes) is more robust
 * than guessing a class, and it fails safe: if a node doesn't
 * clearly read as a warning or an error, we leave it alone.
 *
 * Hazards
 * -------
 *   - No \s in regex literals (character classes spelled out).
 *   - No \u escapes.
 *   - Idempotent per-node marker + value check.
 *   - No layout, structure, ordering, or positioning changes.
 *   - Reads textContent only; never rewrites node text.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.357-val001c';
  if (window.__antcvValidationSeverityConsumer357 === SCRIPT_VERSION) return;
  window.__antcvValidationSeverityConsumer357 = SCRIPT_VERSION;

  var MARK = 'data-antcv-severity-applied';

  // Lowercase leading-word matchers. We deliberately avoid \s;
  // [ \t] covers the practical whitespace after the marker word.
  var WARNING_RE = /(^|[ \t>():-])(warning|warn|advisory|caution)([ \t:!.)-]|$)/i;
  var ERROR_RE = /(^|[ \t>():-])(error|errors|required|missing|blocking|invalid)([ \t:!.)-]|$)/i;

  function previewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Decide a severity for a node from its own short text. Returns
  // 'error', 'warning', or '' (leave alone).
  function deriveSeverity(text, fallback) {
    if (!text || typeof text !== 'string') return '';
    // Guard against huge blocks: validation messages are short.
    if (text.length > 240) return '';
    var t = text;
    var isErr = ERROR_RE.test(t);
    var isWarn = WARNING_RE.test(t);
    if (isErr && !isWarn) return 'error';
    if (isWarn && !isErr) return 'warning';
    if (isErr && isWarn) {
      // Both words present: trust the explicit "error" lead if it
      // appears first, else fall back to the event severity.
      var ie = t.toLowerCase().indexOf('error');
      var iw = t.toLowerCase().indexOf('warn');
      if (ie >= 0 && (iw < 0 || ie < iw)) return 'error';
      return 'warning';
    }
    // No explicit word — only apply the event's fallback severity
    // to nodes that look like a small validation pill/row. We use
    // a light heuristic: a leaf-ish node (few children) with short
    // text. Otherwise leave alone.
    return fallback === 'error' || fallback === 'warning' ? fallback : '';
  }

  // Candidate validation nodes: small, leaf-ish elements that are
  // NOT inside the preview paper. We look at common message roles
  // plus generic leaf elements that carry an explicit word.
  function candidateNodes() {
    var sel = [
      '[role="alert"]',
      '[role="status"]',
      '[data-antcv-validation]',
      '[data-antcv-severity]',
      '.antcv-validation',
      '.antcv-validation-item',
      '.antcv-set-validation',
      'li', 'small', 'span', 'p'
    ].join(',');
    var all;
    try { all = document.querySelectorAll(sel); } catch (_) { return []; }
    return all;
  }

  function applyTo(node, fallback) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    var paper = previewPaper();
    if (paper && paper.contains(node)) return false;
    // Only consider leaf-ish nodes to avoid tinting whole panels.
    if (node.children && node.children.length > 4) return false;
    var text = (node.textContent || '');
    var sev = deriveSeverity(text, fallback);
    if (!sev) return false;
    // For the fallback-only path (no explicit word), require the
    // node to actually be a plausible message: short text, and an
    // explicit word somewhere OR a known validation attribute/role.
    var hasWord = WARNING_RE.test(text) || ERROR_RE.test(text);
    var looksValidation =
      node.hasAttribute('data-antcv-validation') ||
      node.getAttribute('role') === 'alert' ||
      node.getAttribute('role') === 'status' ||
      /antcv-(set-)?validation/.test(node.className || '');
    if (!hasWord && !looksValidation) return false;
    if (node.getAttribute('data-antcv-severity') === sev &&
        node.getAttribute(MARK) === '1') return false;
    node.setAttribute('data-antcv-severity', sev);
    node.setAttribute(MARK, '1');
    return true;
  }

  function sweep(fallback) {
    var nodes = candidateNodes();
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      try { if (applyTo(nodes[i], fallback)) n++; } catch (_) {}
    }
    if (n > 0) {
      try { console.debug('[validation-severity-consumer] tagged', n, 'node(s)'); } catch (_) {}
    }
    return n;
  }

  var pending = false;
  var lastFallback = '';
  function schedule(fallback) {
    if (fallback) lastFallback = fallback;
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweep(lastFallback); } catch (_) {}
    });
  }

  function onSeverityEvent(ev) {
    var det = ev && ev.detail;
    var fallback = det && det.severity === 'error' ? 'error'
                 : det && det.severity === 'warning' ? 'warning' : '';
    schedule(fallback);
  }

  function install() {
    window.addEventListener('antcv:validation-severity', onSeverityEvent, false);
    // Also react to the raw audit events in case the token
    // sidecar's re-broadcast is ever absent.
    window.addEventListener('antcv:banned-hits', function () { schedule('warning'); }, false);
    window.addEventListener('antcv:sections-updated', function () { schedule(''); }, false);

    // Initial + delayed sweeps (Set menu may mount after load).
    schedule('');
    var delays = [300, 800, 1800, 3500];
    for (var d = 0; d < delays.length; d++) setTimeout(function () { schedule(''); }, delays[d]);

    try {
      new MutationObserver(function (records) {
        var meaningful = false;
        for (var r = 0; r < records.length; r++) {
          if (records[r].type === 'attributes' &&
              (records[r].attributeName === MARK ||
               records[r].attributeName === 'data-antcv-severity')) continue;
          meaningful = true; break;
        }
        if (meaningful) schedule('');
      }).observe(document.body || document.documentElement, {
        childList: true, subtree: true, characterData: true,
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.AntcvValidationSeverityConsumer357 = {
    version: SCRIPT_VERSION,
    sweep: sweep,
    _deriveSeverity: deriveSeverity,
  };

  try { console.debug('[validation-severity-consumer] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
