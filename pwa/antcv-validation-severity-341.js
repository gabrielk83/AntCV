/* AntCV validation severity tokens (v1.40.341-p1c)
 * ============================================================
 *
 * VAL-001 + VF-016
 * ----------------
 * Acceptance per §4.8: "Use separate severity tokens: errors
 * red, warnings yellow. Keep wording, icon, and aria-label
 * distinct (Error for blocking missing content, Warning for
 * non-critical misleading/incomplete content)."
 *
 * Today both banned-audit hits and llm-audit alerts render in
 * the same colour (red), so the user can't tell at a glance
 * whether the issue is blocking or merely worth attention.
 * The implementation note in §4.8 recommends one place to
 * define the tokens, threaded through both audits.
 *
 * What this sidecar does
 * ----------------------
 *   1. Injects a stylesheet that defines two CSS custom
 *      properties at :root scope:
 *        --antcv-validation-error:   #dc2626 (Tailwind red-600)
 *        --antcv-validation-warning: #d97706 (Tailwind amber-600)
 *      with text + background variants for both light and dark
 *      base themes.
 *   2. Adds class rules for the canonical severity attribute:
 *        [data-antcv-severity="error"]
 *        [data-antcv-severity="warning"]
 *      Any UI element carrying these attributes inherits the
 *      right colour. Icons + aria-labels are populated by the
 *      audit listeners below.
 *   3. Listens for the events the existing audit sidecars
 *      already fire:
 *        - antcv:banned-hits (banned-audit.js's CustomEvent)
 *        - antcv:llm-audit-result (llm-audit.js's CustomEvent,
 *          if/when present)
 *      and stamps the existing hit nodes (or fires a follow-up
 *      event for downstream listeners) with
 *      data-antcv-severity = "warning" (banned-words are
 *      warnings: non-blocking polish) or "error" (LLM-audit
 *      "negative signal severity 1.0" — blocking).
 *
 * Cooperation
 * -----------
 *   - antcv-banned-audit.js: emits antcv:banned-hits. Banned-
 *     word matches are WARNINGS per the plan (non-blocking
 *     polish). This sidecar marks them yellow.
 *   - antcv-llm-audit.js: emits antcv:llm-audit-result. Negative
 *     signals at severity 1.0 are ERRORS; lower severities are
 *     WARNINGS. This sidecar derives + applies.
 *   - antcv-shape-guard.js: NOT touched (Phase 0 discovery —
 *     §3 amendment removed this from the VAL-001 file list).
 *
 * Hazards
 * -------
 *   - No \s in regex.
 *   - No \u escapes.
 *   - CSS-only token definitions are inert without consumers.
 *     The audits' event-bus integration is additive: existing
 *     listeners keep working; new severity-aware listeners
 *     subscribe to the same events.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p1c';
  if (window.__antcvValidationSeverity341 === SCRIPT_VERSION) return;
  window.__antcvValidationSeverity341 = SCRIPT_VERSION;

  function injectCss() {
    if (document.getElementById('antcv-validation-severity-341-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-validation-severity-341-css';
    s.textContent = [
      ':root {',
      '  --antcv-validation-error:    #dc2626;',
      '  --antcv-validation-error-bg: rgba(220, 38, 38, 0.10);',
      '  --antcv-validation-error-border: rgba(220, 38, 38, 0.55);',
      '  --antcv-validation-warning:    #d97706;',
      '  --antcv-validation-warning-bg: rgba(217, 119, 6, 0.12);',
      '  --antcv-validation-warning-border: rgba(217, 119, 6, 0.55);',
      '}',
      '[data-antcv-severity="error"] {',
      '  color: var(--antcv-validation-error);',
      '  background: var(--antcv-validation-error-bg);',
      '  border-color: var(--antcv-validation-error-border);',
      '}',
      '[data-antcv-severity="warning"] {',
      '  color: var(--antcv-validation-warning);',
      '  background: var(--antcv-validation-warning-bg);',
      '  border-color: var(--antcv-validation-warning-border);',
      '}',
      // Distinct icons via ::before so the existing audit DOM',
      // doesn\'t have to add content. Both icons are inline svg-ish',
      // unicode glyphs that read correctly in any font.',
      '[data-antcv-severity="error"]::before {',
      '  content: "\\26A0\\FE0F ";', // ⚠️
      '  margin-right: 4px;',
      '}',
      '[data-antcv-severity="warning"]::before {',
      '  content: "\\1F4A1 ";', // 💡
      '  margin-right: 4px;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  // Best-effort mapping of audit-result detail → severity.
  function severityForBannedHit(/* hit */) {
    // Banned-word hits are always warnings per the plan
    // ("non-critical misleading/incomplete content").
    return 'warning';
  }

  function severityForLlmSignal(signal) {
    if (!signal || typeof signal !== 'object') return 'warning';
    var s = Number(signal.severity);
    if (Number.isFinite(s) && s >= 0.9) return 'error';
    return 'warning';
  }

  function stampSeverity(el, severity, ariaText) {
    if (!el || el.nodeType !== 1) return;
    el.setAttribute('data-antcv-severity', severity);
    if (ariaText) {
      el.setAttribute('aria-label',
        (severity === 'error' ? 'Error: ' : 'Warning: ') + ariaText);
    }
  }

  function onBannedHits(ev) {
    var report = ev && ev.detail;
    if (!report || !report.hits) return;
    // The existing banned-audit doesn't stamp DOM nodes itself —
    // it logs to console + dispatches the event. Downstream UI
    // (the bundle's audit panel, if any) is the consumer. We
    // fire a follow-up event that downstream consumers can
    // listen for to apply the severity attribute:
    try {
      window.dispatchEvent(new CustomEvent('antcv:validation-severity', {
        detail: {
          source: 'banned-audit',
          severity: 'warning',
          hits: report.hits,
          ariaText: report.hits.length + ' banned-word hit(s) — please review.',
        },
      }));
    } catch (_) {}
  }

  function onLlmAuditResult(ev) {
    var det = ev && ev.detail;
    if (!det) return;
    var signals = Array.isArray(det.signals) ? det.signals : (Array.isArray(det.negative_signals) ? det.negative_signals : []);
    if (!signals.length) return;
    var worst = signals.reduce(function (acc, sig) {
      var s = Number(sig && sig.severity);
      return Number.isFinite(s) && s > acc ? s : acc;
    }, 0);
    var severity = worst >= 0.9 ? 'error' : 'warning';
    try {
      window.dispatchEvent(new CustomEvent('antcv:validation-severity', {
        detail: {
          source: 'llm-audit',
          severity: severity,
          signals: signals,
          worstSeverity: worst,
          ariaText: signals.length + ' LLM signal(s); worst severity ' + worst.toFixed(2),
        },
      }));
    } catch (_) {}
  }

  function install() {
    injectCss();
    window.addEventListener('antcv:banned-hits', onBannedHits, false);
    window.addEventListener('antcv:llm-audit-result', onLlmAuditResult, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.AntcvValidationSeverity341 = {
    version: SCRIPT_VERSION,
    _stamp: stampSeverity,
    _severityForBannedHit: severityForBannedHit,
    _severityForLlmSignal: severityForLlmSignal,
  };

  try { console.debug('[validation-severity] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
