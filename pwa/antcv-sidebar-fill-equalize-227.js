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

  window.AntcvSidebarEqualize = { version: VERSION, apply: equalize };
})();
