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
  var VERSION = '1.51.76-gab-results-pin-no-number';
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
    // ROLE-RESULTS-MISSING-TA-SG-001 (owner PDF review 2026-07-03): a gen that SPLITS the TAU
    // role leaves a bare "Teaching Assistant" slot no pin matches (the RA matcher wants
    // research). Distinct teaching-side fact from the kernel snapshot (SEM/Raman/confocal
    // training), NOT a restatement of the 7-semesters bullet. The merged "R&D and Teaching
    // Assistant" title is EXCLUDED (negative lookahead) so it keeps the RA benchmark result.
    { reT: /^(?!.*(?:research|r\s*&\s*d)).*teaching\s+assist/i, reC: /tel[\s-]?aviv|\bTAU\b/i, text: 'Train graduate students on SEM, Raman, and confocal microscopy measurement protocols.' },
    // SIRIN-RESULT-TRIM-001 (owner 2026-07-02): the Sirin Result laminated outcomes[0], whose
    // leading clause ("Directed technical work across a 7-person EO … at the Sigma-Connectivity ODM
    // site in Sweden") is byte-identical to bullet[0] — "the content bullet is regenerated inside the
    // result." Pin the DISTINCT achievement (the co-invented patent) so the Result stops restating the
    // bullet. Company-gated to Sirin so it never touches the Meprolight EO roles.
    // RESULTS-PIN-NO-NUMBER-001 (owner 2026-07-03): the patent NUMBER lives once in
    // PUBLICATIONS & PATENTS — the Result describes the work without it (same as the
    // gen rule "a role line may describe the underlying work but must not carry the
    // patent number"). `old` lists superseded pin texts so upgrades apply once and
    // owner edits still stick.
    { reT: /optics|electro-?optics/i, reC: /sirin/i, text: 'Co-invented the stray-light optical window, now in commercial devices.', old: ['Co-invented the stray-light optical window (Patent No. 241997), now in commercial devices.', 'Co-invented the stray-light optical window (241997), now in commercial devices.'] },
  ];
  function entryFor(r) {
    if (!r) return null;
    var t = String(r.title || ''), c = String(r.company || '');
    for (var i = 0; i < PINS.length; i++) { var e = PINS[i]; if (e.reT.test(t) && (!e.reC || e.reC.test(c))) return e; }
    return null;
  }
  function pinFor(r) { var e = entryFor(r); return e ? e.text : null; }
  // RESULTS-PIN-OWNER-EDIT-001 (owner 2026-07-03): "deleting the patent number ...
  // makes it jump back to previous form" — the pin rewrote ANY differing results,
  // clobbering owner inline edits. The pin now wins ONLY over: an empty results, a
  // known pin text (current or superseded `old`), or a COPYCAT of the role's own
  // bullets (the original reason pins exist). Any other non-empty text is an owner
  // edit and STICKS.
  function normT(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function copycat(cur, bullets) {
    var nc = normT(cur); if (nc.length < 15 || !Array.isArray(bullets)) return false;
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      var nb = normT(typeof b === 'string' ? b : (b && (b.t || b.b)) || '');
      if (nb.length < 15) continue;
      if (nb.slice(0, 30) === nc.slice(0, 30)) return true;
      if (nb.indexOf(nc) !== -1 || nc.indexOf(nb) !== -1) return true;
    }
    return false;
  }
  function pinWins(cur, e, bullets) {
    if (!cur) return true;
    if (cur === e.text) return false;                                  // already pinned
    if (e.old && e.old.indexOf(cur) !== -1) return true;               // superseded pin text
    return copycat(cur, bullets);                                      // gen copycat of own bullets
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
          var e = entryFor(r);
          if (!e) return;
          var cur = String(r.results == null ? '' : r.results).trim();
          if (cur === e.text) return;
          if (!pinWins(cur, e, r.bullets)) return;                     // owner edit sticks
          r.results = e.text; changed = true;
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'gabriel-results-pin' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }
  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 300); });
  [600, 2000, 4000, 8000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvGabResultsPin = { version: VERSION, run: run, _pinFor: pinFor, _entryFor: entryFor, _pinWins: pinWins, _copycat: copycat };
})();
