// cluster-demand-live.test.mjs
// ============================================================
// CLUSTER-QUAL-001 stage 2b (section 3.4, owner 2026-07-05): the client-side
// half of "generation visibility" — antcv-cluster-demand-live.js reads the
// CURRENT application's real category (localStorage 'rationale'.category,
// CLUSTER-QUAL-001-CATEGORY-001) and asks access-relay's real
// GET /api/cluster-top20 endpoint (stage 2b server side, already tested in
// workers/access-relay/tests/cluster-top20-endpoint.test.mjs) for that
// category's cluster + top-20, exposing window.AntcvClusterDemandLive.get()
// as a synchronous, cache-only read for __clusterRule to prefer over the
// static 3-cluster seed (cluster-rule-live-preference.test.mjs covers that
// consumer side).
//
// This sidecar is a plain, self-contained IIFE (no app.js closures needed),
// so — unlike the source-level regression locks used for auth-heavy relay
// handlers or app.js's minified internals — it is exercised directly via a
// vm sandbox with fake localStorage/fetch/window, matching the pattern in
// application-qa-detect.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-cluster-demand-live.js', import.meta.url), 'utf8');

function load(store0, opts) {
  const store = new Map(Object.entries(store0 || {}));
  const fetchCalls = [];
  const listeners = {};
  const fetchImpl = (url) => {
    fetchCalls.push(url);
    const resp = (opts && opts.response) !== undefined ? opts.response : {
      ok: true,
      cluster_id: 'pm_process',
      jd_count: 2,
      top20: [
        { rank: 1, qual: 'Stakeholder management', weight_sum: 3.4, shared_clusters: ['photonics_eng'] },
        { rank: 2, qual: 'Requirements management', weight_sum: 2.1, shared_clusters: [] },
      ],
    };
    if (opts && opts.httpNotOk) return Promise.resolve({ ok: false });
    if (opts && opts.rejectFetch) return Promise.reject(new Error('network down'));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) });
  };
  const sandbox = {
    window: {
      ANTCV_RELAY_URL: (opts && 'relay' in opts) ? opts.relay : 'https://relay.example',
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      fetch: fetchImpl,
    },
    fetch: fetchImpl,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout(fn) { return 0; }, // never auto-fire the boot-time warm() in tests
    setInterval() { return 0; },
    clearInterval() {},
    console,
    Date, Set, Array, Object, Promise, JSON, String, Number, Boolean, Math,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvClusterDemandLive, store, fetchCalls, listeners, sandbox };
}

test('_currentCategory reads category off the rationale localStorage blob', () => {
  const { api } = load({ rationale: JSON.stringify({ category: 'pm_process', qualifications: [] }) });
  assert.equal(api._currentCategory(), 'pm_process');
});

test('_currentCategory returns "" when rationale is absent, malformed, or has no category', () => {
  assert.equal(load({}).api._currentCategory(), '');
  assert.equal(load({ rationale: 'not json' }).api._currentCategory(), '');
  assert.equal(load({ rationale: JSON.stringify({}) }).api._currentCategory(), '');
});

test('get() returns null with no category and never fetches', async () => {
  const { api, fetchCalls } = load({});
  assert.equal(api.get(), null);
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
});

test('get() returns null on the first call (cold cache) but triggers a background fetch; a later call sees live data', async () => {
  const { api, fetchCalls } = load({
    rationale: JSON.stringify({ category: 'pm_process' }),
    'antcv:auth:token': 'jwt-abc',
  });
  const first = api.get();
  assert.equal(first, null, 'first read must not block on the network');
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0], /\/api\/cluster-top20\?category=pm_process$/);
  const second = api.get();
  assert.ok(second, 'cache must be warm after the fetch resolved');
  assert.equal(second.clusterId, 'pm_process');
  assert.equal(second.cluster.top20.length, 2);
  assert.equal(second.cluster.top20[0].q, 'Stakeholder management');
  assert.deepEqual(second.cluster.top20[0].shared, ['photonics_eng']);
  assert.deepEqual(second.cluster.top20[1].shared, []);
});

test('kill switch: get() always returns null and never fetches when disabled', async () => {
  const { api, fetchCalls } = load({
    rationale: JSON.stringify({ category: 'pm_process' }),
    'antcv:auth:token': 'jwt-abc',
    'antcv:disable-cluster-demand-live': '1',
  });
  assert.equal(api.get(), null);
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 0);
});

test('no auth token or no relay base -> fetch resolves to null, get() stays null, never throws', async () => {
  const noToken = load({ rationale: JSON.stringify({ category: 'pm_process' }) });
  noToken.api.get();
  await new Promise((r) => setImmediate(r));
  assert.equal(noToken.fetchCalls.length, 0, 'must not even attempt the fetch without a token');
  assert.equal(noToken.api.get(), null);

  const noRelay = load(
    { rationale: JSON.stringify({ category: 'pm_process' }), 'antcv:auth:token': 'jwt-abc' },
    { relay: '' }
  );
  noRelay.api.get();
  await new Promise((r) => setImmediate(r));
  assert.equal(noRelay.fetchCalls.length, 0);
});

test('a non-ok HTTP response or a rejected fetch resolves to null and never throws', async () => {
  const httpErr = load(
    { rationale: JSON.stringify({ category: 'pm_process' }), 'antcv:auth:token': 'jwt-abc' },
    { httpNotOk: true }
  );
  httpErr.api.get();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(httpErr.api.get(), null);

  const netErr = load(
    { rationale: JSON.stringify({ category: 'pm_process' }), 'antcv:auth:token': 'jwt-abc' },
    { rejectFetch: true }
  );
  await netErr.api._fetchTop20('pm_process');
  assert.equal(netErr.api.get(), null);
});

test('an unrecognized category (server returns ok but no cluster) never populates the cache as live data', async () => {
  const { api } = load(
    { rationale: JSON.stringify({ category: 'unsolicited' }), 'antcv:auth:token': 'jwt-abc' },
    { response: { ok: true, cluster_id: null, top20: [] } }
  );
  await api._fetchTop20('unsolicited');
  assert.equal(api.get(), null);
});

test('repeated get() calls within the TTL window do not re-fetch', async () => {
  const { api, fetchCalls } = load({
    rationale: JSON.stringify({ category: 'pm_process' }),
    'antcv:auth:token': 'jwt-abc',
  });
  await api._fetchTop20('pm_process');
  api.get(); api.get(); api.get();
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls.length, 1, 'a warm, non-stale cache entry must not trigger a second fetch');
});

test('refresh() bypasses the TTL and forces a fresh fetch', async () => {
  const { api, fetchCalls } = load({
    rationale: JSON.stringify({ category: 'pm_process' }),
    'antcv:auth:token': 'jwt-abc',
  });
  await api._fetchTop20('pm_process');
  assert.equal(fetchCalls.length, 1);
  await api.refresh();
  assert.equal(fetchCalls.length, 2, 'refresh() must issue a new request even though the cache is still fresh');
});

test('installs window.AntcvClusterDemandLive with the expected public API', () => {
  const { api } = load({});
  assert.equal(typeof api.get, 'function');
  assert.equal(typeof api.refresh, 'function');
  assert.equal(typeof api.version, 'string');
});
