// byok-cost-audit.test.mjs
// ============================================================
// BYOK-COST-AUDIT-001 (owner 2026-07-05): byok-qualify.js's own docstring
// documented `total_cost_usd_est` in qualifyEndpoint()'s return shape since
// this file's first version, but the field was NEVER actually computed —
// a BYOK provider could pass every quality probe (verdict: approved) while
// its real per-token cost went completely untracked (e.g. an xAI Grok model
// id that didn't match any entry in demo-enforcement.js's RATES table
// silently fell through to the fallback rate with zero visibility). Fixed:
// every probe's real token usage is now priced against the SAME rate table
// demo-enforcement.js's demo-spending-cap already uses (imported, not
// duplicated), and the result carries total_cost_usd_est plus a side-by-side
// comparison against this app's own canonical default model.
//
// Run from inside workers/proxy/:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifyEndpoint, TEST_BATTERY } from '../src/byok-qualify.js';
import { estimateCostUsd, rateFor } from '../src/demo-enforcement.js';

// A minimal openai_compat-shaped success response satisfying every probe's
// checks (same fixture shape as byok-qualify-cache.test.mjs), so every run
// qualifies 'approved' and every probe reports real token usage.
function successBody(probe) {
  if (probe.task === 'extract_kernel') return { role: 'x', seniority: 'x', top_skills: ['go'] };
  if (probe.task === 'generate_full') return { content: 'No bracketed placeholders here.' };
  if (probe.task === 'enrich_section') return { bullet: 'Rewrote the team solution cleanly.' };
  if (probe.task === 'compress_section') return { compressed: 'short enough' };
  if (probe.task === 'translate_chunk') {
    const shaped = {};
    for (const spec of probe.checks) {
      const [rule, field] = String(spec).split(':');
      if (rule === 'preserve_numbers') shaped[field] = '250 10 7 3';
      else if (rule === 'preserve_emojis') shaped[field] = '🚀 📉 👥';
    }
    return shaped;
  }
  return {};
}

// Fixed token usage per probe so the expected total is deterministic:
// 6 probes * (100 in, 200 out) = 600 in, 1200 out.
const TOKENS_IN_PER_PROBE = 100;
const TOKENS_OUT_PER_PROBE = 200;

function installFetchStub(t, { usage } = {}) {
  const original = global.fetch;
  global.fetch = async (url, req) => {
    const body = JSON.parse(req.body);
    const probe = Object.values(TEST_BATTERY).find((p) => p.system === body.messages[0].content);
    const content = JSON.stringify(successBody(probe));
    return {
      status: 200,
      json: async () => ({
        choices: [{ message: { content } }],
        usage: usage !== undefined ? usage : { prompt_tokens: TOKENS_IN_PER_PROBE, completion_tokens: TOKENS_OUT_PER_PROBE },
      }),
    };
  };
  t.after(() => { global.fetch = original; });
}

const N_PROBES = Object.keys(TEST_BATTERY).length;
const TOTAL_IN = N_PROBES * TOKENS_IN_PER_PROBE;
const TOTAL_OUT = N_PROBES * TOKENS_OUT_PER_PROBE;

test('total_cost_usd_est is now genuinely computed (was documented but never wired)', async (t) => {
  installFetchStub(t);
  const result = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'gpt-4o' }, {});
  const expected = estimateCostUsd('gpt-4o', TOTAL_IN, TOTAL_OUT);
  assert.ok(expected > 0, 'sanity: gpt-4o must have a real, non-zero rate');
  assert.equal(result.total_cost_usd_est, expected);
  assert.equal(result.total_tokens_in, TOTAL_IN);
  assert.equal(result.total_tokens_out, TOTAL_OUT);
});

test('an unrecognized model id (e.g. a brand-new Grok variant) still gets priced, via the fallback rate, not silently zero', async (t) => {
  installFetchStub(t);
  const result = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'grok-99-not-in-any-table' }, {});
  const [inRate, outRate] = rateFor('grok-99-not-in-any-table');
  assert.ok(result.total_cost_usd_est > 0, 'an unmatched model must still price via FALLBACK_RATE, never read as free');
  assert.deepEqual(result.provider_rate_per_million_usd, { input: inRate, output: outRate });
});

test('a known xAI Grok model id is priced from the real Grok rate table entry, not the generic fallback', async (t) => {
  installFetchStub(t);
  const result = await qualifyEndpoint({ url: 'https://api.x.ai/v1/chat/completions', apiKey: 'sk-test', modelId: 'grok-4-fast' }, {});
  const [inRate, outRate] = rateFor('grok-4-fast');
  // grok-4-fast is a real, dedicated RATES entry — must NOT equal the
  // $3/$15 FALLBACK_RATE (that was the exact silent-mispricing bug).
  assert.notDeepEqual([inRate, outRate], [3.00, 15.00]);
  assert.deepEqual(result.provider_rate_per_million_usd, { input: inRate, output: outRate });
});

test('canonical_reference compares against claude-sonnet-5 using the SAME token counts (apples-to-apples)', async (t) => {
  installFetchStub(t);
  const result = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'gpt-4o-mini' }, {});
  assert.equal(result.canonical_reference.model, 'claude-sonnet-5');
  const expectedCanonicalCost = estimateCostUsd('claude-sonnet-5', TOTAL_IN, TOTAL_OUT);
  assert.equal(result.canonical_reference.cost_usd_est_same_usage, expectedCanonicalCost);
});

test('cost_vs_canonical labels a much-cheaper provider "cheaper" and a much-pricier one "pricier"', async (t) => {
  installFetchStub(t);
  const cheap = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'gemini-1.5-flash' }, {});
  assert.equal(cheap.cost_vs_canonical, 'cheaper');

  const pricey = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'claude-opus-4' }, {});
  assert.equal(pricey.cost_vs_canonical, 'pricier');
});

test('a rejected/failed probe contributes zero tokens (never throws when usage is absent)', async (t) => {
  const original = global.fetch;
  global.fetch = async () => ({ status: 500, json: async () => ({ error: { message: 'boom' } }) });
  t.after(() => { global.fetch = original; });
  const result = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'gpt-4o' }, {});
  assert.equal(result.total_tokens_in, 0);
  assert.equal(result.total_tokens_out, 0);
  assert.equal(result.total_cost_usd_est, 0);
});

test('missing usage in the provider response degrades to zero tokens for that probe, never throws', async (t) => {
  installFetchStub(t, { usage: {} });
  const result = await qualifyEndpoint({ url: 'https://example.test/v1/chat', apiKey: 'sk-test', modelId: 'gpt-4o' }, {});
  assert.equal(result.total_cost_usd_est, 0);
});
