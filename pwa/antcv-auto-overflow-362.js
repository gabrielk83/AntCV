/* AntCV auto-overflow detection (v1.50.211, PB-AUTO-001)
 * ──────────────────────────────────────────────────────────────────────
 * Goal (architecture §5): when a column's rendered content is taller than
 * one page and the user has NOT set a manual page break, detect the overflow
 * and record an AUTOMATIC break, snapped to the nearest group/item boundary,
 * so the existing page-box engine (oMain / sidebar flatMap) can paginate it —
 * which in turn makes the salmon show, the watermark land on the last page,
 * and the PDF break between groups instead of mid-text.
 *
 * STEP 1 (this file): DETECTION ONLY. We measure and write a SEPARATE map
 * `localStorage['antcv:autoPages']` (same { sid: { itemIndex: page } } shape as
 * itemPages). NOTHING renders from it yet — so a measurement bug cannot affect
 * the preview. Verify in the console: `JSON.parse(localStorage['antcv:autoPages'])`
 * should hold a break index at a GROUP boundary for an over-long sidebar.
 * STEP 2 (next): app.src.js oMain + the sidebar flatMap read autoPages as
 * `effective = max(manual, auto, floor)`.
 *
 * Loop-safety: auto-pagination is inherently measure → break → re-measure.
 * Guards here: (a) we recompute from the section's OWN item heights, which are
 * stable whether or not the section is currently split, so the result is
 * idempotent; (b) we only write + pulse when the computed map actually CHANGES
 * (JSON snapshot); (c) rAF + debounce coalescing; (d) the whole pass is wrapped
 * in try/catch and is a strict NO-OP for the CL and when nothing overflows.
 */
(function () {
  'use strict';
  var VERSION = '1.50.211-auto-overflow-detect';
  if (window.__antcvAutoOverflow362 === VERSION) return;
  window.__antcvAutoOverflow362 = VERSION;

  var AUTO_KEY = 'antcv:autoPages';
  var SECTIONS_KEY = 'sections';
  // A4 preview page-box ≈ 1123px tall; trim a top/bottom safety margin so a
  // unit that visually crowds the page edge counts as overflow.
  var PAGE_H = 1123;
  var SAFETY = 70;
  var USABLE = PAGE_H - SAFETY;

  function readJson(k, f) { try { var v = JSON.parse(localStorage.getItem(k) || ''); return v && typeof v === 'object' ? v : f; } catch (_) { return f; } }
  function activeDoc() { try { var d = localStorage.getItem('doc') || ''; try { var p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (e) {} return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function sections() { var all = readJson(SECTIONS_KEY, {}); var l = all && all[activeDoc()]; return Array.isArray(l) ? l : []; }
  function sectionById(sid) { return sections().find(function (s) { return s && String(s.id || '') === String(sid || ''); }) || null; }
  function visible(el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length))); }
  function paper() { return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); }

  // The set of GROUP-start item indices for a section (labeled_list with
  // { group: … } dividers). An auto break must snap to one of these so we move
  // a whole group, never split mid-group. Falls back to every index for
  // non-grouped lists (break before any item is fine there).
  function groupStarts(sec) {
    var items = sec && Array.isArray(sec.items) ? sec.items : null;
    if (!items) return null;
    var hasGroups = items.some(function (it) { return it && it.group !== undefined; });
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (!hasGroups) { out.push(i); continue; }
      if (items[i] && items[i].group !== undefined) out.push(i);
    }
    return out;
  }

  // Snap an item index DOWN to the nearest group-start ≤ idx (so the break
  // lands at the top of the group the overflowing row belongs to).
  function snapToGroup(starts, idx) {
    if (!starts || !starts.length) return idx;
    var best = starts[0];
    for (var i = 0; i < starts.length; i++) { if (starts[i] <= idx) best = starts[i]; else break; }
    return best;
  }

  // Measure one sidebar section element: return the FIRST item index whose
  // bottom crosses `limit` (relative to columnTop), or -1 if it all fits.
  function firstOverflowItem(sectionEl, columnTop, limit) {
    var rows = sectionEl.querySelectorAll('[data-antcv-row-path^="items."]');
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      if (!visible(el)) continue;
      var path = String(el.getAttribute('data-antcv-row-path') || '');
      var m = /^items\.(\d+)/.exec(path);
      if (!m) continue;
      var bottom = el.getBoundingClientRect().bottom;
      if (bottom - columnTop > limit) return Number(m[1]);
    }
    return -1;
  }

  function compute() {
    if (activeDoc() !== 'cv') return {};            // CV page-box only for now
    var p = paper();
    if (!p) return {};
    var sidebar = p.querySelector('.antcv-document-sidebar, [data-antcv-document-sidebar="true"]');
    if (!sidebar || !visible(sidebar)) return {};
    var colTop = sidebar.getBoundingClientRect().top;
    var map = {};
    var secEls = sidebar.querySelectorAll('[data-sid]');
    for (var s = 0; s < secEls.length; s++) {
      var secEl = secEls[s];
      var sid = secEl.getAttribute('data-sid');
      if (!sid) continue;
      var sec = sectionById(sid);
      if (!sec) continue;
      var idx = firstOverflowItem(secEl, colTop, USABLE);
      if (idx < 1) continue;                         // fits, or first item — leave alone
      var starts = groupStarts(sec);
      var br = snapToGroup(starts, idx);
      if (br >= 1) { map[sid] = {}; map[sid][String(br)] = 2; }
      break;                                         // one auto break is enough to relieve page 1
    }
    return map;
  }

  var last = null;
  function run() {
    try {
      var map = compute();
      var snap = JSON.stringify(map);
      if (snap === last) return;                     // idempotent — no churn, no loop
      last = snap;
      // Only persist when it actually changed vs storage too.
      var existing = localStorage.getItem(AUTO_KEY) || '{}';
      if (existing === snap) return;
      localStorage.setItem(AUTO_KEY, snap);
      try { window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed', { detail: { source: 'auto-overflow-362' } })); } catch (_) {}
    } catch (e) { try { console.warn('[auto-overflow-362]', e && e.message); } catch (_) {} }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; setTimeout(run, 250); });
  }

  function start() {
    [400, 900, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('antcv:item-pages-changed', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    setInterval(schedule, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AntcvAutoOverflow362 = { version: VERSION, _compute: compute, _run: run };
  try { console.debug('[auto-overflow-362] installed ' + VERSION + ' (detection only)'); } catch (_) {}
})();
