/* antcv-tools-corecomp-dedup.js — TOOLS-CORECOMP-DEDUP-001 (owner 2026-07)
 * ============================================================================
 * CORE COMPETENCIES (CV `core_comp`, a 2-column [Focus Area, Strategic Expertise]
 * table) must NOT be repeated as TOOLS & METHODS rows. Owner export review:
 *   "Core expertise replicated into TOOLS & METHODS — redundant, not allowed,
 *    crowding tools — no!" (e.g. a Tools row "Materials & devices: …" / "Optics,
 *    photonics & sensing: …" / "Validation: …" that mirrors a Focus-Area label).
 *
 * THIS PASS: drop a TOOLS rich_block ROW whose lead-in label (`b`) is essentially
 * the SAME concept as a core_comp Focus-Area label — i.e. its significant-word set
 * (words >3 chars) shares >=2 words with a Focus-Area label, OR one label's
 * significant words are fully contained in the other's (sub-/super-set) sharing >=1.
 * GROUP sub-headers (Expertise / Tools / Methods, `grp:true`) and rows with no lead
 * are always kept, as are tool rows that don't mirror a competency. CV only.
 * Idempotent (after the drop a re-run finds nothing to remove). Self-disabling on
 * error. Disable: localStorage['antcv:disable-tools-dedup']='1'.
 *
 * The durable fix is generation not emitting the overlap; this heals already-saved
 * docs the owner won't regenerate, and is a no-op once the data is clean.
 */
(function () {
  'use strict';
  var VERSION = '1.51.8';
  if (window.__antcvToolsCoreCompDedup === VERSION) return;
  window.__antcvToolsCoreCompDedup = VERSION;

  function disabled() { try { return localStorage.getItem('antcv:disable-tools-dedup') === '1'; } catch (_) { return false; } }
  function sig(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; }); }
  function dup(lw, fw) {
    if (!lw.length || !fw.length) return false;
    var fa = {}; fw.forEach(function (w) { fa[w] = 1; });
    var shared = lw.filter(function (w) { return fa[w]; });
    if (shared.length >= 2) return true;
    var lead = {}; lw.forEach(function (w) { lead[w] = 1; });
    var leadSubset = lw.every(function (w) { return fa[w]; });
    var faSubset = fw.every(function (w) { return lead[w]; });
    return (leadSubset || faSubset) && shared.length >= 1;
  }

  function run() {
    if (disabled()) return;
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var cc = secs.cv.filter(function (s) { return s && s.id === 'core_comp' && Array.isArray(s.rows); })[0];
      var tools = secs.cv.filter(function (s) { return s && s.id === 'tools' && Array.isArray(s.items); })[0];
      if (!cc || !tools) return;
      // Focus-Area labels = left column, skip the header row (row 0).
      var faList = cc.rows.slice(1).map(function (r) { return Array.isArray(r) ? sig(r[0]) : []; }).filter(function (w) { return w.length; });
      if (!faList.length) return;
      var before = tools.items.length;
      var kept = tools.items.filter(function (it) {
        if (!it || it.grp || !it.b) return true;                 // keep sub-headers + bodyless rows
        var lw = sig(it.b);
        for (var i = 0; i < faList.length; i++) { if (dup(lw, faList[i])) return false; }
        return true;
      });
      if (kept.length === before) return;                        // idempotent — nothing duplicated
      tools.items = kept;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'tools-corecomp-dedup' } })); } catch (_) {}
      try { console.log('[TOOLS-CORECOMP-DEDUP] dropped ' + (before - kept.length) + ' TOOLS row(s) duplicating CORE COMPETENCIES'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 300); });
  [800, 2000, 4000, 8000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvToolsCoreCompDedup = { version: VERSION, run: run };
})();
