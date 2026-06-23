/* antcv-core-comp-compress.js — CORE-COMP-COMPRESS-001 (owner 2026-06-22)
 * ============================================================================
 * CORE COMPETENCIES (CV) + WHAT I BRING (CL) are 2-column tables: [Focus Area,
 * Strategic Expertise]. Owner asks:
 *   - keep the Focus Area label COMPRESSED — e.g. "Documentation & traceability"
 *     → "Docs & traceability";
 *   - cap each Strategic Expertise cell: the COVER LETTER (bring) at 105 chars; the
 *     CV (core_comp) MUCH tighter (owner 2026-06-22: "CV is much much tighter!").
 *
 * Trims the Strategic Expertise cell to its per-doc cap at a WORD boundary (no
 * mid-word cut, no added ellipsis) and applies a small Focus-Area abbreviation map
 * (extend as needed). Header row (row 0) is never touched. Idempotent (a trimmed
 * cell / abbreviated label is a fixpoint). CV core_comp + CL bring tables only.
 * Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.831';
  if (window.__antcvCoreCompCompress === VERSION) return;
  window.__antcvCoreCompCompress = VERSION;

  var CAP_CL = 105;   // cover letter — WHAT I BRING
  var CAP_CV = 60;    // CV — CORE COMPETENCIES (much tighter, owner: "CV is much much tighter")
  function capFor(s) {
    return (s.id === 'bring' || /what i bring/i.test(String(s.title || ''))) ? CAP_CL : CAP_CV;
  }
  // Focus-Area abbreviations (owner example: Documentation → Docs). Whole-word, case-insensitive.
  // NOTE: "Coordination → Coord." was REMOVED (owner 2026-06-23: "do not use the shortening
  // 'Coord.'; if Coordination/Coordinating/Coordinate/Coordinated/Coordinates is in use display it
  // fully"). It was also the source of an edit-revert bug — the owner expanded "Coord." → the full
  // word and this sidecar re-abbreviated it on the next sections-updated. See EXPAND below.
  var ABBR = [
    [/\bDocumentation\b/gi, 'Docs'],
    [/\bRequirements\b/gi, 'Reqs'],
    [/\bManagement\b/gi, 'Mgmt'],
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
  ];
  function expand(s) {
    var v = String(s == null ? '' : s);
    EXPAND.forEach(function (p) { v = v.replace(p[0], p[1]); });
    return v;
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
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (s) {
          if (!isTbl(s)) return;
          s.rows.forEach(function (row, i) {
            if (i === 0 || !Array.isArray(row)) return;     // skip header row
            // Focus Area: abbreviate (Docs/Reqs/Mgmt) then expand any banned "Coord." → full word.
            if (typeof row[0] === 'string') { var fa = expand(abbreviate(row[0])); if (fa !== row[0]) { row[0] = fa; changed = true; } }
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
  window.AntcvCoreCompCompress = { version: VERSION, run: run, _cap: capWords, _abbr: abbreviate, _expand: expand };
})();
