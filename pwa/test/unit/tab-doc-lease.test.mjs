// tab-doc-lease.test.mjs
// ============================================================
// TAB-DOC-LEASE-001 (2026-11-05): on antcv.pages.dev two tabs on different
// applications overwrote the shared localStorage `sections` 667 times in 20 s
// (recommendations Sagiv Szeltser <-> Rani Golan, _cutStamp 519401582 <->
// 1718610364) while the `antcv:docWriterTab` lease changed hands every
// 100-300 ms. The 1.0.0 lease was only a stamp. Each tab's write belts re-ran
// on content that arrived through `storage` events, app.js adopted it and
// autosaved it back, and app.js merged the other tab's `meta` into its own.
//
// These tests load the REAL sidecar into two vm "tabs" that share one
// localStorage, deliver cross-tab `storage` events like the browser (trusted,
// async, to every other tab), and run a model of app.js (500 ms autosave,
// sections-updated refresh, the 1.50.260 meta merge) plus a write belt shaped
// like sidebar-relevance-cut (stamps a cut computed from the tab's own JD).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-tab-doc-isolation.js', import.meta.url), 'utf8');
const DOC_KEYS = ['sections', 'meta', 'antcv:clSlogan'];

const X = {
  app: '101',
  meta: { company: 'Xray Optics', role: 'Optical Engineer' },
  doc: { owner: 'X', cv: [{ id: 'recommendations', items: [{ title: 'Sagiv Szeltser' }] }], cl: [{ id: 'opening', content: 'Xray opening' }] },
};
const Y = {
  app: '202',
  meta: { company: 'Yankee Lidar', role: 'Systems Engineer' },
  doc: { owner: 'Y', cv: [{ id: 'recommendations', items: [{ title: 'Rani Golan' }] }], cl: [{ id: 'opening', content: 'Yankee opening' }] },
};

// One browser profile: a shared localStorage, a virtual clock, tabs.
function browser() {
  const shared = new Map();
  const timers = [];
  const tabs = [];
  const writes = [];   // native localStorage writes: { tab, key, at }
  let now = 1793000000000, seq = 0, capped = false;

  function schedule(owner, fn, ms, every) {
    const t = { owner, at: now + Math.max(0, ms | 0), seq: seq++, fn, every, dead: false };
    timers.push(t);
    return t;
  }
  // Run timers in time order up to `ms` from now. A cross-tab loop shows up as a
  // write count that keeps growing; the step cap ends it instead of hanging.
  function run(ms, cap = 20000) {
    const end = now + ms;
    for (let n = 0; ; n++) {
      let best = null;
      for (const t of timers) {
        if (t.dead || t.owner.closed || t.at > end) continue;
        if (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
      }
      if (!best) break;
      if (n >= cap) { capped = true; break; }
      now = best.at;
      if (best.every) { best.at = now + best.every; best.seq = seq++; } else best.dead = true;
      best.fn();
    }
    now = end;
  }
  function broadcast(from, key, oldValue, newValue) {
    tabs.forEach((t) => {
      if (t === from || t.closed) return;
      schedule(t, () => t.fire({
        type: 'storage', key, oldValue, newValue, url: 'http://localhost:8080/',
        storageArea: t.store, isTrusted: true,
      }), 1);
    });
  }

  function open(name, { visible = true, session = new Map(), seed = {} } = {}) {
    const tab = { name, closed: false, session, appId: 'kernel' };
    const L = {};
    const add = (type, fn, opt) => (L[type] = L[type] || []).push({ fn, capture: opt === true || !!(opt && opt.capture) });
    tab.fire = (e) => {
      const ls = (L[e.type] || []).slice();
      e.stopImmediatePropagation = () => { e._stopped = true; };
      for (const l of ls.filter((x) => x.capture).concat(ls.filter((x) => !x.capture))) {
        if (e._stopped) break;
        l.fn(e);
      }
      return true;
    };
    tab.store = {
      getItem: (k) => (shared.has(k) ? shared.get(k) : null),
      setItem: (k, v) => {
        v = String(v);
        const old = shared.has(k) ? shared.get(k) : null;
        shared.set(k, v);
        writes.push({ tab: name, key: k, at: now });
        if (old !== v) broadcast(tab, k, old, v);
      },
      removeItem: (k) => {
        if (!shared.has(k)) return;
        const old = shared.get(k);
        shared.delete(k);
        writes.push({ tab: name, key: k, at: now });
        broadcast(tab, k, old, null);
      },
      clear: () => { shared.clear(); broadcast(tab, null, null, null); },
    };
    const sessionStorage = {
      getItem: (k) => (session.has(k) ? session.get(k) : null),
      setItem: (k, v) => session.set(k, String(v)),
      removeItem: (k) => session.delete(k),
    };
    const doc = { visibilityState: visible ? 'visible' : 'hidden', addEventListener: (t, fn) => add('document:' + t, fn) };
    const win = {
      addEventListener: add, removeEventListener() {}, dispatchEvent: (e) => tab.fire(e),
      localStorage: tab.store, sessionStorage,
      AntcvJdScope: { getCurrentAppId: () => tab.appId },
    };
    tab.win = win;
    tab.doc = doc;
    tab.setTimeout = (fn, ms) => schedule(tab, fn, ms);
    tab.setInterval = (fn, ms) => schedule(tab, fn, ms, ms);
    tab.show = () => { doc.visibilityState = 'visible'; (L['document:visibilitychange'] || []).forEach((l) => l.fn({ type: 'visibilitychange' })); };
    tab.hide = () => { doc.visibilityState = 'hidden'; (L['document:visibilitychange'] || []).forEach((l) => l.fn({ type: 'visibilitychange' })); };
    tab.input = () => tab.fire({ type: 'pointerdown', isTrusted: true });
    tab.close = () => { tab.fire({ type: 'pagehide', persisted: false }); tab.closed = true; };
    Object.entries(seed).forEach(([k, v]) => shared.set(k, v));
    const sb = {
      window: win, document: doc, localStorage: tab.store, sessionStorage,
      setTimeout: tab.setTimeout, setInterval: tab.setInterval, clearTimeout: (t) => { if (t) t.dead = true; },
      Date: { now: () => now }, Math, JSON, String, Object, Array,
      console: { info() {}, log() {}, warn() {} },
    };
    vm.createContext(sb);
    vm.runInContext(SRC, sb);
    tab.iso = win.AntcvTabDocIso;
    tabs.push(tab);
    return tab;
  }

  const docWrites = (pred = () => true) => writes.filter((w) => DOC_KEYS.includes(w.key) && pred(w));
  return { open, run, shared, writes, docWrites, now: () => now, capped: () => capped };
}

// app.js in miniature: the editor state, its 500 ms autosave, the
// sections-updated refresh (adopts what localStorage holds when it differs),
// the 1.50.260 `storage`-event meta merge, and one write belt that stamps a cut
// computed from THIS tab's application (sidebar-relevance-cut reads the tab's
// own JD), re-run on a cross-tab `sections` write and every 6 s.
function app(tab, own, { load = 'open' } = {}) {
  const LS = tab.win.localStorage;
  const a = { doc: null, meta: null, renders: 0, last: null };
  let saveT = null, metaT = null;
  tab.appId = own.app;
  const render = (doc) => {
    a.doc = doc;
    a.renders++;
    if (saveT) saveT.dead = true;
    saveT = tab.setTimeout(() => LS.setItem('sections', JSON.stringify(a.doc)), 500);
  };
  tab.win.addEventListener('antcv:sections-updated', () => {
    const raw = LS.getItem('sections');
    if (raw && raw !== a.last) { a.last = raw; render(JSON.parse(raw)); }
  });
  tab.win.addEventListener('storage', (e) => {
    if (e.key !== 'meta') return;
    const fresh = JSON.parse(e.newValue || LS.getItem('meta') || '{}');
    if (fresh.company === a.meta.company) return;
    a.meta = { ...a.meta, company: fresh.company, role: fresh.role };
    if (metaT) metaT.dead = true;
    metaT = tab.setTimeout(() => LS.setItem('meta', JSON.stringify(a.meta)), 300);
  });
  const belt = () => {
    const raw = LS.getItem('sections');
    if (!raw) return;
    const s = JSON.parse(raw);
    const stamp = 'cut:' + tab.appId;
    if (s._cutStamp === stamp) return;
    s._cutStamp = stamp;
    LS.setItem('sections', JSON.stringify(s));
    tab.win.dispatchEvent({ type: 'antcv:sections-updated', detail: { reason: 'sidebar-relevance-cut' } });
  };
  tab.win.addEventListener('storage', (e) => { if (e.key === 'sections') belt(); });
  tab.setInterval(belt, 6000);
  if (load === 'open') {
    a.meta = { ...own.meta };
    LS.setItem('meta', JSON.stringify(a.meta));
    LS.setItem('sections', JSON.stringify(own.doc));
  } else {
    a.meta = JSON.parse(LS.getItem('meta') || '{}');
  }
  tab.win.dispatchEvent({ type: 'antcv:sections-updated', detail: { reason: load } });
  belt();
  return a;
}

const owner = (raw) => (raw ? JSON.parse(raw).owner : null);
const rec = (doc) => doc.cv[0].items[0].title;

// Tab A opens application X; 2 s later tab B opens application Y.
function twoTabs() {
  const b = browser();
  const A = b.open('A');
  const appA = app(A, X);
  b.run(2000);
  const B = b.open('B');
  const appB = app(B, Y);
  const t0 = b.now();
  return { b, A, B, appA, appB, t0, rendersA: appA.renders };
}

test('THE BUG: two tabs on different applications converge; only the lease holder writes', () => {
  const { b, A, B, appA, appB, t0, rendersA } = twoTabs();
  b.run(20000);
  assert.equal(b.capped(), false, 'the timer queue drained (no endless cross-tab loop)');
  const after = b.docWrites((w) => w.at >= t0);
  assert.ok(after.length <= 6, `a handful of writes, got ${after.length}`);
  assert.equal(b.docWrites((w) => w.at >= t0 && w.tab === 'A').length, 0, 'the non-holder tab A writes nothing shared');
  assert.equal(b.docWrites((w) => w.at >= t0 + 5000).length, 0, 'quiet after the first seconds');
  assert.equal(B.iso.isHolder(), true);
  assert.equal(A.iso.isHolder(), false);
  // each tab keeps its own document and meta
  assert.equal(rec(appA.doc), 'Sagiv Szeltser');
  assert.equal(rec(appB.doc), 'Rani Golan');
  assert.equal(appA.meta.company, 'Xray Optics', 'the other tab\'s meta is not merged into A');
  assert.equal(owner(A.win.localStorage.getItem('sections')), 'X', 'A reads its own document');
  // the shared store holds the holder's document
  assert.equal(owner(b.shared.get('sections')), 'Y');
  assert.equal(JSON.parse(b.shared.get('meta')).company, 'Yankee Lidar');
  assert.ok(A.iso.stats.blocked > 0, 'A stopped the cross-tab writes');
  assert.equal(appA.renders, rendersA, 'A did not re-render for B\'s writes (Settings stays still)');
});

test('switching tabs hands the lease over with one publish; the other tab goes quiet', () => {
  const { b, A, B, appA, appB } = twoTabs();
  b.run(20000);
  const t1 = b.now();
  A.input();                              // the user clicks in tab A
  b.run(20000);
  assert.equal(A.iso.isHolder(), true);
  assert.equal(B.iso.isHolder(), false);
  assert.equal(owner(b.shared.get('sections')), 'X', 'A published its own document');
  assert.equal(JSON.parse(b.shared.get('meta')).company, 'Xray Optics');
  const after = b.docWrites((w) => w.at >= t1);
  assert.ok(after.every((w) => w.tab === 'A'), 'only A writes: ' + after.map((w) => w.tab + ':' + w.key).join(' '));
  assert.ok(after.length <= 3, `one publish per document key, got ${after.length}`);
  assert.equal(rec(appB.doc), 'Rani Golan', 'B keeps its own document');
  assert.equal(appB.meta.company, 'Yankee Lidar');
  assert.equal(rec(appA.doc), 'Sagiv Szeltser');
});

test('a hidden reload keeps the tab\'s own document and writes nothing until the tab is shown', () => {
  const { b, A, B } = twoTabs();
  b.run(20000);
  A.input();                              // A holds the lease, shared doc = X
  b.run(5000);
  const session = B.session;
  B.close();
  const t1 = b.now();
  const B2 = b.open('B2', { visible: false, session });
  const appB2 = app(B2, Y, { load: 'reload' });
  b.run(10000);
  assert.equal(owner(B2.win.localStorage.getItem('sections')), 'Y', 'the reloaded tab reads its own snapshot');
  assert.equal(rec(appB2.doc), 'Rani Golan');
  assert.equal(appB2.meta.company, 'Yankee Lidar');
  assert.equal(b.docWrites((w) => w.at >= t1 && w.tab === 'B2').length, 0, 'no shared write while hidden');
  assert.equal(owner(b.shared.get('sections')), 'X');
  B2.show();
  b.run(5000);
  assert.equal(B2.iso.isHolder(), true);
  assert.equal(owner(b.shared.get('sections')), 'Y', 'shown: it claims and publishes its own document');
  assert.equal(owner(A.win.localStorage.getItem('sections')), 'X', 'A still reads its own document');
});

test('same-tab synthetic storage events still reach the app (candidate editor meta hint)', () => {
  const b = browser();
  const A = b.open('A');
  const appA = app(A, X);
  b.run(1000);
  const edited = JSON.stringify({ ...X.meta, company: 'Xray Optics A/S' });
  A.win.localStorage.setItem('meta', edited);
  A.fire({ type: 'storage', key: 'meta', newValue: edited, isTrusted: false });
  b.run(1000);
  assert.equal(appA.meta.company, 'Xray Optics A/S');
  assert.equal(JSON.parse(b.shared.get('meta')).company, 'Xray Optics A/S', 'the holder publishes');
});

test('a single tab reads and writes the shared store as before', () => {
  const b = browser();
  const A = b.open('A');
  const appA = app(A, X);
  b.run(3000);
  assert.equal(A.iso.isHolder(), true);
  assert.equal(owner(b.shared.get('sections')), 'X');
  assert.equal(b.shared.get('sections'), A.win.localStorage.getItem('sections'));
  assert.equal(rec(appA.doc), 'Sagiv Szeltser');
});

test('clear() (erase / sign-out) empties the tab\'s own document too', () => {
  const b = browser();
  const A = b.open('A');
  app(A, X);
  b.run(1000);
  A.win.localStorage.clear();
  assert.equal(A.win.localStorage.getItem('sections'), null);
  assert.equal(A.win.localStorage.getItem('meta'), null);
  assert.equal(b.shared.has('sections'), false);
});

test('kill switch: no shadow, no lease (pre-1.0.0 behaviour)', () => {
  const b = browser();
  const A = b.open('A', { seed: { 'antcv:disable-tab-doc-iso': '1', sections: JSON.stringify(Y.doc) } });
  assert.equal(A.iso.disabled, true);
  A.win.localStorage.setItem('sections', JSON.stringify(X.doc));
  assert.equal(owner(b.shared.get('sections')), 'X');
  assert.equal(b.shared.has('antcv:docWriterTab'), false);
});
