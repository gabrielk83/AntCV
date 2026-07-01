// orphan-measure-bind.test.mjs
// ============================================================
// ORPHAN-MEASURE-BIND-001: deterministic helpers of the L1+L2 orphan sidecar.
// The DOM measurement (Range.getClientRects / clone) needs a real browser and is
// verified on a live export; here we test the pure binding + write-back logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-orphan-measure-bind.js', import.meta.url), 'utf8');
const NBSP = String.fromCharCode(160);

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const doc = { querySelectorAll() { return []; }, querySelector() { return null; }, createRange() { return { selectNodeContents() {}, getClientRects() { return []; } }; } };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: doc,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, clearTimeout() {},
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, parseInt, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvOrphanBind, store, sandboxWindow: sandbox.window, doc };
}

test('_bindLast binds the last N single-space gaps with NBSP', () => {
  const { api } = load();
  assert.equal(api._bindLast('one two three four', 1), 'one two three' + NBSP + 'four');
  assert.equal(api._bindLast('one two three four', 2), 'one two' + NBSP + 'three' + NBSP + 'four');
  assert.equal(api._bindLast('single', 2), 'single');       // no gaps to bind
});

test('_bindLast preserves trailing whitespace', () => {
  const { api } = load();
  assert.equal(api._spaceCount('a b c'), 2);
  assert.equal(api._bindLast('a b c ', 5), 'a' + NBSP + 'b' + NBSP + 'c ');
});

test('_isRunt: a last line far shorter than the widest is a runt', () => {
  const { api } = load();
  assert.equal(api._isRunt([480, 480, 60]), true);
  assert.equal(api._isRunt([480, 480, 300]), false);
  assert.equal(api._isRunt([480]), false);                  // single line, no orphan
  assert.equal(api._isRunt([]), false);
});

test('_alreadyBound detects an existing NBSP (idempotency guard)', () => {
  const { api } = load();
  assert.equal(api._alreadyBound('a' + NBSP + 'b'), true);
  assert.equal(api._alreadyBound('a b c'), false);
});

test('_bindBulletInSections binds a stored bullet by path and persists', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['first bullet', 'owned the whole governance loop end to end'] }] }], cl: [] };
  const { api, store } = load({ sections: JSON.stringify(sections) });
  const ok = api._bindBulletInSections('experience', ['roles', '0', 'bullets', '1'], 2);
  assert.equal(ok, true);
  const bul = JSON.parse(store.get('sections')).cv[0].roles[0].bullets[1];
  assert.ok(bul.indexOf(NBSP) !== -1);
  assert.ok(bul.endsWith('to' + NBSP + 'end'), bul);
});

test('_bindBulletInSections is idempotent when already bound', () => {
  const sections = { cv: [{ id: 'experience', roles: [{ bullets: ['loop end to' + NBSP + 'end'] }] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '0', 'bullets', '0'], 2), false);
});

test('_bindBulletInSections returns false for a missing path', () => {
  const sections = { cv: [{ id: 'experience', roles: [] }], cl: [] };
  const { api } = load({ sections: JSON.stringify(sections) });
  assert.equal(api._bindBulletInSections('experience', ['roles', '5', 'bullets', '0'], 2), false);
});

test('_bindResultsOverride writes the bound text into the override map', () => {
  const { api, store } = load({});
  assert.equal(api._bindResultsOverride('r|Eng|Acme|0', 'shipped the thing on time', 2), true);
  const map = JSON.parse(store.get('antcv:resultsOverride'));
  assert.ok(map['r|Eng|Acme|0'].endsWith('on' + NBSP + 'time'), map['r|Eng|Acme|0']);
});

// ── L3: re-tighten unfixable residue with a DIRECT LLM call ──────────────────────
// The old L3 clicked a DOM button that was not reliably present (live diagnosis:
// antcv:orphanL3Attempted stayed null — L3 never fired). L3 now calls the LLM directly
// via the proxy and writes the shortened line back, behind a strict fact-preserving
// safety gate. These test the pure gate + write-back + the async escalate path.
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('_safeShorten accepts a genuine, fact-preserving shortening', () => {
  const { api } = load();
  assert.equal(api._safeShorten(
    'Implemented image-quality and autofocus optimization using MATLAB, Imatest, and Qualcomm tools.',
    'Optimized image quality and autofocus with MATLAB, Imatest, Qualcomm tools.'), true);
});

test('_safeShorten rejects a rewrite that is longer, empty, or too short', () => {
  const { api } = load();
  const o = 'Direct a 7-person EO and optics team at Sigma-Connectivity ODM for smartphones.';
  assert.equal(api._safeShorten(o, o + ' extra words added here'), false);   // longer
  assert.equal(api._safeShorten(o, ''), false);                               // empty
  assert.equal(api._safeShorten(o, 'EO team.'), false);                       // < 45% of original
});

test('_safeShorten rejects a rewrite that drops a number or an acronym', () => {
  const { api } = load();
  assert.equal(api._safeShorten('co-invented the stray-light window (Patent No. 241997), now shipping.',
    'co-invented the stray-light window, now shipping in devices worldwide today.'), false);   // dropped 241997
  assert.equal(api._safeShorten('Direct a 7-person EO team at Sigma-Connectivity ODM for phones.',
    'Direct a 7-person optics team at Sigma-Connectivity for phones today.'), false);           // dropped EO + ODM
});

test('_l3WriteBullet replaces the stored bullet at its path', () => {
  const { api } = load();
  const secs = { cv: [{ id: 'experience', roles: [{ bullets: ['first', 'a long orphaning bullet here'] }] }] };
  assert.equal(api._l3WriteBullet(secs, 'experience', ['roles', '0', 'bullets', '1'], 'tighter bullet'), true);
  assert.equal(secs.cv[0].roles[0].bullets[1], 'tighter bullet');
});

test('_proxyBase reads proxyUrl (JSON-quoted or bare) and strips trailing slash', () => {
  const { api: a1 } = load({ proxyUrl: '"https://p.example.com/"' });
  assert.equal(a1._proxyBase(), 'https://p.example.com');
  const { api: a2 } = load({ relayUrl: 'https://relay.example.com' });
  assert.equal(a2._proxyBase(), 'https://relay.example.com');
});

function stubFetch(win, shortArr) {
  const calls = [];
  win.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return { json: async () => ({ content: [{ text: JSON.stringify(shortArr) }], model: 'claude-sonnet-5' }) };
  };
  return calls;
}
const R = (text, extra) => Object.assign({ key: 'bullet|roles.0.bullets.1', sig: 1, kind: 'bullet', sid: 'experience', pathParts: ['roles', '0', 'bullets', '1'], text }, extra);

test('_maybeEscalateToL3 kill-switch + missing-proxy block the LLM call', async () => {
  const off = load({ 'antcv:disable-orphan-l3': '1', proxyUrl: 'https://p' });
  const c1 = stubFetch(off.sandboxWindow, ['x']);
  off.api._maybeEscalateToL3([R('a long orphaning bullet with words')]);
  await flush();
  assert.equal(c1.length, 0);   // kill-switch

  const noProxy = load({});     // no proxyUrl/relayUrl
  const c2 = stubFetch(noProxy.sandboxWindow, ['x']);
  noProxy.api._maybeEscalateToL3([R('a long orphaning bullet with words')]);
  await flush();
  assert.equal(c2.length, 0);   // no endpoint
});

test('_maybeEscalateToL3 calls the LLM and writes the shortened bullet back', async () => {
  const secs = { cv: [{ id: 'experience', roles: [{ bullets: ['first', 'Implemented image-quality and autofocus optimization using MATLAB, Imatest, and Qualcomm tools.'] }] }] };
  const l = load({ proxyUrl: 'https://p.example.com', sections: JSON.stringify(secs) });
  const calls = stubFetch(l.sandboxWindow, ['Optimized image quality and autofocus with MATLAB, Imatest, Qualcomm tools.']);
  l.api._maybeEscalateToL3([R('Implemented image-quality and autofocus optimization using MATLAB, Imatest, and Qualcomm tools.')]);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, 'claude-sonnet-5');
  const out = JSON.parse(l.store.get('sections')).cv[0].roles[0].bullets[1];
  assert.equal(out, 'Optimized image quality and autofocus with MATLAB, Imatest, Qualcomm tools.');
});

test('_maybeEscalateToL3 does NOT write a rewrite that fails the safety gate', async () => {
  const secs = { cv: [{ id: 'experience', roles: [{ bullets: ['first', 'Direct a 7-person EO team at Sigma-Connectivity ODM for high-security smartphones.'] }] }] };
  const l = load({ proxyUrl: 'https://p', sections: JSON.stringify(secs) });
  stubFetch(l.sandboxWindow, ['Direct a big optics team for high-security phones worldwide.']);   // dropped EO + ODM + 7
  l.api._maybeEscalateToL3([R('Direct a 7-person EO team at Sigma-Connectivity ODM for high-security smartphones.')]);
  await flush();
  const out = JSON.parse(l.store.get('sections')).cv[0].roles[0].bullets[1];
  assert.equal(out, 'Direct a 7-person EO team at Sigma-Connectivity ODM for high-security smartphones.');   // unchanged
});

test('_maybeEscalateToL3 dedups the same line (sig) and caps at 2 rewrites', async () => {
  const l = load({ proxyUrl: 'https://p', sections: JSON.stringify({ cv: [{ id: 'experience', roles: [{ bullets: ['x', 'orphan line one two three four'] }] }] }) });
  const calls = stubFetch(l.sandboxWindow, ['shorter one two three']);
  l.api._maybeEscalateToL3([R('orphan line one two three four', { sig: 7 })]);
  await flush();
  assert.equal(calls.length, 1);
  l.sandboxWindow.__antcvOrphanL3LastFire = 0;   // bypass cooldown
  l.api._maybeEscalateToL3([R('orphan line one two three four', { sig: 7 })]);   // same sig
  await flush();
  assert.equal(calls.length, 1);   // deduped, no second call
});
