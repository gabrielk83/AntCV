/* SUBMITTED-VERSION-001 (2026-11-05): /api/application-snapshots freezes what an employer
 * read when the owner marked a tracker row Submitted. The handler is cut out of the real
 * src/index.js and run against node:sqlite through a D1-shaped adapter, so the SQL
 * (CREATE, INSERT ... RETURNING, the user_hash scoping) runs for real.
 *
 * Run: node --test workers/access-relay/tests/application-snapshots.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}
const code = extract('function parseJsonField(', '\n}') + '\n}\n'
  + extract('const SNAPSHOT_MAX_BYTES', '\nasync function handleApiKernelShowcase(');

// D1 surface the handler uses: prepare(sql).bind(...).first() / .all() / .run().
function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
      };
      return st;
    },
  };
}

function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE application (id INTEGER PRIMARY KEY AUTOINCREMENT, user_hash TEXT NOT NULL, jd_hash TEXT, jd_text TEXT,
    jd_language TEXT, jd_company TEXT, jd_role TEXT, meta TEXT, category TEXT, cv_sections TEXT, cl_sections TEXT,
    style_config TEXT, created_at INTEGER, updated_at INTEGER)`);
  const ctx = {
    console, JSON, String, Number, Array, Object, URL, Date, Math, parseInt,
    hasD1: () => true,
    identityFromRequest: async (req) => (req.headers.get('x-user') ? { email: req.headers.get('x-user') } : null),
    maybeRefreshHeader: async () => ({}),
    userHashFromEmail: async (e) => 'h_' + e,
    jsonResponse: (data, status) => ({ status, data }),
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.handle = handleApiApplicationSnapshots;', ctx);
  const env = { DB: d1(db) };
  const call = (method, path, { user = 'a@x', body, id = null } = {}) => ctx.handle(
    new Request('https://relay.test' + path, {
      method, headers: user ? { 'x-user': user, 'content-type': 'application/json' } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env, id);
  return { db, call };
}

const CV = [{ id: 'profile', title: 'Profile', content: 'Optical PM with 10 years' }];
const CL = [{ id: 'body', content: 'Dear team' }];
function seedApp(db, user = 'h_a@x') {
  return Number(db.prepare(`INSERT INTO application (user_hash, jd_hash, jd_text, jd_language, jd_company, jd_role, meta, category,
    cv_sections, cl_sections, style_config, created_at, updated_at) VALUES (?, 'j', 'The JD', 'en', 'Acme', 'PM', '{"greeting":"Dear"}', 'x', ?, ?, NULL, 1, 2)`)
    .run(user, JSON.stringify(CV), JSON.stringify(CL)).lastInsertRowid);
}

test('POST freezes the application sections, the posting and the exports', async () => {
  const { db, call } = harness();
  const appId = seedApp(db);
  const r = await call('POST', '/api/application-snapshots', { body: {
    uk: 'acme', application_id: appId, posting: { url: 'https://jobs.example/1', jd_text: 'Posting text', company: 'Acme', role: 'PM' },
    exports: { cv_export_url: 'https://x/cv.pdf' } } });
  assert.equal(r.status, 201);
  assert.equal(r.data.snapshot.uk, 'acme');
  assert.equal(r.data.snapshot.application_id, appId);
  const one = await call('GET', '/api/application-snapshots/' + r.data.snapshot.id, { id: String(r.data.snapshot.id) });
  assert.equal(one.status, 200);
  assert.deepEqual(one.data.snapshot.data.application.cv_sections, CV);
  assert.deepEqual(one.data.snapshot.data.application.cl_sections, CL);
  assert.deepEqual(one.data.snapshot.data.application.meta, { greeting: 'Dear' });
  assert.equal(one.data.snapshot.data.posting.jd_text, 'Posting text');
  assert.equal(one.data.snapshot.data.exports.cv_export_url, 'https://x/cv.pdf');
});

test('a later edit to the application does not change the snapshot; a re-submission adds a row', async () => {
  const { db, call } = harness();
  const appId = seedApp(db);
  const first = await call('POST', '/api/application-snapshots', { body: { uk: 'acme', application_id: appId } });
  db.prepare('UPDATE application SET cv_sections = ? WHERE id = ?').run(JSON.stringify([{ id: 'profile', content: 'regenerated' }]), appId);
  const again = await call('POST', '/api/application-snapshots', { body: { uk: 'acme', application_id: appId } });
  assert.notEqual(again.data.snapshot.id, first.data.snapshot.id);
  const old = await call('GET', '/api/application-snapshots/' + first.data.snapshot.id, { id: String(first.data.snapshot.id) });
  assert.deepEqual(old.data.snapshot.data.application.cv_sections, CV);
  const list = await call('GET', '/api/application-snapshots?uk=acme');
  assert.equal(list.data.snapshots.length, 2);
  assert.ok(!('json' in list.data.snapshots[0]), 'the list carries no payload');
});

test('scoped to the caller: another user can neither read a snapshot nor snapshot their application', async () => {
  const { db, call } = harness();
  const appId = seedApp(db);
  const mine = await call('POST', '/api/application-snapshots', { body: { uk: 'acme', application_id: appId } });
  const sid = String(mine.data.snapshot.id);
  assert.equal((await call('GET', '/api/application-snapshots/' + sid, { user: 'b@x', id: sid })).status, 404);
  assert.equal((await call('GET', '/api/application-snapshots', { user: 'b@x' })).data.snapshots.length, 0);
  assert.equal((await call('POST', '/api/application-snapshots', { user: 'b@x', body: { uk: 'acme', application_id: appId } })).status, 404);
  assert.equal((await call('GET', '/api/application-snapshots', { user: null })).status, 401);
});

test('no handler updates or deletes a snapshot', async () => {
  const { call } = harness();
  const r = await call('POST', '/api/application-snapshots', { body: { uk: 'hand', posting: { jd_text: 'Hand-made package posting' } } });
  assert.equal(r.status, 201, 'a row with no AntCV application still snapshots its posting');
  const sid = String(r.data.snapshot.id);
  for (const m of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal((await call(m, '/api/application-snapshots/' + sid, { id: sid, body: {} })).status, 405, m + ' /:id');
    assert.equal((await call(m, '/api/application-snapshots', { body: {} })).status, 405, m);
  }
  assert.ok(!/UPDATE application_snapshot|DELETE FROM application_snapshot/.test(code), 'no UPDATE/DELETE in the handler');
});

test('input checks: uk, kind, application id, empty and oversize snapshots', async () => {
  const { call } = harness();
  const post = (body) => call('POST', '/api/application-snapshots', { body });
  assert.equal((await post({ posting: { jd_text: 'x' } })).data.error, 'invalid_uk');
  assert.equal((await post({ uk: 'a', kind: 'draft', posting: { jd_text: 'x' } })).data.error, 'invalid_kind');
  assert.equal((await post({ uk: 'a', application_id: 'abc' })).data.error, 'invalid_application_id');
  assert.equal((await post({ uk: 'a' })).data.error, 'empty_snapshot');
  assert.equal((await post({ uk: 'a', application_id: 999 })).status, 404);
  const big = await post({ uk: 'a', posting: { jd_text: 'x'.repeat(200000), url: 'u' }, exports: { cv_export_url: 'y'.repeat(5000) } });
  assert.equal(big.status, 201, 'fields are capped, not rejected');
});
