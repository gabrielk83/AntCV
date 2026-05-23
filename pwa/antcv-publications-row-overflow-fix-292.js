/* AntCV Publications & Patent panel row overflow fix (v1.40.292)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   Gabriel: "publications & patents - most of the buttons's line is
 *   hidden to the right of the panel".
 *
 *   antcv-publications-strict-row-layout-273.js builds each row as a
 *   single non-wrapping flex line containing:
 *     - name field (48-58px)
 *     - detail field (128-150px)
 *     - page button (30px)
 *     - CJLR button (23px)
 *     - compress button (23px)
 *     - enhance button (23px)
 *     - native eye button (23px)
 *     - native delete button (23px)
 *     - native move buttons (23px each)
 *
 *   On a ~380px mobile viewport, the panel has ~340px usable width.
 *   The row tries to render ~330-350px of content with
 *   `flex-wrap: nowrap`, so the right-most controls (page, CJLR,
 *   compress, enhance) overflow past the right edge of the panel
 *   and are cropped by the parent's overflow:hidden.
 *
 * Fix
 * ───
 *   Override 273's row CSS so:
 *     - row uses `flex-wrap: wrap`
 *     - row's max-width is 100% (not 100% - 54px)
 *     - input fields keep their min-content widths but can shrink
 *     - on narrow viewports, the button cluster wraps to a second
 *       line below the text fields
 *
 *   This is purely a CSS override applied via a stylesheet injected
 *   into <head>. Doesn't change the buttons' wiring or any of 273's
 *   logic — only their layout when there's not enough horizontal
 *   space.
 */
(function () {
  'use strict';
  var VERSION = '1.40.292';
  if (window.__antcvPublicationsRowOverflowFix292 === VERSION) return;
  window.__antcvPublicationsRowOverflowFix292 = VERSION;

  var STYLE_ID = 'antcv-publications-row-overflow-fix-292-css';

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    // Mobile-first override. Wraps the row when there isn't enough room.
    s.textContent = [
      '[data-antcv-pub273-row="1"] {',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 4px !important;',
        '  flex-wrap: wrap !important;',          // was nowrap
        '  width: 100% !important;',              // was calc(100% - 54px)
        '  max-width: 100% !important;',          // was calc(100% - 54px)
        '  overflow: visible !important;',
        '  box-sizing: border-box !important;',
        '  white-space: normal !important;',      // allow wrapping
        '  padding-right: 0 !important;',
      '}',

      // Make the host (our injected button cluster) wrap as a group.
      '[data-antcv-pub273-row="1"] [data-antcv-pub273-host="1"] {',
        '  display: inline-flex !important;',
        '  align-items: center !important;',
        '  gap: 3px !important;',
        '  flex: 0 0 auto !important;',
        '  flex-wrap: nowrap !important;',        // keep buttons together
        '  margin-left: 4px !important;',
      '}',

      // Text fields should be allowed to shrink to a sensible minimum,
      // but still readable.
      '[data-antcv-pub273-row="1"] input,',
      '[data-antcv-pub273-row="1"] textarea,',
      '[data-antcv-pub273-row="1"] [contenteditable="true"] {',
        '  min-width: 60px !important;',
        '  flex: 1 1 80px !important;',
        '  box-sizing: border-box !important;',
      '}',

      // On viewports ≤ 480px the native buttons get a second row of
      // their own. Apps that have an outer wrapper with its own
      // overflow rule will still clip, but the row itself now wraps
      // before the clip would trigger.
      '@media (max-width: 480px) {',
        '  [data-antcv-pub273-row="1"] {',
          '    align-items: flex-start !important;',
        '  }',
        // Ensure the button host sits below the text inputs on narrow
        // screens by making the inputs take the FULL first row.
        '  [data-antcv-pub273-row="1"] input,',
        '  [data-antcv-pub273-row="1"] textarea,',
        '  [data-antcv-pub273-row="1"] [contenteditable="true"] {',
          '    flex: 1 1 120px !important;',
          '    min-width: 80px !important;',
        '  }',
      '}',

      // Defensive: ensure no ancestor of the row clips its overflow.
      // This only takes effect when 273 has already marked the row.
      '[data-antcv-pub273-row="1"]::before {',
        '  content: "";',
        '  display: none;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  // Re-find and unclip the immediate parent of any pub row, in case it
  // has an overflow:hidden ancestor cutting the second line off.
  function unclipParents() {
    try {
      var rows = document.querySelectorAll('[data-antcv-pub273-row="1"]');
      for (var i = 0; i < rows.length; i++) {
        var p = rows[i].parentElement;
        for (var hops = 0; p && p !== document.body && hops < 4; hops++, p = p.parentElement) {
          var cs = window.getComputedStyle(p);
          // Only clear if it's clipping horizontally on a narrow viewport.
          // We use a custom data-attr to mark our changes so we can undo.
          if (cs.overflowX === 'hidden') {
            if (!p.getAttribute('data-antcv-pub-unclipped-292')) {
              p.setAttribute('data-antcv-pub-unclipped-292', '1');
              p.style.setProperty('overflow-x', 'visible', 'important');
            }
          }
          if (cs.overflow === 'hidden') {
            if (!p.getAttribute('data-antcv-pub-unclipped-292-y')) {
              p.setAttribute('data-antcv-pub-unclipped-292-y', '1');
              p.style.setProperty('overflow', 'visible', 'important');
            }
          }
        }
      }
    } catch (_) {}
  }

  function run() {
    injectCSS();
    unclipParents();
  }

  // Initial + delayed passes.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  [100, 400, 1000, 2500].forEach(function (d) { setTimeout(run, d); });

  // Re-run on DOM changes (publication panel may mount lazily).
  try {
    new MutationObserver(function (records) {
      var any = false;
      for (var i = 0; i < records.length && !any; i++) {
        var r = records[i];
        if (r.type !== 'childList') continue;
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n && n.nodeType === 1 && (
              (n.getAttribute && n.getAttribute('data-antcv-pub273-row') === '1') ||
              (n.querySelector && n.querySelector('[data-antcv-pub273-row="1"]'))
          )) { any = true; break; }
        }
      }
      if (any) run();
    }).observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  window.AntcvPublicationsRowOverflowFix292 = {
    version: VERSION,
    run: run,
  };

  try { console.debug('[pub-row-overflow-fix-292] installed v' + VERSION); } catch (_) {}
})();
