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
