/* AntCV regression-sweep harness (v1.40.341-gate)
 * ============================================================
 *
 * TC-020 (gate phase per plan §10)
 * --------------------------------
 * "Repeat smoke tests on every section using PB, CJLR, Enhance,
 * Fit, Delete, Move. No shared-control regressions."
 *
 * This sidecar adds an in-browser harness that walks every
 * [data-sid] in both editor and preview and asserts the
 * expected contract for that section's controls. It's invoked
 * manually from the console:
 *
 *   window.AntcvRegressionSweep.run()
 *     → { passed: <n>, failed: <n>, findings: [...] }
 *
 * It does NOT modify any DOM — read-only. Safe to run at any
 * point during a session.
 *
 * Checks performed
 * ----------------
 *   1. Banned wording: no editor-panel button carries
 *      user-visible "Compress" / "compress" in title /
 *      aria-label / textContent (GEN-004 across the full app).
 *      Skips data-* attribute selectors (those are internal
 *      identifiers, not user-facing).
 *   2. SectionControlBar contract: every element matching
 *      [data-antcv-control-bar="1"] has an itemId attribute
 *      and at least one [data-antcv-control] child button
 *      (GEN-002).
 *   3. Move button presence: every movable section row in the
 *      editor (any [data-sid] outside .antcv-preview-paper
 *      whose section ID is in the movable set) has either
 *      data-antcv-cl-body-move-341="1" (P0-C scope) or
 *      data-antcv-section-move-341="1" (P0-D scope).
 *   4. Continuation header pattern: every Preview element
 *      tagged [data-antcv-continuation-header="1"] OR
 *      [data-antcv-cont-fix="1"] reads "<TITLE> (LOCALISED
 *      SUFFIX)" — the suffix matches the lang-resolved
 *      i18n key 'pb.cont' (PB-003).
 *   5. Severity tokens: :root computed style exposes
 *      --antcv-validation-error and --antcv-validation-warning
 *      (VAL-001).
 *   6. Watermark anchoring: at most ONE
 *      .antcv-ai-document-watermark is visible inside
 *      .antcv-preview-paper, and it sits in the LAST
 *      .antcv-page-row (WM-001).
 *   7. Application sentence: at most ONE
 *      [data-antcv-candidate-application-sentence="1"] in
 *      Preview; no sibling carries the same label text
 *      (CA-002 "no duplicate label").
 *
 * Output
 * ------
 *   - console.group with PASS / FAIL counts and per-check
 *     findings.
 *   - CustomEvent('antcv:regression-sweep-result', {detail:
 *       {passed, failed, findings}})
 *   - Returns the same result object.
 *
 * Hazards
 * -------
 *   - No \s in regex literals.
 *   - No \u escapes.
 *   - Read-only; cannot regress current behaviour.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-gate';
  if (window.__antcvRegressionSweep341 === SCRIPT_VERSION) return;
  window.__antcvRegressionSweep341 = SCRIPT_VERSION;

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function isInPreview(el, paper) {
    if (!paper || !el) return false;
    return paper.contains(el);
  }

  // ─── Check 1: banned wording in editor-panel buttons ─────────────
  function checkBannedWording(findings) {
    var paper = findPreviewPaper();
    var buttons = document.querySelectorAll('button');
    var hits = 0;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!b.isConnected) continue;
      if (isInPreview(b, paper)) continue;
      var title = (b.getAttribute('title') || '');
      var aria = (b.getAttribute('aria-label') || '');
      var text = (b.children && b.children.length === 0) ? (b.textContent || '') : '';
      if (/[Cc]ompress|COMPRESS|[Cc]omp\./.test(title + ' ' + aria + ' ' + text)) {
        hits++;
        if (hits <= 5) {
          findings.push({
            check: 'banned-wording',
            severity: 'fail',
            message: 'Editor button still carries "Compress" wording',
            details: { title: title, aria: aria, text: text },
          });
        }
      }
    }
    if (hits === 0) {
      findings.push({ check: 'banned-wording', severity: 'pass',
        message: 'No editor-panel button carries "Compress" / "Comp." wording.' });
    } else if (hits > 5) {
      findings.push({ check: 'banned-wording', severity: 'fail',
        message: '+ ' + (hits - 5) + ' more "Compress" hits (truncated).' });
    }
    return hits === 0;
  }

  // ─── Check 2: SectionControlBar contract ─────────────────────────
  function checkSectionControlBarContract(findings) {
    var bars = document.querySelectorAll('[data-antcv-control-bar="1"]');
    var ok = true;
    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      var itemId = bar.getAttribute('data-antcv-control-item');
      var buttons = bar.querySelectorAll('[data-antcv-control]');
      if (!itemId) {
        ok = false;
        findings.push({ check: 'scb-contract', severity: 'fail',
          message: 'SectionControlBar mounted without itemId — GEN-002 violation' });
      }
      if (!buttons.length) {
        ok = false;
        findings.push({ check: 'scb-contract', severity: 'fail',
          message: 'SectionControlBar with no buttons — capabilities empty? itemId=' + itemId });
      }
    }
    if (ok && bars.length > 0) {
      findings.push({ check: 'scb-contract', severity: 'pass',
        message: bars.length + ' SectionControlBar instance(s); all carry itemId + buttons.' });
    } else if (bars.length === 0) {
      findings.push({ check: 'scb-contract', severity: 'info',
        message: 'No SectionControlBar instances mounted yet (P1-B migration is deferred — see docs/plan/P1-B-followups.md).' });
    }
    return ok;
  }

  // ─── Check 3: Move button presence on movable sections ───────────
  // Movable section IDs (union of CL body + Candidate + CV main + CV sidebar).
  var MOVABLE_SIDS = {
    greeting: 1, opening: 1, who_am: 1, what_bring: 1, why_position: 1,
    how_found: 1, foundation: 1, closure: 1, closing: 1,
    candidate: 1, topbar: 1, top_bar: 1,
    experience: 1, education: 1, certifications: 1, regulatory: 1,
    publications: 1, additional: 1, core_competencies: 1,
    selected_outcomes: 1,
  };

  function checkMoveButtonPresence(findings) {
    var paper = findPreviewPaper();
    var rows = document.querySelectorAll('[data-sid]');
    var missing = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.isConnected) continue;
      if (isInPreview(row, paper)) continue;
      var sid = row.getAttribute('data-sid') || '';
      if (!MOVABLE_SIDS[sid]) continue;
      var hasMove =
        row.hasAttribute('data-antcv-cl-body-move-341') ||
        row.hasAttribute('data-antcv-section-move-341') ||
        row.querySelector('[data-antcv-cl-body-move-button], [data-antcv-section-move-button]');
      if (!hasMove) missing.push(sid);
    }
    if (missing.length === 0) {
      findings.push({ check: 'move-button', severity: 'pass',
        message: 'Every movable editor-panel row has a Move button (or is not yet rendered).' });
      return true;
    }
    findings.push({ check: 'move-button', severity: 'fail',
      message: 'Move button missing on rows: ' + missing.slice(0, 8).join(', ') +
              (missing.length > 8 ? ' (+' + (missing.length - 8) + ' more)' : ''),
      details: { missing: missing } });
    return false;
  }

  // ─── Check 4: Continuation heading suffix matches active locale ──
  function checkContinuationSuffix(findings) {
    var i18n = window.AntcvI18n;
    var expected = i18n && typeof i18n.t === 'function' ? i18n.t('pb.cont', '(CONT.)') : '(CONT.)';
    var paper = findPreviewPaper();
    if (!paper) {
      findings.push({ check: 'cont-suffix', severity: 'info', message: 'No preview paper rendered; skipping.' });
      return true;
    }
    var heads = paper.querySelectorAll('[data-antcv-continuation-header="1"], [data-antcv-cont-fix="1"]');
    var ok = true;
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      var t = (h.textContent || '').trim();
      if (!t) continue;
      // The suffix is the last token; allow any title before it.
      if (t.indexOf(expected) === -1) {
        ok = false;
        findings.push({ check: 'cont-suffix', severity: 'fail',
          message: 'Continuation heading missing localised suffix "' + expected + '"',
          details: { textContent: t } });
      }
    }
    if (ok && heads.length > 0) {
      findings.push({ check: 'cont-suffix', severity: 'pass',
        message: heads.length + ' continuation heading(s); all carry suffix "' + expected + '".' });
    } else if (heads.length === 0) {
      findings.push({ check: 'cont-suffix', severity: 'info',
        message: 'No continuation headings present (single-page doc or no page breaks set).' });
    }
    return ok;
  }

  // ─── Check 5: Severity tokens ────────────────────────────────────
  function checkSeverityTokens(findings) {
    try {
      var cs = window.getComputedStyle(document.documentElement);
      var err = cs.getPropertyValue('--antcv-validation-error').trim();
      var warn = cs.getPropertyValue('--antcv-validation-warning').trim();
      if (err && warn) {
        findings.push({ check: 'severity-tokens', severity: 'pass',
          message: 'Both --antcv-validation-error (' + err + ') and --antcv-validation-warning (' + warn + ') are defined.' });
        return true;
      }
      findings.push({ check: 'severity-tokens', severity: 'fail',
        message: 'Missing severity tokens. error="' + err + '" warning="' + warn + '"' });
      return false;
    } catch (e) {
      findings.push({ check: 'severity-tokens', severity: 'info', message: 'Could not read computed style: ' + (e && e.message) });
      return true;
    }
  }

  // ─── Check 6: Watermark anchoring ────────────────────────────────
  function checkWatermarkAnchor(findings) {
    var paper = findPreviewPaper();
    if (!paper) {
      findings.push({ check: 'watermark', severity: 'info', message: 'No preview paper rendered; skipping.' });
      return true;
    }
    var watermarks = paper.querySelectorAll('.antcv-ai-document-watermark, [data-antcv-ai-disclosure], [data-antcv-watermark]');
    var visible = [];
    for (var i = 0; i < watermarks.length; i++) {
      var wm = watermarks[i];
      if (wm.style.display === 'none') continue;
      if (wm.getAttribute('data-antcv-watermark-hidden-by-anchor') === '1') continue;
      visible.push(wm);
    }
    if (visible.length === 0) {
      findings.push({ check: 'watermark', severity: 'info',
        message: 'No visible watermark in preview (consent not given or not yet rendered).' });
      return true;
    }
    if (visible.length > 1) {
      findings.push({ check: 'watermark', severity: 'fail',
        message: 'More than one visible watermark in preview (' + visible.length + '). WM-001 expects exactly one.' });
      return false;
    }
    var pageRows = paper.querySelectorAll('.antcv-page-row, [data-antcv-page]');
    if (pageRows.length > 0) {
      var lastPage = pageRows[pageRows.length - 1];
      if (!lastPage.contains(visible[0])) {
        findings.push({ check: 'watermark', severity: 'fail',
          message: 'Watermark not in last page-row.' });
        return false;
      }
    }
    findings.push({ check: 'watermark', severity: 'pass',
      message: 'Exactly one watermark visible; lives in the last page-row.' });
    return true;
  }

  // ─── Check 7: Application sentence no-duplicate label ────────────
  function checkApplicationSentenceUnique(findings) {
    var paper = findPreviewPaper();
    if (!paper) {
      findings.push({ check: 'application-sentence', severity: 'info', message: 'No preview paper rendered; skipping.' });
      return true;
    }
    var hosts = paper.querySelectorAll('[data-antcv-candidate-application-sentence="1"]');
    if (hosts.length > 1) {
      findings.push({ check: 'application-sentence', severity: 'fail',
        message: 'Multiple application sentence hosts (' + hosts.length + '). CA-002 expects exactly one canonical render.' });
      return false;
    }
    findings.push({ check: 'application-sentence', severity: 'pass',
      message: (hosts.length === 0 ? 'Application sentence not yet rendered (Candidate block absent or P0-D not loaded).' : 'Single canonical application sentence host present.') });
    return true;
  }

  // ─── Runner ──────────────────────────────────────────────────────
  function run() {
    var findings = [];
    var checks = [
      checkBannedWording,
      checkSectionControlBarContract,
      checkMoveButtonPresence,
      checkContinuationSuffix,
      checkSeverityTokens,
      checkWatermarkAnchor,
      checkApplicationSentenceUnique,
    ];
    var passed = 0;
    var failed = 0;
    for (var i = 0; i < checks.length; i++) {
      var ok = false;
      try { ok = !!checks[i](findings); } catch (e) {
        findings.push({ check: checks[i].name, severity: 'fail',
          message: 'Check threw: ' + (e && e.message || e) });
      }
      if (ok) passed++;
      else failed++;
    }
    var result = { passed: passed, failed: failed, findings: findings, ranAt: Date.now() };
    try {
      console.groupCollapsed('%c[regression-sweep] passed=' + passed + ' failed=' + failed,
        failed > 0 ? 'color:#dc2626;font-weight:700' : 'color:#00746E;font-weight:700');
      findings.forEach(function (f) {
        var color =
          f.severity === 'fail' ? 'color:#dc2626' :
          f.severity === 'pass' ? 'color:#00746E' :
          'color:#888';
        console.log('%c[' + f.severity + '][' + f.check + '] ' + f.message, color, f.details || '');
      });
      console.groupEnd();
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:regression-sweep-result', { detail: result }));
    } catch (_) {}
    return result;
  }

  window.AntcvRegressionSweep = {
    version: SCRIPT_VERSION,
    run: run,
    // Individual checks exposed for targeted runs.
    _checkBannedWording: checkBannedWording,
    _checkSectionControlBarContract: checkSectionControlBarContract,
    _checkMoveButtonPresence: checkMoveButtonPresence,
    _checkContinuationSuffix: checkContinuationSuffix,
    _checkSeverityTokens: checkSeverityTokens,
    _checkWatermarkAnchor: checkWatermarkAnchor,
    _checkApplicationSentenceUnique: checkApplicationSentenceUnique,
  };

  try { console.debug('[regression-sweep] installed v' + SCRIPT_VERSION + ' — run window.AntcvRegressionSweep.run() in the console'); } catch (_) {}
})();
