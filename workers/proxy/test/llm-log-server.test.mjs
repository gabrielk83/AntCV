// llm-log-server.test.mjs
// LLM-LOG-SERVER-001 (2026-11-03): D1 llm_calls was fed only by the PWA's in-app cascade, so every
// LLM call made on the Worker (JD analysis, supervisor, coherence, kernel, gen-job sections,
// script-driven /v1/messages) left no row and the table read silent for weeks. Locks:
//  - the row shape (provider bucket, client_version tag, retry flags, cost only for KNOWN models);
//  - the logger is a no-op without a DB binding, and never throws when D1 does;
//  - the real callAnyLLMForJSON cascade writes one row per attempt, failures included;
//  - /v1/messages is logged only when a script says who it is (x-antcv-source), never twice for the PWA;
//  - a slow D1 write cannot hold an LLM answer back.
// Run: node --test workers/proxy/test/llm-log-server.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callAnyLLMForJSON, logServerLlmCall, logServerLlmCallBounded, tokensFromUsage, providerFromModel, errorClassFor,
} from '../src/multi-llm.js';
import { __test as T } from '../src/index.js';

function fakeDb({ failWith = null, hangMs = 0 } = {}) {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (hangMs) await new Promise((r) => setTimeout(r, hangMs));
              if (failWith) throw new Error(failWith);
              rows.push({ sql, args });
              return { meta: { last_row_id: rows.length } };
            },
          };
        },
      };
    },
  };
}
// args order in the INSERT: ts, provider, model, task, success, http_status, error_class, error_message,
// latency_ms, prompt_tokens, completion_tokens, total_tokens, was_retry, retry_attempt, cost, client_version
const COLS = ['ts', 'provider', 'model', 'task', 'success', 'http_status', 'error_class', 'error_message',
  'latency_ms', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'was_retry', 'retry_attempt', 'cost', 'client_version'];
const asRow = (r) => Object.fromEntries(COLS.map((c, i) => [c, r.args[i]]));

test('usage shapes, provider buckets and error classes', () => {
  assert.deepEqual(tokensFromUsage({ input_tokens: 10, output_tokens: 4 }), { input: 10, output: 4 });
  assert.deepEqual(tokensFromUsage({ prompt_tokens: 7, completion_tokens: 2 }), { input: 7, output: 2 });
  assert.deepEqual(tokensFromUsage({ promptTokenCount: 5, candidatesTokenCount: 1 }), { input: 5, output: 1 });
  assert.deepEqual(tokensFromUsage(null), { input: null, output: null });
  assert.equal(providerFromModel('claude-sonnet-5', 'openai'), 'claude');
  assert.equal(providerFromModel('gpt-5.4-mini', 'anthropic'), 'openai');
  assert.equal(providerFromModel('mistral-large-latest', ''), 'mistral');
  assert.equal(providerFromModel('gemini-2.5-flash', ''), 'gemini');
  assert.equal(providerFromModel(null, 'anthropic'), 'claude', 'no model: fall back to the x-provider header');
  assert.equal(providerFromModel('some-unknown', 'weirdo'), null);
  assert.equal(errorClassFor({ ok: true }), null);
  assert.equal(errorClassFor({ ok: false, status: 429 }), 'rate_limit');
  assert.equal(errorClassFor({ ok: false, status: 401 }), 'auth');
  assert.equal(errorClassFor({ ok: false, status: 400 }), 'validation');
  assert.equal(errorClassFor({ ok: false, status: 503 }), 'other');
  assert.equal(errorClassFor({ ok: false, kind: 'parse' }), 'parse');
  assert.equal(errorClassFor({ ok: false, kind: 'exception', error: 'anthropic timeout after 60000ms' }), 'timeout');
  assert.equal(errorClassFor({ ok: false, kind: 'exception', error: 'fetch failed' }), 'network');
});

test('row shape: anthropic -> claude bucket, srv: tag, cost only for a known model', async () => {
  const DB = fakeDb();
  await logServerLlmCall({ DB }, { provider: 'anthropic', model: 'claude-sonnet-5', task: 'analysis', source: 'cascade',
    ok: true, status: 200, durationMs: 1234, usage: { input_tokens: 1_000_000, output_tokens: 100_000 } });
  const r = asRow(DB.rows[0]);
  assert.equal(r.provider, 'claude');
  assert.equal(r.task, 'analysis');
  assert.equal(r.success, 1);
  assert.equal(r.client_version, 'srv:cascade');
  assert.equal(r.total_tokens, 1_100_000);
  assert.equal(r.was_retry, 0);
  assert.equal(r.retry_attempt, 1);
  assert.ok(r.cost > 0, 'a known model is priced');
  assert.match(DB.rows[0].sql, /INSERT INTO llm_calls/);

  await logServerLlmCall({ DB }, { provider: 'openai', model: 'zz-model-nobody-priced-9', task: 'x', ok: true, status: 200,
    usage: { prompt_tokens: 100, completion_tokens: 10 }, attempt: 2 });
  const u = asRow(DB.rows[1]);
  assert.equal(u.cost, null, 'an unknown model is NOT priced at a guessed rate');
  assert.equal(u.was_retry, 1);
  assert.equal(u.retry_attempt, 2);
});

test('no DB binding, an unknown provider, or a throwing D1 are all silent no-ops', async () => {
  assert.equal(await logServerLlmCall({}, { provider: 'openai', ok: true }), null);
  assert.equal(await logServerLlmCall({ DB: fakeDb() }, { provider: 'wat', ok: true }), null);
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await logServerLlmCall({ DB: fakeDb({ failWith: 'D1 down' }) }, { provider: 'openai', ok: true }), null); }
  finally { console.warn = warn; }
});

test('a slow D1 write cannot hold an LLM answer back (bounded wait)', async () => {
  const t0 = Date.now();
  const out = await logServerLlmCallBounded({ DB: fakeDb({ hangMs: 4000 }) }, { provider: 'openai', ok: true });
  assert.equal(out, null);
  assert.ok(Date.now() - t0 < 3000, 'gave up after the bound, not after the 4s write');
});

test('callAnyLLMForJSON logs EVERY attempt: a 400 failure, then the success that answered', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('anthropic')) return { status: 400, json: async () => ({ error: { message: 'bad request' } }) };
    return { status: 200, json: async () => ({ model: 'gpt-5.4-mini', choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 200, completion_tokens: 20 } }) };
  };
  try {
    const DB = fakeDb();
    const env = { DB, ANTHROPIC_API_KEY: 'k1', OPENAI_API_KEY: 'k2' };
    const out = await callAnyLLMForJSON(env, 'sys', 'user', { role: 'analysis', order: ['anthropic', 'openai'],
      models: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.4-mini' } });
    assert.equal(out.ok, true);
    assert.equal(out.provider, 'openai');
    const rows = DB.rows.map(asRow);
    assert.equal(rows.length, 2);
    assert.deepEqual([rows[0].provider, rows[0].success, rows[0].http_status, rows[0].error_class, rows[0].retry_attempt],
      ['claude', 0, 400, 'validation', 1]);
    assert.deepEqual([rows[1].provider, rows[1].success, rows[1].prompt_tokens, rows[1].was_retry, rows[1].retry_attempt],
      ['openai', 1, 200, 1, 2]);
    assert.ok(rows.every((r) => r.task === 'analysis' && r.client_version === 'srv:cascade'),
      'task = the role, which is what the weekly tune reads');
  } finally { globalThis.fetch = orig; }
});

test('callAnyLLMForJSON still works with no DB binding (demo-proxy)', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 200, json: async () => ({ content: [{ type: 'text', text: '{"ok":1}' }], model: 'claude-sonnet-5', usage: {} }) });
  try {
    const out = await callAnyLLMForJSON({ ANTHROPIC_API_KEY: 'k' }, 's', 'u', { order: ['anthropic'] });
    assert.equal(out.ok, true);
  } finally { globalThis.fetch = orig; }
});

test('x-antcv-source: only a POST, never /job/, and only a slug, becomes a source tag', () => {
  const req = (method, url, src) => new Request(url, { method, headers: src ? { 'x-antcv-source': src } : {}, body: method === 'POST' ? '{}' : undefined });
  assert.equal(T.serverCallSource(req('POST', 'https://p.example/v1/messages', 'gen-runner')), 'gen-runner');
  assert.equal(T.serverCallSource(req('POST', 'https://p.example/', 'Scripts')), 'scripts');
  assert.equal(T.serverCallSource(req('POST', 'https://p.example/v1/messages')), null, 'the PWA sends no header: it logs client-side');
  assert.equal(T.serverCallSource(req('GET', 'https://p.example/v1/messages', 'gen-runner')), null);
  assert.equal(T.serverCallSource(req('POST', 'https://p.example/job/step', 'gen-runner')), null);
  assert.equal(T.serverCallSource(req('POST', 'https://p.example/v1/messages', 'x; DROP TABLE llm_calls')), null);
});

test('logServerResponse: reads JSON usage + model, logs an error response, skips SSE and a missing DB', async () => {
  const mk = (body, init = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' }, ...init });
  const request = new Request('https://p.example/v1/messages', { method: 'POST', headers: { 'x-provider': 'mistral' }, body: '{}' });

  const DB = fakeDb();
  await T.logServerResponse({ DB }, request, mk({ model: 'mistral-large-latest', usage: { input_tokens: 500, output_tokens: 50 }, content: [] }), 'gen-runner', Date.now() - 800);
  const ok = asRow(DB.rows[0]);
  assert.deepEqual([ok.provider, ok.model, ok.task, ok.success, ok.prompt_tokens, ok.client_version], ['mistral', 'mistral-large-latest', 'generation', 1, 500, 'srv:gen-runner']);
  assert.ok(ok.latency_ms >= 700);

  await T.logServerResponse({ DB }, request, mk({ error: { message: 'rate limited' } }, { status: 429 }), 'gen-job', Date.now());
  const bad = asRow(DB.rows[1]);
  assert.deepEqual([bad.provider, bad.success, bad.http_status, bad.error_class, bad.error_message], ['mistral', 0, 429, 'rate_limit', 'rate limited']);

  const n = DB.rows.length;
  await T.logServerResponse({ DB }, request, new Response('data: x\n\n', { headers: { 'content-type': 'text/event-stream' } }), 'gen-runner', Date.now());
  assert.equal(DB.rows.length, n + 1, 'an SSE body is not read, but the call is still counted (tokens null)');
  assert.equal(asRow(DB.rows[n]).prompt_tokens, null);

  await T.logServerResponse({}, request, mk({ model: 'gpt-5' }), 'gen-runner', Date.now());   // no DB: nothing, no throw
  assert.equal(DB.rows.length, n + 1);
});
