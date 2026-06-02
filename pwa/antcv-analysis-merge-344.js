/* AntCV Analysis merge — recruiter + red flags into the Analysis tab (v1.40.344)
 * ============================================================================
 *
 * Bundle 2b of the analysis-panel rework.
 *
 * Goal (user spec)
 * ----------------
 * Merge the 🎯 JD-analysis modal's content INTO the in-app Analysis tab so the
 * floating 🎯 FAB becomes redundant. The Analysis tab (rendered by app.js from
 * the `rationale`/`yo` object) already shows fit summary, top fit points, gaps
 * (with native per-gap closure), tailoring decisions and CL strategy. It was
 * missing the two things the modal had: the RECRUITER card and RED FLAGS.
 *
 * app.js side (shipped in the same release)
 * -----------------------------------------
 * Two additive, guarded render blocks were added to the analysis branch that
 * read `yo.recruiter` and `yo.red_flags` (render nothing when absent), plus a
 * `antcv:rationale-merge` event listener that re-hydrates `yo` from the stored
 * rationale. The Analysis button label gained a 🎯 prefix.
 *
 * This sidecar's job
 * ------------------
 *   1. When the Analysis view opens (or a JD is present), fetch
 *      /api/jd-analysis exactly as antcv-recheck-fit.js does.
 *   2. Merge { recruiter, red_flags } into the persisted `rationale` object
 *      (localStorage key "rationale") so app.js's `yo` carries them.
 *   3. Dispatch antcv:rationale-merge so the tab re-renders live.
 *   4. Retire the floating 🎯 FAB (data-antcv-recheck-fab) — hide it, since
 *      its content now lives in the tab. The recheck-fit MODAL itself stays
 *      reachable via window.AntcvRecheckFit.open() for power users, but the
 *      FAB no longer clutters the corner.
 *
 * Open-direction note
 * -------------------
 * We do NOT touch panel placement. app.js renders the analysis panel as
 * .antcv-editor-side-panel on desktop (slides from the side) and
 * .antcv-mobile-bottom-panel on mobile (opens from the bottom). Because we
 * only write data into `rationale` and let app.js render, that desktop/mobile
 * open-direction split is preserved automatically.
 *
 * Discipline: additive sidecar, removable in one <script> line. The only
 * app.js coupling is the read of `yo.recruiter`/`yo.red_flags` + the
 * rationale-merge listener, both shipped additively.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.344';
  if (window.__antcvAnalysisMerge344 === SCRIPT_VERSION) return;
  window.__antcvAnalysisMerge344 = SCRIPT_VERSION;

  var RATIONALE_KEY = 'rationale';
  var FAB_SEL = 'button.antcv-fab[aria-label="JD analysis"],button.antcv-fab[data-antcv-recheck-fab="1"]';

  // --- storage helpers (match app.js's quote-wrapping tolerance) ---
  function readProxyUrl() {
    try {
      var raw = localStorage.getItem('proxyUrl');
      if (!raw) return '';
      try { return String(JSON.parse(raw)).trim().replace(/\/+$/, ''); }
      catch (_) { return String(raw).trim().replace(/\/+$/, ''); }
    } catch (_) { return ''; }
  }
  function readRationale() {
    try {
      var raw = localStorage.getItem(RATIONALE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : null;
    } catch (_) { return null; }
  }
  function writeRationale(obj) {
    try { localStorage.setItem(RATIONALE_KEY, JSON.stringify(obj)); return true; }
    catch (_) { return false; }
  }
  function readSectionsForSummary() {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return '';
      return JSON.stringify(JSON.parse(raw)).slice(0, 8000);
    } catch (_) { return ''; }
  }
  function readActiveJD() {
    // Best-effort: app.js keeps JD text in React refs, not LS. The modal
    // fetches /api/active to recover it. We mirror that.
    return null; // resolved async in fetchActiveJd
  }

  function fireMerge() {
    try { window.dispatchEvent(new CustomEvent('antcv:rationale-merge', { detail: { source: 'analysis-merge-344' } })); }
    catch (_) {}
  }

  // --- jd-analysis fetch (parallels antcv-recheck-fit.js postJdAnalysis) ---
  var inflight = false;
  var lastFetchedKey = '';

  async function fetchActiveJd(proxyUrl) {
    if (!proxyUrl) return '';
    try {
      var r = await fetch(proxyUrl + '/api/active', { credentials: 'include' });
      if (!r.ok) return '';
      var j = await r.json();
      if (!j || !j.ok || !j.application_id) return '';
      var r2 = await fetch(proxyUrl + '/api/applications/' + j.application_id, { credentials: 'include' });
      if (!r2.ok) return '';
      var j2 = await r2.json();
      if (!j2 || !j2.ok || !j2.application) return '';
      return j2.application.jd_text || '';
    } catch (_) { return ''; }
  }

  async function runMerge() {
    if (inflight) return;
    var rationale = readRationale();
    // Only merge when there's an analysis object to attach to, and we
    // haven't already populated recruiter/red_flags for it.
    if (!rationale) return;
    if (rationale.recruiter !== undefined || rationale.red_flags !== undefined) return;
    var proxyUrl = readProxyUrl();
    if (!proxyUrl) return;

    inflight = true;
    try {
      var jd = await fetchActiveJd(proxyUrl);
      if (!jd || jd.length < 50) { inflight = false; return; }
      var key = String(jd.length) + ':' + jd.slice(0, 40);
      if (key === lastFetchedKey) { inflight = false; return; }
      lastFetchedKey = key;

      var res = await fetch(proxyUrl + '/api/jd-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jd,
          candidate_summary: readSectionsForSummary(),
          search_recruiter: true,
        }),
      });
      var raw = await res.text();
      var data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
      inflight = false;
      if (!res.ok || !data || !data.ok) return;

      var a = data.analysis || data;
      var merged = readRationale() || rationale; // re-read in case it changed
      if (!merged || typeof merged !== 'object') return;
      // Attach recruiter + red_flags (+ questions for completeness) so the
      // app.js render blocks pick them up. Mark so we don't refetch.
      if (a.recruiter !== undefined) merged.recruiter = a.recruiter;
      if (a.red_flags !== undefined) merged.red_flags = a.red_flags;
      else merged.red_flags = merged.red_flags || [];
      if (a.questions_in_jd !== undefined) merged.questions_in_jd = a.questions_in_jd;
      merged._jdAnalysisMergedAt = Date.now();
      if (writeRationale(merged)) fireMerge();
    } catch (_) {
      inflight = false;
    }
  }

  // Trigger a merge when the Analysis view is open. We detect the view by
  // the 🎯-labelled Analysis button being in its active state, or simply by
  // the analysis panel header being present in the DOM.
  function analysisViewOpen() {
    // The app.js analysis branch renders a "📊 Application Analysis" heading.
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent;
      if (t && t.indexOf('📊 Application Analysis') === 0) return true;
    }
    return false;
  }

  // Detect whether the app.js that renders recruiter/red_flags in the tab is
  // live. We only retire the 🎯 FAB once the tab can actually show that
  // content — otherwise shipping this sidecar before the app.js release would
  // hide the FAB AND leave recruiter/red-flags unreachable. The marker is the
  // 🎯 prefix on the Analysis button (added in the same app.js release).
  function newAppJsLive() {
    try {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = btns[i].textContent || '';
        if (t.indexOf('🎯') === 0) return true; // "🎯 Analysis" / "🎯 Analyse"
      }
    } catch (_) {}
    return false;
  }

  // --- retire the floating 🎯 FAB (content now lives in the tab) ---
  function hideRecheckFab() {
    if (!newAppJsLive()) return; // safe: keep FAB until the tab can render the content
    var fab = document.querySelector(FAB_SEL);
    if (!fab) return;
    if (fab.getAttribute('data-antcv-recheck-fab-hidden') === '1') return;
    fab.setAttribute('data-antcv-recheck-fab-hidden', '1');
    fab.setAttribute('aria-hidden', 'true');
    fab.setAttribute('tabindex', '-1');
    fab.style.setProperty('display', 'none', 'important');
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try {
        hideRecheckFab();
        if (analysisViewOpen()) runMerge();
      } catch (_) {}
    });
  }

  schedule();
  [300, 800, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  // Re-attempt when sections/rationale change (e.g. a fresh generation).
  window.addEventListener('antcv:sections-updated', function () {
    // A new generation resets rationale; allow a fresh fetch.
    lastFetchedKey = '';
    schedule();
  });

  window.AntcvAnalysisMerge344 = {
    version: SCRIPT_VERSION,
    runMerge: runMerge,
    hideFab: hideRecheckFab,
  };

  try { console.debug('[analysis-merge-344] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
