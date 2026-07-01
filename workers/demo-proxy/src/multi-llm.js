// =================================================================
//  multi-llm.js
//
//  Provider-cascade caller for structured-JSON tasks like JD
//  analysis. Tries providers in a configured order until one
//  returns a valid JSON body. Each provider gets the same system
//  prompt + user prompt; the call layer adapts formatting per
//  provider (Anthropic native, OpenAI chat-completions, Mistral
//  chat-completions, Gemini generateContent).
//
//  Background. The original JD analysis handler hardcoded a
//  single fetch to Anthropic. When Anthropic returned a 400 (model
//  overload, key throttling, rare server-side schema rejection),
//  the user got a hard failure with no fallback — even though the
//  Worker had keys for OpenAI, Mistral, and Gemini sitting right
//  there.
//
//  Cascade order. Defaults are
//    anthropic → openai → mistral → gemini
//  chosen so that the strongest JSON-mode adherence is tried
//  first (Anthropic), then the next-best fallbacks. Caller can
//  override.
//
//  Return shape (success):
//    { ok: true, provider, model, text, usage, duration_ms, attempts }
//
//  Return shape (all failed):
//    { ok: false, attempts }     // each attempt has { provider, status, error, duration_ms }
//
//  Implementation notes:
//  - JSON mode is enabled wherever the provider supports it. We DON'T
//    parse the JSON here — `text` is returned as-is so the caller
//    can apply its own extraction/normalisation (the JD analyser has
//    extractJSON that handles preambles, code fences, etc.).
//  - The Gemini path uses systemInstruction (1.5+); older models
//    that ignore it just get the system prompt as a no-op header
//    in the user message instead.
//  - Timeouts: per-call AbortController with a 60s budget. The PWA
//    can wait longer for a result if cascading happens.
// =================================================================

const DEFAULT_ORDER = ['anthropic', 'openai', 'mistral', 'gemini'];
const PER_CALL_TIMEOUT_MS = 60_000;

// v3.4.0 round-robin coverage expansion: per-provider model fallback chains.
//
// Why this exists
// ---------------
// The cascade USED to try each provider with a single hardcoded model
// (claude-sonnet-4-20250514, gpt-4o, mistral-large-latest, gemini-1.5-pro).
// If that one model was rate-limited or returned malformed output, the
// cascade moved to the NEXT provider. That's correct for cross-provider
// resilience but misses cheaper or newer alternatives a provider may
// offer — for example, Anthropic's Mythos Preview channel, OpenAI's
// preview tags, or Gemini 3 Pro Preview. Users who would happily accept
// a slightly-less-stable preview model for low-stakes tasks like JSON
// repair or compress_section never got a chance to.
//
// What changed
// ------------
// Each provider now lists an ordered array of models to try. The cascade
// tries each model in turn before falling through to the next provider.
// `opts.models[provider]` accepts either:
//   - string  → single model (backward-compat with pre-3.4.0 callers)
//   - array   → explicit per-provider chain, overrides the default below
// Omitting `opts.models[provider]` uses the PROVIDER_MODELS default.
//
// Order within each provider chain
// --------------------------------
// 1. Latest stable production model (best behaviour, full pricing)
// 2. Same-tier preview / early-access variant if one exists at this date
// 3. One-generation-back stable fallback (still production-grade, lower cost)
// 4. Legacy/older stable as last-resort (compatibility for old keys)
//
// v3.4.0 extension — coverage now reaches deeper into legacy. The motivation
// is real-world BYOK + older-tier accounts: a user might have an Anthropic
// key with only Claude 2.x access (old enterprise contract), or an OpenAI
// key on a project still gated to gpt-4-turbo/gpt-3.5. Without legacy
// entries the cascade declares failure on `model_not_found` even though
// SOME model on that key would work. The model-not-found path now falls
// through to the NEXT model on the same provider (see cascade loop below)
// instead of skipping the provider entirely.
//
// Verified against public model lists 2026-05-18.
//
// MODEL FRESHNESS — CANONICAL LIST. This object is the single source of truth
// for which provider models the cascade tries (current first, older as
// fallback). When a provider ships a new generation or retires one, update it
// HERE. Keep this copy in sync with the demo-proxy copy, and with the
// main-generation default in index.js (the gemini `gemini-2.5-flash` default +
// its `deprecated` remap list). The scheduled freshness check (cron) flags when
// a listed default is no longer returned by the provider's models endpoint.
const PROVIDER_MODELS = {
  anthropic: [
    // Current flagship + 4.x family (2025-2026)
    'claude-sonnet-5',           // 2026-07 preferred: best speed/intelligence, drop-in for 4.6. Adaptive thinking is ON by default -> we send thinking:disabled (see callAnthropic); NO sampling params anywhere in AntCV, so no 400.
    'claude-sonnet-4-20250514',  // stable, current production default for this proxy
    'claude-opus-4-7',           // 2026-04 flagship, available with appropriate tier
    'claude-sonnet-4-6',         // 2026-02 mainline
    'claude-haiku-4-5',          // fast/cheap current
    // 3.x family (still on many production accounts)
    'claude-3-7-sonnet-20250219',// late-2024 generation
    'claude-3-5-sonnet-20241022',// previous-gen stable fallback
    'claude-3-5-sonnet-20240620',// older 3.5 dated pin (some keys still scoped here)
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307',   // legacy compatibility
    // 2.x family (legacy enterprise contracts may only see these)
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2',
  ],
  openai: [
    // GPT-5 family (2025+ flagship)
    'gpt-5.4',                   // current flagship as of 2026-04
    'gpt-5.4-mini',
    'gpt-5',                     // earlier GPT-5
    'gpt-5-mini',
    // GPT-4 family (still widely available)
    'gpt-4o',                    // stable
    'gpt-4o-2024-11-20',         // dated stable variant (explicit pin, sometimes more reliable)
    'gpt-4o-mini',               // cheaper fallback
    'gpt-4.1',                   // alternative stable
    'gpt-4.1-mini',
    'gpt-4-turbo',               // legacy production
    'gpt-4-turbo-2024-04-09',    // dated pin
    'gpt-4',                     // original GPT-4
    // Last-resort legacy (old accounts may only see these)
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
  ],
  mistral: [
    'mistral-large-latest',      // stable rolling tag
    'mistral-large-2411',        // most recent dated pin
    'mistral-large-2407',        // pinned stable fallback if the rolling tag drifts
    'mistral-medium-latest',     // cheaper fallback
    'mistral-medium-2312',       // legacy medium
    'mistral-small-latest',      // last-resort current
    'open-mistral-7b',           // legacy open-weights tier (still on some accounts)
  ],
  gemini: [
    // 2.x family (current as of mid-2026)
    'gemini-2.5-pro',            // current flagship
    'gemini-2.5-flash',          // current fast tier
    'gemini-2.0-flash',          // 2025 fast tier
    // 1.5 family (still serves many production keys)
    'gemini-1.5-pro',            // stable
    'gemini-1.5-pro-002',        // pinned variant
    'gemini-1.5-flash',          // cheaper fallback
    'gemini-1.5-flash-002',
    // 1.0 legacy (early-access / older keys)
    'gemini-1.0-pro',
    'gemini-pro',                // alias the API still accepts
  ],
};

function withTimeout(promise, ms, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`${label} timeout after ${ms}ms`)), ms);
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
}

async function getKeyForProvider(env, provider) {
  // Mirror the env-var precedence used elsewhere in cv-proxy. Kept
  // local to avoid coupling this module to index.js's internals.
  const candidatesByProvider = {
    anthropic: ['ANTHROPIC_API_KEY', 'Anthropic_API_Key', 'Claude_API_Key', 'CLAUDE_API_KEY'],
    openai:    ['OPENAI_API_KEY', 'OpenAI_API_Key', 'OpenAI_APIKEY', 'ChatGPT_API_Key', 'CHATGPT_API_KEY'],
    mistral:   ['Mistral_API_Key', 'MISTRAL_API_KEY', 'MISTRAL_KEY'],
    gemini:    ['Gemini_API_Key', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  };
  const candidates = candidatesByProvider[provider] || [];
  if (!env || !candidates.length) return '';
  for (const name of candidates) {
    const v = env[name];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}


// ─── Provider-specific call functions ────────────────────────────
//
// All four return the same shape:
//   { ok: true, text, model, usage, status }                 on success
//   { ok: false, status, error, body? }                       on failure
//
// They don't catch network errors — those bubble up so the
// caller can record them with the same error shape.

async function callAnthropic(key, system, userPrompt, model) {
  const m = model || 'claude-sonnet-5';
  const { signal, cleanup } = withTimeout(null, PER_CALL_TIMEOUT_MS, 'anthropic');
  // SONNET-5-DROP-IN-001 (2026-07): claude-sonnet-5 turns ADAPTIVE THINKING ON BY DEFAULT, and
  // max_tokens is a HARD cap on thinking+response COMBINED — so a fixed 8000 budget could starve
  // the JSON response these cascade tasks depend on. Send thinking:{type:"disabled"} to preserve
  // the 4.6-era behaviour (full budget for the response). ONLY for sonnet-5: older fallback models
  // (3.x/2.x) reject an unknown `thinking` field. sonnet-5 also 400s on non-default sampling params
  // (temperature/top_p/top_k) — AntCV sends none, so nothing to strip.
  const __body = {
    model: m,
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  };
  if (/claude-sonnet-5/.test(m)) __body.thinking = { type: 'disabled' };
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(__body),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON response' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.content?.[0]?.text || '';
  if (!text) return { ok: false, status, error: 'empty content' };
  return { ok: true, text, model: data.model || m, usage: data.usage || null, status };
}

async function callOpenAI(key, system, userPrompt, model) {
  const m = model || 'gpt-4o';
  const { signal, cleanup } = withTimeout(null, PER_CALL_TIMEOUT_MS, 'openai');
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
        max_tokens: 8000,
        // JSON mode forces a parseable JSON object response. Trusted
        // by every gpt-4*/o* model since 2023-11.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON response' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) return { ok: false, status, error: 'empty content' };
  return { ok: true, text, model: data.model || m, usage: data.usage || null, status };
}

async function callMistral(key, system, userPrompt, model) {
  const m = model || 'mistral-large-latest';
  const { signal, cleanup } = withTimeout(null, PER_CALL_TIMEOUT_MS, 'mistral');
  let res;
  try {
    res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: m,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON response' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) return { ok: false, status, error: 'empty content' };
  return { ok: true, text, model: data.model || m, usage: data.usage || null, status };
}

async function callGemini(key, system, userPrompt, model) {
  // Gemini's REST endpoint pattern: /v1beta/models/<model>:generateContent
  // The 1.5+ generation accepts systemInstruction as a separate field;
  // older models would ignore it (no harm).
  const m = model || 'gemini-1.5-pro';
  const { signal, cleanup } = withTimeout(null, PER_CALL_TIMEOUT_MS, 'gemini');
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          // Gemini's JSON-mode flag. Forces a structured JSON response.
          responseMimeType: 'application/json',
          maxOutputTokens: 8000,
        },
      }),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON response' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) return { ok: false, status, error: 'empty content' };
  return { ok: true, text, model: m, usage: data.usageMetadata || null, status };
}


const PROVIDER_FNS = {
  anthropic: callAnthropic,
  openai:    callOpenAI,
  mistral:   callMistral,
  gemini:    callGemini,
};

// ------------------------------------------------------------------
// GEN-MODELROLE-001 v1 (2026-06-12, fail-soft).
// env.MODEL_ROLES is an OPTIONAL JSON map of role -> provider id:
//   {"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}
// When a caller passes opts.role and the map names a known provider
// for that role, the provider moves to the HEAD of the cascade order;
// the rest of the failover ladder follows unchanged (the map REORDERS,
// it never removes). Absent / malformed map, unknown role, or unknown
// provider -> the order is returned untouched, so deployments without
// the var behave byte-identically to before this change.
// Design: docs/plan/GEN-MODELROLE-001_design.md
// ------------------------------------------------------------------
export function parseModelRoles(env) {
  try {
    const raw = env && env.MODEL_ROLES;
    if (!raw) return null;
    const map = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
    const out = {};
    for (const role of ['writer', 'supervisor', 'coherence']) {
      const p = String(map[role] || '').toLowerCase().trim();
      if (PROVIDER_FNS[p]) out[role] = p;
    }
    return Object.keys(out).length ? out : null;
  } catch (_) { return null; }
}

export function roleHeadOrder(env, role, baseOrder) {
  const order = Array.isArray(baseOrder) && baseOrder.length ? baseOrder : DEFAULT_ORDER;
  try {
    const roles = parseModelRoles(env);
    const head = roles && role ? roles[role] : null;
    if (!head || order[0] === head) return order;
    return [head].concat(order.filter((p) => p !== head));
  } catch (_) { return order; }
}


/**
 * Try each provider in order until one returns ok. Skips providers
 * whose API keys aren't configured (records them in attempts with
 * status 'no-key' so the caller can hint to the user). Returns the
 * first successful result plus the per-attempt log.
 *
 * @param {object} env              Worker env binding
 * @param {string} system           System prompt
 * @param {string} userPrompt       User-message content
 * @param {object} [opts]
 * @param {string[]} [opts.order]   Provider order (default anthropic→openai→mistral→gemini)
 * @param {object}   [opts.models]  Per-provider model overrides {anthropic: 'claude-...', openai: 'gpt-4o', ...}
 * @param {function} [opts.validate]  Optional async (text) => true|false. If provided
 *                                    and returns falsy, the attempt is logged as
 *                                    `validation-failed` and the cascade continues
 *                                    to the next provider. Use this so a single
 *                                    provider's malformed JSON doesn't terminate
 *                                    the cascade — added v1.40.47 / cv-proxy v2.2
 *                                    after the kernel-extraction endpoint surfaced
 *                                    truncated JSON from Anthropic and never tried
 *                                    OpenAI/Mistral/Gemini.
 * @returns {Promise<object>}
 */
export async function callAnyLLMForJSON(env, system, userPrompt, opts = {}) {
  // GEN-MODELROLE-001: opts.role ('writer' | 'supervisor' | 'coherence')
  // reorders the cascade head via env.MODEL_ROLES. No role / no map ->
  // the order is exactly what it was before.
  const role = typeof opts.role === 'string' && opts.role ? opts.role : null;
  let order = Array.isArray(opts.order) && opts.order.length ? opts.order : DEFAULT_ORDER;
  if (role) order = roleHeadOrder(env, role, order);
  const models = opts.models || {};
  const validate = typeof opts.validate === 'function' ? opts.validate : null;
  const attempts = [];
  for (const provider of order) {
    const fn = PROVIDER_FNS[provider];
    if (!fn) {
      attempts.push({ provider, status: 'unknown-provider', error: `no handler for ${provider}` });
      continue;
    }
    const key = await getKeyForProvider(env, provider);
    if (!key) {
      attempts.push({ provider, status: 'no-key', error: 'no API key configured' });
      continue;
    }
    // v3.4.0 round-robin coverage: per-provider model fallback chain.
    // - String value → single-model behaviour (pre-3.4.0 compatibility)
    // - Array value  → caller-supplied chain
    // - undefined    → use PROVIDER_MODELS default chain
    const override = models[provider];
    let modelChain;
    if (Array.isArray(override) && override.length) modelChain = override.slice();
    else if (typeof override === 'string' && override) modelChain = [override];
    else modelChain = (PROVIDER_MODELS[provider] || []).slice();
    if (!modelChain.length) modelChain = [undefined];  // let callX use its own default

    let providerSettled = false;
    for (const model of modelChain) {
      const t0 = Date.now();
      let result;
      try {
        result = await fn(key, system, userPrompt, model);
      } catch (e) {
        attempts.push({
          provider,
          model: model || '(default)',
          status: 'exception',
          error: String(e && e.message || e),
          duration_ms: Date.now() - t0,
        });
        // Exceptions are usually network/timeout — try the next model
        // in this provider's chain before giving up on the provider.
        continue;
      }
      const duration_ms = Date.now() - t0;
      if (result.ok) {
        if (validate) {
          let validated;
          try { validated = await validate(result.text); }
          catch (e) { validated = false; }
          if (!validated) {
            attempts.push({
              provider,
              model: model || '(default)',
              status: 'validation-failed',
              error: 'response failed caller-supplied validator (e.g. unparseable JSON)',
              raw_preview: String(result.text || '').slice(0, 200),
              duration_ms,
            });
            // Validation failed — try next model in chain, then next provider.
            continue;
          }
        }
        attempts.push({
          provider,
          model: result.model || model || '(default)',
          status: result.status,
          ok: true,
          duration_ms,
        });
        return {
          ok: true,
          provider,
          model: result.model || model,
          role,
          text: result.text,
          usage: result.usage,
          duration_ms,
          attempts,
        };
      }
      attempts.push({
        provider,
        model: model || '(default)',
        status: result.status,
        error: result.error,
        duration_ms,
      });
      // 401 / 403 are credential problems — no point trying more models
      // with the same key. Skip to the next provider immediately.
      if (result.status === 401 || result.status === 403) {
        providerSettled = true;
        break;
      }
      // 404 needs a closer look. Providers return 404 in two distinct ways:
      //   • Endpoint-level — the URL itself is wrong (provider-wide;
      //     skipping models won't help). The error text usually mentions
      //     "endpoint" or contains no model context.
      //   • Model-level — the credential is valid but this specific model
      //     isn't available on the key (legacy account, deprecated SKU,
      //     wrong region). Anthropic/OpenAI/Mistral surface this with
      //     "model" or "not_found_error" or "does not exist" in the
      //     error message. In that case, the NEXT model in our chain may
      //     still work — DON'T skip the provider.
      if (result.status === 404) {
        const errMsg = String(result.error || '').toLowerCase();
        const looksLikeModelNotFound =
          errMsg.includes('model') ||
          errMsg.includes('not_found_error') ||
          errMsg.includes('does not exist') ||
          errMsg.includes('does not have access') ||
          errMsg.includes('not available');
        if (!looksLikeModelNotFound) {
          providerSettled = true;
          break;
        }
        // Otherwise fall through and try the next model in the chain.
      }
      // 400 / 429 / 5xx — try next model in this provider's chain
      // before falling through to the next provider.
    }
    if (providerSettled) continue;
  }
  return { ok: false, attempts };
}

// Exports for unit testing.
export { callAnthropic, callOpenAI, callMistral, callGemini, getKeyForProvider, DEFAULT_ORDER, PROVIDER_MODELS };

// v3.3.0: explicit text-mode alias. callAnyLLMForJSON's name implies
// it's only for JSON tasks, but the function itself never parses JSON
// — it just returns the model's text. Many callers (supervisor's
// grounding + repair passes, for instance) want the cascade for plain
// text. Aliasing avoids the confusing name when round-robin coverage
// is the only thing needed.
export const callAnyLLMForText = callAnyLLMForJSON;
