/* antcv-twin-table-dedup.js — TWIN-TABLE-DEDUP-001 (owner 2026-06-22).
 * ============================================================================
 * The CV "CORE COMPETENCIES" table (id core_comp) and the CL "WHAT I BRING" table (id bring) keep
 * coming out as near-twins. Generation is already hardened (TABLES-DISTINCT-001 / TABLE-DIRECTION-001)
 * and the deterministic core_comp->bring mirror was removed (TABLES-NO-MIRROR-001), so today's twins
 * are baked into existing kernel data from before those fixes and persist on every load.
 *
 * This DETERMINISTIC guard enforces the prompt's own rule ("if a row would repeat, KEEP it in WHAT I
 * BRING and swap the CORE COMPETENCIES row") for existing data: a CORE COMPETENCIES row that is an
 * EXACT duplicate of a WHAT I BRING row (Focus Area + Strategic Expertise both match, normalised) is
 * HIDDEN (not deleted — reversible via the row's eye toggle), so the two tables never render as
 * identical. Only exact twins are touched; rows that merely share a Focus Area but differ in content
 * are LEFT ALONE. A regenerate produces properly-distinct (fuller) tables.
 *
 * Disable: localStorage['antcv:twin-dedup:off']='1'. Idempotent + self-converging.
 */
(function () {
  'use strict';
  var VERSION = '1.50.767';
  if (window.__antcvTwinTableDedup === VERSION) return;
  window.__antcvTwinTableDedup = VERSION;

  // OPT-IN (owner 2026-06-22: "some rows hidden in panel"): hiding CORE COMPETENCIES rows surprised
  // the owner — a hidden row in the editor panel reads as a bug. Default OFF; the generation prompt
  // (TABLES-DISTINCT-001) + a regenerate produce distinct tables. Enable: localStorage['antcv:twin-dedup:on']='1'.
  function off() { try { return localStorage.getItem('antcv:twin-dedup:on') !== '1'; } catch (_) { return true; } }
  // UN-HIDE any rows the prior (default-ON) pass hid, ONCE, so existing users get their CORE rows
  // back. Guarded so a later MANUAL hide isn't re-shown on every load.
  function unhidePrior() {
    try {
      if (localStorage.getItem('antcv:twin-unhid') === '1') return;
      localStorage.setItem('antcv:twin-unhid', '1');
      var secs = JSON.parse(localStorage.getItem('sections') || '{}'); if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      var cv = secs.cv.map(function (s) {
        if (!s || s.id !== 'core_comp' || !s.hidden || typeof s.hidden !== 'object') return s;
        var h = Object.assign({}, s.hidden), touched = false;
        Object.keys(h).forEach(function (k) { if (h[k]) { delete h[k]; touched = true; } });
        if (touched) { changed = true; return Object.assign({}, s, { hidden: h }); }
        return s;
      });
      if (changed) { secs.cv = cv; localStorage.setItem('sections', JSON.stringify(secs)); try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'twin-dedup-unhide' } })); } catch (_) {} }
    } catch (_) {}
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function norm(x) {
    return String(x == null ? '' : x).toLowerCase()
      .replace(/\[[^\]]*\]/g, '')      // drop bracket placeholders
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function isPlaceholderRow(r) { return /^\s*\[/.test(String((r && r[0]) || '')) || norm(r && r[0]) === ''; }

  function run() {
    if (off()) return;
    try {
      var secs = readSections();
      var cv = Array.isArray(secs.cv) ? secs.cv : [];
      var cl = Array.isArray(secs.cl) ? secs.cl : [];
      var bring = cl.find(function (s) { return s && s.id === 'bring' && Array.isArray(s.rows); });
      var core = cv.find(function (s) { return s && s.id === 'core_comp' && Array.isArray(s.rows); });
      if (!bring || !core || bring.rows.length < 2 || core.rows.length < 2) return;
      // exact-row signatures from WHAT I BRING (skip header row 0).
      var bringSig = {};
      bring.rows.slice(1).forEach(function (r) {
        if (!Array.isArray(r) || isPlaceholderRow(r)) return;
        bringSig[norm(r[0]) + '||' + norm(r[1])] = 1;
      });
      var hidden = (core.hidden && typeof core.hidden === 'object') ? Object.assign({}, core.hidden) : {};
      var changed = false;
      core.rows.forEach(function (r, i) {
        if (i === 0 || !Array.isArray(r) || isPlaceholderRow(r)) return;
        var sig = norm(r[0]) + '||' + norm(r[1]);
        if (bringSig[sig] && !hidden[i]) { hidden[i] = true; changed = true; }
      });
      if (!changed) return;
      var nextCv = cv.map(function (s) { return (s && s.id === 'core_comp') ? Object.assign({}, s, { hidden: hidden }) : s; });
      secs.cv = nextCv;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'twin-table-dedup' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  [0, 500, 1400, 2800].forEach(function (ms) { setTimeout(run, ms); });
  [0, 700].forEach(function (ms) { setTimeout(unhidePrior, ms); });
  window.AntcvTwinTableDedup = { version: VERSION, run: run, unhidePrior: unhidePrior };
})();
