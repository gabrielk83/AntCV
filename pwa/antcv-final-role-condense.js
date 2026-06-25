/* antcv-final-role-condense.js — FINAL-ROLE-CONDENSE-002 (owner 2026-06-25)
 *
 * Two restore-proof content trims the owner asked for (they also shrink the CV, easing the
 * page-3+ overflow):
 *  1) VOLUNTEER ROLE BULLET CAP — the volunteer / foreningsarbejde role (Pan Idraet /
 *     Copenhagen Wolves) carries at most 3 bullets (owner: "max 3"; a MERGED last role may
 *     keep up to 4). Keeps the first N (the rest of the career stays full).
 *  2) REGULATORY HEADING SHORTEN — the group heading "Environmental, Durability & Materials
 *     Compliance" -> "Environmental, Durability & Compliance" (drop "Materials"), so it fits
 *     one line.
 *
 * Runs on load + sections-updated; only writes on a real change; self-disables on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.894';
  if (window.__antcvFinalRoleCondense === VERSION) return;
  window.__antcvFinalRoleCondense = VERSION;

  var VOLUNTEER_RE = /foreningsarbejde|pan\s*idr|copenhagen\s*wolves/i;
  var MERGED_RE = / & | and /i;

  function isVolunteer(r) {
    return !!(r && (VOLUNTEER_RE.test(String(r.title || '')) || VOLUNTEER_RE.test(String(r.company || ''))));
  }

  function run() {
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || typeof secs !== 'object') return;
      var changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (sec) {
          if (!sec) return;
          // (1) volunteer role bullet cap
          if ((sec.type === 'experience' || /experience/i.test(sec.title || '')) && Array.isArray(sec.roles)) {
            sec.roles.forEach(function (r) {
              if (!isVolunteer(r) || !Array.isArray(r.bullets)) return;
              var cap = MERGED_RE.test(String(r.title || '')) ? 4 : 3;
              if (r.bullets.length > cap) { r.bullets = r.bullets.slice(0, cap); changed = true; }
            });
          }
          // (2) regulatory heading shorten (grp rows in any rich_block / labeled_list)
          if (Array.isArray(sec.items)) {
            sec.items.forEach(function (it) {
              if (!it || typeof it !== 'object') return;
              var t = it.t != null ? String(it.t) : (it.group != null ? String(it.group) : '');
              if (/Environmental,\s*Durability\s*&\s*Materials\s*Compliance/i.test(t)) {
                var nt = t.replace(/Environmental,\s*Durability\s*&\s*Materials\s*Compliance/i, 'Environmental, Durability & Compliance');
                if (it.t != null) it.t = nt; else if (it.group != null) it.group = nt;
                changed = true;
              }
            });
          }
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'final-role-condense' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 500, 1500, 3000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvFinalRoleCondense = { version: VERSION, run: run };
})();
