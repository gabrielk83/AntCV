// AntCV DOCX Cloudflare Worker
// =================================================================
// Generates Microsoft Word-compliant .docx files from a clean JSON
// payload. Replaces the inline JSZip + hand-built XML pipeline in
// the AntCV PWA, which was fragile and produced docx files that
// Word sometimes opened with "minor errors" warnings.
//
// Architecture:
//   PWA frontend  ──POST JSON──>  this Worker  ──> docx blob
//
// The worker uses the `docx` npm library (pure JS, runs in V8
// isolates) and the docx schema validator from docx itself, so
// every output passes Word's strict validation.
//
// Endpoints:
//   POST /generate    Body: { schema_version, doc, ... }  → .docx blob
//   GET  /health      → { ok: true, version }
//   GET  /schema      → JSON Schema for the request body
//
// Auth model:
//   - CORS allowlist via env.ALLOWED_ORIGINS (comma-separated)
//   - Optional shared secret via env.WORKER_SECRET (X-AntCV-Secret header)
//   - No LLM keys — this worker does NO calls to LLM providers.
//     Keep that responsibility in the existing cloudflare-worker.js
//     (the LLM proxy). This worker only renders documents.

import { generateDocx } from './generate.js';
import { validatePayload } from './schema.js';
import { convertDocxToPdf, convertPdfToDocx, pdfProvider } from './cloudconvert.js';

const VERSION = '1.13.1-academic';

// ──────────────────────────────────────────────────────────────────
// Entry
// ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    // Origin check (skip for same-origin / curl with no Origin)
    if (origin && !isAllowedOrigin(origin, env)) {
      return json({ error: 'origin not allowed', origin }, 403, origin, env);
    }

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return json(
          {
            ok: true,
            version: VERSION,
            // v1.13.0: PWA reads this to decide whether to call the
            // server PDF endpoint or fall back to the client-side
            // window.print() path. Null when CLOUDCONVERT_API_KEY
            // isn't set, in which case the PWA continues using
            // the client-side print fallback with the @media print
            // Arial override from v1.40.95.
            pdf_via: pdfProvider(env),
          },
          200,
          origin,
          env,
        );
      }

      if (url.pathname === '/schema' && request.method === 'GET') {
        return json(getSchemaDoc(), 200, origin, env);
      }


      if (url.pathname === '/logout' && request.method === 'GET') {
        return handleLogout(env);
      }

      if (isAnalyticsExportPath(url.pathname) && request.method === 'GET') {
        return await handleAnalyticsExport(request, origin, env);
      }

      if (url.pathname === '/generate' && request.method === 'POST') {
        return await handleGenerate(request, origin, env);
      }

      if (url.pathname === '/generate-pdf' && request.method === 'POST') {
        return await handleGeneratePdf(request, origin, env);
      }

      // P0-F (plan §4.3 CL-006): normalise PDF JDs into DOCX so the
      // canonical DOCX table parser can extract structured tables.
      // The PWA POSTs raw PDF bytes; we return DOCX bytes (or an
      // error JSON that the PWA reads to trigger its
      // "PDF tables may not have been fully captured" fallback).
      if (url.pathname === '/api/jd/pdf-to-docx' && request.method === 'POST') {
        return await handlePdfToDocx(request, origin, env);
      }

      return json({ error: 'not found', path: url.pathname }, 404, origin, env);
    } catch (err) {
      console.error('[docx-worker] unhandled', err);
      return json(
        { error: 'internal error', message: String(err && err.message || err) },
        500,
        origin,
        env
      );
    }
  },
};

// ──────────────────────────────────────────────────────────────────
// /generate handler
// ──────────────────────────────────────────────────────────────────
async function handleGenerate(request, origin, env) {
  // Optional shared-secret check (additional layer beyond CORS).
  if (env.WORKER_SECRET) {
    const presented = request.headers.get('X-AntCV-Secret') || '';
    if (presented !== env.WORKER_SECRET) {
      return json({ error: 'unauthorized' }, 401, origin, env);
    }
  }

  // Body size cap. The payload includes a base64-encoded photo
  // (capped at ~350KB by schema) plus JSON for all sections; a
  // full CV with a photo and many sections sits in the 200-400KB
  // range. The cap below gives ~10× headroom for atypical cases
  // (high-resolution photo, very long experience history, multiple
  // role bullets per company). Cloudflare Workers Paid plan
  // accepts up to 100MB request bodies so this is well within
  // platform limits.
  const MAX_BYTES = 4 * 1024 * 1024;
  const raw = await request.text();
  if (raw.length > MAX_BYTES) {
    return json({
      error: 'payload too large',
      max_bytes: MAX_BYTES,
      received_bytes: raw.length,
      hint: 'Reduce the profile photo size or split very large CVs into multiple sections.',
    }, 413, origin, env);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return json({ error: 'invalid JSON', detail: String(e.message || e) }, 400, origin, env);
  }

  // Schema validation — clean rejection rather than letting docx-js
  // throw an opaque error halfway through generation.
  const errors = validatePayload(payload);
  if (errors.length) {
    return json({ error: 'schema validation failed', errors }, 422, origin, env);
  }

  // Generate.
  let buffer;
  const t0 = Date.now();
  try {
    buffer = await generateDocx({ ...payload, _workerVersion: VERSION });
  } catch (e) {
    console.error('[docx-worker] generation failed', e, e.stack);
    return json(
      { error: 'generation failed', message: String(e.message || e) },
      500,
      origin,
      env
    );
  }
  const ms = Date.now() - t0;

  // v1.11.0 — optional password protection.
  // Encryption uses officecrypto-tool with the standard OOXML
  // EncryptedPackage format (AES-128, agile encryption). The encrypted
  // file opens in Microsoft Word with the "Enter password" prompt.
  //
  // The library is dynamically imported so the worker still builds and
  // ships without it. Users who don't need password support can deploy
  // as-is; users who do need it run:
  //   npm install officecrypto-tool
  //   npx wrangler deploy
  if (payload.password && String(payload.password).trim()) {
    let officecrypto = null;
    try {
      officecrypto = await import('officecrypto-tool');
    } catch (e) {
      console.error('[docx-worker] officecrypto-tool not installed', e);
      return json(
        {
          error: 'password_lib_missing',
          message:
            'Password protection was requested but the docx-worker has not been built with officecrypto-tool. ' +
            'Run `npm install officecrypto-tool` in the worker repo and redeploy.',
        },
        501,
        origin,
        env
      );
    }
    try {
      const inputBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      const encrypted = await officecrypto.encrypt(inputBuf, {
        password: String(payload.password),
      });
      // Preserve the side-channel post-process fields we set on `buffer`
      // earlier — we copy them onto the encrypted buffer so headers stay
      // truthful about what was generated.
      encrypted.__antcv_post_process_status = buffer.__antcv_post_process_status;
      encrypted.__antcv_post_process_error  = buffer.__antcv_post_process_error;
      encrypted.__antcv_cont_replacements   = buffer.__antcv_cont_replacements;
      encrypted.__antcv_markers_remaining   = buffer.__antcv_markers_remaining;
      buffer = encrypted;
    } catch (e) {
      console.error('[docx-worker] encryption failed', e);
      return json(
        { error: 'encryption_failed', message: String(e.message || e) },
        500,
        origin,
        env
      );
    }
  }

  const filename = sanitizeFilename(payload.filename || 'document') + '.docx';

  // Pull the post-process status off the buffer side-channel set by
  // generate.js. Status values:
  //   ok        — every __ANTCV_CONT_ placeholder was successfully
  //               replaced with a Word field code. File opens
  //               correctly in MS Word, LibreOffice, Google Docs.
  //   skipped   — no titled sections in this document, nothing to
  //               post-process. Word-compatible.
  //   partial   — some placeholders survived in the output bytes;
  //               continuation pages may show "__ANTCV_CONT_N__"
  //               literally next to a heading. File still opens in
  //               Word, but it's a quality issue worth surfacing.
  //   failed    — post-process threw and the raw docx was emitted
  //               as fallback. Continuation pages won't show
  //               "(Cont.)" but the file is well-formed OOXML.
  // The PWA reads X-AntCV-Post-Process-Status and shows a banner
  // when it is not 'ok' or 'skipped'.
  const ppStatus = (buffer && buffer.__antcv_post_process_status) || 'unknown';
  const ppError = (buffer && buffer.__antcv_post_process_error) || null;
  const replacements = (buffer && buffer.__antcv_cont_replacements) || 0;
  const markersRemaining = (buffer && buffer.__antcv_markers_remaining) || 0;

  // Word-compatibility flag — coarse but actionable for the UI.
  //   true   — every check passed
  //   maybe  — file opens in Word but may show small issues
  //   false  — reserved for known-broken outputs (not used currently)
  const wordCompatible =
    (ppStatus === 'ok' || ppStatus === 'skipped') ? 'true' :
    (ppStatus === 'partial' || ppStatus === 'failed') ? 'maybe' :
    'unknown';

  const headers = {
    'Content-Type':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(buffer.byteLength || buffer.length),
    'X-AntCV-Generation-Ms': String(ms),
    'X-AntCV-Worker-Version': VERSION,
    'X-AntCV-Post-Process-Status': ppStatus,
    'X-AntCV-Word-Compatible': wordCompatible,
    'X-AntCV-Cont-Replacements': String(replacements),
    'X-AntCV-Markers-Remaining': String(markersRemaining),
    'X-AntCV-Encrypted': payload.password && String(payload.password).trim() ? 'true' : 'false',
    'Cache-Control': 'no-store',
    // Expose the AntCV headers to the browser fetch() — without
    // Access-Control-Expose-Headers, the PWA can't read them
    // even though CORS allows the response body through.
    'Access-Control-Expose-Headers': [
      'X-AntCV-Generation-Ms',
      'X-AntCV-Worker-Version',
      'X-AntCV-Post-Process-Status',
      'X-AntCV-Word-Compatible',
      'X-AntCV-Cont-Replacements',
      'X-AntCV-Markers-Remaining',
      'X-AntCV-Encrypted',
      'X-AntCV-Post-Process-Error',
    ].join(', '),
    ...corsHeaders(origin, env),
  };
  // Only include the error detail header when there's something to report;
  // it's a free-text field, so we cap and sanitize for header safety.
  if (ppError) {
    headers['X-AntCV-Post-Process-Error'] = ppError.replace(/[\r\n]/g, ' ').slice(0, 200);
  }

  return new Response(buffer, {
    status: 200,
    headers,
  });
}

// ──────────────────────────────────────────────────────────────────
// /generate-pdf handler
// ──────────────────────────────────────────────────────────────────
// v1.13.0: server-side ATS-readable PDF generation.
//
// Pipeline:
//   1. Generate DOCX via the existing generateDocx() — same shape,
//      same fonts, same layout as /generate
//   2. Apply post-processing (watermark, photo-circle) via the
//      side-effect from generateDocx — already in the buffer
//   3. Convert DOCX → PDF via CloudConvert's LibreOffice cluster
//   4. Return the PDF bytes
//
// Why the conversion step matters: the PWA's client-side PDF path
// (window.print) generates CID-encoded PDFs without ToUnicode maps,
// which ATS systems can't read. CloudConvert runs LibreOffice
// server-side, which produces PDFs with proper Unicode embedding —
// ATS-readable, visually identical to the DOCX, no font compromises.
//
// Cost note: free tier on CloudConvert is 25 conversion-minutes/day
// (~1500 single-page CV conversions). Pay-as-you-go beyond that is
// ~$0.005/conversion. The PDF generation latency is 3-8 seconds
// typical; we bound it at 60s in cloudconvert.js.
//
// Fallback behaviour: if CLOUDCONVERT_API_KEY is not set, this
// endpoint returns 503 and the PWA falls back to client-side
// window.print() with the v1.40.95 Arial override. So deploying
// the worker without the secret is harmless — the PWA just keeps
// using the client path.
async function handleGeneratePdf(request, origin, env) {
  // Same auth as /generate.
  if (env.WORKER_SECRET) {
    const presented = request.headers.get('X-AntCV-Secret') || '';
    if (presented !== env.WORKER_SECRET) {
      return json({ error: 'unauthorized' }, 401, origin, env);
    }
  }

  // Reject early if CloudConvert is not configured. The PWA will see
  // the 503 + provider field and fall back to client-side PDF.
  const provider = pdfProvider(env);
  if (!provider) {
    return json(
      {
        error: 'pdf_not_configured',
        message:
          'Server-side PDF generation is not configured on this worker. ' +
          'Set the CLOUDCONVERT_API_KEY secret to enable: ' +
          '`npx wrangler secret put CLOUDCONVERT_API_KEY`. ' +
          'The PWA will fall back to client-side PDF print until configured.',
        provider: null,
      },
      503,
      origin,
      env,
    );
  }

  // Body size handling is identical to /generate.
  const MAX_BYTES = 4 * 1024 * 1024;
  const raw = await request.text();
  if (raw.length > MAX_BYTES) {
    return json(
      {
        error: 'payload too large',
        max_bytes: MAX_BYTES,
        received_bytes: raw.length,
      },
      413,
      origin,
      env,
    );
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return json({ error: 'invalid JSON', detail: String(e.message || e) }, 400, origin, env);
  }

  const errors = validatePayload(payload);
  if (errors.length) {
    return json({ error: 'schema validation failed', errors }, 422, origin, env);
  }

  // Step 1: generate the DOCX. Reuses the exact same code path as
  // /generate so the document is byte-identical to what a DOCX
  // download would produce.
  let docxBuffer;
  const t0 = Date.now();
  try {
    docxBuffer = await generateDocx({ ...payload, _workerVersion: VERSION });
  } catch (e) {
    console.error('[docx-worker] DOCX generation failed in /generate-pdf', e, e.stack);
    return json({ error: 'docx_generation_failed', message: String(e.message || e) }, 500, origin, env);
  }
  const docxMs = Date.now() - t0;

  // Step 2: send to CloudConvert. Errors here are mapped to 502
  // (bad gateway from upstream) so the PWA can distinguish them
  // from local generation errors and fall back to client-side PDF.
  let pdfResult;
  try {
    pdfResult = await convertDocxToPdf(docxBuffer, env.CLOUDCONVERT_API_KEY, {
      filename: payload.filename || 'document',
    });
  } catch (e) {
    console.error('[docx-worker] CloudConvert PDF conversion failed', e);
    return json(
      {
        error: 'pdf_conversion_failed',
        message: String(e.message || e),
        provider,
        suggestion:
          'The PWA can fall back to client-side PDF (less visual fidelity but works offline). ' +
          'Check the worker logs for the upstream error.',
      },
      502,
      origin,
      env,
    );
  }

  const filename = sanitizeFilename(payload.filename || 'document') + '.pdf';
  console.log(
    `[docx-worker] /generate-pdf ok: docx ${docxMs}ms, pdf ${pdfResult.durationMs}ms, ` +
      `total ${Date.now() - t0}ms, jobId=${pdfResult.jobId}`,
  );

  const headers = {
    ...corsHeaders(origin, env),
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(pdfResult.buffer.length),
    'X-AntCV-Pdf-Provider': provider,
    'X-AntCV-Pdf-JobId': pdfResult.jobId,
    'X-AntCV-Docx-Ms': String(docxMs),
    'X-AntCV-Pdf-Ms': String(pdfResult.durationMs),
    'Access-Control-Expose-Headers': [
      'X-AntCV-Pdf-Provider',
      'X-AntCV-Pdf-JobId',
      'X-AntCV-Docx-Ms',
      'X-AntCV-Pdf-Ms',
      'Content-Disposition',
    ].join(', '),
  };

  return new Response(pdfResult.buffer, { status: 200, headers });
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────


function isAnalyticsExportPath(pathname) {
  return [
    '/analytics/export',
    '/export-analytics',
    '/analytics.csv',
    '/analytics.json',
  ].includes(pathname);
}

// ──────────────────────────────────────────────────────────────────
// P0-F: /api/jd/pdf-to-docx handler
// ──────────────────────────────────────────────────────────────────
// PWA-side: pwa/antcv-data-importer.js detects a PDF JD upload, POSTs
// the raw bytes here, then feeds the returned DOCX into the canonical
// DOCX table parser. If we return a non-2xx, the PWA falls back to
// the existing PDF text-extraction path with an audit-panel warning.
//
// Request:  application/pdf bytes in the body. Optional
//           X-AntCV-Filename header for nicer CloudConvert logs.
// Response: application/vnd.openxmlformats-officedocument.wordprocessingml.document
//           bytes on success. JSON error on failure.
async function handlePdfToDocx(request, origin, env) {
  if (env.WORKER_SECRET) {
    const presented = request.headers.get('X-AntCV-Secret') || '';
    if (presented !== env.WORKER_SECRET) {
      return json({ error: 'unauthorized' }, 401, origin, env);
    }
  }

  if (!env.CLOUDCONVERT_API_KEY || !String(env.CLOUDCONVERT_API_KEY).trim()) {
    return json(
      { error: 'cloudconvert_not_configured',
        message: 'CLOUDCONVERT_API_KEY is not set on this worker; PDF→DOCX normalisation unavailable.' },
      503, origin, env,
    );
  }

  // 30 MB cap — PDF JDs above that are pathological and a worker
  // memory risk. CloudConvert itself accepts up to 1 GB but the
  // worker's CPU budget gates much earlier.
  const PDF_BYTES_CAP = 30 * 1024 * 1024;
  let pdfBytes;
  try {
    const buf = await request.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
    if (pdfBytes.length === 0) {
      return json({ error: 'empty_body', message: 'PDF body is empty.' }, 400, origin, env);
    }
    if (pdfBytes.length > PDF_BYTES_CAP) {
      return json({ error: 'too_large',
                    message: 'PDF exceeds ' + PDF_BYTES_CAP + ' B cap.',
                    received: pdfBytes.length }, 413, origin, env);
    }
  } catch (e) {
    return json({ error: 'invalid_body', message: String(e && e.message || e) }, 400, origin, env);
  }

  // Sanity-check the first bytes — `%PDF-` is the canonical PDF
  // magic header. Reject anything that clearly isn't a PDF before
  // burning CloudConvert minutes on it.
  const head = String.fromCharCode(...pdfBytes.subarray(0, 5));
  if (head !== '%PDF-') {
    return json({ error: 'not_a_pdf',
                  message: 'Request body does not start with %PDF-; refusing CloudConvert call.',
                  head: head }, 415, origin, env);
  }

  const filename = (request.headers.get('X-AntCV-Filename') || 'jd').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64);

  try {
    const { buffer, jobId, durationMs } = await convertPdfToDocx(pdfBytes, env.CLOUDCONVERT_API_KEY, { filename });
    const respHeaders = corsHeaders(origin, env);
    respHeaders['Content-Type'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    respHeaders['Content-Disposition'] = 'attachment; filename="' + filename + '.docx"';
    respHeaders['X-AntCV-CloudConvert-Job'] = String(jobId);
    respHeaders['X-AntCV-CloudConvert-Duration-Ms'] = String(durationMs);
    return new Response(buffer, { status: 200, headers: respHeaders });
  } catch (e) {
    console.error('[docx-worker] pdf-to-docx failed', e);
    return json(
      { error: 'cloudconvert_failed',
        message: String(e && e.message || e),
        // The PWA reads this code to decide whether to fall back to
        // raw-PDF text extraction (with an audit warning).
        fallback: 'pdf_text_extraction',
      },
      502, origin, env,
    );
  }
}

async function handleAnalyticsExport(request, origin, env) {
  const url = new URL(request.url);
  const wantsCsv = url.pathname.endsWith('.csv') || /text\/csv/i.test(request.headers.get('Accept') || '');

  // Free-plan safe behaviour: export should not fail just because ANALYTICS KV
  // was not configured. Return an empty export with a clear status instead.
  if (!env.ANALYTICS || typeof env.ANALYTICS.list !== 'function') {
    if (wantsCsv) {
      return new Response('timestamp,event,path,status,detail\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="antcv-analytics-empty.csv"',
          'X-AntCV-Analytics': 'not-bound',
          'Cache-Control': 'no-store',
          ...corsHeaders(origin, env),
        },
      });
    }
    return json({ ok: true, analytics_bound: false, rows: [], note: 'ANALYTICS KV is not bound; returned empty export.' }, 200, origin, env);
  }

  const rows = [];
  let cursor;
  do {
    const page = await env.ANALYTICS.list({ prefix: 'event:', cursor });
    for (const key of page.keys || []) {
      const value = await env.ANALYTICS.get(key.name, 'json');
      if (value) rows.push(value);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  if (wantsCsv) {
    const header = 'timestamp,event,path,status,detail\n';
    const csv = header + rows.map(rowToCsv).join('');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="antcv-analytics.csv"',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin, env),
      },
    });
  }

  return json({ ok: true, analytics_bound: true, rows }, 200, origin, env);
}

function rowToCsv(row) {
  const cols = [row.timestamp, row.event, row.path, row.status, row.detail];
  return cols.map(csvCell).join(',') + '\n';
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function handleLogout(env) {
  // Hard reset flow:
  // 1) Clear anything stored on this Worker origin.
  // 2) Redirect the browser back to the Pages setup app with a reset signal.
  //
  // Note: a Worker on *.workers.dev cannot directly clear localStorage/IndexedDB
  // belonging to https://cv-generator-det.pages.dev. The Pages app must clear its
  // own local storage when it sees hardReset=1.
  const target = withHardResetParams(getSetupUrl(env));

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
      'Clear-Site-Data': '"cache", "cookies", "storage"',
      'Set-Cookie': [
        'antcv_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
        'antcv_auth=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
        'antcv_access=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
      ].join(', '),
    },
  });
}

function withHardResetParams(target) {
  const url = new URL(target);
  url.searchParams.set('hardReset', '1');
  url.searchParams.set('logout', '1');
  return url.toString();
}

function getSetupUrl(env) {
  const explicit = String(env.SETUP_URL || '').trim();
  if (explicit) return explicit;

  const firstAllowedOrigin = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .find(s => s && s !== '*');

  return firstAllowedOrigin || 'https://cv-generator-det.pages.dev';
}

function corsHeaders(origin, env) {
  const allowed = isAllowedOrigin(origin, env) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AntCV-Secret',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true; // same-origin / non-browser caller
  const list = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (list.length === 0) return true; // dev mode — open
  if (list.includes('*')) return true;
  return list.includes(origin);
}

function json(obj, status, origin, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
    },
  });
}

function sanitizeFilename(s) {
  return String(s || 'document')
    .replace(/[^a-zA-Z0-9æøåÆØÅ_\-.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'document';
}

function getSchemaDoc() {
  return {
    schema_version: '1.0',
    description:
      'AntCV DOCX generation request. Send a JSON body matching this schema to /generate. Response is a binary .docx file.',
    required_fields: ['schema_version', 'doc', 'personal_info', 'sections'],
    doc: { enum: ['cv', 'cl'], description: 'CV or cover letter' },
    language: { enum: ['en', 'da'], default: 'en' },
    layout: {
      enum: ['two_column', 'linear'],
      default: 'two_column',
      description: 'two_column = navy sidebar + main; linear = single-column (CL default)',
    },
    style: {
      object: 'palette and font tokens — all optional, sensible defaults',
      tokens: [
        'navy', 'accent', 'teal',
        'mainHeadColor', 'mainTextColor', 'mainBulletColor',
        'sidebarBg', 'sidebarHeadColor', 'sidebarTextColor',
        'headerBg', 'headerNameColor', 'headerSpecColor', 'headerContactColor',
        'photoBorderColor',
        'mainHeadFont', 'mainBodyFont', 'sidebarFont', 'headerFont',
      ],
    },
    font_sizes: {
      object: 'font sizes in pt',
      tokens: [
        'mainBody', 'mainHead', 'sbBody', 'sbHead',
        'nameSize', 'specialisation', 'contactSize',
        'expSubHead', 'bulletContent', 'mainTblH', 'mainTblCell',
      ],
    },
    personal_info: {
      name: 'string',
      email: 'string',
      phone: 'string',
      location: 'string',
      website: 'string',
      linkedin: 'string',
      photo_b64: 'optional base64 PNG/JPG, max ~1.1MB decoded',
    },
    meta: {
      subtitle: 'string — specialisation line (CV) or application line (CL)',
      role: 'string — used for filename',
      company: 'string — used for filename',
    },
    sections: {
      type: 'array',
      element_shape: {
        id: 'string',
        title: 'string',
        loc: { enum: ['main', 'sidebar'] },
        on: 'boolean — false hides the section',
        type: { enum: [
          'text', 'text_inline', 'text_bullets', 'foundation',
          'bullets', 'table', 'experience',
          'list', 'list_italic', 'labeled_list', 'education',
        ]},
        '...content fields': 'depend on type — see frontend integration helper',
      },
    },
    filename: 'string — without .docx extension; will be sanitized',
  };
}
