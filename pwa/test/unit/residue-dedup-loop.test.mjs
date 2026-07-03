// residue-dedup-loop.test.mjs
// ============================================================
// RESIDUE-DEDUP-LOOP-001 (owner 2026-07-03 "regulatory context is very jumpy",
// caught LIVE with a writer probe: 43 sections writes in ~18s, alternating
// tools-corecomp-dedup <-> tools-hidden-residue events; every write re-rendered
// the sidebar and the section below tools — REGULATORY — jumped). Cycle: a
// "Hidden - <category>" review row carries the category label, the dedup
// matched it against the SAME core-comp Focus-Area label and dropped it; the
// residue reconciler re-created it next tick, forever. Lock: dedup skips
// residue rows; the two sidecars reach a FIXED POINT within one round.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const dedupSrc = await readFile(new URL('../../antcv-tools-corecomp-dedup.js', import.meta.url), 'utf8');
const residueSrc = await readFile(new URL('../../antcv-tools-hidden-residue.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  let writes = 0;
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { if (k === 'sections') writes++; store.set(k, String(v)); },
      removeItem: (k) => store.delete(k),
    },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {}, info() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, Date, parseInt, isNaN,
  };
  vm.createContext(sandbox);
  vm.runInContext(dedupSrc, sandbox);
  vm.runInContext(residueSrc, sandbox);
  return {
    dedup: sandbox.window.AntcvToolsCoreCompDedup,
    residue: sandbox.window.AntcvToolsHiddenResidue,
    store,
    writesCount: () => writes,
  };
}

// The live Trackman shape: core_comp Focus Area matches a tools category whose
// kernel tokens were trimmed -> a residue row with the SAME category label.
const FIXTURE = () => ({
  sections: JSON.stringify({
    cv: [
      { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [
        ['Focus Area', 'Strategic Expertise'],
        ['Optics, photonics & sensing', 'Electro-optics platforms'],
        ['Validation', 'DV/PV, FAT/SAT'],
      ] },
      { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block', items: [
        { grp: true, t: 'Tools', bullets: [] },
        { b: 'Software', t: 'Jira, Git', bullets: [] },
        { b: 'Hidden - Optics, photonics & sensing', t: 'optical metrology, machine vision', bullets: [] },
      ] },
    ],
    cl: [],
  }),
  personalInfo: JSON.stringify({ tools: [
    { l: 'Software', v: 'Jira, Git' },
    { l: 'Optics, photonics & sensing', v: 'optical metrology, machine vision' },
  ] }),
});

test('dedup never drops a "Hidden - <category>" residue row (the loop half)', () => {
  const { dedup, store } = load(FIXTURE());
  dedup.run();
  const tools = JSON.parse(store.get('sections')).cv[1];
  assert.ok(tools.items.some((it) => /^Hidden - Optics/.test(String(it.b || ''))), 'residue row survives dedup');
});

test('dedup + residue reconcile reach a FIXED POINT (no write ping-pong)', () => {
  const ctx = load(FIXTURE());
  // simulate the event-driven alternation the probe observed
  for (let round = 0; round < 4; round++) { ctx.dedup.run(); ctx.residue._apply(); }
  const w = ctx.writesCount();
  assert.ok(w <= 2, `sections writes stay bounded (got ${w}) — the 43-write storm is dead`);
  const tools = JSON.parse(ctx.store.get('sections')).cv[1];
  assert.equal(tools.items.filter((it) => /^Hidden - /.test(String(it.b || it.l || ''))).length, 1, 'exactly one residue row, stable');
});

test('a REAL duplicated tools row is still dropped once (dedup behaviour unregressed)', () => {
  const f = FIXTURE();
  const secs = JSON.parse(f.sections);
  secs.cv[1].items.push({ b: 'Optics, photonics & sensing', t: 'Electro-optics, sensing platforms', bullets: [] });
  f.sections = JSON.stringify(secs);
  const { dedup, store } = load(f);
  dedup.run();
  const tools = JSON.parse(store.get('sections')).cv[1];
  assert.ok(!tools.items.some((it) => String(it.b || '') === 'Optics, photonics & sensing'), 'real duplicate row dropped');
  assert.ok(tools.items.some((it) => /^Hidden - Optics/.test(String(it.b || ''))), 'residue row untouched');
});
