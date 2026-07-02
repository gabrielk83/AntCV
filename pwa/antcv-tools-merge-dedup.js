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
  var VERSION = '1.51.60-empty-group-order';
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

  // TOOLS-GROUP-FOLD-001 (owner 2026-06-24): after collapse(), any leading
  // ungrouped rows that are GENUINELY UNIQUE (no overlap with the groups, so
  // collapse() correctly leaves them) still render as a HEADERLESS PREAMBLE
  // before the first {grp} marker — the owner's "tools group broke apart"
  // (e.g. Product&systems / Software / Optics&imaging shown above an "Expertise"
  // group, with a separate "Tools" group further down). Fold those surviving
  // leading rows INTO a Tools-category group so the whole section is one coherent
  // grouped structure: merge them under an existing Tools/Software/Systems/
  // Instruments group if present, else prepend a "Tools" header (the canonical
  // me() group name — not a fabrication). Content-preserving, dedups exacts.
  // Loop-safe: once folded there are no ungrouped rows before the first {grp}
  // (firstGrp becomes 0), so the next run no-ops.
  var TOOLS_GRP_RX = /^\s*(tools?|software|systems?|instruments?)\b/i;
  function foldLeadingIntoGroup(sec) {
    if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return false;
    var items = sec.items;
    var firstGrp = -1;
    for (var i = 0; i < items.length; i++) { if (items[i] && items[i].grp) { firstGrp = i; break; } }
    if (firstGrp <= 0) return false;                       // no leading rows, or no groups
    var lead = items.slice(0, firstGrp).filter(function (it) { return it && !it.grp; });
    if (!lead.length) return false;                        // leading run had no real rows
    var rest = items.slice(firstGrp);
    var toolsHdr = -1;
    for (var j = 0; j < rest.length; j++) { if (rest[j] && rest[j].grp && TOOLS_GRP_RX.test(String(rest[j].t || ''))) { toolsHdr = j; break; } }
    var nextItems;
    if (toolsHdr >= 0) {
      // move the leading rows in right after that existing tools-category header
      nextItems = [];
      rest.forEach(function (it, k) { nextItems.push(it); if (k === toolsHdr) lead.forEach(function (l) { nextItems.push(l); }); });
    } else {
      // no tools-category group exists → prepend a "Tools" header over the leading rows
      nextItems = [{ grp: true, t: 'Tools' }].concat(lead, rest);
    }
    // dedup exact-duplicate rows (same lead+body)
    var seen = {}, out = [];
    nextItems.forEach(function (it) {
      if (it && !it.grp) { var k = String(it.b || '').toLowerCase().trim() + '|' + String(it.t || '').toLowerCase().trim(); if (seen[k]) return; seen[k] = 1; }
      out.push(it);
    });
    sec.items = out;
    return true;
  }

  // TOOLS-VALUE-DEDUP-001 (owner 2026-07-03, export 2026-07-02): the gen merge
  // appends kernel canon rows whose LABEL and GROUP are swapped versions of
  // rows the LLM already emitted ("grp Optics… / b:Expertise / t:<tail>" vs
  // "grp Expertise / b:Optics… / t:<same tail>") — byte-identical VALUES under
  // different labels, so every label-keyed dedup pass misses them. Drop a row
  // whose normalized BODY exactly equals an earlier kept row's body (>=24
  // chars — short legit repeats like "Python" under two labels are safe),
  // stash dropped rows on trimmedItems (hide-over-delete), then remove any
  // group header left with zero rows (the emptied umbrella Expertise/Tools).
  function dedupeValueRows(sec) {
    if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return false;
    var norm = function (t) { return String(t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); };
    var seen = {}, kept = [], dropped = [];
    sec.items.forEach(function (it) {
      if (it && !it.grp) {
        var body = norm(it.t);
        if (body.length >= 24 && seen[body]) { dropped.push(it); return; }
        if (body.length >= 24) seen[body] = 1;
      }
      kept.push(it);
    });
    if (!dropped.length) return false;
    // remove group headers that now own zero rows before the next grp/end
    var out = [];
    for (var i = 0; i < kept.length; i++) {
      var it = kept[i];
      if (it && it.grp) {
        var hasRow = false;
        for (var j = i + 1; j < kept.length; j++) {
          if (kept[j] && kept[j].grp) break;
          if (kept[j]) { hasRow = true; break; }
        }
        if (!hasRow) continue;
      }
      out.push(it);
    }
    sec.items = out;
    var prior = Array.isArray(sec.trimmedItems) ? sec.trimmedItems : [];
    var have = {}; prior.forEach(function (it) { have[String(it.b) + '|' + String(it.t)] = 1; });
    dropped.forEach(function (it) { var k = String(it.b) + '|' + String(it.t); if (!have[k]) { prior.push(it); have[k] = 1; } });
    sec.trimmedItems = prior;
    return true;
  }

  // TOOLS-EMPTY-GROUP-001 (owner 2026-07-03, Anita/unsolicited CV): the gen can emit a
  // group header with NO rows under it ("Software" printing as a bare centered label).
  // The old empty-header sweep only ran when dedupeValueRows dropped something; this
  // pass runs UNCONDITIONALLY. Idempotent.
  function dropEmptyGroups(sec) {
    if (!sec || !Array.isArray(sec.items)) return false;
    var items = sec.items, out = [], changed = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it && it.grp) {
        var hasRow = false;
        for (var j = i + 1; j < items.length; j++) {
          if (items[j] && items[j].grp) break;
          if (items[j]) { hasRow = true; break; }
        }
        if (!hasRow) { changed = true; continue; }
      }
      out.push(it);
    }
    if (!changed) return false;
    sec.items = out;
    return true;
  }
  // TOOLS-EXPERTISE-FIRST-001 (owner 2026-07-03): "Expertise should be the first item
  // in tools — make sure it fits the application type." For a FULLY UNSOLICITED
  // application the broad Expertise group leads; JD-targeted order is the generator's
  // call and is left alone. Moves the whole Expertise block (header + its rows) in
  // front of the first group. Idempotent (no-op when already first / absent).
  function fullyUnsolicited() {
    try {
      var jd = String(localStorage.getItem('antcv:lastJdText') || '').trim();
      if (jd.length >= 30) return false;
      var meta = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(meta.company || '').trim();
      return !co || /^(unsolicited|open application|n\/a)$/i.test(co);
    } catch (_) { return false; }
  }
  function expertiseFirst(sec) {
    if (!sec || !Array.isArray(sec.items) || !fullyUnsolicited()) return false;
    var items = sec.items, firstGrp = -1, expGrp = -1;
    for (var i = 0; i < items.length; i++) {
      if (!(items[i] && items[i].grp)) continue;
      if (firstGrp < 0) firstGrp = i;
      if (expGrp < 0 && /expertise/i.test(String(items[i].t || ''))) expGrp = i;
    }
    if (firstGrp < 0 || expGrp < 0 || expGrp === firstGrp) return false;
    var end = items.length;
    for (var k = expGrp + 1; k < items.length; k++) { if (items[k] && items[k].grp) { end = k; break; } }
    var block = items.slice(expGrp, end);
    var rest = items.slice(0, expGrp).concat(items.slice(end));
    sec.items = rest.slice(0, firstGrp).concat(block, rest.slice(firstGrp));
    return true;
  }

  function run() {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) {
        if (!isTools(secs.cv[i])) continue;
        if (collapse(secs.cv[i])) changed = true;
        if (foldLeadingIntoGroup(secs.cv[i])) changed = true;
        if (dedupeValueRows(secs.cv[i])) changed = true;
        if (dropEmptyGroups(secs.cv[i])) changed = true;
        if (expertiseFirst(secs.cv[i])) changed = true;
      }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'tools-merge-dedup' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvToolsMergeDedup = { version: VERSION, run: run, _collapse: collapse, _dedupeValueRows: dedupeValueRows, _dropEmptyGroups: dropEmptyGroups, _expertiseFirst: expertiseFirst };
})();
