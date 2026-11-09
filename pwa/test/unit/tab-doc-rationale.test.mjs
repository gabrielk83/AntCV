// tab-doc-rationale.test.mjs
// ============================================================
// TAB-DOC-RATIONALE-001 (2026-11-09): `rationale` (the Analysis panel object: fit_summary,
// recruiter, red_flags, gaps, qualifications, category ...) sat in a SHARED localStorage
// key while antcv-tab-doc-isolation.js shadowed only sections / meta / clSlogan / docRev
// per tab. Two AntCV tabs in one browser profile on different rows:
//   tab B loads #3537 Axis -> the shared `rationale` holds Axis's analysis;
//   tab A (#3536 Elma) opens Analysis -> antcv-analysis-merge-344.js reads that rationale,
//   merges Elma's recruiter / red flags into it and fires antcv:rationale-merge;
//   app.js re-hydrates `yo` from the key and the auto-sync PUTs Axis's analysis to #3536.
// Follow-up of SIDECAR-ROW-001 (side-session-notes/.../sidecar-row-SIDECAR-ROW-001.md).
//
// Loads the REAL antcv-jd-scope.js + antcv-tab-doc-isolation.js (and merge-344 where it
// matters) into vm "tabs" that share one localStorage and get cross-tab `storage` events
// like the browser (trusted, to every other tab). app.js is a model of the four places
// it touches the key: the boot read, the row load (NEW-1, value-or-null), the
// rationale-merge re-hydrate and the [yo] save effect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const SCOPE = read('antcv-jd-scope.js');
const ISO = read('antcv-tab-doc-isolation.js');
const MERGE = read('antcv-analysis-merge-344.js');
const RELAY = 'https://relay.test';

const ELMA_JD = 'Kommerciel Produktchef til Elma Instruments i Farum. Du ejer porteføljen af testudstyr.';
const AXIS_JD = 'Job Title: Product Manager, Axis Communications, Lund. You own the network camera line.';
const ELMA = { id: 3536, jd_company: 'Elma Instruments', jd_text: ELMA_JD, rationale: { fit_summary: 'Elma fit', category: 'product_management' } };
const AXIS = { id: 3537, jd_company: 'Axis Communications', jd_text: AXIS_JD, rationale: { fit_summary: 'Axis fit', category: 'product_management' } };
const NOVO = { id: 3538, jd_company: 'Novo Nordisk', jd_text: 'Novo JD', rationale: { fit_summary: 'Novo fit' } };
const BARE = { id: 3539, jd_company: 'Bare Row', jd_text: 'Bare JD', rationale: null };

// access-relay in miniature: /api/jd-analysis tags its answer with the JD it was given.
function relay() {
  const calls = [];
  const res = (status, j) => ({ ok: status < 300, status, json: async () => JSON.parse(JSON.stringify(j)), text: async () => JSON.stringify(j) });
  const fetch = (url, init) => {
    const method = ((init && init.method) || 'GET').toUpperCase();
    const path = String(url).replace(RELAY, '');
    let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch (_) {}
    calls.push({ method, path, body });
    if (path === '/api/jd-analysis' && method === 'POST') {
      const tag = String((body && body.jd_text) || '').slice(0, 4);
      return Promise.resolve(res(200, { ok: true, analysis: { recruiter: { name: 'R-' + tag }, red_flags: ['flag-' + tag] } }));
    }
    return Promise.resolve(res(404, { error: 'not_found' }));
  };
  return { calls, fetch };
}

// Just enough DOM for merge-344 (this repo has no jsdom).
function fakeDocument(state) {
  class El {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.style = { setProperty() {} }; this.attrs = {}; this.textContent = ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
    appendChild(c) { this.children.push(c); return c; }
    addEventListener() {}
  }
  const body = new El('body');
  return {
    visibilityState: 'visible', readyState: 'complete', body, head: new El('head'), documentElement: new El('html'),
    createElement: (t) => new El(t),
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === 'div' && state.analysisOpen ? [{ textContent: '📊 Application Analysis' }] : []),
  };
}

// One browser profile: a shared localStorage, a virtual clock, tabs.
function browser() {
  const shared = new Map(Object.entries({
    relayUrl: RELAY, proxyUrl: RELAY, 'antcv:auth:token': 'tok', 'antcv:jdScopeMigrated': '1',
    'antcv:app:3536:jdText': ELMA_JD, 'antcv:app:3537:jdText': AXIS_JD,
  }));
  const timers = [];
  const tabs = [];
  let now = 1794170000000, seq = 0;
  const schedule = (owner, fn, ms, every) => {
    const t = { owner, at: now + Math.max(0, ms | 0), seq: seq++, fn, every, dead: false };
    timers.push(t);
    return t;
  };
  const flush = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  async function run(ms) {
    const end = now + ms;
    for (let n = 0; n < 5000; n++) {
      let best = null;
      for (const t of timers) {
        if (t.dead || t.owner.closed || t.at > end) continue;
        if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
      }
      if (!best) break;
      now = best.at;
      if (best.every) { best.at = now + best.every; best.seq = seq++; } else best.dead = true;
      best.fn();
      await flush();
    }
    now = end;
    await flush();
  }
  function broadcast(from, key, oldValue, newValue) {
    tabs.forEach((t) => {
      if (t === from || t.closed) return;
      schedule(t, () => t.fire({ type: 'storage', key, oldValue, newValue, storageArea: t.ctx.localStorage, isTrusted: true }), 1);
    });
  }

  function open(name, { visible = true, session = new Map() } = {}) {
    const tab = { name, closed: false, session, seen: [] };
    const L = {};
    const add = (type, fn, opt) => (L[type] = L[type] || []).push({ fn, capture: opt === true || !!(opt && opt.capture) });
    tab.fire = (e) => {
      const ls = (L[e.type] || []).slice();
      let stopped = false;
      try { e.stopImmediatePropagation = () => { stopped = true; }; } catch (_) {}
      for (const l of ls.filter((x) => x.capture).concat(ls.filter((x) => !x.capture))) {
        if (stopped) break;
        l.fn(e);
      }
      return true;
    };
    const store = {
      getItem: (k) => (shared.has(k) ? shared.get(k) : null),
      setItem: (k, v) => {
        v = String(v);
        const old = shared.has(k) ? shared.get(k) : null;
        shared.set(k, v);
        if (old !== v) broadcast(tab, k, old, v);
      },
      removeItem: (k) => {
        if (!shared.has(k)) return;
        const old = shared.get(k);
        shared.delete(k);
        broadcast(tab, k, old, null);
      },
      clear: () => { shared.clear(); broadcast(tab, null, null, null); },
      key: (i) => Array.from(shared.keys())[i] ?? null,
      get length() { return shared.size; },
    };
    const sessionStorage = {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => session.set(k, String(v)),
      removeItem: (k) => session.delete(k),
    };
    tab.state = { analysisOpen: true };
    const doc = fakeDocument(tab.state);
    doc.visibilityState = visible ? 'visible' : 'hidden';
    doc.addEventListener = (t, fn) => add('document:' + t, fn);
    tab.relay = relay();
    const ctx = {
      console: { debug() {}, log() {}, info() {}, warn() {}, error() {} },
      localStorage: store, sessionStorage, document: doc, fetch: tab.relay.fetch,
      Event, CustomEvent, JSON, Promise, Object, Array, String, Number, RegExp, Error, Math,
      Date: { now: () => now },
      addEventListener: add, removeEventListener() {}, dispatchEvent: (e) => tab.fire(e),
      setTimeout: (fn, ms) => schedule(tab, fn, ms),
      clearTimeout: (t) => { if (t) t.dead = true; },
      setInterval: (fn, ms) => schedule(tab, fn, ms, ms),
      clearInterval: (t) => { if (t) t.dead = true; },
      MutationObserver: class { observe() {} disconnect() {} },
    };
    ctx.requestAnimationFrame = (fn) => ctx.setTimeout(fn, 16);
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(SCOPE, ctx);   // index.html line 47
    vm.runInContext(ISO, ctx);     // index.html line 59
    tab.ctx = ctx;
    tab.ls = ctx.localStorage;
    tab.rationale = () => JSON.parse(tab.ls.getItem('rationale') || 'null');
    tab.load = (src) => vm.runInContext(src, ctx);
    tab.hide = () => { doc.visibilityState = 'hidden'; (L['document:visibilitychange'] || []).forEach((l) => l.fn({ type: 'visibilitychange' })); };
    tab.input = () => tab.fire({ type: 'pointerdown', isTrusted: true });
    tab.close = () => { tab.fire({ type: 'pagehide', persisted: false }); tab.closed = true; };
    // a sidecar listening for cross-tab `storage` (registered after the isolation layer)
    add('storage', (e) => { if (e.isTrusted) tab.seen.push(e.key); });
    tab.app = app(tab);
    tabs.push(tab);
    return tab;
  }
  const sharedRationale = () => JSON.parse(shared.get('rationale') || 'null');
  return { open, run, shared, sharedRationale };
}

// app.js in miniature, the four places it touches `rationale`:
//   ~18359 boot read `[yo, bo] = e(() => u.get("rationale", null))`
//   ~19119 row load (NEW-1): bo(n.rationale || null); u.set("rationale", n.rationale || null)
//   ~18552 antcv:rationale-merge -> bo(u.get("rationale"))
//   ~19161 [yo] effect -> u.set("rationale", yo)
function app(tab) {
  const LS = tab.ls;
  const get = (k) => { try { const n = LS.getItem(k); return n ? JSON.parse(n) : null; } catch (_) { return null; } };
  const a = { yo: get('rationale') };
  const setYo = (v) => { a.yo = v; LS.setItem('rationale', JSON.stringify(v)); };
  tab.ctx.addEventListener('antcv:rationale-merge', () => { const r = get('rationale'); if (r && typeof r === 'object') setYo(r); });
  a.loadRow = (row) => {
    tab.ctx.AntcvJdScope.setCurrentAppId(String(row.id));
    LS.setItem('sections', JSON.stringify({ owner: row.jd_company, cv: [], cl: [] }));
    LS.setItem('meta', JSON.stringify({ company: row.jd_company }));
    setYo(row.rationale || null);
  };
  // what the auto-sync PUT carries
  a.autoSync = () => ({ id: tab.ctx.AntcvJdScope.getCurrentAppId(), rationale: a.yo });
  return a;
}

// Tab A opens #3536 Elma, the user moves to tab B, B opens #3537 Axis.
function twoTabs() {
  const b = browser();
  const A = b.open('A');
  A.app.loadRow(ELMA);
  A.hide();
  const B = b.open('B');
  B.app.loadRow(AXIS);
  return { b, A, B };
}

test('the isolation layer shadows `rationale` per tab', () => {
  const { A } = twoTabs();
  assert.ok(A.ctx.AntcvTabDocIso.keys.includes('rationale'), JSON.stringify(A.ctx.AntcvTabDocIso.keys));
});

test('tab B loading #3537 leaves tab A on #3536 reading its own rationale', async () => {
  const { b, A, B } = twoTabs();
  await b.run(50);
  assert.equal(A.rationale().fit_summary, 'Elma fit');
  assert.equal(B.rationale().fit_summary, 'Axis fit');
  assert.equal(b.sharedRationale().fit_summary, 'Axis fit', 'the lease holder (B) owns the shared copy');
  assert.deepEqual(A.app.autoSync(), { id: '3536', rationale: ELMA.rationale });
});

test('merge-344 in tab A merges into #3536\'s rationale; A\'s auto-sync never carries Axis\'s analysis', async () => {
  const { b, A, B } = twoTabs();
  A.load(MERGE);
  await b.run(5000);
  const posts = A.relay.calls.filter((c) => c.path === '/api/jd-analysis');
  assert.equal(posts.length, 1, JSON.stringify(A.relay.calls));
  assert.equal(posts[0].body.jd_text, ELMA_JD);
  const put = A.app.autoSync();
  assert.equal(put.id, '3536');
  assert.equal(put.rationale.fit_summary, 'Elma fit', 'pre-fix: Axis fit (the shared key held tab B\'s analysis)');
  assert.deepEqual(put.rationale.recruiter, { name: 'R-Komm' });
  assert.deepEqual(put.rationale.red_flags, ['flag-Komm']);
  assert.equal(B.rationale().fit_summary, 'Axis fit');
  assert.equal(B.rationale().recruiter, undefined, 'Elma\'s recruiter never lands in tab B\'s analysis');
  assert.equal(b.sharedRationale().recruiter, undefined, 'a non-holder tab publishes nothing shared');
});

test('a cross-tab `storage` event for rationale stops at the isolation layer', async () => {
  const { b, A } = twoTabs();
  await b.run(50);
  assert.ok(!A.seen.includes('rationale'), 'tab A saw: ' + JSON.stringify(A.seen));
});

test('a row switch in a non-holder tab lands the row\'s rationale in that tab only; a claim publishes it', async () => {
  const { b, A, B } = twoTabs();
  A.app.loadRow(NOVO);
  await b.run(50);
  assert.equal(A.rationale().fit_summary, 'Novo fit');
  assert.deepEqual(A.app.autoSync(), { id: '3538', rationale: NOVO.rationale });
  assert.equal(B.rationale().fit_summary, 'Axis fit', 'pre-fix: Novo fit');
  assert.equal(b.sharedRationale().fit_summary, 'Axis fit');
  A.input();   // the user comes back to tab A: it claims the lease and publishes its document
  await b.run(50);
  assert.equal(b.sharedRationale().fit_summary, 'Novo fit');
  assert.equal(JSON.parse(b.shared.get('sections')).owner, 'Novo Nordisk', 'sections and rationale publish as one document');
  assert.equal(B.rationale().fit_summary, 'Axis fit', 'tab B keeps its own');
});

test('NEW-1: a row with no rationale clears only this tab\'s analysis', async () => {
  const { b, A, B } = twoTabs();
  A.app.loadRow(BARE);
  await b.run(50);
  assert.equal(A.rationale(), null);
  assert.equal(A.app.autoSync().rationale, null);
  assert.equal(B.rationale().fit_summary, 'Axis fit', 'pre-fix: null');
});

test('a fresh tab boots with the lease holder\'s sections AND rationale (one document, not a mix)', async () => {
  const { b, A } = twoTabs();
  A.app.loadRow(NOVO);   // non-holder: shadow only
  await b.run(50);
  const C = b.open('C');
  assert.equal(JSON.parse(C.ls.getItem('sections')).owner, 'Axis Communications');
  assert.equal(C.rationale().fit_summary, 'Axis fit', 'pre-fix: Novo fit (A\'s rationale beside B\'s sections)');
});

test('reload keeps the tab\'s own rationale', async () => {
  const { b, A } = twoTabs();
  await b.run(50);
  A.close();
  const A2 = b.open('A', { visible: false, session: A.session });
  assert.equal(A2.rationale().fit_summary, 'Elma fit', 'pre-fix: Axis fit');
  assert.equal(A2.app.yo.fit_summary, 'Elma fit', 'app.js boot read');
});

test('a tab whose snapshot predates the rationale key takes it from the shared store once, then keeps its own', async () => {
  const b = browser();
  b.shared.set('rationale', JSON.stringify({ fit_summary: 'Shared fit' }));
  b.shared.set('sections', JSON.stringify({ owner: 'Shared' }));
  // a 2.1.0 snapshot: the four old keys, no rationale
  const session = new Map(Object.entries({
    'antcv:tabId': 't_old', 'antcv:tabDoc:v': '2',
    'antcv:tabDoc:sections': JSON.stringify({ owner: 'Own' }), 'antcv:tabDoc:meta': JSON.stringify({ company: 'Own' }),
  }));
  const A = b.open('A', { visible: false, session });
  assert.equal(JSON.parse(A.ls.getItem('sections')).owner, 'Own', 'the old keys still come from the snapshot');
  assert.equal(A.rationale().fit_summary, 'Shared fit', 'no null analysis on the first boot after the deploy');
  assert.equal(session.get('antcv:tabDoc:rationale'), JSON.stringify({ fit_summary: 'Shared fit' }));
  b.shared.set('rationale', JSON.stringify({ fit_summary: 'Other tab fit' }));
  A.close();
  const A2 = b.open('A', { visible: false, session });
  assert.equal(A2.rationale().fit_summary, 'Shared fit', 'the second reload restores the tab\'s own copy');
});

test('the unsolicited guard\'s removeItem in a non-holder tab clears only that tab', async () => {
  const { b, A, B } = twoTabs();
  A.ls.removeItem('rationale');   // antcv-unsolicited-identity-guard.js scrubSidecarKeys
  await b.run(50);
  assert.equal(A.ls.getItem('rationale'), null);
  assert.equal(B.rationale().fit_summary, 'Axis fit', 'pre-fix: null');
  assert.equal(b.sharedRationale().fit_summary, 'Axis fit');
});

test('kill switch: antcv:disable-tab-doc-iso shares rationale again', async () => {
  const b = browser();
  b.shared.set('antcv:disable-tab-doc-iso', '1');
  const A = b.open('A');
  A.app.loadRow(ELMA);
  const B = b.open('B');
  B.app.loadRow(AXIS);
  assert.equal(A.rationale().fit_summary, 'Axis fit');
});
