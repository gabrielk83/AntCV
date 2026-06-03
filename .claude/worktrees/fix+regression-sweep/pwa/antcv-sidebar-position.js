/* AntCV sidebar position sidecar (v1.40.146)
 * ============================================================
 * The Settings panel exposes a "Sidebar left / Sidebar right"
 * toggle that writes `localStorage.sidebarPosition` ∈
 * {'left','right'}. In the immutable app.js the setting only
 * flows to a legacy DOCX-export HTML path; the React preview
 * itself doesn't honour it, so flipping the toggle changes
 * nothing on screen.
 *
 * This sidecar fixes the preview by applying CSS
 * `flex-direction: row-reverse` to the `.antcv-page-row`
 * container when `sidebarPosition === 'right'`. The page-row
 * is a flexbox holding [sidebar, splitter, main] — reversing
 * the direction visually puts the sidebar on the right without
 * touching the React DOM.
 *
 * Same pattern as antcv-photo-position.js v1.40.137:
 *   - read storage value tolerantly (bare string or JSON)
 *   - MutationObserver to catch re-renders
 *   - storage event for cross-tab changes
 *   - click events for same-tab changes
 *   - periodic poll as belt-and-braces
 *
 * Companion to docx-worker v1.14.2, which renders the same
 * sidebar-right layout in the exported DOCX/PDF.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.146';
  const STORAGE_KEY = 'sidebarPosition';
  const PAGE_ROW_SEL = '.antcv-page-row';
  const APPLIED_FLAG = 'antcvSidebarPositionApplied';
  const POLL_MS = 750;

  if (window.__antcvSidebarPositionInstalled) return;
  window.__antcvSidebarPositionInstalled = SCRIPT_VERSION;

  function readPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 'left';
      let v = raw;
      try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
      v = String(v).trim().toLowerCase();
      return (v === 'left' || v === 'right') ? v : 'left';
    } catch (_) { return 'left'; }
  }

  function applyToAllPageRows() {
    const pos = readPosition();
    const rows = document.querySelectorAll(PAGE_ROW_SEL);
    rows.forEach((row) => {
      const current = row.dataset[APPLIED_FLAG] || '';
      if (pos === 'right' && current !== 'right') {
        row.style.flexDirection = 'row-reverse';
        row.dataset[APPLIED_FLAG] = 'right';
      } else if (pos !== 'right' && current === 'right') {
        // Restore to default. We don't unconditionally clear so
        // that we don't fight with any other code that might set
        // flexDirection.
        row.style.flexDirection = '';
        row.dataset[APPLIED_FLAG] = 'left';
      } else if (pos !== 'right' && !current) {
        row.dataset[APPLIED_FLAG] = 'left';
      }
    });
  }

  // Initial passes, in case page-rows mount after this script.
  [0, 200, 600, 1500].forEach((d) => {
    if (d === 0) applyToAllPageRows();
    else setTimeout(applyToAllPageRows, d);
  });

  // React to settings changes from other tabs (storage event)
  // and the same tab (click events on settings panel).
  window.addEventListener('storage', function (e) {
    if (!e || e.key === STORAGE_KEY || e.key === null) applyToAllPageRows();
  });

  // Same-tab settings changes don't fire `storage`, so listen to
  // click events on the document — the Settings panel button
  // tap triggers localStorage write, and the next mutation pass
  // will pick up the new value.
  document.addEventListener('click', function () {
    // Defer so the settings handler can persist first.
    setTimeout(applyToAllPageRows, 0);
  }, true);

  // MutationObserver to catch React re-renders that recreate the
  // page-row (e.g. switching docs between CV and CL).
  try {
    const mo = new MutationObserver(function () { applyToAllPageRows(); });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  } catch (_) {}

  // Polling fallback for any edge case where the observer
  // doesn't fire.
  setInterval(applyToAllPageRows, POLL_MS);
})();
