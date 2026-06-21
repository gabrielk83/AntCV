/* antcv-labeled-list-to-rich-block-763.js — RICH-BLOCK-GROUP-001 (owner 2026-06-22)
 * ============================================================================
 * Fold labeled_list (Tools & Methods, Regulatory, Additional info) and list (Certifications) into
 * the universal `rich_block`, now that rich_block supports GROUP sub-heading rows + a "Label: value"
 * colon. labeled_list was never a real 2-column table — each row renders "<bold label>: <value>",
 * which is exactly a rich_block {b,t} row.
 *
 *   labeled_list {l,v}        -> rich_block row { b:l, t:v }   (leadColon:true => "label: value")
 *   labeled_list {group:"X"}  -> rich_block group row { grp:true, t:"X" }
 *   labeled_list labelHidden  -> bOff:true (value-only)
 *   list "string"             -> rich_block row { b:"", t:string }   (section CJLR default centered)
 *
 * Keeps id/title/loc/on/hidden and the section heading (headlineOff:false). Per-row align/page ride
 * the same antcvItemAlignment / antcv:itemPages stores (1:1 row indices), so they carry over.
 *
 * Safety: idempotent + loop-safe (only converts while type is still labeled_list/list). Self-
 * disabling on any error. The generator re-emits labeled_list/list -> re-upgraded on the next pass.
 */
(function () {
  'use strict';
  var VERSION = '1.50.763b';
  if (window.__antcvLabeledListToRichBlock763 === VERSION) return;
  window.__antcvLabeledListToRichBlock763 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function listText(it) {
    if (it == null) return '';
    if (typeof it === 'string') return it;
    if (typeof it === 'object') return String(it.text || it.name || it.v || it.value || it.t || '');
    return String(it);
  }
  function convertLabeled(s) {
    // Regulatory treats a label-only row (label, no value) as a sub-heading (matches the worker rule).
    var regId = String(s.id || '').toLowerCase().indexOf('regulatory') >= 0;
    var rows = (Array.isArray(s.items) ? s.items : []).map(function (it) {
      if (it && typeof it === 'object' && (it.group !== undefined || it.subhead !== undefined || it.header !== undefined || it.category !== undefined)) {
        return { grp: true, t: String(it.group != null ? it.group : (it.subhead != null ? it.subhead : (it.header != null ? it.header : it.category))) };
      }
      if (it && typeof it === 'object') {
        var lab = String(it.l || it.label || '');
        var val = String(it.v || it.value || '');
        if (regId && lab && !val) return { grp: true, t: lab };
        var row = { b: lab, t: val };
        if (it.labelHidden) row.bOff = true;
        return row;
      }
      return { b: '', t: listText(it) };
    });
    var ns = { id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block', items: rows, leadColon: true };
    if (s.hidden) ns.hidden = s.hidden;
    if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
    return ns;
  }
  function convertList(s, centerIds) {
    var rows = (Array.isArray(s.items) ? s.items : []).map(function (it) { return { b: '', t: listText(it) }; });
    var ns = { id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block', items: rows };
    if (s.hidden) ns.hidden = s.hidden;
    if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
    centerIds.push(s.id);
    return ns;
  }
  // 415-managed sidebar sections — antcv-sections-normalize-415.js owns these: it splits `additional`
  // (a labeled_list) into Interests/Languages/Accessibility and normalises the interests item shape
  // (strips b/t). Converting them to rich_block BREAKS that split (interests goes empty), so NEVER
  // convert them — and RESTORE any that a prior 763 pass mis-converted, back to their expected type.
  var MANAGED = { additional: 'labeled_list', interests: 'bullets', languages: 'labeled_list', accessibility: 'labeled_list' };
  function unconvert(s, targetType) {
    if (s.type !== 'rich_block') return s;
    var items;
    if (targetType === 'bullets') {
      items = (Array.isArray(s.items) ? s.items : []).filter(function (r) { return r && !r.grp; }).map(function (r) { return { b: r.b || '', t: r.t || '' }; });
    } else {
      items = (Array.isArray(s.items) ? s.items : []).map(function (r) {
        if (r && r.grp) return { group: r.t || '' };
        var o = { l: (r && r.b) || '', v: (r && r.t) || '' }; if (r && r.bOff) o.labelHidden = true; return o;
      });
    }
    var ns = { id: s.id, title: s.title, loc: s.loc, on: s.on, type: targetType, items: items };
    if (s.hidden) ns.hidden = s.hidden;
    if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
    return ns;
  }
  function mapList(list, centerIds) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    var out = list.map(function (s) {
      if (!s) return s;
      if (MANAGED[s.id]) {
        if (s.type === 'rich_block') { changed = true; return unconvert(s, MANAGED[s.id]); }
        return s;
      }
      if (s.type === 'labeled_list') { changed = true; return convertLabeled(s); }
      if (s.type === 'list') { changed = true; return convertList(s, centerIds); }
      return s;
    });
    return { changed: changed, list: out };
  }
  // Certifications (list) default to centered — set the section group alignment if unset.
  function centerSections(ids) {
    if (!ids.length) return;
    try {
      var al = JSON.parse(localStorage.getItem('antcvItemAlignment') || '{}') || {};
      var touched = false;
      ids.forEach(function (id) {
        if (!al[id] || typeof al[id] !== 'object') al[id] = {};
        if (!al[id].__group__) { al[id].__group__ = 'center'; touched = true; }
      });
      if (touched) localStorage.setItem('antcvItemAlignment', JSON.stringify(al));
    } catch (_) {}
  }
  function run() {
    try {
      var secs = readSections();
      var centerIds = [];
      var cv = mapList(secs.cv || [], centerIds);
      var cl = mapList(secs.cl || [], centerIds);
      if (!cv.changed && !cl.changed) return;
      if (cv.changed) secs.cv = cv.list;
      if (cl.changed) secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      centerSections(centerIds);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'labeled-list-to-rich-block-763' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 450, 1200, 2600].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvLabeledListToRichBlock = { version: VERSION, run: run };
})();
