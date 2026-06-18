/* antcv-tables-core-dedup.js — TABLES-CORE-DEDUP-001 (owner 2026-06-18)
 * ============================================================================
 * Owner (screenshots): CORE COMPETENCIES repeats Focus Areas already shown in
 * WHAT I BRING. The generation prompt (app.src.js ~2760, rule A) now forces the
 * two tables to use DISJOINT Focus Areas, but that is a soft constraint — a
 * regen can still leak a shared row. This sidecar is the deterministic floor:
 * if `bring` and `core_comp` share a NORMALISED Focus Area, drop the duplicate
 * row from CORE COMPETENCIES — but ONLY if CORE keeps >=2 distinct rows after
 * the drop (a sparse 1-row table is worse than a duplicate, so leave it).
 *
 * WHAT I BRING wins the shared Focus Area (per the prompt: keep it in BRING,
 * swap CORE for a different competency — here we just remove the CORE twin).
 *
 * Tables: id `bring` + `core_comp`, type `table`, rows[0]=header
 * ["Focus Area","Strategic Expertise"], rows[1+]=[focus, expertise]. Rows may
 * be arrays OR {focus,expertise} objects — both handled. Match is EXACT on the
 * normalised focus text (strip HTML, collapse whitespace, drop punctuation,
 * lowercase); near-synonyms are the prompt's job, not this floor's.
 *
 * Sidecar-only — no app.js. Loop-safe: same-blob bail + write-only-on-change +
 * our own tagged event ignored. No-op when the tables are already disjoint, so
 * shipping it does NOT mask whether the prompt fix worked. Disable:
 * localStorage['antcv:disable-tables-core-dedup'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvTablesCoreDedup) return;
  window.__antcvTablesCoreDedup = '1.50.654';

  var SRC = 'tables-core-dedup';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-tables-core-dedup'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  function rowFocus(r) {
    if (Array.isArray(r)) return r[0];
    if (r && typeof r === 'object') return r.focus;
    return r;
  }

  function isTable(sec, id) {
    return sec && sec.id === id && sec.type === 'table' && Array.isArray(sec.rows);
  }

  // Returns a new rows array with CORE duplicates dropped, or null for no change.
  function dedupCore(bringRows, coreRows) {
    if (!Array.isArray(bringRows) || !Array.isArray(coreRows)) return null;
    // BRING focus set (skip header row 0).
    var bringSet = {};
    for (var i = 1; i < bringRows.length; i++) {
      var k = norm(rowFocus(bringRows[i]));
      if (k) bringSet[k] = true;
    }
    if (!Object.keys(bringSet).length) return null;

    var header = coreRows.length ? [coreRows[0]] : [];
    var body = coreRows.slice(1);
    var keep = [], dropped = 0;
    body.forEach(function (r) {
      var k = norm(rowFocus(r));
      if (k && bringSet[k]) { dropped++; return; }   // shared with BRING — candidate to drop
      keep.push(r);
    });
    if (!dropped) return null;                         // already disjoint — no-op
    if (keep.length < 2) return null;                  // would leave a sparse table — leave the dup
    return header.concat(keep);
  }

  var lastSec = null;
  function apply() {
    if (disabled()) return;
    try {
      var raw = localStorage.getItem('sections');
      if (!raw || raw === lastSec) return;
      var b = JSON.parse(raw), changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        var list = b[doc];
        if (!Array.isArray(list)) return;
        var bring = null, core = null;
        list.forEach(function (sec) {
          if (isTable(sec, 'bring')) bring = sec;
          else if (isTable(sec, 'core_comp')) core = sec;
        });
        if (!bring || !core) return;
        var next = dedupCore(bring.rows, core.rows);
        if (next) { core.rows = next; changed = true; }
      });
      if (changed) {
        var os = JSON.stringify(b); localStorage.setItem('sections', os); lastSec = os;
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
        try { console.info('[tables-core-dedup] dropped CORE COMPETENCIES row(s) duplicating WHAT I BRING'); } catch (_) {}
      } else lastSec = raw;
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvTablesCoreDedup = { version: '1.50.654', _apply: apply, _dedup: dedupCore };
})();
