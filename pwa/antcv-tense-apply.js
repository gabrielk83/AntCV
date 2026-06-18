/* antcv-tense-apply.js — TENSE-APPLY-001 (owner 2026-06-19)
 * ============================================================================
 * Owner: "the user chose present tense and all results and role content was in
 * past tense … handle the Role and result tenses control."
 *
 * The tense CHOICE (styleConfig.expTense = 'auto' | 'present' | 'past') is honoured
 * by the GENERATION prompt, but the LAMINATED Results + role bullets render in their
 * STORED tense — so switching tense without a full regen does nothing. This applies
 * the chosen tense to the leading verb of the STORED experience content, so BOTH the
 * preview and the export (both read the same `sections` blob) show it:
 *   - each role's bullets
 *   - each role's outcomes[] (the lamination source) + explicit role.results
 *   - the SELECTED OUTCOMES section items (the distribution source)
 *
 * Conservative: only a leading word that is a KNOWN verb is converted (unknown
 * leading words / non-verb bullets are left untouched). Bidirectional and
 * idempotent — once the verbs are in the target tense, re-running is a no-op; flip
 * the setting and it re-converts. Only acts for 'present' / 'past'; 'auto' is left to
 * the per-role logical tense from generation.
 *
 * Sidecar-only, restore-proof, edit-guarded, same-blob bail. Disable:
 * localStorage['antcv:disable-tense-apply'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvTenseApply) return;
  window.__antcvTenseApply = '1.50.694';

  var SRC = 'tense-apply';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-tense-apply'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isEditing() { try { var a = document.activeElement; if (!a) return false; if (a.isContentEditable) return true; var t = (a.tagName || '').toLowerCase(); return t === 'input' || t === 'textarea' || t === 'select'; } catch (_) { return false; } }

  // base (present) -> past. Covers the approved SELECTED-OUTCOMES verbs + common CV
  // verbs. "cut"/"set"/"put"/"hit"/"led<->lead" handled in-table.
  var BASE2PAST = {
    own: 'owned', build: 'built', run: 'ran', design: 'designed', drive: 'drove',
    deliver: 'delivered', implement: 'implemented', establish: 'established', ship: 'shipped',
    reduce: 'reduced', cut: 'cut', scale: 'scaled', map: 'mapped', translate: 'translated',
    coordinate: 'coordinated', negotiate: 'negotiated', resolve: 'resolved', investigate: 'investigated',
    validate: 'validated', qualify: 'qualified', author: 'authored', chair: 'chaired', guide: 'guided',
    mentor: 'mentored', restructure: 'restructured', initiate: 'initiated', configure: 'configured',
    specify: 'specified', direct: 'directed', supervise: 'supervised', architect: 'architected',
    lead: 'led', manage: 'managed', develop: 'developed', create: 'created', launch: 'launched',
    improve: 'improved', increase: 'increased', secure: 'secured', oversee: 'oversaw',
    define: 'defined', support: 'supported', maintain: 'maintained', analyze: 'analyzed', analyse: 'analysed',
    test: 'tested', present: 'presented', review: 'reviewed', plan: 'planned', set: 'set', put: 'put', hit: 'hit',
    optimize: 'optimized', optimise: 'optimised', streamline: 'streamlined', head: 'headed', handle: 'handled',
    perform: 'performed', conduct: 'conducted', execute: 'executed', introduce: 'introduced',
    rebuild: 'rebuilt', redesign: 'redesigned', refactor: 'refactored', migrate: 'migrated',
    automate: 'automated', standardize: 'standardized', standardise: 'standardised', cut_over: 'cut over'
  };
  var PAST2BASE = {};
  Object.keys(BASE2PAST).forEach(function (k) { PAST2BASE[BASE2PAST[k]] = k; });

  // Convert the LEADING verb of `text` to `mode`. Returns the (possibly) new string.
  function tenseLine(text, mode) {
    if ((mode !== 'present' && mode !== 'past') || typeof text !== 'string' || !text) return text;
    // skip an optional leading markup wrapper (<b ...>, **) then grab the first word.
    var m = text.match(/^(\s*(?:<[^>]+>\s*|\*{1,2}\s*)*)([A-Za-z]+)/);
    if (!m) return text;
    var prefix = m[1], word = m[2], lw = word.toLowerCase(), repl = null;
    if (mode === 'past') { if (Object.prototype.hasOwnProperty.call(BASE2PAST, lw)) repl = BASE2PAST[lw]; }
    else { if (Object.prototype.hasOwnProperty.call(PAST2BASE, lw)) repl = PAST2BASE[lw]; }
    if (!repl || repl === lw) return text;
    if (word[0] === word[0].toUpperCase()) repl = repl.charAt(0).toUpperCase() + repl.slice(1);
    return prefix + repl + text.slice(prefix.length + word.length);
  }

  // Tense an item that may be a string or {b,t,result}. Returns true if changed.
  function tenseItem(it, mode) {
    if (typeof it === 'string') return false; // strings handled by array map (immutable)
    if (!it || typeof it !== 'object') return false;
    var changed = false;
    if (typeof it.b === 'string') { var nb = tenseLine(it.b, mode); if (nb !== it.b) { it.b = nb; changed = true; } }
    if (typeof it.result === 'string') { var nr = tenseLine(it.result, mode); if (nr !== it.result) { it.result = nr; changed = true; } }
    return changed;
  }
  function tenseStrArray(arr, mode) {
    if (!Array.isArray(arr)) return false;
    var changed = false;
    for (var i = 0; i < arr.length; i++) {
      if (typeof arr[i] === 'string') { var n = tenseLine(arr[i], mode); if (n !== arr[i]) { arr[i] = n; changed = true; } }
      else if (tenseItem(arr[i], mode)) changed = true;
    }
    return changed;
  }

  function expTense() {
    try { var sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {}; return sc.expTense || (sc.expPastTense === true ? 'past' : 'auto'); }
    catch (_) { return 'auto'; }
  }

  var lastRaw = null;
  function apply() {
    if (disabled() || isEditing()) return;
    var mode = expTense();
    if (mode !== 'present' && mode !== 'past') { return; } // auto -> leave to generation
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) {
        if (!sec) return;
        if (sec.type === 'experience' && Array.isArray(sec.roles)) {
          sec.roles.forEach(function (r) {
            if (!r) return;
            if (tenseStrArray(r.bullets, mode)) changed = true;
            if (tenseStrArray(r.outcomes, mode)) changed = true;
            if (typeof r.results === 'string') { var nr = tenseLine(r.results, mode); if (nr !== r.results) { r.results = nr; changed = true; } }
          });
        }
        // SELECTED OUTCOMES section (the distribution source for laminated Results).
        if (/^(outcomes|selected_outcomes)$/.test(String(sec.id || '')) || /SELECTED OUTCOMES/i.test(String(sec.title || ''))) {
          if (tenseStrArray(sec.items, mode)) changed = true;
        }
      });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[tense-apply] applied ' + mode + ' tense to role bullets / outcomes / results'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [600, 1600, 3200].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'styleConfig' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvTenseApply = { version: '1.50.694', _apply: apply, _tenseLine: tenseLine };
})();
