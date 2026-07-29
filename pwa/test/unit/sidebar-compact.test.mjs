// sidebar-compact.test.mjs
// ============================================================
// TOOLS-SIDEBAR-COMPACT-BELT-001 (register row 26, owner 2026-07-03): deterministic
// item-level synonym/trim for the TOOLS & METHODS sidebar Instruments / Lab &
// fabrication comma-lists, so preview + PDF render the owner's gold text. Scoped by
// the row's lead label; rich_block value only; text-verified + idempotent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-sidebar-compact-001.js', import.meta.url), 'utf8');

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
  return { api: sandbox.window.AntcvSidebarCompact, store, dispatched };
}

// Verbatim current stored values (2026-07-02 unsolicited export).
const INSTR_IN = 'Optical benches, interferometry, confocal microscopy, Raman spectroscopy, SEM, HRSEM, electrical probe stations';
const FAB_IN = 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PDMS nanoimprint, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication';

test('Instruments: confocal microscopy->imaging, electrical probe stations->probe stations, SEM dropped (HRSEM kept)', () => {
  const { api } = load({});
  const out = api._compactValue(INSTR_IN);
  assert.equal(out, 'Optical benches, interferometry, confocal imaging, Raman spectroscopy, HRSEM, probe stations');
  assert.equal(/\bconfocal microscopy\b/i.test(out), false);
  assert.equal(/\belectrical probe stations\b/i.test(out), false);
  assert.equal(out.split(',').map((t) => t.trim().toLowerCase()).includes('sem'), false, 'standalone SEM dropped');
  assert.equal(/\bHRSEM\b/.test(out), true, 'HRSEM survives');
});

test('Lab & fabrication: trailing redundant word "fabrication" trimmed, ends at SOI MEMS/NEMS', () => {
  const { api } = load({});
  const out = api._compactValue(FAB_IN);
  assert.equal(/\bfabrication\s*$/i.test(out), false, 'no trailing fabrication');
  assert.equal(/SOI MEMS\/NEMS$/.test(out), true, 'ends at SOI MEMS/NEMS');
  // leading "Cleanroom fabrication" token is NOT a trailing word -> untouched
  assert.equal(out.indexOf('Cleanroom fabrication'), 0, 'only the TRAILING fabrication is trimmed');
});

test('HRSEM/SEM combined token collapses to HRSEM', () => {
  const { api } = load({});
  assert.equal(api._compactValue('Optical benches, HRSEM/SEM, interferometry'), 'Optical benches, HRSEM, interferometry');
  assert.equal(api._compactValue('Optical benches, SEM/HRSEM, interferometry'), 'Optical benches, HRSEM, interferometry');
});

test('SEM kept when HRSEM is NOT a sibling (no gratuitous drop)', () => {
  const { api } = load({});
  assert.equal(api._compactValue('Optical benches, SEM, interferometry'), 'Optical benches, SEM, interferometry');
});

test('idempotent: second pass returns identical string', () => {
  const { api } = load({});
  const once = api._compactValue(INSTR_IN);
  assert.equal(api._compactValue(once), once);
  const fabOnce = api._compactValue(FAB_IN);
  assert.equal(api._compactValue(fabOnce), fabOnce);
});

test('non-scoped labels are untouched by compactSection (scope guard)', () => {
  const { api } = load({});
  const sec = { id: 'tools', type: 'rich_block', items: [
    { b: 'Expertise', t: 'Electro-optics, confocal microscopy, SEM, HRSEM' }, // NOT Instruments/Lab
  ] };
  assert.equal(api._compactSection(sec), false, 'out-of-scope label not changed');
  assert.equal(sec.items[0].t, 'Electro-optics, confocal microscopy, SEM, HRSEM');
});

test('compactSection rewrites scoped rows only', () => {
  const { api } = load({});
  const sec = { id: 'tools', type: 'rich_block', items: [
    { b: 'Instruments', t: INSTR_IN },
    { b: 'Lab & fabrication', t: FAB_IN },
    { b: 'Quality & process', t: 'FMEA, DoE, SPC, confocal microscopy' }, // out of scope -> untouched
  ] };
  assert.equal(api._compactSection(sec), true);
  assert.equal(/confocal imaging/.test(sec.items[0].t), true);
  assert.equal(/SOI MEMS\/NEMS$/.test(sec.items[1].t), true);
  assert.equal(sec.items[2].t, 'FMEA, DoE, SPC, confocal microscopy', 'out-of-scope Quality row untouched');
});

test('run() writes once with reason sidebar-compact; kill switch prevents install', () => {
  const secs = { cv: [{ id: 'tools', title: 'TOOLS & METHODS', type: 'rich_block', items: [
    { b: 'Instruments', t: INSTR_IN }, { b: 'Lab & fabrication', t: FAB_IN },
  ] }], cl: [] };
  const { api, store, dispatched } = load({ sections: JSON.stringify(secs) });
  api.run();
  const out = JSON.parse(store.get('sections')).cv[0];
  assert.equal(/confocal imaging/.test(out.items[0].t), true);
  assert.equal(dispatched.includes('sidebar-compact'), true);
  // second run is a no-op (idempotent) -> no second dispatch
  const before = dispatched.length;
  api.run();
  assert.equal(dispatched.length, before, 'idempotent run does not re-dispatch');
  // kill switch: sidecar refuses to install
  const off = load({ sections: JSON.stringify(secs), 'antcv:disable-sidebar-compact': '1' });
  assert.equal(off.api, undefined, 'kill switch prevents install');
});
