/* AntCV preview page-fit sidecar (v1.50.261)
 * ============================================================
 * Gabriel originally reported: "make sure sidebar length is up to
 * the page length but not crossing it, otherwise a new page is
 * showing up". v1.40.146 capped each `.antcv-page-row` to A4
 * height with `overflow: hidden` to make this visually clear.
 *
 * Follow-up report (v1.40.151)
 * ----------------------------
 * "Scrolling down is forcing to stay in the first page" — content
 * that overflowed the A4 cap was being hidden with no way to see
 * it. So v1.40.151 changed overflow to `auto` — keeping the A4
 * cap but adding a NESTED scrollbar inside the page-row.
 *
 * Follow-up report (v1.50.261, 2026-06-07)
 * ----------------------------------------
 * Owner screenshot + raw DOM inspection: "vertical ruller on right
 * still does not go to the end only the bluish ruller on the right
 * does — and even it the actual end is hidden behind horizontal
 * roller". Diagnosis: the nested-scroll fix from v1.40.151 created
 * a TRAP. The outer slider drives `.antcv-preview-scroll`, but the
 * actual overflow lives INSIDE each `.antcv-page-row` (height-
 * locked at 1123px with `overflow: auto`). The only way to reach
 * the overflowed content is the thin styled native scrollbar on
 * the right edge of the page-row — and the matching horizontal
 * scrollbar at the bottom of the row eats the last line of content.
 *
 * Fix in this version
 * -------------------
 * Drop the `max-height` cap AND switch `overflow` from `auto` to
 * `visible`. Content now flows naturally past the A4 visual line.
 * The page-row grows tall enough to contain its children; the
 * outer preview-scroll's scrollHeight reflects the true total; the
 * left vertical slider can reach the true bottom; both nested
 * scrollbars disappear.
 *
 * Keep `min-height: 1123px` so empty / lightly-filled pages still
 * render at A4 size (the "is the sidebar tall enough?" visual).
 *
 * DOCX export is unchanged — the docx-worker renders independently
 * with `cantSplit: true` on the body row.
 *
 * Proper end-state: AUTO-PAGEBREAK-BLOCK-001 (in FEATURES_REGISTRY)
 * — overflow should AUTO-SPLIT into a new `.antcv-page-row` with
 * the salmon splitter marker, not flow into a single tall row.
 * This sidecar's loosening is the bridge until that ships.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.753';
  const PAGE_ROW_SEL = '.antcv-page-row';
  const APPLIED_FLAG = 'antcvPageFitApplied';
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = Math.round(PAGE_WIDTH_PX * 297 / 210);
  const POLL_MS = 750;

  if (window.__antcvPageFitInstalled) return;
  window.__antcvPageFitInstalled = SCRIPT_VERSION;

  function applyCap() {
    const rows = document.querySelectorAll(PAGE_ROW_SEL);
    const lastIdx = rows.length - 1;
    rows.forEach(function (row, idx) {
      // SALMON-EMPTY-REGION-001 Option A: only the LAST page-box keeps the
      // A4 min-height (preserves the A4 look for the current/final page).
      // NON-LAST boxes get min-height:0 so they can collapse to content
      // height — the salmon then sits flush under the last item with no
      // dead gap above it. Coordinated with antcv-sidebar-fill-equalize-227.js
      // which uses content height (not getBCR) for non-last rows, breaking
      // the circular min-height lock (see that file's mainContentH helper).
      const isLast = (idx === lastIdx);
      const targetMinH = isLast ? PAGE_HEIGHT_PX + 'px' : '0px';
      if (row.style.minHeight !== targetMinH) {
        row.style.minHeight = targetMinH;
      }
      if (row.style.maxHeight !== '') {
        row.style.maxHeight = '';
      }
      if (row.style.overflow !== 'visible') {
        row.style.overflow = 'visible';
      }
      row.dataset[APPLIED_FLAG] = '1';
    });
  }

  [0, 200, 600, 1500].forEach(function (d) {
    if (d === 0) applyCap();
    else setTimeout(applyCap, d);
  });

  try {
    const mo = new MutationObserver(function () { applyCap(); });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  } catch (_) {}

  setInterval(applyCap, POLL_MS);
})();
