/* antcv-hwic-to-rich-block-760.js — RICH-BLOCK-001 / HWIC (owner 2026-06-22)
 * ============================================================================
 * Convert the cover letter HOW I WOULD CONTRIBUTE section (id "contribute",
 * type:"text_bullets" = intro paragraph + bullet list + closing paragraph) into the universal
 * `rich_block`, so it gains the full per-row + whole-section controls while keeping its look:
 *   intro    -> row { b:"", t:intro }                 (paragraph, no marker)
 *   each bullet -> row { b:"", t:bullet, mk:true }     (bullet marker ON — same as today)
 *   closing  -> row { b:"", t:closing }               (paragraph, no marker)
 * The "HOW I WOULD CONTRIBUTE" headline is kept (headlineOff:false). Each bullet row carries a
 * lead-in field the user can fill (Verb) so the tense engine can target the leading verb later.
 *
 * Safety: idempotent + loop-safe (only converts while type is still text_bullets; converges in one
 * pass). Self-disabling on any error. The generator re-emits text_bullets on regen -> re-upgraded.
 */
(function () {
  'use strict';
  var VERSION = '1.50.760c';
  if (window.__antcvHwicToRichBlock760 === VERSION) return;
  window.__antcvHwicToRichBlock760 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function bulletText(it) {
    if (it == null) return '';
    if (typeof it === 'string') return it;
    if (typeof it === 'object') return String(it.content || it.t || it.v || '');
    return String(it);
  }
  // SETTINGS PARITY: the old HWIC controls (antcv-how-contribute-controls-245.js) stored per-line
  // alignment in antcv.hiwc.alignment.v1 and per-line pages in antcv:itemPages[sid] under keys
  // intro / bullet_<k> / closing. rich_block reads antcvItemAlignment / antcv:itemPages under
  // items.<rowIndex>. Map the old keys onto the new row indices so saved settings carry over.
  function migrateHwicStores(sid, introPresent, bulletCount, closingPresent, rowCount) {
    try {
      var ok = ['left', 'center', 'right', 'justify'];
      var idxOf = function (key) {
        if (key === 'intro') return introPresent ? 0 : -1;
        var m = /^bullet_(\d+)$/.exec(key);
        if (m) { var k = +m[1]; return k < bulletCount ? (introPresent ? 1 : 0) + k : -1; }
        if (key === 'closing') return closingPresent ? rowCount - 1 : -1;
        return -1;
      };
      // alignment
      var hiwc = JSON.parse(localStorage.getItem('antcv.hiwc.alignment.v1') || '{}') || {};
      var al = JSON.parse(localStorage.getItem('antcvItemAlignment') || '{}') || {};
      var aT = false;
      Object.keys(hiwc).forEach(function (key) {
        var v = hiwc[key]; if (ok.indexOf(v) < 0) return;
        var i = idxOf(key); if (i < 0) return;
        if (!al[sid] || typeof al[sid] !== 'object') al[sid] = {};
        if (!al[sid]['items.' + i]) { al[sid]['items.' + i] = v; al[sid][String(i)] = v; aT = true; }
      });
      if (aT) localStorage.setItem('antcvItemAlignment', JSON.stringify(al));
      // pages
      var pg = JSON.parse(localStorage.getItem('antcv:itemPages') || '{}') || {};
      var src = pg[sid] || pg.how_i_would_contribute || null;
      if (src && typeof src === 'object') {
        var pT = false;
        Object.keys(src).forEach(function (key) {
          if (/^items\.|^\d+$/.test(key)) return; // already-new key
          var n = Number(src[key]); if (!(n >= 2)) return;
          var i = idxOf(key); if (i < 0) return;
          if (!pg[sid] || typeof pg[sid] !== 'object') pg[sid] = {};
          if (!pg[sid]['items.' + i]) { pg[sid]['items.' + i] = Math.round(n); pg[sid][String(i)] = Math.round(n); pT = true; }
        });
        if (pT) localStorage.setItem('antcv:itemPages', JSON.stringify(pg));
      }
    } catch (_) {}
  }
  function convertList(list) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'contribute') return s;
      // (A) REPAIR an already-converted rich_block whose intro/closing became markered bullets
      //     (the earlier 760 only handled the {intro,items,closing} skeleton shape; generated data
      //     keeps intro = items[0] and closing = items[last] inside items[], so they got mk:true).
      //     intro + closing must be MARKERLESS paragraphs; the rows between them keep their markers.
      if (s.type === 'rich_block') {
        if (Array.isArray(s.items) && s.items.length >= 2) {
          var first = s.items[0], last = s.items[s.items.length - 1];
          if ((first && first.mk) || (last && last.mk)) {
            changed = true;
            var fixed = s.items.map(function (r, i) {
              if ((i === 0 || i === s.items.length - 1) && r && r.mk) { var c2 = Object.assign({}, r); delete c2.mk; return c2; }
              return r;
            });
            return Object.assign({}, s, { items: fixed });
          }
        }
        return s;
      }
      if (s.type !== 'text_bullets') return s;
      // (B) CONVERT text_bullets -> rich_block. Handle BOTH shapes:
      //   skeleton  : { intro, items:[bullets], closing }
      //   generated : { items:[intro, bullet..., closing] }  (no separate intro/closing fields)
      changed = true;
      var items = Array.isArray(s.items) ? s.items.slice() : [];
      var intro = s.intro != null && String(s.intro).trim() ? String(s.intro) : '';
      var closing = s.closing != null && String(s.closing).trim() ? String(s.closing) : '';
      if (!intro && items.length) intro = bulletText(items.shift());
      if (!closing && items.length) closing = bulletText(items.pop());
      var rows = [];
      var introPresent = !!intro.trim();
      if (introPresent) rows.push({ b: '', t: intro });
      var bulletCount = 0;
      items.forEach(function (it) {
        var bt = bulletText(it);
        if (bt.trim() || bt === '') { rows.push({ b: '', t: bt, mk: true }); bulletCount++; }
      });
      var closingPresent = !!closing.trim();
      if (closingPresent) rows.push({ b: '', t: closing });
      if (!rows.length) rows.push({ b: '', t: '', mk: true });
      migrateHwicStores(s.id, introPresent, bulletCount, closingPresent, rows.length);
      var ns = {
        id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block', items: rows
      };
      if (s.hidden) ns.hidden = s.hidden;
      if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
      if (s.ruleOff) ns.ruleOff = s.ruleOff;
      return ns;
    });
    return { changed: changed, list: out };
  }
  function run() {
    try {
      var secs = readSections();
      var cl = convertList(secs.cl || []);
      var cv = convertList(secs.cv || []);
      if (!cl.changed && !cv.changed) return;
      if (cl.changed) secs.cl = cl.list;
      if (cv.changed) secs.cv = cv.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'hwic-to-rich-block-760' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 400, 1100, 2400].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvHwicToRichBlock = { version: VERSION, run: run };
})();
