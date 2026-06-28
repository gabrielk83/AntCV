/* antcv-pdf-worker-warmup.js — EXPORT-WARMUP-001 (owner 2026-06-28)
 * ============================================================================
 * Symptom: the FIRST PDF export of a session always hit the browser "Page setup"
 * (client print) instead of the native CloudConvert export; a refresh fixed it.
 *
 * Root cause: the PDF button gates the native path on `await isPdfWorkerAvailable()`
 * (antcv-docx-client.js), which lazily probes the docx-worker `/health` on the FIRST
 * click. A COLD worker returns a transient null — and isPdfWorkerAvailable() does
 * NOT cache a null — so the gate evaluates false and control falls through to the
 * browser-print fallback (`kl()`). On the next load the worker is warm, `/health`
 * returns 200, the result caches, and every export uses CloudConvert.
 *
 * Fix: warm the probe in the BACKGROUND a few seconds after boot (and retry until
 * `/health` answers), so the cache is populated BEFORE the user reaches the export
 * button. This is purely additive and read-only — it only calls the existing health
 * probe. If it fails for any reason it simply no-ops and behaviour is exactly as it
 * is today (the first click would still cold-probe). It CANNOT regress the app.
 *
 * Kill switch: localStorage 'antcv:disable-pdf-warmup' = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvPdfWarmup) return;
  window.__antcvPdfWarmup = 1;
  try { if (localStorage.getItem('antcv:disable-pdf-warmup') === '1') return; } catch (_) {}

  var fnTries = 0;     // waiting for the docx-client module to define the probe
  var probeTries = 0;  // re-probing a cold worker until /health answers
  var MAX_FN = 20;     // ~16s waiting for the module
  var MAX_PROBE = 6;   // ~15s of cold-start retries

  function warm() {
    var f = window.isPdfWorkerAvailable;
    if (typeof f !== 'function') {
      if (fnTries++ < MAX_FN) setTimeout(warm, 800);
      return;
    }
    probeTries++;
    try {
      Promise.resolve(f()).then(function (r) {
        // r truthy => isPdfWorkerAvailable() cached it; the first export uses the
        // worker. null/undefined => worker still cold/unreachable; retry a few times.
        if ((r === null || r === undefined) && probeTries < MAX_PROBE) setTimeout(warm, 2500);
        else { try { console.debug('[pdf-warmup] worker availability:', r); } catch (_) {} }
      }).catch(function () {
        if (probeTries < MAX_PROBE) setTimeout(warm, 2500);
      });
    } catch (_) {
      if (probeTries < MAX_PROBE) setTimeout(warm, 2500);
    }
  }

  // After boot settles, well before the user opens the export preview.
  setTimeout(warm, 2500);
  try { console.debug('[pdf-warmup] installed'); } catch (_) {}
})();
