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
  window.__antcvAiToMethods = '1.50.689';

  var SRC = 'ai-assisted-to-methods';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-ai-to-methods'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function isAiItem(it) {
    return it && it.group === undefined && /\bai[\s\-]?assist/i.test(String(it.l || ''));
  }
  function isMethodsGroup(it) {
    return it && it.group !== undefined && /^\s*methods\s*$/i.test(String(it.group));
  }
  // Index of the next group marker strictly after `from` (or items.length).
  function nextGroupAfter(items, from) {
    for (var j = from + 1; j < items.length; j++) {
      if (items[j] && items[j].group !== undefined) return j;
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

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) {
        if (sec && sec.type === 'labeled_list' && relocate(sec.items)) changed = true;
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

  window.AntcvAiToMethods = { version: '1.50.689', _apply: apply, _relocate: relocate };
})();
