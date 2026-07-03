// brandfit-sample.test.mjs
// ============================================================
// BRAND-FIT-PALETTE-001 (spec rule 37, 1.51.123): deterministic JD-hex
// sampling as the fallback when the model omits brand_fit. The sampler shapes
// its result like a gen brand_fit object and the EXISTING validated apply path
// (hex check, dark-enough gate, custom package flip) consumes it — both
// bundles carry the fallback splice (mirror-locked below).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-brandfit-sample.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: {},
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { log() {}, warn() {} },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, parseInt,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvBrandFitSample, fn: sandbox.window.__antcvBrandFitSample, store };
}

const NIL_JD = 'NIL Technology is hiring. Brand guide: logo blue #0373c6 on dark navy #00355a backgrounds, page chrome #f7f7f7. Nanooptics prototyping role with cleanroom work and optical metrology responsibilities.';

test('NIL case: darkest sampled hex becomes navy, the logo blue becomes the accent, chrome filtered', () => {
  const { fn } = load({ 'antcv:lastJdText': NIL_JD });
  const bf = fn();
  assert.equal(bf.navy, '#00355a', 'darkest JD colour, already dark enough for white text');
  assert.equal(bf.accent, '#0373c6', 'logo blue as the accent');
  assert.match(bf.source, /Sampled deterministically/, 'source names the deterministic origin');
  assert.doesNotMatch(bf.source, /f7f7f7/, 'near-white chrome colour was never a candidate');
});

test('a too-light darkest colour is darkened below the white-text gate', () => {
  const { api, fn } = load({ 'antcv:lastJdText': 'Brand: sunny amber #ffc107 across the site. Role description long enough here.' });
  const bf = fn();
  assert.ok(api._lum(bf.navy) < 0.62, 'darkened to pass the apply gate: ' + bf.navy);
  assert.equal(bf.accent, '#ffc107', 'the original brand colour survives as the accent');
});

test('no hex codes / no JD / kill switch: null (the apply block no-ops as before)', () => {
  assert.equal(load({ 'antcv:lastJdText': 'A JD without any colour codes but plenty of text to pass the length gate.' }).fn(), null);
  assert.equal(load({}).fn(), null);
  assert.equal(load({ 'antcv:lastJdText': NIL_JD, 'antcv:disable-brandfit-sample': '1' }).fn(), null);
});

test('BOTH bundles carry the fallback splice next to the brand_fit apply gate (mirror lock)', async () => {
  const appSrc = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
  const appMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  // one fallback site per bundle = 2 token occurrences (typeof check + call)
  assert.equal(appSrc.split('window.__antcvBrandFitSample').length - 1, 2, 'app.src.js: exactly one fallback site');
  assert.equal(appMin.split('window.__antcvBrandFitSample').length - 1, 2, 'app.js: exactly one fallback site');
  assert.ok(appSrc.includes('(T && T.brand_fit) || ("function" == typeof window.__antcvBrandFitSample'), 'src: gen brand_fit wins, sampler is the fallback');
  assert.ok(appMin.includes('(z&&z.brand_fit)||("function"==typeof window.__antcvBrandFitSample'), 'min: same semantics');
});
