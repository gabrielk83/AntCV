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
  var VERSION = '1.51.1943-nordic-cl-order-v5';
  if (window.__antcvNordicClOrder971 === VERSION) return;
  window.__antcvNordicClOrder971 = VERSION;

  // The canonical Nordic CL body order (by section id). The positioning line is the F1
  // slogan (rendered above the body, not a section). Sign-off + AI notice are separate.
  //
  // CL-V5-STRUCT-001 (owner 2026-07-21, docs/plan/AntCV_Generation_Upgrade_Plan_2026-07-17.md §1):
  // v5 splits employer NEED / candidate EVIDENCE / proposed APPROACH into three separate
  // subsections and moves the identity block to the END:
  //   greeting -> opening -> why -> role_view -> bring -> contribute -> who -> closure
  // `role_view` ("How I see the role") is NEW; `foundation` is folded into the end-block
  // "Who I am" and rides at the tail so a legacy CL that still carries real foundation
  // content keeps rendering it instead of losing it.
  var ORDER = ['greeting', 'opening', 'why', 'role_view', 'bring', 'contribute', 'who', 'foundation', 'closure'];

  // The v5 "How I see the role" template, inserted once into a pre-v5 CL (see migrateV5).
  // Mirrors the me() skeleton — employer PROBLEM only, three bullets, no candidate evidence.
  var ROLE_VIEW_TEMPLATE = {
    id: 'role_view', title: 'HOW I SEE THE ROLE', loc: 'main', on: true,
    type: 'rich_block', headlineOff: true, leadColon: true,
    items: [
      { b: 'How I see the role', t: '[LEAD SENTENCE - one line naming the connected priorities the work centres on, ending with a colon (example shape: "The work appears to centre on three connected priorities:").]' },
      { b: '[Employer priority 1 - short label]', t: "[ONE sentence stating the EMPLOYER'S problem only - what this role has to solve. NO candidate evidence, NO proposed solution, no \"I\".]", mk: true },
      { b: '[Employer priority 2 - short label]', t: '[ONE sentence stating the second employer problem. Employer-centred only.]', mk: true },
      { b: '[Employer priority 3 - short label]', t: '[ONE sentence stating the third employer problem. Employer-centred only.]', mk: true }
    ]
  };

  // Rows AFTER the lead-in render as visible bullets in these v5 sections.
  var BULLET_SECTIONS = { bring: 1, role_view: 1, who: 1 };

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
  // TONE-DEFAULT-SCANDINAVIAN-003 (CL-V5-TONE-GATE-001, live-verified on the owner's
  // account 2026-07-21): an ABSENT `toneRegister` is the app's own DEFAULT (scandinavian),
  // not "some other style" — but this gate returned false for it, so on a session that had
  // never explicitly picked a register `run()` returned early and NOTHING in this sidecar
  // fired: no v5 order, no role_view migration, no bring bullets, no instruction seeding.
  // The owner's live CL sat at the pre-v5 order with `toneRegister === null` while the v5
  // ORDER was loaded and idle. Same fix class as TONE-DEFAULT-SCANDINAVIAN-001/002
  // (converters) and TEMPLATE-STRUCT-DEFAULT-001 (the me() skeleton gate) — only an
  // EXPLICIT non-Nordic register opts out.
  function isNordicMinimal() {
    try {
      var tr = localStorage.getItem('toneRegister');
      if (!tr) return true;                       // absent -> the app default
      var v = JSON.parse(tr);
      return v == null || v === '' || v === 'nordic-minimal' || v === 'scandinavian';
    } catch (_) {}
    return true;                                  // unparseable -> treat as default, not opt-out
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

  // CL-V5-STRUCT-001: insert the NEW "How I see the role" section into a pre-v5 CL.
  //
  // CL-V5-MIGRATE-DURABLE-001 (live-verified 2026-07-21): the flag used to be set at INSERT
  // time. During boot the app rewrites `sections` from its own hydrated state at least once
  // AFTER this sidecar's first pass, so the freshly inserted role_view was thrown away while
  // the flag stayed set — the next pass then read "already migrated" and never retried. The
  // owner's live CL ended up correctly REORDERED (who at the end) but with no role_view at
  // all. So the flag is now armed only when role_view is OBSERVED in a list we READ BACK,
  // i.e. once the write has actually survived. A boot-time overwrite is repaired on the next
  // pass; a genuine user delete (after the section was durably present) still sticks.
  //
  // ATTEMPTS is a per-page-load ceiling: nothing in the app strips unknown CL section ids
  // today, but if something ever does, this converges to "gave up" instead of a write storm
  // (the failure mode of [[preview-freeze-is-textalign-storm]]).
  var MIGRATE_ATTEMPTS = 0, MIGRATE_MAX = 5;
  function migrateV5(list) {
    if (!Array.isArray(list) || !list.length) return { changed: false, list: list };
    if (list.some(function (s) { return s && s.id === 'role_view'; })) {
      // read back and present -> the insert is durable; arm the one-shot.
      try { localStorage.setItem('antcv:cl-v5-role-view-migrated', '1'); } catch (_) {}
      return { changed: false, list: list };
    }
    try { if (localStorage.getItem('antcv:cl-v5-role-view-migrated') === '1') return { changed: false, list: list }; } catch (_) {}
    if (MIGRATE_ATTEMPTS >= MIGRATE_MAX) return { changed: false, list: list };
    // Only migrate a CL that actually looks like the Nordic body (not an empty/foreign doc).
    if (!list.some(function (s) { return s && (s.id === 'bring' || s.id === 'contribute'); })) return { changed: false, list: list };
    var at = list.findIndex(function (s) { return s && s.id === 'why'; });
    var out = list.slice();
    out.splice(at >= 0 ? at + 1 : 0, 0, JSON.parse(JSON.stringify(ROLE_VIEW_TEMPLATE)));
    MIGRATE_ATTEMPTS++;   // flag is NOT set here — see CL-V5-MIGRATE-DURABLE-001
    return { changed: true, list: out };
  }

  // BRING / ROLE_VIEW / WHO: the rows after the section lead-in render as visible bullets
  // (mk:true). The lead-in is the FIRST row (a markerless {b:title, t}); later rows get mk.
  function bringBullets(list) {
    var changed = false;
    var out = list.map(function (s) {
      if (!s || !BULLET_SECTIONS[s.id] || s.type !== 'rich_block' || !Array.isArray(s.items) || s.items.length < 2) return s;
      var touched = false;
      var items = s.items.map(function (r, i) {
        if (i === 0) return r;                         // lead-in stays a paragraph
        if (r && typeof r === 'object' && r.mk !== true) { touched = true; return Object.assign({}, r, { mk: true }); }
        return r;
      });
      if (!touched) return s;                          // per-section, not shared state
      changed = true;
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

  // NORDIC-CL-ORDER-MANUAL-001 (owner 2026-07-02): the Nordic order is the DEFAULT only — the
  // user may reorder CL sections after. Once a manual CL reorder sets this flag, stop enforcing
  // the ORDER (the content transforms below still run). Cleared implicitly only by clearing the
  // flag; a manual choice persists across reloads (that is the point — the move must stay).
  function orderManual() { try { var v = localStorage.getItem('antcv:cl-order-manual'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function run() {
    try {
      if (disabled() || !isNordicMinimal()) return;
      var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
      var m = migrateV5(secs.cl);
      var a = orderManual() ? { changed: false, list: m.list } : reorder(m.list);
      var b = bringBullets(a.list);
      var g = contributeGoal(b.list);
      var sd = seedInstructions(g.list);
      if (!m.changed && !a.changed && !b.changed && !g.changed && !sd.changed) return;
      secs.cl = sd.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'nordic-cl-order-971' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // Run after the per-section converters settle (they use 0/300/900/2000 + late timers),
  // and on later windows to catch a cloud-restore / regen that rewrites cl.
  [350, 1100, 2600, 5000, 9000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvNordicClOrder = { version: VERSION, run: run, ORDER: ORDER, migrateV5: migrateV5, bringBullets: bringBullets, reorder: reorder, isNordicMinimal: isNordicMinimal };
})();
