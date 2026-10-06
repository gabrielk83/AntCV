// CACHE-BUST-SET-001 (2026-10-06): the release set must be ONE version.
//
// Part 1 — pure core on fixtures (deterministic, no git).
// Part 2 — the REAL tree: pwa/index.html, pwa/sw.js, pwa/antcv-version-override.js.
// Part 2 is the lock that turns an incomplete cache-bust set into a red suite.
// PR #379 (1.51.4832) bumped sw.js CACHE + TARGET_VERSION and left the boot seed
// and antcv-version-override.js's own ?v at 1.51.4812; nothing failed, because the
// --range gate only reads ?v lines and no test read the constants themselves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseSet, setOffenders } from '../../../scripts/check-cache-bust.mjs';

const V = '1.51.4833-cache-bust-set';
const PREV = '1.51.4832-edu-detail';

function fixture({ cache = V, target = V, seed = V, voRef = V, stale = [PREV] } = {}) {
  return {
    sw: `const CACHE = 'antcv-${cache}';\nconst SHELL = [\n  './manifest.json',\n];`,
    vo: `  const TARGET_VERSION = '${target}';\n\n  // comment\n  const STALE_VERSIONS = [\n${stale.map((s) => `    '${s}',`).join('\n')}\n  ];\n  const STALE_SET = new Set(STALE_VERSIONS);`,
    html: `<script src="app.js?v=1.51.4812-import-rewrap-siblings"></script>\n` +
      `  window.ANTCV_VERSION = '${seed}';  /* seed */\n` +
      `            vo.src = 'antcv-version-override.js?v=${voRef}';\n`,
  };
}

test('parseReleaseSet reads all five values', () => {
  const set = parseReleaseSet(fixture({ stale: [PREV, '1.51.4813-linear-detail-groups'] }));
  assert.equal(set.cache, V);
  assert.equal(set.target, V);
  assert.equal(set.seed, V);
  assert.equal(set.voRef, V);
  assert.deepEqual(set.stale, [PREV, '1.51.4813-linear-detail-groups']);
});

test('a consistent set has no offenders', () => {
  assert.deepEqual(setOffenders(parseReleaseSet(fixture())), []);
});

test('NEGATIVE CONTROL — the #379 shape: seed + override ?v left behind → exactly those two', () => {
  const old = '1.51.4812-import-rewrap-siblings';
  const off = setOffenders(parseReleaseSet(fixture({ seed: old, voRef: old })));
  assert.equal(off.length, 2);
  assert.match(off[0], /boot seed .*1\.51\.4812/);
  assert.match(off[1], /antcv-version-override\.js\?v=1\.51\.4812/);
});

test('sw.js CACHE behind TARGET_VERSION is an offender', () => {
  const off = setOffenders(parseReleaseSet(fixture({ cache: PREV })));
  assert.equal(off.length, 1);
  assert.match(off[0], /sw\.js CACHE 'antcv-1\.51\.4832-edu-detail'/);
});

test('TARGET_VERSION listed in STALE_VERSIONS is an offender (self-match loop)', () => {
  const off = setOffenders(parseReleaseSet(fixture({ stale: [V, PREV] })));
  assert.equal(off.length, 1);
  assert.match(off[0], /STALE_VERSIONS/);
});

test('a label-only difference is still a mismatch (the ?v token must be byte-equal)', () => {
  const off = setOffenders(parseReleaseSet(fixture({ voRef: '1.51.4833-other-label' })));
  assert.equal(off.length, 1);
});

test('missing TARGET_VERSION is reported once, not as four mismatches', () => {
  const f = fixture();
  f.vo = '// nothing here';
  const off = setOffenders(parseReleaseSet(f));
  assert.deepEqual(off, ['antcv-version-override.js: TARGET_VERSION not found']);
});

// ── Part 2: the real tree ─────────────────────────────────────────────────
const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, 'pwa', rel), 'utf8');

test('REAL TREE — sw.js CACHE, TARGET_VERSION, boot seed and the override ?v are one version', () => {
  const set = parseReleaseSet({ html: read('index.html'), sw: read('sw.js'), vo: read('antcv-version-override.js') });
  assert.ok(set.target, 'TARGET_VERSION found');
  assert.deepEqual(setOffenders(set), [], `complete the cache-bust set at ${set.target}`);
});
