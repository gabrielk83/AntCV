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
  var VERSION = '1.50.771';
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
    var core = s.split(',')[0].trim();           // drop ", Uruguayan variant" / ", Prøve i dansk 2"
    if (/^a[12]\b/i.test(core)) return 'basic';
    if (/^b[12]\b/i.test(core)) return 'intermediate';
    if (/^c[12]\b/i.test(core)) return 'fluent';
    if (/full professional|professional working|professional proficiency/i.test(core)) return 'professional';
    if (/native|mother ?tongue/i.test(core)) return 'native';
    return core;                                  // already concise (professional / fluent / …) or unknown → keep core
  }
  // Apply to whichever value field the row uses (v for labeled_list, t for rich_block).
  function fixRow(row) {
    if (!row || typeof row !== 'object') return false;
    var changed = false;
    if (typeof row.v === 'string') { var nv = concise(row.v); if (nv !== row.v) { row.v = nv; changed = true; } }
    if (typeof row.t === 'string' && !row.grp) { var nt = concise(row.t); if (nt !== row.t) { row.t = nt; changed = true; } }
    return changed;
  }

  function run() {
    try {
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
