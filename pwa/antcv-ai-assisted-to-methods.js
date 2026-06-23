/* antcv-ai-assisted-to-methods.js — AI-ASSISTED-TO-METHODS-001 (owner 2026-06-19)
 * ============================================================================
 * Owner: "PUSH AI ASSISTED INTO THE GROUP METHODS."
 *
 * In TOOLS & METHODS the "AI-assisted: experiment setup, log triage, …" row is
 * generated as a floating item ABOVE the groups (Expertise / Tools / Methods).
 * It belongs INSIDE the Methods group. This relocates that row to the end of the
 * Methods group, in the stored sections blob.
 *
 * Sidecar-only, restore-proof, idempotent (a no-op once the row already sits in
 * the Methods group). Loop-safe: same-blob bail + write-only-on-change + own
 * tagged event ignored. Disable: localStorage['antcv:disable-ai-to-methods']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvAiToMethods) return;
  window.__antcvAiToMethods = '1.50.817';

  var SRC = 'ai-assisted-to-methods';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-ai-to-methods'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // AI-ASSISTED-EMPTY-GROUP-001 (owner 2026-06-22: the row was still floating above
  // the groups in a fresh generation): generation emits the AI-assisted row either
  // with no group field OR with group:"" (empty/whitespace) — both mean "not in a
  // group". The original guard only matched `group === undefined`, so an empty-string
  // group slipped past and the relocate never fired. Treat both as ungrouped.
  function noGroup(it) { return it && (it.group === undefined || it.group === null || /^\s*$/.test(String(it.group))); }
  function isAiItem(it) {
    return noGroup(it) && /\bai[\s\-]?assist/i.test(String(it.l || ''));
  }
  function isMethodsGroup(it) {
    return it && it.group !== undefined && /^\s*methods\s*$/i.test(String(it.group));
  }
  // A real group marker carries a NON-EMPTY group name (an empty-string group is an
  // ungrouped item, e.g. the floating AI-assisted row — not a boundary).
  function isGroupMarker(it) { return it && typeof it.group === 'string' && it.group.trim() !== ''; }
  // Index of the next group marker strictly after `from` (or items.length).
  function nextGroupAfter(items, from) {
    for (var j = from + 1; j < items.length; j++) {
      if (isGroupMarker(items[j])) return j;
    }
    return items.length;
  }

  // Relocate the AI-assisted row to the end of the Methods group. Returns true if
  // it mutated `items`.
  function relocate(items) {
    if (!Array.isArray(items)) return false;
    var aiIdx = -1, methodsIdx = -1, i;
    for (i = 0; i < items.length; i++) {
      if (aiIdx < 0 && isAiItem(items[i])) aiIdx = i;
      if (methodsIdx < 0 && isMethodsGroup(items[i])) methodsIdx = i;
    }
    if (aiIdx < 0 || methodsIdx < 0) return false;          // need both
    var methodsEnd = nextGroupAfter(items, methodsIdx);     // exclusive
    // Already inside the Methods group (between the marker and the next group)?
    if (aiIdx > methodsIdx && aiIdx < methodsEnd) return false;
    var ai = items.splice(aiIdx, 1)[0];
    // Removing the AI row before the Methods marker shifts the marker left by one.
    if (aiIdx < methodsIdx) { methodsIdx--; }
    methodsEnd = nextGroupAfter(items, methodsIdx);         // recompute after splice
    items.splice(methodsEnd, 0, ai);                        // end of the Methods group
    return true;
  }

  // RICH-BLOCK shape (AI-TO-METHODS-RICHBLOCK-001, owner 2026-06-23): TOOLS &
  // METHODS is now a `rich_block`, not a `labeled_list`. Its group headers are
  // items with `grp:true` (name in `t`) and its rows are `{b:<lead>, t:<body>}`.
  // The "AI-assisted" row floats ABOVE the first group; move it to the end of the
  // Methods group. Same algorithm as relocate(), keyed off grp markers + the `b`
  // lead. The old labeled_list path only matched `l`/`group`, so it never fired on
  // the migrated rich_block and the row kept floating.
  function isGrpMarkerR(it) { return !!(it && it.grp && String(it.t || '').trim()); }
  function isAiRowR(it) { return !!(it && !it.grp && /\bai[\s\-]?assist/i.test(String(it.b || it.l || it.t || ''))); }
  function isMethodsMarkerR(it) { return !!(it && it.grp && /^\s*methods\s*$/i.test(String(it.t || ''))); }
  function nextGrpAfterR(items, from) {
    for (var j = from + 1; j < items.length; j++) { if (isGrpMarkerR(items[j])) return j; }
    return items.length;
  }
  function relocateRich(items) {
    if (!Array.isArray(items)) return false;
    var aiIdx = -1, methodsIdx = -1, i;
    for (i = 0; i < items.length; i++) {
      if (aiIdx < 0 && isAiRowR(items[i])) aiIdx = i;
      if (methodsIdx < 0 && isMethodsMarkerR(items[i])) methodsIdx = i;
    }
    if (aiIdx < 0 || methodsIdx < 0) return false;
    var methodsEnd = nextGrpAfterR(items, methodsIdx);
    if (aiIdx > methodsIdx && aiIdx < methodsEnd) return false;   // already inside Methods
    var ai = items.splice(aiIdx, 1)[0];
    if (aiIdx < methodsIdx) methodsIdx--;
    methodsEnd = nextGrpAfterR(items, methodsIdx);
    items.splice(methodsEnd, 0, ai);
    return true;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) {
        if (!sec) return;
        if (sec.type === 'labeled_list' && relocate(sec.items)) changed = true;
        else if (sec.type === 'rich_block' && relocateRich(sec.items)) changed = true;
      });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[ai-assisted-to-methods] moved the AI-assisted row into the Methods group'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1500, 3000].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvAiToMethods = { version: '1.50.817', _apply: apply, _relocate: relocate, _relocateRich: relocateRich };
})();
