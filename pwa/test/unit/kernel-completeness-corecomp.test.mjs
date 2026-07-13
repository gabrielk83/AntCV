// CORE-COMP-RETRY-HANG-001 (owner 2026-06-15): the kernel-completeness sidecar
// threw PartialResponse (forcing a full generate RETRY, up to 4×) whenever
// cv_overrides.core_comp_rows had <4 data rows. The LLM commonly returns 3 →
// multi-minute hang + the subtitle reverting to the [Specialisation …]
// placeholder. The floor is now 3 (matches cl.bring_rows + experience_roles).
// This test loads the real sidecar (which wraps the global JSON.parse) and
// asserts: a 3-data-row core_comp generation output PASSES (no throw), while a
// 2-data-row one still throws — i.e. the threshold moved 4 -> 3, not removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, '..', '..', 'antcv-kernel-completeness-290.js'), 'utf8');

// Run the sidecar in a VM context with a minimal window/document so its IIFE
// installs the JSON.parse wrap onto THIS context's JSON.
const ctx = {
  window: { fetch: function () { return Promise.resolve({}); } },
  document: { readyState: 'complete', addEventListener() {}, documentElement: {} },
  console: { log() {}, warn() {}, debug() {}, info() {} },
  JSON, Date, Array, Object, String, Math, RegExp, Error,
};
ctx.window.addEventListener = function () {};
vm.createContext(ctx);
vm.runInContext(SRC, ctx);

// Build a generation output that passes EVERY completeness check except the
// core_comp row count (prose fields are omitted → tolerated).
function dataRows(n) {
  const r = [['Focus Area', 'Strategic Expertise']];
  for (let i = 0; i < n; i++) r.push(['Area number ' + i, 'Strategic expertise detail ' + i]);
  return r;
}
function roles(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push({ title: 'Role Title ' + i, company: 'Company ' + i, years: '2020 — 2024', bullets: ['Delivered a substantial outcome number ' + i + ' here'] });
  return a;
}
function output(coreCompDataRows) {
  return {
    meta: {},
    cv_overrides: { experience_roles: roles(3), core_comp_rows: dataRows(coreCompDataRows), selected_outcomes: [] },
    cl_overrides: { bring_rows: dataRows(3), contribute_items: ['Contribute item one is long enough', 'Contribute item two is long enough', 'Contribute item three is long enough'] },
  };
}

function parseInCtx(obj) {
  const str = JSON.stringify(obj); // host (unwrapped) stringify
  // run the wrapped parse inside the context
  ctx.__teststr = str;
  return vm.runInContext('JSON.parse(__teststr)', ctx);
}

test('core_comp_rows with 3 data rows PASSES (no retry) after the 4->3 floor', () => {
  assert.doesNotThrow(() => parseInCtx(output(3)), 'a 3-row Core Competencies table must not force a retry');
});

test('core_comp_rows with 4 data rows still passes', () => {
  assert.doesNotThrow(() => parseInCtx(output(4)));
});

// CORE-COMP-ROWSPEC-001 (owner 2026-07-13): 'we need 3-4 TABLE rows' — the
// matrix row spec is min 3 / max 4 (cells <=2 rendered lines is a SEPARATE
// rule, density.cell_max_lines). The guard floor = the matrix minimum, 3.
test('core_comp_rows with 2 data rows throws (below the 3-4 row spec)', () => {
  let threw = null;
  try { parseInCtx(output(2)); } catch (e) { threw = e; }
  assert.ok(threw, 'a 2-row table is below the 3-4 table-row spec');
  assert.match(String(threw.message || ''), /core_comp_rows/, 'the failure must cite core_comp_rows');
});
