/* antcv-interests-persona-isolation.js — INTERESTS-LEAK-SOURCE-001 (owner 2026-06-23)
 * ============================================================================
 * "A persona whose kernel lacks `interests` inherits Gabriel's generated/default
 * INTERESTS in-session ... the real fix is that loading a different kernel must
 * CLEAR the prior persona's generated INTERESTS (session/kernel isolation), and the
 * empty-interests fallback must never be Gabriel-specific."
 *
 * The INJECTION source (antcv-sections-normalize-415.js pinInterests/scrubJuniorRugby)
 * is now name-guarded to Gabriel, so a non-Gabriel persona is no longer FILLED with
 * his CANON_INTERESTS. This sidecar is the restore-proof CLEANUP for sections / cloud
 * showcase slots that ALREADY carry his leaked canon when a different persona loads:
 * if the live persona is NOT Gabriel and the CV INTERESTS section still holds rows
 * that are byte-identical to Gabriel's canonical hobbies (cats / "literally a team
 * player" / tai-chi / etc.), those leaked rows are removed. Removal is exact-signature
 * only (never touches a persona's own interests). If the section becomes empty it is
 * hidden (on:false) rather than refilled — the empty-interests fallback is NEVER
 * Gabriel-specific. Gabriel's own session is untouched.
 *
 * Idempotent, loop-safe, disable via localStorage['antcv:disable-interests-persona-isolation'].
 */
(function () {
  'use strict';
  var VERSION = '1.50.841';
  if (window.__antcvInterestsPersonaIsolation === VERSION) return;
  window.__antcvInterestsPersonaIsolation = VERSION;

  var SRC = 'interests-persona-isolation';

  // The 6 canonical Gabriel interest rows (must mirror CANON_INTERESTS in
  // antcv-sections-normalize-415.js). Signature = "label|value" lowercased+trimmed.
  var CANON = [
    ['Rugby & inclusive sport', 'Team operations, coach assist, literally a team player'],
    ['Tai-chi', 'Stability and calm under pressure'],
    ['Cultural exchange', 'Languages, food culture and board games'],
    ['Hiking', 'Outdoor recovery and mental reset'],
    ['Reading', 'Technology, society and systems thinking'],
    ['Supervision', 'Handling three feline strategic napping experts (cats)']
  ];
  function sig(l, v) { return (String(l == null ? '' : l) + '|' + String(v == null ? '' : v)).toLowerCase().replace(/\s+/g, ' ').trim(); }
  var CANON_SIGS = {};
  CANON.forEach(function (c) { CANON_SIGS[sig(c[0], c[1])] = true; });

  // Distinctive, unmistakably-Gabriel markers — their presence in a non-Gabriel
  // INTERESTS section PROVES the block leaked from his canon (the trigger gate).
  var MARKER = /three feline|strategic napping|literally a team player/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-interests-persona-isolation'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function isGabriel() {
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return /\bgabriel\b/i.test(String(pi.name || '')); } catch (_) { return false; }
  }

  function readSections() { try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; } }

  // Pure transform — returns { changed, secs }. Exposed for unit testing.
  function isolate(secs, gabriel) {
    if (gabriel) return { changed: false, secs: secs };
    var cv = secs && secs.cv;
    if (!Array.isArray(cv)) return { changed: false, secs: secs };
    var changed = false;
    cv.forEach(function (s) {
      if (!s || s.id !== 'interests' || !Array.isArray(s.items)) return;
      // Trigger only when a distinctive Gabriel marker proves the block is his leaked canon.
      var leaked = s.items.some(function (it) {
        if (!it || it.grp) return false;
        return MARKER.test(String((it.b || it.l || '') + ' ' + (it.t || it.v || '')));
      });
      if (!leaked) return;
      // Remove rows whose signature is byte-identical to a canon row (shape-agnostic:
      // rich_block {b,t} or labeled_list {l,v}). A persona's own non-canon rows survive.
      var kept = s.items.filter(function (it) {
        if (!it || it.grp) return true;
        return !CANON_SIGS[sig(it.b || it.l, it.t || it.v)];
      });
      if (kept.length === s.items.length) return;   // nothing matched exactly
      changed = true;
      s.items = kept;
      // Empty after the strip → hide it (never refill with Gabriel content).
      if (!kept.length) s.on = false;
    });
    return { changed: changed, secs: secs };
  }

  function run() {
    if (disabled()) return;
    try {
      var secs = readSections();
      var r = isolate(secs, isGabriel());
      if (!r.changed) return;
      localStorage.setItem('sections', JSON.stringify(r.secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.info('[interests-persona-isolation] removed leaked Gabriel interests from a non-Gabriel session'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { run(); } catch (_) {} }); }
  [0, 400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'personalInfo' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 5000);

  window.AntcvInterestsPersonaIsolation = { version: VERSION, run: run, _isolate: isolate, _sig: sig };
})();
