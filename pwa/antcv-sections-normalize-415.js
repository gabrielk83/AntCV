/* AntCV sections normalizer (restore-proof).
 * ============================================================
 * Two stored-section rules kept failing because the kernel cloud-restore
 * ([KERNEL-CLOUD-PERSIST] reapplies a stale slot AFTER the React
 * normalization effects run, so the order/title reverts:
 *   - RECOMMENDATIONS must sit after the LAST of experience / PROFESSIONAL
 *     EXPERTISE (owner 2026-06-13).
 *   - "Founder" must not appear in a role title (kept "Independent" for
 *     consultancy) (owner 2026-06-13).
 * This sidecar re-applies both on every antcv:sections-updated (the event
 * the restore itself fires) plus a short boot sweep, reading + writing
 * localStorage directly so React/restore ordering can't out-race it.
 * Loop-safe: writes only on a real change, tags its own event, and ignores
 * that tag.
 */
(function () {
  'use strict';
  var VERSION = '1.50.415';
  if (window.__antcvSectionsNormalize === VERSION) return;
  window.__antcvSectionsNormalize = VERSION;

  var SRC = 'sections-normalize-415';

  function isRec(e) {
    return e && (e.id === 'recommendations' ||
      /RECOMMENDATIONS|REFERENCER|ANBEFALINGER|RECOMENDACIONES|推荐人/i.test(String(e.title || '')));
  }
  function isAnchor(e) {
    return e && !isRec(e) && (e.type === 'experience' ||
      (e.loc === 'main' && /PROFESSIONAL EXPERTISE|\bEXPERTISE\b|EKSPERTISE/i.test(String(e.title || ''))));
  }

  function stripFounder(cv) {
    var touched = false;
    var out = cv.map(function (s) {
      if (!s || s.type !== 'experience' || !Array.isArray(s.roles)) return s;
      var roles = s.roles.map(function (r) {
        if (!r || !r.title || !/\bfounder\b/i.test(String(r.title))) return r;
        var cleaned = String(r.title)
          .replace(/\bco[-\s]?founder\b/gi, '')
          .replace(/\bfounder\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[\s&,/|-]+|[\s&,/|-]+$/g, '')
          .replace(/\s+[&,/|]\s*$/g, '')
          .trim();
        if (cleaned && cleaned !== r.title) { touched = true; return Object.assign({}, r, { title: cleaned }); }
        return r;
      });
      return touched ? Object.assign({}, s, { roles: roles }) : s;
    });
    return touched ? out : null;
  }

  function placeRecs(cv) {
    var anchor = -1;
    cv.forEach(function (e, i) { if (isAnchor(e)) anchor = i; });
    if (anchor < 0) return null;
    var ri = cv.findIndex(isRec);
    if (ri === anchor + 1) return null; // already in place
    var copy = cv.slice();
    var rec;
    if (ri >= 0) rec = copy.splice(ri, 1)[0];
    else rec = { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'text', content: 'Danish and international recommenders on request.' };
    var a2 = -1;
    copy.forEach(function (e, i) { if (isAnchor(e)) a2 = i; });
    if (a2 < 0) return null;
    copy.splice(a2 + 1, 0, rec);
    return copy;
  }

  // ROLE-DUP-001 consolidated here (was a React effect that the restore
  // out-raced): same company + overlapping years + one title contained in
  // the other -> ONE merged role with the fuller title.
  function dedupeRoles(cv) {
    var xi = cv.findIndex(function (e) { return e && e.type === 'experience' && Array.isArray(e.roles); });
    if (xi < 0) return null;
    var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    var yearsOf = function (s) { return (String(s || '').match(/\d{4}/g) || []).map(Number); };
    var overlap = function (a, b) {
      var ya = yearsOf(a), yb = yearsOf(b);
      if (!ya.length || !yb.length) return true;
      return Math.min.apply(null, ya) <= Math.max.apply(null, yb) && Math.min.apply(null, yb) <= Math.max.apply(null, ya);
    };
    var roles = cv[xi].roles.slice();
    var drop = {};
    for (var i = 0; i < roles.length; i++) for (var j = 0; j < roles.length; j++) {
      if (i === j || drop[i] || drop[j]) continue;
      var a = roles[i], b = roles[j];
      if (!a || !b) continue;
      var ta = norm(a.title), tb = norm(b.title);
      if (!ta || !tb || tb.indexOf(ta) < 0) continue; // a contained in b
      if (norm(a.company) !== norm(b.company)) continue;
      if (!overlap(a.years, b.years)) continue;
      drop[i] = true;
      if (a.on !== false) b.on = true;
      if ((!Array.isArray(b.bullets) || !b.bullets.length) && Array.isArray(a.bullets) && a.bullets.length) b.bullets = a.bullets;
    }
    var keys = Object.keys(drop);
    if (!keys.length) return null;
    var kept = roles.filter(function (_, i) { return !drop[i]; });
    var copy = cv.slice();
    copy[xi] = Object.assign({}, copy[xi], { roles: kept });
    return copy;
  }

  function normalize() {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return;
      var b = JSON.parse(raw);
      if (!b || !Array.isArray(b.cv) || !b.cv.length) return;
      var cv = b.cv;
      var changed = false;
      var d = dedupeRoles(cv); if (d) { cv = d; changed = true; }
      var f = stripFounder(cv); if (f) { cv = f; changed = true; }
      var p = placeRecs(cv); if (p) { cv = p; changed = true; }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(Object.assign({}, b, { cv: cv })));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.log('[sections-normalize-415] re-applied recommendations placement / founder strip after restore'); } catch (_) {}
    } catch (_) {}
  }

  var t = null;
  function schedule(ev) {
    if (ev && ev.detail && ev.detail.source === SRC) return; // ignore our own write
    clearTimeout(t); t = setTimeout(normalize, 120);
  }
  window.addEventListener('antcv:sections-updated', schedule);
  // boot sweep: catch the restore that fires before listeners attach
  [400, 1200, 3000].forEach(function (ms) { setTimeout(normalize, ms); });

  window.AntcvSectionsNormalize = { version: VERSION, _normalize: normalize };
  try { console.debug('[sections-normalize-415] installed v' + VERSION); } catch (_) {}
})();
