/* MISCLASSIFY-LANG-001 — classifyAdditional must route ADDITIONAL-INFO items to the
 * right sidebar bucket. Regression: an INTEREST whose VALUE mentions "Languages"
 * (e.g. {l:"Cultural exchange", v:"Languages, food culture and board games"}) used to
 * leak into the LANGUAGES section. Tests the REAL function extracted from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sections-normalize-415.js');
const src = readFileSync(SRC, 'utf8');

// Extract the classifyAdditional function body verbatim (balance braces from its `{`).
const start = src.indexOf('function classifyAdditional(');
assert.ok(start >= 0, 'classifyAdditional found in source');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const fnText = src.slice(start, end);
// eslint-disable-next-line no-new-func
const classify = new Function(fnText + '\nreturn classifyAdditional;')();

const cases = [
  [{ l: 'Cultural exchange', v: 'Languages, food culture and board games' }, 'Interests', 'interest value mentions Languages -> stays Interests'],
  [{ l: 'Languages', v: 'English (Native), Hebrew (Native), Spanish (Professional), Danish (B1)' }, 'Languages', 'aggregate Languages item'],
  [{ l: 'Spanish', v: 'Professional' }, 'Languages', 'bare language-name label'],
  [{ l: 'Danish', v: 'B1' }, 'Languages', 'language-name label + CEFR'],
  [{ l: 'Hearing impaired', v: 'cochlear implant and hearing aid' }, 'Accessibility', 'accessibility'],
  [{ l: 'Rugby & inclusive sport', v: 'Team operations, coach assist' }, 'Interests', 'interest label'],
  [{ l: 'Reading', v: 'Technology, society and systems thinking' }, 'Interests', 'reading interest'],
  [{ l: 'Tai-chi', v: 'Stability and calm under pressure' }, 'Interests', 'tai-chi interest'],
  [{ l: 'Supervision', v: 'Handling three feline strategic napping experts (cats)' }, 'Interests', 'feline fallback'],
  [{ l: 'Work permit', v: 'EU citizen, available immediately' }, 'Other', 'non-bucketed -> Other'],
];

for (const [item, want, desc] of cases) {
  test('classifyAdditional: ' + desc, () => {
    assert.equal(classify(item), want, JSON.stringify(item) + ' -> ' + want);
  });
}
