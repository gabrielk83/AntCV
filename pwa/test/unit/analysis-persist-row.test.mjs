// analysis-persist-row.test.mjs
// ============================================================
// ANALYSIS-PERSIST-ROW-001 (2026-11-09, production 1.51.6445): a fresh tab whose editor
// document was #3536 (Elma, the device pointer) sent PUT /api/applications/3537 (Axis, the
// GLOBAL pointer) ~7 s after boot with {analysis_extra:{gap_state, questions, questionsJd}}.
// The sender was antcv-analysis-persist.js: it learned "the active app" from GET /api/active
// with no device_id and PUT this tab's analysis stores there. The relay replaces the whole
// analysis_extra column, so one row's employer Q&A landed in another row.
//
// Loads the REAL antcv-jd-scope.js + antcv-analysis-persist.js into a vm window over a fake
// relay whose global pointer (3537) differs from the tab's row (3536).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCOPE = readFileSync(new URL('../../antcv-jd-scope.js', import.meta.url), 'utf8');
const PERSIST = readFileSync(new URL('../../antcv-analysis-persist.js', import.meta.url), 'utf8');
const RELAY = 'https://relay.test';

const ELMA_Q = JSON.stringify([{ q: 'Hvorfor Elma?', a: 'Instrumenter' }]);
const AXIS_Q = JSON.stringify([{ q: 'Why Axis?', a: 'Network video' }]);

const rowsFixture = () => ({
  3536: { id: 3536, jd_company: 'Elma Instruments', analysis_extra: { gap_state: {}, questions: '[]' } },
  3537: { id: 3537, jd_company: 'Axis Communications', analysis_extra: { gap_state: {}, questions: AXIS_Q, questionsJd: '5564:Job Title' } },
});

// access-relay in miniature: /api/active answers the GLOBAL pointer (no device_id), a PUT
// replaces the whole analysis_extra column like the relay's whitelist does.
function relay(rows, globalActive) {
  const calls = [];
  const fetch = (url, init) => {
    const method = ((init && init.method) || 'GET').toUpperCase();
    const path = String(url).replace(RELAY, '');
    let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch (_) {}
    calls.push({ method, path, body });
    const res = (status, j) => Promise.resolve({ ok: status < 300, status, json: async () => JSON.parse(JSON.stringify(j)) });
    if (path.indexOf('/api/active') === 0) return res(200, { ok: true, application_id: globalActive, source: 'global' });
    const m = /^\/api\/applications\/(\d+)$/.exec(path);
    if (!m || !rows[m[1]]) return res(404, { error: 'not_found' });
    const row = rows[m[1]];
    if (method === 'GET') return res(200, { ok: true, application: row });
    if (method === 'PUT') { if (body && body.analysis_extra !== undefined) row.analysis_extra = body.analysis_extra; return res(200, { ok: true, application: row }); }
    return res(405, {});
  };
  return { calls, fetch, writes: () => calls.filter((c) => c.method !== 'GET') };
}

function storage(map) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

// One tab: real jd-scope (per-tab app id in sessionStorage) + the sidecar, manual timers.
// `hold(url)` may return a promise that delays the relay's answer to that request.
function boot({ rows, globalActive, tabRow, local = {}, hold }) {
  const shared = new Map(Object.entries({ relayUrl: RELAY, 'antcv:auth:token': 'tok', 'antcv:jdScopeMigrated': '1', ...local }));
  const r = relay(rows, globalActive);
  const timers = [];
  let now = 1794170000000;
  const et = new EventTarget();
  const ctx = {
    console: { debug() {}, log() {}, info() {}, warn() {}, error() {} },
    localStorage: storage(shared), sessionStorage: storage(new Map()),
    fetch: (url, init) => { const h = hold && hold(String(url)); return h ? h.then(() => r.fetch(url, init)) : r.fetch(url, init); },
    Event, JSON, Date: { now: () => now },
    addEventListener: et.addEventListener.bind(et), dispatchEvent: et.dispatchEvent.bind(et),
    setTimeout: (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; },
    clearTimeout: (h) => { if (timers[h - 1]) timers[h - 1].fn = null; },
    setInterval: (fn, ms) => { timers.push({ at: now + ms, fn, every: ms }); return timers.length; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SCOPE, ctx);
  if (tabRow != null) ctx.AntcvJdScope.setCurrentAppId(String(tabRow));
  vm.runInContext(PERSIST, ctx);
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((res) => setImmediate(res)); };
  const advance = async (ms) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.fn && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      const fn = due.fn;
      if (due.every) due.at += due.every; else due.fn = null;
      fn();
      await flush();
    }
    now = end;
    await flush();
  };
  return { ctx, r, shared, advance, settle: () => ctx.dispatchEvent(new Event('antcv:sections-updated')) };
}

test('a tab on #3536 writes its analysis stores to #3536, never to the global pointer #3537', async () => {
  const rows = rowsFixture();
  const t = boot({ rows, globalActive: 3537, tabRow: 3536, local: { 'antcv:app:3536:questions': ELMA_Q, 'antcv:app:3536:questionsJd': '529:Kommerciel Produktchef' } });
  await t.advance(2000);   // boot sync
  t.settle();              // the app's settle nudge
  await t.advance(9000);
  const puts = t.r.writes();
  assert.equal(puts.length, 1, JSON.stringify(puts));
  assert.equal(puts[0].path, '/api/applications/3536');
  assert.deepEqual(Object.keys(puts[0].body), ['analysis_extra']);
  assert.equal(puts[0].body.analysis_extra.questions, ELMA_Q);
  assert.equal(rows[3537].analysis_extra.questions, AXIS_Q, 'Axis row keeps its own Q&A');
  assert.equal(rows[3537].analysis_extra.questionsJd, '5564:Job Title');
  assert.equal(t.r.calls.filter((c) => c.path.indexOf('/api/active') === 0).length, 0, 'the global pointer is not consulted');
  assert.equal(t.ctx.AntcvAnalysisPersist.target(), '3536');
});

test('restore fills the tab row\'s empty slot from THAT row, and sends no echo PUT', async () => {
  const rows = rowsFixture();
  rows[3536].analysis_extra = { gap_state: {}, questions: ELMA_Q };
  const t = boot({ rows, globalActive: 3537, tabRow: 3536 });
  await t.advance(2000);
  assert.equal(t.shared.get('antcv:app:3536:questions'), ELMA_Q);
  assert.ok(!Array.from(t.shared.values()).includes(AXIS_Q), 'no Axis Q&A in local storage');
  t.settle(); await t.advance(9000);
  t.settle(); await t.advance(9000);
  assert.equal(t.r.writes().length, 0, JSON.stringify(t.r.writes()));
});

test('a local edit after restore is pushed to the tab row', async () => {
  const rows = rowsFixture();
  const t = boot({ rows, globalActive: 3537, tabRow: 3536 });
  await t.advance(2000);
  t.shared.set('antcv:app:3536:questions', ELMA_Q);
  t.settle(); await t.advance(9000);
  assert.deepEqual(t.r.writes().map((w) => w.path), ['/api/applications/3536']);
  assert.equal(rows[3536].analysis_extra.questions, ELMA_Q);
  assert.equal(rows[3537].analysis_extra.questions, AXIS_Q);
});

test('no row yet (kernel scope) -> no GET, no PUT', async () => {
  const rows = rowsFixture();
  const t = boot({ rows, globalActive: 3537, tabRow: null, local: { 'antcv:app:kernel:questions': ELMA_Q } });
  await t.advance(2000);
  t.settle(); await t.advance(9000);
  assert.equal(t.r.calls.length, 0, JSON.stringify(t.r.calls));
});

test('a row switch while the GET is in flight drops the old row\'s answer', async () => {
  const rows = rowsFixture();
  let release, first = true;
  const held = new Promise((res) => { release = res; });
  const t = boot({
    rows, globalActive: 3537, tabRow: 3537,
    hold: (url) => (first && /\/api\/applications\/3537$/.test(url) ? ((first = false), held) : null),
  });
  await t.advance(2000);                        // GET 3537 issued and held
  t.ctx.AntcvJdScope.setCurrentAppId('3536');   // the user opens #3536
  await t.advance(100);
  release();                                    // the 3537 answer lands now
  await t.advance(9000);
  assert.equal(t.shared.get('antcv:app:3536:questions') ?? null, '[]', '3536 slot filled from #3536 only');
  assert.equal(t.shared.get('antcv:app:3537:questions') ?? null, null, 'the dropped answer writes nothing');
  assert.equal(t.r.writes().length, 0, JSON.stringify(t.r.writes()));
  assert.equal(t.ctx.AntcvAnalysisPersist.target(), '3536');
});
