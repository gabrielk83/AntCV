/* NORDIC-HWIC-HEADLINE-OFF-001 — for the Nordic Minimal style the HWIC (contribute)
 * section defaults to headline HIDDEN. Loads the REAL antcv-hwic-to-rich-block-760.js
 * sidecar in a shimmed global and drives run(): nordic -> headlineOff:true; other styles
 * untouched; a user-set headlineOff:false (re-shown) respected; text_bullets converts and
 * gets the nordic default. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-hwic-to-rich-block-760.js'), 'utf8');

function load(toneRegister, sections) {
  const store = new Map();
  if (toneRegister !== undefined) store.set('toneRegister', JSON.stringify(toneRegister));
  store.set('sections', JSON.stringify(sections));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  const CustomEventShim = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  // run scheduled setTimeouts as no-ops here; we call run() explicitly.
  const noTimeout = () => 0;
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'setTimeout', 'CustomEvent', SRC)(win, localStorage, noTimeout, CustomEventShim);
  win.AntcvHwicToRichBlock.run();
  const out = JSON.parse(store.get('sections'));
  return (out.cl || []).find((s) => s && s.id === 'contribute');
}

const richContribute = (extra = {}) => ({ cl: [Object.assign({
  id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'rich_block',
  items: [{ b: '', t: 'My immediate priority…' }, { b: '', t: 'Map the flow', mk: true }, { b: '', t: 'The team gains…' }],
}, extra)], cv: [] });

test('nordic-minimal: HWIC headline defaulted hidden', () => {
  const c = load('nordic-minimal', richContribute());
  assert.equal(c.headlineOff, true);
  assert.ok(c.items.every((r) => r.b !== undefined), 'lead-in fields preserved');
  assert.ok(c.items.some((r) => r.mk), 'bullet markers preserved');
});

test('non-nordic (achievement-driven): HWIC headline left shown', () => {
  const c = load('achievement-driven', richContribute());
  assert.equal(c.headlineOff, undefined, 'not forced for other styles');
});

test('nordic + user re-showed (headlineOff:false): respected, not re-hidden', () => {
  const c = load('nordic-minimal', richContribute({ headlineOff: false }));
  assert.equal(c.headlineOff, false);
});

test('nordic + already headlineOff:true: idempotent', () => {
  const c = load('nordic-minimal', richContribute({ headlineOff: true }));
  assert.equal(c.headlineOff, true);
});

test('nordic + text_bullets: converts to rich_block AND defaults headline hidden', () => {
  const c = load('nordic-minimal', { cl: [{
    id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
    intro: 'Intro framing.', items: ['Do X', 'Do Y'], closing: 'Closing value.',
  }], cv: [] });
  assert.equal(c.type, 'rich_block');
  assert.equal(c.headlineOff, true);
  assert.ok(c.items.length >= 2);
});

test('no toneRegister set: not forced (read-failure safe default)', () => {
  const c = load(undefined, richContribute());
  assert.equal(c.headlineOff, undefined);
});
