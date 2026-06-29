/* antcv-foundation-to-rich-block-758.js — RICH-BLOCK-001 Phase B (owner 2026-06-22)
 * ============================================================================
 * Convert the legacy two-paragraph `foundation` section (hands_on + professionally)
 * into the universal composite `rich_block` so it gains the full per-row + whole-
 * section controls (headline/rule toggles, CJLR, Page, Enhance, Fit, add/delete rows).
 *
 * Mapping: { type:"foundation", hands_on, professionally } ->
 *   { type:"rich_block", items:[ {b:"Hands-on", t:hands_on}, {b:"Professionally", t:professionally} ] }
 * keeping id / title / loc / on / hidden. Any saved foundation per-part alignment/page
 * (antcv.foundationControls.v1) carries over to the per-row stores (antcvItemAlignment /
 * antcv:itemPages) so nothing the user tuned is lost.
 *
 * Safety:
 *  - Idempotent + loop-safe: only converts sections whose type is still "foundation"; once
 *    converted there is nothing to do, so the sections-updated re-dispatch converges in one pass.
 *  - Runs on both CV and CL (foundation can live in either). Self-disabling on any error.
 *  - The generator may re-emit a foundation on regen; this simply re-upgrades it on the next pass.
 */
(function () {
  'use strict';
  var VERSION = '1.50.951-foundation-opening';
  if (window.__antcvFoundationToRichBlock758 === VERSION) return;
  window.__antcvFoundationToRichBlock758 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  // NORDIC-FOUNDATION-DEFAULT-001 (owner 2026-06-28): for the Nordic Minimal style the FOUNDATION
  // default is HEADLINE HIDDEN + Hands-on/Professionally rendered as BULLETS (an existing "Foundation"
  // opening row, if present, stays a paragraph). Same toneRegister read as the HWIC fix (760).
  function isNordicMinimal() {
    try { var tr = localStorage.getItem('toneRegister');
      if (tr) { var v = JSON.parse(tr); return v === 'nordic-minimal' || v === 'scandinavian'; } } catch (_) {}
    return false;
  }
  // GABRIEL-FOUNDATION-OPENING-001 (owner 2026-06-28): the generator emits FOUNDATION as only
  // hands_on + professionally; the "Foundation:" OPENING sentence is dropped, so with the headline
  // hidden the section had no opener. Restore it as the lead-in opening row when missing. This is
  // Gabriel's SPECIFIC content (hardware engineering …), NOT a generic default, so it is name-guarded
  // to Gabriel — same pattern as the kernel role_results_exact seed. Idempotent (only when the first
  // row isn't already a "Foundation" lead-in).
  var GABRIEL_FOUNDATION_OPENING = 'I connect hardware engineering, product scope and production readiness via requirements, validation & traceability.';
  function isGabriel() {
    try { var p = JSON.parse(localStorage.getItem('personalInfo') || '{}'); return /\bgabriel\b/i.test(String((p && p.name) || '')); } catch (_) { return false; }
  }
  function convertList(list, idsOut) {
    if (!Array.isArray(list)) return { changed: false, list: list };
    var changed = false;
    // Apply the Nordic-Minimal FOUNDATION default to a foundation rich_block: headline hidden +
    // Hands-on/Professionally as bullets. Idempotent (headlineOff only when unset → respects a user
    // who re-showed it; mk only added when absent). Other styles untouched. NOTE: turning a marker
    // OFF reads the same as never having one, so under nordic a removed Hands-on/Professionally bullet
    // is re-added (this is a STYLE DEFAULT, per the directive); add a sentinel later if needed.
    function nordicFoundationDefault(sec) {
      if (!sec || sec.id !== 'foundation' || sec.type !== 'rich_block' || !Array.isArray(sec.items) || !isNordicMinimal()) return sec;
      var c = Object.assign({}, sec);
      var touched = false;
      if (c.headlineOff === undefined) { c.headlineOff = true; touched = true; }
      c.items = c.items.map(function (r) {
        if (r && typeof r === 'object' && (r.b === 'Hands-on' || r.b === 'Professionally')) {
          var rc = Object.assign({}, r); var ch = false;
          if (rc.mk !== true) { rc.mk = true; ch = true; }
          // FOUNDATION-LEADIN-DEDUP-001 (owner 2026-06-29): the body must not repeat the lead-in word.
          // e.g. lead-in "Hands-on" + body "Hands-on across…" -> strip so it reads "Hands-on across…"
          // (lead-in stays the bold label; the body continues from "across"). Idempotent.
          if (typeof rc.t === 'string') {
            var esc = String(rc.b).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
            var st = rc.t.replace(new RegExp('^\\s*' + esc + '[\\s:,\\-]+', 'i'), '');
            if (st !== rc.t) { rc.t = st; ch = true; }
          }
          if (ch) { touched = true; return rc; }
        }
        return r;
      });
      // Restore Gabriel's "Foundation" opening sentence as the first (paragraph) row when missing.
      var hasOpening = c.items[0] && typeof c.items[0] === 'object' && c.items[0].b === 'Foundation';
      if (!hasOpening && isGabriel()) {
        c.items = [{ b: 'Foundation', t: GABRIEL_FOUNDATION_OPENING }].concat(c.items);
        touched = true;
      }
      if (!touched) return sec;
      changed = true;
      return c;
    }
    var out = list.map(function (s) {
      // Already-converted foundation rich_block (re-run / regen): apply the nordic default in place.
      if (s && s.id === 'foundation' && s.type === 'rich_block') return nordicFoundationDefault(s);
      if (!s || s.type !== 'foundation') return s;
      changed = true;
      idsOut.push(s.id);
      var ns = {
        id: s.id, title: s.title, loc: s.loc, on: s.on, type: 'rich_block',
        items: [
          { b: 'Hands-on', t: s.hands_on != null ? String(s.hands_on) : '' },
          { b: 'Professionally', t: s.professionally != null ? String(s.professionally) : '' }
        ]
      };
      if (s.hidden) ns.hidden = s.hidden;
      if (s.pageBreakBefore) ns.pageBreakBefore = s.pageBreakBefore;
      if (s.headlineOff) ns.headlineOff = s.headlineOff;
      if (s.ruleOff) ns.ruleOff = s.ruleOff;
      return nordicFoundationDefault(ns);
    });
    return { changed: changed, list: out };
  }
  function migrateControls(ids) {
    if (!ids.length) return;
    try {
      var fc = JSON.parse(localStorage.getItem('antcv.foundationControls.v1') || '{}') || {};
      if (!fc || (!fc.hands_on && !fc.professionally)) return;
      var al = JSON.parse(localStorage.getItem('antcvItemAlignment') || '{}') || {};
      var pg = JSON.parse(localStorage.getItem('antcv:itemPages') || '{}') || {};
      var parts = [['hands_on', 0], ['professionally', 1]];
      var ok = ['left', 'center', 'right', 'justify'];
      ids.forEach(function (sid) {
        parts.forEach(function (p) {
          var c = fc[p[0]]; if (!c) return;
          if (c.align && ok.indexOf(c.align) >= 0) {
            if (!al[sid] || typeof al[sid] !== 'object') al[sid] = {};
            al[sid]['items.' + p[1]] = c.align; al[sid][String(p[1])] = c.align;
          }
          var n = Number(c.page);
          if (isFinite(n) && n >= 2) {
            if (!pg[sid] || typeof pg[sid] !== 'object') pg[sid] = {};
            pg[sid][String(p[1])] = Math.round(n); pg[sid]['items.' + p[1]] = Math.round(n);
          }
        });
      });
      localStorage.setItem('antcvItemAlignment', JSON.stringify(al));
      localStorage.setItem('antcv:itemPages', JSON.stringify(pg));
    } catch (_) {}
  }
  function run() {
    try {
      var secs = readSections();
      var ids = [];
      var cv = convertList(secs.cv || [], ids);
      var cl = convertList(secs.cl || [], ids);
      if (!cv.changed && !cl.changed) return;
      if (cv.changed) secs.cv = cv.list;
      if (cl.changed) secs.cl = cl.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      migrateControls(ids);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'foundation-to-rich-block-758' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvFoundationToRichBlock = { version: VERSION, run: run };
})();
