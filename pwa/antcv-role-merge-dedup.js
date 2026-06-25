/* antcv-role-merge-dedup.js — ROLE-MERGE-DEDUP-001 (owner 2026-06-25)
 * ============================================================================
 * Owner: "a merged role should not have happened at the same time as the separate
 * roles." Generation produced BOTH a MERGED role AND its two separate components,
 * all on:true — e.g. at Innoviz:
 *    "Change Request Lead & System Architect"  2017-2025   (merged)
 *    "Change Request Lead"                       2020-2025  (separate)
 *    "System Architect"                          2017-2020  (separate)
 * The merged role triple-counts the same experience and inflates the CV page count.
 *
 * Fix: when a role's title joins two roles (" & " / " and ") AND there are >=2 OTHER
 * same-company roles whose year ranges sit strictly WITHIN its range (its components),
 * HIDE the merged role (on:false) — keep the richer SEPARATE roles (owner's decompose
 * preference, ROLE-DECOMP-001). Restore-proof (runs on load + sections-updated);
 * never deletes — only sets on:false + a __antcvMergeHidden marker. Self-disables on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.883';
  if (window.__antcvRoleMergeDedup === VERSION) return;
  window.__antcvRoleMergeDedup = VERSION;

  var MERGED_RE = / & | and /i;     // " & " / " and " — NOT "R&D" (no surrounding spaces)
  function yrs(s) {
    var m = /(\d{4})\s*[-–—]\s*(\d{4}|present|now|nu|current)/i.exec(String(s || ''));
    if (!m) return null;
    var a = +m[1];
    var b = /^\d{4}$/.test(m[2]) ? +m[2] : 2026;   // open-ended -> "now"
    return [Math.min(a, b), Math.max(a, b)];
  }
  function within(inner, outer) {   // strict subset (smaller span inside the merged span)
    return inner[0] >= outer[0] && inner[1] <= outer[1] && (inner[0] > outer[0] || inner[1] < outer[1]);
  }
  function norm(s) { return String(s || '').trim().toLowerCase(); }

  function run() {
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || typeof secs !== 'object') return;
      var changed = false;
      ['cv'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (sec) {
          if (!sec || (sec.type !== 'experience' && !/experience/i.test(sec.title || '')) || !Array.isArray(sec.roles)) return;
          var roles = sec.roles;
          roles.forEach(function (M, mi) {
            if (!M || M.on === false) return;
            if (!MERGED_RE.test(String(M.title || ''))) return;
            var mr = yrs(M.years);
            if (!mr) return;
            var subs = roles.filter(function (R, ri) {
              if (!R || ri === mi || R.on === false) return false;
              if (norm(R.company) !== norm(M.company)) return false;
              if (MERGED_RE.test(String(R.title || ''))) return false;   // a component is a plain role
              var rr = yrs(R.years);
              return rr && within(rr, mr);
            });
            if (subs.length >= 2) { M.on = false; M.__antcvMergeHidden = true; changed = true; }
          });
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { console.info('[role-merge-dedup-883] hid merged role(s) that duplicate separate roles'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'role-merge-dedup' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 500, 1500, 3000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvRoleMergeDedup = { version: VERSION, run: run, _yrs: yrs, _within: within };
})();
