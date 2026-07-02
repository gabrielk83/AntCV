/* antcv-unsolicited-cv-completeness.js — UNSOLICITED-CV-COMPLETENESS-001 (owner 2026-06-23)
 * ============================================================================
 * For a FULLY UNSOLICITED application — NO position (no JD) AND NO target company
 * (meta.company is Unsolicited/Open Application/empty) — the CV must show the
 * candidate's FULL breadth:
 *   1. ALL experience roles VISIBLE (on:true). The generator sometimes prunes
 *      "irrelevant" roles to on:false even for the unsolicited kernel (against
 *      EXPERIENCE-TAILOR-001); for a fully-unsolicited draft nothing should be
 *      hidden (owner 2026-06-23: "for fully unsolicited application ALL positions
 *      are inside and visible").
 *   2. Merged role titles read CONTENT-first, LEVEL-after (owner: "as a rule:
 *      content first, position level after"). Conservatively reorders only the
 *      unambiguous "<…> Team Leader / <…> Engineer" shape to
 *      "<…> Engineer / Team Leader", de-duplicating a domain word repeated across
 *      both halves (e.g. "Electro-Optics Team Leader / R&D Electro-Optics Engineer"
 *      -> "R&D Electro-Optics Engineer / Team Leader"). Other titles are untouched.
 *
 * Gated to fully-unsolicited so a JD-targeted draft (which legitimately prunes) is
 * never affected. Idempotent, loop-safe (same-blob bail + own-event ignore),
 * disable via localStorage['antcv:disable-unsolicited-cv-completeness'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.56-empty-slot-converge';
  if (window.__antcvUnsolicitedCvCompleteness === VERSION) return;
  window.__antcvUnsolicitedCvCompleteness = VERSION;

  var SRC = 'unsolicited-cv-completeness';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-unsolicited-cv-completeness'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // Fully unsolicited = no JD (no position) AND no real target company.
  function fullyUnsolicited() {
    try {
      var jd = String(localStorage.getItem('antcv:lastJdText') || '').trim();
      if (jd.length >= 30) return false;                       // a JD ⇒ has a position
      var meta = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(meta.company || '').trim();
      return !co || /^(unsolicited|open application|n\/a)$/i.test(co);
    } catch (_) { return false; }
  }

  var LEVEL_STRICT = /\bTeam Lead(?:er)?\b/i;
  var FUNCTION = /\b(Engineer|Architect|Specialist|Scientist|Analyst|Developer|Administrator|Consultant|Designer|Researcher|Technician|Officer|Representative|Manager|Expert)\b/i;

  // "Electro-Optics Team Leader / R&D Electro-Optics Engineer"
  //   -> "R&D Electro-Optics Engineer / Team Leader"
  function reorderTitle(title) {
    try {
      var t = String(title == null ? '' : title);
      if (t.indexOf(' / ') < 0) return t;
      var parts = t.split(' / ').map(function (p) { return p.trim(); });
      if (parts.length !== 2) return t;
      var a = parts[0], b = parts[1];
      // act only when the FIRST half is the unambiguous level ("Team Leader") with
      // no function noun, and the SECOND half carries the function (content).
      var aIsLevel = LEVEL_STRICT.test(a) && !FUNCTION.test(a);
      var bIsFunc = FUNCTION.test(b);
      if (!aIsLevel || !bIsFunc) return t;
      // level phrase = the level half minus any word also present in the content half
      var bWords = {};
      b.split(/[\s\/]+/).forEach(function (w) { if (w.length > 3) bWords[w.toLowerCase()] = 1; });
      var levelPhrase = a.split(/\s+/).filter(function (w) { return !bWords[w.toLowerCase()]; }).join(' ').trim();
      if (!LEVEL_STRICT.test(levelPhrase)) levelPhrase = 'Team Leader'; // safety: keep the level designation
      return b + ' / ' + levelPhrase;
    } catch (_) { return title; }
  }

  function readSections() { try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; } }

  // STORM-EMPTY-SLOT-CONVERGE-001 (owner 2026-07-03, demo-mode "jumping"/"bleeping"):
  // 415's hideEmptyRoleSlots (EXPERIENCE-EMPTY-SLOT-HIDE-001) hides a role whose
  // title/company are placeholders and that has no real bullet/outcome; this sidecar
  // then blindly un-hid it — an endless sections-updated ping-pong (~7.5 writes/s in
  // the template/demo state) that re-rendered React constantly, so the preview
  // alignments (table header center, sidebar justify) repainted late on every tick
  // ("jumping between justified, centered, left") and Settings → Personal islands
  // re-anchored ("bleeping" that never converges). "ALL positions visible" means all
  // REAL positions — an entirely-empty placeholder slot stays hidden. The predicate
  // mirrors 415's byte-for-byte so the two sidecars agree and converge in one pass.
  function _ph(v) { var s = String(v == null ? '' : v).trim(); return !s || s.charAt(0) === '['; }
  function _realBullet(r) {
    var bs = (r && r.bullets) || [];
    return Array.isArray(bs) && bs.some(function (b) { return !_ph(b && typeof b === 'object' ? (b.t || b.text || '') : b); });
  }
  function _realOutcome(r) {
    if (r && (r.result || r.results)) { var rr = r.result || r.results; if (!_ph(rr && typeof rr === 'object' ? (rr.t || rr.result || '') : rr)) return true; }
    var os = (r && r.outcomes) || [];
    return Array.isArray(os) && os.some(function (o) { return o && !_ph(o.result || o.title || o); });
  }
  function emptySlot(r) { return _ph(r && (r.title || r.role)) && _ph(r && r.company) && !_realBullet(r) && !_realOutcome(r); }

  function apply() {
    if (disabled()) return;
    if (!fullyUnsolicited()) return;
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return;
      var secs = JSON.parse(raw), changed = false;
      var exp = (secs.cv || []).find(function (s) { return s && (s.id === 'experience' || s.type === 'experience'); });
      if (!exp || !Array.isArray(exp.roles)) return;
      exp.roles.forEach(function (r) {
        if (!r) return;
        // STORM-MERGEHIDE-CONVERGE-001 (owner 2026-06-26 jump-probe): do NOT un-hide a role that
        // antcv-role-merge-dedup INTENTIONALLY hid as a merged duplicate (__antcvMergeHidden). Blindly
        // un-hiding it made merge-dedup re-hide it next tick -> an endless sections-updated tug-of-war
        // (the real source of the salmon "breathing", the page-2/3 dance, AND the edit-revert). Skipping
        // the merge-hidden role lets BOTH sidecars converge: every OTHER role shows, the merged duplicate
        // stays hidden, no further writes.
        // STORM-EMPTY-SLOT-CONVERGE-001: never un-hide an entirely-empty placeholder
        // slot — 415 hideEmptyRoleSlots just hid it and would hide it again (loop).
        if (r.on === false && !r.__antcvMergeHidden && !emptySlot(r)) { r.on = true; changed = true; } // un-hide every real role except a merged duplicate
        if (typeof r.title === 'string') { var nt = reorderTitle(r.title); if (nt !== r.title) { r.title = nt; changed = true; } }
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.info('[unsolicited-cv-completeness] all roles visible + merged titles content-first'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }
  [500, 1500, 3200].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'meta' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 5000);

  window.AntcvUnsolicitedCvCompleteness = { version: VERSION, _apply: apply, _reorderTitle: reorderTitle, _fullyUnsolicited: fullyUnsolicited, _emptySlot: emptySlot };
})();
