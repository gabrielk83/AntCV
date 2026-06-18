// table-dims-forward.test.mjs
// ============================================================
// WIB-TABLE-DIMS-001 (owner 2026-06-14, backlog item 5): the WHAT I BRING table
// (and CV Core Competencies) exported at the worker's DEFAULT width/column split
// because buildPayload's normalizeSections never forwarded the per-section
// dimensions the user dragged in the preview. The worker reads s.tableWidth (DXA)
// and s.tableRatio per section; this locks that buildPayload now attaches them:
// width from personalInfo.stylePrefs.tableWidthPct[id] (non-default only), ratio
// from clTableRatio ("bring"/CL) or cvTableRatio (CV).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { buildPayload } = await import('../../antcv-docx-client.js');

function payloadCL(pctMap, clRatio) {
  store.clear();
  const pi = { name: 'T', stylePrefs: pctMap ? { tableWidthPct: pctMap } : {} };
  store.set('personalInfo', JSON.stringify(pi));
  if (clRatio != null) store.set('clTableRatio', JSON.stringify(clRatio));
  return buildPayload({
    sections: { cv: [], cl: [
      { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'W.' },
      { id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'table',
        rows: [['Focus Area', 'Strategic Expertise'], ['A', 'a'], ['B', 'b']] },
    ] },
    doc: 'cl', personalInfo: pi,
  });
}

function payloadCV(pctMap, cvRatio) {
  store.clear();
  const pi = { name: 'T', stylePrefs: pctMap ? { tableWidthPct: pctMap } : {} };
  store.set('personalInfo', JSON.stringify(pi));
  if (cvRatio != null) store.set('cvTableRatio', JSON.stringify(cvRatio));
  return buildPayload({
    sections: { cv: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
      { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
        rows: [['Focus', 'Expertise'], ['A', 'a'], ['B', 'b']] },
    ], cl: [] },
    doc: 'cv', personalInfo: pi,
  });
}

test('WHAT I BRING forwards the user width (pct → DXA) + clTableRatio', () => {
  const p = payloadCL({ bring: 75 }, 0.4);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, Math.round(11506 * 0.75)); // 8630 (CL base = PAGE_W-400, 1.50.671)
  assert.equal(t.tableRatio, 0.4);
});

test('rest width (90%) forwards NO tableWidth (worker keeps its default)', () => {
  // CL-TABLE-WIDTH-PAGE-REF-001 (1.50.671): the CL table rests at 90% of the body
  // column (worker defaultClW = (PAGE_W-400)*0.9); ±1 of the rest pct = no forward.
  const p = payloadCL({ bring: 90 }, null);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, undefined);
});

test('no stored width map → no tableWidth on the table', () => {
  const p = payloadCL(null, null);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, undefined);
});

test('an out-of-range ratio is dropped (not forwarded)', () => {
  const p = payloadCL({ bring: 60 }, 0.98);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, Math.round(11506 * 0.6));
  assert.equal(t.tableRatio, undefined);
});

test('CV Core Competencies forwards its own width (6630 base) + cvTableRatio', () => {
  const p = payloadCV({ core_comp: 120 }, 0.35);
  const t = p.sections.find((s) => s.id === 'core_comp');
  assert.equal(t.tableWidth, Math.round(6630 * 1.2)); // 7956
  assert.equal(t.tableRatio, 0.35);
});

test('non-table sections never receive table dimensions', () => {
  const p = payloadCL({ bring: 75 }, 0.4);
  const who = p.sections.find((s) => s.id === 'who');
  assert.equal(who.tableWidth, undefined);
  assert.equal(who.tableRatio, undefined);
});

// TABLE-WIDTH-CLOBBER-001 (owner 2026-06-15): the width moved to the standalone
// `antcv:tableWidthPct` key so it survives the personalInfo cloud-restore
// rewrites that wiped it on export. buildPayload must read the standalone key.
function payloadCLStandalone(standaloneMap, nestedMap, clRatio) {
  store.clear();
  const pi = { name: 'T', stylePrefs: nestedMap ? { tableWidthPct: nestedMap } : {} };
  store.set('personalInfo', JSON.stringify(pi));
  if (standaloneMap) store.set('antcv:tableWidthPct', JSON.stringify(standaloneMap));
  if (clRatio != null) store.set('clTableRatio', JSON.stringify(clRatio));
  return buildPayload({
    sections: { cv: [], cl: [
      { id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'table',
        rows: [['Focus Area', 'Strategic Expertise'], ['A', 'a']] },
    ] },
    doc: 'cl', personalInfo: pi,
  });
}

test('standalone antcv:tableWidthPct is read (the clobber-proof source of truth)', () => {
  // personalInfo nested value is GONE (simulates the cloud-restore wipe); the
  // standalone key still carries the dragged width → export stays correct.
  const p = payloadCLStandalone({ bring: 110 }, null, null);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, Math.round(11506 * 1.10)); // 12657 (CL base = PAGE_W-400, 1.50.671)
});

test('standalone key WINS over a stale nested personalInfo value', () => {
  const p = payloadCLStandalone({ bring: 110 }, { bring: 75 }, null);
  const t = p.sections.find((s) => s.id === 'bring');
  assert.equal(t.tableWidth, Math.round(11506 * 1.10));
});
