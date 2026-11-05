/* ACCOUNT-ERASE-COMPLETE-001 regression guard (GDPR Art. 17 erasure gap, 2026-11-05).
 *
 * DELETE /api/prefs (the PWA's "Delete user") and DELETE /api/profile/kernel
 * each wiped only language_view, application, active_application,
 * active_application_device and user_kernel. Every other per-user table
 * survived: job_tracker (hiring-manager names, salaries, notes, JD text),
 * kernel_showcase, kernel_showcase_styled, kernel_language_view,
 * application_fit, and the real-user rows of application_qualification /
 * cluster_top_qualifications. FK cascade does not cover them: the live
 * cluster tables have no FK (schema introspection, CLUSTER-DEMAND-GLOBAL-001),
 * the lazy kernel_showcase_styled / kernel_language_view DDL has none, and
 * v2.5.3 saw application rows survive a user_kernel delete.
 *
 * Drives the real worker (default export fetch, minted JWT) against a real
 * in-memory SQLite behind a D1-shaped adapter, so the handler's own SQL runs
 * unmodified. Two FK modes:
 *   - FK off: what v2.5.3 observed in prod (no cascade). Primary case.
 *   - FK on:  a fresh DB from schema.sql; proves the leaf-first order never
 *             trips a constraint.
 *
 * Run:  node --test workers/access-relay/tests/account-erase-complete.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const relay = (await import('../src/index.js')).default;
const schemaSql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
const telemetrySql = await readFile(new URL('../schema-telemetry.sql', import.meta.url), 'utf8');

// Tables the relay creates outside schema.sql. kernel_showcase_styled is the
// relay's own lazy DDL. The three cluster tables use the live shape: no FK.
// application_snapshot is the lazy DDL of OUTCOME-RECORD-002 (submitted
// CV/CL/JD, insert-only).
const EXTRA_DDL = [
  'CREATE TABLE IF NOT EXISTS kernel_showcase_styled (' +
    'user_hash TEXT NOT NULL, style_key TEXT NOT NULL DEFAULT \'\', ' +
    'sections TEXT, meta TEXT, rationale TEXT, jd_language TEXT, ' +
    'created_at INTEGER, updated_at INTEGER, PRIMARY KEY (user_hash, style_key))',
  'CREATE TABLE IF NOT EXISTS application_qualification (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT, application_id INTEGER, user_hash TEXT NOT NULL, ' +
    'cluster_id TEXT NOT NULL, qual_text TEXT NOT NULL, qual_canonical TEXT NOT NULL, ' +
    'weight REAL NOT NULL DEFAULT 1.0, source TEXT NOT NULL DEFAULT \'jd\', created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS cluster_top_qualifications (' +
    'user_hash TEXT NOT NULL, cluster_id TEXT NOT NULL, rank INTEGER NOT NULL, ' +
    'qual_canonical TEXT NOT NULL, qual_display TEXT NOT NULL, frequency INTEGER NOT NULL, ' +
    'weight_sum REAL NOT NULL, shared_clusters TEXT, jd_count INTEGER NOT NULL, ' +
    'updated_at INTEGER NOT NULL, PRIMARY KEY (user_hash, cluster_id, rank))',
  'CREATE TABLE IF NOT EXISTS application_fit (' +
    'application_id INTEGER PRIMARY KEY, user_hash TEXT NOT NULL, cluster_id TEXT NOT NULL, ' +
    'fit_score REAL NOT NULL, matched TEXT NOT NULL, gaps TEXT NOT NULL, tier TEXT, ' +
    'computed_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS application_snapshot (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT, user_hash TEXT NOT NULL, application_id INTEGER, ' +
    'uk TEXT NOT NULL, kind TEXT NOT NULL, json TEXT NOT NULL, created_at INTEGER NOT NULL)',
];

// Every table that holds rows keyed to one user, and how to count that
// user's rows. language_view keys through application ids, which are counted
// directly (a subquery on application would read 0 once the parent is gone).
const USER_TABLES = {
  user_kernel:                'SELECT COUNT(*) AS n FROM user_kernel WHERE user_hash = ?',
  application:                'SELECT COUNT(*) AS n FROM application WHERE user_hash = ?',
  language_view:              'SELECT COUNT(*) AS n FROM language_view WHERE application_id IN (SELECT value FROM json_each(?))',
  kernel_language_view:       'SELECT COUNT(*) AS n FROM kernel_language_view WHERE user_hash = ?',
  active_application:         'SELECT COUNT(*) AS n FROM active_application WHERE user_hash = ?',
  active_application_device:  'SELECT COUNT(*) AS n FROM active_application_device WHERE user_hash = ?',
  kernel_showcase:            'SELECT COUNT(*) AS n FROM kernel_showcase WHERE user_hash = ?',
  kernel_showcase_styled:     'SELECT COUNT(*) AS n FROM kernel_showcase_styled WHERE user_hash = ?',
  job_tracker:                'SELECT COUNT(*) AS n FROM job_tracker WHERE user_hash = ?',
  application_fit:            'SELECT COUNT(*) AS n FROM application_fit WHERE user_hash = ?',
  application_snapshot:       'SELECT COUNT(*) AS n FROM application_snapshot WHERE user_hash = ?',
  application_qualification:  'SELECT COUNT(*) AS n FROM application_qualification WHERE user_hash = ?',
  cluster_top_qualifications: 'SELECT COUNT(*) AS n FROM cluster_top_qualifications WHERE user_hash = ?',
};

// ---- D1 adapter over node:sqlite -------------------------------------
function d1(db) {
  const stmt = (sql, args) => ({
    sql, args,
    bind(...a) { return stmt(sql, a); },
    async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { success: true, results: db.prepare(sql).all(...args) }; },
  });
  return {
    prepare: (sql) => stmt(sql, []),
    // D1 batch is one transaction: any failing statement rolls back all.
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => {
          const r = db.prepare(s.sql).run(...s.args);
          return { success: true, meta: { changes: Number(r.changes) } };
        });
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

// ---- auth + env (same JWT minting as test/diag-job-tracker.mjs) -------
const SECRET = 'erase-test-secret-0123456789abcdef0123456789abcd';
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function mint(email) {
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ sub: email, email, iat: now, exp: now + 3600, iss: 'antcv-access-relay' })));
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
}
async function hashOf(email) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return b64url(new Uint8Array(buf)).slice(0, 32);
}
function kvMock() { const m = new Map(); return { _m: m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } }; }

async function callDelete(path, token, db, kv) {
  const env = { JWT_SECRET: SECRET, DB: db, KV_BINDING: kv || kvMock(), ALLOWED_ORIGINS: 'https://antcv.pages.dev' };
  const res = await relay.fetch(new Request('https://relay.example.com' + path, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token, 'Origin': 'https://antcv.pages.dev' },
  }), env, { waitUntil: () => {} });
  let body = null; try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

const VICTIM = 'erase-me@example.com';
const OTHER = 'keep-me@example.com';
const GLOBAL = '__global_market__';

// ---- seed: the victim gets a row in every table; OTHER and the global
//      sentinel get rows that must survive. ------------------------------
function seed(db, h, o) {
  const t = 1;
  const ins = (sql, ...a) => db.prepare(sql).run(...a);
  for (const u of [h, o]) ins('INSERT INTO user_kernel (user_hash, identity, history, preferences, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', u, '{"name":"x"}', '{}', '{}', t, t);
  ins("INSERT INTO application (id, user_hash, jd_hash, jd_text, jd_language, category, created_at, updated_at) VALUES (101, ?, 'j1', 'JD one', 'en', 'executive', ?, ?)", h, t, t);
  ins("INSERT INTO application (id, user_hash, jd_hash, jd_text, jd_language, category, created_at, updated_at) VALUES (102, ?, 'j2', 'JD two', 'da', 'executive', ?, ?)", h, t, t);
  ins("INSERT INTO application (id, user_hash, jd_hash, jd_text, jd_language, category, created_at, updated_at) VALUES (201, ?, 'j3', 'JD three', 'en', 'executive', ?, ?)", o, t, t);
  for (const id of [101, 102, 201]) ins("INSERT INTO language_view (application_id, language, cv_sections, cl_sections, generated_at) VALUES (?, 'en', '[]', '[]', ?)", id, t);
  for (const u of [h, o]) {
    ins("INSERT INTO kernel_language_view (user_hash, language, projection, source_sig, generated_at) VALUES (?, 'da', '{}', 's', ?)", u, t);
    ins('INSERT INTO active_application (user_hash, application_id) VALUES (?, NULL)', u);
    ins("INSERT INTO active_application_device (user_hash, device_id, application_id) VALUES (?, 'dev1', NULL)", u);
    ins('INSERT INTO kernel_showcase (user_hash, sections, created_at, updated_at) VALUES (?, ?, ?, ?)', u, '{"cv":[]}', t, t);
    ins("INSERT INTO kernel_showcase_styled (user_hash, style_key, sections, created_at, updated_at) VALUES (?, 'nordic', '{}', ?, ?)", u, t, t);
    ins('INSERT INTO job_tracker (user_hash, doc, rev, updated_at) VALUES (?, ?, 3, ?)', u, '{"contacts":[{"name":"Hiring Manager"}],"envelope":{"salary":"60k"}}', t);
  }
  ins("INSERT INTO application_fit (application_id, user_hash, cluster_id, fit_score, matched, gaps, computed_at) VALUES (101, ?, 'exec', 80, '[]', '[]', ?)", h, t);
  ins("INSERT INTO application_fit (application_id, user_hash, cluster_id, fit_score, matched, gaps, computed_at) VALUES (201, ?, 'exec', 70, '[]', '[]', ?)", o, t);
  for (const [u, app] of [[h, 101], [h, 102], [o, 201]]) {
    ins("INSERT INTO application_snapshot (user_hash, application_id, uk, kind, json, created_at) VALUES (?, ?, 'row-uk', 'cv', '{\"sections\":[]}', ?)", u, app, t);
  }
  // Real-JD extractions carry the owner's user_hash; research rows sit under the sentinel.
  ins("INSERT INTO application_qualification (application_id, user_hash, cluster_id, qual_text, qual_canonical, source, created_at) VALUES (101, ?, 'exec', 'P&L ownership', 'p l ownership', 'jd', ?)", h, t);
  ins("INSERT INTO application_qualification (application_id, user_hash, cluster_id, qual_text, qual_canonical, source, created_at) VALUES (102, ?, 'exec', 'Board reporting', 'board reporting', 'jd', ?)", h, t);
  ins("INSERT INTO application_qualification (application_id, user_hash, cluster_id, qual_text, qual_canonical, source, created_at) VALUES (201, ?, 'exec', 'Budgeting', 'budgeting', 'jd', ?)", o, t);
  ins("INSERT INTO application_qualification (application_id, user_hash, cluster_id, qual_text, qual_canonical, weight, source, created_at) VALUES (NULL, ?, 'exec', 'Strategy', 'strategy', 0.4, 'research', ?)", GLOBAL, t);
  // Legacy per-user rollup rows (pre CLUSTER-DEMAND-GLOBAL-001) + the global aggregate.
  for (const [u, rank] of [[h, 1], [h, 2], [o, 1], [GLOBAL, 1]]) {
    ins("INSERT INTO cluster_top_qualifications (user_hash, cluster_id, rank, qual_canonical, qual_display, frequency, weight_sum, shared_clusters, jd_count, updated_at) VALUES (?, 'exec', ?, 'q', 'Q', 1, 1, '[]', 1, ?)", u, rank, t);
  }
  ins("INSERT INTO llm_calls (id, ts, user_hash, provider, task, success) VALUES (900, ?, ?, 'p', 'gen', 1)", t, h);
  ins("INSERT INTO llm_calls (id, ts, user_hash, provider, task, success) VALUES (901, ?, ?, 'p', 'gen', 1)", t, o);
  ins("INSERT INTO llm_quality_signals (call_id, ts, signal_type, severity) VALUES (900, ?, 'fab', 'low')", t);
  ins("INSERT INTO llm_quality_signals (call_id, ts, signal_type, severity) VALUES (901, ?, 'fab', 'low')", t);
}

async function freshDb({ fk, extra = EXTRA_DDL, skipSchema = false } = {}) {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: fk });
  if (!skipSchema) { db.exec(schemaSql); db.exec(telemetrySql); }
  for (const ddl of extra) db.exec(ddl);
  return db;
}

const APP_IDS = { victim: [101, 102], other: [201] };

function counts(db, h, appIds) {
  const out = {};
  for (const [t, sql] of Object.entries(USER_TABLES)) {
    const arg = t === 'language_view' ? JSON.stringify(appIds) : h;
    out[t] = Number(db.prepare(sql).get(arg).n);
  }
  return out;
}

function assertOtherAndGlobalSurvive(db, o) {
  for (const [t, n] of Object.entries(counts(db, o, APP_IDS.other))) {
    assert.ok(n >= 1, `OTHER user's ${t} row must survive (got ${n})`);
  }
  const g1 = Number(db.prepare('SELECT COUNT(*) AS n FROM application_qualification WHERE user_hash = ?').get(GLOBAL).n);
  const g2 = Number(db.prepare('SELECT COUNT(*) AS n FROM cluster_top_qualifications WHERE user_hash = ?').get(GLOBAL).n);
  assert.equal(g1, 1, 'global research rows (no user link) are not erased');
  assert.equal(g2, 1, 'global anonymous top-20 rollup is not erased');
}

for (const fk of [false, true]) {
  const mode = fk ? 'FK on (fresh schema.sql DB)' : 'FK off (no cascade, as observed in prod)';

  test(`DELETE /api/prefs erases the user's row in EVERY per-user table — ${mode}`, async () => {
    const sqlite = await freshDb({ fk });
    const h = await hashOf(VICTIM);
    const o = await hashOf(OTHER);
    seed(sqlite, h, o);
    const kv = kvMock();
    const res = await callDelete('/api/prefs', await mint(VICTIM), d1(sqlite), kv);

    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true, 'deleted must be true: ' + JSON.stringify(res.body.details));
    const left = counts(sqlite, h, APP_IDS.victim);
    for (const [t, n] of Object.entries(left)) assert.equal(n, 0, `${t}: ${n} row(s) of the erased user survived`);
    const tel = Number(sqlite.prepare('SELECT COUNT(*) AS n FROM llm_calls WHERE user_hash = ?').get(h).n);
    assert.equal(tel, 0, 'llm_calls rows of the erased user survived');
    const sig = Number(sqlite.prepare('SELECT COUNT(*) AS n FROM llm_quality_signals WHERE call_id = 900').get().n);
    assert.equal(sig, 0, 'llm_quality_signals rows of the erased user survived');
    assertOtherAndGlobalSurvive(sqlite, o);

    // Per-table counts are reported, one key per table.
    const core = res.body.details.d1_core;
    assert.deepEqual(
      { ...core },
      {
        language_view: 2, application_fit: 1, application_snapshot: 2, application_qualification: 2,
        cluster_top_qualifications: 2, application: 2, active_application: 1,
        active_application_device: 1, kernel_language_view: 1, kernel_showcase: 1,
        kernel_showcase_styled: 1, job_tracker: 1, user_kernel: 1,
      },
      'd1_core per-table counts',
    );
    assert.deepEqual(res.body.details.d1_telemetry, { llm_quality_signals: 1, llm_calls: 1 });
  });

  test(`DELETE /api/profile/kernel erases the same per-user tables — ${mode}`, async () => {
    const sqlite = await freshDb({ fk });
    const h = await hashOf(VICTIM);
    const o = await hashOf(OTHER);
    seed(sqlite, h, o);
    const res = await callDelete('/api/profile/kernel', await mint(VICTIM), d1(sqlite));

    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    const left = counts(sqlite, h, APP_IDS.victim);
    for (const [t, n] of Object.entries(left)) assert.equal(n, 0, `${t}: ${n} row(s) of the erased user survived`);
    assertOtherAndGlobalSurvive(sqlite, o);
    assert.equal(res.body.details.job_tracker, 1);
    assert.equal(res.body.details.kernel_showcase_styled, 1);
    assert.equal(res.body.details.application_snapshot, 2);
    assert.equal(res.body.details.user_kernel, 1);
  });
}

test('a table not created yet does not roll back the erase; it reports null', async () => {
  // A fresh DB where the lazy / manually applied tables were never created.
  const ALWAYS = ['user_kernel', 'application', 'language_view', 'active_application', 'active_application_device'];
  const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  sqlite.exec(schemaSql);
  for (const t of ['kernel_language_view', 'kernel_showcase', 'job_tracker']) sqlite.exec('DROP TABLE ' + t);
  const h = await hashOf(VICTIM);
  sqlite.prepare('INSERT INTO user_kernel (user_hash, identity, history, preferences, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)').run(h, '{}', '{}', '{}');
  sqlite.prepare("INSERT INTO application (id, user_hash, jd_hash, jd_text, jd_language, category, created_at, updated_at) VALUES (7, ?, 'j', 'JD', 'en', 'executive', 1, 1)").run(h);

  const res = await callDelete('/api/prefs', await mint(VICTIM), d1(sqlite));
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, true, JSON.stringify(res.body.details));
  const core = res.body.details.d1_core;
  assert.equal(core.user_kernel, 1);
  assert.equal(core.application, 1);
  for (const t of ['job_tracker', 'kernel_showcase', 'kernel_showcase_styled', 'kernel_language_view', 'application_fit', 'application_snapshot', 'application_qualification', 'cluster_top_qualifications']) {
    assert.equal(core[t], null, `${t} is absent, reported as null`);
  }
  for (const t of ALWAYS) {
    const n = Number(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
    assert.equal(n, 0, `${t} wiped`);
  }
});

test('a statement that fails rolls back the whole erase batch (atomic) and reports the error', async () => {
  const sqlite = await freshDb({ fk: false });
  const h = await hashOf(VICTIM);
  const o = await hashOf(OTHER);
  seed(sqlite, h, o);
  // job_tracker turns read-only for DELETE: the batch must fail as one unit.
  sqlite.exec("CREATE TRIGGER jt_block BEFORE DELETE ON job_tracker BEGIN SELECT RAISE(ABORT, 'blocked'); END");
  const res = await callDelete('/api/prefs', await mint(VICTIM), d1(sqlite));
  assert.equal(res.status, 200);
  assert.equal(res.body.deleted, false);
  assert.match(String(res.body.details.d1_core.error), /blocked/);
  const left = counts(sqlite, h, APP_IDS.victim);
  assert.equal(left.user_kernel, 1, 'user_kernel kept: nothing half-deleted');
  assert.equal(left.application, 2, 'application kept: nothing half-deleted');
});
