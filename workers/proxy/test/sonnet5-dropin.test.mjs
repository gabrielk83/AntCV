// sonnet5-dropin.test.mjs
// ============================================================
// SONNET-5-DROP-IN-001 (2026-07): wire claude-sonnet-5 into AntCV's Anthropic path.
// claude-sonnet-5 turns adaptive thinking ON by default (max_tokens caps thinking+response
// combined) and 400s on non-default sampling params. AntCV sends NO sampling params, and we
// send thinking:{type:"disabled"} for sonnet-5 ONLY (older fallback models reject the field).
// This drives the REAL callAnthropic (stubbed fetch) + checks PROVIDER_MODELS, and locks the
// pass-through normalizer's intent with a replica.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callAnthropic, PROVIDER_MODELS } from '../src/multi-llm.js';

function stubFetch() {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, body });
    return { status: 200, json: async () => ({ content: [{ text: '{"ok":true}' }], model: body.model, usage: {} }) };
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('claude-sonnet-5 is the preferred (first) anthropic model', () => {
  assert.equal(PROVIDER_MODELS.anthropic[0], 'claude-sonnet-5');
});

test('callAnthropic sends thinking:disabled + NO sampling params for claude-sonnet-5', async () => {
  const s = stubFetch();
  try {
    await callAnthropic('k', 'sys', 'user', 'claude-sonnet-5');
    const b = s.calls[0].body;
    assert.deepEqual(b.thinking, { type: 'disabled' });
    assert.equal('temperature' in b, false);
    assert.equal('top_p' in b, false);
    assert.equal('top_k' in b, false);
    assert.equal(b.model, 'claude-sonnet-5');
    assert.equal(b.max_tokens, 8000);
  } finally { s.restore(); }
});

test('callAnthropic default model is now claude-sonnet-5 (thinking disabled)', async () => {
  const s = stubFetch();
  try {
    await callAnthropic('k', 'sys', 'user');   // no model arg -> default
    const b = s.calls[0].body;
    assert.equal(b.model, 'claude-sonnet-5');
    assert.deepEqual(b.thinking, { type: 'disabled' });
  } finally { s.restore(); }
});

test('callAnthropic does NOT send a thinking field for an OLDER fallback model', async () => {
  const s = stubFetch();
  try {
    await callAnthropic('k', 'sys', 'user', 'claude-3-5-sonnet-20241022');
    assert.equal('thinking' in s.calls[0].body, false);   // 3.x rejects the field
  } finally { s.restore(); }
});

// Replicates the proxy pass-through normalizer condition (index.js ~line 1443) to document +
// lock its intent. The real handler is exercised live; this guards the logic against drift.
function normalizePassThrough(body) {
  if (typeof body.model === 'string' && /claude-sonnet-5/.test(body.model)) {
    if (body.thinking == null) body.thinking = { type: 'disabled' };
    delete body.temperature; delete body.top_p; delete body.top_k;
  }
  return body;
}

test('pass-through normalizer: strips sampling params + disables thinking for sonnet-5', () => {
  const out = normalizePassThrough({ model: 'claude-sonnet-5', max_tokens: 4096, temperature: 0.7, top_p: 0.9, top_k: 40 });
  assert.deepEqual(out.thinking, { type: 'disabled' });
  assert.equal('temperature' in out, false);
  assert.equal('top_p' in out, false);
  assert.equal('top_k' in out, false);
  assert.equal(out.max_tokens, 4096);   // budget preserved
});

test('pass-through normalizer: preserves an explicit thinking opt-in; leaves other models untouched', () => {
  const explicit = normalizePassThrough({ model: 'claude-sonnet-5', thinking: { type: 'enabled' } });
  assert.deepEqual(explicit.thinking, { type: 'enabled' });   // caller opt-in wins
  const other = normalizePassThrough({ model: 'claude-opus-4-7', temperature: 0.7 });
  assert.equal(other.temperature, 0.7);                        // non-sonnet-5 forwarded unchanged
  assert.equal('thinking' in other, false);
});
