/* antcv-gabriel-results-pin.js — GABRIEL-RESULTS-PIN-001 (owner 2026-07-02)
 * ============================================================================
 * "Make preview and PDF match." The EXPORT pins the 5 kernel role_results_exact lines
 * (antcv-docx-client _GAB_EXACT, non-mutating _lam) so a role with empty results/outcomes
 * shows its distinct NUMERIC result instead of copycatting its bullets. But the PREVIEW
 * derives Results independently and has no such pin — so for CSA/IDF, Team-Ops and
 * Students-Council the preview showed the bullet-copycat while the PDF showed the numeric
 * result. This sidecar writes the SAME 5 exact lines onto role.results in the stored
 * sections, so BOTH the preview and the export read one source and agree.
 *
 * NAME-GUARDED (Gabriel only). Idempotent (writes only when a role's results differs from
 * its pin). Reset-proof: re-applies on every sections-updated + a boot sweep, so a regen
 * or restore that drops the numeric result gets it back. A per-role resultsOverride (owner
 * inline edit / orphan-L3 rewrite) still wins at render time — this only sets the base
 * role.results. Kill: localStorage['antcv:disable-gabriel-results-pin']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.50-gab-results-pin';
  if (window.__antcvGabResultsPin === VERSION) return;
  window.__antcvGabResultsPin = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-gabriel-results-pin'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isGabriel() {
    try { var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; p = p.personalInfo || p; return /\bgabriel\b/i.test(String((p || {}).name || '')); }
    catch (_) { return false; }
  }
  // The 5 kernel role_results_exact lines, keyed by title + company (verbatim from the
  // __ANTCV_GABRIEL_KERNEL in app.src.js). Kept BYTE-IDENTICAL to antcv-docx-client _GAB_EXACT.
  var PINS = [
    { reT: /research\s+assist|teaching\s*\/?\s*research|\bRA\b/i, reC: /tel[\s-]?aviv|\bTAU\b/i, text: 'Benchmarked imprinted vs taut, non-imprinted devices; non-imprinted won on structure, manufacturability, responsivity, and 10× faster gating.' },
    { reT: /security\s+guard|\bvagt\b/i, reC: null, text: 'Manage access and incidents for 750-resident student housing.' },
    { reT: /computer\s*systems?\s*admin/i, reC: /\bidf\b|communication\s*corps/i, text: 'Support 100 users across 150 machines in a classified construction centre, with documented access, support, and recovery workflows.' },
    { reT: /team\s*operations?\s*manager|assistant\s*coach/i, reC: /pan\s*idr|copenhagen\s*wolves/i, text: 'Coordinate a 25-player squad, 300-guest club events, and club representation with Rugby Danmark and IGR Europe.' },
    { reT: /students?\s*council/i, reC: /tel[\s-]?aviv/i, text: 'Modernised 15 outdated EE exam-preparation booklets with updated examples, cleaner coverage, and improved print quality.' },
  ];
  function pinFor(r) {
    if (!r) return null;
    var t = String(r.title || ''), c = String(r.company || '');
    for (var i = 0; i < PINS.length; i++) { var e = PINS[i]; if (e.reT.test(t) && (!e.reC || e.reC.test(c))) return e.text; }
    return null;
  }
  function run() {
    if (disabled() || !isGabriel()) return;
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      secs.cv.forEach(function (s) {
        if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return;
        s.roles.forEach(function (r) {
          var pin = pinFor(r);
          if (pin && String(r.results == null ? '' : r.results) !== pin) { r.results = pin; changed = true; }
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'gabriel-results-pin' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }
  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 300); });
  [600, 2000, 4000, 8000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvGabResultsPin = { version: VERSION, run: run, _pinFor: pinFor };
})();
