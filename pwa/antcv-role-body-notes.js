/* antcv-role-body-notes.js — ROLE-BODY-NOTE-001 (owner 2026-10-01)
 * ============================================================================
 * Owner: "make sure that for the Trackman, it is clear that it is an internship
 * (inside the body, not header)". The role line (title / company / years) stays
 * as stored; the role BODY carries the note: the first bullet's bold label gets
 * " (internship)" ("Hardware Project Management (internship): Own the ..."), or,
 * for a bullet without a label, the bullet opens with "Internship: ".
 * Rules mirror gold-rules.json role_body_notes and quality_pass.py
 * rule_role_body_notes (headless pipeline). Fires only when no bullet or Results
 * line of that role already says "intern". Idempotent. CV only (sections.cv
 * experience roles[]). Self-disabling on any error.
 */
(function () {
  'use strict';
  var VERSION = '1.51.6105-academy-format';
  if (window.__antcvRoleBodyNotes === VERSION) return;
  window.__antcvRoleBodyNotes = VERSION;

  // ACADEMY-FORMAT-001 (2026-11-05, #3491 Kaleido, da): the note follows the CV language, and a
  // Danish / Spanish word for internship counts as "already says it". The English-only test put
  // "Internship: " on bullet 0 of a Danish role whose bullet 1 already opened "Praktik:".
  var NOTES = [
    { company: /trackman/i, present: /\b(?:intern(?:ship)?s?|praktik\w*|prácticas|practicas|pasant[ií]a\w*)\b/i,
      labelSuffix: { en: ' (internship)', da: ' (praktik)', es: ' (prácticas)' },
      prefix: { en: 'Internship: ', da: 'Praktik: ', es: 'Prácticas: ' } }
  ];
  function docLang() {
    var raw = '';
    try { raw = String(localStorage.getItem('language') || ''); } catch (_) {}
    try { var p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch (_) {}
    return /^da/i.test(raw) ? 'da' : (/^es/i.test(raw) ? 'es' : 'en');
  }

  function noteBullet(text, n) {
    var t = String(text || '');
    var m = t.match(/^([^:.]{2,48}):\s+(\S[\s\S]*)$/);
    var l = docLang();
    if (m) return m[1] + (n.labelSuffix[l] || n.labelSuffix.en) + ': ' + m[2];
    return (n.prefix[l] || n.prefix.en) + t;
  }
  function applyRole(r) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.bullets) || !r.bullets.length) return false;
    var head = String(r.company || '') + ' ' + String(r.title || '');
    for (var i = 0; i < NOTES.length; i++) {
      var n = NOTES[i];
      if (!n.company.test(head)) continue;
      var body = r.bullets.join(' ') + ' ' + String(r.results || '');
      if (n.present.test(body)) return false;
      if (typeof r.bullets[0] !== 'string') return false;
      r.bullets[0] = noteBullet(r.bullets[0], n);
      return true;
    }
    return false;
  }
  function run() {
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) {
        var s = secs.cv[i];
        if (!s || !Array.isArray(s.roles)) continue;
        for (var j = 0; j < s.roles.length; j++) { if (applyRole(s.roles[j])) changed = true; }
      }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'role-body-notes' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvRoleBodyNotes = { version: VERSION, run: run, applyRole: applyRole };
})();
