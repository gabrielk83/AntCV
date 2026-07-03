// META-DOWNGRADE-GUARD-001 (register row 29, the NIL revert) — the cloud-sync
// GET step must never DOWNGRADE a targeted local meta to unsolicited/empty.
// A live writer-probe caught antcv-generate-cloud-sync-277.js flipping
// meta.company "NIL Technology" → "Unsolicited" mid-session (the cloud
// active_application lagged the local generation); the auto-save then
// persisted the flipped meta into the saved application row, poisoning it.
//
// Loads the REAL sidecar in a vm sandbox (same harness as the pi-merge test),
// mocks the relay GET to return a STALE unsolicited active_application, and
// asserts the targeted local meta survives — while a genuine upgrade
// (unsolicited local ← targeted cloud) still mirrors.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-generate-cloud-sync-277.js', import.meta.url), 'utf8');

function load(initialLocalStorage, fetchImpl) {
  const store = new Map(Object.entries(initialLocalStorage || {}));
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {} },
    JSON, Object, Array, String, Number, Boolean, RegExp, Math, Promise,
    setTimeout, clearTimeout,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {} }), body: { appendChild() {} } },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o || {}); },
    MouseEvent: function (t, o) { this.type = t; Object.assign(this, o || {}); },
  };
  sandbox.window = sandbox;
  sandbox.window.fetch = fetchImpl;
  sandbox.window.dispatchEvent = () => true;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvGenerateCloudSync277, store };
}

function storage(metaCompany, extra) {
  return Object.assign({
    'antcv:auth:token': 't',
    proxyUrl: JSON.stringify('https://relay.example'),
    sections: JSON.stringify({ cv: [], cl: [] }),
    personalInfo: JSON.stringify({ name: 'Gabriel' }),
    meta: JSON.stringify({ company: metaCompany, role: metaCompany === 'Unsolicited' ? 'Open Application' : 'Nanooptics Prototyping Engineer' }),
  }, extra || {});
}

function relayReturning(aa) {
  return async (url, opts) => {
    const method = (opts && opts.method) || 'GET';
    if (method === 'PUT' || method === 'POST') return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ active_application: aa, personalInfo: { name: 'Gabriel' } }) };
  };
}

test('stale unsolicited cloud row does NOT downgrade a targeted local meta', async () => {
  const ctx = load(storage('NIL Technology'), relayReturning({ jd_company: 'Unsolicited', jd_role: 'Open Application' }));
  await ctx.api.syncBothWays();
  const m = JSON.parse(ctx.store.get('meta'));
  assert.equal(m.company, 'NIL Technology', 'targeted meta survives the stale cloud mirror');
  assert.equal(m.role, 'Nanooptics Prototyping Engineer');
});

test('empty cloud company also counts as a downgrade — kept local', async () => {
  const ctx = load(storage('NIL Technology'), relayReturning({ jd_company: '', jd_role: 'Open Application' }));
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'NIL Technology');
});

test('genuine upgrade still mirrors: unsolicited local adopts a targeted cloud row', async () => {
  const ctx = load(storage('Unsolicited'), relayReturning({ jd_company: 'NIL Technology', jd_role: 'Nanooptics Prototyping Engineer' }));
  await ctx.api.syncBothWays();
  const m = JSON.parse(ctx.store.get('meta'));
  assert.equal(m.company, 'NIL Technology');
  assert.equal(m.role, 'Nanooptics Prototyping Engineer');
});

test('real-company → real-company change still mirrors (not a downgrade)', async () => {
  const ctx = load(storage('NIL Technology'), relayReturning({ jd_company: 'Terma A/S', jd_role: 'Senior Engineer' }));
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'Terma A/S');
});

test('kill switch restores the old mirror-everything behaviour', async () => {
  const ctx = load(storage('NIL Technology', { 'antcv:disable-meta-downgrade-guard': '1' }),
    relayReturning({ jd_company: 'Unsolicited', jd_role: 'Open Application' }));
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'Unsolicited');
});

// 277-SEQUENCE-GUARD-001 (register row 29 leg A, 1.51.124): never let an OLDER
// cloud application snapshot overwrite NEWER local state. Two guards: (1) the
// local meta identity changed DURING the round trip (a generation landed) ->
// the whole adoption is skipped; (2) the cloud row's updated_at predates the
// local meta-identity change beyond clock skew -> skipped.

test('in-flight guard: a generation landing mid round-trip is never re-clobbered', async () => {
  let ctxRef = null;
  const fetchImpl = async (url, opts) => {
    const method = (opts && opts.method) || 'GET';
    if (method === 'PUT') return { ok: true, status: 200, json: async () => ({}) };
    // the GENERATION lands while the GET is in flight: meta + sections change
    ctxRef.store.set('meta', JSON.stringify({ company: 'Trackman A/S', role: 'Project Manager, Hardware' }));
    ctxRef.store.set('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', title: 'PROFILE', content: 'Fresh Trackman profile prose.', items: [1] }], cl: [] }));
    return { ok: true, status: 200, json: async () => ({ active_application: {
      jd_company: 'NIL Technology', jd_role: 'Nanooptics Prototyping Engineer',
      cv_sections: [{ id: 'profile', type: 'text', title: 'PROFILE', content: 'STALE pre-gen profile.', items: [1] }],
      updated_at: new Date().toISOString(),
    } }) };
  };
  ctxRef = load(storage('Unsolicited'), fetchImpl);
  await ctxRef.api.syncBothWays();
  const m = JSON.parse(ctxRef.store.get('meta'));
  assert.equal(m.company, 'Trackman A/S', 'fresh mid-flight meta survives');
  const secs = JSON.parse(ctxRef.store.get('sections'));
  assert.match(secs.cv[0].content, /Fresh Trackman/, 'fresh mid-flight sections survive too');
});

test('staleness guard: a cloud row hours older than the local meta change is skipped', async () => {
  const old = new Date(Date.now() - 2 * 3600_000).toISOString();
  const ctx = load(
    storage('Trackman A/S', { 'antcv:metaStamp': JSON.stringify({ key: 'Trackman A/S|Nanooptics Prototyping Engineer', ts: Date.now() - 60_000 }) }),
    relayReturning({ jd_company: 'NIL Technology', jd_role: 'Old Role', updated_at: old })
  );
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'Trackman A/S', 'older cloud row never overwrites newer local meta');
});

test('staleness guard: a NEWER cloud row (other device) still mirrors; kill switch restores old behaviour', async () => {
  const fresh = new Date().toISOString();
  const ctx = load(
    storage('Trackman A/S', { 'antcv:metaStamp': JSON.stringify({ key: 'Trackman A/S|Nanooptics Prototyping Engineer', ts: Date.now() - 3600_000 }) }),
    relayReturning({ jd_company: 'NIL Technology', jd_role: 'Newer Role', updated_at: fresh })
  );
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'NIL Technology', 'genuinely newer cloud state wins');

  const old = new Date(Date.now() - 2 * 3600_000).toISOString();
  const killed = load(
    storage('Trackman A/S', {
      'antcv:metaStamp': JSON.stringify({ key: 'Trackman A/S|Nanooptics Prototyping Engineer', ts: Date.now() - 60_000 }),
      'antcv:disable-277-sequence-guard': '1',
    }),
    relayReturning({ jd_company: 'NIL Technology', jd_role: 'Old Role', updated_at: old })
  );
  await killed.api.syncBothWays();
  assert.equal(JSON.parse(killed.store.get('meta')).company, 'NIL Technology', 'kill switch: old mirror behaviour');
});

test('legacy cloud rows without updated_at keep the pre-guard behaviour', async () => {
  const ctx = load(
    storage('Unsolicited', { 'antcv:metaStamp': JSON.stringify({ key: 'Unsolicited|Open Application', ts: Date.now() - 60_000 }) }),
    relayReturning({ jd_company: 'NIL Technology', jd_role: 'Nanooptics Prototyping Engineer' })
  );
  await ctx.api.syncBothWays();
  assert.equal(JSON.parse(ctx.store.get('meta')).company, 'NIL Technology', 'no timestamp -> guard fails open');
});
