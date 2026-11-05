// llm-provider-normalise.test.mjs
// LLM-LOG-CUSTOM-PROVIDER-001 (2026-11-03): the relay's provider whitelist (claude / openai / mistral
// / gemini) dropped every llm_call from a user-added "custom:<id>" endpoint, so those users left no
// telemetry at all. They now collapse into one "custom" bucket (the id is the user's own and stays
// out of the shared table); "anthropic" (the proxy's wording) lands in the claude bucket; anything
// else is still rejected.
// Run: node --test workers/access-relay/tests/llm-provider-normalise.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertLlmCall } from '../src/telemetry.js';

function fakeEnv() {
  const inserts = [];
  return {
    inserts,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() { return null; },                       // no llm_provider_costs override row
              async run() { inserts.push({ sql, args }); return { meta: { last_row_id: inserts.length } }; },
            };
          },
        };
      },
    },
  };
}
const ev = (provider) => ({ event: 'llm_call', task: 'compress', provider, model: 'claude-sonnet-5', input_tokens: 100, output_tokens: 10, ts: 1793700000000 });
// INSERT bind order: ts, user_hash, provider, ...
const providerOf = (env) => env.inserts[0] && env.inserts[0].args[2];

test('the four known providers are stored as themselves', async () => {
  for (const p of ['claude', 'openai', 'mistral', 'gemini', ' Gemini ']) {
    const env = fakeEnv();
    assert.ok(await insertLlmCall(env, null, ev(p)), p);
    assert.equal(providerOf(env), p.trim().toLowerCase());
  }
});

test('custom:<id> collapses to "custom" and the id never reaches D1', async () => {
  const env = fakeEnv();
  assert.ok(await insertLlmCall(env, null, ev('custom:my-private-endpoint-42')));
  assert.equal(providerOf(env), 'custom');
  assert.ok(!JSON.stringify(env.inserts[0].args).includes('my-private-endpoint-42'));
});

test('"anthropic" (the proxy wording) lands in the claude bucket', async () => {
  const env = fakeEnv();
  assert.ok(await insertLlmCall(env, null, ev('anthropic')));
  assert.equal(providerOf(env), 'claude');
});

test('unknown providers, an empty custom id and non-strings are still dropped', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    for (const p of ['totally-fake-llm', 'custom:', 'custom', 'custom: spaced', '', null, 42]) {
      const env = fakeEnv();
      assert.equal(await insertLlmCall(env, null, ev(p)), null, String(p));
      assert.equal(env.inserts.length, 0, String(p));
    }
  } finally { console.warn = warn; }
});
