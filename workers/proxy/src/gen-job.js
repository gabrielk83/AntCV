// gen-job.js — resumable, backgrounding-survivable generation jobs (GEN-BACKGROUND-001, Option A)
// =================================================================================================
//
// WHY
// ---
// Generation used to run as a client-side streaming fetch PER SECTION in the foreground
// browser tab. On mobile, backgrounding the tab (a call, a notification, screen lock)
// throttles/kills the in-flight stream and the whole run is lost — the user has to start
// over. See docs/qa/GEN-BACKGROUND-001.md.
//
// WHAT THIS DOES
// --------------
// Moves the multi-section run behind a KV-backed JOB. The client submits the section plan
// once (/job/create -> job_id), then advances the job ONE SECTION PER SHORT REQUEST
// (/job/step). Every completed section is checkpointed to KV the instant it returns, so
// backgrounding can never lose finished work: on return the client GETs the job, renders
// the already-done sections, and resumes from `next`. No Durable Objects; no single
// long-running invocation (which Workers can't do for 3-6 min).
//
// REUSE, DON'T REIMPLEMENT
// ------------------------
// stepJob does NOT re-implement augmentation / provider dispatch. It builds the exact
// synthetic per-section Request the client would have sent and calls the proxy's existing
// `handleRequest(req, env)` (injected as `runSection`), then drains the response to a
// string. Output is therefore byte-identical to the legacy per-section path and inherits
// prompt-augment, injection-defense, provider handling, and demo-budget accounting.
//
// STORAGE
// -------
// KV namespace `CV_PROXY_DATA` (already bound). One key per job: `job:{job_id}`, JSON
// envelope, expirationTtl refreshed on every write (default 1h). Envelope is small (text),
// well under KV's 25 MB value cap.
//
// PARITY
// ------
// workers/demo-proxy/src carries a byte-identical copy. Any change here must be mirrored
// there and both deployed separately via CI (worker parity rule).

const JOB_PREFIX = 'job:';
const JOB_TTL_SECONDS = 3600;          // 1h; refreshed on each write
const MAX_SECTION_ATTEMPTS = 3;        // per-section retry budget on 5xx
const MAX_SECTIONS = 40;               // sanity cap on a single job's plan
const ENVELOPE_VERSION = 1;

function nowMs() { return Date.now(); }

function jsonResponse(obj, status, CORS) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS || {}),
  });
}

function uuid() {
  // crypto.randomUUID is available in the Workers runtime.
  try { return crypto.randomUUID(); } catch (_) {
    return 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

function kvKey(jobId) { return JOB_PREFIX + jobId; }

async function readJob(env, jobId) {
  if (!env || !env.CV_PROXY_DATA) return null;
  const raw = await env.CV_PROXY_DATA.get(kvKey(jobId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function writeJob(env, job) {
  job.updated_at = nowMs();
  await env.CV_PROXY_DATA.put(kvKey(job.job_id), JSON.stringify(job), {
    expirationTtl: JOB_TTL_SECONDS,
  });
  return job;
}

// Owner scoping: prefer the verified JWT identity if present; otherwise an opaque "anon"
// marker. Jobs are only readable/advanceable by the same owner string. `identityFn` is the
// proxy's identityFromBearer (injected) so we don't duplicate JWT logic.
async function ownerOf(request, env, identityFn) {
  try {
    if (typeof identityFn === 'function') {
      const id = await identityFn(request, env);
      if (id && (id.sub || id.email)) return 'u:' + (id.sub || id.email);
    }
  } catch (_) {}
  return 'anon';
}

// ---------------------------------------------------------------------------
// POST /job/create  { sections:[{id,title,prompt,headers?}], provider, model, meta }
// ---------------------------------------------------------------------------
export async function createJob(request, env, CORS, identityFn) {
  let body;
  try { body = await request.json(); } catch (_) {
    return jsonResponse({ error: 'bad_json' }, 400, CORS);
  }
  const sections = Array.isArray(body.sections) ? body.sections : null;
  if (!sections || sections.length === 0) {
    return jsonResponse({ error: 'no_sections', message: 'sections[] required' }, 400, CORS);
  }
  if (sections.length > MAX_SECTIONS) {
    return jsonResponse({ error: 'too_many_sections', message: 'max ' + MAX_SECTIONS }, 400, CORS);
  }
  if (!env || !env.CV_PROXY_DATA) {
    return jsonResponse({ error: 'kv_unbound', message: 'CV_PROXY_DATA not bound' }, 503, CORS);
  }

  const owner = await ownerOf(request, env, identityFn);
  const job = {
    v: ENVELOPE_VERSION,
    job_id: uuid(),
    created_at: nowMs(),
    updated_at: nowMs(),
    status: 'pending',
    owner,
    provider: (body.provider || 'anthropic').toLowerCase(),
    model: body.model || null,
    meta: body.meta || {},
    sections: sections.map((s, i) => ({
      id: s.id || ('section-' + i),
      title: s.title || s.id || ('Section ' + (i + 1)),
      state: 'pending',
      prompt: s.prompt || null,        // the per-section /v1/messages JSON body
      headers: s.headers || null,      // optional per-section headers (e.g. x-gemini-model)
      result: null,
      error: null,
      attempts: 0,
      usage: null,
    })),
    next: 0,
    totals: { input_tokens: 0, output_tokens: 0 },
  };
  await writeJob(env, job);
  return jsonResponse({ job_id: job.job_id, status: job.status, sections: job.sections.length }, 200, CORS);
}

// Drain a handleRequest Response (SSE stream OR plain JSON) into { text, usage }.
// Mirrors the client reader (app.src.js ~L1198): accumulate Anthropic
// content_block_delta/text_delta; for a JSON body, pull the text out of the
// provider-shaped response.
async function drainSectionResponse(resp, provider) {
  const ctype = (resp.headers.get('content-type') || '').toLowerCase();
  let text = '';
  let usage = null;

  if (ctype.includes('event-stream') || ctype.includes('text/')) {
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '' || payload === '[DONE]') continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
            text += ev.delta.text || '';
          } else if (ev.type === 'error') {
            throw new Error((ev.error && ev.error.message) || 'streaming error');
          } else if (ev.type === 'message_delta' && ev.usage) {
            usage = Object.assign(usage || {}, ev.usage);
          } else if (ev.type === 'message_start' && ev.message && ev.message.usage) {
            usage = Object.assign(usage || {}, ev.message.usage);
          }
        } catch (e) {
          if (e && e.message && e.message.includes('streaming error')) throw e;
          // ignore unparseable keepalive lines
        }
      }
    }
    return { text, usage };
  }

  // Non-stream JSON body — provider-shaped.
  const raw = await resp.text();
  let obj = null;
  try { obj = JSON.parse(raw); } catch (_) { return { text: raw, usage: null }; }
  // Anthropic /v1/messages: { content:[{type:'text',text}], usage:{input_tokens,output_tokens} }
  if (Array.isArray(obj.content)) {
    text = obj.content.filter(b => b && b.type === 'text').map(b => b.text).join('');
    usage = obj.usage || null;
  } else if (obj.choices && obj.choices[0]) {
    // OpenAI/Mistral chat: { choices:[{message:{content}}], usage }
    const m = obj.choices[0].message || obj.choices[0].delta || {};
    text = m.content || '';
    usage = obj.usage || null;
  } else if (obj.candidates && obj.candidates[0]) {
    // Gemini: { candidates:[{content:{parts:[{text}]}}], usageMetadata }
    const parts = (obj.candidates[0].content && obj.candidates[0].content.parts) || [];
    text = parts.map(p => p.text || '').join('');
    usage = obj.usageMetadata || null;
  } else if (typeof obj.error !== 'undefined') {
    throw new Error((obj.error && obj.error.message) || obj.error || 'provider error');
  }
  return { text, usage };
}

function addUsage(totals, usage) {
  if (!usage) return;
  const inTok = usage.input_tokens || usage.prompt_tokens || (usage.promptTokenCount) || 0;
  const outTok = usage.output_tokens || usage.completion_tokens || (usage.candidatesTokenCount) || 0;
  totals.input_tokens += (typeof inTok === 'number' ? inTok : 0);
  totals.output_tokens += (typeof outTok === 'number' ? outTok : 0);
}

// ---------------------------------------------------------------------------
// POST /job/step  { job_id }
// Advances exactly one pending section. Short-lived. Idempotent on terminal jobs.
// `runSection(syntheticRequest, env)` is the proxy's handleRequest, injected.
// `selfOrigin` is the worker's own origin for the synthetic Request URL.
// ---------------------------------------------------------------------------
export async function stepJob(request, env, CORS, runSection, identityFn, selfOrigin) {
  let body;
  try { body = await request.json(); } catch (_) {
    return jsonResponse({ error: 'bad_json' }, 400, CORS);
  }
  const jobId = body && body.job_id;
  if (!jobId) return jsonResponse({ error: 'no_job_id' }, 400, CORS);

  const job = await readJob(env, jobId);
  if (!job) return jsonResponse({ error: 'not_found' }, 404, CORS);

  const owner = await ownerOf(request, env, identityFn);
  if (job.owner !== owner) return jsonResponse({ error: 'forbidden' }, 403, CORS);

  // Terminal -> return as-is (idempotent).
  if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
    return jsonResponse(publicView(job), 200, CORS);
  }

  // Find the next pending section.
  if (job.next >= job.sections.length) {
    job.status = 'done';
    await writeJob(env, job);
    return jsonResponse(publicView(job), 200, CORS);
  }
  const sec = job.sections[job.next];

  // Mark running + persist so a concurrent GET shows progress.
  job.status = 'running';
  sec.state = 'running';
  await writeJob(env, job);

  // Build the synthetic per-section request = exactly what the client would POST.
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('x-provider', job.provider);
  if (sec.headers && typeof sec.headers === 'object') {
    for (const k in sec.headers) {
      if (Object.prototype.hasOwnProperty.call(sec.headers, k)) headers.set(k, String(sec.headers[k]));
    }
  }
  // Carry the caller's Authorization so demo/BYOK auth + budget accounting are unchanged.
  const auth = request.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) headers.set('x-api-key', apiKey);

  const url = (selfOrigin || 'https://cv-proxy.internal') + '/v1/messages';
  const synthetic = new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(sec.prompt || {}),
  });

  let resp;
  try {
    resp = await runSection(synthetic, env);
  } catch (e) {
    return finishSectionError(env, job, sec, CORS, 'run_threw: ' + (e && e.message ? e.message : String(e)));
  }

  // Provider 5xx -> transient: do NOT advance; retry this same section next /step.
  if (resp && resp.status >= 500) {
    sec.attempts = (sec.attempts || 0) + 1;
    let upstream = '';
    try { upstream = (await resp.clone().text()).slice(0, 300); } catch (_) {}
    if (sec.attempts >= MAX_SECTION_ATTEMPTS) {
      return finishSectionError(env, job, sec, CORS,
        'provider_5xx_after_' + sec.attempts + '_attempts: ' + upstream);
    }
    sec.state = 'pending';                 // leave pending; client/driver will re-step
    job.status = 'running';
    await writeJob(env, job);
    return jsonResponse(publicView(job, { retrying: sec.id, attempt: sec.attempts }), 200, CORS);
  }

  // 4xx -> permanent for this section (bad prompt etc.): record + fail the job.
  if (resp && resp.status >= 400) {
    let upstream = '';
    try { upstream = (await resp.clone().text()).slice(0, 300); } catch (_) {}
    return finishSectionError(env, job, sec, CORS, 'http_' + resp.status + ': ' + upstream);
  }

  // 2xx -> collect.
  let drained;
  try {
    drained = await drainSectionResponse(resp, job.provider);
  } catch (e) {
    sec.attempts = (sec.attempts || 0) + 1;
    if (sec.attempts >= MAX_SECTION_ATTEMPTS) {
      return finishSectionError(env, job, sec, CORS, 'drain_failed: ' + (e && e.message ? e.message : String(e)));
    }
    sec.state = 'pending';
    await writeJob(env, job);
    return jsonResponse(publicView(job, { retrying: sec.id, attempt: sec.attempts }), 200, CORS);
  }

  sec.result = drained.text || '';
  sec.usage = drained.usage || null;
  sec.state = 'done';
  sec.error = null;
  addUsage(job.totals, drained.usage);
  job.next += 1;
  job.status = (job.next >= job.sections.length) ? 'done' : 'running';
  await writeJob(env, job);
  return jsonResponse(publicView(job), 200, CORS);
}

async function finishSectionError(env, job, sec, CORS, msg) {
  sec.state = 'error';
  sec.error = msg;
  job.status = 'error';
  await writeJob(env, job);
  return jsonResponse(publicView(job), 200, CORS);
}

// ---------------------------------------------------------------------------
// GET /job/{job_id}  (status / resume)
// ---------------------------------------------------------------------------
export async function getJob(request, env, CORS, identityFn, jobId) {
  if (!jobId) return jsonResponse({ error: 'no_job_id' }, 400, CORS);
  const job = await readJob(env, jobId);
  if (!job) return jsonResponse({ error: 'not_found' }, 404, CORS);
  const owner = await ownerOf(request, env, identityFn);
  if (job.owner !== owner) return jsonResponse({ error: 'forbidden' }, 403, CORS);
  return jsonResponse(publicView(job), 200, CORS);
}

// ---------------------------------------------------------------------------
// POST /job/cancel  { job_id }
// ---------------------------------------------------------------------------
export async function cancelJob(request, env, CORS, identityFn) {
  let body;
  try { body = await request.json(); } catch (_) {
    return jsonResponse({ error: 'bad_json' }, 400, CORS);
  }
  const jobId = body && body.job_id;
  if (!jobId) return jsonResponse({ error: 'no_job_id' }, 400, CORS);
  const job = await readJob(env, jobId);
  if (!job) return jsonResponse({ error: 'not_found' }, 404, CORS);
  const owner = await ownerOf(request, env, identityFn);
  if (job.owner !== owner) return jsonResponse({ error: 'forbidden' }, 403, CORS);
  if (job.status !== 'done' && job.status !== 'error') {
    job.status = 'cancelled';
    await writeJob(env, job);
  }
  return jsonResponse(publicView(job), 200, CORS);
}

// publicView — what the client gets back. Includes per-section state + result (so the
// client can render done sections), but never the raw prompts (smaller payloads, and the
// client already has them).
function publicView(job, extra) {
  const view = {
    job_id: job.job_id,
    status: job.status,
    next: job.next,
    created_at: job.created_at,
    updated_at: job.updated_at,
    provider: job.provider,
    model: job.model,
    totals: job.totals,
    sections: job.sections.map(s => ({
      id: s.id,
      title: s.title,
      state: s.state,
      result: s.result,
      error: s.error,
      attempts: s.attempts || 0,
    })),
  };
  if (extra && typeof extra === 'object') view.note = extra;
  return view;
}

// Router helper: returns true if this path is a /job/* route, and dispatches.
// Wire this into proxy/src/index.js near the other url.pathname checks, BEFORE the generic
// /v1/messages handling. `deps` = { runSection: handleRequest, identityFn: identityFromBearer }.
export async function handleJobRoute(request, env, CORS, deps) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const selfOrigin = url.origin;
  const idFn = deps && deps.identityFn;
  const runSection = deps && deps.runSection;

  // GET /job/{id}
  const getMatch = path.match(/\/job\/([^/]+)$/);
  if (request.method === 'GET' && getMatch && getMatch[1] !== 'create' && getMatch[1] !== 'step' && getMatch[1] !== 'cancel') {
    return getJob(request, env, CORS, idFn, decodeURIComponent(getMatch[1]));
  }
  if (request.method === 'POST' && /\/job\/create$/.test(path)) {
    return createJob(request, env, CORS, idFn);
  }
  if (request.method === 'POST' && /\/job\/step$/.test(path)) {
    return stepJob(request, env, CORS, runSection, idFn, selfOrigin);
  }
  if (request.method === 'POST' && /\/job\/cancel$/.test(path)) {
    return cancelJob(request, env, CORS, idFn);
  }
  return null; // not a /job route
}
