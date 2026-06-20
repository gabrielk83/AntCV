/* antcv-foundation-to-rich-block-758.js — RICH-BLOCK-001 Phase B (owner 2026-06-22)
 * ============================================================================
 * Convert the legacy two-paragraph `foundation` section (hands_on + professionally)
 * into the universal composite `rich_block` so it gains the full per-row + whole-
 * section controls (headline/rule toggles, CJLR, Page, Enhance, Fit, add/delete rows).
 *
 * Mapping: { type:"foundation", hands_on, professionally } ->
 *   { type:"rich_block", items:[ {b:"Hands-on", t:hands_on}, {b:"Professionally", t:professionally} ] }
 * keeping id / title / loc / on / hidden. Any saved foundation per-part alignment/page
 * (antcv.foundationControls.v1) carries over to the per-row stores (antcvItemAlignment /
 * antcv:itemPages) so nothing the user tuned is lost.
 *
 * Safety:
 *  - Idempotent + loop-safe: only converts sections whose type is still "foundation"; once
 *    converted there is nothing to do, so the sections-updated re-dispatch converges in one pass.
 *  - Runs on both CV and CL (foundation can live in either). Self-disabling on any error.
 *  - The generator may re-emit a foundation on regen; this simply re-upgrades it on the next pass.
 */
(function () {
  'use strict';
  var VERSION = '1.50.758';
  if (window.__antcvFoundationToRichBlock758 === VERSION) return;
  window.__antcvFoundationToRichBlock758 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function convertList(list, idsOut) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.type !== 'foundation') return s;
      changed = true;
      idsOut.push(s.id);
      var ns = {
        id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block',
        items: [
          { b: 'Hands-on', t: s.hands_on != null ? String(s.hands_on) : '' },
          { b: 'Professionally', t: s.professionally != null ? String(s.professionally) : '' }
        ]
      };
      if (s.hidden) ns.hidden = s.hidden;
      if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
      if (s.headlineOff) ns.headlineOff = s.headlineOff;
      if (s.ruleOff) ns.ruleOff = s.ruleOff;
      return ns;
    });
    return { changed: changed, list: out };
  }
  function migrateControls(ids) {
    if (!ids.length) return;
    try {
      var fc = JSON.parse(localStorage.getItem('antcv.foundationControls.v1') || '{}') || {};
      if (!fc || (!fc.hands_on && !fc.professionally)) return;
      var al = JSON.parse(localStorage.getItem('antcvItemAlignment') || '{}') || {};
      var pg = JSON.parse(localStorage.getItem('antcv:itemPages') || '{}') || {};
      var parts = [['hands_on', 0], ['professionally', 1]];
      var ok = ['left', 'center', 'right', 'justify'];
      ids.forEach(function (sid) {
        parts.forEach(function (p) {
          var c = fc[p[0]]; if (!c) return;
          if (c.align && ok.indexOf(c.align) >= 0) {
            if (!al[sid] || typeof al[sid] !== 'object') al[sid] = {};
            al[sid]['items.' + p[1]] = c.align; al[sid][String(p[1])] = c.align;
          }
          var n = Number(c.page);
          if (isFinite(n) && n >= 2) {
            if (!pg[sid] || typeof pg[sid] !== 'object') pg[sid] = {};
            pg[sid][String(p[1])] = Math.round(n); pg[sid]['items.' + p[1]] = Math.round(n);
          }
        });
      });
      localStorage.setItem('antcvItemAlignment', JSON.stringify(al));
      localStorage.setItem('antcv:itemPages', JSON.stringify(pg));
    } catch (_) {}
  }
  function run() {
    try {
      var secs = readSections();
      var ids = [];
      var cv = convertList(secs.cv || [], ids);
      var cl = convertList(secs.cl || [], ids);
      if (!cv.changed && !cl.changed) return;
      if (cv.changed) secs.cv = cv.list;
      if (cl.changed) secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      migrateControls(ids);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'foundation-to-rich-block-758' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvFoundationToRichBlock = { version: VERSION, run: run };
})();
