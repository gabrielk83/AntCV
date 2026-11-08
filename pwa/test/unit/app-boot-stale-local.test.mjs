// app-boot-stale-local.test.mjs
// ============================================================
// BOOT-STALE-LOCAL-001 (2026-11-08, #3536 Elma on 1.51.6405): a relay PUT changed the row's
// core_comp table; then a tab whose local copy still held the OLDER document was reloaded.
// mount-hydrate kept the real local copy, the app POSTed and PUT it at once, and the boot GETs
// had re-stamped antcv-app-rev-guard.js, so the PUT carried the fresh base_rev and would have
// overwritten the newer row (a write blocker caught it).
//
// Loads the REAL antcv-tab-doc-isolation.js + antcv-app-rev-guard.js into vm "tabs" that share
// one localStorage and keep their own sessionStorage (a reload keeps it), over a fake relay
// that applies base_rev like access-relay (409 conflict on a mismatch).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ISO = readFileSync(new URL('../../antcv-tab-doc-isolation.js', import.meta.url), 'utf8');
const GUARD = readFileSync(new URL('../../antcv-app-rev-guard.js', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const appMin = readFileSync(new URL('../../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const V1 = { cv: [{ id: 'core', type: 'table', rows: ['old requirement table'] }], cl: [{ id: 'opening', type: 'rich_block', content: '', items: [{ t: 'Dear Elma' }] }] };
const V2 = { cv: [{ id: 'core', type: 'table', rows: ['NEW requirement table (relay PUT)'] }], cl: V1.cl };
const META = { company: 'Elma', role: 'Optical Engineer' };

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, clone() { return this; }, json: async () => body, headers: { get: () => 'application/json' } };
}

// access-relay in miniature: one row, updated_at moves on every write, base_rev checked on PUT.
function relay(clock) {
  const row = { id: 77, jd_company: 'Elma', jd_role: 'Optical Engineer', cv_sections: V1.cv, cl_sections: V1.cl, meta: META, updated_at: 1000 };
  const writes = [];
  const app = () => JSON.parse(JSON.stringify(row));
  return {
    row, writes,
    // another device / session writes the row directly
    foreignPut(fields) { Object.assign(row, fields); row.updated_at = clock.t += 1000; },
    fetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const method = ((init && init.method) || 'GET').toUpperCase();
      let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch (_) {}
      if (method === 'GET') return Promise.resolve(jsonRes(200, { ok: true, application: app() }));
      writes.push({ method, url, body });
      if (method === 'POST') { if (body && body.meta) row.meta = body.meta; row.updated_at = clock.t += 1; return Promise.resolve(jsonRes(200, { ok: true, application: app() })); }
      if (method === 'PUT') {
        if (body && body.base_rev != null && Number(body.base_rev) !== row.updated_at) return Promise.resolve(jsonRes(409, { error: 'conflict', updated_at: row.updated_at }));
        ['cv_sections', 'cl_sections', 'meta', 'rationale'].forEach((k) => { if (body && k in body) row[k] = body[k]; });
        row.updated_at = clock.t += 1;
        return Promise.resolve(jsonRes(200, { ok: true, application: app() }));
      }
      return Promise.resolve(jsonRes(404, {}));
    },
  };
}

class FakeResponse {
  constructor(b, o) { this.status = (o && o.status) || 200; this.ok = this.status < 300; this._b = b; }
  async json() { return JSON.parse(this._b); }
  clone() { return this; }
}

// One browser tab: its own window, the profile's shared localStorage, its own sessionStorage.
function tab(shared, session, r, clock, timers) {
  const store = {
    getItem: (k) => (shared.has(k) ? shared.get(k) : null),
    setItem: (k, v) => { shared.set(k, String(v)); },
    removeItem: (k) => { shared.delete(k); },
    clear: () => shared.clear(),
  };
  const sessionStorage = {
    getItem: (k) => (session.has(k) ? session.get(k) : null),
    setItem: (k, v) => session.set(k, String(v)),
    removeItem: (k) => session.delete(k),
  };
  const win = { addEventListener() {}, removeEventListener() {}, localStorage: store, sessionStorage, AntcvJdScope: { getCurrentAppId: () => '77' } };
  const sb = {
    window: win, document: { visibilityState: 'visible', addEventListener() {} }, localStorage: store, sessionStorage,
    setTimeout: (fn, ms) => { const t = { fn, ms, dead: false }; timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.dead = true; },
    setInterval: () => 0,
    Date: { now: () => clock.t }, Math, JSON, String, Object, Array, Number, Promise, RegExp, isFinite,
    Response: FakeResponse,
    console: { info() {}, log() {}, warn() {} },
  };
  win.fetch = r.fetch;
  vm.createContext(sb);
  vm.runInContext(ISO, sb);
  vm.runInContext(GUARD, sb);
  const g = win.AntcvAppRevGuard;
  const f = (url, init) => win.fetch('https://relay.example/api/' + url, init);
  return {
    sb, g, win, store,
    get: (id) => f('applications/' + id),
    put: (id, body) => f('applications/' + id, { method: 'PUT', body: JSON.stringify(body) }),
    post: (body) => f('applications', { method: 'POST', body: JSON.stringify(body) }),
    setDoc: (sec, meta) => { store.setItem('sections', JSON.stringify(sec)); store.setItem('meta', JSON.stringify(meta)); },
    doc: () => JSON.parse(store.getItem('sections') || 'null'),
  };
}
const tick = () => new Promise((res) => setTimeout(res, 5));
const whole = (sec) => ({ cv_sections: sec.cv, cl_sections: sec.cl, meta: META, rationale: null });

// The mount-hydrate of app.js (app.src.js ~19046) as it is after the fix.
async function bootHydrate(t, id) {
  const s = t.doc();
  const isTemplate = !s || !((s.cv && s.cv.length) || (s.cl && s.cl.length));
  let bd = null;
  if (isTemplate || ((bd = await t.g.bootCheck(id, () => t.get(id).then((x) => x.json()))) && bd.load)) {
    const detail = (bd && bd.res) || (await t.get(id).then((x) => x.json()));
    const n = detail.application;
    t.setDoc({ cv: n.cv_sections, cl: n.cl_sections }, n.meta);
    t.g.bootDone(id, n);
  }
  t.g.bootDone();
  return bd;
}

function world() {
  const clock = { t: 1793000000000 };
  const shared = new Map();
  const r = relay(clock);
  r.row.updated_at = clock.t;
  const timers = [];
  // past the 1.5 s drop window that follows a cloud load
  const later = () => { clock.t += 2000; };
  return { clock, shared, r, timers, later, open: (session) => tab(shared, session || new Map(), r, clock, timers) };
}

test('bootDecision: keep the local copy only when it is based on the row\'s current rev', () => {
  const { open } = world();
  const g = open().g;
  const d = (o) => JSON.parse(JSON.stringify(g.bootDecision(o))); // vm realm -> this realm
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '77', rev: 5 }, rowRev: 5 }), { load: false, reason: 'in-sync' });
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '77', rev: 5 }, rowRev: 9 }), { load: true, reason: 'row-newer' });
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '77', rev: 9 }, rowRev: 5 }), { load: true, reason: 'row-rev-changed' });
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '12', rev: 5 }, rowRev: 5 }), { load: true, reason: 'doc-of-other-row' });
  assert.deepEqual(d({ chosenId: 77, docRev: null, rowRev: 5 }), { load: true, reason: 'doc-rev-unknown' });
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '77', rev: 5 }, rowRev: undefined }), { load: false, reason: 'row-rev-unknown' });
  // a row with no sections would show the template over real local content: keep the local copy
  assert.deepEqual(d({ chosenId: 77, docRev: { id: '77', rev: 5 }, rowRev: 9, rowEmpty: true }), { load: false, reason: 'row-empty' });
});

test('bootCheck: a row with no cv and no cl sections keeps the real local copy and releases the held writes', async () => {
  const w = world();
  const a = w.open();
  a.setDoc(V1, META);
  const held = a.put(77, whole(V1));
  const bd = await a.g.bootCheck(77, () => Promise.resolve({ ok: true, application: { id: 77, updated_at: 9, cv_sections: null, cl_sections: [] } }));
  assert.equal(bd.load, false); assert.equal(bd.decision.reason, 'row-empty');
  assert.equal((await (await held).json()).ok, true);
  assert.equal(w.shared.get('antcv:bootStaleLocal'), undefined);
});

test('THE BUG: a reloaded tab with an older local copy loads the cloud row; its stale POST + PUT never reach the relay', async () => {
  const w = world();
  const session = new Map();
  // First life of the tab: boots on #77, loads the row, auto-syncs once.
  let a = w.open(session);
  await bootHydrate(a, 77);
  assert.deepEqual(a.doc(), V1);
  w.later();
  await a.put(77, whole(V1)); await tick();
  assert.equal(a.g.docRev().rev, w.r.row.updated_at, 'docRev = the rev of the tab\'s own whole-document write');

  // A session writes the row directly (the 1.51.6405 core_comp table PUT).
  w.r.foreignPut({ cv_sections: V2.cv });
  const before = w.r.writes.length;

  // Reload: same tab (its sessionStorage shadow keeps the OLD document + its docRev).
  a = w.open(session);
  assert.deepEqual(a.doc(), V1, 'the reloaded tab starts from its own (stale) copy');
  // app.js fires its first auto-syncs from that copy while mount-hydrate is still deciding.
  const stalePost = a.post({ jd_text: 'Elma JD', meta: { ...META, slogan: 'stale' }, cv_sections: V1.cv, cl_sections: V1.cl });
  await a.get(77); await tick(); // a boot GET re-stamps the rev guard (the old leak)
  const stalePut = a.put(77, whole(V1));
  const bd = await bootHydrate(a, 77);
  assert.equal(bd.load, true); assert.equal(bd.decision.reason, 'row-newer');
  const [pr, pu] = await Promise.all([stalePost, stalePut]);
  assert.deepEqual(await pr.json(), { ok: false, skipped: 'stale_doc' });
  assert.deepEqual(await pu.json(), { ok: false, skipped: 'stale_doc' });
  assert.equal(w.r.writes.length, before, 'no write reached the relay');
  assert.deepEqual(w.r.row.cv_sections, V2.cv, 'the newer row is intact');
  assert.deepEqual(a.doc(), V2, 'the editor holds the cloud row');
  assert.equal(a.g.docRev().rev, w.r.row.updated_at);
  const kept = JSON.parse(w.shared.get('antcv:bootStaleLocal'));
  assert.deepEqual(JSON.parse(kept.sections), V1, 'the local copy is kept, not destroyed');
  assert.equal(kept.reason, 'row-newer');

  // A write timer armed by the stale React state that fires just after the load is dropped too.
  w.clock.t += 500;
  assert.deepEqual(await (await a.put(77, whole(V1))).json(), { ok: false, skipped: 'stale_doc' });
  // After the window the tab saves normally, from the loaded row's rev.
  w.clock.t += 2000;
  const ok = await (await a.put(77, whole(V2))).json();
  assert.equal(ok.ok, true);
  assert.equal(w.r.writes.length, before + 1);
});

test('a reload whose copy is in sync with the row keeps it; the held writes go out in order with the row rev', async () => {
  const w = world();
  const session = new Map();
  let a = w.open(session);
  await bootHydrate(a, 77);
  w.later();
  await a.put(77, whole(V1)); await tick();
  a.setDoc({ cv: [{ id: 'core', type: 'table', rows: ['edit made just before F5'] }], cl: V1.cl }, META);

  a = w.open(session);
  const held = a.put(77, whole(a.doc()));
  assert.equal(a.g.gateState(), 'held');
  const bd = await bootHydrate(a, 77);
  assert.equal(bd.load, false); assert.equal(bd.decision.reason, 'in-sync');
  const j = await (await held).json();
  assert.equal(j.ok, true, 'the unsynced local edit is saved');
  assert.deepEqual(w.r.row.cv_sections[0].rows, ['edit made just before F5']);
  assert.equal(a.g.stats.bootReleased, 1);
  assert.equal(w.shared.get('antcv:bootStaleLocal'), undefined, 'nothing to back up');
});

test('docRev is per tab: a sibling tab\'s fresh write does not vouch for this tab\'s stale copy', async () => {
  const w = world();
  const sa = new Map(), sb = new Map();
  let a = w.open(sa);
  await bootHydrate(a, 77);
  w.later();
  await a.put(77, whole(V1)); await tick();
  // Tab B (same profile) loads the row and writes V2 as a whole document.
  const b = w.open(sb);
  await bootHydrate(b, 77);
  b.setDoc(V2, META);
  await b.put(77, whole(V2)); await tick();
  assert.equal(JSON.parse(w.shared.get('antcv:docRev')).rev, w.r.row.updated_at, 'the shared stamp is B\'s');
  // A reloads: its own shadow still holds V1 and A's own (older) stamp.
  a = w.open(sa);
  assert.deepEqual(a.doc(), V1);
  assert.notEqual(a.g.docRev().rev, w.r.row.updated_at);
  const bd = await bootHydrate(a, 77);
  assert.equal(bd.load, true);
  assert.deepEqual(a.doc(), V2);
});

test('docRev bookkeeping: whole writes and writes based on it advance it; GETs, upserts and foreign conflicts do not', async () => {
  const w = world();
  const a = w.open();
  await bootHydrate(a, 77);
  w.later();
  const r0 = a.g.docRev().rev;
  await a.post({ jd_text: 'x', meta: META }); await tick();
  assert.equal(a.g.docRev().rev, r0, 'an upsert bumps the row, not the document stamp');
  await a.put(77, { rationale: { x: 1 } }); await tick(); // partial, base_rev = the upsert's rev (not the document's)
  assert.equal(a.g.docRev().rev, r0, 'a partial write not based on the document rev does not vouch for it');
  await a.put(77, whole(V1)); await tick();
  const r1 = a.g.docRev().rev;
  assert.equal(r1, w.r.row.updated_at, 'a whole-document write does');
  await a.put(77, { rationale: { x: 2 } }); await tick();
  assert.equal(a.g.docRev().rev, w.r.row.updated_at, 'a partial write based on the document rev keeps it in sync');
  const r2 = a.g.docRev().rev;
  w.r.foreignPut({ cv_sections: V2.cv });
  await a.get(77); await tick();
  assert.equal(a.g.docRev().rev, r2, 'a GET never advances it');
  w.r.foreignPut({ cv_sections: V2.cv });
  const res = await (await a.put(77, whole(V1))).json();
  assert.equal(res.skipped, 'stale_rev', 'the guard stamp predates the second foreign write');
  assert.equal(a.g.docRev().rev, r2, 'a skipped write never advances it');
});

test('no decision: held writes are released after 60 s (fail-open); a load that never happened saves nothing', async () => {
  const w = world();
  const a = w.open();
  const p = a.put(77, whole(V1));
  assert.equal(a.g.gateState(), 'held');
  const t = w.timers.find((x) => x.ms === 60000 && !x.dead);
  assert.ok(t, 'hold timer armed on the first held write');
  t.fn();
  assert.equal((await (await p).json()).ok, true);
  assert.equal(a.g.gateState(), 'open');

  const b = w.open();
  const bd = await b.g.bootCheck(77, () => Promise.resolve({ application: { id: 77, updated_at: 1, cv_sections: V2.cv, cl_sections: V2.cl } }));
  assert.equal(bd.load, true); // the row rev is not the document's
  const q = b.put(77, whole(V1));
  b.g.bootDone(); // mount-hydrate ended without loading the row
  assert.equal(b.g.gateState(), 'stale');
  assert.deepEqual(await (await q).json(), { ok: false, skipped: 'stale_doc' });
  assert.deepEqual(await (await b.put(77, whole(V1))).json(), { ok: false, skipped: 'stale_doc' });
  b.g.markLoaded(77, w.r.row.updated_at); // reopening the application
  assert.equal(b.g.gateState(), 'open');
});

test('app.js mount-hydrate asks the guard before keeping a real local copy (source + mirror)', () => {
  const one = (s, x) => s.split(x).length - 1;
  assert.equal(one(appMin, '__rg&&__rg.bootCheck&&(__bd=await __rg.bootCheck(n,()=>vo.get(n)))&&__bd.load){const e=__bd&&__bd.res||await vo.get(n);'), 1);
  assert.equal(one(appMin, 'try{__rg&&__rg.bootDone&&__rg.bootDone(n,t)}catch(_){}'), 1);
  assert.equal(one(appMin, 'finally{as("");try{window.AntcvAppRevGuard&&window.AntcvAppRevGuard.bootDone&&window.AntcvAppRevGuard.bootDone()}catch(_){}}'), 1);
  assert.equal(one(appSrc, '(__bd = await __rg.bootCheck(__chosenId, () => oo.get(__chosenId)))'), 1);
  assert.equal(one(appSrc, '__rg && __rg.bootDone && __rg.bootDone(__chosenId, n);'), 1);
  assert.match(ISO, /DOC_KEYS = \['sections', 'meta', 'antcv:clSlogan', 'antcv:docRev'\]/);
});
