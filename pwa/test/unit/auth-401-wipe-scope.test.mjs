// auth-401-wipe-scope.test.mjs
// ============================================================
// ANALYTICS-BUTTONS-SESSION-TIMEOUT-001: the antcv-auth.js fetch wrapper wiped
// the session on ANY relay 401 whose error body contained 'auth' — and
// "Unauthorized" (the cv-proxy analytics body the relay passes through)
// contains 'auth'. One analytics button press signed the admin out and
// rebooted the app. The wipe is now scoped to the session-critical paths
// (/auth/*, /api/prefs) with the relay's own error strings only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-auth.js', import.meta.url), 'utf8');
const RELAY = 'https://antcv-access-relay.karp-gabriel-a.workers.dev';

function mkRes(status, bodyObj, headers) {
  const h = new Map(Object.entries(headers || {}));
  const self = {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => (h.has(k) ? h.get(k) : null) },
    json: async () => bodyObj,
    text: async () => JSON.stringify(bodyObj),
    clone: () => self,
  };
  return self;
}

function load(nextResponse) {
  const store = new Map();
  const calls = [];
  const sandbox = {
    window: {
      ANTCV_RELAY_URL: RELAY,
      addEventListener() {}, dispatchEvent() { return true; },
      fetch: async (input, init) => { calls.push({ input, init }); return nextResponse.res; },
      location: { href: 'https://antcv.pages.dev/', reload() {} },
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    document: { addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: null, getElementById: () => null, querySelector: () => null },
    navigator: { userAgent: 'test' },
    crypto: { getRandomValues: (a) => a },
    Headers, URL, console, JSON, Promise, Array, Object, String, Number, Math,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    CustomEvent: function () {}, Date, atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.sessionStorage = sandbox.sessionStorage;
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  // signed-in state
  store.set('antcv:auth:token', 'tok123');
  store.set('antcv:auth:email', 'admin@example.com');
  store.set('antcv:auth:expires_at', String(Math.floor(Date.now() / 1000) + 3600));
  return { w: sandbox.window, store, calls };
}

test('analytics 401 "Unauthorized — supply ?secret" (proxy passthrough) does NOT wipe the session', async () => {
  const box = { res: mkRes(401, { error: 'Unauthorized — supply ?secret=… or sign in' }) };
  const { w, store } = load(box);
  await w.fetch(RELAY + '/api/analytics/export?format=json&view=sessions', { credentials: 'include' });
  assert.equal(store.get('antcv:auth:token'), 'tok123', 'token survives the analytics 401');
});

test('analytics/summary 401 "unauthenticated" (relay identity miss on a non-session path) does NOT wipe', async () => {
  const box = { res: mkRes(401, { error: 'unauthenticated', hint: 'Sign in first.' }) };
  const { w, store } = load(box);
  await w.fetch(RELAY + '/analytics/summary', { credentials: 'include' });
  assert.equal(store.get('antcv:auth:token'), 'tok123', 'token survives a summary 401');
});

test('REAL session expiry still signs out: /api/prefs 401 "unauthenticated" wipes the token', async () => {
  const box = { res: mkRes(401, { error: 'unauthenticated' }) };
  const { w, store } = load(box);
  await w.fetch(RELAY + '/api/prefs', {});
  assert.equal(store.get('antcv:auth:token') || '', '', 'token wiped on the session path');
});

test('/auth/* 401 with an "expired" error wipes; non-session strings on session paths do not', async () => {
  const box = { res: mkRes(401, { error: 'session expired' }) };
  const { w, store } = load(box);
  await w.fetch(RELAY + '/auth/refresh', {});
  assert.equal(store.get('antcv:auth:token') || '', '', 'expired on /auth/* wipes');

  const box2 = { res: mkRes(401, { error: 'Unauthorized' }) };
  const l2 = load(box2);
  await l2.w.fetch(RELAY + '/api/prefs', {});
  assert.equal(l2.store.get('antcv:auth:token'), 'tok123', 'no "auth" substring matching even on session paths');
});

test('the Bearer is still attached to relay calls (wrapper front half untouched)', async () => {
  const box = { res: mkRes(200, { ok: true }) };
  const { w, calls } = load(box);
  await w.fetch(RELAY + '/analytics/summary', { credentials: 'include' });
  const hdrs = calls[0].init.headers;
  assert.equal(hdrs.get('Authorization'), 'Bearer tok123');
});
