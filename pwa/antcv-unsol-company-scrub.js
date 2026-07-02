/* antcv-unsol-company-scrub.js — GEN-UNSOL-STALE-JD-001 Patch D (register row 15)
 * ============================================================================
 * "Scrub known prior company from prose when meta.company comes back empty."
 * Patches A-C (1.51.54) stopped a stale JD from HIJACKING an unsolicited gen;
 * CL-PROSE-UNSOL-POISON-001 (1.51.75) stopped the prose-loss guard RE-APPLYING a
 * targeted company's CL body. This closes the last leg: when an application is
 * unsolicited (meta.company empty or "Unsolicited") but a PRIOR targeted company
 * name still sits inside the generated prose (CV or CL), replace that company
 * name with a neutral phrase.
 *
 * SAFETY (never touch real data):
 *  - the prior company comes ONLY from antcv:activeAppCompany (the identity
 *    guard's own key; JD-scope-namespaced per tab since 1.51.72);
 *  - NEVER scrubbed when the name matches one of the candidate's OWN employers
 *    (personalInfo.workHistory + the experience roles) — employer names are
 *    real CV facts, not poison;
 *  - word-boundary, case-insensitive, whole-string replacement writes; a write
 *    happens only when something actually changed (no event loops).
 * Kill: localStorage['antcv:disable-unsol-company-scrub']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.77-unsol-company-scrub';
  if (window.__antcvUnsolCompanyScrub === VERSION) return;
  window.__antcvUnsolCompanyScrub = VERSION;

  var NEUTRAL = 'your organisation';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-unsol-company-scrub'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  function isUnsolicited() {
    var m = readJson('meta', {}) || {};
    var c = String(m.company || '').trim().toLowerCase();
    return c === '' || c === 'unsolicited';
  }

  function priorCompany() {
    var v = '';
    try { v = String(localStorage.getItem('antcv:activeAppCompany') || '').trim(); } catch (_) {}
    if (!v || v.length < 3) return '';
    if (/^unsolicited$/i.test(v)) return '';
    return v;
  }

  function employerNames() {
    var out = [];
    try {
      var p = readJson('personalInfo', {}) || {};
      p = p.personalInfo || p;
      (Array.isArray(p.workHistory) ? p.workHistory : []).forEach(function (r) {
        if (r && r.company) out.push(String(r.company));
      });
    } catch (_) {}
    try {
      var secs = readJson('sections', {}) || {};
      (Array.isArray(secs.cv) ? secs.cv : []).forEach(function (s) {
        if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return;
        s.roles.forEach(function (r) { if (r && r.company) out.push(String(r.company)); });
      });
    } catch (_) {}
    return out;
  }

  function isEmployer(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return true; // treat unknown as protected
    var emps = employerNames();
    for (var i = 0; i < emps.length; i++) {
      var e = emps[i].trim().toLowerCase();
      if (!e) continue;
      if (e === n || e.indexOf(n) !== -1 || n.indexOf(e) !== -1) return true;
    }
    return false;
  }

  function escRe(s) { return String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); }

  function scrubString(text, re) {
    if (typeof text !== 'string' || !text) return text;
    if (!re.test(text)) { re.lastIndex = 0; return text; }
    re.lastIndex = 0;
    return text.replace(re, NEUTRAL);
  }

  // Walk every string field of a section list; returns [changedCount, newList].
  function scrubList(list, re) {
    if (!Array.isArray(list)) return [0, list];
    var changed = 0;
    var out = list.map(function (s) {
      if (!s || typeof s !== 'object') return s;
      var ns = s, patch = null;
      var c = scrubString(s.content, re);
      if (c !== s.content) { (patch = patch || {}).content = c; }
      if (Array.isArray(s.items)) {
        var hit = false;
        var items = s.items.map(function (it) {
          if (typeof it === 'string') { var v = scrubString(it, re); if (v !== it) { hit = true; return v; } return it; }
          if (it && typeof it === 'object') {
            var p = null;
            ['t', 'b', 'l', 'v', 'value', 'label'].forEach(function (k) {
              var nv = scrubString(it[k], re);
              if (nv !== it[k]) { (p = p || {})[k] = nv; }
            });
            if (p) { hit = true; return Object.assign({}, it, p); }
          }
          return it;
        });
        if (hit) { (patch = patch || {}).items = items; }
      }
      if (Array.isArray(s.roles)) {
        var rhit = false;
        var roles = s.roles.map(function (r) {
          if (!r || typeof r !== 'object') return r;
          var p = null;
          var res = scrubString(r.results, re);
          if (res !== r.results) { (p = p || {}).results = res; }
          if (Array.isArray(r.bullets)) {
            var bhit = false;
            var bullets = r.bullets.map(function (b) {
              if (typeof b !== 'string') return b;
              var nb = scrubString(b, re); if (nb !== b) { bhit = true; return nb; } return b;
            });
            if (bhit) { (p = p || {}).bullets = bullets; }
          }
          if (p) { rhit = true; return Object.assign({}, r, p); }
          return r;
        });
        if (rhit) { (patch = patch || {}).roles = roles; }
      }
      if (patch) { changed++; ns = Object.assign({}, s, patch); }
      return ns;
    });
    return [changed, out];
  }

  function run() {
    if (disabled()) return;
    try {
      if (!isUnsolicited()) return;
      var prior = priorCompany();
      if (!prior) return;
      if (isEmployer(prior)) return; // an employer name is a CV fact — never scrub
      var secs = readJson('sections', null);
      if (!secs || typeof secs !== 'object') return;
      var re = new RegExp('\\b' + escRe(prior) + '\\b', 'gi');
      var cv = scrubList(secs.cv, re), cl = scrubList(secs.cl, re);
      if (!cv[0] && !cl[0]) return;
      secs = Object.assign({}, secs, { cv: cv[1], cl: cl[1] });
      localStorage.setItem('sections', JSON.stringify(secs));
      try { console.log('[unsol-company-scrub] Patch D scrubbed "' + prior + '" from ' + (cv[0] + cl[0]) + ' section(s)'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'unsol-company-scrub' } })); } catch (_) {}
    } catch (_) { /* never break the app */ }
  }

  window.addEventListener('antcv:sections-updated', function (ev) {
    try { if (ev && ev.detail && ev.detail.reason === 'unsol-company-scrub') return; } catch (_) {}
    setTimeout(run, 400);
  });
  [800, 2500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvUnsolCompanyScrub = { version: VERSION, run: run, _scrubList: scrubList, _isEmployer: isEmployer, _priorCompany: priorCompany };
})();
