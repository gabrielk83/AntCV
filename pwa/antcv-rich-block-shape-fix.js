/* antcv-rich-block-shape-fix.js — RICH-BLOCK-SHAPE-001 (owner 2026-06-23).
 * ============================================================================
 * Owner: TOOLS & METHODS and REGULATORY CONTEXT come out EMPTY in preview + PDF even
 * after a FULL generation — yet the data is present in the section. Root cause (verified
 * live): those sections are `type:"rich_block"` but their items are still in the RAW
 * personalInfo shape — {l,v} (label/value) and {group} (sub-heading) — NOT the rich_block
 * shape {b,t} / {grp,t}. The rich_block render reads .b/.t/.grp, finds none, and renders
 * an empty row. The labeled-list→rich_block converter (763) only fires on `type:"labeled_list"`
 * sections, so an already-rich_block section carrying raw items slips past it; and
 * sidebar-repopulate-758 only rewrites EMPTY sections, so a wrong-shaped-but-non-empty
 * section is skipped too.
 *
 * Fix: walk every rich_block section and convert any RAW item to the rich_block shape
 * ({l,v}→{b,t}; {group}/{header}/{category}/{subhead}→{grp,t}). Idempotent (a {b,t}/{grp,t}/
 * string/empty-{t} item is left untouched), so it converges in one pass and never loops.
 *
 * Also: WORK STYLE (a rich_block) came out with an empty body — fill it from
 * personalInfo.workStyle (work_style_line_en/_da, else summary, else keywords) when empty.
 *
 * Fixes BOTH preview and export because it corrects the stored `sections` (which both read).
 * Only ever WRITES on a real change; self-disables on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.800';
  if (window.__antcvRichBlockShapeFix === VERSION) return;
  window.__antcvRichBlockShapeFix = VERSION;

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function pinfo() { var p = readJSON('personalInfo') || {}; return (p && p.personalInfo) ? p.personalInfo : p; }
  function activeLang() {
    try { var l = JSON.parse(localStorage.getItem('language') || '"en"'); return String(l).toLowerCase() === 'da' ? 'da' : 'en'; }
    catch (_) { return 'en'; }
  }

  // Convert ONE raw item to rich_block shape. Returns null if already rich_block-shaped
  // (so we never touch a {b,t}/{grp,t}/string/empty item — idempotent + loop-safe).
  function fixItem(it) {
    if (it == null) return null;
    if (typeof it !== 'object') return null;            // strings render fine (coerced to {t})
    if ('grp' in it || 'b' in it) return null;          // already rich_block shape
    var g = it.group != null ? it.group
          : it.subhead != null ? it.subhead
          : it.header != null ? it.header
          : it.category;
    var lab = it.l != null ? it.l : it.label;
    var val = it.v != null ? it.v : it.value;
    if (g != null && lab == null && val == null) return { grp: true, t: String(g) };
    if (lab != null || val != null) return { b: String(lab || ''), t: String(val || '') };
    return null;                                          // unknown / already {t:""} → leave it
  }

  function fixWorkStyle(sec, pi) {
    if (!sec || sec.id !== 'work_style' || sec.type !== 'rich_block') return false;
    var its = Array.isArray(sec.items) ? sec.items : [];
    var hasContent = its.some(function (it) {
      return it && ((typeof it === 'string' && it.trim()) || (it.t != null && String(it.t).trim()));
    });
    if (hasContent) return false;
    var ws = (pi && pi.workStyle) || {};
    var line = (activeLang() === 'da' ? ws.work_style_line_da : ws.work_style_line_en) ||
      ws.summary || (Array.isArray(ws.keywords) ? ws.keywords.join(', ') : '');
    line = String(line || '').trim();
    if (!line) return false;
    sec.items = [{ b: '', t: line }];
    return true;
  }

  function run() {
    try {
      var secs = readJSON('sections');
      if (!secs || typeof secs !== 'object') return;
      var pi = pinfo();
      var changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (s) {
          if (!s) return;
          if (s.type === 'rich_block' && Array.isArray(s.items)) {
            var any = false;
            s.items = s.items.map(function (it) { var f = fixItem(it); if (f) { any = true; return f; } return it; });
            if (any) changed = true;
          }
          if (fixWorkStyle(s, pi)) changed = true;
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { console.info('[rich-block-shape-fix-800] reshaped raw rich_block items / filled work style'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'rich-block-shape-fix-800' } })); } catch (_) {}
    } catch (_) { /* self-disable on error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 1000, 2200].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvRichBlockShapeFix = { version: VERSION, run: run, fixItem: fixItem };
})();
