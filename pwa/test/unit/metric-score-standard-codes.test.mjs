// metric-score-standard-codes.test.mjs
// ============================================================
// STD-CODE-NOT-METRIC-001 (owner 2026-06-19 QA item B): the Results numeric
// scorer counted the DIGITS in a compliance/standard code ("ISO 26262",
// "ISO/SAE 21434", "MIL-STD-810G", "STANAG 4694", "ISO 9001") as a metric, so a
// standard-compliance line won the numeric Results sort even though it is NOT a
// result. _metricScore must now strip standard codes + their digits before
// scoring, while leaving genuine result metrics fully scored.

import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
};

const { _metricScore } = await import('../../antcv-docx-client.js');

test('standard/compliance codes score 0 (their digits are ignored)', () => {
  for (const s of [
    'ISO 26262',
    'ISO/SAE 21434 functional-safety compliance',
    'ISO 9001 certified',
    'ISO/IEC 27001 aligned',
    'IEC 61508 SIL assessment',
    'EN 50128 rail software',
    'MIL-STD-810G environmental qualification',
    'MIL STD 810 testing',
    'STANAG 4694 interface',
    'SAE J3016 automation levels',
  ]) {
    assert.equal(_metricScore(s), 0, `standard code should not score: ${JSON.stringify(s)}`);
  }
});

test('genuine result metrics still score high', () => {
  // range reduction: 250 -> 10 = 25x
  assert.ok(_metricScore('Cut OEM change-request cycle from 250 to 10 days.') >= 25 - 1e-9);
  // 40% reduction with a reduce-verb: 100/(100-40) ≈ 1.667
  assert.ok(_metricScore('Reduced defects by 40%.') > 1.6);
  // a count still gets a small positive fallback score
  assert.ok(_metricScore('Covered 5 product domains.') > 0);
});

test('a standard code does NOT outrank a genuine result', () => {
  // Before the fix, "ISO 26262" (fallback log10 → 1.5) beat a 5-count (≈0.78).
  assert.ok(_metricScore('Covered 5 product domains.') > _metricScore('ISO 26262 audit passed.'));
});

test('a real metric in the SAME line as a standard code is still scored', () => {
  // Strip only the standard code; the genuine 250→10 metric survives.
  const s = 'Governed ISO 26262 processes; cut change cycle from 250 to 10 days.';
  assert.ok(_metricScore(s) >= 25 - 1e-9, 'real metric must survive the standard-code strip');
});

test('common words containing a marker substring are not stripped (no false positive)', () => {
  // "ENGINEERING"/"DINING"/"open" contain EN/DIN but have no following code digit,
  // so the percentage metric must still score.
  assert.ok(_metricScore('Engineering throughput up 30%.') > 0);
  assert.ok(_metricScore('Reduced onboarding from 20 to 5 days for the team.') >= 4 - 1e-9);
});
