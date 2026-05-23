/* AntCV Publications row narrow-screen wrap fix (v1.40.289)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   On mobile, the Publications & Patent row in the section panel is
 *   too wide for the available container — visible cluster is:
 *
 *     [name] [detail] [👁]  …cut off…  [✕]
 *
 *   The middle buttons (page cycler, up, down, arrow, sparkle) are
 *   hidden because patch 273 set `overflow:visible; flexWrap:nowrap`
 *   with `maxWidth:calc(100% - 54px)`. On a narrow viewport, content
 *   exceeds the row width and gets clipped by an ancestor's overflow.
 *
 * Fix
 * ───
 *   On narrow viewports (< 600px), reflow the publication item row so
 *   the inline buttons cluster wraps to a second line when needed:
 *
 *     name   detail
 *     [👁]  [📄]  [↑]  [↓]  [→]  [✨]
 *
 *   Apply with higher CSS specificity than patch 273 (which uses
 *   !important) by targeting the data-attribute selectors prefixed
 *   with the `<body>` selector — same specificity but loaded later in
 *   the cascade, so it wins.
 *
 *   On wide screens (>= 600px) we leave 273's nowrap layout alone —
 *   it fits there and was the intentional design.
 *
 * Notes
 * ─────
 *   - We don't change ANY click handlers — patch 273 still owns the
 *     buttons. We only adjust their visual flow.
 *   - We use the existing `data-antcv-pub273-*` markers so this stays
 *     coupled to 273's layout output. If 273 isn't applied yet, this
 *     does nothing.
 *   - The new layout adds a few pixels of vertical height per row;
 *     gain is the entire button cluster becomes reachable.
 */
(function () {
  'use strict';
  var VERSION = '1.40.289';
  if (window.__antcvPublicationsRowWrapFix289 === VERSION) return;
  window.__antcvPublicationsRowWrapFix289 = VERSION;

  var STYLE_ID = 'antcv-pub-row-wrap-fix-289-style';
  if (document.getElementById(STYLE_ID)) return;

  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    /* Wrap publication rows on narrow viewports. */
    '@media (max-width: 600px) {',
    '  body [data-antcv-pub273-row="1"] {',
    '    flex-wrap: wrap !important;',
    '    row-gap: 4px !important;',
    '    max-width: calc(100% - 30px) !important;',
    '    width: calc(100% - 30px) !important;',
    '    overflow: visible !important;',
    '    white-space: normal !important;',
    '  }',
    /* Let the inputs take a sensible chunk of the first line. */
    '  body [data-antcv-pub273-row="1"] input,',
    '  body [data-antcv-pub273-row="1"] textarea,',
    '  body [data-antcv-pub273-row="1"] [contenteditable="true"] {',
    '    min-width: 60px !important;',
    '    flex: 1 1 auto !important;',
    '  }',
    /* Force the inner button host to start on its own row by giving */
    /* it a full-width sibling break. */
    '  body [data-antcv-pub273-row="1"] [data-antcv-pub273-host="1"] {',
    '    flex: 1 0 100% !important;',
    '    order: 50 !important;',
    '    justify-content: flex-start !important;',
    '    margin-top: 2px !important;',
    '    margin-left: 0 !important;',
    '    padding-left: 0 !important;',
    '  }',
    '}',
  ].join('\n');

  (document.head || document.documentElement).appendChild(style);

  // Best-effort: if 273's rows render after we install, the CSS rule
  // catches them automatically via the data-attribute selector.
  // Nothing else to do.

  window.AntcvPublicationsRowWrapFix289 = {
    version: VERSION,
    _styleId: STYLE_ID,
  };

  try { console.debug('[pub-row-wrap-fix-289] installed v' + VERSION); } catch (_) {}
})();
