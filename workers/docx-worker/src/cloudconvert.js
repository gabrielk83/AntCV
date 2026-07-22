// AntCV CloudConvert client — DOCX → PDF conversion.
// =================================================================
// Why this exists:
// -----------------
// AntCV's client-side PDF export uses window.print() which suffers
// from Chrome's CID-keyed font subsetting bug — the resulting PDFs
// render visually but have no ToUnicode CMap, so ATS scanners,
// PDF.js, pdfminer, and Adobe extract garbage instead of text.
// v1.40.95 worked around this by forcing Arial in @media print,
// which is ATS-readable but loses the Carlito visual identity.
//
// This module performs server-side DOCX→PDF conversion via the
// CloudConvert API. The conversion runs in CloudConvert's
// LibreOffice cluster, which produces PDFs with proper Unicode
// embedding AND retains the visual identity of the DOCX source.
//
// Best of both worlds: ATS-readable AND visually faithful.
//
// API model:
// -----------
// CloudConvert uses a job-based API. A typical job has three tasks
// chained by name reference:
//   1. import/base64 — accept the DOCX bytes inline (base64-encoded)
//   2. convert       — perform the format conversion
//   3. export/url    — produce a temporary download URL
//
// We create the job, poll for completion, then GET the PDF bytes
// from the export URL. Total round-trip is typically 3-8 seconds
// for a small CV; we cap at 60 seconds to bound Cloudflare Worker
// CPU time.
//
// Cost: free tier is 25 conversion minutes/day (roughly 1500
// conversions/day for short documents). Pay-as-you-go is
// $0.005/minute beyond that. For personal use this is effectively
// free; for a multi-user product, scale-aware.
//
// Setup: add the API key as a Worker secret:
//   npx wrangler secret put CLOUDCONVERT_API_KEY
// Get the key from https://cloudconvert.com/dashboard/api/v2/keys
// (free signup; account has 25 conversion-minutes/day free quota).

const API_BASE = 'https://api.cloudconvert.com/v2';
// Total time budget for the full conversion. CloudConvert usually
// completes a single-page DOCX in 3-5s; the polling interval below
// (every 1.5s) gives us ~40 attempts within this budget. If we hit
// the timeout, we error out rather than letting the worker run
// until CPU limit termination.
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1500;

/**
 * Convert a DOCX buffer to PDF via the CloudConvert API.
 *
 * @param {Uint8Array | ArrayBuffer | Buffer} docxBytes - DOCX content
 * @param {string} apiKey - CloudConvert API key (from env)
 * @param {Object} [opts]
 * @param {string} [opts.filename] - optional filename for the import task
 * @returns {Promise<{ buffer: Uint8Array, jobId: string, durationMs: number }>}
 * @throws Error if any step fails or the timeout is hit
 */
export async function convertDocxToPdf(docxBytes, apiKey, opts = {}) {
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY not configured on the worker');
  }
  const filename = (opts.filename || 'document') + '.docx';
  const startMs = Date.now();

  // Normalize input to Uint8Array, then encode to base64. The browser
  // btoa() takes a binary string (each char 0-255), so we build that
  // first. Going through TextDecoder/atob would be cleaner but
  // CloudConvert's import/base64 expects standard base64 with no URL
  // safety, so the simple build is fine.
  let bytes;
  if (docxBytes instanceof Uint8Array) {
    bytes = docxBytes;
  } else if (docxBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(docxBytes);
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(docxBytes)) {
    bytes = new Uint8Array(docxBytes.buffer, docxBytes.byteOffset, docxBytes.byteLength);
  } else {
    throw new Error('convertDocxToPdf: unsupported input type');
  }

  // Build base64 string from byte chunks to avoid the call-stack
  // overflow you get from btoa(String.fromCharCode(...verylongArray)).
  // 8192-byte chunks keep us well under the spread-operator limit.
  let binStr = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binStr += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binStr);

  // Step 1: create the conversion job. CloudConvert runs all three
  // tasks (import → convert → export) automatically once the import
  // is fed. We give them short stable names so we can find each
  // task by name in the polling response.
  console.log(`[cloudconvert] creating job, input=${bytes.length}B base64=${b64.length}ch`);
  const createResp = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-docx': {
          operation: 'import/base64',
          file: b64,
          filename,
        },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'import-docx',
          input_format: 'docx',
          output_format: 'pdf',
          // engine_version 'libreoffice' is the default; explicit for
          // clarity. LibreOffice produces PDFs with proper PDF/A-style
          // ToUnicode mappings, which is the entire reason we're here.
          engine: 'libreoffice',
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-to-pdf',
          inline: false,
          archive_multiple_files: false,
        },
      },
      tag: 'antcv-docx-to-pdf',
    }),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text().catch(() => '');
    throw new Error(`CloudConvert job creation failed: ${createResp.status} ${errBody.slice(0, 500)}`);
  }
  const createJson = await createResp.json();
  const jobId = createJson?.data?.id;
  if (!jobId) {
    throw new Error('CloudConvert job created but no id returned');
  }
  console.log(`[cloudconvert] job ${jobId} created`);

  // Step 2: poll the job until it finishes or errors. CloudConvert
  // exposes a synchronous "wait for completion" via /jobs/{id}/wait
  // but that endpoint counts against the same CPU time budget as
  // multiple poll calls and gives us less control over the timeout.
  // Plain polling at 1.5s intervals is cheaper and clearer.
  let exportFileUrl = null;
  let pollCount = 0;
  while (Date.now() - startMs < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pollCount++;
    const statusResp = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) {
      const errBody = await statusResp.text().catch(() => '');
      throw new Error(`CloudConvert status check failed: ${statusResp.status} ${errBody.slice(0, 500)}`);
    }
    const statusJson = await statusResp.json();
    const jobStatus = statusJson?.data?.status;
    if (jobStatus === 'error') {
      const tasks = statusJson?.data?.tasks || [];
      const failed = tasks.find((t) => t.status === 'error');
      throw new Error(`CloudConvert job ${jobId} errored: ${failed?.code || 'unknown'} — ${failed?.message || ''}`);
    }
    if (jobStatus === 'finished') {
      const tasks = statusJson?.data?.tasks || [];
      const exportTask = tasks.find((t) => t.name === 'export-pdf');
      const files = exportTask?.result?.files || [];
      if (!files.length || !files[0].url) {
        throw new Error(`CloudConvert finished but export-pdf produced no file URL`);
      }
      exportFileUrl = files[0].url;
      console.log(`[cloudconvert] job ${jobId} finished after ${pollCount} polls (${Date.now() - startMs}ms)`);
      break;
    }
    // jobStatus === 'waiting' or 'processing' — keep polling
  }

  if (!exportFileUrl) {
    throw new Error(`CloudConvert job ${jobId} did not complete within ${TIMEOUT_MS}ms (polled ${pollCount} times)`);
  }

  // Step 3: download the PDF. CloudConvert serves the file from a
  // temporary signed URL that's valid for ~24 hours. We download it
  // immediately and stream the bytes back to the PWA.
  const pdfResp = await fetch(exportFileUrl);
  if (!pdfResp.ok) {
    throw new Error(`CloudConvert PDF download failed: ${pdfResp.status}`);
  }
  const pdfBuffer = new Uint8Array(await pdfResp.arrayBuffer());
  console.log(`[cloudconvert] downloaded PDF: ${pdfBuffer.length}B`);

  return {
    buffer: pdfBuffer,
    jobId,
    durationMs: Date.now() - startMs,
  };
}

/**
 * HTML-TO-PDF-001: convert an HTML string to PDF via CloudConvert's Chrome
 * engine. Used by the /generate-analysis-pdf route so the JD-analysis report
 * (a self-contained branded HTML document, not a CV/CL docx) becomes an
 * ATS-legible, Unicode-embedded PDF — the same reason the CV/CL export uses
 * convertDocxToPdf. Mirrors convertDocxToPdf's import/base64 → convert →
 * export/url shape; the convert task uses input_format 'html', engine 'chrome',
 * print_background true and A4 zero-margin.
 *
 * @param {string} html - the report HTML
 * @param {string} apiKey - CloudConvert API key (from env)
 * @param {Object} [opts]
 * @param {string} [opts.filename] - optional filename for the import task
 * @returns {Promise<{ buffer: Uint8Array, jobId: string, durationMs: number }>}
 */
export async function convertHtmlToPdf(html, apiKey, opts = {}) {
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY not configured on the worker');
  }
  const filename = (opts.filename || 'report') + '.html';
  const startMs = Date.now();

  // UTF-8 encode before base64 — the report can carry non-ASCII (Danish text,
  // candidate names, emoji), and btoa on the raw string throws on any code
  // point > 0xFF.
  const bytes = new TextEncoder().encode(String(html == null ? '' : html));
  let binStr = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binStr += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binStr);

  console.log(`[cloudconvert] html-to-pdf: creating job, input=${bytes.length}B base64=${b64.length}ch`);
  const createResp = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-html': {
          operation: 'import/base64',
          file: b64,
          filename,
        },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'import-html',
          input_format: 'html',
          output_format: 'pdf',
          // Chrome renders the report's CSS + colour blocks faithfully;
          // print_background keeps the branded bands, and A4 zero-margin lets
          // the report's own page padding own the layout.
          engine: 'chrome',
          print_background: true,
          page_size: 'A4',
          margin_top: '0',
          margin_bottom: '0',
          margin_left: '0',
          margin_right: '0',
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-to-pdf',
          inline: false,
          archive_multiple_files: false,
        },
      },
      tag: 'antcv-html-to-pdf',
    }),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text().catch(() => '');
    throw new Error(`CloudConvert html-to-pdf job creation failed: ${createResp.status} ${errBody.slice(0, 500)}`);
  }
  const createJson = await createResp.json();
  const jobId = createJson?.data?.id;
  if (!jobId) {
    throw new Error('CloudConvert html-to-pdf job created but no id returned');
  }
  console.log(`[cloudconvert] html-to-pdf job ${jobId} created`);

  let exportFileUrl = null;
  let pollCount = 0;
  while (Date.now() - startMs < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pollCount++;
    const statusResp = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) {
      const errBody = await statusResp.text().catch(() => '');
      throw new Error(`CloudConvert html-to-pdf status check failed: ${statusResp.status} ${errBody.slice(0, 500)}`);
    }
    const statusJson = await statusResp.json();
    const jobStatus = statusJson?.data?.status;
    if (jobStatus === 'error') {
      const tasks = statusJson?.data?.tasks || [];
      const failed = tasks.find((t) => t.status === 'error');
      throw new Error(`CloudConvert html-to-pdf job ${jobId} errored: ${failed?.code || 'unknown'} — ${failed?.message || ''}`);
    }
    if (jobStatus === 'finished') {
      const tasks = statusJson?.data?.tasks || [];
      const exportTask = tasks.find((t) => t.name === 'export-pdf');
      const files = exportTask?.result?.files || [];
      if (!files.length || !files[0].url) {
        throw new Error(`CloudConvert html-to-pdf finished but export-pdf produced no file URL`);
      }
      exportFileUrl = files[0].url;
      console.log(`[cloudconvert] html-to-pdf job ${jobId} finished after ${pollCount} polls (${Date.now() - startMs}ms)`);
      break;
    }
  }

  if (!exportFileUrl) {
    throw new Error(`CloudConvert html-to-pdf job ${jobId} did not complete within ${TIMEOUT_MS}ms (polled ${pollCount} times)`);
  }

  const pdfResp = await fetch(exportFileUrl);
  if (!pdfResp.ok) {
    throw new Error(`CloudConvert html-to-pdf download failed: ${pdfResp.status}`);
  }
  const pdfBuffer = new Uint8Array(await pdfResp.arrayBuffer());
  console.log(`[cloudconvert] html-to-pdf downloaded PDF: ${pdfBuffer.length}B`);

  return {
    buffer: pdfBuffer,
    jobId,
    durationMs: Date.now() - startMs,
  };
}

/**
 * Quick check whether PDF generation is configured on this worker.
 * Used by /health to advertise capability to the PWA.
 *
 * @param {Object} env - Worker environment
 * @returns {string | null} 'cloudconvert' if configured, null otherwise
 */
export function pdfProvider(env) {
  if (env && env.CLOUDCONVERT_API_KEY && String(env.CLOUDCONVERT_API_KEY).trim()) {
    return 'cloudconvert';
  }
  return null;
}

/**
 * P0-F: convert PDF bytes to DOCX bytes via CloudConvert.
 * Used by the /api/jd/pdf-to-docx route so the PWA can normalise
 * PDF JDs into DOCX upstream of the canonical DOCX table parser.
 *
 * Mirrors convertDocxToPdf above with formats swapped:
 *   import/base64 (pdf) → convert (pdf → docx) → export/url → fetch
 *
 * @param {Uint8Array|ArrayBuffer|Buffer} pdfBytes - input PDF bytes
 * @param {string} apiKey - CloudConvert API key (from env)
 * @param {Object} [opts]
 * @param {string} [opts.filename] - optional filename for the import task
 * @returns {Promise<{ buffer: Uint8Array, jobId: string, durationMs: number }>}
 * @throws Error if any step fails or the timeout is hit
 */
export async function convertPdfToDocx(pdfBytes, apiKey, opts = {}) {
  if (!apiKey) {
    throw new Error('CLOUDCONVERT_API_KEY not configured on the worker');
  }
  const filename = (opts.filename || 'jd') + '.pdf';
  const startMs = Date.now();

  let bytes;
  if (pdfBytes instanceof Uint8Array) {
    bytes = pdfBytes;
  } else if (pdfBytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(pdfBytes);
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(pdfBytes)) {
    bytes = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  } else {
    throw new Error('convertPdfToDocx: unsupported input type');
  }

  let binStr = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binStr += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(binStr);

  console.log(`[cloudconvert] pdf-to-docx: creating job, input=${bytes.length}B base64=${b64.length}ch`);
  const createResp = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        'import-pdf': {
          operation: 'import/base64',
          file: b64,
          filename,
        },
        'convert-to-docx': {
          operation: 'convert',
          input: 'import-pdf',
          input_format: 'pdf',
          output_format: 'docx',
          // LibreOffice is the default engine. It preserves table
          // structure well — that's the whole point of this route.
          engine: 'libreoffice',
        },
        'export-docx': {
          operation: 'export/url',
          input: 'convert-to-docx',
          inline: false,
          archive_multiple_files: false,
        },
      },
      tag: 'antcv-pdf-to-docx',
    }),
  });

  if (!createResp.ok) {
    const errBody = await createResp.text().catch(() => '');
    throw new Error(`CloudConvert pdf-to-docx job creation failed: ${createResp.status} ${errBody.slice(0, 500)}`);
  }
  const createJson = await createResp.json();
  const jobId = createJson?.data?.id;
  if (!jobId) {
    throw new Error('CloudConvert pdf-to-docx job created but no id returned');
  }
  console.log(`[cloudconvert] pdf-to-docx job ${jobId} created`);

  let exportFileUrl = null;
  let pollCount = 0;
  while (Date.now() - startMs < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pollCount++;
    const statusResp = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) {
      const errBody = await statusResp.text().catch(() => '');
      throw new Error(`CloudConvert pdf-to-docx status check failed: ${statusResp.status} ${errBody.slice(0, 500)}`);
    }
    const statusJson = await statusResp.json();
    const jobStatus = statusJson?.data?.status;
    if (jobStatus === 'error') {
      const tasks = statusJson?.data?.tasks || [];
      const failed = tasks.find((t) => t.status === 'error');
      throw new Error(`CloudConvert pdf-to-docx job ${jobId} errored: ${failed?.code || 'unknown'} — ${failed?.message || ''}`);
    }
    if (jobStatus === 'finished') {
      const tasks = statusJson?.data?.tasks || [];
      const exportTask = tasks.find((t) => t.name === 'export-docx');
      const files = exportTask?.result?.files || [];
      if (!files.length || !files[0].url) {
        throw new Error(`CloudConvert pdf-to-docx finished but export-docx produced no file URL`);
      }
      exportFileUrl = files[0].url;
      console.log(`[cloudconvert] pdf-to-docx job ${jobId} finished after ${pollCount} polls (${Date.now() - startMs}ms)`);
      break;
    }
  }

  if (!exportFileUrl) {
    throw new Error(`CloudConvert pdf-to-docx job ${jobId} did not complete within ${TIMEOUT_MS}ms (polled ${pollCount} times)`);
  }

  const docxResp = await fetch(exportFileUrl);
  if (!docxResp.ok) {
    throw new Error(`CloudConvert pdf-to-docx download failed: ${docxResp.status}`);
  }
  const docxBuffer = new Uint8Array(await docxResp.arrayBuffer());
  console.log(`[cloudconvert] downloaded DOCX: ${docxBuffer.length}B`);

  return {
    buffer: docxBuffer,
    jobId,
    durationMs: Date.now() - startMs,
  };
}
