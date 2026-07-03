/* antcv-profile-access-scrub.js — PROFILE-ACCESS-SCRUB-001 (spec rules 20+22)
 * ============================================================================
 * ENFORCEMENT BELT for three gen-prompt rules the model has violated in a real
 * export (owner 2026-07-04, NIL round 4): the CV PROFILE carried
 * "Has worked with people from many backgrounds; hearing impaired, which has
 * not limited his career." — violating PROFILE-NO-FILLER-001,
 * PROFILE-NO-DISABILITY-001 and ACCESS-NO-COMMENT-001 in one sentence.
 * Prompt text alone is proven insufficient; this sidecar scrubs stored data.
 *
 * What it does (write-on-change, idempotent):
 *  - PROFILE (cv section id "profile" / type text content): drop whole
 *    sentences that mention a disability/accessibility topic, the banned
 *    "has not limited …" career comment, or the "people from many
 *    backgrounds" filler. Never leaves the profile empty (<20 chars → abort).
 *  - EVERYWHERE in cv+cl string fields: strip the banned career-comment
 *    CLAUSE ("…, which has not limited his career") even when the rest of
 *    the sentence stays.
 *  - ACCESSIBILITY row (additional items, label Accessibility): drop the
 *    banned career-comment sentence/clause; the row's factual content stays
 *    (length-tightening remains the generation's job — spec rule 9/20).
 * Kill: localStorage['antcv:disable-profile-access-scrub']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.109-profile-access-scrub';
  if (window.__antcvProfileAccessScrub === VERSION) return;
  window.__antcvProfileAccessScrub = VERSION;

  var CAREER_CLAUSE = /,?\s*(?:which|and|it|this|that)?\s*ha(?:s|ve)\s+not\s+limited\s+(?:his|her|their|my)\s+career[^.;]*/gi;
  var DISABILITY = /hearing[- ]impair|cochlear|disabilit|accessibilit|hearing aid/i;
  var FILLER = /people\s+from\s+many\s+backgrounds/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-profile-access-scrub'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  // strip the banned career clause anywhere; collapse leftover " ." / " ;"
  function stripCareerClause(s) {
    if (typeof s !== 'string' || !s) return s;
    if (!CAREER_CLAUSE.test(s)) { CAREER_CLAUSE.lastIndex = 0; return s; }
    CAREER_CLAUSE.lastIndex = 0;
    return s.replace(CAREER_CLAUSE, '').replace(/\s+([.;,])/g, '$1').replace(/ {2,}/g, ' ').trim();
  }

  // PROFILE: drop whole offending sentences (disability topic / filler / career comment)
  function scrubProfile(s) {
    if (typeof s !== 'string' || !s.trim()) return s;
    var parts = s.match(/[^.!?]+[.!?]?/g) || [s];
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      var bad = DISABILITY.test(t) || FILLER.test(t);
      if (!bad) { CAREER_CLAUSE.lastIndex = 0; bad = CAREER_CLAUSE.test(t); CAREER_CLAUSE.lastIndex = 0; }
      if (!bad) kept.push(t);
    }
    var out = kept.join('').replace(/ {2,}/g, ' ').trim();
    if (out === s.trim()) return s;
    if (out.length < 20) return s; // never nuke the profile — leave for regen
    return out;
  }

  function walkStrings(node, fn) {
    // returns [changed, newNode]
    if (typeof node === 'string') { var v = fn(node); return [v !== node, v]; }
    if (Array.isArray(node)) {
      var ch = false;
      var arr = node.map(function (x) { var r = walkStrings(x, fn); if (r[0]) ch = true; return r[1]; });
      return [ch, ch ? arr : node];
    }
    if (node && typeof node === 'object') {
      var och = false, out = {};
      Object.keys(node).forEach(function (k) {
        var r = walkStrings(node[k], fn);
        if (r[0]) och = true;
        out[k] = r[1];
      });
      return [och, och ? out : node];
    }
    return [false, node];
  }

  function run() {
    if (disabled()) return;
    try {
      var secs = readJson('sections', null);
      if (!secs || typeof secs !== 'object') return;
      var changed = false;

      // 1) profile section — sentence-level scrub. The profile lives in TWO
      // shapes: plain `content` and rich_block `items[].t` (the live NIL row
      // carried the offending sentence in items[0].t — 1.51.103 missed it).
      if (Array.isArray(secs.cv)) {
        var cv = secs.cv.map(function (s) {
          if (!s || s.id !== 'profile') return s;
          var patch = null;
          if (typeof s.content === 'string') {
            var v = scrubProfile(s.content);
            if (v !== s.content) (patch = patch || {}).content = v;
          }
          if (Array.isArray(s.items)) {
            var hit = false;
            var items = s.items.map(function (it) {
              if (!it || typeof it !== 'object' || typeof it.t !== 'string') return it;
              var nv = scrubProfile(it.t);
              if (nv !== it.t) { hit = true; return Object.assign({}, it, { t: nv }); }
              return it;
            });
            if (hit) (patch = patch || {}).items = items;
          }
          if (patch) { changed = true; return Object.assign({}, s, patch); }
          return s;
        });
        if (changed) secs = Object.assign({}, secs, { cv: cv });
      }

      // 2) banned career clause anywhere in cv+cl strings (incl. accessibility rows)
      var r1 = walkStrings(secs.cv, stripCareerClause);
      var r2 = walkStrings(secs.cl, stripCareerClause);
      if (r1[0] || r2[0]) { changed = true; secs = Object.assign({}, secs, { cv: r1[1], cl: r2[1] }); }

      // 3) ACCESS-MIDDLE-001 (spec rule 34, owner 2026-07-04): the accessibility
      // row targets the MIDDLE ground — "Hearing impaired." alone is too little,
      // the full accommodation paragraph too much. Canonicalise BOTH extremes to
      // the owner's one-liner. NAME-GUARDED to Gabriel (persona-contamination
      // rule: never write one candidate's facts onto another).
      try {
        var __pi = readJson('personalInfo', {}) || {}; __pi = __pi.personalInfo || __pi;
        if (/\bgabriel\b/i.test(String(__pi.name || ''))) {
          var CANON = 'Hearing impaired (cochlear implant); written follow-up works well.';
          var cv3 = (secs.cv || []).map(function (s3) {
            if (!s3 || s3.id !== 'accessibility' || !Array.isArray(s3.items)) return s3;
            var hit3 = false;
            var items3 = s3.items.map(function (it3) {
              if (!it3 || typeof it3.v !== 'string') return it3;
              var v3 = it3.v.trim();
              if (!/hearing/i.test(v3)) return it3;
              var tooShort = v3.length < 25, tooLong = v3.length > 90;
              if ((tooShort || tooLong) && v3 !== CANON) { hit3 = true; return Object.assign({}, it3, { v: CANON }); }
              return it3;
            });
            if (hit3) { changed = true; return Object.assign({}, s3, { items: items3 }); }
            return s3;
          });
          if (changed) secs = Object.assign({}, secs, { cv: cv3 });
        }
      } catch (_) {}

      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { console.log('[profile-access-scrub] PROFILE-ACCESS-SCRUB-001 applied'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'profile-access-scrub' } })); } catch (_) {}
    } catch (_) { /* never break the app */ }
  }

  window.addEventListener('antcv:sections-updated', function (ev) {
    try { if (ev && ev.detail && ev.detail.reason === 'profile-access-scrub') return; } catch (_) {}
    setTimeout(run, 500);
  });
  [900, 3000, 7000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvProfileAccessScrub = { version: VERSION, run: run, _scrubProfile: scrubProfile, _stripCareerClause: stripCareerClause };
})();
