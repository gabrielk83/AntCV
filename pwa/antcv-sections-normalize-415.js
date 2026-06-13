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
    else return null; // nothing to move (insertion stays the React effect's job)
    var a2 = -1;
    copy.forEach(function (e, i) { if (isAnchor(e)) a2 = i; });
    if (a2 < 0) return null;
    copy.splice(a2 + 1, 0, rec);
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
