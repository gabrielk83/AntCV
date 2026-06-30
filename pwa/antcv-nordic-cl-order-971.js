/* antcv-nordic-cl-order-971.js — NORDIC-CL-TEMPLATE-001 (owner 2026-06-29)
 * ============================================================================
 * Enforce the owner's Nordic cover-letter TEMPLATE order + structure on the live CL
 * sections, so the settings panel, the section list, the preview, and the export all
 * follow it. Source: CoverLetter_Template.docx. Scoped to Nordic-Minimal (toneRegister);
 * other styles untouched (owner: "for nordic minimal now, user may change in future").
 *
 * The per-section rich_block conversions already happen in their own sidecars
 * (foundation-758 -> Foundation/Hands-on(bullet)/Professionally(bullet); bring-761;
 * hwic-760 contribute; who/why lead-ins). This sidecar adds only what those don't:
 *
 *   1. ORDER — the template reorders the body:
 *        greeting -> opening -> why -> who -> foundation -> bring -> contribute -> closure
 *      (today's me() order is who -> bring -> why -> contribute -> foundation). Unknown
 *      sections (e.g. jd_questions, page 2) keep their relative order AFTER the known set.
 *   2. BRING rows = VISIBLE BULLETS — the [Need]: [action] rows under the "What I bring"
 *      lead-in get mk:true (the template shows them as bullets); the lead-in row stays a
 *      paragraph. Headline stays hidden (bring-761 already sets headlineOff).
 *
 * It layers on top of the converters: it only reorders + flips a marker, never changes a
 * section TYPE, so the other sidecars see no type change and don't churn. Idempotent
 * (writes only when the order or a bring marker actually changes) -> the sections-updated
 * re-dispatch converges. Self-disabling on any error. Disable: localStorage
 * ['antcv:disable-nordic-cl-order'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.994-nordic-cl-order';
  if (window.__antcvNordicClOrder971 === VERSION) return;
  window.__antcvNordicClOrder971 = VERSION;

  // The canonical Nordic CL body order (by section id). The positioning line is the F1
  // slogan (rendered above the body, not a section). Sign-off + AI notice are separate.
  var ORDER = ['greeting', 'opening', 'why', 'who', 'foundation', 'bring', 'contribute', 'closure'];

  // NORDIC-CL-TEMPLATE-SEED-001 (owner 2026-06-29): the per-section converters create the bring
  // lead-in with an EMPTY body and leave foundation Hands-on/Professionally empty/old, so the live
  // document loses the template's authoring INSTRUCTIONS (the bracketed guidance). Seed them when a
  // body is empty OR an old bracketed placeholder (never over real content). Verbatim from
  // CoverLetter_Template.docx (docs/qa/nordic-cl-template-2026-06-29.md).
  var INSTR = {
    bring: "[INTRO LINE - one short, plain phrase naming what you bring, no overselling: an anchor word then the areas it covers (e.g. \"structure - across scope, suppliers, validation, and business decisions\"). End with a colon.] [Then give 3-4 skills as the bullets below, matched from Company Info + Leads + JD (unsolicited: company info + role type, mark assumptions). Evidence = real proof points, prefer a measurable one (%, count, time/cost change, shipped output, team size); never invent numbers. Follow the WRITING RULES above.]",
    handsOn: "[Select only skills that match Company Info + Holistic Leads + Specific Leads + JD analysis. Example shape: name 4-6 concrete, JD-relevant skills from your own toolkit (methods, tools, domains you actually use), comma-separated.]",
    professionally: "[Translate those skills into value for this company and role. Example shape: turn your inputs into a clear outcome the employer cares about, while keeping the relevant stakeholders aligned.]"
  };
  // seed when EMPTY or a bracketed placeholder, and not already the instruction (idempotent);
  // real content (does not start with "[") is preserved.
  function needsSeed(t) { var s = String(t == null ? '' : t).trim(); return !s || /^\[/.test(s); }

  function disabled() { try { var v = localStorage.getItem('antcv:disable-nordic-cl-order'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isNordicMinimal() {
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); return v === 'nordic-minimal' || v === 'scandinavian'; } } catch (_) {}
    return false;
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; }
  }

  // Reorder cl into ORDER; unknown ids keep their original relative order, appended after.
  function reorder(list) {
    if (!Array.isArray(list) || list.length < 2) return { changed: false, list: list };
    var known = [], unknown = [];
    ORDER.forEach(function (id) {
      var s = list.filter(function (x) { return x && x.id === id; });
      known = known.concat(s);
    });
    list.forEach(function (s) { if (!s || ORDER.indexOf(s.id) < 0) unknown.push(s); });
    var out = known.concat(unknown);
    // changed only if the id sequence actually differs
    var before = list.map(function (s) { return s && s.id; }).join('|');
    var after = out.map(function (s) { return s && s.id; }).join('|');
    return { changed: before !== after, list: out };
  }

  // BRING: the rows after the "What I bring" lead-in render as visible bullets (mk:true).
  // The lead-in is the FIRST row (a markerless {b:title, t}); every later data row gets mk.
  function bringBullets(list) {
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'bring' || s.type !== 'rich_block' || !Array.isArray(s.items) || s.items.length < 2) return s;
      var items = s.items.map(function (r, i) {
        if (i === 0) return r;                         // lead-in stays a paragraph
        if (r && typeof r === 'object' && r.mk !== true) { changed = true; return Object.assign({}, r, { mk: true }); }
        return r;
      });
      if (!changed) return s;
      return Object.assign({}, s, { items: items });
    });
    return { changed: changed, list: out };
  }

  // CONTRIBUTE: the closing row (the LAST markerless row, after the bullets) carries the
  // "Goal" lead-in per the template ("Goal: [outcome]"). hwic-760 leaves it markerless with
  // no lead-in; give it b:"Goal" when its lead-in is empty. Idempotent; never overrides a
  // real lead-in. (me()'s Nordic skeleton already seeds this; this is for GENERATED CLs.)
  function contributeGoal(list) {
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'contribute' || s.type !== 'rich_block' || !Array.isArray(s.items) || s.items.length < 3) return s;
      var n = s.items.length, last = s.items[n - 1];
      // last must be a markerless paragraph (the closing), preceded by at least one bullet
      var hasBulletBefore = s.items.slice(1, n - 1).some(function (r) { return r && r.mk; });
      if (!last || typeof last !== 'object' || last.mk || !hasBulletBefore) return s;
      var lead = last.b == null ? '' : String(last.b).trim();
      if (lead) return s;                                  // already has a lead-in -> leave it
      var items = s.items.slice(); items[n - 1] = Object.assign({}, last, { b: 'Goal' });
      changed = true;
      return Object.assign({}, s, { items: items });
    });
    return { changed: changed, list: out };
  }

  // Seed the template INSTRUCTIONS into empty/placeholder bodies (NORDIC-CL-TEMPLATE-SEED-001):
  // bring lead-in (item 0) + foundation Hands-on/Professionally rows. Real content is preserved.
  function seedInstructions(list) {
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.type !== 'rich_block' || !Array.isArray(s.items) || !s.items.length) return s;
      if (s.id === 'bring') {
        var lead = s.items[0];
        if (!lead || typeof lead !== 'object' || lead.mk) return s;
        // BRING-LEADIN-CLEAN-001 (owner 2026-06-30): the lead-in instruction is GUIDANCE for a blank
        // template only. Once the data rows are GENERATED (real), the "[Select 3-4 …]" instruction must
        // NOT show — keep just the "What I bring" label. Seed the instruction ONLY when the data rows
        // are still empty/placeholder (template mode). Never touch a real lead-in the user typed.
        var dataReal = s.items.slice(1).some(function (r) { var t = String((r && r.t) || '').trim(); return t && !/^\[/.test(t); });
        if (needsSeed(lead.t)) {
          var want = dataReal ? '' : INSTR.bring;
          if (String(lead.t == null ? '' : lead.t) !== want) {
            var it = s.items.slice(); it[0] = Object.assign({}, lead, { t: want });
            changed = true; return Object.assign({}, s, { items: it });
          }
        }
        return s;
      }
      if (s.id === 'foundation') {
        var it2 = s.items.slice(); var touched = false;
        for (var i = 0; i < it2.length; i++) {
          var r = it2[i]; if (!r || typeof r !== 'object') continue;
          var want = r.b === 'Hands-on' ? INSTR.handsOn : r.b === 'Professionally' ? INSTR.professionally : null;
          if (want && needsSeed(r.t) && r.t !== want) { it2[i] = Object.assign({}, r, { t: want }); touched = true; }
        }
        if (touched) { changed = true; return Object.assign({}, s, { items: it2 }); }
        return s;
      }
      return s;
    });
    return { changed: changed, list: out };
  }

  function run() {
    try {
      if (disabled() || !isNordicMinimal()) return;
      var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
      var a = reorder(secs.cl);
      var b = bringBullets(a.list);
      var g = contributeGoal(b.list);
      var sd = seedInstructions(g.list);
      if (!a.changed && !b.changed && !g.changed && !sd.changed) return;
      secs.cl = sd.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'nordic-cl-order-971' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // Run after the per-section converters settle (they use 0/300/900/2000 + late timers),
  // and on later windows to catch a cloud-restore / regen that rewrites cl.
  [350, 1100, 2600, 5000, 9000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvNordicClOrder = { version: VERSION, run: run, ORDER: ORDER };
})();
