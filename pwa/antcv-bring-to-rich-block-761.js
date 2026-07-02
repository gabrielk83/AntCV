/* antcv-bring-to-rich-block-761.js — BRING-RICH-BLOCK-001 (owner 2026-06-29)
 *
 * Default the cover-letter WHAT I BRING section to the Nordic-Minimal rich_block (lead-in
 * paragraphs) instead of the 2-column table — matching the owner's reference docx (each focus
 * area renders as a bold "Label: value" paragraph with the section's normal paragraph spacing,
 * headline hidden, like WHO I AM / WHY THIS COMPANY / HOW I WOULD CONTRIBUTE).
 *
 * Scope: ONLY when the active style is Nordic-Minimal (toneRegister). Non-nordic styles keep
 * the table (the 2-column option stays available in the Format control). The conversion is
 * idempotent + one-way (table -> rich_block): once converted it is a standard rich_block, so the
 * table-specific sidecars (twin/partition/core dedup, row-controls, header-CJLR, the CL-width-cap)
 * simply skip it (they all gate on type==='table'/rows), and the rich_block editor + preview +
 * worker render it for free.
 *
 * Shape: drop a header row (["Focus Area","Strategic Expertise"]); each data row [label,value] ->
 * { b:label, t:value }; prepend a section lead-in { b:"What I bring", t:"" } (the title,
 * sentence-cased) so the section keeps its identity with the headline hidden; headlineOff:true.
 */
(function () {
  'use strict';
  if (window.__antcvBringToRichBlock) return;
  window.__antcvBringToRichBlock = true;
  var VERSION = '1.51.44-bring-rich-block';

  function isNordicMinimal() {
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); return v === 'nordic-minimal' || v === 'scandinavian'; } } catch (_) {}
    // TONE-DEFAULT-SCANDINAVIAN-001 (owner 2026-07-03, Anita CL): an ABSENT toneRegister
    // meant these converters no-op'd in fresh/demo sessions while the CL skeleton is
    // nordic-shaped for EVERYONE (TEMPLATE-STRUCT-DEFAULT-001) — bring stayed a table,
    // foundation fields never reached the rich_block. The app's tone default is
    // 'scandinavian' (u.get('toneRegister','scandinavian')) — mirror it here.
    return true;
  }
  function sentenceCaseLabel(t) {
    t = String(t || '').trim(); if (!t) return '';
    t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    return t.replace(/\bi\b/g, 'I');
  }
  function readSections() {
    try { var raw = localStorage.getItem('sections'); if (!raw) return null; var s = JSON.parse(raw); return (s && typeof s === 'object') ? s : null; } catch (_) { return null; }
  }
  function looksHeader(row) {
    var a = Array.isArray(row) ? row : [];
    var l = String(a[0] || '').toLowerCase().trim(), v = String(a[1] || '').toLowerCase().trim();
    return /^(focus area|focus|area)$/.test(l) || /^(strategic expertise|expertise|strategic)$/.test(v);
  }
  function convert(list) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'bring') return s;
      if (s.type !== 'table' || !Array.isArray(s.rows)) return s;                     // already converted
      if (!isNordicMinimal()) return s;                                              // Nordic default only
      var rows = s.rows.slice();
      if (rows.length && looksHeader(rows[0])) rows = rows.slice(1);
      var items = rows.map(function (r) {
        var a = Array.isArray(r) ? r : [];
        return { b: String(a[0] || '').trim(), t: String(a[1] || '').trim() };
      }).filter(function (it) { return it.b || it.t; });
      // BRING-EMPTY-SEED-001 (owner 2026-07-02): the LLM can return bring_rows completely empty
      // (or only the header row survives), leaving the table an untouched 2-column shell with NO
      // data rows -- INVISIBLE in the rendered CL (no heading, nothing to click; the owner's "no
      // WHAT I BRING section at all"). Do NOT bail here -- fall through and build the rich_block
      // with ONLY the lead-in item (items stays empty, concat below still yields one item). The
      // nordic-cl-order-971 seedInstructions pass then fills the placeholder wording (same pattern
      // as the Foundation Hands-on/Professionally seed), so the section is VISIBLE and editable
      // instead of silently disappearing. Once real rows exist, they render alongside the lead-in.
      // section lead-in (matches who/why/HWIC nordic) so the identity survives a hidden headline.
      // BRING-INTRO-001 (owner 2026-06-30: "What I bring line is still empty"): the lead-in BODY
      // carries the generated intro phrase (anchor + areas, e.g. "structure - across scope,
      // suppliers, validation, and business decisions"), stashed on the table section as
      // `_bringIntro` by the generation apply. Empty when no intro was generated (graceful).
      var __bIntro = String((s && s._bringIntro) || '').trim();
      // BRING-INTRO-NEUTRAL-001 (owner 2026-07-03: lead-in empty on the Anita CL): when the
      // generation omits bring_intro, use a neutral connector instead of an EMPTY lead body -
      // an empty lead makes the rows read as part of the PREVIOUS section in the export
      // (headlines are hidden, so the lead-in is the section's only visible identity).
      if (!__bIntro) __bIntro = 'a few concrete strengths, each backed by work I have actually done:';
      items = [{ b: sentenceCaseLabel(s.title) || 'What I bring', t: __bIntro }].concat(items);
      var ns = { id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block', items: items, headlineOff: true };
      if (s.hidden) ns.hidden = s.hidden;
      if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
      if (s.ruleOff) ns.ruleOff = s.ruleOff;
      changed = true;
      return ns;
    });
    return { changed: changed, list: out };
  }
  function run() {
    try {
      var secs = readSections(); if (!secs) return;
      var cl = convert(secs.cl || []);
      if (!cl.changed) return;
      secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'bring-to-rich-block-761' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  // Cloud-restore writes the bring TABLE seconds after load (after my early timers), and it
  // does not always re-dispatch sections-updated — so run on a LATER settle window too, and
  // poll briefly, mirroring the PUB-REPOPULATE late-settle pattern. Idempotent (one-way).
  [0, 600, 1500, 3000, 5000, 9000, 14000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvBringToRichBlock = { version: VERSION, run: run };
})();
