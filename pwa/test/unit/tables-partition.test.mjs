// tables-partition.test.mjs
// ============================================================
// TABLES-PARTITION-001: the CV CORE COMPETENCIES and CL WHAT I BRING tables kept
// coming out near-identical because (1) the LLM emits only ~4 distinct competency
// areas and reuses 3 in both tables, (2) the drop-only floor bails when dropping
// would leave CORE < 2 rows, and (3) that floor only compared within one doc while
// the tables live in different docs. This sidecar enlarges the pool from the
// kernel `tools` Expertise/Methods groups and force-partitions CORE disjoint from
// BRING, filling to a 3-4 row target. Loads the real sidecar in a vm sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-tables-partition.js', import.meta.url), 'utf8');

// Real kernel tools shape (from the owner's live personalInfo, trimmed).
const TOOLS = [
  { l: 'AI-assisted', v: 'Experiment setup, log triage, measurement analysis' },
  { group: 'Expertise' },
  { l: 'Optics, photonics & sensing', v: 'Electro-optics, photonics, semiconductor physics, optical metrology, machine vision, LiDAR' },
  { l: 'Imaging', v: 'Camera architecture, image sensors, ISP, image quality (MTF/SFR, SNR)' },
  { l: 'Materials & devices', v: 'Nanomaterials, carbon nanotubes (CNT), MEMS/NEMS' },
  { l: 'Product & systems', v: 'Systems architecture, requirements & traceability, change governance' },
  { group: 'Tools' },
  { l: 'Software', v: 'Jira, Confluence, Codebeamer ALM' },
  { group: 'Methods' },
  { l: 'Quality & process', v: 'Lean, Six Sigma Black Belt, FMEA, DFMEA, APIS' },
  { l: 'Validation', v: 'V&V planning, DV/PV, FAT/SAT, acceptance criteria' },
  { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, deposition, etch' },
];

const H = ['Focus Area', 'Strategic Expertise'];
// Live overlap: CORE's 3 of 4 rows duplicate BRING (the exact failing case).
const BRING = {
  id: 'bring', type: 'table', title: 'WHAT I BRING', rows: [
    H,
    ['Change Governance', 'Automotive SPICE and ISO 26262 traceability'],
    ['Sourcing & Feasibility', 'RFQ/RFI evaluation, supplier scoring'],
    ['Technical team Coord.', 'Engineering, suppliers, OEMs for decisions'],
  ],
};
const CORE = {
  id: 'core_comp', type: 'table', title: 'CORE COMPETENCIES', rows: [
    H,
    ['Sourcing & Feasibility', 'RFQ/RFI evaluation, supplier scoring, total landed cost'],
    ['Technical team Coord.', 'Optics, electronics, firmware, validation'],
    ['Change governance', 'Automotive SPICE, ISO 26262, CCB, KPIs'],
    ['Validation & Compliance', 'DV/PV, FAT/SAT, acceptance criteria'],
  ],
};

function run(sections, pi) {
  const store = new Map(Object.entries({ sections: JSON.stringify(sections), personalInfo: JSON.stringify(pi || { tools: TOOLS }) }));
  const events = [];
  const sandbox = {
    window: {
      addEventListener() {}, dispatchEvent(e) { events.push(e); return true; },
      requestAnimationFrame: (fn) => { fn(); return 1; },
    },
    document: {},
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  sandbox.window.AntcvTablesPartition._apply();
  return { sections: JSON.parse(store.get('sections')), api: sandbox.window.AntcvTablesPartition };
}
const focuses = (tbl) => tbl.rows.slice(1).map((r) => r[0]);
const norm = (s) => String(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

test('CORE and BRING end up with DISJOINT focus areas', () => {
  const { sections } = run({ cv: [CORE], cl: [BRING] });
  const core = sections.cv.find((s) => s.id === 'core_comp');
  const bring = sections.cl.find((s) => s.id === 'bring');
  const bset = new Set(focuses(bring).map(norm));
  for (const f of focuses(core)) assert.equal(bset.has(norm(f)), false, `CORE "${f}" must not be in BRING`);
});

test('BRING is never modified (it wins shared focus areas)', () => {
  const { sections } = run({ cv: [CORE], cl: [BRING] });
  const bring = sections.cl.find((s) => s.id === 'bring');
  assert.deepEqual(bring.rows, BRING.rows);
});

test('CORE is filled from the kernel pool to >= 3 distinct rows', () => {
  const { sections } = run({ cv: [CORE], cl: [BRING] });
  const core = sections.cv.find((s) => s.id === 'core_comp');
  assert.ok(focuses(core).length >= 3, 'CORE has at least 3 rows');
  assert.ok(focuses(core).length <= 4, 'CORE capped at the 4-row target');
  // it should keep its one distinct row (Validation & Compliance) and add pool rows
  assert.ok(focuses(core).some((f) => /validation & compliance/i.test(f)), 'keeps the distinct CORE row');
  assert.ok(focuses(core).some((f) => /optics|imaging|materials|product & systems|quality|lab/i.test(f)), 'adds kernel-pool rows');
});

test('fill rows carry compacted real expertise from the kernel', () => {
  const { sections } = run({ cv: [CORE], cl: [BRING] });
  const core = sections.cv.find((s) => s.id === 'core_comp');
  for (const r of core.rows.slice(1)) {
    assert.ok(String(r[1]).length <= 60, 'expertise cell is compact');
    assert.ok(String(r[1]).length > 0, 'expertise cell non-empty');
    assert.ok(!/,\S/.test(String(r[1])), 'commas keep a following space (no ",photonics")');
  }
});

test('idempotent: a second pass makes no further change', () => {
  const once = run({ cv: [CORE], cl: [BRING] }).sections;
  const twice = run(once).sections;
  assert.deepEqual(twice, once);
});

test('already-disjoint tables are left unchanged (no-op)', () => {
  const disjointCore = { id: 'core_comp', type: 'table', rows: [H, ['Optics, photonics & sensing', 'EO, LiDAR'], ['Imaging', 'ISP, MTF'], ['Validation', 'DV/PV']] };
  const before = { cv: [disjointCore], cl: [BRING] };
  const { sections } = run(JSON.parse(JSON.stringify(before)));
  assert.deepEqual(sections.cv.find((s) => s.id === 'core_comp').rows, disjointCore.rows);
});

test('disable flag short-circuits', () => {
  const store = { 'antcv:disable-tables-partition': '1' };
  const sections = { cv: [CORE], cl: [BRING] };
  const map = new Map(Object.entries({ ...store, sections: JSON.stringify(sections), personalInfo: JSON.stringify({ tools: TOOLS }) }));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: (fn) => { fn(); return 1; } },
    document: {}, localStorage: { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} }, setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function () {}, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox); vm.runInContext(src, sandbox);
  sandbox.window.AntcvTablesPartition._apply();
  assert.deepEqual(JSON.parse(map.get('sections')).cv[0].rows, CORE.rows, 'unchanged when disabled');
});

test('finds tables cross-document (core in CV, bring in CL) — the dedup blind spot', () => {
  // explicitly the layout the old floor missed
  const { api } = run({ cv: [CORE], cl: [BRING] });
  const pool = api._pool();
  assert.ok(pool.length >= 5, 'kernel pool has the Expertise+Methods rows');
  assert.ok(pool.some((p) => /optics/i.test(p.focus)));
});
