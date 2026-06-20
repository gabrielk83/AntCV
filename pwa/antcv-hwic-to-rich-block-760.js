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
  var VERSION = '1.50.760';
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
  function convertList(list) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'contribute' || s.type !== 'text_bullets') return s;
      changed = true;
      var rows = [];
      var intro = s.intro != null ? String(s.intro) : '';
      var closing = s.closing != null ? String(s.closing) : '';
      if (intro.trim()) rows.push({ b: '', t: intro });
      (Array.isArray(s.items) ? s.items : []).forEach(function (it) {
        var bt = bulletText(it);
        if (bt.trim() || bt === '') rows.push({ b: '', t: bt, mk: true });
      });
      if (closing.trim()) rows.push({ b: '', t: closing });
      if (!rows.length) rows.push({ b: '', t: '', mk: true });
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
