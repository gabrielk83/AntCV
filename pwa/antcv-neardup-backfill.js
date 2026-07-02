/* antcv-neardup-backfill.js — PAN-IDRAET-BACKFILL-001 (owner 2026-07-02)
 * ============================================================================
 * Owner: "if there is less than 2 bullets left after collapse - add more info from
 * the user database (for a reasonable user there should be more data)."
 *
 * The export collapses within-role near-duplicate bullets (1.51.70) and the preview
 * mirror hides the loser (PAN-IDRAET-PREVIEW-HIDE-001). But when a role has only a
 * near-dup PAIR, collapsing would drop it below KEEP_MIN=2, so _keepMinBullets reverts
 * and BOTH near-dups stay — the repetitive look the owner wants gone.
 *
 * This sidecar fixes it at BUILD TIME: when a role's near-dups would collapse below 2,
 * it APPENDS a DISTINCT bullet from the user's own data (kernel bullets / outcomes /
 * proofPoints, via the docx-client's own AntcvBackfillRoleBullets) to the STORED role.
 * Because the extra is a real stored bullet, BOTH the index-based preview render AND the
 * export see it (parity by construction — an export-only backfill would desync the
 * hide-only preview mirror), and the export collapse then cleanly drops the near-dup.
 *
 * Index-safe / user-safe:
 *  - only APPENDS (never reorders/removes stored bullets) — every roles.N.bullets.M
 *    edit path and index-based consumer keeps its position (ORPHAN-WRITE-VERIFY);
 *  - a role is backfilled at most once (r._ndBackfill flag), so deleting the added
 *    bullet is respected — we never fight the user by re-adding it;
 *  - idempotent regardless: once a distinct bullet exists the collapse yields >=2, so
 *    the trigger condition is false on the next pass;
 *  - writes stored sections only when something actually changed; boot sweeps + a
 *    debounced, flag-guarded sections-updated listener (covers fresh generation).
 * Kill: localStorage['antcv:disable-neardup-backfill']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.95-neardup-backfill';
  if (window.__antcvNeardupBackfill === VERSION) return;
  window.__antcvNeardupBackfill = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-neardup-backfill'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function blank(v) { return !String(v == null ? '' : v).trim(); }
  function hasText(b) { return !blank(typeof b === 'string' ? b : (b && (b.b || b.t))); }

  // One role: append distinct backfill bullets when its near-dups would collapse
  // below min(2, count). Mutates r.bullets in place; returns true if it changed r.
  function backfillRole(r) {
    if (!r || r.on === false || r._ndBackfill) return false;          // once per role
    if (!Array.isArray(r.bullets) || r.bullets.length < 2) return false;
    if (!r.bullets.every(hasText)) return false;                      // skip half-empty rows (wizard)
    var dedup = window.AntcvDedupNearBullets;
    var backfill = window.AntcvBackfillRoleBullets;
    if (typeof dedup !== 'function' || typeof backfill !== 'function') return false;
    var collapsed = dedup(r.bullets.slice());
    var floor = Math.min(2, r.bullets.length);
    if (collapsed.length >= floor) return false;                     // no floor breach -> no backfill
    var need = floor - collapsed.length;
    var extra = backfill(r, collapsed, need);
    r._ndBackfill = 1;                                               // mark tried (even if 0 found -> don't retry forever)
    if (!Array.isArray(extra) || !extra.length) return true;        // no data: mark-only change
    r.bullets = r.bullets.concat(extra);
    return true;
  }

  function run() {
    if (disabled()) return;
    if (typeof window.AntcvBackfillRoleBullets !== 'function') return;   // docx-client not loaded yet -> a later sweep retries
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      secs.cv.forEach(function (s) {
        if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return;
        // only when the CV has real content (don't touch a sparse wizard skeleton)
        var withContent = s.roles.filter(function (r) { return r && (!blank(r.title) || !blank(r.company)); }).length;
        if (withContent < 2) return;
        s.roles.forEach(function (r) { if (backfillRole(r)) changed = true; });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'neardup-backfill' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(run, 1200); }
  window.addEventListener('antcv:sections-updated', schedule);         // covers fresh generation (flag-guarded, so no loop)
  [900, 3000, 7000].forEach(function (ms) { setTimeout(run, ms); });   // boot sweeps
  window.AntcvNeardupBackfill = { version: VERSION, run: run, _backfillRole: backfillRole };
})();
