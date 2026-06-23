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
  var VERSION = '1.50.817';
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
  // The canonical leads — only INJECT/RE-SYNC while the lead is empty OR still one of
  // these (i.e. the user has not customised it), so the flip never clobbers a manual edit.
  var WHY_CANON = { 'Why this position': 1, 'Why this company': 1 };
  var WHO_CANON = { 'Who I am': 1, 'Hvem er jeg': 1 };
  function jdPresent() { try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; } catch (_) { return false; } }
  function whyLead() { return jdPresent() ? 'Why this position' : 'Why this company'; }
  // CL-LEADIN-KEEP-001 (owner 2026-06-23: "keep the who i am and why this company/position
  // in the lead-ins"): when GENERATION emits who/why directly as a rich_block (not text), the
  // text->rich_block branch never runs, so the lead-in `b` is whatever the LLM put there —
  // often empty. Inject the canonical lead-in whenever `b` is empty/missing (and re-sync the
  // why position<->company flip while canonical). Applies to every application on every load,
  // and the result autosaves, so it is not limited to the current document.
  function leadFor(id) { return id === 'who' ? 'Who I am' : whyLead(); }
  function canonFor(id) { return id === 'who' ? WHO_CANON : WHY_CANON; }

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
        // who/why render the lead-in as "Who I am: ..." / "Why this position: ..."
        if (s.id === 'who' || s.id === 'why') ns.leadColon = true;
        if (s.hidden) ns.hidden = s.hidden;
        if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
        if (s.ruleOff) ns.ruleOff = s.ruleOff;
        return ns;
      }
      // (2) ongoing lead-in maintenance for who/why already in rich_block form:
      //     INJECT the canonical lead when `b` is empty/missing (the generated-rich_block
      //     case), and re-sync the why position<->company flip while still canonical. Never
      //     clobber a user-customised lead. Also ensure the lead-in colon separator.
      if ((s.id === 'who' || s.id === 'why') && s.type === 'rich_block' && Array.isArray(s.items) && s.items[0]) {
        var cur = String(s.items[0].b || '').trim();
        var want = leadFor(s.id);
        var next = s, mutated = false;
        if ((!cur || canonFor(s.id)[cur]) && s.items[0].b !== want) {
          var items = s.items.slice();
          items[0] = Object.assign({}, items[0], { b: want });
          next = Object.assign({}, next, { items: items });
          mutated = true;
        }
        if (next.leadColon !== true) { next = Object.assign({}, next, { leadColon: true }); mutated = true; }
        if (mutated) { changed = true; return next; }
      }
      return s;
    });
    return { changed: changed, list: out };
  }
  // SETTINGS PARITY: the old profile/work_style CJLR (antcv-profile-workstyle-cjlr-238.js) stored a
  // single paragraph alignment per section in antcv.profileWorkstyleParagraphAlignment.v1. rich_block
  // reads antcvItemAlignment instead, so carry any saved value over to the section group + row 0.
  function migrateControls() {
    try {
      var pw = JSON.parse(localStorage.getItem('antcv.profileWorkstyleParagraphAlignment.v1') || '{}') || {};
      if (!pw || (!pw.profile && !pw.work_style)) return;
      var ok = ['left', 'center', 'right', 'justify'];
      var al = JSON.parse(localStorage.getItem('antcvItemAlignment') || '{}') || {};
      var touched = false;
      ['profile', 'work_style'].forEach(function (id) {
        var v = pw[id];
        if (!v || ok.indexOf(v) < 0) return;
        if (!al[id] || typeof al[id] !== 'object') al[id] = {};
        if (!al[id].__group__) { al[id].__group__ = v; touched = true; }
        if (!al[id]['items.0']) { al[id]['items.0'] = v; al[id]['0'] = v; touched = true; }
      });
      if (touched) localStorage.setItem('antcvItemAlignment', JSON.stringify(al));
    } catch (_) {}
  }
  function run() {
    try {
      var secs = readSections();
      var cv = convertList(secs.cv || []);
      var cl = convertList(secs.cl || []);
      if (!cv.changed && !cl.changed) { migrateControls(); return; }
      if (cv.changed) secs.cv = cv.list;
      if (cl.changed) secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      migrateControls();
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'text-sections-to-rich-block-759' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 350, 1000, 2200].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvTextSectionsToRichBlock = { version: VERSION, run: run, map: MAP };
})();
