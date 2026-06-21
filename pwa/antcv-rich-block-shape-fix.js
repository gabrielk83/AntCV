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
  var VERSION = '1.50.803';
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

  function sectionEmpty(sec) {
    var its = Array.isArray(sec.items) ? sec.items : [];
    var contentReal = typeof sec.content === 'string' && sec.content.trim() && !/^\s*\[[^\]]*\]\s*$/.test(sec.content);
    if (contentReal) return false;
    return !its.some(function (it) {
      return it && ((typeof it === 'string' && it.trim()) || (it.t != null && String(it.t).trim()) || (it.b != null && String(it.b).trim()));
    });
  }

  function fixWorkStyle(sec, pi) {
    if (!sec || sec.id !== 'work_style' || sec.type !== 'rich_block') return false;
    if (!sectionEmpty(sec)) return false;
    var ws = (pi && pi.workStyle) || {};
    var line = (activeLang() === 'da' ? ws.work_style_line_da : ws.work_style_line_en) ||
      ws.summary || (Array.isArray(ws.keywords) ? ws.keywords.join(', ') : '');
    line = String(line || '').trim();
    if (!line) return false;
    // WORK-STYLE-LEADIN-001 (owner 2026-06-23): show a bold greenish "Working style"
    // lead-in (the rich_block `b` renders bold + accent) before the line.
    sec.items = [{ b: activeLang() === 'da' ? 'Arbejdsstil' : 'Working style', t: line }];
    return true;
  }

  // PROFILE-FALLBACK-001 (owner 2026-06-23): the CV PROFILE came out empty (the gen
  // produced no profile_content and nothing fell back). The kernel `background` IS the
  // candidate's profile text — use it when PROFILE is empty so it is never blank.
  function fillProfile(sec, pi) {
    if (!sec || sec.id !== 'profile' || sec.type !== 'rich_block') return false;
    if (!sectionEmpty(sec)) return false;
    var bg = String((pi && pi.background) || '').trim();
    if (!bg) return false;
    sec.items = [{ b: '', t: bg }];
    return true;
  }

  // RICH-BLOCK-CONTENT-BRIDGE-001: the CL text sections (opening/who/why/foundation/
  // closure) are rich_block, but the generation hydration writes the LEGACY `content`
  // string (+ its hardcoded fallbacks) — which the rich_block render (reads `items`)
  // never shows. If a rich_block section has a non-empty `content` but blank items,
  // surface the content as items:[{b:"",t:content}]. Idempotent (once items carry t,
  // it won't re-fire). Never clobbers populated items.
  function bridgeContent(sec) {
    if (!sec || sec.type !== 'rich_block') return false;
    var content = (typeof sec.content === 'string') ? sec.content.trim() : '';
    if (!content) return false;
    if (/^\s*\[[^\]]*\]\s*$/.test(content)) return false; // a [placeholder] is not real content
    var its = Array.isArray(sec.items) ? sec.items : [];
    // RICH-BLOCK-CONTENT-BRIDGE-002 (owner 2026-06-23): check the BODY (t / string), NOT the
    // label (b). who/why came in as {b:"Who I am", t:""} — a label with an EMPTY body — so the
    // old b-check wrongly thought the section had content and skipped it. Surface section.content
    // as the body (drop the redundant label; the section heading already shows it).
    var hasBody = its.some(function (it) {
      return it && ((typeof it === 'string' && it.trim()) || (it.t != null && String(it.t).trim()));
    });
    if (hasBody) return false;
    sec.items = [{ b: '', t: content }];
    return true;
  }

  // TOOLS-LABEL-DEDUP-001 (owner 2026-06-23): "AI-assisted" appeared TWICE in TOOLS & METHODS.
  // Collapse duplicate non-group rows that share a label (b), keeping the one with the LONGEST
  // body (the fuller version) at its position; drop the rest. Group (grp) rows are untouched.
  function dedupeLabels(sec) {
    if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return false;
    var best = {};
    sec.items.forEach(function (it, idx) {
      if (!it || typeof it !== 'object' || it.grp) return;
      var b = it.b != null ? String(it.b).trim() : '';
      if (!b) return;
      var k = b.toLowerCase();
      var len = String(it.t || '').length;
      if (best[k] == null || len > String(sec.items[best[k]].t || '').length) best[k] = idx;
    });
    var out = sec.items.filter(function (it, idx) {
      if (!it || typeof it !== 'object' || it.grp) return true;
      var b = it.b != null ? String(it.b).trim() : '';
      if (!b) return true;
      return best[b.toLowerCase()] === idx;
    });
    if (out.length === sec.items.length) return false;
    sec.items = out;
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
          if (bridgeContent(s)) changed = true;
          if (fixWorkStyle(s, pi)) changed = true;
          if (fillProfile(s, pi)) changed = true;
          if (dedupeLabels(s)) changed = true;
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
