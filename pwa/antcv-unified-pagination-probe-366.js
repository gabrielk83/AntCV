/* AntCV unified-pagination PROBE (v1.50.813, SALMON-UNIFIED-001 Phase A)
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * Today each column (sidebar / main) paginates INDEPENDENTLY: the salmon
 * engine (antcv-auto-pagebreak-block-001.js) measures each column against the
 * A4/Word line on its own, and the two columns can break at different heights.
 * There is no shared "page N starts at sheet-line Y" — so a 3-page CV can show
 * page 2→3 in one column but not the other, and the sidebar pass still hard-
 * codes its break to page 2 (it has no concept of page 3 at all).
 *
 * The owner chose UNIFIED sheet pagination, tracking the DOCX EXPORT line:
 *   - one boundary per page across the whole sheet;
 *   - the EARLIER of the two columns drives each boundary (so neither column
 *     ever overflows past the sheet line);
 *   - the shorter column gets an intentional gap so page N starts on a straight
 *     line across both columns (this is correct paginated-sheet behaviour);
 *   - boundaries track the Word-equivalent line (USABLE_PDF ≈ 949px), so the
 *     salmon means "this is where page N begins in your downloaded file".
 *
 * WHAT THIS FILE DOES — DETECTION / SIMULATION ONLY.
 * It does NOT write antcv:autoPages, does NOT move anything, does NOT draw a
 * salmon. It measures both columns at the SAME export line the real engine uses
 * (USABLE_PDF = PAGE_H·(1-SAFETY)/WORD_INFLATE), computes what the UNIFIED sheet
 * boundaries WOULD be, and what each section's re-snapped {item:page} map WOULD
 * become, and writes that simulation to localStorage['antcv:unifiedPaginationProbe']
 * + pulses 'antcv:unified-probe-changed'. This lets us see the coordinator's
 * decisions against a real 3-page CV BEFORE Phase B/C move any break.
 *
 * It deliberately MIRRORS the real engine's constants so the simulated numbers
 * are directly comparable to what Phase C will eventually write:
 *   PAGE_H 1123, SAFETY, WORD_INFLATE 1.14 → USABLE_PDF ≈ 949px (Word line).
 *
 * Verify in console:  JSON.parse(localStorage['antcv:unifiedPaginationProbe'])
 * or:                 window.AntcvUnifiedProbe366.measure()
 *
 * LOOP-SAFETY (same discipline as the main-overflow detector)
 * (a) Pure measurement — never writes a style/break, never adds a render node,
 *     so it cannot feed the MutationObserver that schedules it. (b) Writes the
 *     probe key + pulses only when the simulation signature CHANGES. (c) rAF +
 *     debounce. (d) try/catch throughout; strict no-op for the CL and when a
 *     column is missing. (e) CV-only (the CL is a single linear flow — no two
 *     columns to unify).
 */
(function () {
  'use strict';
  var VERSION = '1.50.813-unified-pagination-probe';
  if (window.__antcvUnifiedProbe366 === VERSION) return;
  window.__antcvUnifiedProbe366 = VERSION;

  var OUT_KEY = 'antcv:unifiedPaginationProbe';

  // MIRROR the real salmon engine's geometry exactly (antcv-auto-pagebreak-
  // block-001.js lines ~93-108) so the probe's boundaries are comparable.
  var PAGE_H = 1123;          // A4 preview page-box ≈ 1123px at 96dpi
  var SAFETY = 70;            // matches the engine's USABLE margin
  var USABLE = PAGE_H - SAFETY;          // ~1053px — true A4 fill (preview line)
  var WORD_INFLATE = 1.14;               // Word packs ~14% more per page
  var USABLE_PDF = USABLE / WORD_INFLATE; // ~924px — the Word-equivalent line (our source of truth)

  var SIDEBAR_SEL = '.antcv-document-sidebar,[data-antcv-document-sidebar="true"]';
  var MAIN_SEL = '.antcv-document-main,[data-antcv-document-main="true"]';
  var SID_ATTR = 'data-sid';
  var ITEM_PATH_ATTR = 'data-antcv-row-path';
  var ROLE_IDX_ATTR = 'data-antcv-role-index';

  function activeDoc() {
    try {
      var d = localStorage.getItem('doc') || '';
      try { var p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (e) {}
      return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv';
    } catch (_) { return 'cv'; }
  }
  function visible(el) {
    return !!(el && el.isConnected &&
      (el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)));
  }
  function scaleOf(col) {
    var s = col.offsetWidth ? (col.getBoundingClientRect().width / col.offsetWidth) : 1;
    return (s > 0.1 && s < 10) ? s : 1;
  }

  // Collect every paginatable "block" in a column with its top/bottom relative
  // to the column top, in UNSCALED px (we divide rects by the live scale). A
  // block is an experience role (atomic) or a section item-row; we also note
  // its section sid + a key the eventual map would use.
  function columnBlocks(col) {
    var colTop = col.getBoundingClientRect().top;
    var scale = scaleOf(col);
    var blocks = [];

    // Section item-rows (sidebar lists, main non-experience sections, table rows
    // all expose data-antcv-row-path="items.N"). Roles expose data-antcv-role-index.
    var roleEls = col.querySelectorAll('[' + ROLE_IDX_ATTR + ']');
    for (var r = 0; r < roleEls.length; r++) {
      if (!visible(roleEls[r])) continue;
      var rc = roleEls[r].getBoundingClientRect();
      var sidEl = roleEls[r].closest ? roleEls[r].closest('[' + SID_ATTR + ']') : null;
      blocks.push({
        kind: 'role',
        sid: sidEl ? sidEl.getAttribute(SID_ATTR) : null,
        key: roleEls[r].getAttribute(ROLE_IDX_ATTR),
        top: (rc.top - colTop) / scale,
        bottom: (rc.bottom - colTop) / scale,
      });
    }
    var itemEls = col.querySelectorAll('[' + ITEM_PATH_ATTR + ']');
    for (var i = 0; i < itemEls.length; i++) {
      if (!visible(itemEls[i])) continue;
      var ic = itemEls[i].getBoundingClientRect();
      var sidEl2 = itemEls[i].closest ? itemEls[i].closest('[' + SID_ATTR + ']') : null;
      var path = itemEls[i].getAttribute(ITEM_PATH_ATTR);   // "items.N"
      var keyNum = (path && path.indexOf('items.') === 0) ? path.slice('items.'.length) : path;
      blocks.push({
        kind: 'item',
        sid: sidEl2 ? sidEl2.getAttribute(SID_ATTR) : null,
        key: keyNum,
        top: (ic.top - colTop) / scale,
        bottom: (ic.bottom - colTop) / scale,
      });
    }
    blocks.sort(function (a, b) { return a.top - b.top; });
    return blocks;
  }

  // Greedy fill: given a column's blocks and the per-page usable height, return
  // the page each block lands on (1-based), filling each page until a block's
  // BOTTOM crosses the running page line, then starting a new page at that
  // block's TOP. Atomic blocks (never split). Mirrors the EXPERIENCE N-page
  // loop the engine already uses for roles.
  function paginateColumn(blocks, usable) {
    var pageTop = 0, page = 1, out = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      // Overflow if bottom crosses the current page line AND this isn't the
      // first block on the page (a block taller than a page can't move).
      if ((b.bottom - pageTop) > usable && (b.top - pageTop) > 1) {
        page++;
        pageTop = b.top;
      }
      out.push({ sid: b.sid, kind: b.kind, key: b.key, top: b.top, bottom: b.bottom, page: page });
    }
    return out;
  }

  // The UNIFIED step: each column independently knows where its page N would
  // start (the TOP of the first block on page N). The sheet boundary for page N
  // is the EARLIER (smaller top) of the two columns' page-N starts — so neither
  // column overflows past it. Returns sheetBoundaries[N] = y (px from sheet top),
  // for N = 2..maxPage.
  function unifyBoundaries(sidePaged, mainPaged) {
    function firstTopByPage(paged) {
      var m = {};
      for (var i = 0; i < paged.length; i++) {
        var p = paged[i].page;
        if (m[p] === undefined || paged[i].top < m[p]) m[p] = paged[i].top;
      }
      return m;
    }
    var sTop = firstTopByPage(sidePaged);
    var mTop = firstTopByPage(mainPaged);
    var maxPage = 1;
    Object.keys(sTop).concat(Object.keys(mTop)).forEach(function (k) {
      var n = parseInt(k, 10); if (n > maxPage) maxPage = n;
    });
    var sheet = {};
    for (var n = 2; n <= maxPage; n++) {
      var a = sTop[n], b = mTop[n];
      if (a === undefined && b === undefined) continue;
      sheet[n] = (a === undefined) ? b : (b === undefined) ? a : Math.min(a, b);
    }
    return { sheet: sheet, maxPage: maxPage };
  }

  // Re-snap a column's blocks to the UNIFIED sheet boundaries: a block belongs
  // to the highest page N whose sheet boundary its TOP has crossed. This is what
  // Phase C would write to autoPages (per sid → {firstItemOfPageN: N}), so the
  // shorter column breaks "early" (intentional gap) to keep the sheet line straight.
  function resnap(blocks, sheet) {
    var bounds = Object.keys(sheet).map(function (k) { return { page: parseInt(k, 10), y: sheet[k] }; })
      .sort(function (a, b) { return a.y - b.y; });
    var perSid = {};   // sid → { itemKey: page } for the FIRST block of each page>1
    var seenPage = {};
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var pg = 1;
      for (var j = 0; j < bounds.length; j++) {
        if (b.top >= bounds[j].y - 1) pg = bounds[j].page;
      }
      if (pg > 1 && b.sid) {
        var sidKey = b.sid + '@' + pg;
        if (!seenPage[sidKey]) {           // first block of this page in this section
          seenPage[sidKey] = true;
          (perSid[b.sid] = perSid[b.sid] || {})[String(b.key)] = pg;
        }
      }
    }
    return perSid;
  }

  function measure() {
    var snap = {
      ts: Date.now(), version: VERSION, doc: activeDoc(),
      usablePdfPx: Math.round(USABLE_PDF),
      sidebar: { blocks: 0, pages: 1 },
      main: { blocks: 0, pages: 1 },
      sheetBoundaries: {},   // page → y(px from sheet top)
      maxPage: 1,
      resnap: { sidebar: {}, main: {} },   // what Phase C WOULD write per sid
      note: '',
    };
    if (snap.doc !== 'cv') { snap.note = 'cl-or-non-cv: unified pagination is CV-only'; return snap; }

    var sideCol = document.querySelector(SIDEBAR_SEL);
    var mainCol = document.querySelector(MAIN_SEL);
    if (!sideCol || !mainCol || !visible(sideCol) || !visible(mainCol)) {
      snap.note = 'one or both columns missing/hidden'; return snap;
    }

    var sideBlocks = columnBlocks(sideCol);
    var mainBlocks = columnBlocks(mainCol);
    snap.sidebar.blocks = sideBlocks.length;
    snap.main.blocks = mainBlocks.length;

    // Each column paginated independently at the EXPORT line first (so each
    // knows its own page-N starts), then unify, then re-snap to the shared sheet.
    var sidePaged = paginateColumn(sideBlocks, USABLE_PDF);
    var mainPaged = paginateColumn(mainBlocks, USABLE_PDF);
    snap.sidebar.pages = sidePaged.reduce(function (m, b) { return Math.max(m, b.page); }, 1);
    snap.main.pages = mainPaged.reduce(function (m, b) { return Math.max(m, b.page); }, 1);

    var uni = unifyBoundaries(sidePaged, mainPaged);
    snap.maxPage = uni.maxPage;
    var rounded = {};
    Object.keys(uni.sheet).forEach(function (k) { rounded[k] = Math.round(uni.sheet[k]); });
    snap.sheetBoundaries = rounded;

    snap.resnap.sidebar = resnap(sideBlocks, uni.sheet);
    snap.resnap.main = resnap(mainBlocks, uni.sheet);

    snap.note = (uni.maxPage >= 3)
      ? ('UNIFIED: ' + uni.maxPage + ' pages; page-3 sheet line at ' + (rounded[3] || '?') + 'px')
      : (uni.maxPage === 2 ? 'UNIFIED: 2 pages (no page-3 transition)' : 'single page');
    return snap;
  }

  var lastSig = null;
  function sigOf(s) {
    return [s.doc, s.maxPage, JSON.stringify(s.sheetBoundaries),
            JSON.stringify(s.resnap.sidebar), JSON.stringify(s.resnap.main)].join('|');
  }
  function run() {
    try {
      var s = measure();
      var sig = sigOf(s);
      if (sig === lastSig) return;
      lastSig = sig;
      try { localStorage.setItem(OUT_KEY, JSON.stringify(s)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:unified-probe-changed', { detail: s })); } catch (_) {}
      try { console.debug('[unified-probe-366]', s.note, s); } catch (_) {}
    } catch (e) {
      try { console.warn('[unified-probe-366]', e && e.message); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; setTimeout(run, 300); });
  }
  function start() {
    [500, 1100, 2200, 4000].forEach(function (d) { setTimeout(schedule, d); });
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement,
        { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('antcv:auto-pages-changed', schedule);
    window.addEventListener('antcv:item-pages-changed', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    setInterval(schedule, 3500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AntcvUnifiedProbe366 = { version: VERSION, measure: measure, _run: run,
    constants: { PAGE_H: PAGE_H, SAFETY: SAFETY, USABLE: USABLE, WORD_INFLATE: WORD_INFLATE, USABLE_PDF: USABLE_PDF } };
  try { console.debug('[unified-probe-366] installed ' + VERSION + ' (read-only simulation)'); } catch (_) {}
})();
