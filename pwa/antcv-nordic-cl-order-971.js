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
  var VERSION = '1.51.4506-foundation-fold';
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

  // CL-SKELETON-SEED-STORM-001 (owner 2026-07-22, live-measured ~4 sections-writes/s on the
  // empty CL skeleton): seedInstructions wrote the bracketed authoring instruction into an
  // empty bring lead-in / foundation Hands-on+Professionally, but TWO anti-placeholder sidecars
  // strip a bracketed [..] body straight back to empty (antcv-rich-block-shape-fix.fillFoundation
  // for foundation, antcv-strip-skeleton-placeholders for the bring lead-in). needsSeed('') is
  // then true again, so this re-seeded it every tick, forever — needsSeed's "idempotent" claim
  // is false against a competing stripper. Fix per [[storm-guards-must-be-substructure-keyed]]:
  // DECIDE ONCE — seed each row at most once per page load, keyed on the contested substructure
  // (section:row). If a stripper removes it afterwards, do NOT re-seed; the strippers win and the
  // body stays empty (the generator fills real content later). __seededRows resets on reload, so
  // a genuine later regen still gets a fresh seed.
  var __seededRows = {};

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

  // CL-V5-STRUCT-001: ensure the NEW "How I see the role" (role_view) section exists on a
  // Nordic v5 CL body.
  //
  // CL-V5-MIGRATE-DURABLE-002 (live-verified 2026-07-22, supersedes -001): a PERSISTENT
  // localStorage flag must never guard a section that lives in the `sections` blob, because
  // hydration rewrites that blob on every load. The owner's real saved letters (e.g. 3Shape)
  // were generated pre-v5, so their stored cloud record has 8 CL sections and NO role_view;
  // the me() floor only FILLS empty sections, it does not inject missing ones, so every boot
  // hydrates a role_view-less CL. -001 set the one-shot flag once role_view was read back
  // present — but that read-back happened in the SAME load, so the flag went to "1", the next
  // load's hydration stripped role_view, and from then on the "1" flag (persisted across
  // reloads) made migrateV5 skip forever. Result on the live account: correct v5 ORDER but
  // "How I see the role" permanently absent. A persistent skip flag is therefore the bug, not
  // the fix. role_view is a MANDATORY v5 section (like greeting/why), so ensure it EVERY load,
  // idempotently — exactly how reorder()/bringBullets() already behave — with no persistent
  // flag. If a user hides it (on:false) that is preserved (we only insert when it is ABSENT).
  //
  // ATTEMPTS is a per-page-load ceiling (reset on reload): if a stripper ever fights the
  // insert within one load, this converges to "gave up" for that load instead of a write
  // storm (the failure mode of [[preview-freeze-is-textalign-storm]]); the next load retries.
  var MIGRATE_ATTEMPTS = 0, MIGRATE_MAX = 5;
  // Does this section carry REAL content (any DATA row that is not an empty/bracketed
  // placeholder)? Row 0 is the section lead-in — furniture, so it does not count.
  function hasRealBody(s) {
    return !!(s && Array.isArray(s.items) && s.items.some(function (r, i) {
      if (i === 0) return false;
      var t = String((r && r.t) || '').trim();
      return t && !/^\[/.test(t);
    }));
  }

  // CL-V5-FOUNDATION-KEEP-001 (live-verified 2026-07-21): v5 folds FOUNDATION into the
  // "Who I am" end-block, so the skeleton ships it off. But a PRE-v5 letter still holds
  // real foundation prose (the owner's live CL had the Codebeamer / FMEA / hardware-path
  // paragraphs) while its v5 who rows are still placeholders — turning foundation off
  // there deletes a paragraph from the rendered letter and puts NOTHING in its place.
  // Keep it visible until `who` actually carries real content; after a v5 regeneration
  // fills who_summary / who_operate, foundation stays off as intended. Idempotent: once
  // it is back on, the `on !== false` guard makes this a no-op.
  // Has the v5 "Who I am" end-block actually ABSORBED what FOUNDATION used to say?
  // "any real row" is too weak a test: on the owner's live letter only "How I operate"
  // was real while `Professional summary` — the row that carries foundation's substance
  // (the hands-on / professional grounding) — was still a placeholder. Releasing on that
  // would re-hide the real prose on the next load, so the letter would flip between
  // showing and dropping a paragraph. Require the summary row AND a second real row.
  function whoCarriesFoundation(w) {
    if (!w || !Array.isArray(w.items)) return false;
    var real = 0, summary = false;
    w.items.forEach(function (r, i) {
      if (i === 0 || !r) return;                       // row 0 is the lead-in
      if (r.fnd) return;                               // CL-V5-FOUNDATION-FOLD-001: folded rows are not v5 content
      var t = String(r.t || '').trim();
      if (!t || /^\[/.test(t)) return;
      real++;
      if (/^professional summary$/i.test(String(r.b || '').trim())) summary = true;
    });
    return summary && real >= 2;
  }

  //
  // CL-V5-FOUNDATION-FOLD-001 (owner 2026-09-06, supersedes the KEEP rule above): "the
  // foundation section is supposed to be embedded inside who I am". KEEP re-enabled the
  // STANDALONE foundation section whenever who was still placeholder, so the letter rendered
  // a separate FOUNDATION block at the tail - exactly the v4 shape v5 retired. Now, when a
  // who block exists, foundation's real rows (the opener + Hands-on + Professionally) are
  // MOVED INTO who as rows (before 'My goal' when present, else at the end) and the
  // standalone section goes OFF. Once a v5 regen fills who (whoCarriesFoundation) nothing is
  // folded - the v5 rows supersede it - and foundation just stays off. Idempotent: rows are
  // de-duplicated on their text, so a second pass is a no-op. No who block at all (a foreign
  // or pre-skeleton CL) falls back to the KEEP behaviour so no prose is ever dropped.
  function realRowText(r) {
    var t = String((r && r.t) || '').trim();
    return (t && !/^\[/.test(t)) ? t : '';
  }
  function foundationRealRows(f) {
    if (!f || !Array.isArray(f.items)) return [];
    return f.items.filter(function (r, i) { return r && typeof r === 'object' && realRowText(r) && !(f.hidden && f.hidden[i]); });
  }
  function foundationKeep(list) {
    var f = null, w = null;
    list.forEach(function (s) { if (!s) return; if (s.id === 'foundation') f = s; if (s.id === 'who') w = s; });
    if (!f) return { changed: false, list: list };
    var realRows = foundationRealRows(f);
    if (!w || !Array.isArray(w.items) || !w.items.length) {
      // no who block to fold into: legacy KEEP - a hidden foundation with real prose stays visible
      if (f.on !== false || !hasRealBody(f)) return { changed: false, list: list };
      return { changed: true, list: list.map(function (s) { return (s && s.id === 'foundation') ? Object.assign({}, s, { on: true }) : s; }) };
    }
    var whoItems = w.items;
    var toAdd = [];
    if (!whoCarriesFoundation(w)) {
      var have = {};
      whoItems.forEach(function (r) { var t = realRowText(r); if (t) have[t.toLowerCase()] = 1; });
      realRows.forEach(function (r) {
        var t = realRowText(r);
        if (have[t.toLowerCase()]) return;
        have[t.toLowerCase()] = 1;
        toAdd.push({ b: String(r.b == null ? '' : r.b), t: t, mk: true, fnd: true });
      });
    }
    if (!toAdd.length && f.on === false) return { changed: false, list: list };
    if (toAdd.length) {
      whoItems = w.items.slice();
      var goalAt = -1;
      for (var i = 1; i < whoItems.length; i++) { if (whoItems[i] && /^my goal$/i.test(String(whoItems[i].b || '').trim())) { goalAt = i; break; } }
      var at = goalAt >= 0 ? goalAt : whoItems.length;
      Array.prototype.splice.apply(whoItems, [at, 0].concat(toAdd));
    }
    return {
      changed: true,
      list: list.map(function (s) {
        if (!s) return s;
        if (s.id === 'foundation') return Object.assign({}, s, { on: false });
        if (s.id === 'who' && toAdd.length) return Object.assign({}, s, { items: whoItems });
        return s;
      })
    };
  }

  function migrateV5(list) {
    if (!Array.isArray(list) || !list.length) return { changed: false, list: list };
    // Already present (or user-hidden on:false) -> nothing to do. No persistent flag: see
    // CL-V5-MIGRATE-DURABLE-002. Clear any stale -001 flag so it can never resurrect the bug.
    if (list.some(function (s) { return s && s.id === 'role_view'; })) {
      try { if (localStorage.getItem('antcv:cl-v5-role-view-migrated') != null) localStorage.removeItem('antcv:cl-v5-role-view-migrated'); } catch (_) {}
      return { changed: false, list: list };
    }
    if (MIGRATE_ATTEMPTS >= MIGRATE_MAX) return { changed: false, list: list };
    // Only ensure on a CL that actually looks like the Nordic body (not an empty/foreign doc).
    if (!list.some(function (s) { return s && (s.id === 'bring' || s.id === 'contribute'); })) return { changed: false, list: list };
    var at = list.findIndex(function (s) { return s && s.id === 'why'; });
    var out = list.slice();
    out.splice(at >= 0 ? at + 1 : 0, 0, JSON.parse(JSON.stringify(ROLE_VIEW_TEMPLATE)));
    MIGRATE_ATTEMPTS++;
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
            // decide-once: seeding a placeholder (want=INSTR.bring) happens at most once per
            // load. Clearing (want='') is always allowed — it is idempotent once t is empty.
            if (want && __seededRows['bring:lead']) return s;
            if (want) __seededRows['bring:lead'] = 1;
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
          if (want && needsSeed(r.t) && r.t !== want) {
            var __fk = 'foundation:' + r.b;          // decide-once per row (Hands-on / Professionally)
            if (__seededRows[__fk]) continue;         // a stripper already removed our seed — do not re-seed
            __seededRows[__fk] = 1;
            it2[i] = Object.assign({}, r, { t: want }); touched = true;
          }
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

  // CL-V5-WHY-LEADIN-001 + CL-V5-ROLEVIEW-VISIBLE-001 (owner 2026-07-22):
  //  (1) the WHY lead-in label is "Why this company and position" (owner reword). Converge the
  //      known DEFAULT variants ("Why this position", "Why this company and role") on existing
  //      docs; NEVER touch a custom label the user typed.
  //  (2) role_view ("How I see the role") was inserted by the migration but its lead sentence is
  //      empty, so the preview hid the whole section (owner: "I do not see it in-vivo"). Seed the
  //      lead sentence when empty/placeholder so the SECTION RENDERS (heading + intro) even before
  //      generation fills the three employer-priority bullets. Real content is never overwritten.
  var WHY_LEADIN = 'Why this company and position';
  var WHY_DEFAULTS = { 'why this position': 1, 'why this company and role': 1, 'why this company and position': 1 };
  var ROLE_VIEW_LEAD = 'The work appears to centre on three connected priorities:';
  function normalizeV5(list) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s || !Array.isArray(s.items) || !s.items.length) return s;
      if (s.id === 'why') {
        var lead = s.items[0]; if (!lead || typeof lead !== 'object') return s;
        var cur = String(lead.b == null ? '' : lead.b).trim();
        if (WHY_DEFAULTS[cur.toLowerCase()] && cur !== WHY_LEADIN) {
          var it = s.items.slice(); it[0] = Object.assign({}, lead, { b: WHY_LEADIN });
          changed = true; return Object.assign({}, s, { items: it });
        }
        return s;
      }
      if (s.id === 'role_view') {
        var l0 = s.items[0]; if (!l0 || typeof l0 !== 'object') return s;
        var t = String(l0.t == null ? '' : l0.t).trim();
        if (!t || /^\[/.test(t)) {                       // empty or bracketed placeholder -> seed
          var it2 = s.items.slice(); it2[0] = Object.assign({}, l0, { t: ROLE_VIEW_LEAD });
          changed = true; return Object.assign({}, s, { items: it2 });
        }
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
      var m = migrateV5(secs.cl);
      var fk = foundationKeep(m.list);
      m = { changed: m.changed || fk.changed, list: fk.list };
      var a = orderManual() ? { changed: false, list: m.list } : reorder(m.list);
      var b = bringBullets(a.list);
      var g = contributeGoal(b.list);
      var sd = seedInstructions(g.list);
      var nv = normalizeV5(sd.list);
      sd = { changed: sd.changed || nv.changed, list: nv.list };
      if (!m.changed && !a.changed && !b.changed && !g.changed && !sd.changed) return;
      secs.cl = sd.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      // CL-V5-RERENDER-FORCE-001 (owner 2026-07-22): the preview's sections-updated handler
      // early-returns when the sections signature matches window.__antcvLastSecApplied. On a
      // reload the boot hydration can update that tracker so this sidecar's own change (why
      // reword, role_view seed, order, bring bullets) is written to localStorage.sections but
      // NOT re-applied to React state -> the DATA is correct while the PREVIEW stays stale
      // (owner: "I do not see it in-vivo"). The reason carries 'standalone', a keyword the
      // handler's force-regex (/slogan|standalone|signoff|signature/) treats as "bypass the
      // sig early-return", so a real nordic-cl-order change always repaints. Bounded: this
      // sidecar only dispatches when it ACTUALLY changed something (idempotent) -> no storm.
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'nordic-cl-order-971 standalone' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // Run after the per-section converters settle (they use 0/300/900/2000 + late timers),
  // and on later windows to catch a cloud-restore / regen that rewrites cl.
  [350, 1100, 2600, 5000, 9000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvNordicClOrder = { version: VERSION, run: run, ORDER: ORDER, migrateV5: migrateV5, bringBullets: bringBullets, reorder: reorder, isNordicMinimal: isNordicMinimal, foundationKeep: foundationKeep, normalizeV5: normalizeV5 };
})();
