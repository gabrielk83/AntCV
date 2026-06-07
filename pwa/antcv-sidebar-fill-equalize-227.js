/* AntCV sidebar fill — equalize sidebar height to the main column (v1.50.227)
 *
 * PB-WORKER-SIDEBAR-FILL / preview: the navy sidebar did not run all the way to
 * the bottom of the page. The 1.50.216 approach relied on flex `align-items:
 * stretch` + a fixed `min-height:1123px`, which caps the sidebar at one A4 page
 * and does not track the real main-column height.
 *
 * This sidecar instead MEASURES the main column in each `.antcv-page-row` and
 * sets the sidebar's height to match — so the two columns are always the same
 * length and the navy field reaches the same bottom edge as the content. It is
 * re-run on every content mutation (i.e. every line insert), on the section /
 * page-break events, and on resize.
 *
 * The DEMO watermark sits at `position:absolute; inset:0` inside the page-row,
 * so once the row height equals the (taller) main column the watermark already
 * covers the full page — no separate watermark repositioning is needed here.
 */
(function () {
  'use strict';
  var VERSION = '1.50.227-sidebar-equalize';
  if (window.__antcvSidebarEqualize === VERSION) return;
  window.__antcvSidebarEqualize = VERSION;

  var PAPER_SEL = '.antcv-preview-paper,[data-antcv-preview-paper]';
  var ROW_SEL = '.antcv-page-row';
  var SIDE_SEL = '.antcv-document-sidebar,[data-antcv-document-sidebar="true"]';
  var MAIN_SEL = '[data-antcv-document-main="true"],.antcv-document-main';

  var applying = false; // guards our own style writes from re-triggering work

  // 1.50.237: EXTEND-ONLY. The 1.50.227 logic wrote
  // `side.style.height = mainH + 'px'` unconditionally, which TRUNCATES the
  // sidebar to the main column's height. When the user has a tall sidebar
  // (many regulatory groups + items), the navy <div> ends mid-content and the
  // remaining items spill below into white background — exact regression the
  // owner reported. Fix: only EXTEND the sidebar when it is SHORTER than main;
  // when sidebar is taller, clear our inline writes so the natural content
  // height wins (with align-self:stretch the page-row + flex stretch already
  // make the columns equal in that direction).
  function equalize() {
    var paper = document.querySelector(PAPER_SEL);
    if (!paper) return;
    var rows = paper.querySelectorAll(ROW_SEL);
    if (!rows.length) return;
    applying = true;
    try {
      Array.prototype.forEach.call(rows, function (row) {
        var side = row.querySelector(SIDE_SEL);
        var main = row.querySelector(MAIN_SEL);
        if (!side || !main) return;
        // Clear any prior write FIRST so we measure the natural intrinsic
        // height of the sidebar (not the height we last set on it).
        side.style.removeProperty('height');
        side.style.removeProperty('min-height');
        var mainH = Math.ceil(main.getBoundingClientRect().height);
        var sideH = Math.ceil(side.getBoundingClientRect().height);
        if (!(mainH > 0) || !(sideH > 0)) return;
        // EXTEND only — when the sidebar is shorter than main, give it the
        // main height so the navy bg reaches the page bottom. When the
        // sidebar is taller, do NOTHING — its natural height wins, the
        // page-row grows to match, and the navy already covers everything.
        if (sideH + 2 < mainH) {
          side.style.setProperty('height', mainH + 'px', 'important');
          side.style.setProperty('min-height', mainH + 'px', 'important');
          side.style.setProperty('align-self', 'stretch', 'important');
        }
      });
      // 1.50.242: after writing sidebar styles, scrollHeight of the preview
      // scroll container may have changed. The vertical-roller slider's value
      // (`bi` in app.src.js, updated by `Ni` on scroll events) doesn't
      // recompute automatically when content grows — so when the user
      // scrolls, the slider's max maps to an old scrollHeight and the user
      // can scroll PAST where the slider says is the end. Fix: dispatch a
      // scroll event on the preview-scroll container to force Ni to
      // re-compute the bi <-> scrollTop ratio against the current
      // scrollHeight.
      try {
        var scrollContainer = document.querySelector('.antcv-preview-scroll');
        if (scrollContainer && typeof Event === 'function') {
          scrollContainer.dispatchEvent(new Event('scroll', { bubbles: false }));
        }
      } catch (e) {}
    } catch (e) {
      try { console.warn('[sidebar-equalize-227]', e && e.message); } catch (_) {}
    }
    applying = false;
  }

  var t = null;
  function schedule() {
    clearTimeout(t);
    t = setTimeout(equalize, 60);
  }

  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:item-pages-changed', schedule);
  window.addEventListener('resize', schedule);
  try {
    // Watch content changes only (childList / characterData) — NOT attributes —
    // so our own inline-style writes never re-trigger the observer. "Redone on
    // every line insert" is exactly a childList/characterData mutation.
    new MutationObserver(function () {
      if (applying) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}
  [0, 200, 600, 1200, 2500].forEach(function (ms) { setTimeout(schedule, ms); });

  // 1.50.249: dispatch a synthetic scroll event on the preview-scroll
  // container whenever its CONTENT SIZE changes. The vertical-roller's
  // value (`bi` in app.src.js) is updated only by Ni on scroll events; it
  // doesn't recompute when scrollHeight grows (e.g. when a page-break
  // sidecar adds spacers post-mount). A single dispatch from inside
  // equalize() (1.50.242) misses any growth caused by other sidecars
  // firing later. A ResizeObserver on the scroll container fires on every
  // size change, so bi tracks the current scrollHeight at all times and
  // the user can never reach the slider's max while the document is
  // still scrollable past it.
  var __lastDispatchTs = 0;
  // 1.50.256: sticky-bottom for the slider.
  // The vertical-roller's $i() function sets
  //   scrollContainer.scrollTop = (scrollHeight - clientHeight) * (bi/100)
  // at the moment the slider is dragged. If the scrollHeight then GROWS
  // (page-break spacers, async content, font-load reflow, etc.) the
  // scrollTop stays at the OLD max and the preview shows white space
  // below — the user has to mouse-wheel manually to reach the true
  // bottom. We watch scrollTop continuously; when the user is parked at
  // (or within ~2px of) the current bottom, we mark __atBottom; on the
  // next ResizeObserver-triggered growth, we re-pin scrollTop to the
  // new bottom and dispatch a scroll so bi snaps back to 100.
  var __atBottom = false;
  function updateAtBottom(c) {
    try {
      if (!c) c = document.querySelector('.antcv-preview-scroll');
      if (!c) return;
      var max = c.scrollHeight - c.clientHeight;
      __atBottom = max <= 1 || (c.scrollTop >= max - 2);
    } catch (_) {}
  }
  function stickToBottomIfNeeded(c) {
    try {
      if (!__atBottom) return;
      if (!c) c = document.querySelector('.antcv-preview-scroll');
      if (!c) return;
      var newMax = c.scrollHeight - c.clientHeight;
      if (newMax > 0 && c.scrollTop < newMax - 2) {
        c.scrollTop = newMax;
      }
    } catch (_) {}
  }
  function fireScrollOnContainer() {
    try {
      var now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      // De-dupe rapid bursts (sub-100ms).
      if (now - __lastDispatchTs < 100) return;
      __lastDispatchTs = now;
      var scrollContainer = document.querySelector('.antcv-preview-scroll');
      if (!scrollContainer) return;
      // If the user was parked at the bottom and content grew, re-pin
      // to the NEW bottom BEFORE we dispatch — so Ni reads the
      // corrected scrollTop and bi maps to 100 (slider thumb stays at
      // the bottom AND the viewport actually shows the document end).
      stickToBottomIfNeeded(scrollContainer);
      if (typeof Event === 'function') {
        scrollContainer.dispatchEvent(new Event('scroll', { bubbles: false }));
      }
    } catch (_) {}
  }
  // 1.50.259: deferred re-check after a near-bottom scroll. The
  // ResizeObserver covers content-grows-AFTER-drag, but if pi.scrollHeight
  // was already final at drag-time AND the slider's $i() math undershot
  // (e.g. clientHeight was momentarily wrong during a layout flush), the
  // ResizeObserver never fires and the user is left with a small gap.
  // Schedule 3 nudges at increasing delays whenever the user lands near
  // the bottom — each compares the CURRENT (scrollHeight - clientHeight)
  // to the current scrollTop and closes any remaining gap. Bounded:
  // only runs while __atBottom is still true.
  var __nudgePending = false;
  function scheduleNearBottomNudges(c) {
    if (__nudgePending) return;
    __nudgePending = true;
    [120, 480, 1400].forEach(function (ms) {
      setTimeout(function () {
        try {
          if (!__atBottom) return;
          if (!c || !c.isConnected) return;
          var newMax = c.scrollHeight - c.clientHeight;
          if (newMax > 0 && c.scrollTop < newMax - 2) {
            c.scrollTop = newMax;
            // Re-dispatch so the slider value (bi) catches up.
            if (typeof Event === 'function') {
              c.dispatchEvent(new Event('scroll', { bubbles: false }));
            }
          }
        } catch (_) {}
      }, ms);
    });
    // Clear the pending flag after the last nudge so the next
    // near-bottom landing re-arms.
    setTimeout(function () { __nudgePending = false; }, 1600);
  }
  // 1.50.259: console diagnostic. Call window.__antcvPreviewScrollDiag()
  // from devtools to print the exact measurements at the current
  // moment — surfaces whether the bug is "scrollHeight wrong" vs
  // "viewport showing past end" vs "nested scroll".
  try {
    window.__antcvPreviewScrollDiag = function () {
      var c = document.querySelector('.antcv-preview-scroll');
      if (!c) { try { console.log('[antcv preview diag] no .antcv-preview-scroll'); } catch (_) {} return null; }
      var frame = c.querySelector('.antcv-preview-frame');
      var wrap = c.querySelector('.antcv-preview-wrap');
      var rect = c.getBoundingClientRect();
      var fr = frame ? frame.getBoundingClientRect() : null;
      var wr = wrap ? wrap.getBoundingClientRect() : null;
      var d = {
        version: VERSION,
        atBottomFlag: __atBottom,
        container: {
          scrollTop: c.scrollTop,
          scrollHeight: c.scrollHeight,
          clientHeight: c.clientHeight,
          gap: c.scrollHeight - c.clientHeight - c.scrollTop,
          rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) }
        },
        frame: frame ? {
          offsetHeight: frame.offsetHeight,
          scrollHeight: frame.scrollHeight,
          rectBottom: Math.round(fr.bottom),
          rectHeight: Math.round(fr.height)
        } : null,
        wrap: wrap ? {
          offsetHeight: wrap.offsetHeight,
          scrollHeight: wrap.scrollHeight,
          rectBottom: Math.round(wr.bottom),
          rectHeight: Math.round(wr.height)
        } : null,
        // Whether the visible bottom of the viewport reveals more content
        // (i.e. the user can see something below scrollTop + clientHeight).
        contentExtendsBelowViewport:
          (wrap && wr.bottom > rect.bottom + 2) || (frame && fr.bottom > rect.bottom + 2)
      };
      try { console.log('[antcv preview diag]', JSON.stringify(d, null, 2)); } catch (_) {}
      return d;
    };
  } catch (_) {}
  try {
    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(fireScrollOnContainer);
      var attached = false;
      function tryAttach() {
        if (attached) return;
        var c = document.querySelector('.antcv-preview-scroll');
        if (!c) return;
        try {
          ro.observe(c);
          // Also observe the inner frame so size grows from page-break
          // spacers, etc. are seen even when the scroll container itself
          // is height-locked (height: calc(100dvh - 160px)).
          var inner = c.querySelector('.antcv-preview-frame, .antcv-preview-paper');
          if (inner) ro.observe(inner);
          // 1.50.259: also observe the wrap — the inner-most container
          // that holds the actual section rows. If the page-fit /
          // bullet-targets / sidebar-fill sidecars grow content inside
          // the wrap (the most likely place for late layout), we need
          // to see it.
          var wrap = c.querySelector('.antcv-preview-wrap');
          if (wrap) ro.observe(wrap);
          // Continuously track whether the user is at the bottom so the
          // ResizeObserver callback knows whether to re-pin. Also
          // schedule deferred nudges when the user lands near the
          // bottom — covers the case where scrollHeight grew silently
          // without triggering a ResizeObserver fire.
          c.addEventListener('scroll', function () {
            updateAtBottom(c);
            if (__atBottom) scheduleNearBottomNudges(c);
          }, { passive: true });
          updateAtBottom(c);
          attached = true;
        } catch (_) {}
      }
      // Retry briefly until the preview-scroll element exists.
      [0, 200, 600, 1200, 2500, 5000].forEach(function (ms) { setTimeout(tryAttach, ms); });
    }
  } catch (_) {}

  window.AntcvSidebarEqualize = { version: VERSION, apply: equalize };
})();
