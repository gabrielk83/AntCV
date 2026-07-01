// generate-cloud-sync-pi-merge.test.mjs
// ============================================================
// PI-MERGE-NO-CLOBBER-001 / CV-ACCESS-DROP-001 (owner 2026-07: "accessibility was seen in first
// generation, dropped in second"). antcv-generate-cloud-sync-277.js's GET-after-PUT step used to
// REPLACE the whole local `personalInfo` object with whatever the cloud GET returned. If the PUT
// silently failed (the failure is swallowed to a console.debug so the user is never blocked) and
// the cloud copy predates a locally-edited field (e.g. `accessibility`), the unconditional GET
// replace clobbered it. This test loads the real sidecar in a vm sandbox, mocks fetch so the PUT
// fails but the GET returns a personalInfo WITHOUT accessibility, and asserts the local
// `accessibility` survives (merge, not replace) while a field genuinely missing locally still
// gets filled in from cloud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-generate-cloud-sync-277.js', import.meta.url), 'utf8');

function load(initialLocalStorage, fetchImpl) {
  const store = new Map(Object.entries(initialLocalStorage || {}));
  const events = [];
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
  sandbox.window.dispatchEvent = (e) => { events.push(e); return true; };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    api: sandbox.window.AntcvGenerateCloudSync277,
    store,
    events,
    personalInfo: () => JSON.parse(store.get('personalInfo') || '{}'),
  };
}

const LOCAL_PI = {
  name: 'Gabriel',
  accessibility: 'Hearing impaired: Cochlear implant user. Captions & written follow-up work well.',
};

function baseStorage(extra) {
  return Object.assign({
    'antcv:auth:token': 't',
    proxyUrl: JSON.stringify('https://relay.example'),
    sections: JSON.stringify({ cv: [{ id: 'profile', type: 'text', title: 'PROFILE', content: 'Real profile content here.' }], cl: [] }),
    personalInfo: JSON.stringify(LOCAL_PI),
  }, extra || {});
}

test('a stale cloud personalInfo (PUT silently failed) does NOT clobber a real local field', async () => {
  // PUT fails (network error); GET succeeds and returns a personalInfo snapshot that PREDATES
  // the accessibility edit (cloud never had it — the original failure mode).
  const fetchImpl = (url, opts) => {
    if (opts.method === 'PUT') return Promise.reject(new Error('network error'));
    if (opts.method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ personalInfo: { name: 'Gabriel' } }), // no accessibility
      });
    }
    return Promise.reject(new Error('unexpected method'));
  };
  const ctx = load(baseStorage(), fetchImpl);
  const r = await ctx.api.syncBothWays();
  assert.equal(r.ok, true, 'sync reports ok (GET succeeded even though PUT failed)');
  assert.equal(ctx.personalInfo().accessibility, LOCAL_PI.accessibility, 'local accessibility survived the stale cloud GET');
  assert.equal(ctx.personalInfo().name, 'Gabriel', 'name still present');
});

test('a field present on cloud but missing locally IS filled in (folds in another device\'s edit)', async () => {
  const fetchImpl = (url, opts) => {
    if (opts.method === 'PUT') return Promise.resolve({ ok: true });
    if (opts.method === 'GET') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ personalInfo: { name: 'Gabriel', accessibility: LOCAL_PI.accessibility, phone: '+45 12345678' } }),
      });
    }
    return Promise.reject(new Error('unexpected method'));
  };
  // Local has no phone yet.
  const ctx = load(baseStorage({ personalInfo: JSON.stringify({ name: 'Gabriel', accessibility: LOCAL_PI.accessibility }) }), fetchImpl);
  const r = await ctx.api.syncBothWays();
  assert.equal(r.ok, true);
  assert.equal(ctx.personalInfo().phone, '+45 12345678', 'cloud-only field folded into local (multi-device fill-in still works)');
  assert.equal(ctx.personalInfo().accessibility, LOCAL_PI.accessibility, 'real local field unaffected');
});

test('no relay configured -> personalInfo is left completely untouched', async () => {
  const ctx = load(baseStorage({ proxyUrl: '' }), () => { throw new Error('fetch should not be called'); });
  const r = await ctx.api.syncBothWays();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-relay-url');
  assert.deepEqual(ctx.personalInfo(), LOCAL_PI, 'personalInfo untouched when sync cannot run at all');
});
