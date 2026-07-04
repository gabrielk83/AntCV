// byok-qualify-cache.test.mjs
// ============================================================
// PERF-QUALIFY-CACHE-001 — qualifyEndpoint() caches its verdict in
// env.KV_BINDING keyed by a SHA-256 hash of (provider_shape, url, modelId,
// apiKey), so repeated qualification of the same endpoint within the TTL
// window skips the 6-probe LLM battery. Covers: cache miss runs probes +
// stores; cache hit skips fetch entirely; forceRefresh bypasses the cache;
// different url/modelId/apiKey each get distinct cache entries; no KV
// binding falls back to always-run (pre-feature behaviour).
//
// Run from inside workers/proxy/:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualifyEndpoint, qualifyCacheKey, TEST_BATTERY } from '../src/byok-qualify.js';

function fakeKv() {
  const store = new Map();
  return {
    store,
    get: async (k) => (store.has(k) ? store.get(k) : null),
    put: async (k, v) => { store.set(k, v); },
  };
}

// A minimal openai_compat-shaped success response satisfying every probe's
// checks, so the fixture qualifies as fully 'approved'.
function successBody(probe) {
  const shaped = {};
  for (const spec of probe.checks) {
    const [rule, field] = String(spec).split(':');
    if (rule === 'fields_complete') {
      for (const f of field.split(',')) shaped[f] = f === 'top_skills' ? ['go'] : 'x';
    } else if (rule === 'no_placeholders' || rule === 'max_length') {
      shaped[field] = 'short text';
    } else if (rule === 'preserve_numbers') {
      shaped[field] = '250 10 7 3';
    } else if (rule === 'preserve_emojis') {
      shaped[field] = '🚀 📉 👥';
    } else if (rule === 'no_banned_words') {
      shaped[field] = shaped[field] || 'a clean rewrite';
    }
  }
  // json_compact / placeholder_resilience / banned_word_compliance each
  // target one specific field per TEST_BATTERY — fill in the field the
  // probe actually checks for content-free rules too.
  if (probe.task === 'extract_kernel') return { role: 'x', seniority: 'x', top_skills: ['go'] };
  if (probe.task === 'generate_full') return { content: 'No bracketed placeholders here.' };
  if (probe.task === 'enrich_section') return { bullet: 'Rewrote the team solution cleanly.' };
  if (probe.task === 'compress_section') return { compressed: 'short enough' };
  if (probe.task === 'translate_chunk') return shaped;
  return shaped;
}

function installFetchStub(t) {
  let calls = 0;
  const original = global.fetch;
  global.fetch = async (url, req) => {
    calls++;
    const body = JSON.parse(req.body);
    const probe = Object.values(TEST_BATTERY).find((p) => p.system === body.messages[0].content);
    const content = JSON.stringify(successBody(probe));
    return {
      status: 200,
      json: async () => ({ choices: [{ message: { content } }], usage: {} }),
    };
  };
  t.after(() => { global.fetch = original; });
  return () => calls;
}

const BASE_OPTS = { url: 'https://example.test/v1/chat', apiKey: 'sk-test-key', modelId: 'test-model' };

test('cache miss: runs the probe battery and stores the verdict', async (t) => {
  const callCount = installFetchStub(t);
  const kv = fakeKv();
  const result = await qualifyEndpoint({ ...BASE_OPTS }, { KV_BINDING: kv });

  assert.equal(result.ok, true);
  assert.equal(result.cached, false);
  assert.equal(callCount(), Object.keys(TEST_BATTERY).length);
  assert.equal(kv.store.size, 1);
});

test('cache hit: second call with the same tuple skips every probe', async (t) => {
  const callCount = installFetchStub(t);
  const kv = fakeKv();
  const first = await qualifyEndpoint({ ...BASE_OPTS }, { KV_BINDING: kv });
  const before = callCount();
  const second = await qualifyEndpoint({ ...BASE_OPTS }, { KV_BINDING: kv });

  assert.equal(callCount(), before, 'no new fetch calls on cache hit');
  assert.equal(second.cached, true);
  assert.equal(second.verdict, first.verdict);
  assert.deepEqual(second.approved_tasks, first.approved_tasks);
});

test('forceRefresh bypasses the cache and re-runs probes', async (t) => {
  const callCount = installFetchStub(t);
  const kv = fakeKv();
  await qualifyEndpoint({ ...BASE_OPTS }, { KV_BINDING: kv });
  const before = callCount();
  const result = await qualifyEndpoint({ ...BASE_OPTS, forceRefresh: true }, { KV_BINDING: kv });

  assert.equal(result.cached, false);
  assert.equal(callCount(), before + Object.keys(TEST_BATTERY).length);
});

test('distinct url / modelId / apiKey each produce a distinct cache key', async () => {
  const a = await qualifyCacheKey(BASE_OPTS);
  const b = await qualifyCacheKey({ ...BASE_OPTS, url: 'https://example.test/v2/chat' });
  const c = await qualifyCacheKey({ ...BASE_OPTS, modelId: 'other-model' });
  const d = await qualifyCacheKey({ ...BASE_OPTS, apiKey: 'sk-different-key' });
  const keys = new Set([a, b, c, d]);
  assert.equal(keys.size, 4);
});

test('cache key never contains the raw apiKey', async () => {
  const key = await qualifyCacheKey(BASE_OPTS);
  assert.ok(!key.includes(BASE_OPTS.apiKey));
});

test('no KV binding: runs probes every time (pre-feature fallback)', async (t) => {
  const callCount = installFetchStub(t);
  await qualifyEndpoint({ ...BASE_OPTS }, {});
  await qualifyEndpoint({ ...BASE_OPTS }, undefined);
  assert.equal(callCount(), 2 * Object.keys(TEST_BATTERY).length);
});
