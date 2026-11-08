// upsert-dedupe.test.mjs
// ============================================================
// UPSERT-DEDUPE-001 (2026-11-08): the app.js effect that calls the application
// upsert (cloudWriteApplication, `no` in app.src.js) runs on every `ro` change.
// Belts and the autosave give `ro` a new identity every ~2.4 s with the same
// content, so the 2 s debounce sent POST /api/applications with the SAME body
// every ~2.4 s (measured locally: 5 x 9961 bytes, 2.4 s apart). Each POST bumped
// updated_at and raced the auto-sync PUT (AUTOSYNC-STALE-REV-001).
//
// These tests run the DEPLOYED function: they cut it out of pwa/app.js by its
// code shape (minified names change between builds) and run it in a vm with a
// scripted relay and hand-driven timers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const SRC = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');

// The upsert: `<name>=e=>{if(!<gate>.current){...` up to its 2 s debounce close.
function extract() {
  const post = APP.indexOf('fetch(t+"/api/applications",{method:"POST"');
  assert.ok(post > 0, 'the upsert POST is in app.js');
  const end = APP.indexOf('},2e3))}', post);
  const head = APP.lastIndexOf('=e=>{if(!', post);
  const nameStart = APP.slice(0, head).search(/[A-Za-z_$][\w$]*$/);
  const name = APP.slice(nameStart, head);
  const body = APP.slice(nameStart, end + '},2e3))}'.length);
  const m = (re) => { const r = re.exec(body); assert.ok(r, 'shape: ' + re); return r; };
  return {
    name, body,
    gate: m(/^[\w$]+=e=>\{if\(!([\w$]+)\.current\)/)[1],
    user: m(/if\(!([\w$]+)\|\|!\1\.email\)return/)[1],
    ls: m(/String\(([\w$]+)\.get\("proxyUrl"/)[1],
    refs: [...new Set([...body.matchAll(/([\w$]+)\.current/g)].map((x) => x.at(1)))],
    jd: m(/e\.jd_text\|\|([\w$]+)\.current\|\|([\w$]+)\|\|""/),
    meta: m(/e\.meta:([\w$]+)\|\|\{\}/)[1],
    stub: m(/r=n===([\w$]+)\|\|/)[1],
    rationale: m(/e\.rationale:([\w$]+)/)[1],
    sections: m(/e\.sections:([\w$]+);/)[1],
  };
}

function load() {
  const x = extract();
  const posts = [];
  const timers = new Map();
  let tid = 0;
  const relay = { status: 200, fail: false, url: 'https://relay.test' };
  const store = new Map([['proxyUrl', JSON.stringify(relay.url)]]);
  const win = {
    __antcvUnsol: (v) => /^unsolicited$/i.test(String(v || '').trim()),
  };
  const ctx = {
    window: win,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout: (fn) => { const id = ++tid; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
    fetch: (url, opts) => {
      if (relay.fail) return Promise.reject(new Error('network down'));
      posts.push({ url, body: opts.body });
      const json = relay.status === 200 ? { ok: true, application: { id: 3527 } } : { ok: false };
      return Promise.resolve({ ok: relay.status === 200, status: relay.status, clone: () => ({ json: async () => json }) });
    },
    console: { warn() {}, log() {}, info() {} },
    JSON, String, Object, Array, Date, RegExp, Error, Promise,
  };
  x.refs.forEach((r) => { ctx[r] = { current: r === x.gate ? true : {} }; });
  ctx[x.user] = { email: 'anita@example.com' };
  ctx[x.ls] = { get: (k, d) => { const v = ctx.localStorage.getItem(k); try { return v == null ? d : JSON.parse(v); } catch (_) { return d; } } };
  ctx[x.jd[1]] = { current: '' };
  ctx[x.jd[2]] = '';
  ctx[x.meta] = {};
  ctx[x.stub] = '__unsolicited_stub__';
  ctx[x.rationale] = null;
  ctx[x.sections] = { cv: [], cl: [] };
  vm.createContext(ctx);
  vm.runInContext('var ' + x.body + ';', ctx);
  const upsert = ctx[x.name];
  // Run the pending debounce timer (async callback) and let its awaits settle.
  async function settle() {
    const fns = [...timers.values()];
    timers.clear();
    for (const fn of fns) await fn();
    await new Promise((r) => setImmediate(r));
  }
  return { upsert, settle, posts, relay, store, win };
}

const JD = 'Senior Optical Engineer at PEAK Wind. Own lidar receiver design from requirements to production.';
const META = { company: 'PEAK Wind', role: 'Optical Engineer' };
const DOC = () => ({ cv: [{ id: 'profile', items: [{ t: 'Optical systems engineer.' }] }], cl: [{ id: 'opening', content: 'I am applying to PEAK Wind.' }] });

test('THE BUG: the same content every 2.4 s POSTs once, not every time', async () => {
  const s = load();
  for (let i = 0; i < 5; i++) {
    s.upsert({ jd_text: JD, meta: META, sections: DOC() });   // a new `ro` identity, same content
    await s.settle();
  }
  assert.equal(s.posts.length, 1, `one POST, got ${s.posts.length}`);
  assert.equal(s.win._antcvAppPostSkips, 4);
});

test('a real content change still POSTs', async () => {
  const s = load();
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  const d = DOC();
  d.cv[0].items[0].t = 'Optical systems engineer, lidar receivers.';
  s.upsert({ jd_text: JD, meta: META, sections: d });
  await s.settle();
  assert.equal(s.posts.length, 2);
  assert.match(s.posts[1].body, /lidar receivers/);
});

test('a non-OK POST clears the signature, so the same content is sent again', async () => {
  const s = load();
  s.relay.status = 500;
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  s.relay.status = 200;
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  assert.equal(s.posts.length, 2, 'the retry went out');
  assert.equal(s.win._antcvAppLastWrite.status, 200);
});

test('a network error clears the signature too', async () => {
  const s = load();
  s.relay.fail = true;
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  assert.equal(s.win._antcvAppLastError.status, 0);
  s.relay.fail = false;
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  assert.equal(s.posts.length, 1, 'the retry went out');
});

test('switching A -> B -> A posts each switch (only an immediate repeat is skipped)', async () => {
  const s = load();
  const B = { company: 'Hamamatsu Photonics', role: 'NPI Engineer' };
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  s.upsert({ jd_text: 'NPI Engineer at Hamamatsu.', meta: B, sections: DOC() });
  await s.settle();
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  assert.equal(s.posts.length, 3);
});

test('a different relay is a different target', async () => {
  const s = load();
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  s.store.set('proxyUrl', JSON.stringify('https://relay-2.test'));
  s.upsert({ jd_text: JD, meta: META, sections: DOC() });
  await s.settle();
  assert.equal(s.posts.length, 2);
  assert.match(s.posts[1].url, /relay-2/);
});

test('app.src.js mirrors the guard and the status count', () => {
  assert.match(SRC, /const __ps = JSON\.stringify\(\[t, a\]\);\s*if \(__ps === window\.__antcvAppPostSig\)/);
  assert.equal((SRC.match(/window\.__antcvAppPostSig = null;/g) || []).length, 2, 'both failure paths clear it');
  assert.match(SRC, /post_skips: window\._antcvAppPostSkips \|\| 0/);
  assert.match(APP, /post_skips:window\._antcvAppPostSkips\|\|0/);
  assert.equal((APP.match(/window\.__antcvAppPostSig=null;/g) || []).length, 2);
});
