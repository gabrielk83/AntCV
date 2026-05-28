/* AntCV JD PDF → DOCX via CloudConvert (v1.40.341-p0f)
 * ============================================================
 *
 * CL-006 (LOCKED in plan §0) + GEN-011 + VF-017
 * ---------------------------------------------
 * When a Cover Letter generation pulls its Job Description (JD)
 * from a PDF source, the existing pipeline extracts plain text
 * and tables get flattened or dropped. Per the plan's locked
 * architecture: PDFs are normalised into DOCX via CloudConvert
 * server-side, then routed through the canonical DOCX table
 * parser. The PWA never tries to extract tables from raw PDF
 * text.
 *
 * Flow
 * ----
 *   1. The user uploads or pastes a PDF JD. The bytes land in
 *      the existing JD-input pipeline owned by:
 *        - antcv-data-importer.js (file uploads)
 *        - antcv-jd-watch.js (pasted text + reupload)
 *        - antcv-jd-image-ocr.js (image-based JDs — separate concern)
 *   2. This sidecar installs a single window-level helper:
 *        window.AntcvJdPdfToDocx.convert(pdfBytes, filename?)
 *           → Promise<{ docxBytes, jobId, durationMs } | null>
 *   3. The helper POSTs the bytes to the docx-worker's
 *      `/api/jd/pdf-to-docx` route (see workers/docx-worker/
 *      src/index.js — P0-F).
 *   4. On success, returns the DOCX bytes for the caller to
 *      hand off to the canonical DOCX table parser (mammoth,
 *      already loaded via window.loadMammoth from index.html).
 *   5. On failure (any non-2xx), returns null and shows an
 *      audit-panel warning:
 *        "PDF tables may not have been fully captured —
 *         re-upload as DOCX for best results."
 *      The caller falls back to its existing PDF text-
 *      extraction path.
 *
 * Worker URL resolution
 * ---------------------
 * Reads window.ANTCV_DOCX_WORKER (the same global the rest of
 * the PWA uses for docx-worker calls). If unset, the helper
 * returns null and emits the warning — no point making the
 * call against an invalid origin.
 *
 * Hazards
 * -------
 * - No \s in regex literals.
 * - No \u escapes in JSX text positions (we're not in JSX here).
 * - The 60s ceiling matches the worker's own timeout; we add a
 *   45s client-side AbortController as a defensive cap.
 * - Caller-supplied filename is sanitised on the worker side
 *   (only [A-Za-z0-9_.-] survive); we pass through whatever
 *   the user uploaded.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0f';
  if (window.__antcvJdPdfToDocx341 === SCRIPT_VERSION) return;
  window.__antcvJdPdfToDocx341 = SCRIPT_VERSION;

  var CLIENT_TIMEOUT_MS = 45 * 1000;
  var WARNING_TEXT =
    'PDF tables may not have been fully captured — re-upload as DOCX for best results.';

  function workerOrigin() {
    var o = String(window.ANTCV_DOCX_WORKER || '').trim().replace(/\/+$/, '');
    if (!o) return '';
    if (o.indexOf('https://') !== 0) return '';
    return o;
  }

  function emitWarning(detail) {
    try {
      window.dispatchEvent(new CustomEvent('antcv:jd-pdf-warning', {
        detail: Object.assign({
          source: 'jd-pdf-to-docx-341',
          text: WARNING_TEXT,
          version: SCRIPT_VERSION,
        }, detail || {}),
      }));
    } catch (_) {}
    try { console.warn('[jd-pdf-to-docx]', WARNING_TEXT, detail || ''); } catch (_) {}
  }

  function asUint8(input) {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input && typeof input === 'object' && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.length);
    }
    return null;
  }

  // Public helper. Callers from data-importer / jd-watch invoke
  // this with the raw PDF bytes; the returned DOCX bytes flow
  // into the canonical mammoth-based DOCX table parser already
  // used for DOCX JD uploads.
  function convert(pdfBytes, filename) {
    var bytes = asUint8(pdfBytes);
    if (!bytes) {
      emitWarning({ reason: 'invalid_input' });
      return Promise.resolve(null);
    }
    var origin = workerOrigin();
    if (!origin) {
      emitWarning({ reason: 'worker_unset' });
      return Promise.resolve(null);
    }
    var url = origin + '/api/jd/pdf-to-docx';
    var headers = {
      'Content-Type': 'application/pdf',
    };
    if (filename) headers['X-AntCV-Filename'] = String(filename).slice(0, 64);

    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () {
      try { ctrl.abort(); } catch (_) {}
    }, CLIENT_TIMEOUT_MS) : null;

    var t0 = Date.now();
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: headers,
      body: bytes,
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (resp) {
      if (timer) clearTimeout(timer);
      if (!resp.ok) {
        // Worker emits structured error JSON with 'fallback' field;
        // we just emit the warning regardless of the precise code.
        return resp.text().then(function (body) {
          var meta = { reason: 'http_' + resp.status, body: body.slice(0, 500) };
          emitWarning(meta);
          return null;
        }).catch(function () {
          emitWarning({ reason: 'http_' + resp.status });
          return null;
        });
      }
      var jobId = resp.headers.get('X-AntCV-CloudConvert-Job') || '';
      var durationMs = Number(resp.headers.get('X-AntCV-CloudConvert-Duration-Ms') || '0') || (Date.now() - t0);
      return resp.arrayBuffer().then(function (buf) {
        try {
          console.debug('[jd-pdf-to-docx] received DOCX', buf.byteLength, 'bytes, job', jobId, 'in', durationMs, 'ms');
        } catch (_) {}
        return { docxBytes: new Uint8Array(buf), jobId: jobId, durationMs: durationMs };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var reason = (err && err.name === 'AbortError') ? 'timeout' : 'network';
      emitWarning({ reason: reason, message: String(err && err.message || err) });
      return null;
    });
  }

  // Convenience: detect-and-route. Caller passes the bytes + a
  // mime hint; if it's a PDF, route through CloudConvert; if
  // it's already DOCX, pass through. Returns Promise<Uint8Array
  // | null> where the bytes are guaranteed DOCX on success.
  function detectAndConvert(bytes, mimeOrName) {
    var u8 = asUint8(bytes);
    if (!u8) return Promise.resolve(null);
    var isPdf = false;
    // Magic byte check first.
    if (u8.length >= 5) {
      var head = String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4]);
      if (head === '%PDF-') isPdf = true;
    }
    if (!isPdf && typeof mimeOrName === 'string') {
      var s = mimeOrName.toLowerCase();
      if (s.indexOf('application/pdf') >= 0 || s.indexOf('.pdf') >= 0) isPdf = true;
    }
    if (!isPdf) {
      // Assume already-DOCX or other format the caller knows how
      // to handle; pass bytes through unchanged.
      return Promise.resolve(u8);
    }
    return convert(u8, mimeOrName).then(function (out) {
      if (!out || !out.docxBytes) return null;
      return out.docxBytes;
    });
  }

  window.AntcvJdPdfToDocx = {
    version: SCRIPT_VERSION,
    convert: convert,
    detectAndConvert: detectAndConvert,
    _warningText: WARNING_TEXT,
  };

  try { console.debug('[jd-pdf-to-docx] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
