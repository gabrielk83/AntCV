/* antcv-dup-group-merge.js — DUP-GROUP-MERGE-001 (owner 2026-06-24)
 * ============================================================================
 * A generation/normalisation merge can leave a grouped sidebar section with the
 * SAME logical {grp} group emitted TWICE under case/&-variant names, e.g. the
 * owner's REGULATORY CONTEXT had SEVEN group headers but only FOUR distinct
 * groups: "Systems, safety and cybersecurity" + "Systems, Safety & Cybersecurity",
 * "Electrical and EMC" + "Electrical & EMC", "Environmental, durability and
 * materials compliance" + "Environmental, Durability & Materials Compliance".
 * The duplicate headers (and any exact-duplicate rows) bloat the sidebar — which
 * is the column that drives the multi-page CV overflow — and read as a defect.
 *
 * Fix: for each grouped CV section, MERGE groups whose names canonicalise the same
 * (lowercase, & -> and, punctuation collapsed) under the FIRST occurrence's header,
 * concatenating their rows and dropping EXACT-duplicate rows (same canonical
 * lead+body). Leading ungrouped rows are preserved in place. Distinct groups are
 * untouched. Idempotent + loop-safe (once merged there are no duplicate canonical
 * groups -> no further write). Restore-proof (runs on boot + sections-updated).
 * Kill switch: antcv:disable-dup-group-merge. Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.51.173-dup-group-merge-named-fold';
  if (window.__antcvDupGroupMerge === VERSION) return;
  window.__antcvDupGroupMerge = VERSION;
  try { var off = localStorage.getItem('antcv:disable-dup-group-merge'); if (off === '1' || off === 'true') return; } catch (_) {}

  function canon(t) { return String(t || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function rowKey(it) { return canon((it && (it.b || it.l)) || '') + '|' + canon((it && (it.t || it.v)) || ''); }
  function readSecs() { try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; } }

  // REG-GROUP-FOLD-NAMED-001 (owner 2026-07-05): REGULATORY CONTEXT kept
  // splitting the SAME standards across two headers — "Environmental &
  // Durability" and "Environmental, Durability & [Materials] Compliance" — one
  // group for what the owner wants merged under the SHORTER name. The
  // canon-auto-merge below only folds groups whose canonical text is IDENTICAL
  // (&/and/punctuation-only differences); these two differ by a whole extra
  // word ("compliance"), so canon() never equates them and the split survived
  // live even after shortenRegulatoryHeading trimmed "Materials" off the long
  // form. Named fold, same precedent as antcv-docx-client.js's
  // SIDEBAR_GROUP_MERGE: fold the compliance-flavored header's rows into the
  // shorter header, keeping the shorter header's text.
  var NAMED_FOLD = [
    { from: /^environmental,?\s*durability\s*&?\s*(materials\s*)?compliance$/i, into: 'Environmental & Durability' },
  ];
  function applyNamedFolds(blocks) {
    var changed = false;
    NAMED_FOLD.forEach(function (rule) {
      var dstCanon = canon(rule.into);
      var dstIdx = -1, srcIdx = -1;
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].canon === dstCanon) dstIdx = i;
        else if (srcIdx < 0 && rule.from.test(String(blocks[i].header.t || '').trim())) srcIdx = i;
      }
      if (dstIdx < 0 || srcIdx < 0 || dstIdx === srcIdx) return;
      var dst = blocks[dstIdx], src = blocks[srcIdx];
      var seen = {}; dst.rows.forEach(function (r) { seen[rowKey(r)] = 1; });
      src.rows.forEach(function (r) { var k = rowKey(r); if (!seen[k]) { dst.rows.push(r); seen[k] = 1; } });
      blocks.splice(srcIdx, 1);
      changed = true;
    });
    return changed;
  }

  // Merge duplicate-canonical {grp} groups in one section's items[]. Returns true if changed.
  function mergeGroups(sec) {
    if (!sec || !Array.isArray(sec.items)) return false;
    var items = sec.items;
    if (!items.some(function (it) { return it && it.grp; })) return false; // not grouped
    // Partition into a leading ungrouped run + ordered group blocks.
    var lead = [], blocks = [], cur = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it && it.grp) { cur = { header: it, canon: canon(it.t), rows: [] }; blocks.push(cur); }
      else if (cur) { cur.rows.push(it); }
      else lead.push(it);
    }
    var namedChanged = applyNamedFolds(blocks);
    // Merge blocks sharing a canonical name into the FIRST occurrence.
    var byCanon = {}, order = [], changed = namedChanged;
    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      if (!blk.canon) { order.push(blk); continue; } // empty group name — keep as-is
      if (byCanon[blk.canon]) {
        var tgt = byCanon[blk.canon];
        var seen = {}; tgt.rows.forEach(function (r) { seen[rowKey(r)] = 1; });
        blk.rows.forEach(function (r) { var k = rowKey(r); if (!seen[k]) { tgt.rows.push(r); seen[k] = 1; } });
        changed = true;
      } else { byCanon[blk.canon] = blk; order.push(blk); }
    }
    if (!changed) return false;
    var out = lead.slice();
    order.forEach(function (blk) { out.push(blk.header); blk.rows.forEach(function (r) { out.push(r); }); });
    sec.items = out;
    return true;
  }

  function run() {
    try {
      var secs = readSecs();
      var changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        for (var i = 0; i < secs[doc].length; i++) { if (mergeGroups(secs[doc][i])) changed = true; }
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'dup-group-merge' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 400, 1200, 3000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvDupGroupMerge = { version: VERSION, run: run, _merge: mergeGroups };
})();
