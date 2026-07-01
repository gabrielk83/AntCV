/* CV-ACCESS-DROP-001 — repairAccessibilityFromPI must converge the standalone
 * ACCESSIBILITY section from personalInfo.accessibility on gen-2, even when the
 * section is ABSENT (gen routed accessibility into ADDITIONAL). Tests the REAL
 * function extracted verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sections-normalize-415.js');
const src = readFileSync(SRC, 'utf8');

// Brace-balance-extract repairAccessibilityFromPI verbatim from source.
const start = src.indexOf('function repairAccessibilityFromPI(');
assert.ok(start >= 0, 'repairAccessibilityFromPI found in source');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const fnText = src.slice(start, end);

// localStorage is the only free dependency — inject a stub keyed by personalInfo.
function makeRepair(piObj) {
  const localStorage = {
    getItem: (k) => (k === 'personalInfo' ? JSON.stringify(piObj || {}) : null),
  };
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', fnText + '\nreturn repairAccessibilityFromPI;')(localStorage);
}

const REAL_LINE = 'Hearing-impaired; please make requests in writing.';

test('ABSENT section + real PI line -> creates ACCESSIBILITY section at canonical position', () => {
  const repair = makeRepair({ accessibility: REAL_LINE });
  const cv = [
    { id: 'experience', title: 'EXPERIENCE', roles: [] },
    { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', type: 'labeled_list', items: [{ l: 'English', v: 'native' }] },
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', type: 'labeled_list', items: [{ l: 'Rugby', v: 'coach' }] },
  ];
  const out = repair(cv);
  assert.ok(Array.isArray(out), 'returns a new cv array (changed)');
  const acc = out.filter((s) => s && s.id === 'accessibility');
  assert.equal(acc.length, 1, 'exactly one accessibility section created');
  assert.equal(acc[0].type, 'text');
  assert.equal(acc[0].content, REAL_LINE);
  assert.equal(acc[0].loc, 'sidebar');
  assert.equal(acc[0].on, true);
  // canonical position: immediately AFTER the last of languages/interests
  const idxAcc = out.findIndex((s) => s.id === 'accessibility');
  const idxInt = out.findIndex((s) => s.id === 'interests');
  assert.equal(idxAcc, idxInt + 1, 'accessibility sits right after interests');
});

test('PLACEHOLDER section + real PI line -> repairs in place', () => {
  const repair = makeRepair({ accessibility: REAL_LINE });
  const cv = [
    { id: 'accessibility', title: 'ACCESSIBILITY', loc: 'sidebar', on: true, type: 'text', content: '[ACCESSIBILITY - optional...]' },
  ];
  const out = repair(cv);
  assert.ok(Array.isArray(out));
  assert.equal(out.filter((s) => s.id === 'accessibility').length, 1, 'no duplicate created');
  assert.equal(out[0].content, REAL_LINE);
});

test('EXISTING real section -> no-op (null)', () => {
  const repair = makeRepair({ accessibility: REAL_LINE });
  const cv = [{ id: 'accessibility', type: 'text', content: 'Already real.' }];
  assert.equal(repair(cv), null);
});

test('ABSENT section + EMPTY PI line -> no broken/empty section (null)', () => {
  const repair = makeRepair({ accessibility: '' });
  const cv = [{ id: 'experience', roles: [] }];
  assert.equal(repair(cv), null, 'no section created when PI has nothing real');
});

test('ABSENT section + PLACEHOLDER PI line -> no section (null)', () => {
  const repair = makeRepair({ accessibility: '[ACCESSIBILITY - optional...]' });
  const cv = [{ id: 'experience', roles: [] }];
  assert.equal(repair(cv), null);
});
