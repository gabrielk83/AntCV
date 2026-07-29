/* antcv-sidebar-compact-001.js — TOOLS-SIDEBAR-COMPACT-BELT-001 (register row 26, owner 2026-07-03)
 * ============================================================================
 * Deterministic ITEM-LEVEL synonym/trim for the TOOLS & METHODS sidebar
 * Instruments / Lab & fabrication comma-lists, so the sidebar renders the owner's
 * GOLD text (ACTIVE_BUGS 2026-07-03 (1); OPEN_REGISTER row 26). Owner gold:
 *   Instruments -> "Optical benches, HRSEM, confocal imaging, interferometry,
 *                   Raman spectroscopy, probe stations"
 *   Lab & fabrication -> ends "...SOI MEMS/NEMS" (label already says fabrication).
 *
 * WHY a STORED-SECTIONS transform (not export-only): the owner requires preview +
 * PDF PARITY. Rewriting the stored `sections.cv` TOOLS rich_block value once means
 * BOTH the preview render and the export payload read the same gold text — the
 * export-preview-parity pattern (like tools-merge-dedup). Nothing else applies
 * these rules to the live render: gold-rules.json `compressions` is the python
 * density sweep + prompt block only.
 *
 * RULES (mirror gold-rules.json "sidebar_compact" — the canonical spec; these are
 * TRANSFORM rules, not a per-persona output hardcode):
 *   1. Phrase synonyms (unconditional): "confocal microscopy" -> "confocal imaging",
 *      "electrical probe stations" -> "probe stations".
 *   2. Drop a standalone token when a tighter sibling is present: drop "SEM" when
 *      "HRSEM" is a sibling; collapse "HRSEM/SEM" | "SEM/HRSEM" -> "HRSEM".
 *   3. Trim a redundant trailing word the label already carries: "fabrication".
 *
 * SCOPED by the row's lead label (Instruments / Lab & fabrication) so main-column
 * prose (e.g. the "confocal microscopy" Characterisation bullet) is NEVER touched.
 * rich_block VALUE only — never converts the block (cl-leadins-and-methods-richblock).
 * Text-verified, idempotent, restore-stable, self-disabling on error.
 * Kill switch: antcv:disable-sidebar-compact.
 */
(function () {
  'use strict';
  var VERSION = '1.51.2941-sidebar-compact';
  if (window.__antcvSidebarCompact === VERSION) return;
  window.__antcvSidebarCompact = VERSION;
  try { var off = localStorage.getItem('antcv:disable-sidebar-compact'); if (off === '1' || off === 'true') return; } catch (_) {}

  // Only these sidebar lead labels are in scope (matches the item's b / l / label).
  var SCOPE = /^\s*(instruments|lab\s*(?:&|and)\s*fabrication)\b/i;
  // 1) unconditional whole-phrase synonyms (case-insensitive).
  var SUBS = [
    ['confocal microscopy', 'confocal imaging'],
    ['electrical probe stations', 'probe stations'],
  ];
  // 2) drop token X (lowercased) when sibling Y (lowercased) is present.
  var DROP_WHEN_SIBLING = { sem: 'hrsem' };
  // 3) trim a redundant trailing comma-token (label already carries the word).
  var TRIM_TRAILING = ['fabrication'];

  function reEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Apply the compact rules to one comma-list VALUE. Returns the (possibly) rewritten
  // string; returns the input unchanged (no spacing churn) when no rule fires.
  function compactValue(val) {
    var s = String(val == null ? '' : val);
    // 1) phrase synonyms — unconditional
    SUBS.forEach(function (p) { s = s.replace(new RegExp(reEscape(p[0]), 'ig'), p[1]); });
    // 3) trim a redundant trailing WORD (handles both a whole ", fabrication" token
    //    and a " fabrication" suffix on the last token, e.g. "SOI MEMS/NEMS fabrication").
    TRIM_TRAILING.forEach(function (w) { s = s.replace(new RegExp('[,\\s]+' + reEscape(w) + '(\\.?)\\s*$', 'i'), '$1'); });

    // 2) drop-when-sibling (SEM when HRSEM present) — comma-token level
    var trailingDot = /\.\s*$/.test(s);
    var body = trailingDot ? s.replace(/\.\s*$/, '') : s;
    var toks = body.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t.length; });
    var tokChanged = false;
    var lower = toks.map(function (t) { return t.toLowerCase(); });
    Object.keys(DROP_WHEN_SIBLING).forEach(function (drop) {
      var sib = DROP_WHEN_SIBLING[drop];
      // pass 1: collapse a combined "HRSEM/SEM" | "SEM/HRSEM" token UNCONDITIONALLY (the
      // tighter sibling already implies the dropped one).
      for (var i = 0; i < toks.length; i++) {
        if (lower[i] === sib + '/' + drop || lower[i] === drop + '/' + sib) { toks[i] = sib.toUpperCase(); lower[i] = sib; tokChanged = true; }
      }
      // pass 2: drop a STANDALONE `drop` token only when the sibling is present.
      if (lower.indexOf(sib) === -1) return;
      for (var j = toks.length - 1; j >= 0; j--) {
        if (lower[j] === drop) { toks.splice(j, 1); lower.splice(j, 1); tokChanged = true; }
      }
    });

    if (tokChanged) s = toks.join(', ') + (trailingDot ? '.' : '');  // rejoin only when a token rule fired
    return s;
  }

  function isTools(s) { return !!(s && (s.id === 'tools' || /tools\s*&?\s*methods/i.test(String(s.title || '')))); }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }

  // Rewrite scoped rich_block values in one TOOLS section. Returns true if changed.
  function compactSection(sec) {
    if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return false;
    var changed = false;
    sec.items.forEach(function (it) {
      if (!it || it.grp) return;                              // group headers carry no comma-list value
      var label = String(it.b || it.l || it.label || '');
      if (!SCOPE.test(label)) return;
      var vk = (typeof it.t === 'string' && it.t) ? 't'
        : (typeof it.v === 'string' && it.v) ? 'v'
          : (typeof it.value === 'string' && it.value) ? 'value' : null;
      if (!vk) return;
      var next = compactValue(it[vk]);
      if (next !== it[vk]) { it[vk] = next; changed = true; }
    });
    return changed;
  }

  function run() {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) { if (isTools(secs.cv[i]) && compactSection(secs.cv[i])) changed = true; }
      if (!changed) return;                                   // idempotent: settled → no write, no re-dispatch
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'sidebar-compact' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  try { window.AntcvSidebarCompact = { version: VERSION, run: run, _compactValue: compactValue, _compactSection: compactSection }; } catch (_) {}
})();
