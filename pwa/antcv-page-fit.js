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

  const SCRIPT_VERSION = '1.50.261';
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
      // 1.50.261: keep min-height (empty pages still look A4) but
      // STRIP the max-height cap and the overflow:auto trap. If a
      // stale max-height or overflow:auto/hidden is found, clear
      // them. Re-apply on every pass — the React render reassigns
      // inline styles on every meta change, so a one-shot fix would
      // regress instantly.
      //
      // SALMON-EMPTY-REGION-001 (1.50.753): only the LAST page-row keeps
      // the full A4 min-height (the final sheet still looks like a page).
      // A NON-LAST row drops to min-height:0 so it can size to its CONTENT.
      // The salmon separator is drawn at the TOP of the next page-box, so a
      // non-last row padded to 1123 by min-height pushed the salmon ~190px
      // below the last item (the owner's "empty region where the salmon
      // should be"). The matching antcv-sidebar-fill-equalize change
      // collapses the navy sidebar to the same content height so the
      // circular lock at 1123 (sidebar !important min-height) can't
      // re-impose the pad. Single-page CV (rows.length===1) is unchanged:
      // idx 0 === lastIdx keeps 1123.
      // Must be `!important`: antcv-sidebar-subsection-pagebreaks-329 injects a
      // stylesheet rule `.antcv-page-row{min-height:1123px!important}` that would
      // otherwise pin every row at A4 and defeat the non-last collapse. An inline
      // `!important` beats a stylesheet `!important`.
      var wantMin = (idx === lastIdx) ? (PAGE_HEIGHT_PX + 'px') : '0px';
      if (row.style.minHeight !== wantMin ||
          row.style.getPropertyPriority('min-height') !== 'important') {
        row.style.setProperty('min-height', wantMin, 'important');
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
