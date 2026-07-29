// cl-skeleton-seed-storm.test.mjs
// ============================================================
// CL-SKELETON-SEED-STORM-001 (owner 2026-07-22, live-measured ~4 sections-writes/s on the
// empty CL skeleton). nordic-cl-order-971 seedInstructions wrote the bracketed authoring
// instruction into an empty bring lead-in / foundation Hands-on+Professionally, but two
// anti-placeholder sidecars strip a bracketed [..] body straight back to empty. needsSeed('')
// was then true again, so the seed was rewritten every tick, forever — a dueling-sidecar
// storm. Fix (decide-once, substructure-keyed): seed each row at most once per load; if a
// stripper removes it afterwards, do NOT re-seed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-nordic-cl-order-971.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map();
  store.set('sections', JSON.stringify(sections));
  let writes = 0;
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { if (k === 'sections') writes++; store.set(k, String(v)); },
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {}, info() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, parseInt, isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const api = sandbox.window.AntcvNordicClOrder;
  return {
    api,
    writes: () => writes,
    cl: () => JSON.parse(store.get('sections')).cl,
    // the two anti-placeholder sidecars: strip any fully-bracketed body back to empty
    strip() {
      const b = JSON.parse(store.get('sections'));
      b.cl.forEach((s) => (s.items || []).forEach((it) => {
        if (it && typeof it.t === 'string' && /^\s*\[[\s\S]*\]\s*$/.test(it.t)) it.t = '';
      }));
      store.set('sections', JSON.stringify(b));
    },
  };
}

const SKELETON = () => ({
  cl: [
    { id: 'greeting', type: 'text', on: true, content: 'Dear Hiring Manager,' },
    { id: 'why', type: 'rich_block', on: true, items: [{ b: 'Why this position', t: '' }] },
    { id: 'bring', type: 'rich_block', on: true, headlineOff: true, items: [
      { b: 'What I bring', t: '' },
      { b: '[label]', t: '[EVIDENCE ...]', mk: true },
    ] },
    { id: 'contribute', type: 'rich_block', on: true, items: [
      { b: 'How I would contribute', t: '' }, { b: '', t: '[x]', mk: true }, { b: '', t: '[y]' },
    ] },
    { id: 'foundation', type: 'rich_block', on: true, items: [
      { b: 'Foundation', t: '' },
      { b: 'Hands-on', t: '', mk: true },
      { b: 'Professionally', t: '', mk: true },
    ] },
  ],
});

function foundationRow(cl, label) {
  const f = cl.find((s) => s.id === 'foundation');
  return (f.items.find((r) => r.b === label) || {}).t || '';
}
function bringLead(cl) {
  const br = cl.find((s) => s.id === 'bring');
  return (br.items[0] || {}).t || '';
}

test('first pass seeds the bracketed instructions into empty rows', () => {
  const H = load(SKELETON());
  H.api.run();
  const cl = H.cl();
  assert.ok(/^\[/.test(bringLead(cl)), 'bring lead-in seeded with an instruction');
  assert.ok(/^\[/.test(foundationRow(cl, 'Hands-on')), 'Hands-on seeded');
  assert.ok(/^\[/.test(foundationRow(cl, 'Professionally')), 'Professionally seeded');
});

test('REGRESSION: after a stripper empties the seed, nordic does NOT re-seed (storm dies)', () => {
  const H = load(SKELETON());
  // simulate the live duel: seed -> strip -> seed -> strip ... many rounds
  let writesAtStripLoop = 0;
  for (let round = 0; round < 20; round++) {
    H.api.run();
    if (round === 0) writesAtStripLoop = H.writes();
    H.strip();
  }
  // after the very first seed+strip, nordic must never seed again -> the only writes are
  // the first seed. (The stripper writes are simulated outside the counter.)
  const cl = H.cl();
  assert.equal(bringLead(cl), '', 'bring lead-in stays empty (not re-seeded)');
  assert.equal(foundationRow(cl, 'Hands-on'), '', 'Hands-on stays empty');
  assert.equal(foundationRow(cl, 'Professionally'), '', 'Professionally stays empty');
  // nordic wrote for the FIRST seed (+ maybe order/migrate), then converged: bounded, not ~per-round
  assert.ok(H.writes() <= writesAtStripLoop + 1, `nordic writes stay bounded (got ${H.writes()}), no re-seed storm`);
});

test('a real (non-bracket) lead-in the user typed is never touched', () => {
  const s = SKELETON();
  s.cl.find((x) => x.id === 'bring').items[0].t = 'What I bring to this role:';
  const H = load(s);
  H.api.run();
  assert.equal(bringLead(H.cl()), 'What I bring to this role:', 'real lead-in preserved');
});

test('mirror-lock: the decide-once guard is present', () => {
  assert.ok(src.includes('CL-SKELETON-SEED-STORM-001'), 'documented');
  assert.ok(src.includes('__seededRows'), 'decide-once state present');
});
