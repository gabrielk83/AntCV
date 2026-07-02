// bring-to-rich-block-empty-seed.test.mjs
// ============================================================
// BRING-EMPTY-SEED-001 (owner 2026-07-02): a CL "WHAT I BRING" table with ZERO usable data
// rows (the LLM returned empty bring_rows, or only the header row survived) previously stayed
// an untouched empty 2-column table -> INVISIBLE in the rendered document (no heading at all,
// the owner's "no WHAT I BRING section" report). Fix: convert it anyway to a rich_block
// carrying ONLY the lead-in item, so the section is visible and nordic-cl-order-971's
// seedInstructions can fill the placeholder wording. Real content (non-empty rows) is untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-bring-to-rich-block-761.js', import.meta.url), 'utf8');

function load(secs, toneRegister = 'nordic-minimal') {
  const seed = { sections: JSON.stringify(secs) };
  if (toneRegister != null) seed.toneRegister = JSON.stringify(toneRegister);
  const store = new Map(Object.entries(seed));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvBringToRichBlock, store };
}

const bring = (rows, extra) => Object.assign({ id: 'bring', title: 'What I bring', loc: 'main', on: true, type: 'table', rows }, extra);

test('convert(): empty rows -> rich_block with 1 lead-in item, headline hidden', () => {
  const { api, store } = load({ cl: [bring([])] });
  api.run();
  const out = JSON.parse(store.get('sections')).cl[0];
  assert.equal(out.type, 'rich_block');
  assert.equal(out.items.length, 1);
  assert.equal(out.headlineOff, true);
});

test('convert(): header-only row (no data) also seeds the lead-in shell', () => {
  const { api, store } = load({ cl: [bring([['Focus Area', 'Strategic Expertise']])] });
  api.run();
  const out = JSON.parse(store.get('sections')).cl[0];
  assert.equal(out.type, 'rich_block');
  assert.equal(out.items.length, 1);
});

test('convert(): real data rows still convert normally (existing behaviour preserved)', () => {
  const { api, store } = load({ cl: [bring([['Focus Area', 'Strategic Expertise'], ['Sourcing & Feasibility', 'RFQ/RFI, supplier scoring']])] });
  api.run();
  const out = JSON.parse(store.get('sections')).cl[0];
  assert.equal(out.type, 'rich_block');
  assert.equal(out.items.length, 2);
  assert.equal(out.items[1].b, 'Sourcing & Feasibility');
});

// TONE-DEFAULT-SCANDINAVIAN-001 (owner 2026-07-03): an ABSENT toneRegister now
// takes the nordic default (the converters used to no-op in fresh/demo sessions
// while the CL skeleton is nordic-shaped for everyone). An EXPLICIT non-nordic
// register still leaves the table untouched.
test('convert(): ABSENT toneRegister converts (nordic default); explicit non-nordic does not', () => {
  const a = load({ cl: [bring([])] }, null);   // no toneRegister -> nordic DEFAULT
  a.api.run();
  assert.equal(JSON.parse(a.store.get('sections')).cl[0].type, 'rich_block');
  const b = load({ cl: [bring([])] }, 'formal');   // explicit non-nordic
  b.api.run();
  const out = b.store.has('sections') ? JSON.parse(b.store.get('sections')).cl[0] : bring([]);
  assert.equal(out.type, 'table');   // unchanged
});

test('convert(): already rich_block is left alone (one-way, idempotent)', () => {
  const already = { id: 'bring', title: 'What I bring', loc: 'main', on: true, type: 'rich_block', items: [{ b: 'What I bring', t: '' }], headlineOff: true };
  const { api, store } = load({ cl: [already] });
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);   // run() returned early -- never re-wrote localStorage
});
