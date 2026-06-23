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

  const SCRIPT_VERSION = '1.50.818';
  const STORAGE_KEY = 'sidebarPosition';
  const PAGE_ROW_SEL = '.antcv-page-row';
  const APPLIED_FLAG = 'antcvSidebarPositionApplied';
  // Perf (BOOT-FREEZE / [[boot-storm-gate-freeze]]): on a big doc the
  // page paginates by churning style/class on thousands of nodes. This
  // poll used to run every 750ms unconditionally; slowed to 2000ms now
  // that real changes arrive promptly via the childList observer, the
  // storage event and the click listener — the poll is only a net.
  const POLL_MS = 2000;

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

  // Coalesce a burst of observer callbacks into a single apply pass.
  // During big-doc pagination the DOM mutates continuously for several
  // seconds; without this every mutation triggered a full-tree
  // querySelectorAll. Trailing debounce (waitMs) with a maxWaitMs cap
  // so a continuous storm still applies at least once per maxWaitMs.
  function makeCoalesced(fn, waitMs, maxWaitMs) {
    let t = null, firstAt = 0;
    return function () {
      const now = (window.performance && window.performance.now)
        ? window.performance.now() : Date.now();
      if (t === null) firstAt = now;
      else clearTimeout(t);
      const sinceFirst = now - firstAt;
      const delay = sinceFirst >= maxWaitMs ? 0
        : Math.min(waitMs, maxWaitMs - sinceFirst);
      t = setTimeout(function () { t = null; fn(); }, delay);
    };
  }
  const scheduleApply = makeCoalesced(applyToAllPageRows, 200, 1000);

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
  // page-row (e.g. switching docs between CV and CL). We only need
  // childList here: applying row-reverse is guarded by the
  // APPLIED_FLAG dataset, so attribute-change callbacks only ever
  // no-op (a style clobber leaves the dataset='right', which the
  // guard skips) — observing 'style'/'class' across the whole subtree
  // was pure cost during pagination. Callback is coalesced.
  try {
    const mo = new MutationObserver(scheduleApply);
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // Polling fallback for any edge case where the observer
  // doesn't fire (slowed; see POLL_MS note).
  setInterval(applyToAllPageRows, POLL_MS);
})();
