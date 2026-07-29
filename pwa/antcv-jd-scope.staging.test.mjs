// JD-SCOPE-COLDSTART-001 — the 'kernel' staging slot must be CONSUMED when a
// real application is adopted, so stale residue can never seed a later cold
// start and get auto-saved under another app's identity (the 3Shape
// re-poisoning class the relay JD-CROSS-APP-GUARD-001 catches server-side).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-jd-scope.js'), 'utf8');

function boot(seed = {}) {
  const store = new Map(Object.entries(seed));
  const mkStorage = () => ({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null,
  });
  const ls = mkStorage();
  const ss = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  const win = { localStorage: ls, sessionStorage: ss };
  // eslint-disable-next-line no-new-func
  new Function('window', 'sessionStorage', SRC)(win, ss);
  return { win, store, ls };
}

test('paste→create flow: staging migrates into the new app slot, kernel cleared', () => {
  const { win, store } = boot({ 'antcv:app:kernel:jdText': 'STAGED JD '.repeat(10), 'antcv:app:kernel:company': 'FDPARTS' });
  win.AntcvJdScope.setCurrentAppId('3001');
  assert.match(store.get('antcv:app:3001:jdText') || '', /STAGED JD/);
  assert.equal(store.get('antcv:app:3001:company'), 'FDPARTS');
  assert.equal(store.has('antcv:app:kernel:jdText'), false, 'kernel staging cleared');
  assert.equal(store.has('antcv:app:kernel:company'), false);
});

test('stale residue + app has its own JD: staging purged, app slot untouched', () => {
  const { win, store } = boot({
    'antcv:app:kernel:jdText': 'THREESHAPE RESIDUE '.repeat(10),
    'antcv:app:kernel:jdTextAt': String(Date.now() - 3600 * 1000),
    'antcv:app:2736:jdText': 'DANFOSS OWN JD '.repeat(10),
  });
  win.AntcvJdScope.setCurrentAppId('2736');
  assert.equal(store.has('antcv:app:kernel:jdText'), false, 'stale staging purged');
  assert.match(store.get('antcv:app:2736:jdText'), /DANFOSS OWN JD/, 'own JD kept');
});

test('FRESH staging + app has its own JD: another tab mid-paste is never robbed', () => {
  const { win, store } = boot({
    'antcv:app:kernel:jdText': 'LIVE PASTE IN OTHER TAB '.repeat(5),
    'antcv:app:kernel:jdTextAt': String(Date.now() - 30 * 1000),
    'antcv:app:2750:jdText': 'HAMAMATSU OWN JD '.repeat(10),
  });
  win.AntcvJdScope.setCurrentAppId('2750');
  assert.match(store.get('antcv:app:kernel:jdText') || '', /LIVE PASTE/, 'fresh staging survives');
  assert.match(store.get('antcv:app:2750:jdText'), /HAMAMATSU OWN JD/);
});

test('kernel writes are freshness-stamped through the redirect', () => {
  const { win, ls, store } = boot();
  // scope is kernel by default in a fresh tab
  ls.setItem('antcv:lastJdText', 'NEW PASTE');
  assert.equal(store.get('antcv:app:kernel:jdText'), 'NEW PASTE');
  assert.ok(Number(store.get('antcv:app:kernel:jdTextAt')) > 0, 'timestamp stamped');
  // adopting an app consumes it (fresh + empty app slot -> migrate)
  win.AntcvJdScope.setCurrentAppId('42');
  assert.equal(store.get('antcv:app:42:jdText'), 'NEW PASTE');
  assert.equal(store.has('antcv:app:kernel:jdText'), false);
});

test('redirect still scopes reads/writes per current app', () => {
  const { win, ls, store } = boot();
  win.AntcvJdScope.setCurrentAppId('7');
  ls.setItem('antcv:lastJdText', 'APP SEVEN JD');
  assert.equal(store.get('antcv:app:7:jdText'), 'APP SEVEN JD');
  assert.equal(ls.getItem('antcv:lastJdText'), 'APP SEVEN JD');
  win.AntcvJdScope.setCurrentAppId('8');
  assert.equal(ls.getItem('antcv:lastJdText'), null, 'app 8 sees no bleed from app 7');
});
