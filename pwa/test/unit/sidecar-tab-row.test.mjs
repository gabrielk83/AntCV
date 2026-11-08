// sidecar-tab-row.test.mjs
// ============================================================
// SIDECAR-ROW-001 (2026-11-09): the ANALYSIS-PERSIST-ROW-001 class in three more sidecars.
// Each read GET /api/active with no device_id, which the relay (readActivePointer) answers
// with the account's GLOBAL pointer, not the row this tab edits:
//   - antcv-analysis-merge-344.js: analysed the global row's JD and merged recruiter /
//     red_flags / gaps into THIS tab's rationale, which the auto-sync then PUTs to the
//     tab's row.
//   - antcv-recheck-fit.js: pre-filled its JD box with the global row's JD.
//   - antcv-parallel-translation-keep.js: learned the global row's primary language (the
//     tab's own PUTs went unguarded) and stamped a generation here onto the global row.
//
// Loads the REAL antcv-jd-scope.js + each sidecar into a vm window over a fake relay whose
// global pointer (#3537 Axis) differs from the tab's row (#3536 Elma).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const SCOPE = read('antcv-jd-scope.js');
const MERGE = read('antcv-analysis-merge-344.js');
const RECHECK = read('antcv-recheck-fit.js');
const KEEP = read('antcv-parallel-translation-keep.js');
const RELAY = 'https://relay.test';

const ELMA_JD = 'Kommerciel Produktchef til Elma Instruments i Farum. Du ejer porteføljen af testudstyr.';
const AXIS_JD = 'Job Title: Product Manager, Axis Communications, Lund. You own the network camera line.';
const EN_CV = [{ id: 'profile', title: 'Profile', content: 'Product manager for test instruments.' }];
const ZH_CV = [{ id: 'profile', title: '简介', content: '测试仪器产品经理。' }];

const rowsFixture = () => ({
  3536: { id: 3536, jd_company: 'Elma Instruments', jd_text: ELMA_JD, cv_sections: EN_CV, cl_sections: [] },
  3537: { id: 3537, jd_company: 'Axis Communications', jd_text: AXIS_JD, cv_sections: EN_CV, cl_sections: [] },
});

// access-relay in miniature: /api/active answers the GLOBAL pointer (no device_id);
// /api/jd-analysis tags its answer with the JD it was given.
function relay(rows, globalActive, hold) {
  const calls = [];
  const answer = (method, path, body) => {
    const res = (status, j) => ({ ok: status < 300, status, json: async () => JSON.parse(JSON.stringify(j)), text: async () => JSON.stringify(j) });
    if (path.indexOf('/api/active') === 0) return res(200, { ok: true, application_id: globalActive, source: 'global' });
    if (path === '/api/jd-analysis' && method === 'POST') {
      const tag = String((body && body.jd_text) || '').slice(0, 4);
      return res(200, { ok: true, analysis: { recruiter: { name: 'R-' + tag }, red_flags: ['flag-' + tag], gaps: ['gap-' + tag] } });
    }
    const m = /^\/api\/applications\/(\d+)$/.exec(path);
    if (!m || !rows[m[1]]) return res(404, { error: 'not_found' });
    const row = rows[m[1]];
    if (method === 'GET') return res(200, { ok: true, application: row });
    if (method === 'PUT') { Object.assign(row, body || {}); return res(200, { ok: true, application: row }); }
    return res(405, {});
  };
  const fetch = (url, init) => {
    const method = ((init && init.method) || 'GET').toUpperCase();
    const path = String(url).replace(RELAY, '');
    let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch (_) {}
    calls.push({ method, path, body });
    const h = hold && hold(method, path);
    return h ? h.then(() => answer(method, path, body)) : Promise.resolve(answer(method, path, body));
  };
  return {
    calls, fetch,
    to: (re) => calls.filter((c) => re.test(c.path)),
    active: () => calls.filter((c) => c.path.indexOf('/api/active') === 0),
  };
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

// Just enough DOM for the sidecars under test (this repo has no jsdom).
function fakeDocument(state) {
  const all = [];
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase(); this.children = []; this.style = {}; this.attrs = {};
      this.value = ''; this.textContent = ''; this.parentNode = null; this.id = '';
      this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
      all.push(this);
    }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
    replaceChild(n, o) { this.removeChild(o); return this.appendChild(n); }
    addEventListener() {} removeEventListener() {} focus() {} click() {}
    set innerHTML(_) { this.children = []; }
    get innerHTML() { return ''; }
  }
  const body = new El('body'), head = new El('head'), root = new El('html');
  const connected = (e) => { for (let n = e; n; n = n.parentNode) if (n === body || n === head) return true; return false; };
  const doc = {
    readyState: 'complete', body, head, documentElement: root,
    createElement: (t) => new El(t),
    createTextNode: (t) => { const n = new El('#text'); n.textContent = String(t); return n; },
    getElementById: (id) => all.find((e) => e.id === id && connected(e)) || null,
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === 'div' && state.analysisOpen ? [{ textContent: '📊 Application Analysis' }] : []),
    addEventListener() {}, removeEventListener() {},
  };
  return { doc, all };
}

// One tab: real jd-scope (per-tab app id in sessionStorage) + one sidecar, manual timers.
function boot(src, { rows, globalActive = 3537, tabRow = 3536, local = {}, hold, setup }) {
  const shared = new Map(Object.entries({ relayUrl: RELAY, proxyUrl: RELAY, 'antcv:auth:token': 'tok', 'antcv:jdScopeMigrated': '1', ...local }));
  const r = relay(rows, globalActive, hold);
  const timers = [];
  let now = 1794170000000;
  const et = new EventTarget();
  const state = { analysisOpen: true };
  const { doc, all } = fakeDocument(state);
  const ctx = {
    console: { debug() {}, log() {}, info() {}, warn() {}, error() {} },
    localStorage: storage(shared), sessionStorage: storage(new Map()),
    fetch: r.fetch, document: doc,
    Event, CustomEvent, EventTarget, JSON, Promise, Object, Array, String, Number, RegExp, Error,
    Date: { now: () => now },
    addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    setTimeout: (fn, ms) => { timers.push({ at: now + (ms || 0), fn }); return timers.length; },
    clearTimeout: (h) => { if (timers[h - 1]) timers[h - 1].fn = null; },
    setInterval: (fn, ms) => { timers.push({ at: now + ms, fn, every: ms }); return timers.length; },
    clearInterval: (h) => { if (timers[h - 1]) timers[h - 1].fn = null; },
    MutationObserver: class { observe() {} disconnect() {} },
  };
  ctx.requestAnimationFrame = (fn) => ctx.setTimeout(fn, 16);
  // the one vetted script detector (antcv-babel-relang.js), reduced to CJK-or-Latin
  ctx.__antcvContentScript = (cv, cl) => (/[一-鿿]/.test(JSON.stringify([cv, cl])) ? 'zh' : 'en');
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SCOPE, ctx);
  if (tabRow != null) ctx.AntcvJdScope.setCurrentAppId(String(tabRow));
  if (setup) setup(ctx);
  vm.runInContext(src, ctx);
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
  return { ctx, r, shared, all, advance, flush, scope: (id) => ctx.AntcvJdScope.setCurrentAppId(id) };
}

const heldOnce = (match) => {
  let release, used = false;
  const p = new Promise((res) => { release = res; });
  return { hold: (method, path) => (!used && match(method, path) ? ((used = true), p) : null), release: () => release() };
};
const rationale = (t) => JSON.parse(t.shared.get('rationale') || 'null');

// ---------------------------------------------------------------------------
// antcv-analysis-merge-344.js
// ---------------------------------------------------------------------------
const mergeLocal = (extra) => ({ rationale: JSON.stringify({ fit_summary: 'Elma fit' }), sections: JSON.stringify({ cv: EN_CV }), ...extra });

test('merge-344: a tab on #3536 analyses #3536\'s JD, never the global pointer\'s', async () => {
  const t = boot(MERGE, { rows: rowsFixture(), local: mergeLocal({ 'antcv:app:3536:jdText': ELMA_JD }) });
  await t.advance(4000);
  const posts = t.r.to(/^\/api\/jd-analysis$/);
  assert.equal(posts.length, 1, JSON.stringify(t.r.calls));
  assert.equal(posts[0].body.jd_text, ELMA_JD);
  assert.deepEqual(rationale(t).recruiter, { name: 'R-Komm' });
  assert.deepEqual(rationale(t).red_flags, ['flag-Komm']);
  assert.equal(rationale(t).fit_summary, 'Elma fit', 'fill-only merge keeps the generation\'s fields');
  assert.equal(t.r.active().length, 0, 'the global pointer is not consulted');
  assert.equal(t.r.to(/3537/).length, 0);
});

test('merge-344: an empty JD slot falls back to the tab row\'s own jd_text', async () => {
  const t = boot(MERGE, { rows: rowsFixture(), local: mergeLocal() });
  await t.advance(4000);
  assert.deepEqual(t.r.calls.map((c) => c.method + ' ' + c.path), ['GET /api/applications/3536', 'POST /api/jd-analysis']);
  assert.equal(t.r.to(/^\/api\/jd-analysis$/)[0].body.jd_text, ELMA_JD);
  assert.deepEqual(rationale(t).recruiter, { name: 'R-Komm' });
});

test('merge-344: no row yet (kernel scope) -> no request, rationale untouched', async () => {
  const t = boot(MERGE, { rows: rowsFixture(), tabRow: null, local: mergeLocal({ 'antcv:app:kernel:jdText': AXIS_JD }) });
  await t.advance(4000);
  assert.equal(t.r.calls.length, 0, JSON.stringify(t.r.calls));
  assert.deepEqual(rationale(t), { fit_summary: 'Elma fit' });
});

test('merge-344: a scope blip while the analysis runs keeps the answer for that row (one POST)', async () => {
  const h = heldOnce((m, p) => p === '/api/jd-analysis');
  const t = boot(MERGE, { rows: rowsFixture(), hold: h.hold, local: mergeLocal({ 'antcv:app:3536:jdText': ELMA_JD }) });
  await t.advance(100);                 // POST issued and held
  t.scope('kernel');                    // boot blip: 3536 -> kernel
  h.release(); await t.advance(4000);   // the answer lands while the tab has no row
  assert.equal(rationale(t).recruiter, undefined, 'not merged while the tab is off its row');
  t.scope('3536');                      // ... -> 3536
  await t.ctx.AntcvAnalysisMerge344.runMerge(); await t.flush();
  assert.deepEqual(rationale(t).recruiter, { name: 'R-Komm' });
  assert.equal(t.r.to(/^\/api\/jd-analysis$/).length, 1, 'the kept answer is reused, not re-requested');
});

test('merge-344: a row switch while the analysis runs never merges it into the new row', async () => {
  const h = heldOnce((m, p) => p === '/api/jd-analysis');
  const t = boot(MERGE, { rows: rowsFixture(), hold: h.hold, local: mergeLocal({ 'antcv:app:3536:jdText': ELMA_JD, 'antcv:app:3537:jdText': AXIS_JD }) });
  await t.advance(100);
  t.scope('3537');                                                   // the user opens #3537
  t.shared.set('rationale', JSON.stringify({ fit_summary: 'Axis fit' }));
  h.release(); await t.flush();
  assert.deepEqual(rationale(t), { fit_summary: 'Axis fit' }, 'Elma analysis kept out of Axis rationale');
  await t.ctx.AntcvAnalysisMerge344.runMerge(); await t.flush();
  const posts = t.r.to(/^\/api\/jd-analysis$/);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].body.jd_text, AXIS_JD);
  assert.deepEqual(rationale(t).recruiter, { name: 'R-Job ' });
});

// ---------------------------------------------------------------------------
// antcv-recheck-fit.js
// ---------------------------------------------------------------------------
async function openRecheck(t) {
  await t.ctx.AntcvRecheckFit.open();
  await t.flush();
  const ta = t.all.find((e) => e.tagName === 'TEXTAREA');
  assert.ok(ta, 'modal rendered its JD box');
  return ta.value;
}

test('recheck-fit: the JD box is pre-filled from the tab\'s own JD, not the global pointer', async () => {
  const t = boot(RECHECK, { rows: rowsFixture(), local: { 'antcv:app:3536:jdText': ELMA_JD } });
  assert.equal(await openRecheck(t), ELMA_JD);
  assert.equal(t.r.active().length, 0);
  assert.equal(t.r.to(/3537/).length, 0);
});

test('recheck-fit: an empty JD slot falls back to the tab row\'s jd_text', async () => {
  const t = boot(RECHECK, { rows: rowsFixture() });
  assert.equal(await openRecheck(t), ELMA_JD);
  assert.deepEqual(t.r.calls.map((c) => c.method + ' ' + c.path), ['GET /api/applications/3536']);
});

test('recheck-fit: no row yet (kernel scope) -> empty box, no request', async () => {
  const t = boot(RECHECK, { rows: rowsFixture(), tabRow: null, local: { 'antcv:app:kernel:jdText': AXIS_JD } });
  assert.equal(await openRecheck(t), '');
  assert.equal(t.r.calls.length, 0, JSON.stringify(t.r.calls));
});

// ---------------------------------------------------------------------------
// antcv-parallel-translation-keep.js
// ---------------------------------------------------------------------------
const put = (t, id, body) => t.ctx.fetch(RELAY + '/api/applications/' + id, { method: 'PUT', body: JSON.stringify(body) });
const lastPut = (t, id) => t.r.calls.filter((c) => c.method === 'PUT' && c.path === '/api/applications/' + id).pop();
async function generate(t, cv) {
  t.ctx.__antcvGenRunning = true; await t.advance(2000);
  t.shared.set('sections', JSON.stringify({ cv, cl: [] }));
  t.ctx.__antcvGenRunning = false; await t.advance(2000);
}

test('translation-keep: a Chinese view of #3536 is not saved over its English canonical (pointer on #3537)', async () => {
  const t = boot(KEEP, { rows: rowsFixture() });
  await t.advance(6000);
  await put(t, 3536, { cv_sections: ZH_CV, cl_sections: [], meta: { company: 'Elma Instruments' } });
  const sent = lastPut(t, 3536).body;
  assert.equal(sent.cv_sections, undefined, 'translated sections dropped from the PUT');
  assert.deepEqual(sent.meta, { company: 'Elma Instruments' });
  assert.equal(t.r.active().length, 0, 'the global pointer is not polled');
  assert.equal(t.ctx.AntcvParallelTranslationKeep._primary['3537'], undefined);
});

test('translation-keep: a generation stamps the tab\'s row, not the global pointer', async () => {
  const rows = rowsFixture();
  const t = boot(KEEP, { rows });
  await t.advance(6000);
  await generate(t, ZH_CV);
  const P = t.ctx.AntcvParallelTranslationKeep._primary;
  assert.equal(P['3536'], 'zh');
  assert.notEqual(P['3537'], 'zh');
  t.scope('3537');                        // the user opens #3537 in this tab
  await t.advance(5000);
  await put(t, 3537, { cv_sections: EN_CV, cl_sections: [] });
  assert.deepEqual(lastPut(t, 3537).body.cv_sections, EN_CV, '#3537\'s English save goes through');
});

test('translation-keep: a scope blip keeps the row\'s learned primary (no re-learn)', async () => {
  const t = boot(KEEP, { rows: rowsFixture() });
  await t.advance(6000);
  assert.equal(t.r.to(/^\/api\/applications\/3536$/).length, 1);
  await generate(t, ZH_CV);               // a fresh Chinese generation on #3536
  t.scope('kernel'); await t.advance(5000);
  t.scope('3536'); await t.advance(5000);
  assert.equal(t.r.to(/^\/api\/applications\/3536$/).filter((c) => c.method === 'GET').length, 1);
  assert.equal(t.ctx.AntcvParallelTranslationKeep._primary['3536'], 'zh');
  await put(t, 3536, { cv_sections: ZH_CV, cl_sections: [] });
  assert.deepEqual(lastPut(t, 3536).body.cv_sections, ZH_CV, 'the generation saves');
});

test('translation-keep: a learn answer that lands after a generation stamp is dropped', async () => {
  const h = heldOnce((m, p) => m === 'GET' && p === '/api/applications/3536');
  const t = boot(KEEP, { rows: rowsFixture(), hold: h.hold });
  await t.advance(1000);                  // learn GET issued and held
  await generate(t, ZH_CV);
  h.release(); await t.flush();
  assert.equal(t.ctx.AntcvParallelTranslationKeep._primary['3536'], 'zh');
});

test('translation-keep: no row yet (kernel scope) -> no request', async () => {
  const t = boot(KEEP, { rows: rowsFixture(), tabRow: null });
  await t.advance(10000);
  assert.equal(t.r.calls.length, 0, JSON.stringify(t.r.calls));
});
