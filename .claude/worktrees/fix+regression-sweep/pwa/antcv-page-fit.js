/* AntCV preview page-fit sidecar (v1.40.151)
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
 * it. The user was stuck looking at the top of the page with no
 * indication of what was below the cap.
 *
 * Fix in this version
 * -------------------
 * Keep the A4 visual cap (min-height + max-height) BUT change the
 * overflow from `hidden` to `auto`. The page-row stays exactly
 * A4-sized in the preview, but a scrollbar appears inside it when
 * the content is taller than A4, letting the user see what's
 * clipped. DOCX export is unchanged — the docx-worker still uses
 * `cantSplit: true` on the body row, so phantom trailing pages
 * are suppressed in the export.
 *
 * Trade-off: the user now sees a scrollbar inside the page-row
 * when content overflows. They can still use the `s.page` mech-
 * anism to mark sections as page=2,3,4 — those land on subsequent
 * page-rows. The scroll-inside-page is the visual hint that some
 * content needs to move to page 2.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.151';
  const PAGE_ROW_SEL = '.antcv-page-row';
  const APPLIED_FLAG = 'antcvPageFitApplied';
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = Math.round(PAGE_WIDTH_PX * 297 / 210);
  const POLL_MS = 750;

  if (window.__antcvPageFitInstalled) return;
  window.__antcvPageFitInstalled = SCRIPT_VERSION;

  function applyCap() {
    const rows = document.querySelectorAll(PAGE_ROW_SEL);
    rows.forEach(function (row) {
      // Re-apply on every pass, but only if needed (avoid relayouts).
      // The overflow style is set to 'auto' in v1.40.151 (was 'hidden'
      // in v1.40.146). If a stale 'hidden' is found, override.
      const wantOverflow = 'auto';
      if (row.style.minHeight !== PAGE_HEIGHT_PX + 'px') {
        row.style.minHeight = PAGE_HEIGHT_PX + 'px';
      }
      if (row.style.maxHeight !== PAGE_HEIGHT_PX + 'px') {
        row.style.maxHeight = PAGE_HEIGHT_PX + 'px';
      }
      if (row.style.overflow !== wantOverflow) {
        row.style.overflow = wantOverflow;
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
