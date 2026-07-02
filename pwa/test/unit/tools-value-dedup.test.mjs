// tools-value-dedup.test.mjs
// ============================================================
// TOOLS-VALUE-DEDUP-001 (owner 2026-07-03, export 2026-07-02): the gen merge
// appended kernel canon rows whose LABEL and GROUP are swapped versions of
// rows the LLM already emitted — byte-identical VALUES under different labels,
// which every label-keyed dedup pass missed. dedupeValueRows drops the later
// copy by normalized-body identity (>=24 chars), stashes it on trimmedItems,
// and removes group headers left empty.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-tools-merge-dedup.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const dispatched = [];
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent(e) { dispatched.push(e && (e.detail && e.detail.reason || e.type)); return true; } },
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
  return { api: sandbox.window.AntcvToolsMergeDedup, store, dispatched };
}

// Verbatim from the 2026-07-02 export (condensed to 3 of the 5 dup pairs).
const OPTICS_TAIL = 'Electro-optics, photonics, semiconductor physics, optical metrology, machine vision, LiDAR, single-photon detection (SPAD, SiPM, TCSPC, 905 nm), silicon-photonics integration';
const INSTR_TAIL = 'Optical benches, interferometry, confocal microscopy, Raman spectroscopy, SEM, HRSEM, electrical probe stations';
const FAB_TAIL = 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PDMS nanoimprint, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication';

function seededSection() {
  return {
    id: 'tools', title: 'TOOLS & METHODS', type: 'rich_block', on: true,
    items: [
      { grp: true, t: 'Optics, photonics & sensing' },
      { b: 'Expertise', t: OPTICS_TAIL },
      { grp: true, t: 'Instruments' },
      { b: 'Lab tools', t: INSTR_TAIL },
      { grp: true, t: 'Lab & fabrication' },
      { b: 'Fabrication', t: FAB_TAIL },
      // appended label-swapped duplicates under umbrella headers:
      { grp: true, t: 'Expertise' },
      { b: 'Optics, photonics & sensing', t: OPTICS_TAIL },
      { grp: true, t: 'Tools' },
      { b: 'Instruments', t: INSTR_TAIL },
      { b: 'Lab & fabrication', t: FAB_TAIL },
    ],
  };
}

test('label-swapped value duplicates are dropped; umbrella headers removed', () => {
  const { api } = load({});
  const sec = seededSection();
  assert.equal(api._dedupeValueRows(sec), true);
  // NOTE: sec.items is a VM-realm array after the call — spread into host-realm
  // arrays so deepStrictEqual doesn't fail on the cross-realm Array prototype.
  const bodies = [...sec.items.filter((it) => !it.grp).map((it) => it.t)];
  assert.deepEqual(bodies, [OPTICS_TAIL, INSTR_TAIL, FAB_TAIL], 'each value survives exactly once');
  const leads = [...sec.items.filter((it) => !it.grp).map((it) => it.b)];
  assert.deepEqual(leads, ['Expertise', 'Lab tools', 'Fabrication'], 'first-occurrence leads kept');
  const grps = [...sec.items.filter((it) => it.grp).map((it) => it.t)];
  assert.deepEqual(grps, ['Optics, photonics & sensing', 'Instruments', 'Lab & fabrication'], 'emptied umbrella Expertise/Tools headers removed');
  assert.equal(sec.trimmedItems.length, 3, 'dropped rows stashed, not deleted');
});

test('idempotent: second pass is a no-op', () => {
  const { api } = load({});
  const sec = seededSection();
  api._dedupeValueRows(sec);
  const snap = JSON.stringify(sec.items);
  assert.equal(api._dedupeValueRows(sec), false);
  assert.equal(JSON.stringify(sec.items), snap);
});

test('short repeated values (<24 chars) under two labels are BOTH kept', () => {
  const { api } = load({});
  const sec = { id: 'tools', type: 'rich_block', items: [
    { b: 'Data', t: 'Python' },
    { b: 'Automation', t: 'Python' },
  ] };
  assert.equal(api._dedupeValueRows(sec), false);
  assert.equal(sec.items.length, 2);
});

test('same label with DIFFERENT bodies both kept (exact-match only)', () => {
  const { api } = load({});
  const sec = { id: 'tools', type: 'rich_block', items: [
    { b: 'Expertise', t: OPTICS_TAIL },
    { b: 'Expertise', t: FAB_TAIL },
  ] };
  assert.equal(api._dedupeValueRows(sec), false);
});

test('NBSP-glued copy still deduped (normalization)', () => {
  const { api } = load({});
  const glued = OPTICS_TAIL.replace('machine vision', 'machine'+String.fromCharCode(160)+'vision');
  const sec = { id: 'tools', type: 'rich_block', items: [
    { b: 'Expertise', t: OPTICS_TAIL },
    { b: 'Optics, photonics & sensing', t: glued },
  ] };
  assert.equal(api._dedupeValueRows(sec), true);
  assert.equal(sec.items.length, 1);
});

test('run() writes once with reason tools-merge-dedup; kill switch respected', () => {
  const secs = { cv: [seededSection()], cl: [] };
  const { api, store, dispatched } = load({ sections: JSON.stringify(secs) });
  api.run();
  const out = JSON.parse(store.get('sections')).cv[0];
  assert.equal(out.items.filter((it) => !it.grp).length, 3);
  assert.ok(dispatched.includes('tools-merge-dedup'));
  // kill switch: sidecar refuses to install at all
  const off = load({ sections: JSON.stringify(secs), 'antcv:disable-tools-dedup': '1' });
  assert.equal(off.api, undefined, 'kill switch prevents install');
});
