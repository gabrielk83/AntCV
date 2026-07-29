/* antcv-languages-concise.js — LANGUAGES-CONCISE-001 (owner 2026-06-22)
 * ============================================================================
 * Owner asked (repeatedly) for CONCISE language proficiency on the CV:
 *   "english and hebrew: native, spanish: professional, Danish: intermediate"
 * The stored values drifted verbose — "full professional, Uruguayan variant",
 * "B1, Prøve i dansk 2" — so this trims each proficiency to its concise core:
 *   - keep only the text BEFORE the first comma (drops ", Uruguayan variant",
 *     ", Prøve i dansk 2" and similar qualifiers);
 *   - map a leading CEFR level to a word: A1/A2 → basic, B1/B2 → intermediate,
 *     C1/C2 → fluent;
 *   - collapse verbose "full professional" / "professional working" → professional;
 *   - normalise native / mother tongue → native.
 * Anything already concise (native / professional / intermediate / fluent / basic)
 * is a fixpoint, so the pass is idempotent and self-converging.
 *
 * Scope: the CV `languages` section (labeled_list {l,v} OR rich_block {b,t}). Only
 * rewrites a value it actually shortens. CV only. Self-disabling on any error.
 */
(function () {
  'use strict';
  var VERSION = '1.51.242-lang-guard';
  if (window.__antcvLanguagesConcise === VERSION) return;
  window.__antcvLanguagesConcise = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function isLanguages(s) {
    return !!(s && (s.id === 'languages' || /\blanguages?\b|\bsprog\b/i.test(String(s.title || ''))));
  }
  // Trim one proficiency string to its concise canonical form.
  function concise(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return s;
    if (/\b(basic|intermediate|fluent) \([ABC][12]\)$/i.test(s)) return s;   // already "word (CEFR)" → idempotent
    var core = s.split(',')[0].trim();           // drop ", Uruguayan variant" / ", Prøve i dansk 2"
    // owner 2026-06-22 (revised): KEEP the CEFR code alongside the word — Danish must read
    // "intermediate (B1)", not just "intermediate". EN/HE native stay native (no further cropping).
    var m = core.match(/^([abc][12])\b/i);
    if (m) { var lvl = m[1].toUpperCase(); return (lvl[0] === 'A' ? 'basic' : lvl[0] === 'B' ? 'intermediate' : 'fluent') + ' (' + lvl + ')'; }
    if (/full professional|professional working|professional proficiency/i.test(core)) return 'professional';
    // LANG-NATIVE-FLUENT-001 (owner 2026-06-23): a native language reads "native / fluent"
    // (native implies fluent). Idempotent — re-matching "native / fluent" returns it unchanged.
    if (/native|mother ?tongue/i.test(core)) return 'native / fluent';
    return core;                                  // already concise (professional / native / …) or unknown → keep core
  }
  function readPI() { try { var v = JSON.parse(localStorage.getItem('personalInfo') || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; } }
  // A value already over-cropped to a BARE word ("intermediate") lost its CEFR code. Re-source the
  // ORIGINAL ("B1, …") from personalInfo.additional so it becomes "intermediate (B1)". Only fires on a
  // bare word WITH a CEFR-bearing source — never clobbers a value the owner enriched.
  function sourceCEFR(label) {
    var add = readPI().additional;
    if (!Array.isArray(add)) return null;
    var lab = String(label || '').toLowerCase().trim();
    for (var i = 0; i < add.length; i++) {
      var a = add[i];
      if (a && String(a.l || '').toLowerCase().trim() === lab) { var v = String(a.v || ''); if (/^[abc][12]\b/i.test(v.trim())) return v; }
    }
    return null;
  }
  // Apply to whichever value field the row uses (v for labeled_list, t for rich_block).
  function fixRow(row) {
    if (!row || typeof row !== 'object') return false;
    var changed = false;
    function apply(valField, labelField) {
      if (typeof row[valField] !== 'string') return;
      var cur = row[valField];
      var nv = concise(cur);
      // restore a CEFR code that an earlier over-crop dropped (bare "intermediate" → "intermediate (B1)")
      if (/^(basic|intermediate|fluent)$/i.test(nv)) { var src = sourceCEFR(row[labelField]); if (src) nv = concise(src); }
      if (nv !== cur) { row[valField] = nv; changed = true; }
    }
    apply('v', 'l');                 // labeled_list shape
    if (!row.grp) apply('t', 'b');   // rich_block shape
    return changed;
  }

  // LANG-GUARD-PINS-001 (owner 2026-07-10): the CEFR/proficiency rewrite is in
  // English (sourced from personalInfo.languages). Under a non-English output
  // language the translation pass has localized the LANGUAGES section — re-running
  // this would put English proficiency words back (the "languages stayed English
  // under zh" report). Only run in English.
  function nonEnglish() { try { var v = localStorage.getItem('language') || ''; if (v && v.charAt(0) === '"') v = JSON.parse(v); v = String(v || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2); return !!v && v !== 'en'; } catch (_) { return false; } }
  function run() {
    try {
      if (nonEnglish()) return;
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) {
        var s = secs.cv[i];
        if (!isLanguages(s) || !Array.isArray(s.items)) continue;
        for (var j = 0; j < s.items.length; j++) { if (fixRow(s.items[j])) changed = true; }
      }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'languages-concise' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvLanguagesConcise = { version: VERSION, run: run, concise: concise };
})();
