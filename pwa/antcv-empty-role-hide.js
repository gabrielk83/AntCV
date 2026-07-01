/* antcv-empty-role-hide.js — EMPTY-ROLE-HIDE-001 (owner 2026-07-02)
 * ============================================================================
 * "Empty role needs fix." The stored experience roles held three SKELETON rows
 * (id r8/r9/r10 — no title, no company, no bullets, no results) with on:true, so the
 * preview rendered them as gray "[Role title], [Company]" placeholder rows under the
 * real roles. They also skew the preview-index/stored-index alignment that the orphan
 * write-back relies on. This sidecar HIDES (on:false — never deletes, per the
 * hide-over-delete rule) any fully-empty skeleton role.
 *
 * Guards against fighting the editor: only roles with a skeleton-style id (r<digits>)
 * are touched, only when the section has at least 2 roles WITH content, and only on
 * BOOT sweeps — not on sections-updated — so a role the user just added and is about
 * to fill is never hidden mid-edit. Kill: localStorage['antcv:disable-empty-role-hide']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.52-empty-role-hide';
  if (window.__antcvEmptyRoleHide === VERSION) return;
  window.__antcvEmptyRoleHide = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-empty-role-hide'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function blank(v) { return !String(v == null ? '' : v).trim(); }
  function isEmptyRole(r) {
    if (!r || r.on === false) return false;
    if (!blank(r.title) || !blank(r.company) || !blank(r.results) || !blank(r.years)) return false;
    if (Array.isArray(r.bullets) && r.bullets.some(function (b) { return !blank(typeof b === 'string' ? b : (b && (b.b || b.t))); })) return false;
    if (Array.isArray(r.outcomes) && r.outcomes.length) return false;
    return /^r\d{1,2}$/.test(String(r.id || ''));
  }
  function run() {
    if (disabled()) return;
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      secs.cv.forEach(function (s) {
        if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return;
        var withContent = s.roles.filter(function (r) { return r && (!blank(r.title) || !blank(r.company)); }).length;
        if (withContent < 2) return;                    // sparse CV: leave placeholders for the wizard
        s.roles.forEach(function (r) { if (isEmptyRole(r)) { r.on = false; changed = true; } });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'empty-role-hide' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }
  [800, 3000].forEach(function (ms) { setTimeout(run, ms); });   // boot sweeps ONLY (see header)
  window.AntcvEmptyRoleHide = { version: VERSION, run: run, _isEmptyRole: isEmptyRole };
})();
