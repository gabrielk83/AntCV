/* antcv-text-sections-to-rich-block-759.js — RICH-BLOCK-001 Phase C (owner 2026-06-22)
 * ============================================================================
 * Convert the named single-paragraph sections into the universal `rich_block` so they gain the
 * full per-row + whole-section controls:
 *   CL: opening, who (WHO I AM), why (WHY THIS POSITION/COMPANY)
 *   CV: profile, work_style
 * Each is `type:"text"` (work_style is `type:"text_inline"`) with a single `content` string ->
 * one rich_block row { b: <lead>, t: content }.
 *
 * NOT closure: the CL `closure` is rendered as the sign-off paragraph (a special preview + export
 * path that reads closure.content directly, outside the generic section loop) and already has its
 * own inline editor (antcv-cl-closure-editable-341.js). Converting it to rich_block would blank the
 * sign-off. Teaching those closure-content readers about rich_block is a separate dedicated change.
 *
 * Headline handling preserves today's look:
 *  - opening / closure / work_style render with NO section title today -> headlineOff:true.
 *  - who / why / profile show their heading -> headline kept (so the WHY/WHO heading-flip by JD,
 *    which mutates section.title, keeps working — title is preserved here).
 *  - work_style's title is an inline bold label today -> carry it as the row lead-in (b:"Work style").
 *
 * Safety: idempotent + loop-safe (only converts while type is still text/text_inline; the
 * sections-updated re-dispatch converges in one pass). Self-disabling on any error. The generator
 * re-emits these as text on regen -> simply re-upgraded on the next pass.
 */
(function () {
  'use strict';
  var VERSION = '1.50.759';
  if (window.__antcvTextSectionsToRichBlock759 === VERSION) return;
  window.__antcvTextSectionsToRichBlock759 = VERSION;

  // id -> { headlineOff, lead }. Only sections whose CURRENT type is text/text_inline convert.
  var MAP = {
    opening: { headlineOff: true, lead: '' },
    work_style: { headlineOff: true, lead: 'Work style' },
    who: { headlineOff: false, lead: '' },
    why: { headlineOff: false, lead: '' },
    profile: { headlineOff: false, lead: '' }
  };

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function convertList(list) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s) return s;
      var cfg = MAP[s.id];
      if (!cfg || (s.type !== 'text' && s.type !== 'text_inline')) return s;
      changed = true;
      var ns = {
        id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block',
        items: [{ b: cfg.lead || '', t: s.content != null ? String(s.content) : '' }]
      };
      if (cfg.headlineOff) ns.headlineOff = true;
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
      var cv = convertList(secs.cv || []);
      var cl = convertList(secs.cl || []);
      if (!cv.changed && !cl.changed) return;
      if (cv.changed) secs.cv = cv.list;
      if (cl.changed) secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'text-sections-to-rich-block-759' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 350, 1000, 2200].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvTextSectionsToRichBlock = { version: VERSION, run: run, map: MAP };
})();
