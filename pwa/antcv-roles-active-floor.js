/* antcv-roles-active-floor.js — ROLES-ACTIVE-FLOOR-001 (owner 2026-07-05)
 * ============================================================================
 * Owner: "the last Trackman generation grayed out ALL roles (0 active) and kept
 * all sidebar items. Do not revert - just resolve." A targeted generation left
 * EVERY experience role on:false, so the CV had no experience at all. A CV must
 * never have 0 active roles.
 *
 * This is a FLOOR, not a revert: it acts ONLY when the experience section has
 * roles but 0 of them are active. It then restores visibility to the real roles
 * (on:true) while KEEPING legitimately merge-hidden roles hidden (a role carrying
 * `__antcvMergeHidden` from antcv-role-merge-dedup is a deliberate decompose
 * choice, not the bug). If every role is merge-hidden (still 0 active), it turns
 * them all on rather than leave the CV empty. It never hides anything, never
 * touches a CV that already has >=1 active role, and never fights a genuine edit.
 *
 * Restore-proof (load + sections-updated), idempotent (writes only on change),
 * self-disabling on error. Disable: localStorage['antcv:disable-roles-active-floor']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.146-roles-active-floor';
  if (window.__antcvRolesActiveFloor === VERSION) return;
  window.__antcvRolesActiveFloor = VERSION;

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-roles-active-floor'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function erasing() {
    try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); }
    catch (_) { return false; }
  }

  function isExperience(s) {
    return !!(s && (s.id === 'experience' || s.type === 'experience') && Array.isArray(s.roles));
  }
  // A role is "active" unless it is explicitly on:false.
  function isActive(r) { return !!(r && r.on !== false); }
  // A role hidden ON PURPOSE by the merge-dedup belt (keep it hidden).
  function isMergeHidden(r) { return !!(r && r.__antcvMergeHidden); }

  var lastApplyAt = 0;
  function run() {
    if (disabled() || erasing()) return;
    var now = (window.performance && performance.now) ? performance.now() : 0;
    if (now && lastApplyAt && (now - lastApplyAt) < 800) return; // anti-loop
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || 'null');
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) {
        var s = secs.cv[i];
        if (!isExperience(s) || !s.roles.length) continue;
        var active = s.roles.filter(isActive).length;
        if (active > 0) continue;                 // has active roles -> nothing to floor
        // 0 active: restore the roles that are NOT deliberately merge-hidden.
        var restored = 0;
        s.roles.forEach(function (r) {
          if (r && !isMergeHidden(r)) { if (r.on === false) { r.on = true; changed = true; } restored++; }
        });
        // If EVERY role is merge-hidden (would still be 0 active), turn them all on
        // rather than leave the CV with no experience at all.
        if (restored === 0) {
          s.roles.forEach(function (r) { if (r && r.on === false) { r.on = true; changed = true; } });
        }
      }
      if (!changed) return;
      lastApplyAt = now || 1;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'roles-active-floor' } })); } catch (_) {}
      try { console.log('[roles-active-floor] restored experience roles — a CV must never have 0 active roles (ROLES-ACTIVE-FLOOR-001)'); } catch (_) {}
    } catch (_) { /* self-disable on error */ }
  }

  window.addEventListener('antcv:sections-updated', function (ev) {
    try { if (ev && ev.detail && ev.detail.reason === 'roles-active-floor') return; } catch (_) {}
    setTimeout(run, 300);
  });
  [500, 1500, 3500, 7000].forEach(function (ms) { setTimeout(run, ms); });

  window.AntcvRolesActiveFloor = { version: VERSION, run: run, _isActive: isActive, _isExperience: isExperience };
})();
