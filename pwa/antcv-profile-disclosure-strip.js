/* antcv-profile-disclosure-strip.js — PROFILE-NO-DISABILITY-STRIP-001 (owner 2026-06-23)
 * ============================================================================
 * The PROFILE (CV) must NEVER carry a disability / hearing-impairment disclosure or
 * the "...has not limited his career" framing, nor the vague "worked with people
 * from many backgrounds" filler. The generation prompt already bans these
 * (PROFILE-NO-DISABILITY-001 + PROFILE-NO-FILLER-001, app.src.js ~2967) but the LLM
 * sometimes emits them anyway (owner 2026-06-23, repeatedly). This is the
 * DETERMINISTIC floor: strip the offending CLAUSES/sentences from the CV PROFILE
 * prose on every load + sections-updated, so the current doc is cleaned immediately
 * and every future generation is safe regardless of prompt adherence.
 *
 * Scope: the CV `profile` section ONLY (rich_block items[].t and legacy text
 * `content`). The disclosure legitimately lives in the Accessibility row and MAY
 * appear in the cover letter — those are NOT touched. Clause-level removal keeps
 * good content in a mixed sentence; a sentence that becomes empty is dropped.
 * Idempotent, loop-safe, disable via localStorage['antcv:disable-profile-disclosure-strip'].
 */
(function () {
  'use strict';
  var VERSION = '1.50.833';
  if (window.__antcvProfileDisclosureStrip === VERSION) return;
  window.__antcvProfileDisclosureStrip = VERSION;

  var SRC = 'profile-disclosure-strip';
  // Banned in PROFILE: disability/hearing disclosure, "not limited ... career" framing,
  // and the "people from many backgrounds" / "many backgrounds" filler.
  var BAN = /(hearing[ -]?impair|deaf\b|disabilit|not limited (his|their|her|my|the) career|which has not limited|people from many backgrounds|many (different )?backgrounds)/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-profile-disclosure-strip'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // Remove offending clauses/sentences from a prose string. Returns the cleaned
  // string (possibly empty).
  function cleanProse(text) {
    var t = String(text == null ? '' : text);
    if (!BAN.test(t)) return t;
    // split into sentences (keep it simple — period/!/? followed by space)
    var sentences = t.split(/(?<=[.!?])\s+/);
    var keptSentences = [];
    for (var i = 0; i < sentences.length; i++) {
      var sent = sentences[i];
      if (!BAN.test(sent)) { keptSentences.push(sent); continue; }
      // mixed sentence: drop only the offending ';'-clauses, keep the rest
      var clauses = sent.split(';');
      var keptClauses = clauses.filter(function (c) { return c.trim() && !BAN.test(c); });
      var rebuilt = keptClauses.join('; ').replace(/\s+/g, ' ').trim();
      // tidy: ensure it ends with sentence punctuation if it kept content
      if (rebuilt) {
        if (!/[.!?]$/.test(rebuilt)) rebuilt += '.';
        keptSentences.push(rebuilt);
      }
    }
    return keptSentences.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  }

  function readSections() { try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; } }

  function run() {
    if (disabled()) return;
    try {
      var secs = readSections();
      var cv = secs.cv;
      if (!Array.isArray(cv)) return;
      var changed = false;
      cv.forEach(function (s) {
        if (!s || s.id !== 'profile') return;
        // rich_block: items[].t
        if (Array.isArray(s.items)) {
          s.items.forEach(function (it) {
            if (it && typeof it.t === 'string') { var nt = cleanProse(it.t); if (nt !== it.t) { it.t = nt; changed = true; } }
          });
        }
        // legacy text: content
        if (typeof s.content === 'string') { var nc = cleanProse(s.content); if (nc !== s.content) { s.content = nc; changed = true; } }
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.info('[profile-disclosure-strip] removed banned disability/filler clause from PROFILE'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { run(); } catch (_) {} }); }
  [0, 400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 5000);

  window.AntcvProfileDisclosureStrip = { version: VERSION, run: run, _clean: cleanProse, _ban: BAN };
})();
