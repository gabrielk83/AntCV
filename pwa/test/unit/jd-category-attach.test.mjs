// jd-category-attach.test.mjs
// ============================================================
// CLUSTER-QUAL-001-CATEGORY-001 (owner 2026-07-05): the auto-save call that
// persists an application to access-relay sent category:"targeted" for
// every real JD (a placeholder from CATEGORIZE-ON-ATTACH-001, 2026-06-19) —
// access-relay's normalizeCategory() coerces anything outside the 12 real
// category ids (+ "unsolicited") back to "unsolicited", so the client's
// value never actually reached D1 as a real classification. The whole
// category->cluster pipeline (register row 9 / CLUSTER-QUAL-001) had zero
// real data to work with as a result — confirmed live: a D1 query showed
// every application row's category as "unsolicited", with no diversity.
//
// Fix: prefer the JD-analysis result's OWN "category" field (now surfaced
// by jd-analysis.js's normalize(), sibling of "qualifications") when a
// fresh analysis is available; fall back to the old "targeted" placeholder
// only when no analysis has run yet for this JD. This is a source-level
// regression lock (both bundles carry equivalent minified/de-minified code,
// not directly executable in isolation without the whole app's closures).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSrc = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const appMin = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

test('the OLD hardcoded category:r?"unsolicited":"targeted" ternary no longer exists in either bundle', () => {
  assert.equal(appSrc.includes('category: r ? "unsolicited" : "targeted",'), false, 'app.src.js still has the old placeholder-only ternary');
  assert.equal(appMin.includes('category:r?"unsolicited":"targeted"'), false, 'app.js still has the old placeholder-only ternary');
});

test('app.src.js now derives category from the real analysis result when targeted', () => {
  assert.match(appSrc, /category:\s*r\s*\?\s*"unsolicited"\s*:\s*\(\(\)\s*=>\s*\{[\s\S]{0,300}?ra\.category/, 'must reference the rationale/analysis object\'s own category field');
  assert.match(appSrc, /cat \|\| "targeted"/, 'must still fall back to "targeted" when no real category is known yet');
});

test('app.js (minified) carries the equivalent logic', () => {
  assert.match(appMin, /category:r\?"unsolicited":\(\(\)=>\{[\s\S]{0,300}?ra\.category/, 'minified bundle must reference the analysis object\'s category field');
  assert.match(appMin, /cat\|\|"targeted"/, 'minified bundle must still fall back to "targeted"');
});

test('both bundles reference the same rationale-resolution pattern already used for a.rationale (void 0!==e.rationale)', () => {
  // Confirms the new code reuses the SAME "prefer this save's rationale, else
  // the last-known one" resolution the file already uses elsewhere, rather
  // than inventing a second, possibly-inconsistent source of truth.
  assert.match(appSrc, /void 0 !== e\.rationale \? e\.rationale : \w+/g);
  assert.match(appMin, /void 0!==e\.rationale\?e\.rationale:\w+/g);
});
