/* AntCV main-column overflow detection (v1.50.811, PB-MAIN-OVERFLOW-001 step 1)
 * ──────────────────────────────────────────────────────────────────────
 * THE GAP THIS FILLS
 * The only overflow detector that ever existed (antcv-auto-overflow-362.js)
 * measured the SIDEBAR only, and was stood down at 1.50.215 (it broke mobile
 * and scrambled the 2-column PDF). Nothing measures the MAIN column. So when
 * the main column is a hair over a whole-page boundary, the preview shows no
 * page-N salmon signal — the export silently desyncs the tail onto a later
 * page with a blank page between, and the user has nothing to act on.
 *
 * WHAT THIS FILE DOES — DETECTION ONLY.
 * It measures the main column's TOTAL content height across ALL page-rows
 * (unpaginated total, the prerequisite the 362 standdown note called out),
 * divides by the LIVE-measured usable A4 height, and writes a read-only
 * snapshot to localStorage['antcv:mainOverflow']. NOTHING renders from it.
 * A measurement bug therefore cannot touch the preview or the export.
 *
 * Verify in console:  JSON.parse(localStorage['antcv:mainOverflow'])
 * or:                 window.AntcvMainOverflow364.measure()
 *
 * THE THRESHOLD (owner spec)
 * Auto-squeeze (a LATER step, NOT here) should only fire for a SMALL overshoot
 * — about 2-3 body lines. So the verdict buckets are:
 *   overshootLines <= 0          → 'fits'    (if the export still split it, the
 *                                              fault is pagination desync, not
 *                                              overflow → 'desync-suspected')
 *   0 < overshootLines <= 3      → 'squeeze' (auto-eligible later)
 *   overshootLines > 3           → 'too-much' (flag for trim; do NOT squeeze)
 * "Lines" is measured from a real body line height in the DOM, not hardcoded,
 * so it tracks the active font / line-spacing.
 *
 * LOOP-SAFETY (same discipline as 362)
 * (a) Pure measurement — we never write a style, never add a node, so our work
 *     cannot feed the MutationObserver that schedules us. (b) We only write the
 *     localStorage key + pulse an event when the snapshot's verdict/over value
 *     actually CHANGES (JSON compare). (c) rAF + debounce coalescing. (d) Whole
 *     pass wrapped in try/catch; strict NO-OP for the CL and when there is no
 *     main column. (e) CV-only.
 */
(function () {
  'use strict';
  var VERSION = '1.50.811-main-overflow-detect';
  if (window.__antcvMainOverflow364 === VERSION) return;
  window.__antcvMainOverflow364 = VERSION;

  var OUT_KEY = 'antcv:mainOverflow';

  var PAPER_SEL = '.antcv-preview-paper,[data-antcv-preview-paper]';
  var ROW_SEL = '.antcv-page-row';
  var MAIN_SEL = '[data-antcv-document-main="true"],.antcv-document-main';

  // Fallback usable height if we cannot measure one live. 794px ≈ A4 width;
  // 1123px ≈ A4 height; 70px safety margin mirrors antcv-auto-overflow-362's
  // USABLE so the two detectors agree on what "a page" means.
  var FALLBACK_PAGE_PX = 1123;
  var FALLBACK_SAFETY = 70;

  // Squeeze band, in body lines (owner: ~2-3). Kept as a line count, converted
  // to px at measure-time via a real measured line height.
  var SQUEEZE_MAX_LINES = 3;

  function activeDoc() {
    try {
      var d = localStorage.getItem('doc') || '';
      try { var p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (e) {}
      return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv';
    } catch (_) { return 'cv'; }
  }
  function paper() { return document.querySelector(PAPER_SEL); }
  function visible(el) {
    return !!(el && el.isConnected &&
      (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)));
  }

  // Content height of one main-column box = lowest child bottom minus the
  // box top. Same trick as antcv-sidebar-fill-equalize-227: the box is
  // flex-stretched to the page-row, so getBoundingClientRect().height reports
  // the STRETCHED size, not the content. Children-sum reads the real content.
  function contentHeight(box) {
    var top = box.getBoundingClientRect().top;
    var maxB = top;
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) {
      var rc = kids[i].getBoundingClientRect();
      if (rc.height > 0 && rc.bottom > maxB) maxB = rc.bottom;
    }
    return Math.max(0, Math.ceil(maxB - top));
  }

  // Live usable page height: the inner height of the FIRST full page-row's
  // box, minus the candidate header band if that band lives inside the row.
  // Page 1 carries the header (it eats into page 1 only); subsequent pages do
  // not. We approximate "usable per page" as the tallest page-row's client
  // height trimmed by a small safety margin. Falls back to the A4 constant.
  function usablePageHeight(p) {
    try {
      var rows = p.querySelectorAll(ROW_SEL);
      var best = 0;
      for (var i = 0; i < rows.length; i++) {
        if (!visible(rows[i])) continue;
        var h = rows[i].clientHeight || Math.round(rows[i].getBoundingClientRect().height);
        if (h > best) best = h;
      }
      if (best > 200) return best - FALLBACK_SAFETY;
    } catch (_) {}
    return FALLBACK_PAGE_PX - FALLBACK_SAFETY;
  }

  // A representative body line height in the main column: probe the first
  // paragraph-like child and read its computed line-height; fall back to a
  // Calibri-10.5/1.15 estimate scaled to the preview's px-per-pt.
  function bodyLineHeight(mainBoxes) {
    try {
      for (var i = 0; i < mainBoxes.length; i++) {
        var cand = mainBoxes[i].querySelector('p, li, [data-antcv-row-path]');
        if (cand) {
          var lh = parseFloat(getComputedStyle(cand).lineHeight);
          if (lh && lh > 6 && lh < 60) return lh;
        }
      }
    } catch (_) {}
    // 10.5pt * 1.15 line, px-per-pt ≈ 794/595.28 ≈ 1.334
    return 10.5 * 1.15 * (794 / 595.28);
  }

  function measure() {
    var snapshot = {
      ts: Date.now(),
      version: VERSION,
      doc: activeDoc(),
      totalMainPx: 0,
      usablePx: 0,
      lineHeightPx: 0,
      rows: 0,
      pagesNeeded: 0,
      pageTarget: 0,
      overshootPx: 0,
      overshootPages: 0,
      overshootLines: 0,
      squeezeEligible: false,
      verdict: 'unknown',
    };

    if (snapshot.doc !== 'cv') { snapshot.verdict = 'not-cv'; return snapshot; }
    var p = paper();
    if (!p) { snapshot.verdict = 'no-paper'; return snapshot; }

    var rows = Array.prototype.slice.call(p.querySelectorAll(ROW_SEL)).filter(visible);
    // Collect the main box from each page-row. Sum their CONTENT heights to get
    // the unpaginated total — works whether main is one tall row (page-fit) or
    // already split into several page-boxes (manual-break engine).
    var mainBoxes = [];
    for (var i = 0; i < rows.length; i++) {
      var mb = rows[i].querySelector(MAIN_SEL);
      if (mb && visible(mb)) mainBoxes.push(mb);
    }
    // Fallback: no page-rows yet (single flat main) — grab any main box on the paper.
    if (!mainBoxes.length) {
      var any = p.querySelector(MAIN_SEL);
      if (any && visible(any)) mainBoxes.push(any);
    }
    if (!mainBoxes.length) { snapshot.verdict = 'no-main'; return snapshot; }

    var total = 0;
    for (var j = 0; j < mainBoxes.length; j++) total += contentHeight(mainBoxes[j]);

    var usable = usablePageHeight(p);
    var lineH = bodyLineHeight(mainBoxes);
    if (!(usable > 0) || !(lineH > 0)) { snapshot.verdict = 'measure-fail'; return snapshot; }

    var pagesNeeded = total / usable;
    // Target the page count the document is TRYING to hit. The whole point of
    // a squeeze is "you are 2.03 pages → pull the 0.03 back to land on 2", NOT
    // "you fit comfortably in 3". So the target is the FLOOR of pagesNeeded
    // whenever the bit past that floor is within the squeeze band (a few lines)
    // — i.e. close enough below that squeezing can reach it. Otherwise the
    // content genuinely needs the next whole page, so round up.
    //   2.030 pages, floor 2, 0.030 past floor ≈ 2 lines  → target 2, overshoot +2 lines (squeeze)
    //   2.300 pages, floor 2, 0.300 past floor ≈ 19 lines → target 3, overshoot ≤ 0 (fits 3, too much to squeeze to 2)
    //   2.000 pages exactly                                → target 2, overshoot 0 (fits)
    var floorPages = Math.max(1, Math.floor(pagesNeeded + 1e-6));
    var pastFloorPx = total - floorPages * usable;          // height past the floor boundary
    var pastFloorLines = pastFloorPx / lineH;
    var pageTarget = (pastFloorLines <= SQUEEZE_MAX_LINES + 0.001)
      ? floorPages                                          // squeezable down to the floor
      : Math.max(1, Math.ceil(pagesNeeded - 1e-6));         // genuinely needs the next page
    var overshootPx = total - pageTarget * usable;               // ≤ 0 when it fits the target
    var overshootPages = overshootPx / usable;
    var overshootLines = overshootPx / lineH;

    snapshot.totalMainPx = Math.round(total);
    snapshot.usablePx = Math.round(usable);
    snapshot.lineHeightPx = Math.round(lineH * 10) / 10;
    snapshot.rows = rows.length;
    snapshot.pagesNeeded = Math.round(pagesNeeded * 1000) / 1000;
    snapshot.pageTarget = pageTarget;
    snapshot.overshootPx = Math.round(overshootPx);
    snapshot.overshootPages = Math.round(overshootPages * 1000) / 1000;
    snapshot.overshootLines = Math.round(overshootLines * 100) / 100;

    if (overshootLines <= 0.001) {
      // Content fits the target. If the live preview is nonetheless split into
      // MORE rows than the target needs, the fault is pagination desync, not
      // overflow — flag it distinctly so a squeeze pass never fires here.
      snapshot.verdict = (rows.length > pageTarget) ? 'desync-suspected' : 'fits';
      snapshot.squeezeEligible = false;
    } else if (overshootLines <= SQUEEZE_MAX_LINES + 0.001) {
      snapshot.verdict = 'squeeze';
      snapshot.squeezeEligible = true;
    } else {
      snapshot.verdict = 'too-much';
      snapshot.squeezeEligible = false;
    }
    return snapshot;
  }

  // Only persist + pulse when the meaningful fields change, so we never spin
  // the localStorage write or wake listeners on a no-op re-measure.
  var lastKey = null;
  function sigOf(s) {
    return [s.verdict, s.pageTarget, s.overshootLines, s.totalMainPx, s.rows].join('|');
  }

  function run() {
    try {
      var s = measure();
      var sig = sigOf(s);
      if (sig === lastKey) return;
      lastKey = sig;
      try { localStorage.setItem(OUT_KEY, JSON.stringify(s)); } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('antcv:main-overflow-changed', { detail: s }));
      } catch (_) {}
      try { console.debug('[main-overflow-364]', s.verdict, 'over', s.overshootLines, 'lines', s); } catch (_) {}
    } catch (e) {
      try { console.warn('[main-overflow-364]', e && e.message); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; setTimeout(run, 250); });
  }

  function start() {
    [400, 900, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });
    try {
      // childList / characterData only — never attributes — so this can never
      // observe a style write (we write none anyway; defence in depth).
      new MutationObserver(schedule)
        .observe(document.body || document.documentElement,
          { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('antcv:item-pages-changed', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    setInterval(schedule, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AntcvMainOverflow364 = { version: VERSION, measure: measure, _run: run };
  try { console.debug('[main-overflow-364] installed ' + VERSION + ' (detection only)'); } catch (_) {}
})();
