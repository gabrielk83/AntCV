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
  var VERSION = '1.50.839-peel-fix';
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
        // CONTRIBUTE-PEEL-FIX-001 (owner 2026-06-24): repair an already-converted rich_block by
        // CONTENT, not by POSITION. The earlier code stripped the marker off WHATEVER sat first/last,
        // assuming they were always intro/closing — but for a plain generated bullet list those are
        // REAL bullets, so it left only the middle bullets markered ("markers on mid-bullets"). Now:
        // a genuine intro is the FIRST row ending with ":" (a lead-in; a real contribution bullet
        // never does), and a genuine closing is the LAST row only WHEN such a lead-in intro exists.
        // Every other row is a bullet and MUST keep/regain its marker. This both removes a marker
        // from a true intro/closing AND re-markers a real first/last bullet that was wrongly stripped.
        if (Array.isArray(s.items) && s.items.length >= 1) {
          var n = s.items.length;
          var firstIsLeadIn = /:\s*$/.test(bulletText(s.items[0]));
          var changedA = false;
          var fixedA = s.items.map(function (r, i) {
            var isIntro = (i === 0 && firstIsLeadIn);
            var isClosing = (i === n - 1 && firstIsLeadIn && n >= 2);
            var wantMk = !(isIntro || isClosing);
            // CONTRIBUTE-CHAROBJ-FIX-001 (owner 2026-06-24 "how I would contribute still empty"):
            // a STRING item that an earlier pass ran Object.assign({}, r) over became a CHAR-INDEXED
            // object {"0":"M","1":"a",...,mk:true} — the rich_block renderer reads .b/.t (absent) and
            // showed BLANK bullets. Heal a char-object back to {t}, and normalise a raw string to {t}
            // BEFORE any Object.assign (so it never re-corrupts).
            var row = r;
            if (typeof r === 'string') { row = { t: r }; }
            else if (r && typeof r === 'object' && r.b == null && r.t == null && r.v == null && r.content == null && !r.grp) {
              var ck = Object.keys(r).filter(function (k) { return /^\d+$/.test(k); });
              if (ck.length) {
                var str = ck.sort(function (a, b) { return (+a) - (+b); }).map(function (k) { return r[k]; }).join('');
                if (str) row = r.mk ? { t: str, mk: r.mk } : { t: str };
              }
            }
            var wrapped = (row !== r);
            var hasMk = !!(row && row.mk);
            if (wantMk && !hasMk) { changedA = true; var c = Object.assign({}, row); c.mk = true; return c; }
            if (!wantMk && hasMk) { changedA = true; var c2 = Object.assign({}, row); delete c2.mk; return c2; }
            if (wrapped) { changedA = true; return row; }
            return r;
          });
          if (changedA) { changed = true; return Object.assign({}, s, { items: fixedA }); }
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
      // CONTRIBUTE-PEEL-FIX-001 (owner 2026-06-24 "markers on mid-bullets"): the old peel
      // UNCONDITIONALLY stole items[0]->intro and items[last]->closing whenever the explicit
      // intro/closing fields were empty. For a plain generated bullet list (no intro/closing —
      // the common case when generation omits them), that demoted the FIRST and LAST real
      // bullets to markerless paragraphs, leaving only the MIDDLE bullets with markers (the
      // owner's exact symptom). Only peel the generated flat shape {items:[intro, bullet.., closing]}
      // when items[0] is a genuine LEAD-IN (ends with ":") — a real contribution bullet never
      // ends with a colon — and peel the closing ONLY when such an intro lead-in was actually
      // present, so a plain bullet list keeps ALL its markered bullets and loses none to a
      // phantom intro/closing. When the explicit intro/closing fields are set (the skeleton/
      // generated-with-fields shape), they win and no peel happens.
      var _peeledIntro = false;
      if (!intro && items.length && /:\s*$/.test(bulletText(items[0]))) {
        intro = bulletText(items.shift()); _peeledIntro = true;
      }
      if (!closing && _peeledIntro && items.length) closing = bulletText(items.pop());
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
