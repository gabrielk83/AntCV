const VERSION='3.4.0-model-chain-fallback';
// Cloudflare Worker — multi-provider LLM proxy with streaming for Anthropic
// Includes /preferences route for AntCV cloud save.
//
// v1.5.0: prompt-augmentation middleware that detects CV/CL generation
// tasks (cv_profile, cv_core_competencies, cv_outcomes, cl_what_i_bring,
// cl_who_i_am, cl_why_this_position, cl_how_i_would_contribute,
// cl_foundation, cl_general) and prepends task-specific guidance plus
// an anti-fabrication block to the system prompt before the request
// reaches the LLM provider. See ./prompt-augment.js.
//
// v1.6.0: POST /api/jd-analysis endpoint — extracts recruiter info,
// JD questions, role/company signals, and suggested answers grounded
// in the candidate's CV summary (or placeholders when ungrounded).
// See ./jd-analysis.js.
//
// v1.6.1: clearance/eligibility added to anti-fabrication worked
// examples — catches FE/NATO/citizenship hallucinations alongside
// domain/technology hallucinations.
//
// v1.7.0: POST /api/supervisor/check endpoint — two-stage validation
// of LLM output: static checks (banned phrases, placeholder content,
// format heuristics) + LLM grounding check (claims-not-in-source).
// Returns score, deviations, repair prompt, optional auto-repair.
// Logs every check to ANALYTICS KV for later analytics download.
// See ./supervisor.js.

import { augmentBodyText } from './prompt-augment.js';
import { handleJDAnalysis } from './jd-analysis.js';
import { handleKernelExtraction } from './kernel-extraction.js';
import { handleFetchJdUrl } from './fetch-jd-url.js';
import { handleSupervisorCheck } from './supervisor.js';
import { buildExport as buildAnalyticsExport } from './analytics-export.js';
import { identityFromBearer } from './jwt-verify.js';
import {
  isDemoMode,
  preflight as demoPreflight,
  trackUsage as demoTrackUsage,
  getDemoUsage,
  getCapUsd,
  getCapForUser,
  demoHeaders,
} from './demo-enforcement.js';
import {
  sanitizeUserContent,
  INJECTION_DEFENSE_PREAMBLE,
} from './prompt-injection-defense.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env || {});
  }
};

async function getKey(env, names) {
  if (!env) return '';
  for (const n of names) {
    const v = env[n];
    if (typeof v === 'string' && v.length > 0) return v;
    if (v && typeof v.get === 'function') {
      try {
        const secret = await v.get();
        if (typeof secret === 'string' && secret.length > 0) return secret;
      } catch (e) {
        console.warn(`[secrets] Failed reading ${n}:`, e.message);
      }
    }
  }
  return '';
}


function cleanClientKey(value, provider) {
  const v = String(value || '').trim();
  if (!v) return '';
  const low = v.toLowerCase();
  // The PWA may send placeholders when it intends to use server-side Worker secrets.
  // Treat them as absent so env secrets are used.
  if (['server','server-key','worker','worker-secret','__server__','null','undefined','false','true','[object object]'].includes(low)) return '';
  if (provider === 'anthropic' && !v.startsWith('sk-ant-')) return '';
  if (provider === 'openai' && !v.startsWith('sk-')) return '';
  return v;
}

async function serverKeyFor(env, provider) {
  const p = (provider || 'anthropic').toLowerCase();
  if (p === 'openai')  return await getKey(env, ['OPENAI_API_KEY', 'OpenAI_API_Key', 'OpenAI_APIKEY', 'ChatGPT_API_Key', 'CHATGPT_API_KEY']);
  if (p === 'mistral') return await getKey(env, ['Mistral_API_Key', 'MISTRAL_API_KEY', 'MISTRAL_KEY']);
  if (p === 'gemini')  return await getKey(env, ['Gemini_API_Key', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']);
  return await getKey(env, ['ANTHROPIC_API_KEY', 'Anthropic_API_Key', 'Claude_API_Key', 'CLAUDE_API_KEY']);
}

async function serverKeyAvailability(env) {
  return {
    anthropic: !!(await serverKeyFor(env, 'anthropic')),
    openai:    !!(await serverKeyFor(env, 'openai')),
    mistral:   !!(await serverKeyFor(env, 'mistral')),
    gemini:    !!(await serverKeyFor(env, 'gemini')),
  };
}

function parseAllowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  const fromEnv = raw.split(',').map(s => s.trim()).filter(Boolean);
  // Built-in defaults so the production PWA + standard dev ports
  // always work, even when ALLOWED_ORIGINS env var isn't set. Without
  // this, the user's first deploy of cv-proxy returns CORS responses
  // with Allow-Origin:* and NO Allow-Credentials, which the browser
  // refuses for credentialed fetches (jd-analysis, supervisor/check).
  const defaults = [
    'https://cv-generator-det.pages.dev',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:8788',
  ];
  // De-dupe while preserving env-var precedence.
  const merged = [...fromEnv];
  for (const d of defaults) if (!merged.includes(d)) merged.push(d);
  return merged;
}

// True if origin matches a built-in safe wildcard pattern. Used as
// an escape hatch for origins not explicitly allow-listed but that
// follow a recognisable PWA-deploy shape (Cloudflare Pages preview
// URLs all share a *.cv-generator-det.pages.dev pattern).
function isWildcardSafeOrigin(origin) {
  if (!origin) return false;
  // Cloudflare Pages preview deploys: <hash>.cv-generator-det.pages.dev
  if (/^https:\/\/[a-z0-9-]+\.cv-generator-det\.pages\.dev$/i.test(origin)) return true;
  // Generic Cloudflare Pages domains (deploy preview)
  if (/^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin)) return true;
  return false;
}

function corsHeadersFor(request, env, extraAllowHeaders = '') {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseAllowedOrigins(env);
  let allowOrigin;
  let credentialed = false;
  if (allowed.includes(origin)) {
    allowOrigin = origin;
    credentialed = true;
  } else if (isWildcardSafeOrigin(origin)) {
    allowOrigin = origin;
    credentialed = true;
  } else if (allowed.length === 0) {
    // Should be unreachable now that parseAllowedOrigins returns
    // built-in defaults, but kept as a final safety net.
    console.warn('[cors] No allowed origins resolved — falling back to "*".');
    allowOrigin = '*';
  } else {
    // Origin doesn't match. Echo first allowed entry so simple
    // (non-credentialed) requests still work, but the browser will
    // block credentialed ones — which is correct behavior for an
    // unknown origin.
    allowOrigin = allowed[0];
  }
  const baseHeaders = 'Content-Type, Authorization';
  const allowHeaders = extraAllowHeaders ? `${baseHeaders}, ${extraAllowHeaders}` : baseHeaders;
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
    'Vary': 'Origin',
  };
  if (credentialed) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

// Wrap an upstream provider error with actionable context. Without
// this, a user seeing "OpenAI 401: Incorrect API key" cannot tell:
//   - whether the cv-proxy's server-side key (set via wrangler
//     secret) is bad, OR
//   - whether the PWA-sent client key (x-api-key header) is bad
// Both are valid configurations and the fix is different. The
// wrapped response makes the source explicit and includes the exact
// command to update each.
function wrapUpstreamError(provider, upstreamStatus, upstreamBodyText, keySource) {
  let upstreamError;
  try { upstreamError = JSON.parse(upstreamBodyText); }
  catch { upstreamError = upstreamBodyText && upstreamBodyText.slice(0, 500); }

  const upstreamMsg =
    (upstreamError && upstreamError.error && upstreamError.error.message) ||
    (typeof upstreamError === 'string' ? upstreamError : JSON.stringify(upstreamError).slice(0, 200));

  // Per-provider, per-status hint text.
  let hint = '';
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    if (keySource === 'client') {
      hint = `The API key the PWA sent for ${provider} was rejected. ` +
             `Open the PWA's LLM settings and re-enter your ${provider} key. ` +
             `If the key is freshly issued, allow a minute for activation.`;
    } else {
      const secretCmd = {
        openai:    'npx wrangler secret put OPENAI_API_KEY',
        anthropic: 'npx wrangler secret put ANTHROPIC_API_KEY',
        mistral:   'npx wrangler secret put MISTRAL_API_KEY',
        gemini:    'npx wrangler secret put GEMINI_API_KEY',
      }[provider] || `npx wrangler secret put ${provider.toUpperCase()}_API_KEY`;
      hint = `The ${provider} key configured on cv-proxy is invalid, revoked, or out of credit. ` +
             `Update it with:\n    ${secretCmd}\n` +
             `Then redeploy cv-proxy. The user-facing PWA key was NOT used for this request.`;
    }
  } else if (upstreamStatus === 429) {
    hint = keySource === 'client'
      ? `Your ${provider} account is rate-limited. Wait a minute, switch to a different LLM via the PWA's dispatcher, or upgrade the account tier.`
      : `cv-proxy's ${provider} key is rate-limited. Either wait, switch the active provider in the PWA, or upgrade the account tier.`;
  } else if (upstreamStatus === 400) {
    // Detect token-limit-exceeded errors across providers. Gemini
    // says "input token count exceeds the maximum"; Anthropic says
    // "prompt is too long"; OpenAI says "context length" / "maximum
    // context length"; Mistral says "tokens limit"/"context_length_exceeded".
    // All are 400s that mean: the input is bigger than the model can
    // accept, and switching providers may help (different limits) or
    // shrinking the input definitely will.
    const lcMsg = (upstreamMsg || '').toLowerCase();
    const isTokenLimit =
      lcMsg.includes('token count exceeds') ||
      lcMsg.includes('exceeds the maximum') ||
      lcMsg.includes('prompt is too long') ||
      lcMsg.includes('context length') ||
      lcMsg.includes('context_length_exceeded') ||
      lcMsg.includes('maximum context length') ||
      lcMsg.includes('tokens limit') ||
      lcMsg.includes('input is too long');
    if (isTokenLimit) {
      // Provider-specific context window sizes for the actionable
      // suggestion. Numbers conservative — actual tier limits vary.
      const limits = {
        gemini:    'Gemini 1.5 Pro:  ~1,048,576 tokens',
        anthropic: 'Claude 3.5/4:    ~200,000 tokens',
        openai:    'GPT-4 / GPT-4o:  ~128,000 tokens',
        mistral:   'Mistral Large:   ~128,000 tokens',
      };
      const others = Object.entries(limits)
        .filter(([k]) => k !== provider)
        .map(([k, v]) => `  - ${k}: ${v}`)
        .join('\n');
      hint =
        `The input exceeded ${provider}'s token limit. This usually means a PDF or document is too large after text extraction.\n\n` +
        `Quick fixes:\n` +
        `  1. If this is a JD upload: paste the JD text directly into the JD textarea instead of uploading a PDF. Most JDs are <2K tokens as text but >100K when the PWA sends the full PDF.\n` +
        `  2. If this is a CV upload: split the CV into shorter chunks, or upload the .docx instead of a multi-megabyte scanned PDF.\n` +
        `  3. Check whether the file you uploaded is actually the document you meant — a 10MB PDF is rarely a 1-page JD.\n\n` +
        `Other providers' context windows (switch via the PWA's LLM dispatcher):\n${others}`;
    } else {
      hint = `The request was malformed before it reached the LLM. Check the model name (some providers have renamed models) and message structure. Upstream said: ${upstreamMsg.slice(0, 200)}`;
    }
  } else if (upstreamStatus === 413) {
    hint = `Payload too large. The PWA sent ${provider} more data than its endpoint accepts. ` +
           `Reduce the input size (smaller PDF, paste text instead, or shorter chat history) or switch providers.`;
  } else if (upstreamStatus >= 500) {
    hint = `${provider} returned a server error. This is upstream and usually transient — retry, or switch to another provider via the PWA's dispatcher.`;
  } else {
    hint = `Upstream returned status ${upstreamStatus}. See upstream_error for details.`;
  }

  return JSON.stringify({
    error: `${provider} returned ${upstreamStatus}`,
    provider,
    upstream_status: upstreamStatus,
    upstream_error: upstreamMsg,
    key_source: keySource,
    hint,
  });
}

// Convert an Anthropic-shaped body (top-level `system: string`) to
// OpenAI/Mistral-shaped messages (system as messages[0] with
// role: 'system'). Anthropic accepts a top-level `system` field;
// OpenAI rejects with 400 "Unknown parameter: 'system'"; Mistral
// silently drops it.
//
// This is needed because the PWA sends in Anthropic format and the
// prompt-augment middleware adds/extends `body.system`, so when we
// proxy that body to an OpenAI-style endpoint we MUST translate the
// system field rather than forward it or delete it.
//
// Edge cases:
//   - If messages[0] is already role:'system', merge our system text
//     into the front of it (don't duplicate the system slot).
//   - If body.system is empty string or whitespace, just remove it.
//   - If body has no messages array, leave it alone (something else
//     is wrong; let the upstream return its real error).
// Heuristic: scan a parsed-body's prompt content to decide whether
// the caller wants the model to return strict JSON. Many of the
// PWA's tasks (apply_correction, fuse, analyze_fit) already include
// directives like "Return ONLY valid JSON" or "MUST start with the
// character '{'" — but ~30-50% of LLM calls drift into prose anyway
// because Markdown is a strong default behavior. Forcing JSON mode
// on the providers that support it removes the drift entirely.
//
// Signals (any one matches):
//   1. "Return ONLY (valid) JSON" — most common directive
//   2. "JSON only" or "valid JSON only"
//   3. "JSON in the specified shape" — the PWA's apply_correction phrasing
//   4. Explicit "MUST start with the character '{'" — the PWA's
//      stricter-prompt retry suffix
//   5. "valid JSON object … no prose" or "no prose … valid JSON"
//
// We do NOT match every mention of "json" — many non-JSON prompts
// reference JSON in the context of input data. The signals above
// are specifically directives about OUTPUT format.
export function wantsJsonMode(body) {
  if (!body || typeof body !== 'object') return false;
  const texts = [];
  if (typeof body.system === 'string') texts.push(body.system);
  if (Array.isArray(body.messages)) {
    for (const m of body.messages) {
      if (!m) continue;
      if (m.role === 'system' || m.role === 'user') {
        if (typeof m.content === 'string') texts.push(m.content);
        else if (Array.isArray(m.content)) {
          for (const b of m.content) {
            if (b && b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
          }
        }
      }
    }
  }
  if (Array.isArray(body.contents)) {
    for (const c of body.contents) {
      if (c && Array.isArray(c.parts)) {
        for (const p of c.parts) {
          if (p && typeof p.text === 'string') texts.push(p.text);
        }
      }
    }
  }
  if (body.systemInstruction) {
    const si = body.systemInstruction;
    if (typeof si === 'string') texts.push(si);
    else if (si.parts) {
      for (const p of si.parts) {
        if (p && typeof p.text === 'string') texts.push(p.text);
      }
    }
  }
  const joined = texts.join('\n').toLowerCase();
  return /\breturn\s+only\s+(valid\s+)?json\b/.test(joined) ||
         /\bonly\s+(a\s+)?valid\s+json\b/.test(joined) ||
         /\bjson\s+only\b/.test(joined) ||
         /\bjson\s+in\s+the\s+specified\s+shape\b/.test(joined) ||
         /must\s+start\s+with\s+the\s+character\s+["']\{/.test(joined) ||
         /\bvalid\s+json\s+object\b.*\bno\s+prose\b/.test(joined) ||
         /\bno\s+prose\b.*\bvalid\s+json\b/.test(joined);
}

export function liftSystemIntoMessages(body) {
  if (!body || typeof body !== 'object') return body;
  const sys = body.system;
  if (typeof sys !== 'string' || sys.trim().length === 0) {
    if ('system' in body) delete body.system;
    return body;
  }
  if (!Array.isArray(body.messages)) {
    delete body.system;
    return body;
  }
  const existing = body.messages[0];
  if (existing && existing.role === 'system') {
    // Merge: prepend the lifted system into the existing one with a
    // separator. The lifted system is the augmentation, which should
    // sit BEFORE the caller's own system content.
    const existingContent = typeof existing.content === 'string'
      ? existing.content
      : (Array.isArray(existing.content)
          ? existing.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n')
          : '');
    body.messages = [
      { role: 'system', content: sys + (existingContent ? '\n\n' + existingContent : '') },
      ...body.messages.slice(1),
    ];
  } else {
    body.messages = [{ role: 'system', content: sys }, ...body.messages];
  }
  delete body.system;
  return body;
}


// =================================================================
//  Per-provider image-block translation
//
//  The PWA sends multimodal messages in Anthropic's content-block
//  format. Other providers need different shapes — without this
//  translation, vision-mode PDF extraction (the `long_context` task
//  rendering pages as base64 images) fails on OpenAI with:
//      400 "Invalid value: 'image'. Supported values are: 'text',
//      'image_url', 'input_audio', 'refusal', 'audio'"
//  and similar on Mistral.
//
//  Block shapes:
//    Anthropic:  { type: "image",     source: { type: "base64", media_type, data } }
//                { type: "image",     source: { type: "url",    url }              }
//    OpenAI:     { type: "image_url", image_url: { url: "data:...;base64,..." } }
//    Mistral:    { type: "image_url", image_url: "data:...;base64,..." }   ← string
//
//  `provider` arg controls the output shape ("openai" or "mistral").
//  Anthropic-bound messages don't need translation — pass through.
// =================================================================
export function translateContentBlocksForProvider(content, provider) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content;
  const useObjectImageUrl = provider === 'openai';
  const parts = [];
  for (const block of content) {
    if (!block) continue;
    if (typeof block === 'string') {
      parts.push({ type: 'text', text: block });
      continue;
    }
    if (block.type === 'text') {
      parts.push({ type: 'text', text: String(block.text || '') });
      continue;
    }
    // Anthropic-style image — translate to provider's image_url shape.
    if (block.type === 'image' && block.source) {
      const src = block.source;
      let dataUrl = null;
      if (src.type === 'base64' && src.data && src.media_type) {
        dataUrl = `data:${src.media_type};base64,${src.data}`;
      } else if (src.type === 'url' && src.url) {
        dataUrl = src.url;
      }
      if (dataUrl) {
        parts.push({
          type: 'image_url',
          image_url: useObjectImageUrl ? { url: dataUrl } : dataUrl,
        });
        continue;
      }
      // Image block without a usable source — skip rather than poison
      // the request (an unparseable block would cause a 400 anyway).
      continue;
    }
    // Already in OpenAI/Mistral shape — normalise between string and
    // object forms so the right one is sent for the target provider.
    if (block.type === 'image_url') {
      let url = null;
      if (typeof block.image_url === 'string') url = block.image_url;
      else if (block.image_url && typeof block.image_url === 'object' && block.image_url.url) url = block.image_url.url;
      if (url) {
        parts.push({
          type: 'image_url',
          image_url: useObjectImageUrl ? { url } : url,
        });
        continue;
      }
    }
    // Unknown block type — skip silently. We prefer dropping unknown
    // content over forwarding it and getting a hostile upstream error.
  }
  // Collapse to a plain string when only a single text block remains —
  // text-only chat completions accept this shape and it's a smaller
  // payload to forward.
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
  return parts;
}

// Wrap the per-block translator for whole-message arrays.
export function translateMessagesForProvider(messages, provider) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((m) => {
    if (!m || !m.content) return m;
    return { ...m, content: translateContentBlocksForProvider(m.content, provider) };
  });
}


async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';  // Public health check. This must run before any method/provider checks.
  // Accepts GET/HEAD/OPTIONS and path variants used by Cloudflare Access rules.
  if (path === '/health' || path === '/__health' || path.endsWith('/health')) {
    const headers = { 'Content-Type': 'application/json', ...corsHeadersFor(request, env) };
    if (request.method === 'OPTIONS' || request.method === 'HEAD') {
      return new Response(null, { status: 204, headers });
    }
    return new Response(JSON.stringify({ ok: true, service: 'cv-proxy', version: VERSION, path: url.pathname }), {
      status: 200,
      headers,
    });
  }

  if (url.pathname.endsWith('/analytics') || url.pathname.endsWith('/analytics/')) {
    return handleAnalytics(request, env);
  }
  if (url.pathname.includes('/analytics/export')) {
    return handleAnalyticsExport(request, env);
  }
  if (url.pathname.includes('/analytics/summary')) {
    return handleAnalyticsSummary(request, env);
  }
  if (url.pathname.endsWith('/me') || url.pathname.endsWith('/me/')) {
    return handleMe(request, env);
  }
  if (url.pathname.includes('/signals')) {
    return handleSignals(request, env);
  }
  if (url.pathname.includes('/preferences')) {
    return handlePreferences(request, env);
  }
  if (url.pathname.endsWith('/config') || url.pathname.endsWith('/config/')) {
    return handleConfig(request, env);
  }
  if (url.pathname.includes('/jd-analysis') || url.pathname.includes('/jd_analysis')) {
    return handleJDAnalysis(request, env, corsHeadersFor, serverKeyFor);
  }
  if (url.pathname.includes('/extract-kernel') || url.pathname.includes('/extract_kernel')) {
    return handleKernelExtraction(request, env, corsHeadersFor);
  }
  if (url.pathname.includes('/fetch-jd-url') || url.pathname.includes('/fetch_jd_url')) {
    return handleFetchJdUrl(request, env, corsHeadersFor);
  }
  if (url.pathname.includes('/supervisor/check') || url.pathname.includes('/supervisor_check')) {
    return handleSupervisorCheck(request, env, corsHeadersFor);
  }

  // v3.3.0: LLM audit endpoint — F1 dispatcher implementation.
  // Accepts a user-supplied LLM endpoint (URL + key + model + shape)
  // and runs the test battery against it. Returns per-probe verdicts
  // plus an overall qualification decision (approved | conditional | rejected).
  if (url.pathname.includes('/api/llm-audit/test-endpoint') || url.pathname.includes('/llm_audit_test_endpoint')) {
    const CORS_AUDIT = corsHeadersFor(request, env, 'x-api-key, x-provider, x-test-url, x-test-model');
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_AUDIT });
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'POST required' }), {
        status: 405, headers: { 'Content-Type': 'application/json', ...CORS_AUDIT },
      });
    }
    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ ok: false, error: 'invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_AUDIT },
    }); }
    try {
      const mod = await import('./byok-qualify.js');
      const result = await mod.qualifyEndpoint({
        url:            body.url,
        apiKey:         body.apiKey,
        modelId:        body.modelId,
        provider_shape: body.provider_shape || 'openai_compat',
      });
      const status = result.ok ? 200 : 400;
      return new Response(JSON.stringify({ ...result, cv_proxy_version: VERSION }, null, 2), {
        status, headers: { 'Content-Type': 'application/json', ...CORS_AUDIT },
      });
    } catch (e) {
      console.warn('[byok-qualify] dispatcher error:', e && e.message);
      return new Response(JSON.stringify({ ok: false, error: 'qualifier crashed: ' + (e && e.message || String(e)) }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...CORS_AUDIT },
      });
    }
  }

  // v2.0: GET /api/demo-usage — returns the signed-in user's current
  // monthly demo usage. Always returns 200; uses 0 if not in demo mode
  // OR not signed in, so the PWA can call it unconditionally.
  if (url.pathname.includes('/api/demo-usage') || url.pathname.includes('/demo-usage')) {
    const CORS_DEMO = corsHeadersFor(request, env, 'x-api-key, x-provider');
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_DEMO });
    if (!isDemoMode(env)) {
      return new Response(JSON.stringify({ ok: true, demo_mode: false }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...CORS_DEMO }
      });
    }
    const id = await identityFromRequestAsync(request, env);
    if (!id || !id.email) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthenticated', demo_mode: true }), {
        status: 401, headers: { 'Content-Type': 'application/json', ...CORS_DEMO }
      });
    }
    const usage = await getDemoUsage(env, id.email);
    const cap = await getCapForUser(env, id.email);
    return new Response(JSON.stringify({
      ok: true, demo_mode: true,
      cap_usd: cap,
      used_usd: usage.usd_used,
      remaining_usd: Math.max(0, cap - usage.usd_used),
      requests: usage.requests,
      last_at: usage.last_at,
      over_cap: usage.usd_used >= cap,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_DEMO, ...demoHeaders(usage, cap) },
    });
  }

  const CORS = corsHeadersFor(request, env, 'x-api-key, x-provider, x-gemini-model');

  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const provider = (request.headers.get('x-provider') || 'anthropic').toLowerCase();
  const clientKey = cleanClientKey(request.headers.get('x-api-key') || '', provider);
  const serverKey = await serverKeyFor(env, provider);
  const apiKey = clientKey || serverKey;
  // 'client' = PWA sent its own key via x-api-key
  // 'server' = falling back to the cv-proxy's wrangler secret
  // 'none'   = no key at all (will be caught below per-provider)
  const keySource = clientKey ? 'client' : (serverKey ? 'server' : 'none');

  // v2.0 demo enforcement: when DEMO_MODE='true' on the Worker, every
  // LLM call is gated by a per-user monthly USD cap. If the user is
  // over cap, reject with 429 here BEFORE we read the body or burn
  // any tokens. The demo object captures the user identity + cap +
  // current usage for post-flight tracking and header injection.
  //
  // v2.5: BYO-keys bypass. When the client supplies their own API key
  // via x-api-key, the LLM call uses THEIR quota, not ours. The cap
  // exists to limit spending of the SHARED server keys — when those
  // aren't being used, the cap is irrelevant. The user is identified
  // for analytics + abuse-correlation but not capped.
  let demo = null;
  if (isDemoMode(env) && keySource !== 'client') {
    const pre = await demoPreflight(request, env, identityFromRequestAsync);
    if (!pre.ok) {
      return new Response(
        JSON.stringify({ error: pre.error, message: pre.message, usage: pre.usage || null, cap: pre.cap || null }),
        { status: pre.status, headers: { 'Content-Type': 'application/json', ...CORS, ...(pre.headers || {}) } }
      );
    }
    demo = pre; // { ok:true, email, cap, usage, headers }
  }

  let bodyText;
  try { bodyText = await request.text(); }
  catch(e) { return new Response('Body read failed', { status: 400, headers: CORS }); }

  // In demo mode, force non-streaming so we can buffer the full
  // response and parse usage from it. Most clients (including the
  // PWA's wrappedFetch) handle both stream and non-stream responses.
  if (demo) {
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.stream === true) {
        parsed.stream = false;
        bodyText = JSON.stringify(parsed);
      }
    } catch (_) { /* keep original */ }
  }

  // Prompt augmentation: detect CV/CL generation tasks and prepend
  // task-specific system guidance. Returns the (possibly modified)
  // body and the detected task name (or null). The task name is added
  // to every response below as the X-AntCV-Task header so the PWA
  // can surface "augmentation applied: cv_outcomes" in its dispatcher
  // breadcrumbs panel for observability.
  let augTask = null;
  try {
    const augResult = augmentBodyText(bodyText);
    bodyText = augResult.bodyText;
    augTask = augResult.task;
  } catch (e) {
    // Augmentation failure is never fatal; pass the original body
    // through and log so we can investigate.
    console.warn('[prompt-augment] failed:', e && e.message ? e.message : e);
  }

  // v2.2 prompt-injection defense.
  //
  // After the existing augmentation has set up the system prompt
  // and message contents, we now apply a second pass that:
  //
  //   1. Sanitizes every user-role message content (stripping known
  //      injection patterns, neutralizing closing tags, capping
  //      length).
  //   2. Prepends a defense preamble to the system message that
  //      explicitly tells the model to treat user content as data.
  //
  // This protects against malicious JD text, scraped LinkedIn data,
  // GitHub READMEs, and any other user-supplied content from
  // hijacking the LLM. We run it BEFORE the upstream fetch so the
  // sanitized body is what's sent to the provider.
  //
  // v2.3: also attaches user-identifier metadata to each upstream
  // call. Anthropic supports `metadata: { user_id }`, OpenAI/Mistral
  // support `user`, Gemini supports nothing standard but accepts
  // arbitrary string fields. Identifier is a SHA-256 hash of the
  // signed-in email (not the raw address) so provider logs can
  // correlate per-user abuse without exposing PII.
  let userHashForLlm = null;
  try {
    // Best-effort: if request is authenticated, compute hash
    if (demo && demo.email) {
      const norm = String(demo.email).trim().toLowerCase();
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      userHashForLlm = 'antcv-' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 16);
    } else {
      // Non-demo path: try to get identity from request anyway
      const id = await identityFromRequestAsync(request, env);
      if (id && id.email) {
        const norm = String(id.email).trim().toLowerCase();
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        userHashForLlm = 'antcv-' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 16);
      }
    }
  } catch (_) { userHashForLlm = null; }

  let injectionStats = { redacted: 0, suspicious: [] };
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object') {
      let modified = false;

      // OpenAI / Mistral / Anthropic shape: messages: [{role, content}]
      if (Array.isArray(parsed.messages)) {
        for (let i = 0; i < parsed.messages.length; i++) {
          const m = parsed.messages[i];
          if (!m || typeof m !== 'object') continue;
          if (m.role === 'system' && typeof m.content === 'string') {
            // Prepend defense preamble to the existing system prompt.
            // If the augmentation already set a system message, we
            // wrap it; if not, we add one.
            if (!m.content.includes('Input handling rules')) {
              m.content = INJECTION_DEFENSE_PREAMBLE + '\n\n' + m.content;
              modified = true;
            }
          } else if (m.role === 'user' && typeof m.content === 'string') {
            const r = sanitizeUserContent(m.content, { fieldName: 'message[' + i + ']' });
            if (r.redacted > 0 || r.suspicious.length > 0) {
              m.content = r.clean;
              injectionStats.redacted += r.redacted;
              injectionStats.suspicious.push(...r.suspicious);
              modified = true;
            }
          }
        }
        // v2.5.1: do NOT add { role: 'system' } directly to the
        // messages array — Anthropic's /v1/messages rejects that
        // role with 400. Instead set the Anthropic-style top-level
        // `system` field below; for OpenAI/Mistral, the existing
        // liftSystemIntoMessages() pass will translate it to a
        // messages[0] system entry just before sending upstream.
      }

      // Anthropic-specific top-level `system` field
      if (typeof parsed.system === 'string') {
        if (!parsed.system.includes('Input handling rules')) {
          parsed.system = INJECTION_DEFENSE_PREAMBLE + '\n\n' + parsed.system;
          modified = true;
        }
      } else if (!parsed.system && Array.isArray(parsed.messages)) {
        // Anthropic accepts system as top-level for /v1/messages; add it
        parsed.system = INJECTION_DEFENSE_PREAMBLE;
        modified = true;
      }

      // Gemini shape: contents: [{role, parts: [{text}]}]
      if (Array.isArray(parsed.contents)) {
        for (let i = 0; i < parsed.contents.length; i++) {
          const c = parsed.contents[i];
          if (!c || c.role !== 'user' || !Array.isArray(c.parts)) continue;
          for (let j = 0; j < c.parts.length; j++) {
            if (c.parts[j] && typeof c.parts[j].text === 'string') {
              const r = sanitizeUserContent(c.parts[j].text, { fieldName: 'contents[' + i + '].parts[' + j + ']' });
              if (r.redacted > 0 || r.suspicious.length > 0) {
                c.parts[j].text = r.clean;
                injectionStats.redacted += r.redacted;
                injectionStats.suspicious.push(...r.suspicious);
                modified = true;
              }
            }
          }
        }
      }
      // Gemini systemInstruction field
      if (parsed.systemInstruction && Array.isArray(parsed.systemInstruction.parts)) {
        const sip = parsed.systemInstruction.parts[0];
        if (sip && typeof sip.text === 'string' && !sip.text.includes('Input handling rules')) {
          sip.text = INJECTION_DEFENSE_PREAMBLE + '\n\n' + sip.text;
          modified = true;
        }
      }

      if (modified) {
        bodyText = JSON.stringify(parsed);
      }

      // v2.3: also attach the user identifier to the appropriate
      // provider-specific field. We do this in a second parse pass
      // (the JSON has changed if `modified`) so the merge is clean.
      // v2.4: ALSO set `store: false` on OpenAI/Mistral — this is the
      // ONE real provider-side privacy flag (other providers don't
      // have a standard equivalent). When set, OpenAI does not store
      // the request for evaluation/model-improvement purposes. The
      // request still goes through their normal abuse-monitoring and
      // safety logging — see their API terms.
      if (userHashForLlm) {
        try {
          const p2 = JSON.parse(bodyText);
          // Anthropic: metadata: { user_id }
          if (provider === 'anthropic') {
            p2.metadata = { ...(p2.metadata || {}), user_id: userHashForLlm };
          }
          // OpenAI / Mistral: top-level `user` string + `store: false`
          else if (provider === 'openai' || provider === 'mistral') {
            p2.user = userHashForLlm;
            p2.store = false;
          }
          // Gemini: no standard field, but we set safety_settings to indicate
          // we treat output as sensitive. The user identifier goes in our
          // own custom header on the upstream fetch instead.
          bodyText = JSON.stringify(p2);
        } catch (_) { /* keep unmodified body */ }
      }
    }
  } catch (e) {
    // If body isn't valid JSON, skip defense — the upstream will
    // reject it anyway with a clear error.
    console.warn('[injection-defense] body parse failed:', e && e.message);
  }

  // Helper that adds the task header to any response we return below.
  // Streaming responses also get it — Cloudflare preserves headers
  // through Response construction even when the body is a ReadableStream.
  // v2.0: also injects X-AntCV-Demo-* headers when DEMO_MODE is on.
  // v2.2: also reports prompt-injection sanitization stats.
  const taskHeader = () => {
    const out = {};
    if (augTask) out['X-AntCV-Task'] = augTask;
    if (demo && demo.headers) Object.assign(out, demo.headers);
    if (injectionStats.redacted > 0) {
      out['X-AntCV-Sanitized-Patterns'] = String(injectionStats.redacted);
    }
    return out;
  };

  // v2.0 post-flight helper: after a successful upstream response in
  // demo mode, parse provider usage, estimate cost, bump KV counter,
  // and return the FRESHEST demo headers (with the now-updated total)
  // for injection on the response we send back to the PWA.
  const trackAndHeader = async (responseBody, modelHint) => {
    if (!demo) return {};
    try {
      const updated = await demoTrackUsage(env, demo.email, provider, responseBody, modelHint);
      if (updated) return demoHeaders(updated, demo.cap);
    } catch (e) {
      console.warn('[demo] trackUsage failed:', e && e.message);
    }
    return demo.headers || {};
  };

  const errJson = (msg, status=500) => new Response(
    JSON.stringify({ error: msg }),
    { status, headers: { 'Content-Type': 'application/json', ...CORS, ...taskHeader() } }
  );

  if (provider === 'openai') {
    if (!apiKey.startsWith('sk-')) return errJson('OpenAI server key is not available on cv-proxy. Set ChatGPT_API_Key or OPENAI_API_KEY as a Worker secret.', 401);
    let outBody = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      // Lift Anthropic-style top-level `system` into messages[0] —
      // OpenAI's chat-completions endpoint rejects unknown top-level
      // params with 400. Without this, every prompt-augmented call to
      // OpenAI 400s with "Unknown parameter: 'system'".
      liftSystemIntoMessages(parsed);
      // Translate multimodal content blocks. The PWA's vision-mode
      // PDF extraction sends Anthropic-shaped image blocks; OpenAI
      // expects { type: 'image_url', image_url: { url: ... } }.
      // Without this, the upstream returns:
      //   "Invalid value: 'image'. Supported values are: 'text',
      //    'image_url', 'input_audio', 'refusal', 'audio'"
      if (Array.isArray(parsed.messages)) {
        parsed.messages = translateMessagesForProvider(parsed.messages, 'openai');
      }
      // Force JSON mode if the prompt is asking for JSON. This
      // makes the OpenAI server return a guaranteed valid JSON
      // object rather than markdown-wrapped or prose-prefaced
      // output, eliminating the "non-JSON: No {...} found" retries
      // the PWA otherwise has to do. response_format with
      // type:'json_object' has been GA on chat-completions since
      // gpt-3.5-turbo-1106 and is supported by every gpt-4*/o*/gpt-5
      // model the PWA uses.
      if (wantsJsonMode(parsed) && !parsed.response_format) {
        parsed.response_format = { type: 'json_object' };
      }
      const m = (parsed.model || '').toString();
      const usesNewParam = /^(gpt-5|o[1-9])/i.test(m);
      if (usesNewParam && parsed.max_tokens != null && parsed.max_completion_tokens == null) {
        parsed.max_completion_tokens = parsed.max_tokens;
        delete parsed.max_tokens;
      }
      outBody = JSON.stringify(parsed);
    } catch (e) {}
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: outBody,
    });
    const data = await res.text();
    // On error status, wrap with actionable hint so the PWA can
    // show the user where the misconfigured key actually lives.
    if (!res.ok) {
      return new Response(
        wrapUpstreamError('openai', res.status, data, keySource),
        { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...taskHeader() } }
      );
    }
    return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...(demo ? await trackAndHeader(data) : taskHeader()) } });
  }

  if (provider === 'mistral') {
    if (!apiKey) return errJson('Mistral server key is not available on cv-proxy. Set Mistral_API_Key or MISTRAL_API_KEY as a Worker secret.', 401);
    // The PWA sends messages in Anthropic format. Mistral takes
    // OpenAI-shaped messages (`content: string` for text-only; or
    // `content: [{type:'text', text}, {type:'image_url', image_url:'data:...'}]`
    // for multimodal). Translate before forwarding — without this the
    // image blocks come through as Anthropic-shaped objects and Mistral
    // returns 422 "Input should be a valid string".
    //
    // Translation is delegated to translateMessagesForProvider so the
    // same logic stays in sync with the OpenAI path. The 'mistral'
    // provider mode produces `image_url: "data:..."` as a string
    // (Mistral's accepted shape); 'openai' would produce
    // `image_url: { url: "data:..." }`.
    let mistralBody = bodyText;
    try {
      const inBody = JSON.parse(bodyText);
      if (inBody && Array.isArray(inBody.messages)) {
        inBody.messages = translateMessagesForProvider(inBody.messages, 'mistral');
        // Lift Anthropic-style top-level `system` into messages[0]
        // instead of dropping it. Mistral does accept role:'system'
        // messages — the previous behaviour silently deleted the
        // field, which meant the prompt-augmentation system prompt
        // never reached the model. (Requests succeeded but quality
        // degraded.)
        liftSystemIntoMessages(inBody);
        // Force JSON mode if the prompt asks for JSON. Mistral's
        // response_format:{type:'json_object'} is supported by
        // mistral-large-* and recent mistral-medium. Smaller/older
        // models may ignore it but won't 400 on it.
        if (wantsJsonMode(inBody) && !inBody.response_format) {
          inBody.response_format = { type: 'json_object' };
        }
        mistralBody = JSON.stringify(inBody);
      }
    } catch (e) {
      // If translation fails, fall back to passing the body unchanged so
      // text-only requests keep working.
    }
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: mistralBody,
    });
    const data = await res.text();
    if (!res.ok) {
      return new Response(
        wrapUpstreamError('mistral', res.status, data, keySource),
        { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...taskHeader() } }
      );
    }
    return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...(demo ? await trackAndHeader(data) : taskHeader()) } });
  }

  if (provider === 'gemini') {
    if (!apiKey) return errJson('Gemini server key is not available on cv-proxy. Set Gemini_API_Key or GEMINI_API_KEY as a Worker secret.', 401);
    let inBody;
    try { inBody = JSON.parse(bodyText); }
    catch (e) { return errJson('Bad JSON for Gemini', 400); }

    let model = inBody.model || request.headers.get('x-gemini-model') || 'gemini-2.5-flash';
    const deprecated = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'];
    if (deprecated.includes(model)) model = 'gemini-2.5-flash';
    // Lift Anthropic-style top-level `system` field into the messages
    // array. Gemini's handler below scans for role:'system' messages
    // and lifts them into systemInstruction. Without this conversion
    // the augmented system prompt would be silently dropped for
    // every Gemini call.
    liftSystemIntoMessages(inBody);
    const messages = inBody.messages || [];

    const systemBits = [];
    const contents = [];
    for (const m of messages) {
      if (m.role === 'system') {
        if (typeof m.content === 'string') systemBits.push(m.content);
        continue;
      }
      const role = (m.role === 'assistant') ? 'model' : 'user';
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      contents.push({ role, parts: [{ text }] });
    }
    if (contents.length === 0) {
      return errJson('Gemini call requires at least one user message.', 400);
    }

    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: inBody.max_tokens || 2500,
        temperature: typeof inBody.temperature === 'number' ? inBody.temperature : 0.7,
      },
    };
    if (systemBits.length) {
      payload.systemInstruction = { parts: [{ text: systemBits.join('\n\n') }] };
    }
    // Force JSON mode if the prompt asks for JSON. Gemini's flagship
    // responseMimeType field guarantees a valid JSON object — no
    // prose, no fences, no commentary. Supported on every gemini-2.x
    // model. This eliminates the PWA's "non-JSON: No {...} found"
    // retry loop on apply_correction/fuse/enrich tasks. We use the
    // already-lifted inBody so the wantsJsonMode signal sees the
    // full system prompt content.
    if (wantsJsonMode(inBody)) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dataText = await res.text();
    if (!res.ok) {
      return new Response(
        wrapUpstreamError('gemini', res.status, dataText, keySource),
        { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...taskHeader() } }
      );
    }
    let parsed;
    try { parsed = JSON.parse(dataText); }
    catch (e) { return errJson('Gemini returned non-JSON: ' + dataText.slice(0,200), 502); }
    const text = (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts)
      ? parsed.candidates[0].content.parts.map(p => p.text || '').join('')
      : '';
    const normalized = {
      choices: [{ message: { role: 'assistant', content: text }, finish_reason: parsed.candidates?.[0]?.finishReason || 'stop' }],
      usage: parsed.usageMetadata || {},
      model,
    };
    const normalizedStr = JSON.stringify(normalized);
    return new Response(normalizedStr, { status: 200, headers: { 'Content-Type': 'application/json', ...CORS, ...(demo ? await trackAndHeader(dataText, model) : taskHeader()) } });
  }

  if (!apiKey.startsWith('sk-ant-')) return errJson('Anthropic server key is not available on cv-proxy. Set Claude_API_Key or ANTHROPIC_API_KEY as a Worker secret.', 401);
  try {
    const body = JSON.parse(bodyText);
    // v2.0: demo mode forces non-streaming so we can parse usage from
    // the buffered response. Production (non-demo) keeps streaming for
    // best PWA UX (incremental token rendering).
    body.stream = demo ? false : true;
    bodyText = JSON.stringify(body);
  } catch(e) {}
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: bodyText,
  });
  // Anthropic returns SSE only on success; errors come back as JSON.
  // If we forwarded an error body with Content-Type text/event-stream,
  // the PWA's stream parser would fail silently. Detect the non-OK
  // case and wrap with the same helpful upstream-error envelope as
  // the other providers.
  if (!res.ok) {
    const errText = await res.text();
    return new Response(
      wrapUpstreamError('anthropic', res.status, errText, keySource),
      { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS, ...taskHeader() } }
    );
  }
  // Demo mode: buffer the non-stream response, parse usage, bump
  // counter, return as application/json so the PWA's non-stream code
  // path handles it.
  if (demo) {
    const buffered = await res.text();
    const headers = await trackAndHeader(buffered);
    return new Response(buffered, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
    });
  }
  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS, ...taskHeader() },
  });
}

async function handleConfig(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }
  const proxyUrl = (env && typeof env.proxy_url === 'string') ? env.proxy_url : '';
  const body = {
    proxy_url: proxyUrl,
    server_keys: await serverKeyAvailability(env),
    analytics_kv: !!(env && env.ANALYTICS),
    analytics_engine: !!(env && env.ANT_ANALYTIC_ENGINE),
    signals_kv: !!(env && env.KV_BINDING),
    preferences_kv: !!(env && env.KV_BINDING),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function handleAnalytics(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  let event;
  try { event = JSON.parse(await request.text()); }
  catch(e) { return new Response('Invalid JSON', { status: 400, headers: CORS }); }

  const safe = Object.fromEntries(
    Object.entries(event).filter(([k, v]) => {
      if (typeof v === 'string' && (v.startsWith('sk-') || v.includes('@') || v.length > 200)) return false;
      return true;
    })
  );

  const key = `${safe.event || 'unknown'}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  console.log('[analytics]', JSON.stringify(safe));

  if (env && env.ANALYTICS) {
    try { await env.ANALYTICS.put(key, JSON.stringify(safe), { expirationTtl: 7776000 }); }
    catch(e) { console.warn('[analytics] KV write failed:', e.message); }
  }

  writeAnalyticsEngineEvent(request, env, safe);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}


function numericValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function analyticsIndexFor(request, event) {
  const id = identityFromRequest(request);
  if (id && id.email) return id.email.toLowerCase();
  if (typeof event.session === 'string' && event.session) return event.session.slice(0, 128);
  return 'anonymous';
}

function writeAnalyticsEngineEvent(request, env, event) {
  if (!env || !env.ANT_ANALYTIC_ENGINE || typeof env.ANT_ANALYTIC_ENGINE.writeDataPoint !== 'function') return;
  try {
    const cf = request.cf || {};
    env.ANT_ANALYTIC_ENGINE.writeDataPoint({
      // blob1 event, blob2 provider, blob3 task, blob4 doc, blob5 ab group,
      // blob6 origin, blob7 country, blob8 app version
      blobs: [
        String(event.event || 'unknown').slice(0, 128),
        String(event.provider || '').slice(0, 64),
        String(event.task || '').slice(0, 128),
        String(event.doc || event.document_type || '').slice(0, 64),
        String(event.ab_group || '').slice(0, 32),
        String(request.headers.get('Origin') || '').slice(0, 256),
        String(cf.country || '').slice(0, 8),
        String(event.app_version || event.version || '').slice(0, 64),
      ],
      // double1 duration_ms, double2 cost_usd, double3 input tokens,
      // double4 output tokens, double5 total tokens, double6 status code
      doubles: [
        numericValue(event.duration_ms),
        numericValue(event.cost_usd || event.session_cost_usd || event.cost_at_export_usd),
        numericValue(event.input_tokens || event.prompt_tokens),
        numericValue(event.output_tokens || event.completion_tokens),
        numericValue(event.total_tokens),
        numericValue(event.status || event.status_code || 200),
      ],
      indexes: [analyticsIndexFor(request, event)],
    });
  } catch (e) {
    console.warn('[analytics-engine] writeDataPoint failed:', e && e.message ? e.message : e);
  }
}

function identityFromRequest(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email') || '';
  if (email) return { email };
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  if (jwt.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.email) return { email: payload.email };
      if (payload.sub) return { email: payload.sub };
    } catch(e) {}
  }
  return null;
}

// Async variant — same checks as identityFromRequest plus a verified
// Bearer-JWT path for tokens issued by antcv-access-relay. Returns
// null when no identity can be established.
//
// Order of trust:
//   1. CF-Access-Authenticated-User-Email   (CF Access in front)
//   2. CF-Access-Jwt-Assertion              (decoded but not verified)
//   3. Authorization: Bearer <jwt>           (HS256-verified against
//                                            JWT_SECRET — same shared
//                                            secret the relay uses)
//
// The Bearer path is what makes /preferences and /signals work after
// the CF Access app is removed from cv-proxy: the PWA's wrappedFetch
// already attaches the relay-issued token on its proxy URL, so the
// Worker just needs to know how to verify it.
async function identityFromRequestAsync(request, env) {
  const sync = identityFromRequest(request);
  if (sync) return sync;
  if (!env) return null;
  const secret = await getKey(env, ['JWT_SECRET', 'RELAY_JWT_SECRET']);
  if (!secret) return null;
  return await identityFromBearer(request, secret);
}

function userScopedKey(request, prefix) {
  const id = identityFromRequest(request);
  if (!id || !id.email) return null;
  return prefix + ':' + id.email.toLowerCase().replace(/[^a-z0-9@._-]/g,'_');
}

// Async variant — resolves identity via CF Access OR a verified
// relay Bearer JWT, then returns the user-scoped KV key. Returns
// null if no identity. Used by /preferences and /signals after the
// CF Access app was removed from cv-proxy.
async function userScopedKeyAsync(request, env, prefix) {
  const id = await identityFromRequestAsync(request, env);
  if (!id || !id.email) return null;
  return prefix + ':' + id.email.toLowerCase().replace(/[^a-z0-9@._-]/g,'_');
}

async function handleMe(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  // Use the async variant so a Bearer-JWT from the relay also
  // resolves an identity — required after the CF Access app on
  // cv-proxy was removed, since CF-Access-Authenticated-User-Email
  // is no longer injected into the request headers.
  const id = await identityFromRequestAsync(request, env);
  // Cache strategy: a /me response is per-user, per-session and
  // changes only when the user signs in/out. Letting the browser
  // cache it for 5 minutes drops the request rate from "every
  // page load" to "every 5 minutes per user". The browser keys
  // its cache by URL + Authorization header value (the Vary
  // header tells it to), so a different JWT gets a different
  // cache slot — no risk of one user seeing another's /me.
  //
  // Authenticated:    Cache-Control: private, max-age=300
  //                   Vary: Authorization
  // Unauthenticated:  Cache-Control: no-store
  //                   (force immediate refetch right after login)
  const cacheHeaders = id
    ? { 'Cache-Control': 'private, max-age=300', 'Vary': 'Authorization' }
    : { 'Cache-Control': 'no-store' };
  return new Response(JSON.stringify({ authenticated: !!id, user: id }), {
    headers: { 'Content-Type':'application/json', ...CORS, ...cacheHeaders }
  });
}

async function handleSignals(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!env || !env.KV_BINDING) return new Response(JSON.stringify({ error:'KV_BINDING KV namespace not bound' }), { status:503, headers:{'Content-Type':'application/json',...CORS}});
  const key = await userScopedKeyAsync(request, env, 'signals');
  if (!key) return new Response(JSON.stringify({ error:'Not authenticated. Sign in or set JWT_SECRET on cv-proxy to match the relay.' }), { status:401, headers:{'Content-Type':'application/json',...CORS}});
  if (request.method === 'GET') {
    const raw = await env.KV_BINDING.get(key);
    return new Response(raw || JSON.stringify({ signals:'' }), { headers:{'Content-Type':'application/json',...CORS}});
  }
  if (request.method === 'PUT' || request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch(e) { return new Response(JSON.stringify({ error:'Invalid JSON' }), { status:400, headers:{'Content-Type':'application/json',...CORS}}); }
    const safe = { signals: String(data.signals || '').slice(0, 100000), updated_at: new Date().toISOString() };
    await env.KV_BINDING.put(key, JSON.stringify(safe));
    return new Response(JSON.stringify({ ok:true, updated_at:safe.updated_at }), { headers:{'Content-Type':'application/json',...CORS}});
  }
  return new Response('Method not allowed', { status:405, headers:CORS });
}

async function handlePreferences(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (!env || !env.KV_BINDING) return new Response(JSON.stringify({ error:'KV_BINDING KV namespace not bound' }), { status:503, headers:{'Content-Type':'application/json',...CORS}});
  const key = await userScopedKeyAsync(request, env, 'preferences');
  if (!key) return new Response(JSON.stringify({ error:'Not authenticated. Sign in or set JWT_SECRET on cv-proxy to match the relay.' }), { status:401, headers:{'Content-Type':'application/json',...CORS}});
  if (request.method === 'GET') {
    const raw = await env.KV_BINDING.get(key);
    return new Response(raw || JSON.stringify({ preferences:null }), { headers:{'Content-Type':'application/json',...CORS}});
  }
  if (request.method === 'PUT' || request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch(e) { return new Response(JSON.stringify({ error:'Invalid JSON' }), { status:400, headers:{'Content-Type':'application/json',...CORS}}); }
    const safe = { preferences:data, updated_at:new Date().toISOString(), version:2 };
    await env.KV_BINDING.put(key, JSON.stringify(safe));
    return new Response(JSON.stringify({ ok:true, updated_at:safe.updated_at }), { headers:{'Content-Type':'application/json',...CORS}});
  }
  return new Response('Method not allowed', { status:405, headers:CORS });
}

async function listAllKeys(kv, prefix) {
  // Cloudflare KV `list()` caps at 1000 keys per call (server enforces
  // it as `key_count_limit < 1000`). For namespaces that grow beyond
  // that, we paginate with the returned cursor until `list_complete`
  // signals we've drained the namespace. A safety cap of 50 pages
  // (50 × 1000 = 50k keys) prevents a runaway loop if Cloudflare ever
  // returns a malformed cursor; if we hit it we return what we have so
  // the summary still renders rather than 500-ing.
  const all = [];
  let cursor;
  for (let page = 0; page < 50; page++) {
    const result = await kv.list(prefix ? { prefix, limit: 1000, cursor } : { limit: 1000, cursor });
    all.push(...result.keys);
    if (result.list_complete) break;
    cursor = result.cursor;
    if (!cursor) break;
  }
  return all;
}

async function handleAnalyticsSummary(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (!env || !env.ANALYTICS) {
    return new Response(JSON.stringify({ ok: true, analytics_bound: false, total_events: 0, event_counts: {}, events: [] }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') || '';
  const expectedSecret = await getKey(env, ['ANALYTICS_SECRET']);
  if (expectedSecret && secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  const keys = await listAllKeys(env.ANALYTICS);
  const counts = {};
  for (const { name } of keys) {
    const e = name.split(':')[0];
    counts[e] = (counts[e] || 0) + 1;
  }
  return new Response(JSON.stringify({ as_of: new Date().toISOString(), total_events: keys.length, event_counts: counts }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// =================================================================
//  /api/analytics/export
//
//  Returns the user's analytics data either as JSON or CSV. Defaults
//  to per-session aggregates (start/end timestamps, edit_count,
//  enrich_count, time_to_first_export_ms, time_to_final_export_ms,
//  cost_usd). Pass `view=events` to get the raw event stream.
//
//  Query parameters:
//    format=json|csv      (default json)
//    view=sessions|events (default sessions)
//    since=<unix-ms>      lower time bound (inclusive)
//    until=<unix-ms>      upper time bound (inclusive)
//    event=<event-name>   prefix-scan only this event type (faster)
//    secret=<value>       admin override — required to see global
//                         data when the caller has no identity
//
//  Authentication:
//    - If the request carries CF-Access identity (email or JWT), the
//      response includes only events whose `session` or `email` field
//      matches that identity.
//    - If no identity is present, the request must include
//      ?secret=<value> matching ANALYTICS_SECRET. Otherwise 401.
//
//  This keeps the endpoint usable from the PWA (authenticated users
//  always see their own data) and from an admin terminal (with the
//  shared secret) without ever leaking one user's data to another.
// =================================================================
async function handleAnalyticsExport(request, env) {
  const CORS = corsHeadersFor(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }
  if (!env || !env.ANALYTICS) {
    return new Response(JSON.stringify({ ok: true, analytics_bound: false, sessions: [], sessions_total: 0, events_total: 0 }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const view   = (url.searchParams.get('view')   || 'sessions').toLowerCase();
  const event  = url.searchParams.get('event') || undefined;
  const since  = url.searchParams.get('since');
  const until  = url.searchParams.get('until');
  const sinceMs = since ? parseInt(since, 10) : undefined;
  const untilMs = until ? parseInt(until, 10) : undefined;

  // Identity resolution. After CF Access was removed from cv-proxy
  // the only identity signal is the relay-issued Bearer JWT.
  // identityFromRequestAsync covers all three trust paths (CF Access
  // headers, CF Access JWT assertion, verified Bearer).
  const id = await identityFromRequestAsync(request, env);
  let identity = null;
  if (id && id.email) {
    identity = id.email;
  } else {
    const secret = url.searchParams.get('secret') || '';
    const expectedSecret = await getKey(env, ['ANALYTICS_SECRET']);
    if (expectedSecret) {
      if (secret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized — supply ?secret=… or sign in' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }
      // Admin: scan everything, no per-user filter.
    } else if (!secret) {
      // No identity, no secret configured, no secret provided. Allow
      // the call but with no filter — useful in local dev.
    }
  }

  // Hard cap result size to keep responses under a few MB even for
  // very active users. Users can paginate by narrowing the time range.
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10000', 10), 50000);

  const result = await buildAnalyticsExport(env.ANALYTICS, {
    identity, sinceMs, untilMs, event, limit, format, view,
  });

  // For CSV: set a friendly filename so the browser downloads as
  // `antcv-analytics-YYYY-MM-DD.csv` instead of the path basename.
  const headers = {
    'Content-Type': result.contentType,
    'Cache-Control': 'no-store',
    ...CORS,
  };
  if (format === 'csv') {
    const today = new Date().toISOString().slice(0, 10);
    const stem  = view === 'events' ? 'events' : 'sessions';
    headers['Content-Disposition'] = `attachment; filename="antcv-analytics-${stem}-${today}.csv"`;
  }
  return new Response(result.body, { status: 200, headers });
}
