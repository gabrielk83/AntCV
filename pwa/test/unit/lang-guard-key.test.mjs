// lang-guard-key.test.mjs
// ============================================================
// LANG-GUARD-KEY-001 (owner 2026-07-22 "every generation starts in Chinese"):
// the three loss-guards (outcomes, CL prose, core competencies) cache the last
// real generated content keyed by application (company|role) and re-inject it
// during a later generation's skeleton window to prevent loss. They were
// LANGUAGE-BLIND, so a Chinese generation's cache was re-injected into a later
// ENGLISH generation — "starts in Chinese, then switches to English". The fix
// appends the current output language to the cache key, so a generation only
// ever restores from a SAME-LANGUAGE snapshot and a stale zh cache (keyed
// without a lang suffix) can never poison an en gen.
//
// Source-level regression lock: every guard must derive the language and fold it
// into appKey().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARDS = [
  'antcv-outcomes-loss-guard.js',
  'antcv-cl-prose-loss-guard-985.js',
  'antcv-corecomp-loss-guard.js',
];

for (const g of GUARDS) {
  const src = readFileSync(join(PWA, g), 'utf8');

  test(`${g}: carries the LANG-GUARD-KEY-001 fix`, () => {
    assert.ok(src.includes('LANG-GUARD-KEY-001'), 'fix marker present');
  });

  test(`${g}: reads the current output language`, () => {
    assert.match(src, /localStorage\.getItem\('language'\)/, 'must read the language key');
    assert.match(src, /function curLang\(/, 'a curLang() helper must exist');
  });

  test(`${g}: appKey folds the language into the cache key`, () => {
    // The app key must include the language dimension so cross-language caches
    // never collide.
    assert.match(src, /function appKey\(\)\s*\{[\s\S]*?\+\s*'\|'\s*\+\s*lang/, 'appKey must append |lang');
  });

  test(`${g}: the OLD language-blind key form is gone`, () => {
    // The exact old return (company|role with no lang) must no longer be present.
    assert.ok(
      !src.includes("(m.role || '')).slice(0, 200)"),
      'the old company|role-only key (no language) must be replaced',
    );
  });
}
