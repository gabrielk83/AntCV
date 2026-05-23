/* AntCV PDF "Po is not defined" shim (v1.40.153)
 * ============================================================
 *
 * Symptom
 * -------
 *   [pdf] server export failed, falling back to client print:
 *   Po is not defined
 *
 * Every time the user clicks the PDF export button, server-side
 * PDF generation throws a ReferenceError on `Po`, falls back to
 * the in-browser print path, and pollutes the console.
 *
 * Root cause
 * ----------
 * Inside app.js the server export call passes a config object:
 *
 *     window.exportPdfViaWorker({ ..., navyColor: Po,
 *                                 headerItemAlign: headerItemAlign,
 *                                 headerItemLoc: headerItemLoc })
 *
 * `Po` is the minified name expected to hold the current navy
 * colour. Other identifiers on the same line are de-minified
 * (key:value names match), suggesting `Po` was renamed/removed
 * upstream and a stale reference remains. There is no `var Po`,
 * `let Po`, `const Po`, or `function Po` anywhere in app.js, and
 * the file does not declare `'use strict'`, so the bare
 * identifier falls through to `window.Po`. Defining a global
 * `Po` makes the reference resolve.
 *
 * Fix
 * ---
 * This sidecar installs `window.Po` as a getter that returns the
 * current navyColor from localStorage (falling back to the brand
 * default `#283556`). The getter is read each time `Po` is
 * accessed, so colour changes mid-session are picked up.
 *
 * Storage shape
 * -------------
 *     localStorage.navyColor = JSON.stringify("#283556")
 *
 * Older builds may have written the raw hex without JSON quotes;
 * the reader is tolerant of both.
 *
 * Load order
 * ----------
 * Must be loaded BEFORE app.js or, at minimum, before the user
 * can click the PDF button. Since all sidecars are `defer`, they
 * run in document order after parsing — registering this script
 * BEFORE app.js in index.html gives the earliest availability.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.153';
  const STORAGE_KEY = 'navyColor';
  const DEFAULT_NAVY = '#283556';

  if (window.__antcvPdfPoShimInstalled) return;
  window.__antcvPdfPoShimInstalled = SCRIPT_VERSION;

  function readNavyColor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_NAVY;
      // Tolerate both JSON-quoted "#283556" and bare #283556.
      let v = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') v = parsed;
      } catch (_) {
        // Not JSON — use raw value as-is.
      }
      v = String(v).trim();
      // Sanity check: #RRGGBB or #RGB or named CSS colour fallback.
      if (v.length === 0) return DEFAULT_NAVY;
      return v;
    } catch (_) {
      return DEFAULT_NAVY;
    }
  }

  // Define Po as a global property. The bare identifier `Po` inside
  // app.js (non-strict mode) falls through to `window.Po`.
  //
  // We use defineProperty rather than `window.Po = readNavyColor()`
  // so the value is re-read at access time, not frozen at load.
  try {
    if (typeof window.Po === 'undefined') {
      Object.defineProperty(window, 'Po', {
        get: readNavyColor,
        configurable: true,
      });
    }
  } catch (_) {
    // Fallback: best-effort assignment (no live reads).
    try { window.Po = readNavyColor(); } catch (__) {}
  }

  // Test/debug API
  window.AntcvPdfPoShim = {
    version: SCRIPT_VERSION,
    _readNavyColor: readNavyColor,
    _defaultNavy: DEFAULT_NAVY,
  };
})();
