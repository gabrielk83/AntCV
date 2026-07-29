/* antcv-application-line-001.js — HEADER-APP-LINE-001 → RETIRED (owner 2026-07-22)
 * ============================================================================
 * This sidecar used to (a) rewrite the CL heading "Application: [role]" subtitle
 * to the specialisation and (b) inject the per-app APPLICATION LINE ("Application
 * for [Role] at [Company]") under the slogan, on the PREVIEW surface only.
 *
 * BOTH jobs now live in NATIVE render, so the sidecar is retired to stop the CL
 * ever DOUBLE-rendering the application line (native line + this injected line):
 *   - CL heading → specialisation:  app.src.js CL branch (CL-APP-SUBTITLE-HEADING-
 *     SWAP-001), the export-HTML builder, the docx-client payload, and the worker.
 *   - Application line under the slogan:  app.src.js CL preview React + export HTML
 *     (both keyed off window.__antcvAppLineText), and the docx-worker DOCX/PDF.
 *
 * This file is kept (still listed in index.html + sw.js SHELL) as a NO-OP whose only
 * remaining job is to SWEEP any legacy [data-antcv-app-line] node a previously-cached
 * copy of this sidecar may have injected — so a client transitioning from the old
 * build self-heals to a single, native application line instead of two.
 *
 * Kill switch is obsolete (nothing to disable). Do not re-add injection here; the
 * application line is owned by render now (see [[header-app-line-and-react-inject-gotchas]]).
 */
(function () {
  'use strict';

  var VERSION = '1.51.2661-application-line-retired';
  if (window.__antcvApplicationLine === VERSION) return;
  window.__antcvApplicationLine = VERSION;

  var MARK = 'data-antcv-app-line';

  // Remove any legacy sidecar-injected application line. Native render's line
  // carries NO such attribute (React key "__cl_appline"), so this only clears
  // the OLD injected node — never the native one.
  function sweepLegacy() {
    try {
      var xs = document.querySelectorAll('[' + MARK + ']');
      for (var i = 0; i < xs.length; i++) { if (xs[i].parentNode) xs[i].parentNode.removeChild(xs[i]); }
    } catch (_) {}
  }

  function start() {
    sweepLegacy();
    // A stale, still-running old instance (from a cached copy loaded before this
    // one replaced it) could re-inject after our first sweep; a few cheap delayed
    // sweeps cover that transition window, then we stop.
    [400, 1200, 3000, 8000].forEach(function (ms) { setTimeout(sweepLegacy, ms); });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  try { window.AntcvApplicationLine = { version: VERSION, retired: true, _sweep: sweepLegacy }; } catch (_) {}
  try { console.debug('[application-line] retired ' + VERSION + ' — application line is native now'); } catch (_) {}
})();
