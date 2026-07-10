// babel-relang-cache.test.mjs
// ============================================================
// BABEL-FISH-CACHE-001 (owner 2026-07-11): the babel-relang sidecar is the
// lazy-cached per-language materializer. Mode split (antcv:genSpeed):
//   fast/balanced -> restore the cached antcv:langRender:<L> snapshot instantly
//     (window.AntcvApplyStyleKernel); thorough -> skip the cache (full native gen
//     is the source of truth), fall back to a cheap re-render for correctness.
// Wrong-script non-Latin content with no cache -> window.__antcvRelang(L,true).
// Detection is on the sections DATA model, never the DOM.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const s = await readFile(new URL('../../antcv-babel-relang.js', import.meta.url), 'utf8');

test('sidecar: reads genSpeed and honours the mode split', () => {
  assert.equal(s.includes("localStorage.getItem('antcv:genSpeed')"), true, 'reads genSpeed');
  assert.equal(s.includes("speed !== 'thorough' && restoreCache(L)"), true, 'fast/balanced restore cache; thorough skips');
});

test('sidecar: caches per language in a single cloud-synced bundle, restores via AntcvApplyStyleKernel', () => {
  assert.equal(s.includes("var BUNDLE_KEY = 'langRenders'"), true, 'single cloud-synced bundle key');
  assert.equal(s.includes('BUNDLE_CAP'), true, 'hard size cap so it never bloats prefs');
  assert.equal(s.includes('function snapshot('), true, 'snapshots renderings');
  assert.equal(s.includes('window.AntcvApplyStyleKernel({ sections'), true, 'restores into React state via the apply hook');
  assert.equal(s.includes('BABEL-FISH-CACHE-001'), true, 'documented');
  assert.equal(s.includes('BABEL-FISH-CLOUD-CACHE-001'), true, 'cloud-cache documented');
});

test('sidecar: bundle is the settings-sync-extra synced key + relay-allowlisted', async () => {
  const sync = await readFile(new URL('../../antcv-settings-sync-extra.js', import.meta.url), 'utf8');
  assert.equal(sync.includes("'langRenders'"), true, 'settings-sync-extra syncs langRenders');
});

test('sidecar: never restores a mislabelled (wrong-script) snapshot', () => {
  assert.equal(s.includes('isInLanguage(textOf(c.sections), L) === false) return false'), true, 'cache guard: cached rendering must be in L');
});

test('sidecar: wrong-script fallback re-renders via the translate pass, never auto-fires a full gen', () => {
  assert.equal(s.includes('window.__antcvRelang(L, true)'), true, 'cheap re-render fallback');
  assert.equal(s.includes('__antcvGenTrigger'), false, 'no auto full-generation on a passive switch');
  assert.equal(s.includes('_antcvGenerateKernelShowcase'), false, 'no auto showcase gen on a passive switch');
});

test('sidecar: detection is on the data model, not the DOM', () => {
  assert.equal(s.includes("localStorage.getItem('sections')") || s.includes("getItem('sections')"), true, 'reads sections data model');
  assert.equal(/querySelector|innerText|document\.body/.test(s), false, 'never samples the DOM (would be diluted by English chrome)');
});
