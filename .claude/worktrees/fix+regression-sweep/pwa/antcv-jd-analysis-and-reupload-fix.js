/* AntCV jd-analysis-and-reupload-fix sidecar (v1.40.196)
 * ============================================================
 *
 * Two JD-pipeline bugs Gabriel reported on 2026-05-19:
 *
 *   (A) JD-analysis modal opens on the wrong default tab AND the
 *       body shown under "Recruiter & Red Flags" is the wrong
 *       content (probably the JD summary or fit content, not the
 *       recruiter/red-flags body).
 *
 *   (B) JD re-upload now triggers "File parsed but contained no
 *       usable text" even on files that are clearly readable. This
 *       is a regression from a recent change — probably a stale
 *       cache state where the previous "no-usable-text" verdict
 *       is being reused without re-parsing.
 *
 * Both fixes are blind (app.js is minified). For (A) we install a
 * mutation observer on the JD-analysis modal: when it mounts, we
 * find its tab strip and force the default to a preferred tab. We
 * also log the modal's tab structure once per session so Gabriel
 * can paste back the actual DOM if our heuristics miss.
 *
 * For (B) we hook every file <input> change event, detect when the
 * file looks JD-shaped (.pdf/.docx/.txt/.png/.jpg), and proactively
 * clear the known cached state keys that hold "no usable text"
 * verdicts. That gives the next parse run a clean slate.
 *
 * Diagnostic-by-default
 * ---------------------
 * Both fixes log their detection results to console.debug. If the
 * heuristic doesn't fire (e.g. tab names differ from what we
 * expect), the logs tell us why so we can iterate.
 *
 * Preferred default tab
 * ---------------------
 * "Fit summary" / "Fit" first (most common need), then "Recruiter
 * & Red Flags". Configurable via localStorage:
 *   antcv:jd-analysis-default-tab = 'fit' | 'recruiter' | 'auto'
 * (default: 'fit')
 */
(function () {
  'use strict';

  if (window.__antcvJdAnalysisFixInstalled) return;
  window.__antcvJdAnalysisFixInstalled = '1.40.196';

  // ─── Modal detection ─────────────────────────────────────────────
  function isJdAnalysisModal(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-antcv-modal') === 'jd-analysis') return true;
    // Heuristic: heading text inside the element references JD
    // analysis / red flags / recruiter.
    const head = el.querySelector('h1, h2, h3, [role="heading"], [data-antcv-modal-title]');
    const headTxt = (head ? head.textContent : '').trim().slice(0, 100);
    if (/jd\s*analysis|job\s*description\s*analysis|jd\s*insights/i.test(headTxt)) return true;
    // Fallback: tab labels.
    const text = (el.textContent || '').slice(0, 1500);
    const hasRecruiter = /recruiter\s*&\s*red\s*flags|red\s*flags/i.test(text);
    const hasFit = /\bfit\s*summary\b|\bfit\b/i.test(text);
    if (hasRecruiter && hasFit) return true;
    return false;
  }

  // Find tab buttons inside the modal. We treat any of these as a
  // tab: [role="tab"], buttons with aria-selected, .tab-style class
  // patterns, and buttons whose text matches known tab labels.
  function findTabs(modal) {
    const tabs = [];
    // role="tab" — the ARIA-clean path.
    modal.querySelectorAll('[role="tab"]').forEach(function (t) { tabs.push(t); });
    if (tabs.length) return tabs;
    // Fallback: buttons with aria-selected attribute.
    modal.querySelectorAll('button[aria-selected]').forEach(function (t) { tabs.push(t); });
    if (tabs.length) return tabs;
    // Fallback: buttons whose text matches our known tab vocabulary.
    const known = /^(fit|fit\s*summary|recruiter\s*&\s*red\s*flags|red\s*flags|skills|requirements|signals|raw)$/i;
    modal.querySelectorAll('button, [role="button"]').forEach(function (b) {
      const t = (b.textContent || '').trim();
      if (known.test(t)) tabs.push(b);
    });
    return tabs;
  }

  function tabKey(tab) {
    const t = (tab.textContent || '').trim().toLowerCase();
    if (/^fit/i.test(t)) return 'fit';
    if (/recruiter|red\s*flags/i.test(t)) return 'recruiter';
    if (/skills|requirements/i.test(t)) return 'skills';
    if (/signal/i.test(t)) return 'signals';
    if (/raw|source/i.test(t)) return 'raw';
    return t;
  }

  function preferredTabKey() {
    let v = '';
    try { v = String(localStorage.getItem('antcv:jd-analysis-default-tab') || ''); } catch (_) {}
    if (v === 'fit' || v === 'recruiter' || v === 'skills' || v === 'signals') return v;
    return 'fit';
  }

  function fixJdAnalysisModalDefault(modal) {
    if (modal.getAttribute('data-antcv-jd-tabbed') === '1') return;
    requestAnimationFrame(function () {
      const tabs = findTabs(modal);
      if (!tabs.length) {
        try { console.debug('[jd-analysis-fix] modal detected but no tabs found:',
          (modal.textContent || '').slice(0, 120)); } catch (_) {}
        return;
      }
      // One-time structural diagnostic — useful for iterating.
      try {
        const keys = tabs.map(function (t) { return tabKey(t); });
        console.debug('[jd-analysis-fix] tabs:', keys);
      } catch (_) {}
      const want = preferredTabKey();
      let target = tabs.find(function (t) { return tabKey(t) === want; });
      if (!target && want !== 'fit') {
        // Fall back to 'fit' if preferred isn't there.
        target = tabs.find(function (t) { return tabKey(t) === 'fit'; });
      }
      if (!target) target = tabs[0];
      // Is it already the active tab?
      const activeNow = tabs.find(function (t) {
        return t.getAttribute('aria-selected') === 'true' ||
               /\b(?:active|selected)\b/i.test(t.className || '');
      });
      if (activeNow === target) {
        modal.setAttribute('data-antcv-jd-tabbed', '1');
        return;
      }
      try { target.click(); } catch (_) {}
      modal.setAttribute('data-antcv-jd-tabbed', '1');
      try { console.debug('[jd-analysis-fix] forced default tab →', tabKey(target)); } catch (_) {}
    });
  }

  // Recruiter & Red Flags body — best-effort. If the user clicks
  // that tab and the visible body doesn't contain recruiter-ish
  // keywords, we log a diagnostic. We can't fix the source content
  // here, but the log proves the bug and gives us telemetry.
  function probeRecruiterTab(modal) {
    const tabs = findTabs(modal);
    const tab = tabs.find(function (t) { return tabKey(t) === 'recruiter'; });
    if (!tab) return;
    if (tab.getAttribute('data-antcv-jd-recruiter-probed') === '1') return;
    tab.addEventListener('click', function () {
      // Give React a frame.
      setTimeout(function () {
        const body = modal.querySelector('[role="tabpanel"], [data-antcv-tab-body], .tab-body, [class*="panel" i]');
        const txt = body ? (body.textContent || '').slice(0, 300) : '';
        const recruiterKeywords = /recruiter|red\s*flags|warning|concern|risk|caution/i;
        const fitKeywords = /\bfit\b|score|match|alignment/i;
        if (txt && fitKeywords.test(txt) && !recruiterKeywords.test(txt)) {
          try {
            console.warn('[jd-analysis-fix] Recruiter & Red Flags tab is showing FIT content. ' +
                         'Sample (first 200 chars):', txt.slice(0, 200));
          } catch (_) {}
        }
      }, 80);
    }, false);
    tab.setAttribute('data-antcv-jd-recruiter-probed', '1');
  }

  // ─── JD re-upload reset (Bug B) ──────────────────────────────────
  // Known cache keys we've seen hold "no usable text" verdicts in
  // past sessions. We clear these on file change so the parser is
  // forced to re-run from scratch.
  const STALE_KEYS = [
    'jdText', 'jdTextCache', 'jdParseStatus', 'jdParseError',
    'jdAnalysis', 'jdAnalysisCache', 'jdFingerprint',
    'jdImageOcr', 'jdImageOcrText', 'jdImageOcrStatus',
    'jdLastUploadStatus', 'jd:noUsableText',
  ];

  function looksLikeJdFile(file) {
    if (!file) return false;
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    if (/\.(pdf|docx?|txt|rtf|md|png|jpe?g|webp|bmp)$/i.test(name)) return true;
    if (/pdf|word|wordprocessingml|plain|image|jpeg|png|webp/i.test(type)) return true;
    return false;
  }

  function nearJdContext(input) {
    // Best-effort: is this <input type=file> in a UI region
    // associated with JD upload? We check ancestor text/labels.
    let cur = input;
    let depth = 0;
    while (cur && depth < 6) {
      const t = (cur.textContent || '').slice(0, 400);
      const aria = (cur.getAttribute && (cur.getAttribute('aria-label') || cur.getAttribute('data-antcv-input'))) || '';
      if (/job\s*description|jd\s*upload|paste\s*the\s*jd|upload\s*jd|drop\s*the\s*jd|drag\s*the\s*jd/i.test(t + ' ' + aria)) {
        return true;
      }
      cur = cur.parentNode;
      depth++;
    }
    return false;
  }

  function clearStaleJdCaches(reason) {
    let cleared = 0;
    for (const k of STALE_KEYS) {
      try {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k);
          cleared++;
        }
      } catch (_) {}
    }
    if (cleared > 0) {
      try { console.debug('[jd-analysis-fix] cleared', cleared, 'stale JD cache key(s) [' + reason + ']'); } catch (_) {}
    }
  }

  function onFileInputChange(ev) {
    const input = ev.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;
    const files = input.files || [];
    if (!files.length) return;
    const file = files[0];
    if (!looksLikeJdFile(file)) return;
    if (!nearJdContext(input)) return;
    // It's a JD-shaped file in a JD context — clear stale caches.
    clearStaleJdCaches('file-input-change:' + (file.name || '?'));
  }

  // ─── Modal observer wiring ───────────────────────────────────────
  function handleNewElement(el) {
    if (isJdAnalysisModal(el)) {
      fixJdAnalysisModalDefault(el);
      probeRecruiterTab(el);
    }
    if (el.querySelectorAll) {
      el.querySelectorAll('[role="dialog"], [class*="modal" i]').forEach(function (m) {
        if (isJdAnalysisModal(m)) {
          fixJdAnalysisModalDefault(m);
          probeRecruiterTab(m);
        }
      });
    }
  }

  try {
    const mo = new MutationObserver(function (records) {
      for (const r of records) {
        for (const n of (r.addedNodes || [])) {
          if (!n || n.nodeType !== 1) continue;
          handleNewElement(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // First-pass for modal already open at boot.
  setTimeout(function () {
    document.querySelectorAll('[role="dialog"], [class*="modal" i]').forEach(handleNewElement);
  }, 400);

  // ─── File input wiring (re-upload reset) ─────────────────────────
  document.addEventListener('change', onFileInputChange, true);

  // Public API.
  window.AntcvJdAnalysisFix = {
    version: '1.40.196',
    preferredTabKey: preferredTabKey,
    clearStaleJdCaches: clearStaleJdCaches,
    _findTabs: findTabs,
    _isJdAnalysisModal: isJdAnalysisModal,
  };

  try { console.debug('[jd-analysis-fix] installed v1.40.196'); } catch (_) {}
})();
