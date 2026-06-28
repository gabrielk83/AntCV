/* NORDIC-FOUNDATION-DEFAULT-001 — for Nordic Minimal, FOUNDATION defaults to headline hidden +
 * Hands-on/Professionally as bullets (an existing "Foundation" opening row stays a paragraph).
 * Loads the REAL antcv-foundation-to-rich-block-758.js in a shimmed global and drives run(). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-foundation-to-rich-block-758.js'), 'utf8');

function load(toneRegister, sections, name) {
  const store = new Map();
  if (toneRegister !== undefined) store.set('toneRegister', JSON.stringify(toneRegister));
  if (name !== undefined) store.set('personalInfo', JSON.stringify({ name }));
  store.set('sections', JSON.stringify(sections));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  const CustomEventShim = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'setTimeout', 'CustomEvent', SRC)(win, localStorage, () => 0, CustomEventShim);
  win.AntcvFoundationToRichBlock.run();
  const get = () => JSON.parse(store.get('sections')).cl.find((s) => s && s.id === 'foundation');
  return { sec: get(), rerun: () => { win.AntcvFoundationToRichBlock.run(); return get(); } };
}
const findRow = (sec, b) => sec.items.find((r) => r && r.b === b);

const legacyFoundation = (cl) => ({ cv: [], cl: [Object.assign({
  id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'foundation',
  hands_on: 'across the full hardware path.', professionally: 'that grounding lets me…',
}, cl)] });
const richFoundation = (extra = {}) => ({ cv: [], cl: [Object.assign({
  id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'rich_block',
  items: [
    { b: 'Foundation', t: 'I connect hardware engineering, product scope and production readiness.' },
    { b: 'Hands-on', t: 'across the full hardware path.' },
    { b: 'Professionally', t: 'that grounding lets me…' },
  ],
}, extra)] });

test('nordic + legacy foundation: converts, headline hidden, Hands-on/Professionally bulleted', () => {
  const { sec } = load('nordic-minimal', legacyFoundation());
  assert.equal(sec.type, 'rich_block');
  assert.equal(sec.headlineOff, true);
  assert.equal(findRow(sec, 'Hands-on').mk, true);
  assert.equal(findRow(sec, 'Professionally').mk, true);
});

test("nordic + 3-row rich_block: headline hidden, Foundation opening stays a paragraph, others bulleted", () => {
  const { sec } = load('nordic-minimal', richFoundation());
  assert.equal(sec.headlineOff, true);
  assert.equal(findRow(sec, 'Foundation').mk, undefined, 'opening stays paragraph');
  assert.equal(findRow(sec, 'Hands-on').mk, true);
  assert.equal(findRow(sec, 'Professionally').mk, true);
});

test('non-nordic: foundation converts but headline shown + no bullets', () => {
  const { sec } = load('achievement-driven', legacyFoundation());
  assert.equal(sec.type, 'rich_block');
  assert.equal(sec.headlineOff, undefined);
  assert.equal(findRow(sec, 'Hands-on').mk, undefined);
});

test('nordic idempotent: a 2nd run makes no further change', () => {
  const h = load('nordic-minimal', richFoundation());
  const after1 = JSON.stringify(h.sec);
  const after2 = JSON.stringify(h.rerun());
  assert.equal(after1, after2);
});

test('nordic + user re-showed headline (headlineOff:false): respected', () => {
  const { sec } = load('nordic-minimal', richFoundation({ headlineOff: false }));
  assert.equal(sec.headlineOff, false);
});

test('no toneRegister: not forced', () => {
  const { sec } = load(undefined, richFoundation());
  assert.equal(sec.headlineOff, undefined);
  assert.equal(findRow(sec, 'Hands-on').mk, undefined);
});

test('GABRIEL-FOUNDATION-OPENING: nordic + Gabriel + no opening -> "Foundation" opener prepended', () => {
  const { sec } = load('nordic-minimal', legacyFoundation(), 'Gabriel Alexander Karp-Gershon');
  assert.equal(sec.items[0].b, 'Foundation', 'first row is the Foundation opener');
  assert.ok(/I connect hardware engineering/.test(sec.items[0].t), 'opener carries the sentence');
  assert.equal(sec.items[0].mk, undefined, 'opener is a paragraph (no bullet)');
  assert.equal(findRow(sec, 'Hands-on').mk, true);
});

test('opening injection is name-guarded: non-Gabriel gets no opener', () => {
  const { sec } = load('nordic-minimal', legacyFoundation(), 'Jane Doe');
  assert.notEqual(sec.items[0].b, 'Foundation');
});

test('opening injection idempotent: a 2nd run does not double-add', () => {
  const h = load('nordic-minimal', legacyFoundation(), 'Gabriel Karp');
  const after2 = h.rerun();
  const openers = after2.items.filter((r) => r && r.b === 'Foundation').length;
  assert.equal(openers, 1, 'exactly one Foundation opener');
});
