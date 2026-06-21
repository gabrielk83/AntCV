/* antcv-tools-merge-dedup.js — TOOLS-MERGE-DEDUP-001 (owner 2026-06-22)
 * ============================================================================
 * ROOT cause of the salmon/pagination mess (owner's export PDF: 6 pages, sidebar
 * spanning 1-4, main column empty 2-5, blank page 5, experience cont. on page 6):
 * the TOOLS & METHODS section carries the SAME tools TWICE — a concise top list
 * (ungrouped rows: "Data & analytics", "Project workflow", "Methods",
 * "Documentation") AND verbose groups that REPEAT them (a "Tools" group, a
 * "Methods" group). That ~2× bloat pushes the sidebar across 4 pages and strands
 * the main column.
 *
 * Owner decision: MERGE (each tool once) but KEEP the trimmed version available
 * ("the reason they both show is to support a trimmed CV — keep hidden until
 * needed"). So: when the section has BOTH ungrouped leading rows AND groups, and
 * the leading rows' tools OVERLAP the grouped tools, STASH the leading rows on
 * `section.trimmedItems` (preserved, not deleted) and remove them from the visible
 * `items` — leaving the deduplicated detailed groups. Also drop an exact-duplicate
 * grouped row. A trimmed-CV mode can later swap `trimmedItems` back in.
 *
 * Idempotent (once collapsed there are no overlapping leading rows → no-op).
 * Restore-stable. rich_block tools only. Self-disabling on error. Kill switch:
 * antcv:disable-tools-dedup.
 */
(function () {
  'use strict';
  var VERSION = '1.50.780';
  if (window.__antcvToolsMergeDedup === VERSION) return;
  window.__antcvToolsMergeDedup = VERSION;
  try { var off = localStorage.getItem('antcv:disable-tools-dedup'); if (off === '1' || off === 'true') return; } catch (_) {}

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function isTools(s) { return !!(s && (s.id === 'tools' || /tools\s*&?\s*methods/i.test(String(s.title || '')))); }
  function tokens(t) {
    return String(t || '').toLowerCase().split(/[,;]+/).map(function (x) { return x.replace(/\([^)]*\)/g, '').trim(); }).filter(function (x) { return x.length > 1; });
  }
  // fraction of `a`'s tokens present in the token-set `set`
  function overlap(a, set) {
    var ta = tokens(a); if (!ta.length) return 0;
    var hit = 0; ta.forEach(function (x) { if (set[x]) hit++; });
    return hit / ta.length;
  }

  function collapse(sec) {
    if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return false;
    var items = sec.items;
    // split into the leading ungrouped run and the rest (which contains the groups)
    var firstGrp = -1;
    for (var i = 0; i < items.length; i++) { if (items[i] && items[i].grp) { firstGrp = i; break; } }
    if (firstGrp <= 0) return false;                 // no leading ungrouped rows, or no groups → nothing to merge
    var lead = items.slice(0, firstGrp);
    var rest = items.slice(firstGrp);
    // token-set of everything in the grouped part (bodies of non-group rows)
    var groupedSet = {};
    rest.forEach(function (it) { if (it && !it.grp) tokens(it.t).forEach(function (x) { groupedSet[x] = 1; }); });
    // a leading row is a DUPLICATE when most of its tools already appear in the groups
    var keepLead = [], stash = [];
    lead.forEach(function (it) {
      if (it && !it.grp && overlap(it.t, groupedSet) >= 0.5) stash.push(it); else keepLead.push(it);
    });
    if (!stash.length) return false;                 // leading rows are genuinely unique → leave them

    // dedup exact-duplicate rows within the kept/visible set (same lead+body)
    var seen = {}, nextItems = [];
    keepLead.concat(rest).forEach(function (it) {
      if (it && !it.grp) {
        var k = String(it.b || '').toLowerCase().trim() + '|' + String(it.t || '').toLowerCase().trim();
        if (seen[k]) return; seen[k] = 1;
      }
      nextItems.push(it);
    });

    sec.items = nextItems;
    // preserve the trimmed/concise version (merge in, don't clobber a prior stash)
    var prior = Array.isArray(sec.trimmedItems) ? sec.trimmedItems : [];
    var have = {}; prior.forEach(function (it) { have[String(it.b) + '|' + String(it.t)] = 1; });
    stash.forEach(function (it) { var k = String(it.b) + '|' + String(it.t); if (!have[k]) { prior.push(it); have[k] = 1; } });
    sec.trimmedItems = prior;
    return true;
  }

  function run() {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) { if (isTools(secs.cv[i]) && collapse(secs.cv[i])) changed = true; }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'tools-merge-dedup' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvToolsMergeDedup = { version: VERSION, run: run, _collapse: collapse };
})();
