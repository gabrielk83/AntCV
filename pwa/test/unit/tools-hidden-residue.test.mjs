// TOOLS-HIDDEN-RESIDUE-001 (owner 2026-07-03) — per-application review row for
// tools trimmed INSIDE a compressed value.
//
// Owner: the stored "Lab & fabrication: …, PDMS nanoimprint, …" loses PDMS in a
// targeted generation; it must reappear as "Hidden - Lab & fabrication: PDMS
// nanoimprint" in the panel (hidden, per application), and un-hiding that row
// must merge the token back into the real line without retyping.
//
// Locks:
//  1. DIFF: a kernel token missing from the section grows a hidden residue row.
//  2. Idempotent: a second reconcile over the result is a no-op.
//  3. RESTORE: un-hiding the residue row folds tokens into the category row
//     and removes the residue row.
//  4. HEAL: a token re-added by hand empties + removes the residue row.
//  5. Skeleton gate: bracketed template values produce no residue.
//  6. Zero-presence gate: a section sharing NO kernel token (other language /
//     unrelated) is left alone — the kernel is never dumped wholesale.
//  7. Export belt: sanitizeForExport drops residue rows from sidebar sections.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-tools-hidden-residue.js', import.meta.url), 'utf8');

function loadSidecar() {
  const backing = {};
  const localStorage = {
    getItem: (k) => (k in backing ? backing[k] : null),
    setItem: (k, v) => { backing[k] = String(v); },
    removeItem: (k) => { delete backing[k]; },
  };
  const window = { addEventListener() {}, dispatchEvent() {} };
  const ctx = {
    window, localStorage, console,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout() {},
    CustomEvent: function CustomEvent() {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return { api: window.AntcvToolsHiddenResidue, backing };
}

const KERNEL_TOOLS = [
  { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PDMS nanoimprint, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication' },
  { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
];

function cats(api) { return api._kernelCategories({ tools: KERNEL_TOOLS }); }

test('DIFF: trimmed kernel tokens land in a hidden residue row per category', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next, 'reconcile reports a change');
  const residue = next.filter((it) => /^Hidden - /.test(it.l || ''));
  assert.equal(residue.length, 1, 'exactly one residue row');
  assert.equal(residue[0].l, 'Hidden - Lab & fabrication');
  assert.equal(residue[0].v, 'PDMS nanoimprint');
  assert.equal(residue[0].hidden, true, 'residue row is hidden');
});

test('idempotent: reconciling the reconciled section is a no-op', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, etch' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
  ];
  const once = api._reconcile(items, cats(api));
  assert.ok(once);
  assert.equal(api._reconcile(once, cats(api)), null, 'second pass is a no-op');
});

test('RESTORE: un-hiding the residue row merges tokens back and removes it', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, etch' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
    { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint, DRIE', hidden: false }, // eye clicked
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next);
  const lab = next.find((it) => it.l === 'Lab & fabrication');
  assert.ok(/PDMS nanoimprint/.test(lab.v), 'PDMS is back in the real line');
  assert.ok(/DRIE/.test(lab.v), 'DRIE is back in the real line');
  // Kernel tokens STILL missing from the section are re-collected into a fresh
  // hidden residue row — the restored ones must not be in it.
  const residue = next.filter((it) => /^Hidden - /.test(it.l || ''));
  assert.equal(residue.length, 1, 'still-missing tokens stay reviewable');
  assert.equal(residue[0].hidden, true);
  assert.ok(!/PDMS|DRIE/.test(residue[0].v), 'restored tokens left the residue row');
  assert.equal(api._reconcile(next, cats(api)), null, 'stable after restore');
});

test('RESTORE fallback: no surviving category row promotes the residue row in place', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
    { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint', hidden: false },
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next);
  const promoted = next.find((it) => it.l === 'Lab & fabrication');
  assert.ok(promoted, 'residue row promoted to a real category row');
  assert.equal(promoted.v, 'PDMS nanoimprint');
  assert.ok(promoted.hidden === false, 'promoted row is visible');
});

test('HEAL: a token re-added by hand removes it from the residue row', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, etch, PDMS nanoimprint' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
    { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint, DRIE', hidden: true },
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next);
  const residue = next.find((it) => it.l === 'Hidden - Lab & fabrication');
  assert.ok(residue, 'residue row survives while DRIE is still missing');
  // Rebuilt in KERNEL order (the master is the reference), PDMS healed out.
  assert.equal(residue.v, 'deposition, DRIE, plasma processing, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication');
});

test('non-kernel tokens hidden via long-press survive the kernel rebuild', () => {
  const { api } = loadSidecar();
  // 'Custom nanoimprint jig' is NOT in the kernel (edited/generated wording) —
  // the residue row must keep it as long as it stays missing from the section.
  const items = [
    { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, etch' },
    { l: 'Project & lifecycle', v: 'Codebeamer, Jira, MS Project' },
    { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint, Custom nanoimprint jig', hidden: true },
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next);
  const residue = next.find((it) => it.l === 'Hidden - Lab & fabrication');
  assert.ok(/Custom nanoimprint jig/.test(residue.v), 'non-kernel token preserved');
  assert.ok(/PDMS nanoimprint/.test(residue.v), 'kernel token still collected');
});

test('RICH shape (the real runtime tools): diff creates a {b,t} residue row', () => {
  // RICHBLOCK-SHAPE-001 — tools is MIGRATED to rich_block at runtime; items
  // are {b,t,bullets} with {grp:true} groups. The owner's mobile bug: the
  // 1.51.114 sidecar only understood {l,v}.
  const { api } = loadSidecar();
  const items = [
    { grp: true, t: 'Engineering', bullets: [] },
    { b: 'Lab & fabrication', t: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication', bullets: [] },
    { b: 'Project & lifecycle', t: 'Codebeamer, Jira, MS Project', bullets: [] },
  ];
  const next = api._reconcile(items, cats(api));
  assert.ok(next, 'reconcile reports a change');
  const residue = next.filter((it) => /^Hidden - /.test(it.b || it.l || ''));
  assert.equal(residue.length, 1);
  assert.equal(residue[0].b, 'Hidden - Lab & fabrication', 'residue row in the SECTION shape (b, not l)');
  assert.equal(residue[0].t, 'PDMS nanoimprint');
  assert.ok(!('hidden' in residue[0]), 'rich residue carries NO per-item flag (renderer ignores it; RESIDUE-PREVIEW-SKIP hides it)');
  assert.equal(api._reconcile(next, cats(api)), null, 'idempotent on rich shape');
});

test('restoreToken (menu-driven): moves a token from the rich residue row back into the line', () => {
  const { api, backing } = loadSidecar();
  backing['personalInfo'] = JSON.stringify({ tools: KERNEL_TOOLS });
  backing['sections'] = JSON.stringify({
    cv: [{
      id: 'tools', loc: 'sidebar', type: 'rich_block',
      items: [
        { b: 'Lab & fabrication', t: 'Cleanroom fabrication, lithography, etch', bullets: [] },
        { b: 'Hidden - Lab & fabrication', t: 'PDMS nanoimprint, DRIE', bullets: [] },
      ],
    }],
  });
  assert.equal(api.restoreToken('tools', 'Lab & fabrication', 'PDMS nanoimprint'), true);
  const items = JSON.parse(backing['sections']).cv[0].items;
  assert.ok(/PDMS nanoimprint/.test(items[0].t), 'token back in the real line');
  const res = items.find((it) => /^Hidden - /.test(it.b || ''));
  assert.equal(res.t, 'DRIE', 'restored token left the residue row');
});

test('skeleton gate: bracketed template values produce no residue', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Tools', v: '[Methods, platforms, lab equipment, software, or workflows relevant to the role]' },
    { l: 'Methods', v: '[How you work: requirements, validation, stakeholder mapping, design reviews, etc.]' },
  ];
  assert.equal(api._reconcile(items, cats(api)), null);
});

test('zero-presence gate: a section sharing no kernel token is left alone', () => {
  const { api } = loadSidecar();
  const items = [
    { l: 'Regnskab', v: 'Dinero, e-conomic, Excel-makroer' },
  ];
  assert.equal(api._reconcile(items, cats(api)), null);
});

test('export belt: sanitizeForExport drops residue rows from sidebar sections', async () => {
  globalThis.window = globalThis.window || {};
  const { sanitizeForExport } = await import('../../antcv-docx-client.js');
  const sections = [{
    id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list',
    items: [
      { l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, etch' },
      { l: 'Hidden - Lab & fabrication', v: 'PDMS nanoimprint', hidden: true },
      { l: 'Hidden - Project & lifecycle', v: 'MS Project' }, // stale flag: even visible it never ships
    ],
  }];
  const out = sanitizeForExport(sections, 'cv');
  const tools = out.find((s) => s.id === 'tools');
  assert.equal(tools.items.length, 1, 'both residue rows dropped from the payload');
  assert.equal(tools.items[0].l, 'Lab & fabrication');
});

test('RESTORE placement: insertBest never beats worse than append-at-end and keeps all tokens', () => {
  const { api } = loadSidecar();
  const label = 'Lab & fabrication';
  const toks = ['Cleanroom fabrication', 'lithography', 'etch', 'plasma processing', 'DRIE'];
  const out = api._insertBest(label, toks, 'PDMS nanoimprint');
  assert.equal(out.length, toks.length + 1);
  assert.equal(out.filter((t) => t === 'PDMS nanoimprint').length, 1);
  for (const t of toks) assert.ok(out.includes(t), 'no original token lost: ' + t);
  const appended = toks.concat(['PDMS nanoimprint']);
  assert.ok(api._lineCost(label, out) <= api._lineCost(label, appended), 'chosen position costs no more lines than appending');
});

test('RESIDUE-PREVIEW-SKIP: both app bundles skip residue rows in the labeled_list preview', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const min = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.ok(src.includes('RESIDUE-PREVIEW-SKIP'), 'app.src.js carries the marker');
  assert.ok(src.includes('row.hidden || /^\\s*hidden\\s*[-–—:]\\s*/i.test(String(row.l || ""))'), 'app.src.js skip condition present');
  assert.ok(min.includes('e.hidden||/^\\s*hidden\\s*[-–—:]\\s*/i.test(String(e.l||""))'), 'app.js (minified mirror) skip condition present');
});
