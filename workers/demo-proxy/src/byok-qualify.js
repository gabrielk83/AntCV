// =================================================================
//  byok-qualify.js
//
//  F1 — Custom LLM provider audit dispatcher.
//
//  Accepts a user-supplied LLM endpoint (URL + API key + model id +
//  provider shape) and runs a fixed battery of test prompts against
//  it. Each probe is scored against the signals it exercises; the
//  endpoint is approved / conditional / rejected based on which task
//  tiers it qualifies for.
//
//  Why this module is separate from multi-llm.js
//  ---------------------------------------------
//  multi-llm.js calls the canonical Anthropic / OpenAI / Mistral /
//  Gemini endpoints with cv-proxy's own server keys. This module
//  calls an arbitrary URL with a user-supplied key — that's a
//  different security boundary, a different network shape (the URL
//  isn't known at compile time), and a different goal (qualification
//  scoring, not production output). Keeping them separate makes the
//  audit trail in `wrangler tail` easier to read.
//
//  Supported provider shapes
//  -------------------------
//    'openai_compat' — POST {model, messages: [...]} to <url>, expect
//                       {choices: [{message: {content}}]} back.
//                       Covers: OpenAI, Mistral, Together.ai,
//                       Anyscale, vLLM, llama.cpp's OpenAI bridge,
//                       LM Studio, Ollama's OpenAI compatibility layer.
//
//    'anthropic'     — POST {model, max_tokens, system, messages}
//                       to <url>, expect {content: [{text}]} back.
//                       Header is `x-api-key` + `anthropic-version`.
//                       Covers self-hosted Anthropic-compatible APIs.
//
//  Return shape (success):
//    { ok, verdict, approved_tasks, rejected_tasks,
//      per_probe_results: { probeId: {passed, latency_ms, signals, error?} },
//      total_cost_usd_est, total_latency_ms }
//
//  Return shape (bad request):
//    { ok: false, error }
//
//  BYOK-COST-AUDIT-001 (owner 2026-07-05): this docstring has documented
//  `total_cost_usd_est` in the return shape since this file's very first
//  version, but the field was NEVER actually computed — qualifyEndpoint()
//  built its result object without it. A BYOK provider could pass every
//  quality probe (verdict: approved) while its actual per-token cost went
//  completely untracked, e.g. a model whose id didn't match any entry in
//  demo-enforcement.js's RATES table silently fell through to the fallback
//  rate with no visibility to the user or the PWA's audit UI. Fixed below:
//  every probe's token usage is now priced against the SAME rate table
//  in demo-enforcement.js (imported, not duplicated, so quarterly rate
//  audits stay in one place), and the result now genuinely carries
//  total_cost_usd_est plus a side-by-side comparison against this app's
//  canonical default model, so the user can see BOTH quality and relative
//  cost before trusting a new BYOK provider.
// =================================================================

import { estimateCostUsd, rateFor } from './demo-enforcement.js';

const PROBE_TIMEOUT_MS = 30_000;

// The app's own default/canonical model (see multi-llm.js — claude-sonnet-5
// is the preferred first Anthropic model) — the reference point a new BYOK
// provider's cost is compared against so "approved but 6x the price" is
// visible, not just "approved".
const CANONICAL_REFERENCE_MODEL = 'claude-sonnet-5';

// PERF-QUALIFY-CACHE-001: qualifyEndpoint runs the full probe battery (6 real
// LLM calls) against the user's endpoint. Routing/model-picker code paths
// call this repeatedly for the same (provider_shape, url, modelId, apiKey)
// tuple within a session — caching the verdict avoids re-paying that latency
// and cost. TTL is short enough that a genuinely fixed endpoint (rotated key,
// swapped model) is re-qualified well within a working day.
const QUALIFY_CACHE_TTL_SECONDS = 12 * 60 * 60;
const QUALIFY_CACHE_PREFIX = 'byok_qualify:';

// Cache key is a hash of the full tuple INCLUDING the apiKey, so cache
// entries never collide across two different keys pointed at the same URL —
// the raw key itself is never stored, only its digest.
async function qualifyCacheKey(opts) {
  const material = [
    opts.provider_shape || 'openai_compat',
    opts.url,
    opts.modelId,
    opts.apiKey,
  ].join(' ');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return QUALIFY_CACHE_PREFIX + hex;
}

// ─── Test battery — must stay in sync with the PWA's
//     antcv-llm-audit.js TEST_BATTERY definitions ────────────────────
//
// Each probe defines:
//   - task          : task id this probe exercises
//   - system, user  : prompts to send
//   - checks        : list of check ids to run on the response text
//   - criticality   : 'high' | 'medium' | 'low'
//                     Approval requires ALL high probes to pass.
//
const TEST_BATTERY = {
  json_compact: {
    task: 'extract_kernel',
    system: 'You are a structured-data extractor. Reply ONLY with valid JSON, no preamble, no markdown fences.',
    user:
      'Schema: {"role":"string","seniority":"string","top_skills":["string"]}. ' +
      'Test JD: "Senior backend engineer, Go, Postgres, distributed systems, Copenhagen-based."',
    checks: ['json_valid', 'fields_complete:role,seniority,top_skills'],
    criticality: 'high',
  },
  placeholder_resilience: {
    task: 'generate_full',
    system: 'You are filling a CV section. Reply ONLY with valid JSON: {"content":"string"}. Do not use placeholders like [name], [your role], or square-bracketed tokens.',
    user: 'Subject: "Two-sentence professional profile for a structural engineer with 12 years experience."',
    checks: ['json_valid', 'no_placeholders:content'],
    criticality: 'high',
  },
  banned_word_compliance: {
    task: 'enrich_section',
    system: 'You are rewriting a CV bullet. Reply ONLY with JSON: {"bullet":"string"}.',
    user:
      'Rewrite this without using ANY of these words: leverage, robust, comprehensive, holistic, cross-functional. ' +
      'Original: "Leveraged cross-functional teams to build a robust, comprehensive solution."',
    checks: ['json_valid', 'no_banned_words:bullet:leverage,robust,comprehensive,holistic,cross-functional'],
    criticality: 'high',
  },
  length_conformance: {
    task: 'compress_section',
    system: 'You are compressing CV text. Reply ONLY with JSON: {"compressed":"string"}.',
    user:
      'Compress to UNDER 140 characters. ' +
      'Original: "I have spent the last fifteen years working on optical and electro-optical systems across automotive, defence, and consumer applications."',
    checks: ['json_valid', 'max_length:compressed:140'],
    criticality: 'medium',
  },
  number_preservation: {
    task: 'translate_chunk',
    system: 'You are translating CV text into Danish. Reply ONLY with JSON: {"da":"string"}. Preserve ALL numbers exactly.',
    user: 'English: "Reduced cycle time from 250 to 10 days. Built 7-person team across 3 sites."',
    checks: ['json_valid', 'preserve_numbers:da:250,10,7,3'],
    criticality: 'medium',
  },
  emoji_preservation: {
    task: 'translate_chunk',
    system: 'You are translating CV text into Danish. Reply ONLY with JSON: {"da":"string"}. Preserve ALL emojis exactly in the same positions.',
    user: 'English: "🚀 Launched product. 📉 Cut costs. 👥 Led the team."',
    checks: ['json_valid', 'preserve_emojis:da:🚀,📉,👥'],
    criticality: 'low',
  },
};

// ─── HTTP dispatchers per shape ─────────────────────────────────────

function makeTimeoutSignal(ms, label) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`${label} timeout after ${ms}ms`)), ms);
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
}

async function callOpenAICompat(url, apiKey, modelId, system, user) {
  const { signal, cleanup } = makeTimeoutSignal(PROBE_TIMEOUT_MS, 'openai_compat');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
        max_tokens: 1500,
      }),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON HTTP response from endpoint' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) return { ok: false, status, error: 'empty content in response' };
  const usage = data.usage || {};
  return {
    ok: true,
    text,
    tokens_in: usage.prompt_tokens || 0,
    tokens_out: usage.completion_tokens || 0,
  };
}

async function callAnthropicCompat(url, apiKey, modelId, system, user) {
  const { signal, cleanup } = makeTimeoutSignal(PROBE_TIMEOUT_MS, 'anthropic');
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });
  } finally { cleanup(); }
  const status = res.status;
  let data;
  try { data = await res.json(); }
  catch { return { ok: false, status, error: 'non-JSON HTTP response from endpoint' }; }
  if (status !== 200) {
    return { ok: false, status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  }
  const text = data.content?.[0]?.text || '';
  if (!text) return { ok: false, status, error: 'empty content in response' };
  const usage = data.usage || {};
  return {
    ok: true,
    text,
    tokens_in: usage.input_tokens || 0,
    tokens_out: usage.output_tokens || 0,
  };
}

// ─── Scoring engine ─────────────────────────────────────────────────
// Each check id has the shape `<rule>` or `<rule>:<arg1>:<arg2>...`.
// The rule decides whether the probe's response satisfies the constraint.

function tryParseJSON(text) {
  // Strip markdown code fences if the LLM wrapped its JSON.
  const stripped = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try { return { ok: true, value: JSON.parse(stripped) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function applyChecks(checkSpecs, probeResponseText) {
  // Each check returns { id, passed, detail? }.
  const results = [];
  const parsed = tryParseJSON(probeResponseText);

  for (const spec of checkSpecs) {
    const parts = String(spec).split(':');
    const rule = parts[0];

    if (rule === 'json_valid') {
      results.push({ id: rule, passed: parsed.ok, detail: parsed.ok ? null : parsed.error });
      continue;
    }

    // All remaining rules need parsed JSON to evaluate the relevant field.
    if (!parsed.ok) {
      results.push({ id: spec, passed: false, detail: 'response is not valid JSON' });
      continue;
    }
    const obj = parsed.value;

    if (rule === 'fields_complete') {
      const required = (parts[1] || '').split(',').filter(Boolean);
      const missing = required.filter(f => obj[f] == null || (typeof obj[f] === 'string' && !obj[f].trim()) || (Array.isArray(obj[f]) && !obj[f].length));
      results.push({ id: spec, passed: missing.length === 0, detail: missing.length ? 'missing fields: ' + missing.join(',') : null });
    } else if (rule === 'no_placeholders') {
      const field = parts[1];
      const v = String(obj[field] || '');
      const placeholderRx = /\[[A-Za-z][^\]]{1,30}\]|\{\{[^}]+\}\}/g;
      const hits = v.match(placeholderRx) || [];
      results.push({ id: spec, passed: hits.length === 0, detail: hits.length ? 'placeholders: ' + hits.slice(0, 3).join(', ') : null });
    } else if (rule === 'no_banned_words') {
      const field = parts[1];
      const banned = (parts[2] || '').split(',').filter(Boolean);
      const v = String(obj[field] || '').toLowerCase();
      const hits = banned.filter(w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(v));
      results.push({ id: spec, passed: hits.length === 0, detail: hits.length ? 'used: ' + hits.join(', ') : null });
    } else if (rule === 'max_length') {
      const field = parts[1];
      const max = parseInt(parts[2], 10);
      const v = String(obj[field] || '');
      results.push({ id: spec, passed: v.length <= max, detail: v.length > max ? 'len=' + v.length + ' > ' + max : null });
    } else if (rule === 'preserve_numbers') {
      const field = parts[1];
      const required = (parts[2] || '').split(',').filter(Boolean);
      const v = String(obj[field] || '');
      const missing = required.filter(n => !v.includes(n));
      results.push({ id: spec, passed: missing.length === 0, detail: missing.length ? 'missing numbers: ' + missing.join(',') : null });
    } else if (rule === 'preserve_emojis') {
      const field = parts[1];
      const required = (parts[2] || '').split(',').filter(Boolean);
      const v = String(obj[field] || '');
      const missing = required.filter(e => !v.includes(e));
      results.push({ id: spec, passed: missing.length === 0, detail: missing.length ? 'missing emojis: ' + missing.join(',') : null });
    } else {
      // Unknown rule — counted as a non-blocker pass.
      results.push({ id: spec, passed: true, detail: 'unknown check rule, skipped' });
    }
  }

  return results;
}

// ─── Probe runner ───────────────────────────────────────────────────

async function runProbe(probeId, probe, opts) {
  const start = Date.now();
  let resp;
  try {
    if (opts.provider_shape === 'anthropic') {
      resp = await callAnthropicCompat(opts.url, opts.apiKey, opts.modelId, probe.system, probe.user);
    } else {
      // Default to openai_compat for everything else; the body shape
      // is the most widely-supported convention.
      resp = await callOpenAICompat(opts.url, opts.apiKey, opts.modelId, probe.system, probe.user);
    }
  } catch (e) {
    return {
      probeId,
      passed: false,
      latency_ms: Date.now() - start,
      error: 'network: ' + (e && e.message || String(e)),
      checks: [],
    };
  }
  const latency_ms = Date.now() - start;

  if (!resp.ok) {
    return { probeId, passed: false, latency_ms, error: resp.error || 'unknown error', status: resp.status, checks: [] };
  }

  const checkResults = applyChecks(probe.checks, resp.text);
  const allPassed = checkResults.every(c => c.passed);

  return {
    probeId,
    passed: allPassed,
    latency_ms,
    tokens_in: resp.tokens_in || 0,
    tokens_out: resp.tokens_out || 0,
    checks: checkResults,
    response_snippet: String(resp.text).slice(0, 240),
  };
}

// ─── Top-level qualifier ────────────────────────────────────────────

async function qualifyEndpoint(opts, env) {
  if (!opts || !opts.url || !opts.apiKey || !opts.modelId) {
    return { ok: false, error: 'url, apiKey, and modelId are required' };
  }
  if (!['openai_compat', 'anthropic'].includes(opts.provider_shape || 'openai_compat')) {
    return { ok: false, error: 'provider_shape must be one of: openai_compat, anthropic' };
  }
  // Cap is a defence against accidental loops / DoS through this endpoint.
  if (opts.url.length > 500) {
    return { ok: false, error: 'url is unreasonably long' };
  }

  const kv = env && env.KV_BINDING;
  let cacheKey = null;
  if (kv && !opts.forceRefresh) {
    cacheKey = await qualifyCacheKey(opts);
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...parsed, cached: true };
      }
    } catch (e) {
      console.warn('[byok-qualify] cache read failed:', e && e.message);
    }
  } else if (kv) {
    cacheKey = await qualifyCacheKey(opts);
  }

  const probeIds = Object.keys(TEST_BATTERY);
  const start = Date.now();

  // Run probes in parallel — they're independent. Each has its own
  // 30s timeout, so the total wall-clock is bounded by the slowest.
  const results = await Promise.all(probeIds.map(id =>
    runProbe(id, TEST_BATTERY[id], opts).catch(err => ({
      probeId: id,
      passed: false,
      error: 'unhandled: ' + (err && err.message || String(err)),
      latency_ms: 0,
      checks: [],
    }))
  ));

  const total_latency_ms = Date.now() - start;

  // Aggregate per-task verdicts.
  const perProbe = {};
  const approved_tasks = new Set();
  const rejected_tasks = new Set();
  let critical_failures = 0;
  let medium_failures = 0;

  for (const r of results) {
    perProbe[r.probeId] = r;
    const probe = TEST_BATTERY[r.probeId];
    if (!probe) continue;
    if (r.passed) {
      approved_tasks.add(probe.task);
    } else {
      rejected_tasks.add(probe.task);
      if (probe.criticality === 'high') critical_failures++;
      else if (probe.criticality === 'medium') medium_failures++;
    }
  }

  // Verdict:
  //   approved   — every critical probe passes AND ≥1 medium passes
  //   conditional — at most 1 critical fails, with explicit task whitelist
  //   rejected   — 2+ critical failures
  let verdict;
  if (critical_failures === 0) verdict = 'approved';
  else if (critical_failures <= 1) verdict = 'conditional';
  else verdict = 'rejected';

  // approved_tasks wins ties with rejected_tasks: if a task has even one
  // passing probe, the user gets the green light for it. The PWA can
  // surface the per-probe detail for nuance.
  for (const t of approved_tasks) rejected_tasks.delete(t);

  // BYOK-COST-AUDIT-001: price the audit run's own real token usage against
  // opts.modelId's rate (demo-enforcement.js's RATES table — the SAME one
  // the demo spending cap uses, so an unrecognized model id degrades to the
  // same conservative FALLBACK_RATE rather than silently reading as free).
  // Compared against this app's own canonical default model, priced on the
  // SAME token counts — an honest like-for-like comparison, since only the
  // per-token rate differs between the two cost figures.
  let total_tokens_in = 0, total_tokens_out = 0;
  for (const r of results) {
    total_tokens_in += r.tokens_in || 0;
    total_tokens_out += r.tokens_out || 0;
  }
  const total_cost_usd_est = estimateCostUsd(opts.modelId, total_tokens_in, total_tokens_out);
  const [providerInRate, providerOutRate] = rateFor(opts.modelId);
  const [canonicalInRate, canonicalOutRate] = rateFor(CANONICAL_REFERENCE_MODEL);
  const canonical_cost_usd_est = estimateCostUsd(CANONICAL_REFERENCE_MODEL, total_tokens_in, total_tokens_out);
  const cost_vs_canonical = canonical_cost_usd_est > 0
    ? (total_cost_usd_est / canonical_cost_usd_est <= 0.7 ? 'cheaper'
      : total_cost_usd_est / canonical_cost_usd_est >= 1.4 ? 'pricier'
      : 'comparable')
    : 'unknown';

  const result = {
    ok: true,
    verdict,
    approved_tasks: Array.from(approved_tasks),
    rejected_tasks: Array.from(rejected_tasks),
    per_probe_results: perProbe,
    total_latency_ms,
    critical_failures,
    medium_failures,
    probes_run: probeIds.length,
    total_cost_usd_est,
    total_tokens_in,
    total_tokens_out,
    provider_rate_per_million_usd: { input: providerInRate, output: providerOutRate },
    canonical_reference: {
      model: CANONICAL_REFERENCE_MODEL,
      rate_per_million_usd: { input: canonicalInRate, output: canonicalOutRate },
      cost_usd_est_same_usage: canonical_cost_usd_est,
    },
    cost_vs_canonical,
  };

  if (kv && cacheKey) {
    try {
      await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: QUALIFY_CACHE_TTL_SECONDS });
    } catch (e) {
      console.warn('[byok-qualify] cache write failed:', e && e.message);
    }
  }

  return { ...result, cached: false };
}

export { qualifyEndpoint, TEST_BATTERY, applyChecks, tryParseJSON, qualifyCacheKey, QUALIFY_CACHE_TTL_SECONDS };
