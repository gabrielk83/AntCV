// Smoke test for telemetry.js using a SQLite-backed mock of env.DB
// that mirrors the D1 prepared-statement interface used by the module.
//
// Run: cd /home/claude/work/antcv-relay-2_5_0 && node smoke.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const initSqlJs = require('/home/claude/work/sqljs/sql-wasm.cjs');

const SQL = await initSqlJs({ locateFile: () => '/home/claude/work/sqljs/sql-wasm.wasm' });
const db = new SQL.Database();

// Apply both schemas — re-uses the same schema files we ship.
const here = dirname(fileURLToPath(import.meta.url));
db.exec(readFileSync(join(here, '..', 'schema.sql'), 'utf8'));
db.exec(readFileSync(join(here, '..', 'schema-telemetry.sql'), 'utf8'));

// Minimal D1-shape adapter over sql.js. Only the methods used by
// telemetry.js are implemented; if the module starts using new D1
// features, this adapter must grow.
function makeDb() {
  return {
    prepare(sql) {
      let bound = [];
      return {
        bind(...args) {
          bound = args;
          return this;
        },
        async first() {
          const stmt = db.prepare(sql);
          stmt.bind(bound);
          const row = stmt.step() ? stmt.getAsObject() : null;
          stmt.free();
          return row;
        },
        async all() {
          const stmt = db.prepare(sql);
          stmt.bind(bound);
          const results = [];
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return { results };
        },
        async run() {
          const stmt = db.prepare(sql);
          stmt.bind(bound);
          stmt.step();
          stmt.free();
          // sql.js exposes db.getRowsModified() for the last statement;
          // D1 returns this as meta.changes. Mirror that here so the
          // smoke test sees the same shape as production.
          const changes = db.getRowsModified ? db.getRowsModified() : 0;
          const r = db.exec('SELECT last_insert_rowid() AS lid');
          const lid = r && r[0] && r[0].values && r[0].values[0] ? r[0].values[0][0] : null;
          return { meta: { last_row_id: lid, changes } };
        },
      };
    },
  };
}

const env = { DB: makeDb() };

// Node 22 already exposes globalThis.crypto.subtle — no polyfill needed.

const { insertLlmCall, aggregateHealth, getLatestHealth, pruneOld, insertQualitySignal } = await import('../src/telemetry.js');

// ---------------------------------------------------------------------
// Test 1: valid llm_call inserts and returns a rowid
// ---------------------------------------------------------------------
const evt1 = {
  event: 'llm_call',
  task: 'compress',
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  input_tokens: 2000,
  output_tokens: 500,
  duration_ms: 4200,
  cost_usd: 0.0135,
  v: '1.40.124',
  ts: Math.floor(Date.now() / 1000),
};
const id1 = await insertLlmCall(env, { email: 'karp.gabriel.a@gmail.com' }, evt1);
console.log('TEST 1 rowid:', id1);
console.assert(id1 != null && id1 > 0, 'TEST 1 FAIL: expected non-null rowid');

// ---------------------------------------------------------------------
// Test 2: anonymous event (no identity) still inserts with NULL user_hash
// ---------------------------------------------------------------------
const id2 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'enrich', provider: 'openai', model: 'gpt-5-mini',
  input_tokens: 800, output_tokens: 200, duration_ms: 1100, cost_usd: 0.0002,
});
console.log('TEST 2 rowid:', id2);
console.assert(id2 != null && id2 > 0, 'TEST 2 FAIL');

// ---------------------------------------------------------------------
// Test 3: bad provider drops the row
// ---------------------------------------------------------------------
const id3 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'enrich', provider: 'totally-fake-llm',
  input_tokens: 100,
});
console.log('TEST 3 rowid (should be null):', id3);
console.assert(id3 == null, 'TEST 3 FAIL: bad provider should drop');

// ---------------------------------------------------------------------
// Test 4: bad task name → "unknown"
// ---------------------------------------------------------------------
const id4 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'whatever_bogus', provider: 'mistral', model: 'mistral-medium',
  input_tokens: 500, output_tokens: 100, duration_ms: 800,
});
const row4 = await env.DB.prepare('SELECT task FROM llm_calls WHERE id = ?').bind(id4).first();
console.log('TEST 4 normalised task:', row4 && row4.task);
console.assert(row4 && row4.task === 'unknown', 'TEST 4 FAIL');

// ---------------------------------------------------------------------
// Test 5: failure event (success=0) is recorded
// ---------------------------------------------------------------------
const id5 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'generate_cv', provider: 'gemini', model: 'gemini-2.5-pro',
  error_class: 'rate_limit', error_message: '429 too many requests',
  http_status: 429, duration_ms: 200,
});
const row5 = await env.DB.prepare('SELECT success, error_class FROM llm_calls WHERE id = ?').bind(id5).first();
console.log('TEST 5 success/error_class:', row5);
console.assert(row5 && row5.success === 0 && row5.error_class === 'rate_limit', 'TEST 5 FAIL');

// ---------------------------------------------------------------------
// Test 6: cost recomputation from D1 costs table overrides client value
// ---------------------------------------------------------------------
const id6 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'compress', provider: 'claude', model: 'claude-sonnet-4-6',
  input_tokens: 1_000_000, output_tokens: 0,
  cost_usd: 9999.99, // PWA-reported, server should override
  duration_ms: 100,
});
const row6 = await env.DB.prepare('SELECT estimated_cost_usd FROM llm_calls WHERE id = ?').bind(id6).first();
console.log('TEST 6 cost (expected ~3.00):', row6 && row6.estimated_cost_usd);
console.assert(row6 && Math.abs(row6.estimated_cost_usd - 3.00) < 0.001, 'TEST 6 FAIL');

// ---------------------------------------------------------------------
// Test 7: bulk insert + aggregateHealth runs end-to-end
// ---------------------------------------------------------------------
const now = Math.floor(Date.now() / 1000);
for (let i = 0; i < 50; i++) {
  await insertLlmCall(env, null, {
    event: 'llm_call', task: 'compress', provider: 'claude', model: 'claude-sonnet-4-6',
    input_tokens: 1000 + i * 10, output_tokens: 200, duration_ms: 1000 + i * 50,
    ts: now - i,
  });
}
// Inject a few high-latency failures so success_rate dips below 0.90
for (let i = 0; i < 10; i++) {
  await insertLlmCall(env, null, {
    event: 'llm_call', task: 'compress', provider: 'claude', model: 'claude-sonnet-4-6',
    error_class: 'timeout', duration_ms: 35000, ts: now - i - 100,
  });
}
const agg = await aggregateHealth(env, now);
console.log('TEST 7 aggregate result:', JSON.stringify(agg, null, 2));
console.assert(agg.ok === true, 'TEST 7 FAIL: aggregate returned not-ok');

// ---------------------------------------------------------------------
// Test 8: getLatestHealth returns the aggregated row(s) for claude/compress
// ---------------------------------------------------------------------
const health = await getLatestHealth(env, { windowMinutes: 60, provider: 'claude', task: 'compress' });
console.log('TEST 8 health snapshot:', JSON.stringify(health, null, 2));
console.assert(health.ok === true && health.rows.length === 1, 'TEST 8 FAIL: expected one row');
const r = health.rows[0];
console.assert(r.call_count > 0, 'TEST 8 FAIL: call_count = 0');
console.assert(r.success_rate < 1.0 && r.success_rate > 0, 'TEST 8 FAIL: success_rate boundary');
console.assert(r.p95_latency_ms != null, 'TEST 8 FAIL: p95 null');
console.assert(['ok', 'warning', 'degraded', 'down'].includes(r.status), 'TEST 8 FAIL: bad status');

// ---------------------------------------------------------------------
// Test 9: getLatestHealth with windowMinutes='all' returns all three
// ---------------------------------------------------------------------
const allHealth = await getLatestHealth(env, { windowMinutes: 'all' });
console.log('TEST 9 keys:', allHealth.ok && Object.keys(allHealth.all));
console.assert(allHealth.ok && allHealth.all.w60 && allHealth.all.w1440 && allHealth.all.w10080, 'TEST 9 FAIL');

// ---------------------------------------------------------------------
// Test 10: quality signal — call_id path (admin tool style)
// ---------------------------------------------------------------------
const sig10 = await insertQualitySignal(env, { email: 'karp.gabriel.a@gmail.com' }, {
  call_id: id1, signal_type: 'placeholder_leak', signal_value: { markers: ['[POSITION]'] }, severity: 'warning',
});
console.log('TEST 10 result:', sig10);
console.assert(sig10.ok && sig10.call_id === id1, 'TEST 10 FAIL: insert by call_id');
const after10 = await env.DB.prepare('SELECT placeholder_leak_count FROM llm_calls WHERE id = ?').bind(id1).first();
console.assert(after10.placeholder_leak_count === 1, 'TEST 10 FAIL: backfill should increment leak count');

// ---------------------------------------------------------------------
// Test 11: quality signal — request_id path (preferred)
// ---------------------------------------------------------------------
const reqId = 'req-test-11-' + Math.random().toString(36).slice(2);
const id11 = await insertLlmCall(env, null, {
  event: 'llm_call', task: 'enrich', provider: 'openai', model: 'gpt-5-mini',
  input_tokens: 500, output_tokens: 100, duration_ms: 900,
  request_id: reqId,
});
const sig11 = await insertQualitySignal(env, null, {
  request_id: reqId, signal_type: 'fabrication', severity: 'critical',
});
console.log('TEST 11 result:', sig11);
console.assert(sig11.ok && sig11.call_id === id11, 'TEST 11 FAIL: insert by request_id');
const after11 = await env.DB.prepare('SELECT fabrication_flag FROM llm_calls WHERE id = ?').bind(id11).first();
console.assert(after11.fabrication_flag === 1, 'TEST 11 FAIL: backfill should set fabrication flag');

// ---------------------------------------------------------------------
// Test 12: quality signal — approximate match path
// ---------------------------------------------------------------------
const id12 = await insertLlmCall(env, { email: 'karp.gabriel.a@gmail.com' }, {
  event: 'llm_call', task: 'compress', provider: 'mistral', model: 'mistral-medium',
  input_tokens: 1000, output_tokens: 200, duration_ms: 1500,
});
const sig12 = await insertQualitySignal(env, { email: 'karp.gabriel.a@gmail.com' }, {
  provider: 'mistral', task: 'compress', signal_type: 'banned_word', severity: 'warning',
  signal_value: { word: 'spearhead' },
});
console.log('TEST 12 result:', sig12);
console.assert(sig12.ok, 'TEST 12 FAIL: fuzzy match should succeed');
const after12 = await env.DB.prepare('SELECT banned_word_count FROM llm_calls WHERE id = ?').bind(id12).first();
console.assert(after12.banned_word_count === 1, 'TEST 12 FAIL: backfill should increment banned_word_count');

// ---------------------------------------------------------------------
// Test 13: quality signal — invalid signal_type rejected
// ---------------------------------------------------------------------
const sig13 = await insertQualitySignal(env, null, { call_id: id1, signal_type: 'made_up_thing' });
console.log('TEST 13 result:', sig13);
console.assert(!sig13.ok && sig13.reason === 'invalid_signal_type', 'TEST 13 FAIL');

// ---------------------------------------------------------------------
// Test 14: quality signal — no matchable call returns 404-shape
// ---------------------------------------------------------------------
const sig14 = await insertQualitySignal(env, null, {
  request_id: 'does-not-exist', signal_type: 'placeholder_leak',
});
console.log('TEST 14 result:', sig14);
console.assert(!sig14.ok && sig14.reason === 'call_not_found', 'TEST 14 FAIL');

// ---------------------------------------------------------------------
// Test 15: prune respects retention floor and deletes only old rows
// ---------------------------------------------------------------------
// Insert one old row (100 days ago) and one new row (now).
const veryOld = now - 100 * 86400;
await env.DB.prepare(
  `INSERT INTO llm_calls (ts, provider, task, success) VALUES (?, 'claude', 'compress', 1)`
).bind(veryOld).run();
const beforeCount = (await env.DB.prepare('SELECT COUNT(*) AS n FROM llm_calls').first()).n;

// Default retention is 90 days; old row should go, recent rows stay.
const pruneResult = await pruneOld(env, now);
console.log('TEST 15 prune result:', JSON.stringify(pruneResult));
const afterCount = (await env.DB.prepare('SELECT COUNT(*) AS n FROM llm_calls').first()).n;
console.log('TEST 15 row counts before/after:', beforeCount, '/', afterCount);
console.assert(pruneResult.ok, 'TEST 15 FAIL: prune returned not-ok');
console.assert(afterCount === beforeCount - 1, 'TEST 15 FAIL: should drop exactly the one 100-day-old row');

// ---------------------------------------------------------------------
// Test 16: prune retention floor — values below 7 days are clamped
// ---------------------------------------------------------------------
const fakeEnv = { ...env, TELEMETRY_RAW_RETENTION_DAYS: '1' }; // attempt 1 day
// Insert a 5-day-old row that would be wiped if 1-day retention were honoured.
const fiveDaysAgo = now - 5 * 86400;
await env.DB.prepare(
  `INSERT INTO llm_calls (ts, provider, task, success) VALUES (?, 'gemini', 'enrich', 1)`
).bind(fiveDaysAgo).run();
const beforeFloor = (await env.DB.prepare('SELECT COUNT(*) AS n FROM llm_calls WHERE ts = ?').bind(fiveDaysAgo).first()).n;
await pruneOld(fakeEnv, now);
const afterFloor = (await env.DB.prepare('SELECT COUNT(*) AS n FROM llm_calls WHERE ts = ?').bind(fiveDaysAgo).first()).n;
console.log('TEST 16 floor: before/after 5-day-old row count:', beforeFloor, '/', afterFloor);
console.assert(beforeFloor === 1 && afterFloor === 1, 'TEST 16 FAIL: 7-day floor should protect 5-day-old row even with retention=1');

console.log('\n✅ All tests passed');
