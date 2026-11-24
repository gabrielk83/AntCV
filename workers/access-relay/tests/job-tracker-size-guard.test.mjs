/* JT-DOC-SIZE-001 (2026-11-24): the job-tracker doc is one D1 string and D1 caps a string
 * at 2,000,000 bytes. PUT /api/job-tracker must say how large the doc is, warn past 1.8 MB,
 * and name the size when the write fails. It must not refuse a write itself.
 *
 * The handler is cut out of the real src/index.js and run against node:sqlite through a
 * D1-shaped adapter. `cap` makes the adapter throw the way D1 does above its row limit.
 *
 * Run: node --test workers/access-relay/tests/job-tracker-size-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const src = read('../src/index.js');
function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}
const code = extract('function parseJsonField(', '\n}') + '\n}\n'
  + extract('const JT_DOC_LIMIT_BYTES', '\n// ---- /api/application-snapshots');

function d1(db, cap) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async run() {
          if (args.some((a) => typeof a === 'string' && Buffer.byteLength(a, 'utf8') > cap)) {
            throw new Error('D1_ERROR: string or blob too big: SQLITE_TOOBIG');
          }
          const r = db.prepare(sql).run(...args);
          return { meta: { changes: r.changes } };
        },
      };
      return st;
    },
  };
}

function harness(cap = 2000000) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE user_kernel (user_hash TEXT PRIMARY KEY)');
  db.exec("INSERT INTO user_kernel VALUES ('H')");
  const warned = [];
  const ctx = {
    console: { warn: (m) => warned.push(String(m)) }, JSON, String, Number, Math, Date, TextEncoder,
    hasD1: () => true,
    identityFromRequest: async () => ({ email: 'user@example.com' }),
    maybeRefreshHeader: async () => ({}),
    userHashFromEmail: async () => 'H',
    migrateKvPrefsToD1IfEmpty: async () => ({ migrated: true }),
    jsonResponse: (data, status) => ({ status, data }),
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.handle = handleApiJobTracker; this.WARN = JT_DOC_WARN_BYTES; this.LIMIT = JT_DOC_LIMIT_BYTES;', ctx);
  const env = { DB: d1(db, cap) };
  const put = (doc, base_rev) => ctx.handle(new Request('https://relay.test/api/job-tracker', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ doc, base_rev }),
  }), env);
  const stored = () => db.prepare('SELECT doc, rev FROM job_tracker').get();
  return { put, stored, warned, WARN: ctx.WARN, LIMIT: ctx.LIMIT };
}

// A doc whose JSON.stringify is exactly n bytes.
function docOf(n, ch = 'x') {
  const empty = Buffer.byteLength(JSON.stringify({ rows: [], jd: { a: '' } }), 'utf8');
  const w = Buffer.byteLength(ch, 'utf8');
  const fill = n - empty;
  const d = { rows: [], jd: { a: ch.repeat(Math.floor(fill / w)) + 'x'.repeat(fill % w) } };
  assert.equal(Buffer.byteLength(JSON.stringify(d), 'utf8'), n, 'fixture size');
  return d;
}

test('a small doc reports its size and carries no warning', async () => {
  const h = harness();
  const r = await h.put({ rows: [], jd: {} });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.rev, 1);
  assert.equal(r.data.doc_bytes, Buffer.byteLength(h.stored().doc, 'utf8'), 'doc_bytes is what D1 stores');
  assert.equal(r.data.doc_limit_bytes, 2000000);
  assert.ok(!('size_warning' in r.data));
  assert.deepEqual(h.warned, []);
});

test('the warning starts above 1.8 MB, and the write still goes through', async () => {
  const h = harness();
  const at = await h.put(docOf(h.WARN));
  assert.equal(at.status, 200);
  assert.ok(!('size_warning' in at.data), 'exactly at the threshold is not past it');
  const past = await h.put(docOf(h.WARN + 1), 1);
  assert.equal(past.status, 200, 'the guard warns, it does not refuse');
  assert.equal(past.data.rev, 2);
  assert.equal(h.stored().rev, 2);
  assert.equal(past.data.doc_bytes, 1800001);
  assert.match(past.data.size_warning, /1800001 bytes, 90% of the 2000000-byte D1 row limit/);
  assert.match(past.data.size_warning, /jd_archive\.py plan/);
  assert.equal(h.warned.length, 1);
});

test('bytes are UTF-8 bytes, not characters', async () => {
  const h = harness();
  const doc = docOf(1900000, 'ø');
  assert.ok(JSON.stringify(doc).length < h.WARN, 'fixture: under the threshold in characters');
  const r = await h.put(doc);
  assert.equal(r.data.doc_bytes, 1900000);
  assert.ok(r.data.size_warning);
});

test('a write D1 rejects names the size next to the error and leaves the stored doc', async () => {
  const h = harness();
  await h.put({ rows: [], jd: { a: 'kept' } });
  const r = await h.put(docOf(h.LIMIT + 1), 1);
  assert.equal(r.status, 500);
  assert.equal(r.data.error, 'd1_write_failed');
  assert.match(r.data.message, /too big/);
  assert.equal(r.data.doc_bytes, 2000001);
  assert.match(r.data.size_warning, /100% of the 2000000-byte/);
  assert.equal(JSON.parse(h.stored().doc).jd.a, 'kept');
  assert.equal(h.stored().rev, 1);
});

test('a 409 is unchanged: the current doc and rev come back, no size fields', async () => {
  const h = harness();
  await h.put({ rows: [], jd: {} });
  const r = await h.put(docOf(1900000), 7);
  assert.equal(r.status, 409);
  assert.equal(r.data.rev, 1);
  assert.ok(!('doc_bytes' in r.data));
  assert.deepEqual(h.warned, []);
});

test('the log line names the size and nothing about the user', async () => {
  const h = harness();
  await h.put(docOf(1850000));
  assert.equal(h.warned.length, 1);
  assert.ok(!/example\.com|"H"|xxxx/.test(h.warned[0]));
});

test('jd_archive.py uses the same two numbers', () => {
  const py = read('../../../scripts/job-tracker/jd_archive.py');
  const num = (name) => Number((py.match(new RegExp('^' + name + ' = ([0-9_]+)', 'm')) || [])[1].replace(/_/g, ''));
  const h = harness();
  assert.equal(num('LIMIT_BYTES'), h.LIMIT);
  assert.equal(num('WARN_BYTES'), h.WARN);
});
