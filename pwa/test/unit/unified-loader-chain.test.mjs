// unified-loader-chain.test.mjs
// ============================================================
// UNIFIED LOADER completion (WIZARD_SETTINGS_UX #9-12, owner rules):
//   (a) kernel review GOVERNANCE folds into the upload flow — a plain CV
//       applied through the import diff ALSO opens the kernel engine's
//       conflict/gap review and MERGES into the current kernel
//       (KERNEL-CHAIN-001);
//   (b) a signed AntCV kernel .json OVERWRITES from scratch (pre-existing
//       handleJSON _antcvKernel gate — regression-locked here);
//   (c) Undo last upload exists (pre-existing — regression-locked here);
//   (d) the single button's accept union covers every kernel-engine format,
//       including .txt (UNION-ACCEPT-001).
// String-level assertions on the sidecar (plain module, no app.js mirror),
// plus a parse check (new vm.Script) per the heredoc-hazard convention.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-data-importer.js', import.meta.url), 'utf8');
const kimp = await readFile(new URL('../../antcv-kernel-import.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

test('data-importer parses as valid script', () => {
  assert.doesNotThrow(() => new vm.Script(src));
});

test('KERNEL-CHAIN-001: applied CV chains into the kernel review (merge governance)', () => {
  assert.equal(count(src, 'KERNEL-CHAIN-001'), 1);
  assert.match(src, /CV_KINDS = \{ 'cv-doc': 1, 'generic-pdf': 1, 'generic-docx': 1 \}/);
  assert.match(src, /window\.AntcvKernelImport\.runImport\(__cvFile\)/);
  // kill-switch
  assert.match(src, /antcv:no-kernel-chain/);
  // the chain fires BEFORE closeModal nulls modalState (order in applyChanges)
  const chainIdx = src.indexOf('KERNEL-CHAIN-001');
  const closeIdx = src.indexOf('closeModal();', chainIdx);
  assert.ok(chainIdx > 0 && closeIdx > chainIdx, 'chain block sits before closeModal()');
});

test('UNION-ACCEPT-001: .txt reaches the CV route end-to-end', () => {
  // input union
  assert.match(src, /accept="\.json,\.pdf,\.docx,\.txt,\.png,\.jpg,\.jpeg,\.webp"/);
  // detectKind routes txt to the CV handler
  assert.match(src, /ext === 'txt'\)\s+return 'cv-doc'/);
  // handleCV can read a .txt
  assert.match(src, /ext === 'txt' \? await file\.text\(\)/);
});

test('regression locks: kernel-envelope OVERWRITE + Undo last upload survive', () => {
  // signed kernel envelope gate (overwrite-from-scratch w/ confirm + undo snapshot)
  assert.match(src, /_antcvKernel === 1/);
  assert.match(src, /Overwrite your current kernel from scratch/);
  // Undo plumbing + visible control
  assert.match(src, /antcv:lastUploadBackup/);
  assert.match(src, /Undo last upload/);
  // kernel export still emits the marker the overwrite gate reads
  assert.match(kimp, /_antcvKernel: 1/);
});

test('single-surface invariant: kernel pill stays retired, replacement button owns ingest', () => {
  // injectEntry sweeps stale pills and injects none (v1.50.540)
  assert.match(kimp, /inject NO separate button/);
  // the data-importer replacement button is still the one visible entry
  assert.match(src, /antcvImportReplacement = '1'/);
});
