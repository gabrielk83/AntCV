// slogan-paper-contrast.test.mjs
// ============================================================
// SLOGAN-PAPER-CONTRAST-001 (1.51.4526): the CL slogan sits on the WHITE paper,
// not on the header band. SPEC-CONTRAST-GUARD-001 guarded it against headerBg and
// fell back to headerInk — WHITE on every dark-band brand — so the slogan was
// painted white on white ("slogan is in a hidden colour"). Both the preview
// engine (antcv-header-elem-colors.js) and the export mirror
// (antcv-export-header-colors.js) now guard the slogan against white with the
// chain sloganColor -> accent -> headerBg -> near-black. These tests load the two
// real sidecars in a vm and pin the mapping; name/spec stay band-guarded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const elemSrc = await readFile(new URL('../../antcv-header-elem-colors.js', import.meta.url), 'utf8');
const exportSrc = await readFile(new URL('../../antcv-export-header-colors.js', import.meta.url), 'utf8');

function load(src, store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, fetch() { return Promise.resolve(); } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
    console: { debug() {}, warn() {}, log() {} },
    JSON, Object, Array, String, Number, Math, parseInt, RegExp,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
}
const brandStore = (slots, extra) => ({ meta: JSON.stringify({ brandV2: { version: 2, slots } }), ...(extra || {}) });
const preview = (slots, extra) => load(elemSrc, brandStore(slots, extra)).AntcvHeaderColors._colorFor;
const exp = (slots, extra) => load(exportSrc, brandStore(slots, extra)).AntcvExportHeaderColors._colorFor;

// A typical dark-band brand: navy band, white ink, orange accent, deep-blue slogan.
const DARK_BAND = { headerBg: '#0B1F3A', headerInk: '#FFFFFF', accent: '#E8732A', sloganColor: '#1B3A6B' };

test('dark-band brand: the deep slogan colour is kept on the paper (was white = hidden)', () => {
  const p = preview(DARK_BAND);
  assert.equal(p('slogan'), '#1B3A6B');
  assert.notEqual(p('slogan').toLowerCase(), '#ffffff', 'regression: slogan must never resolve to the band ink on paper');
  // name/contact are ON the band and keep the band guard: white on navy.
  assert.equal(p('name'), '#FFFFFF');
  assert.equal(p('contact'), '#FFFFFF');
  assert.equal(p('application'), '#595959');
});

test('export mirror agrees with the preview (6-hex, no #)', () => {
  const e = exp(DARK_BAND);
  assert.equal(e('slogan'), '1B3A6B');
  assert.equal(e('name'), 'FFFFFF');
});

test('a slogan colour too light for white paper falls back to the accent, then to the band colour', () => {
  // light slogan, readable accent -> accent
  const p1 = preview({ ...DARK_BAND, sloganColor: '#F5D000' });
  assert.equal(p1('slogan'), '#E8732A');
  // light slogan AND light accent -> the (dark) band colour, still brand-derived
  const p2 = preview({ ...DARK_BAND, sloganColor: '#F5D000', accent: '#9AD0F5' });
  assert.equal(p2('slogan'), '#0B1F3A');
  assert.equal(exp({ ...DARK_BAND, sloganColor: '#F5D000', accent: '#9AD0F5' })('slogan'), '0B1F3A');
});

test('everything light (pale brand) -> near-black, never an unreadable tint', () => {
  const p = preview({ headerBg: '#F2F2F2', headerInk: '#1A1A1A', accent: '#FFE680', sloganColor: '#FFF3B0' });
  assert.equal(p('slogan'), '#1a1a1a');
  assert.equal(exp({ headerBg: '#F2F2F2', headerInk: '#1A1A1A', accent: '#FFE680', sloganColor: '#FFF3B0' })('slogan'), '1A1A1A');
});

test('no sloganColor falls through to the accent; no accent either -> no paint (unchanged behaviour)', () => {
  assert.equal(preview({ headerBg: '#0B1F3A', headerInk: '#FFFFFF', accent: '#B5451B' })('slogan'), '#B5451B');
  assert.equal(preview({ headerBg: '#0B1F3A', headerInk: '#FFFFFF' })('slogan'), '');
  assert.equal(exp({ headerBg: '#0B1F3A', headerInk: '#FFFFFF' })('slogan'), '');
});

test('a manual per-element override still wins, unguarded (explicit user choice)', () => {
  const ov = { 'antcv:headerElemColors': JSON.stringify({ slogan: '#ffffff' }) };
  assert.equal(preview(DARK_BAND, ov)('slogan'), '#ffffff');
  assert.equal(exp(DARK_BAND, ov)('slogan'), 'FFFFFF');
});

test('flat (non-slots) brand objects and the antcv:brandV2 global fallback resolve the same way', () => {
  const flat = load(elemSrc, { meta: JSON.stringify({ brandV2: DARK_BAND }) }).AntcvHeaderColors._colorFor;
  assert.equal(flat('slogan'), '#1B3A6B');
  const global = load(elemSrc, { 'antcv:brandV2': JSON.stringify({ version: 2, slots: DARK_BAND }) }).AntcvHeaderColors._colorFor;
  assert.equal(global('slogan'), '#1B3A6B');
});

test('no brand at all -> nothing painted for the slogan', () => {
  assert.equal(load(elemSrc, {}).AntcvHeaderColors._colorFor('slogan'), '');
});
