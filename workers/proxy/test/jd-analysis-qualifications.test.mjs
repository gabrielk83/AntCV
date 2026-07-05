/* Unit test — CLUSTER-QUAL-001 stage 1: normalize() qualifications[] field.
 * No live LLM; exercises the normalizer's filtering, weight snapping, and caps.
 */
import assert from 'node:assert';
import { normalize } from '../src/jd-analysis.js';

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log('PASS ' + name); pass++; };

// 1. well-formed qualifications pass through with exact weights preserved
{
  const r = normalize({
    qualifications: [
      { text: 'Stakeholder management', weight: 1.0 },
      { text: 'PMP certification', weight: 0.5 },
      { text: 'Six Sigma', weight: 0.25 },
    ],
  });
  ok('3 qualifications kept', r.qualifications.length === 3);
  ok('required weight exact', r.qualifications[0].weight === 1.0);
  ok('preferred weight exact', r.qualifications[1].weight === 0.5);
  ok('nice-to-have weight exact', r.qualifications[2].weight === 0.25);
  ok('text preserved', r.qualifications[0].text === 'Stakeholder management');
}

// 2. missing qualifications entirely -> empty array, never throws
{
  const r = normalize({ summary: 'x' });
  ok('missing -> empty array', Array.isArray(r.qualifications) && r.qualifications.length === 0);
}

// 3. entries with no text (or non-string text) are dropped, not thrown
{
  const r = normalize({ qualifications: [{ text: '', weight: 1.0 }, { weight: 0.5 }, null, { text: 'Python', weight: 1.0 }] });
  ok('only the valid entry survives', r.qualifications.length === 1);
  ok('surviving entry is Python', r.qualifications[0].text === 'Python');
}

// 4. an off-grid weight snaps to the nearest of {1.0, 0.5, 0.25} via thresholds
{
  const r = normalize({
    qualifications: [
      { text: 'A', weight: 0.9 },   // >= 0.75 -> 1.0
      { text: 'B', weight: 0.6 },   // >= 0.375, < 0.75 -> 0.5
      { text: 'C', weight: 0.1 },   // < 0.375 -> 0.25
      { text: 'D' },                // missing weight (NaN) -> 0.25
    ],
  });
  ok('0.9 snaps to 1.0', r.qualifications[0].weight === 1.0);
  ok('0.6 snaps to 0.5', r.qualifications[1].weight === 0.5);
  ok('0.1 snaps to 0.25', r.qualifications[2].weight === 0.25);
  ok('missing weight snaps to 0.25', r.qualifications[3].weight === 0.25);
}

// 5. long text is capped to 200 chars (a runaway LLM value can't blow up storage)
{
  const long = 'x'.repeat(500);
  const r = normalize({ qualifications: [{ text: long, weight: 1.0 }] });
  ok('text capped to 200 chars', r.qualifications[0].text.length === 200);
}

// 6. more than 40 qualifications -> capped to 40 (matches other array-field caps in this file)
{
  const many = Array.from({ length: 60 }, (_, i) => ({ text: 'Skill ' + i, weight: 1.0 }));
  const r = normalize({ qualifications: many });
  ok('capped to 40', r.qualifications.length === 40);
}

console.log(`\nJD-ANALYSIS-QUALIFICATIONS OK (${pass} checks)`);
