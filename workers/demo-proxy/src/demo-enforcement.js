// =================================================================
//  demo-enforcement.js
//
//  Per-user spending cap enforcement for AntCV demo deployments.
//  Designed to live alongside the existing cv-proxy LLM proxy code:
//  when DEMO_MODE='true' is set on the Worker, every POST / and
//  /api/jd-analysis / /api/supervisor/check call is gated by a
//  per-user monthly USD cap (default $0.50) stored in KV.
//
//  Architecture:
//
//    - Pre-flight  : check current user's monthly usage. If at/over
//                    cap → reject with 429.
//    - Post-flight : parse provider's usage field from the response
//                    body, estimate USD cost, and bump the counter.
//    - All demo    : every response gets `X-AntCV-Demo: true` plus
//      responses     `X-AntCV-Demo-Used-Usd` and `X-AntCV-Demo-Cap-Usd`
//                    headers so the PWA can show a live indicator.
//
//  KV namespace : reuses ANALYTICS or KV_BINDING (whichever is bound).
//  KV key       : demo_usage:<sha256(email)[:32]>:<YYYY-MM>
//                 Value: JSON { usd_used, requests, last_at }
//                 TTL: 60 days (auto-cleanup of old months)
//
//  Cost model   : provider's `usage.input_tokens` + `output_tokens`
//                 multiplied by per-model rates in USD per 1M tokens.
//                 Rates are conservative — when in doubt, lean high
//                 so the cap kicks in faster on unknown models.
// =================================================================


// USD per 1 million tokens — [input_rate, output_rate]
//
// === Rates as of 2026-05-17 ===
// Verified against public pricing for the four supported providers.
// Re-audit quarterly; the next review window is 2026-08-17.
//
// AntCV LLM cost-tracking audit (v1.40.167) found that the previous
// table mispriced Claude Opus 4.5/4.6/4.7 by 3x — they all fell
// through to the legacy `claude-opus-4` substring at [15, 75], which
// is OLD Opus 4 / 4.1 pricing. From Opus 4.5 onward Anthropic dropped
// the flagship to $5/$25, so the demo cap was burning 3x too fast on
// every Opus 4.7 call. Specific entries below override the legacy
// substring match because the matcher sorts by key length, longest
// first (see rateFor below).
//
// Keys are CASE-INSENSITIVE substring matches against the response's
// `model` field (Anthropic/OpenAI/Mistral return the model name; we
// match the most specific key first).
//
// Rates verified against public pricing pages 2026-05-18:
//   • Anthropic platform.claude.com/docs/en/about-claude/pricing
//   • OpenAI    platform.openai.com/docs/pricing
//   • Mistral   mistral.ai/products/la-plateforme#pricing
//   • Gemini    ai.google.dev/pricing
// Any value updated below carries an inline date comment; values
// without one are unchanged from the last audit.
const RATES = {
  // Anthropic — current generation
  'claude-sonnet-5':     [3.00, 15.00],   // 2026-07 (standard $3/$15; intro $2/$10 through 2026-08-31 — use standard so the demo budget is conservatively capped)
  'claude-opus-4-7':     [5.00, 25.00],   // released 2026-04-16
  'claude-opus-4-6':     [5.00, 25.00],
  'claude-opus-4-5':     [5.00, 25.00],
  'claude-sonnet-4-6':   [3.00, 15.00],
  'claude-sonnet-4-5':   [3.00, 15.00],
  'claude-haiku-4-5':    [1.00,  5.00],
  // Anthropic — legacy (kept for older deployed models)
  'claude-3-haiku':      [0.25,  1.25],
  'claude-3-5-haiku':    [0.80,  4.00],
  'claude-haiku-4':      [1.00,  5.00],
  'claude-3-5-sonnet':   [3.00, 15.00],
  'claude-3-7-sonnet':   [3.00, 15.00],
  'claude-sonnet-4':     [3.00, 15.00],
  'claude-opus-4-1':     [15.00, 75.00],
  'claude-opus-4':       [15.00, 75.00],   // legacy Opus 4 base — superseded by 4.5+
  // OpenAI — GPT-5 family (added 2026-05-18 audit; launched 2025)
  'gpt-5.4-nano':        [0.20,  1.25],
  'gpt-5.4-mini':        [0.75,  4.50],
  'gpt-5.4':             [2.50, 15.00],   // current flagship as of 2026-04
  'gpt-5-mini':          [0.25,  2.00],
  'gpt-5':               [1.25, 10.00],
  // OpenAI — GPT-4 family
  'gpt-4o-mini':         [0.15,  0.60],
  'gpt-4o':              [2.50, 10.00],
  'gpt-4.1-mini':        [0.40,  1.60],
  'gpt-4.1-nano':        [0.10,  0.40],
  'gpt-4.1':             [2.00,  8.00],
  // Mistral
  'mistral-small':       [0.20,  0.60],
  'mistral-medium':      [0.40,  2.00],
  'mistral-large':       [2.00,  6.00],
  // Gemini
  'gemini-1.5-flash':    [0.075, 0.30],
  'gemini-1.5-pro':      [1.25,  5.00],
  'gemini-2.0-flash':    [0.10,  0.40],
  'gemini-2.5-flash':    [0.10,  0.40],
  'gemini-2.5-pro':      [1.25, 10.00],
  // xAI Grok — added 2026-07-05 (BYOK-COST-AUDIT-001, owner: the byok-qualify
  // audit never priced a BYOK provider whose model id fell through to
  // FALLBACK_RATE, e.g. any grok-* model — cost silently went untracked).
  // Web-search-sourced (xAI's own pricing page returned 403 to automated
  // fetch); re-verify directly against docs.x.ai before relying on this for
  // a high-volume production decision. Re-audit alongside the quarterly pass.
  'grok-4-fast':         [0.20,  0.50],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-4':              [3.00, 15.00],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-3-mini':         [0.30,  0.50],   // 2026-07 web-sourced, unverified against docs.x.ai
  'grok-3':              [2.00, 10.00],   // 2026-07 web-sourced, unverified against docs.x.ai
};

// Fallback when no model match — assume Sonnet pricing so the cap
// burns faster on unknown models (safer for the demo budget).
const FALLBACK_RATE = [3.00, 15.00];

// Exported (BYOK-COST-AUDIT-001, 2026-07-05) so byok-qualify.js's custom-
// provider audit can price a BYOK endpoint's model against this SAME table
// instead of duplicating a second, driftable pricing list.
export function rateFor(modelString) {
  const m = String(modelString || '').toLowerCase();
  if (!m) return FALLBACK_RATE;
  // Match longest key first so "claude-3-5-sonnet" beats "claude-3"
  const keys = Object.keys(RATES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (m.includes(key)) return RATES[key];
  }
  return FALLBACK_RATE;
}

export function estimateCostUsd(modelString, inputTokens, outputTokens) {
  const [inRate, outRate] = rateFor(modelString);
  const cost = (Number(inputTokens) || 0) * inRate / 1e6
             + (Number(outputTokens) || 0) * outRate / 1e6;
  return Math.max(0, cost);
}

// Parse usage from a JSON response body (string). Returns
// { model, inputTokens, outputTokens } or null if unparseable.
function extractTokenUsage(provider, responseBody) {
  let parsed;
  try { parsed = JSON.parse(responseBody); }
  catch (_) { return null; }
  if (!parsed || typeof parsed !== 'object') return null;

  if (provider === 'anthropic') {
    // { model, usage: { input_tokens, output_tokens, cache_creation_input_tokens, ... } }
    const u = parsed.usage || {};
    return {
      model: parsed.model || '',
      inputTokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      outputTokens: u.output_tokens || 0,
    };
  }
  if (provider === 'openai' || provider === 'mistral') {
    // { model, usage: { prompt_tokens, completion_tokens, total_tokens } }
    const u = parsed.usage || {};
    return {
      model: parsed.model || '',
      inputTokens: u.prompt_tokens || 0,
      outputTokens: u.completion_tokens || 0,
    };
  }
  if (provider === 'gemini') {
    // { usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount } }
    const u = parsed.usageMetadata || {};
    // Gemini doesn't echo the model in the body; we may pass it via the caller.
    return {
      model: parsed.modelVersion || '',
      inputTokens: u.promptTokenCount || 0,
      outputTokens: u.candidatesTokenCount || 0,
    };
  }
  return null;
}


// SHA-256 hash of lowercased email, base64url-encoded, first 32 chars.
// MUST match relay-auth's userScopedKeyHashed so the same user gets the
// same key across services. (Avoids leaking raw emails in the KV browser.)
export async function hashEmail(email) {
  const norm = String(email || '').trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}

// Get the current calendar month key in UTC: "2026-05".
function currentMonthKey() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

// Get UTC ISO timestamp for the first day of next month.
// Returned in responses so the PWA can show "resets on YYYY-MM-01".
function nextMonthResetIso() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12 (next month)
  const nyear = m === 12 ? y + 1 : y;
  const nmonth = m === 12 ? 1 : m + 1;
  return new Date(Date.UTC(nyear, nmonth - 1, 1, 0, 0, 0)).toISOString();
}


// Read current month's usage for the user. Returns { usd_used, requests, last_at }.
// Empty (zero) record if KV has no entry yet.
export async function getDemoUsage(env, email) {
  const kv = (env && (env.KV_BINDING || env.ANALYTICS)) || null;
  if (!kv) return { usd_used: 0, requests: 0, last_at: null, _kv_bound: false };
  try {
    const hash = await hashEmail(email);
    const key = `demo_usage:${hash}:${currentMonthKey()}`;
    const raw = await kv.get(key);
    if (!raw) return { usd_used: 0, requests: 0, last_at: null, _kv_bound: true };
    const parsed = JSON.parse(raw);
    return {
      usd_used: Number(parsed.usd_used) || 0,
      requests: Number(parsed.requests) || 0,
      last_at: parsed.last_at || null,
      _kv_bound: true,
    };
  } catch (e) {
    console.warn('[demo] getDemoUsage failed:', e && e.message);
    return { usd_used: 0, requests: 0, last_at: null, _kv_bound: true, _error: String(e && e.message || e) };
  }
}


// Increment the user's monthly usage. Atomic-ish: read-modify-write.
// Concurrent calls from the same user MAY race; we accept eventual
// consistency since the cap is approximate ($0.50 ± a few cents is fine).
export async function bumpDemoUsage(env, email, usdDelta) {
  const kv = (env && (env.KV_BINDING || env.ANALYTICS)) || null;
  if (!kv) return false;
  try {
    const hash = await hashEmail(email);
    const key = `demo_usage:${hash}:${currentMonthKey()}`;
    const raw = await kv.get(key);
    const current = raw ? JSON.parse(raw) : { usd_used: 0, requests: 0 };
    current.usd_used = (Number(current.usd_used) || 0) + (Number(usdDelta) || 0);
    current.requests = (Number(current.requests) || 0) + 1;
    current.last_at = new Date().toISOString();
    // 60-day TTL: old months auto-evict
    await kv.put(key, JSON.stringify(current), { expirationTtl: 60 * 24 * 3600 });
    return true;
  } catch (e) {
    console.warn('[demo] bumpDemoUsage failed:', e && e.message);
    return false;
  }
}


// Build the standard demo-mode response headers. Always-included
// when DEMO_MODE='true'; the PWA reads them to show the live
// 🟡 Demo mode pill with the user's current consumption.
export function demoHeaders(usage, cap) {
  const used = Number(usage.usd_used) || 0;
  return {
    'X-AntCV-Demo': 'true',
    'X-AntCV-Demo-Used-Usd': used.toFixed(4),
    'X-AntCV-Demo-Cap-Usd':  (Number(cap) || 0).toFixed(2),
    'X-AntCV-Demo-Reset':    nextMonthResetIso(),
  };
}


// Helper: parse the cap from env var (defaults to $0.50).
export function getCapUsd(env) {
  const raw = env && env.MAX_USD_PER_USER;
  const n = parseFloat(raw);
  return (Number.isFinite(n) && n > 0) ? n : 0.5;
}


// v2.1: tier-aware cap lookup. Reads the admin demo record from KV, walks
// `demoTiers[]`, returns first matching tier's capUsd. Falls back to
// `demoCapUsd` from the same record, then to `MAX_USD_PER_USER` env var,
// then to $0.50. The lookup is cached for 30s to avoid hammering KV on
// every single LLM call.
let _capCache = { ts: 0, data: null };
async function loadAdminDemoForCap(env) {
  const now = Date.now();
  if (_capCache.data && (now - _capCache.ts < 30000)) return _capCache.data;
  const kv = (env && (env.KV_BINDING || env.ANALYTICS)) || null;
  if (!kv) return null;
  try {
    const raw = await kv.get('prefs:__admin_demo__');
    const parsed = raw ? JSON.parse(raw) : null;
    _capCache = { ts: now, data: parsed };
    return parsed;
  } catch (_) { return null; }
}

export async function getCapForUser(env, email) {
  const admin = await loadAdminDemoForCap(env);
  if (admin && Array.isArray(admin.demoTiers)) {
    const e = String(email || '').toLowerCase();
    for (const tier of admin.demoTiers) {
      if (!tier || !tier.matchEmail) continue;
      try {
        // Treat matchEmail as a case-insensitive regex; .test() returns
        // true for partial matches, which is the intuitive UX (admin
        // can write "@trusted-domain.com" and have it match).
        if (new RegExp(tier.matchEmail, 'i').test(e)) {
          const c = Number(tier.capUsd);
          if (c > 0) return c;
        }
      } catch (_) { /* invalid regex — skip */ }
    }
    if (Number(admin.demoCapUsd) > 0) return Number(admin.demoCapUsd);
  }
  return getCapUsd(env);
}


// =================================================================
//  Public guard helpers used by index.js
// =================================================================

// Returns true if demo mode is enabled on this Worker deployment.
export function isDemoMode(env) {
  const v = env && env.DEMO_MODE;
  return v === 'true' || v === true || v === '1';
}


// Pre-flight check. Returns { ok: true, email, cap, usage } when the
// request is allowed, or { ok: false, status, error } when blocked.
// Callers should reject with the returned status if !ok.
export async function preflight(request, env, identityFromRequestAsync) {
  if (!isDemoMode(env)) return { ok: true, demo: false };
  const id = await identityFromRequestAsync(request, env);
  if (!id || !id.email) {
    return { ok: false, status: 401, error: 'demo_requires_sign_in', message: 'Demo deployment requires sign-in. Sign in via the relay before calling this endpoint.' };
  }
  const usage = await getDemoUsage(env, id.email);
  // v2.1: tier-aware cap resolves per-user from admin record (if present)
  const cap = await getCapForUser(env, id.email);
  if (usage.usd_used >= cap) {
    return {
      ok: false, status: 429,
      error: 'demo_cap_reached',
      email: id.email,
      cap, usage,
      headers: demoHeaders(usage, cap),
      message: `Demo cap reached: $${usage.usd_used.toFixed(3)} of $${cap.toFixed(2)} used this month. Resets on ${nextMonthResetIso().slice(0,10)}.`,
    };
  }
  return { ok: true, demo: true, email: id.email, cap, usage, headers: demoHeaders(usage, cap) };
}


// Post-flight tracking. Call AFTER you've read the upstream response
// body. Parses provider usage, estimates cost, increments counter.
// Returns the updated usage object (with new usd_used) for header
// injection on the response back to the client.
export async function trackUsage(env, email, provider, responseBody, modelHint) {
  if (!isDemoMode(env) || !email) return null;
  const u = extractTokenUsage(provider, responseBody);
  if (!u) return null;
  const modelStr = u.model || modelHint || '';
  const usd = estimateCostUsd(modelStr, u.inputTokens, u.outputTokens);
  if (!(usd > 0)) return null;
  await bumpDemoUsage(env, email, usd);
  // Return the new total for header replacement
  return await getDemoUsage(env, email);
}
