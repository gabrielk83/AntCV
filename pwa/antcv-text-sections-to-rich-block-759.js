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
 * Headline handling (owner 2026-06-22):
 *  - opening -> headlineOff (no lead-in; it's the first paragraph).
 *  - who / why / work_style -> headlineOff with the LABEL as the row's bold lead-in
 *    (b:"Who I am" / "Why this position"|"Why this company" / "Work style"). why's lead is dynamic:
 *    "Why this position" when a JD is loaded, else "Why this company" — kept in sync (see WHY_CANON).
 *  - profile -> keeps its real PROFILE section headline.
 *  title is still preserved on every converted section.
 *
 * Safety: idempotent + loop-safe (only converts while type is still text/text_inline; the
 * sections-updated re-dispatch converges in one pass). Self-disabling on any error. The generator
 * re-emits these as text on regen -> simply re-upgraded on the next pass.
 */
(function () {
  'use strict';
  var VERSION = '1.50.759b';
  if (window.__antcvTextSectionsToRichBlock759 === VERSION) return;
  window.__antcvTextSectionsToRichBlock759 = VERSION;

  // id -> { headlineOff, lead }. Only sections whose CURRENT type is text/text_inline convert.
  // who / why / work_style use the inline LEAD-IN pattern (headlineOff + the label as the row's
  // bold lead). why's lead is DYNAMIC: "Why this position" when a JD is loaded, else "Why this
  // company" (lead:null marks the dynamic case). profile keeps its real PROFILE headline.
  var MAP = {
    opening: { headlineOff: true, lead: '' },
    work_style: { headlineOff: true, lead: 'Work style' },
    who: { headlineOff: true, lead: 'Who I am' },
    why: { headlineOff: true, lead: null },
    profile: { headlineOff: false, lead: '' }
  };
  // The two canonical why leads — only RE-SYNC the lead while it is still one of these (i.e. the
  // user has not customised it), so the position/company flip never clobbers a manual edit.
  var WHY_CANON = { 'Why this position': 1, 'Why this company': 1 };
  function jdPresent() { try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; } catch (_) { return false; } }
  function whyLead() { return jdPresent() ? 'Why this position' : 'Why this company'; }

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
      if (!cfg) return s;
      // (1) initial conversion text/text_inline -> rich_block
      if (s.type === 'text' || s.type === 'text_inline') {
        changed = true;
        var lead = cfg.lead === null ? whyLead() : (cfg.lead || '');
        var ns = {
          id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block',
          items: [{ b: lead, t: s.content != null ? String(s.content) : '' }]
        };
        if (cfg.headlineOff) ns.headlineOff = true;
        if (s.hidden) ns.hidden = s.hidden;
        if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
        if (s.ruleOff) ns.ruleOff = s.ruleOff;
        return ns;
      }
      // (2) ongoing re-sync of the why lead-in (position <-> company) while still canonical
      if (s.id === 'why' && s.type === 'rich_block' && Array.isArray(s.items) && s.items[0] && WHY_CANON[s.items[0].b]) {
        var want = whyLead();
        if (s.items[0].b !== want) {
          changed = true;
          var items = s.items.slice();
          items[0] = Object.assign({}, items[0], { b: want });
          return Object.assign({}, s, { items: items });
        }
      }
      return s;
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
