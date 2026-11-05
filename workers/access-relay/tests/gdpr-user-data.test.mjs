/* GDPR-RIGHTS-001 (owner 2026-10-23): full-account delete reaches every
 * user-keyed D1 table (GDPR Art. 17), and GET /api/prefs/export returns a copy of
 * the same rows with API key values masked (Art. 15 and 20).
 *
 * Three layers:
 *   1. Functional: collectUserRows / buildExport against an
 *      in-memory D1 mock (other users and the global sentinel survive).
 *   2. Invariant: every table created with a user_hash column (schema*.sql and the
 *      runtime CREATE TABLE strings in src/index.js) is listed in USER_TABLES, so a
 *      new table cannot silently escape the copy, and USER_TABLES names exactly the
 *      tables the atomic erase batch (src/index.js USER_ERASE_STATEMENTS,
 *      ACCOUNT-ERASE-COMPLETE-001) deletes, so the delete and the copy cannot drift.
 *   3. Source locks on the export route.
 *
 * Run:  node --test workers/access-relay/tests/gdpr-user-data.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  USER_TABLES, CHILD_TABLES, collectUserRows, buildExport, redactKvPrefs,
} from '../src/gdpr-user-data.js';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const schemas = ['../schema.sql', '../schema-telemetry.sql']
  .map((p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8'))
  .join('\n');

function makeD1(tables) {
  function exec(sql, binds) {
    const s = sql.replace(/\s+/g, ' ').trim();
    let m = s.match(/^(DELETE|SELECT \*) FROM (\w+) WHERE user_hash = \?$/i);
    if (m) {
      const t = m[2];
      if (!(t in tables)) throw new Error('no such table: ' + t);
      const hit = tables[t].filter((r) => r.user_hash === binds[0]);
      if (/^DELETE/i.test(m[1])) tables[t] = tables[t].filter((r) => r.user_hash !== binds[0]);
      return { changes: hit.length, rows: hit };
    }
    m = s.match(/^SELECT \* FROM (\w+) WHERE (\w+) IN \(SELECT id FROM (\w+) WHERE user_hash = \?\)$/i);
    if (m) {
      const [, t, col, parent] = m;
      if (!(t in tables) || !(parent in tables)) throw new Error('no such table: ' + t);
      const ids = new Set(tables[parent].filter((r) => r.user_hash === binds[0]).map((r) => r.id));
      const hit = tables[t].filter((r) => ids.has(r[col]));
      return { changes: 0, rows: hit };
    }
    throw new Error('mock D1: unsupported SQL: ' + s);
  }
  return {
    prepare(sql) {
      return {
        b: [],
        bind(...a) { this.b = a; return this; },
        async run() { return { meta: { changes: exec(sql, this.b).changes } }; },
        async all() { return { results: exec(sql, this.b).rows }; },
      };
    },
  };
}

function seed() {
  return {
    user_kernel: [{ user_hash: 'H', identity: '{}' }, { user_hash: 'OTHER', identity: '{}' }],
    application: [{ id: 1, user_hash: 'H' }, { id: 2, user_hash: 'OTHER' }],
    language_view: [{ application_id: 1, language: 'en' }, { application_id: 2, language: 'da' }],
    active_application: [{ user_hash: 'H', application_id: 1 }],
    active_application_device: [{ user_hash: 'H', device_id: 'd1' }],
    application_fit: [{ application_id: 1, user_hash: 'H' }, { application_id: 2, user_hash: 'OTHER' }],
    application_qualification: [{ application_id: 1, user_hash: 'H', qual_text: 'x' }],
    cluster_top_qualifications: [
      { user_hash: 'H', cluster_id: 'c' },
      { user_hash: '__global_market__', cluster_id: 'c' },
    ],
    kernel_showcase_styled: [{ user_hash: 'H', style_key: '' }],
    kernel_showcase: [{ user_hash: 'H' }],
    // kernel_language_view missing on this deployment on purpose
    job_tracker: [{ user_hash: 'H', doc: '{}' }, { user_hash: 'OTHER', doc: '{}' }],
    llm_calls: [{ id: 100, user_hash: 'H' }],
    llm_quality_signals: [{ call_id: 100 }],
  };
}

test('export collects own rows only, masks API keys, names recipients', async () => {
  const rows = await collectUserRows(makeD1(seed()), 'H');
  assert.equal(rows.user_kernel.length, 1);
  assert.equal(rows.application.length, 1);
  assert.deepEqual(rows.language_view, [{ application_id: 1, language: 'en' }]);
  assert.equal(rows.llm_quality_signals.length, 1);
  assert.equal(rows.kernel_language_view, 'missing');
  assert.equal(rows.cluster_top_qualifications.length, 1);

  const body = buildExport({
    email: 'a@example.com',
    kvPrefs: { apiKeys: { anthropic: 'sk-secret', openai: '' }, created_at: '2026-01-01T00:00:00Z' },
    rows,
    now: new Date('2026-10-23T12:00:00Z'),
  });
  assert.equal(body._antcvGdprExport, 1);
  assert.equal(body.exported_at, '2026-10-23T12:00:00.000Z');
  assert.ok(!JSON.stringify(body).includes('sk-secret'), 'API key value leaked into the copy');
  assert.equal(body.kv_prefs.apiKeys.openai, '');
  assert.ok(body.recipients.some((r) => r.name === 'Cloudflare'));
});

test('redactKvPrefs does not mutate the stored record', () => {
  const p = { apiKeys: { mistral: 'k' } };
  redactKvPrefs(p);
  assert.equal(p.apiKeys.mistral, 'k');
});

test('every table created with a user_hash column is in USER_TABLES', () => {
  const listed = new Set(USER_TABLES.map((t) => t.table));
  const created = new Set();
  // schema files: CREATE TABLE IF NOT EXISTS name ( ... );
  for (const m of schemas.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g)) {
    if (/\buser_hash\b/.test(m[2])) created.add(m[1]);
  }
  // runtime DDL strings in the worker source
  for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([^)]*)/g)) {
    if (/\buser_hash\b/.test(m[2])) created.add(m[1]);
  }
  assert.ok(created.size >= 6, 'schema scan found too few tables: ' + [...created]);
  const missing = [...created].filter((t) => !listed.has(t));
  assert.deepEqual(missing, [], 'user-keyed tables missing from USER_TABLES: ' + missing.join(', '));
  // child tables keyed through a parent stay listed too
  assert.deepEqual(CHILD_TABLES.map((t) => t.table).sort(), ['language_view', 'llm_quality_signals']);
});

test('the erase batch and the export list name the same tables (no drift)', () => {
  const block = src.slice(src.indexOf('const USER_ERASE_STATEMENTS = ['), src.indexOf('];', src.indexOf('const USER_ERASE_STATEMENTS = [')));
  const erased = new Set([...block.matchAll(/\['(\w+)',\s*'DELETE FROM/g)].map((m) => m[1]));
  assert.ok(erased.size >= 10, 'parsed too few erase statements: ' + [...erased]);
  // telemetry rows are erased by their own optional batch, beside the core one
  const TELEMETRY = new Set(['llm_calls', 'llm_quality_signals']);
  const exported = new Set([...USER_TABLES, ...CHILD_TABLES].map((t) => t.table).filter((t) => !TELEMETRY.has(t)));
  assert.deepEqual([...exported].filter((t) => !erased.has(t)).sort(), [], 'exported but never erased');
  assert.deepEqual([...erased].filter((t) => !exported.has(t)).sort(), [], 'erased but missing from the data copy');
  for (const t of TELEMETRY) assert.ok(src.includes('DELETE FROM ' + t + ' WHERE'), t + ' erase missing');
});

test('DELETE /api/prefs runs the one atomic erase, not a second per-table pass', () => {
  const del = src.indexOf("if (m === 'DELETE') {");
  assert.ok(del > 0);
  assert.ok(src.indexOf('result.details.d1_core = await eraseUserD1(env, userHash)', del) > del);
  assert.ok(!src.includes('eraseExtraUserTables'), 'the removed per-table pass came back');
});

test('GET /api/prefs/export is routed before /api/prefs and requires sign-in', () => {
  const route = src.indexOf("if (path === '/api/prefs/export')");
  const prefs = src.indexOf("if (path === '/api/prefs')          return handleApiPrefs");
  assert.ok(route > 0 && prefs > route);
  const fn = src.slice(src.indexOf('async function handleApiPrefsExport'));
  assert.match(fn.slice(0, 600), /if \(!id\) return jsonResponse\(\{ error: 'unauthenticated'/);
  assert.match(fn.slice(0, 900), /request\.method !== 'GET'/);
});
