// balanced-compress-quality.test.mjs
// ============================================================
// BALANCED-COMPRESS-QUALITY-001 (owner 2026-07-05 "go with C"): balanced produced
// a 6-page CV. The post-gen `compress` tightening pass was (A) capped to 2 providers
// in balanced by the mechanical fail-fast rule, and (B) failed SILENTLY (kept the
// long content). Fix: (A) remove `compress` from the 2-provider cap regex so it
// keeps its full per-mode fan-width; (B) make the parse-failure loud. Both bundles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcSource = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const srcMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('A: compress is removed from the mechanical 2-provider cap regex (both bundles)', () => {
  assert.ok(srcSource.includes('/^(extract|extract_pdf|parse_jd|fix_orphans)$/'),
    'source cap regex must no longer include compress');
  assert.ok(!srcSource.includes('/^(extract|extract_pdf|parse_jd|compress|fix_orphans)$/'),
    'source must not still have the old compress-capped regex');
  assert.ok(srcMin.includes('/^(extract|extract_pdf|parse_jd|fix_orphans)$/'),
    'minified cap regex must no longer include compress');
  assert.ok(!srcMin.includes('/^(extract|extract_pdf|parse_jd|compress|fix_orphans)$/'),
    'minified must not still have the old compress-capped regex');
});

test('B: the tightening parse-failure is now loud, not silent (both bundles)', () => {
  assert.ok(/BALANCED-COMPRESS-QUALITY-001/.test(srcSource), 'source carries the loud-warn');
  assert.ok(srcMin.includes('[compress] tightening parse failed'), 'minified carries the loud-warn on the tightening skip');
  assert.ok(srcMin.includes('{task:"compress"}),t=dl(e);t||console.warn'),
    'minified warn is wired at the tightening parse site');
});
