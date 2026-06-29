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
  var VERSION = '1.50.963-bring-rich-block';

  function isNordicMinimal() {
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); return v === 'nordic-minimal' || v === 'scandinavian'; } } catch (_) {}
    return false;
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
      if (s.type !== 'table' || !Array.isArray(s.rows) || !s.rows.length) return s;  // already converted / no rows
      if (!isNordicMinimal()) return s;                                              // Nordic default only
      var rows = s.rows.slice();
      if (rows.length && looksHeader(rows[0])) rows = rows.slice(1);
      var items = rows.map(function (r) {
        var a = Array.isArray(r) ? r : [];
        return { b: String(a[0] || '').trim(), t: String(a[1] || '').trim() };
      }).filter(function (it) { return it.b || it.t; });
      if (!items.length) return s;                                                   // nothing to convert
      // section lead-in (matches who/why/HWIC nordic) so the identity survives a hidden headline.
      items = [{ b: sentenceCaseLabel(s.title) || 'What I bring', t: '' }].concat(items);
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
  [0, 500, 1300, 2600].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvBringToRichBlock = { version: VERSION, run: run };
})();
