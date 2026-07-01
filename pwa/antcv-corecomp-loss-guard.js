/* antcv-corecomp-loss-guard.js — CV-CORECOMP-BLANK-001 (#2, owner 2026-07-01)
 * ============================================================================
 * LAST-GOOD SNAPSHOT GUARD for the CV CORE COMPETENCIES table (`core_comp`).
 *
 * THE BUG (owner): after an LLM generation the CV CORE COMPETENCIES section
 * sometimes renders the me() SKELETON PLACEHOLDER rows ("[Focus area 1]" /
 * "[Strategic expertise - 1 or 2 lines]") instead of the real laminated rows,
 * forcing the owner to regenerate 2-3 times. The lamination writer always
 * overwrites core_comp with real-or-empty rows, and the generation-parse guard
 * (kernel-completeness-290) rejects placeholder rows at parse time - so the
 * bracket rows the owner sees come from a STALE cloud / me()-enforce RESTORE
 * triggered by the post-generation refresh, which re-reads a pre-lamination
 * sections blob and clobbers the freshly-laminated rows with the skeleton.
 * There is NO personalInfo.core_comp_rows, so a personalInfo-repair cannot heal
 * it; the only durable copy is a local snapshot.
 *
 * THIS GUARD (modeled on antcv-cl-prose-loss-guard-985.js): snapshot the REAL
 * core_comp rows to a LOCAL-ONLY key (`antcv:coreCompGuard`, NOT cloud-synced,
 * so it survives the restore), keyed by application (meta.company|meta.role).
 * When a later sections state shows ONLY placeholder/header rows, RE-APPLY the
 * snapshot. It only ever replaces a PLACEHOLDER-ONLY table with previously-seen
 * REAL rows - it never deletes, empties, or overwrites real rows, and never
 * crosses applications. Self-disabling on any error.
 * Disable: localStorage['antcv:disable-corecomp-guard']='1'.
 *
 * CV only. Does not touch the CL, the bring table, TOOLS, or any other section.
 */
(function () {
  'use strict';
  var VERSION = '1.51.30-corecomp-loss-guard';
  if (window.__antcvCoreCompGuard === VERSION) return;
  window.__antcvCoreCompGuard = VERSION;

  var STORE = 'antcv:coreCompGuard';
  var SECTION_ID = 'core_comp';
  var lastApplyAt = 0;

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-corecomp-guard'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function erasing() {
    try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); }
    catch (_) { return false; }
  }

  function appKey() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      return String((m.company || '') + '|' + (m.role || '')).slice(0, 200);
    } catch (_) { return '|'; }
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; }
    catch (_) { return null; }
  }
  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }

  // A cell is a placeholder if it is empty or starts with "[" (matches the
  // me() skeleton bracket rows and the cl-prose-guard's detector). The literal
  // header cells "Focus Area" / "Strategic Expertise" live in row 0 and are
  // skipped before this is consulted.
  function isPlaceholderCell(t) {
    var s = String(t == null ? '' : t).trim();
    return !s || s.charAt(0) === '[';
  }

  function coreCompSection(cv) {
    if (!Array.isArray(cv)) return null;
    for (var i = 0; i < cv.length; i++) {
      if (cv[i] && cv[i].id === SECTION_ID && Array.isArray(cv[i].rows)) return cv[i];
    }
    return null;
  }

  // A data row is REAL if it has >=1 non-placeholder cell; a data row is a
  // PLACEHOLDER row if every cell is a placeholder (e.g. ["[Focus area 5]",
  // "[Strategic expertise - 1 or 2 lines]"]). Row 0 is the header, always kept.
  function realDataRows(rows) {
    var out = [];
    if (!Array.isArray(rows)) return out;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!Array.isArray(row)) continue;
      for (var c = 0; c < row.length; c++) {
        if (!isPlaceholderCell(row[c])) { out.push(row); break; }
      }
    }
    return out;
  }
  // normalized key for a data row (for dedup): both cells, lowercased + collapsed.
  function rowKey(row) {
    if (!Array.isArray(row)) return '';
    return row.map(function (c) { return String(c == null ? '' : c).toLowerCase().replace(/\s+/g, ' ').trim(); }).join('||');
  }
  // header + real data rows, with EXACT-DUPLICATE rows dropped (keep first).
  // CORECOMP-DEDUP-ROWS-001 (owner 2026-07-01: "core competencies duplicating row 2 and 4 Optics
  // photonics"): a generation/fusion sometimes emits the same Focus Area row twice.
  function cleanRows(rows) {
    var header = (Array.isArray(rows) && rows.length) ? rows[0] : ['Focus Area', 'Strategic Expertise'];
    var seen = {}, out = [];
    realDataRows(rows).forEach(function (row) {
      var k = rowKey(row);
      if (k && seen[k]) return;
      seen[k] = true; out.push(row);
    });
    return [header].concat(out);
  }
  // Does the table carry EXACT-DUPLICATE data rows?
  function hasDuplicateData(sec) {
    if (!sec || !Array.isArray(sec.rows)) return false;
    var seen = {}, real = realDataRows(sec.rows);
    for (var i = 0; i < real.length; i++) { var k = rowKey(real[i]); if (!k) continue; if (seen[k]) return true; seen[k] = true; }
    return false;
  }
  // REAL = at least one real data row. A header-only or all-placeholder table is NOT real.
  function isReal(sec) { return !!(sec && Array.isArray(sec.rows) && realDataRows(sec.rows).length > 0); }
  // Does the table MIX real + placeholder rows (partial lamination that needs cleaning)?
  function hasPlaceholderData(sec) {
    if (!sec || !Array.isArray(sec.rows)) return false;
    for (var r = 1; r < sec.rows.length; r++) {
      var row = sec.rows[r];
      if (!Array.isArray(row)) continue;
      var allPh = true;
      for (var c = 0; c < row.length; c++) { if (!isPlaceholderCell(row[c])) { allPh = false; break; } }
      if (allPh) return true;
    }
    return false;
  }

  // Snapshot the real core_comp rows for the current application.
  function snapshot() {
    var secs = readSections(); if (!secs || !Array.isArray(secs.cv)) return;
    var sec = coreCompSection(secs.cv);
    if (!sec || !isReal(sec)) return;
    var key = appKey();
    var store = readStore();
    // store CLEAN rows only (header + real rows) so a later restore can never
    // bring placeholder "[Focus area N]" rows back.
    try { store[key] = { rows: JSON.parse(JSON.stringify(cleanRows(sec.rows))) }; }
    catch (_) { return; }
    // keep the store small: cap at the 6 most-recent application buckets.
    try {
      var keys = Object.keys(store);
      if (keys.length > 6) { for (var i = 0; i < keys.length - 6; i++) { if (keys[i] !== key) delete store[keys[i]]; } }
    } catch (_) {}
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (_) {}
  }

  // Re-apply the snapshotted real rows ONLY where the live core_comp is now
  // placeholder-only (or header-only) AND a real snapshot exists for this app.
  function reapply() {
    var now = (window.performance && performance.now) ? performance.now() : 0;
    if (now && lastApplyAt && (now - lastApplyAt) < 1200) return; // anti-loop
    var secs = readSections(); if (!secs || !Array.isArray(secs.cv)) return;
    var sec = coreCompSection(secs.cv);
    if (!sec) return;                 // section absent - nothing to heal in place
    if (isReal(sec)) {
      // Table has real rows. If it ALSO carries placeholder rows (partial
      // lamination — the owner's "[Focus area 5]/[Focus area 6]" mixed with real
      // Optics/Imaging rows) OR exact-duplicate rows (Optics photonics twice),
      // clean them in place. Never restore over a table that has real content.
      if (hasPlaceholderData(sec) || hasDuplicateData(sec)) {
        var cleaned = false;
        var cv2 = secs.cv.map(function (s) {
          if (!s || s.id !== SECTION_ID) return s;
          cleaned = true;
          var copy = JSON.parse(JSON.stringify(s));
          copy.rows = cleanRows(s.rows);
          return copy;
        });
        if (cleaned) {
          lastApplyAt = now || 1;
          secs.cv = cv2;
          try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'corecomp-loss-guard' } })); } catch (_) {}
          try { console.log('[CV-CORECOMP-LOSS-GUARD] dropped placeholder rows from a partially-laminated CORE COMPETENCIES table'); } catch (_) {}
        }
      }
      return;
    }
    var snap = readStore()[appKey()];
    if (!snap || !Array.isArray(snap.rows)) return;
    // The snapshot must itself be real (defence in depth).
    if (!isReal({ rows: snap.rows })) return;
    var changed = false;
    var cv = secs.cv.map(function (s) {
      if (!s || s.id !== SECTION_ID) return s;
      changed = true;
      var copy = JSON.parse(JSON.stringify(s));
      copy.rows = JSON.parse(JSON.stringify(snap.rows));
      return copy;
    });
    if (!changed) return;
    lastApplyAt = now || 1;
    secs.cv = cv;
    try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'corecomp-loss-guard' } })); } catch (_) {}
    try { console.log('[CV-CORECOMP-LOSS-GUARD] re-applied real CORE COMPETENCIES rows over restored placeholders'); } catch (_) {}
  }

  var t = null;
  function run() {
    if (disabled() || erasing()) return;
    try { reapply(); snapshot(); } catch (_) { /* self-disable on error */ }
  }
  function debounced() { if (t) clearTimeout(t); t = setTimeout(run, 400); }

  window.addEventListener('antcv:sections-updated', debounced);
  // Boot sweep + later windows to catch a cloud-restore / me()-enforce that
  // out-races the first pass (restore + converter sidecars settle by ~5s).
  [600, 1500, 3500, 7000, 12000].forEach(function (ms) { setTimeout(run, ms); });
  // Forever poll (like the cl-prose-guard): on a heavy load the stale restore
  // can placeholder core_comp long after the boot sweeps. Safe because reapply
  // ONLY replaces a placeholder-only table with a real snapshot, never a real
  // value, so it cannot fight a genuine user edit.
  setInterval(run, 2500);
  window.AntcvCoreCompGuard = { version: VERSION, run: run, snapshot: snapshot, reapply: reapply };
})();
