/* COPENHAGEN-TENSE-DEFAULT-001 (2026-06-22)
 * Copenhagen Modern / Scandinavian is ALWAYS present tense — a package property,
 * not a user setting. expTense 'auto'/'past' only take effect when switching to a
 * different package. Tested via applyOutcomesMode (which reads _expTenseMode).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
store.set('antcv:lastJdText', 'Photonic test engineer role at NVIDIA.');
store.set('outcomesMode', JSON.stringify('results'));
store.set('personalInfo', JSON.stringify({}));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { applyOutcomesMode } = await import('../../antcv-docx-client.js');

// Helper: build a minimal experience section with a pre-set results string.
function expSec(results) {
  return {
    id: 'experience', type: 'experience', on: true,
    roles: [{ id: 'r1', on: true, title: 'Engineer', company: 'NVIDIA',
               years: '2020-Present', bullets: ['Owned the test pipeline.'],
               results }],
  };
}

// applyOutcomesMode returns early if there is no SELECTED OUTCOMES section with
// items — provide a minimal one so the tense re-tensing path is exercised.
const OUTCOMES_SEC = {
  id: 'outcomes', type: 'bullets', on: true,
  items: [{ b: 'Built', t: 'a test pipeline at NVIDIA.' }],
};

// Run applyOutcomesMode with a given styleConfig + stylePackage.
function run(results, { expTense, pkg } = {}) {
  store.set('outcomesMode', JSON.stringify('results'));
  if (pkg !== undefined) store.set('stylePackage', JSON.stringify(pkg));
  else store.delete('stylePackage');
  if (expTense !== undefined) store.set('styleConfig', JSON.stringify({ expTense }));
  else store.delete('styleConfig');
  const sections = [OUTCOMES_SEC, expSec(results)];
  const out = applyOutcomesMode(sections, 'cv');
  const role = out.find(s => s.id === 'experience').roles[0];
  return { results: role.results, bullets: role.bullets };
}

const PAST = 'Owned the test pipeline and directed a 5-person team.';
const PRESENT = 'Own the test pipeline and direct a 5-person team.';

test('COPENHAGEN-TENSE-DEFAULT-001: Copenhagen + no explicit tense → re-tenses to present', () => {
  const r = run(PAST, { pkg: 'copenhagen-modern' });
  assert.equal(r.results, PRESENT, 'Results must be present-tensed');
});

test('COPENHAGEN-TENSE-DEFAULT-001: Scandinavian alias also defaults to present', () => {
  const r = run(PAST, { pkg: 'scandinavian' });
  assert.equal(r.results, PRESENT, 'Scandinavian alias must also default to present');
});

test('COPENHAGEN-TENSE-DEFAULT-001: empty/default package also defaults to present', () => {
  const r = run(PAST, { pkg: '' });
  assert.equal(r.results, PRESENT, 'Empty package (defaults to Copenhagen) must use present');
});

test('COPENHAGEN-TENSE-DEFAULT-001: Copenhagen overrides expTense=past — package wins', () => {
  // Copenhagen is ALWAYS present; setting expTense='past' does not override the package.
  // To use past tense the owner must switch to a non-Copenhagen package.
  const r = run(PAST, { pkg: 'copenhagen-modern', expTense: 'past' });
  assert.equal(r.results, PRESENT, 'Copenhagen always present — expTense=past does not override');
});

test('COPENHAGEN-TENSE-DEFAULT-001: expTense=auto on Copenhagen still present (package wins)', () => {
  const r = run(PAST, { pkg: 'copenhagen-modern', expTense: 'auto' });
  // Copenhagen is ALWAYS present; expTense='auto' does not override the package.
  assert.equal(r.results, PRESENT, 'Copenhagen + expTense=auto must still be present');
});

test('COPENHAGEN-TENSE-DEFAULT-001: non-Copenhagen package without explicit tense → auto (no re-tense)', () => {
  const r = run(PAST, { pkg: 'nordic-minimal' });
  assert.equal(r.results, PAST, 'Nordic-minimal with no explicit tense stays auto (no re-tense)');
});

test('COPENHAGEN-TENSE-DEFAULT-001: bullets are also re-tensed to present for Copenhagen', () => {
  const r = run(PAST, { pkg: 'copenhagen-modern' });
  // bullets: ['Owned the test pipeline.'] → should be re-tensed to present
  assert.ok(r.bullets[0].startsWith('Own '), 'Bullets must also be present-tensed: ' + r.bullets[0]);
});
