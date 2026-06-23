/* antcv-tables-partition.js — TABLES-PARTITION-001 (owner 2026-06-23)
 * ============================================================================
 * Deterministic partitioner: guarantee the CV "CORE COMPETENCIES" and the CL
 * "WHAT I BRING" tables have DISJOINT Focus Areas, each with 3-4 distinct rows.
 *
 * WHY THE PRIOR CONTROLS FAILED (owner 2026-06-23, "the tables are still very
 * close ... why is it not different from the beginning"):
 *  1. The prompt (TABLE-DIRECTION-001, app.src.js) asks the LLM to enumerate 7-8
 *     DISTINCT competency signals and split 3-4 / 3-4 — but the model often emits
 *     only ~4 and reuses 3 in BOTH tables, so the pool is too small to partition.
 *  2. The drop-only floor (antcv-tables-core-dedup.js) BAILS when dropping the
 *     dupes would leave CORE with <2 rows — exactly the severe-overlap case — and
 *     it can only drop, never swap in a replacement.
 *  3. That floor also looks for `bring` and `core_comp` in the SAME doc list, but
 *     `core_comp` lives in the CV and `bring` in the CL, so it never even compares
 *     them cross-document.
 *
 * THIS SIDECAR is the deterministic fix: it scans BOTH docs for each table,
 * ENLARGES the competency pool from the candidate's OWN kernel (the `tools`
 * "Expertise"/"Methods" groups — real Focus-Area/expertise pairs in their own
 * words), and FORCE-PARTITIONS:
 *  - WHAT I BRING is the winner of any shared Focus Area (application-specific;
 *    per the prompt) and is NEVER modified here.
 *  - CORE COMPETENCIES drops any Focus Area shared with BRING, KEEPS its own
 *    distinct rows, then FILLS back up to a 3-4 row target from the kernel pool
 *    (Focus Areas not in BRING and not already in CORE), compacted.
 *  - Never fabricates: every fill row is the candidate's real tool label + a
 *    compacted version of its stored value.
 *
 * Idempotent + loop-safe (same-blob bail + own-event ignore). After a pass
 * CORE n BRING = empty and CORE has <= target rows, so a re-run is a no-op (and
 * the old dedup floor then also no-ops). Disable: localStorage
 * ['antcv:disable-tables-partition'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.827';
  if (window.__antcvTablesPartition === VERSION) return;
  window.__antcvTablesPartition = VERSION;

  var SRC = 'tables-partition';
  var CORE_TARGET = 4;     // aim for 4 CORE rows
  var CORE_MIN = 3;        // never leave fewer than this if the pool can fill
  var EXPERTISE_MAX = 60;  // compact the CORE expertise cell (kept tight)

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-tables-partition'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function rowFocus(r) { if (Array.isArray(r)) return r[0]; if (r && typeof r === 'object') return r.focus; return r; }
  function rowExpertise(r) { if (Array.isArray(r)) return r[1]; if (r && typeof r === 'object') return r.expertise; return ''; }
  function isTable(sec, id) { return sec && sec.id === id && sec.type === 'table' && Array.isArray(sec.rows); }

  // Compact a long stored expertise value into a tight comma phrase for CORE.
  function compact(v) {
    var s = String(v == null ? '' : v).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    // strip a leading parenthetical and trailing detail in parens
    s = s.replace(/\s*\([^)]*\)/g, '');
    if (s.length <= EXPERTISE_MAX) return s;
    // keep whole comma-separated tokens up to the cap
    var parts = s.split(',');
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      if (!piece) continue;
      var next = (out ? out + ', ' : '') + piece;   // keep ", " spacing, not bare ","
      if (next.length > EXPERTISE_MAX) break;
      out = next;
    }
    if (!out) out = s.slice(0, EXPERTISE_MAX).replace(/\s+\S*$/, '');
    return out.trim();
  }

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function readPersonalInfo() {
    try { var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return p.personalInfo || p; }
    catch (_) { return {}; }
  }

  // Build the competency pool from the kernel `tools` "Expertise" + "Methods"
  // groups: each labeled item under those groups is a Focus Area + expertise.
  var POOL_GROUPS = { 'expertise': 1, 'methods': 1 };
  function kernelPool() {
    var pi = readPersonalInfo();
    var tools = Array.isArray(pi.tools) ? pi.tools : [];
    var pool = [], group = '';
    tools.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      if (it.group) { group = norm(it.group); return; }
      if (it.l && POOL_GROUPS[group]) {
        var ex = compact(it.v);
        if (ex) pool.push({ focus: String(it.l).trim(), expertise: ex });
      }
    });
    return pool;
  }

  // Returns a new CORE rows array (header + body) partitioned disjoint from BRING,
  // filled from the pool to the target — or null if no change is needed.
  function partitionCore(bringRows, coreRows, pool) {
    if (!Array.isArray(bringRows) || !Array.isArray(coreRows)) return null;
    var header = coreRows.length ? coreRows[0] : ['Focus Area', 'Strategic Expertise'];

    var bringSet = {};
    for (var i = 1; i < bringRows.length; i++) { var bk = norm(rowFocus(bringRows[i])); if (bk) bringSet[bk] = true; }
    if (!Object.keys(bringSet).length) return null; // BRING empty — nothing to disjoin against

    // Keep CORE's own rows that are NOT shared with BRING (preserve the LLM's good ones).
    var keep = [], seen = {}, droppedShared = false;
    for (var j = 1; j < coreRows.length; j++) {
      var r = coreRows[j], k = norm(rowFocus(r));
      if (!k) continue;
      if (bringSet[k]) { droppedShared = true; continue; }   // shared with BRING -> drop from CORE
      if (seen[k]) continue;                                  // internal dup
      seen[k] = true; keep.push(r);
    }

    // Only act when there is something to FIX: either CORE shared a Focus Area
    // with BRING (must disjoin) or CORE fell below the minimum row count. An
    // already-disjoint CORE with >= CORE_MIN rows is left exactly as-is (do not
    // force it up to the target, or every load would mutate a good table).
    var needsFix = droppedShared || keep.length < CORE_MIN;
    if (!needsFix) return null;

    // Fill from the kernel pool up to the target with Focus Areas not in BRING/CORE.
    for (var p = 0; p < pool.length && keep.length < CORE_TARGET; p++) {
      var pk = norm(pool[p].focus);
      if (!pk || bringSet[pk] || seen[pk]) continue;
      seen[pk] = true;
      keep.push([pool[p].focus, pool[p].expertise]);
    }

    // If the pool could not bring CORE up to the minimum, leave the table
    // untouched (a sparse table is worse than the original overlap).
    if (keep.length < CORE_MIN) return null;
    return [header].concat(keep);
  }

  // Locate a table by id across BOTH docs (core_comp normally CV, bring normally CL).
  function findTable(secs, id) {
    var docs = ['cv', 'cl'];
    for (var d = 0; d < docs.length; d++) {
      var list = secs[docs[d]];
      if (!Array.isArray(list)) continue;
      for (var i = 0; i < list.length; i++) if (isTable(list[i], id)) return list[i];
    }
    return null;
  }

  var lastSec = null;
  function apply() {
    if (disabled()) return;
    try {
      var raw = localStorage.getItem('sections');
      if (!raw || raw === lastSec) return;
      var secs = JSON.parse(raw);
      var bring = findTable(secs, 'bring');
      var core = findTable(secs, 'core_comp');
      if (!bring || !core) { lastSec = raw; return; }
      var next = partitionCore(bring.rows, core.rows, kernelPool());
      if (next) {
        core.rows = next;
        var os = JSON.stringify(secs);
        localStorage.setItem('sections', os); lastSec = os;
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
        try { console.info('[tables-partition] partitioned CORE COMPETENCIES disjoint from WHAT I BRING (' + (core.rows.length - 1) + ' rows)'); } catch (_) {}
      } else { lastSec = raw; }
    } catch (_) { /* self-disable on any error */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [600, 1600, 3000].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 5000);

  window.AntcvTablesPartition = { version: VERSION, _apply: apply, _partition: partitionCore, _pool: kernelPool, _compact: compact, _norm: norm };
})();
