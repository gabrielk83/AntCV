/* antcv-core-comp-compress.js — CORE-COMP-COMPRESS-001 (owner 2026-06-22)
 * ============================================================================
 * CORE COMPETENCIES (CV) + WHAT I BRING (CL) are 2-column tables: [Focus Area,
 * Strategic Expertise]. Owner asks:
 *   - keep the Focus Area label COMPRESSED — e.g. "Documentation & traceability"
 *     → "Docs & traceability";
 *   - cap each Strategic Expertise cell: the COVER LETTER (bring) UNDER 90 chars
 *     (owner 2026-06-25; was 105); the CV (core_comp) MUCH tighter (owner
 *     2026-06-22: "CV is much much tighter!").
 *
 * Trims the Strategic Expertise cell to its per-doc cap at a WORD boundary (no
 * mid-word cut, no added ellipsis) and applies a small Focus-Area abbreviation map
 * (extend as needed). Header row (row 0) is never touched. Idempotent (a trimmed
 * cell / abbreviated label is a fixpoint). CV core_comp + CL bring tables only.
 * Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.51.42';
  if (window.__antcvCoreCompCompress === VERSION) return;
  window.__antcvCoreCompCompress = VERSION;

  var CAP_CL = 89;        // cover letter — WHAT I BRING (owner 2026-06-25: each item UNDER 90 chars)
  var CAP_CV = 125;       // CV — CORE COMPETENCIES Strategic Expertise (owner 2026-06-25: <=125; was 60)
  var CAP_FOCUS = 25;     // Focus Area column label (owner 2026-06-25: <=25 chars)
  var CAP_HWIC = 125;     // CL — HOW I WOULD CONTRIBUTE intro (owner 2026-06-25: <=125 chars)
  function capFor(s) {
    return (s.id === 'bring' || /what i bring/i.test(String(s.title || ''))) ? CAP_CL : CAP_CV;
  }
  // Focus-Area abbreviations (owner example: Documentation → Docs). Whole-word, case-insensitive.
  // NOTE: "Coordination → Coord." was REMOVED (owner 2026-06-23: "do not use the shortening
  // 'Coord.'; if Coordination/Coordinating/Coordinate/Coordinated/Coordinates is in use display it
  // fully"). It was also the source of an edit-revert bug — the owner expanded "Coord." → the full
  // word and this sidecar re-abbreviated it on the next sections-updated. See EXPAND below.
  // "Management -> Mgmt" was REMOVED (owner 2026-06-30: "use the full word management,
  // not Mgmt"). Same fix shape as Coord. below: drop the abbreviation + EXPAND any stored
  // "Mgmt" back to the full word so it never re-abbreviates and owner edits stick.
  var ABBR = [
    [/\bDocumentation\b/gi, 'Docs'],
    [/\bRequirements\b/gi, 'Reqs'],
  ];
  function abbreviate(s) {
    var v = String(s == null ? '' : s);
    ABBR.forEach(function (p) { v = v.replace(p[0], p[1]); });
    return v;
  }
  // BANNED-SHORTENING (owner 2026-06-23): expand any pre-existing "Coord" / "Coord." back to the full
  // "Coordination" (the noun form these Focus-Area labels intend). `\bCoord\b` only matches the
  // standalone token — it never touches "Coordinator", "Coordinate(d/s)", or "Coordination" itself.
  var EXPAND = [
    [/\bCoord\b\.?/gi, 'Coordination'],
    [/\bMgmt\b\.?/gi, 'Management'],
  ];
  function expand(s) {
    var v = String(s == null ? '' : s);
    EXPAND.forEach(function (p) { v = v.replace(p[0], p[1]); });
    return v;
  }
  // FOCUS-TIGHTEN (owner 2026-06-26): the <=25 Focus-Area cap and the "spell Coordination out fully"
  // rule collided — "Cross-Discipline/Technical team Coordination" overran 25 and got TRUNCATED to a
  // half-phrase ("Technical team"). Owner's resolution: "use better sentences, e.g. 'Project team
  // Coordination' -> 'Project Coordination'." So write the label concisely instead of truncating:
  // drop the redundant connector "team" sitting immediately before a Coordination noun, so the full
  // word fits the cap. Narrow (only before Coord/Coordination), whole-word, idempotent.
  var TIGHTEN = [
    [/\bteam\s+(?=Coord(?:ination)?\b)/gi, ''],
  ];
  function tighten(s) {
    var v = String(s == null ? '' : s);
    TIGHTEN.forEach(function (p) { v = v.replace(p[0], p[1]); });
    return v;
  }
  // FOCUS-LABEL-EO-001 (owner 2026-07-01): the electro-optics / photonics Focus Area came back as a
  // long label (e.g. "Optics, photonics & semiconductor devices") that the <=25 cap truncated at a
  // word boundary to the DANGLING "Optics, photonics &" ("&" is not in capWords' trailing-separator
  // set, so it survives the trim). Because this sidecar re-runs on every sections-updated, the
  // truncation re-applied after every hard reset — the owner's inline edit reverted each time. Fix:
  // canonicalise the whole EO/photonics cluster label to the owner-preferred short form (22 chars,
  // fits the cap, never re-truncates). Whole-label replace, Focus Area column only. NAME-GUARDED to
  // Gabriel so a generic candidate's optics label is never rewritten. Idempotent: the target matches
  // the "eo & photonic" branch and maps to itself (fixpoint).
  var CANON = [
    [/^\s*(?:optics[\s,&]+photonics\b.*|eo\s*&\s*photonic\w*\b.*|electro-?optics?\b.*photonic.*)$/i, 'EO & Photonics sensors'],
  ];
  function canon(s) {
    var v = String(s == null ? '' : s);
    for (var i = 0; i < CANON.length; i++) { if (CANON[i][0].test(v)) return CANON[i][1]; }
    return v;
  }
  function isGabriel() {
    try { var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; p = p.personalInfo || p; return /\bgabriel\b/i.test(String((p || {}).name || '')); }
    catch (_) { return false; }
  }
  function capWords(s, cap) {
    var v = String(s == null ? '' : s);
    if (v.length <= cap) return v;
    var cut = v.slice(0, cap);
    var sp = cut.lastIndexOf(' ');
    if (sp > cap * 0.6) cut = cut.slice(0, sp);           // trim back to the last word boundary
    return cut.replace(/[\s,;:.\-]+$/, '');                // drop a trailing separator
  }

  function isTbl(s) { return !!(s && s.type === 'table' && Array.isArray(s.rows) && (s.id === 'core_comp' || s.id === 'bring' || /core competenc|what i bring/i.test(String(s.title || '')))); }

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }

  function run() {
    try {
      var secs = readSections();
      var changed = false;
      var gab = isGabriel();
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (s) {
          // HOW I WOULD CONTRIBUTE intro (CL rich_block): cap items[0].t to CAP_HWIC.
          if ((s && (s.id === 'contribute' || /how i would contribute/i.test(String(s.title || '')))) && Array.isArray(s.items) && s.items[0] && typeof s.items[0] === 'object' && typeof s.items[0].t === 'string') {
            var __raw0 = s.items[0].t;
            var hv = capWords(__raw0, CAP_HWIC);
            // HWIC-INTRO-COLON-KEEP-001 (owner 2026-06-26): the HWIC intro is a ":"-lead-in. capWords
            // strips trailing punctuation, so a capped intro lost its ":" -> the 760 converter (which
            // detects the intro by a trailing ":") stopped seeing it as the intro and re-markered it
            // every render (OPEN #4 marker jitter). Re-attach the ":" when the original had one so the
            // lead-in signal survives the cap and 760 keeps the intro markerless without guessing.
            if (/:\s*$/.test(__raw0) && !/:\s*$/.test(hv)) hv = hv.replace(/[\s,;:.\-]+$/, '') + ':';
            if (hv !== __raw0) { s.items[0].t = hv; changed = true; }
          }
          if (!isTbl(s)) return;
          s.rows.forEach(function (row, i) {
            if (i === 0 || !Array.isArray(row)) return;     // skip header row
            // Focus Area: abbreviate (Docs/Reqs/Mgmt), tighten ("X team Coordination" → "X Coordination"),
            // expand any banned "Coord." → full word, cap to CAP_FOCUS.
            if (typeof row[0] === 'string') { var fa = capWords(expand(tighten(abbreviate(gab ? canon(row[0]) : row[0]))), CAP_FOCUS); if (fa !== row[0]) { row[0] = fa; changed = true; } }
            // Strategic Expertise: expand banned "Coord.", then cap to the per-doc width.
            if (typeof row[1] === 'string') { var se = capWords(expand(row[1]), capFor(s)); if (se !== row[1]) { row[1] = se; changed = true; } }
          });
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'core-comp-compress' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvCoreCompCompress = { version: VERSION, run: run, _cap: capWords, _abbr: abbreviate, _expand: expand, _tighten: tighten, _canon: canon };
})();
