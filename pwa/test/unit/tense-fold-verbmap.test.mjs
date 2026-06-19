/* tense-fold-verbmap.test.mjs — TENSE-VERBMAP-EXPAND-001 (owner 2026-06-19 item D)
 * The lamination tense fold (applyOutcomesMode + _tenseLead) re-tenses a laminated
 * Results leading verb to the user's chosen expTense. It was leaving common CV verbs
 * (Administered, Represented, Taught, Worked, Provisioned…) untouched because they
 * were absent from the verb map — so "all is in past" despite expTense='present'.
 * The expanded map must re-tense them, both present and past, for the SAME
 * applyOutcomesMode pass that feeds preview + export.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeStore(tense) {
  return {
    outcomesMode: JSON.stringify('results'),
    stylePackage: JSON.stringify('copenhagen-modern'),
    'antcv:lastJdText': '',
    styleConfig: JSON.stringify({ expTense: tense }),
    personalInfo: JSON.stringify({}),
  };
}
let store = makeStore('present');
globalThis.window = globalThis.window || {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: () => {}, removeItem: () => {},
};

const { applyOutcomesMode } = await import('../../antcv-docx-client.js');

function laminate(tense, results) {
  store = makeStore(tense);
  const roles = results.map((r, i) => ({ id: 'r' + i, title: 'Role ' + i, company: 'Co', on: true, results: r, bullets: ['A neutral bullet line.'] }));
  const secs = [
    { id: 'experience', type: 'experience', roles },
    { id: 'selected_outcomes', type: 'text_bullets', items: ['some outcome'] },
  ];
  return applyOutcomesMode(secs, 'cv').find((s) => s.type === 'experience').roles.map((r) => r.results);
}

test('present: previously-missing verbs now re-tense to present', () => {
  const out = laminate('present', [
    'Administered classified IT infrastructure for a technical unit.',
    'Represented students to faculty and administration.',
    'Taught semiconductor physics across 7 semesters.',
    'Worked with optical benches and metrology.',
    'Provisioned user accounts across 150 machines.',
    'Converted technical input into delivery scope.',
  ]);
  assert.match(out[0], /^Administer /);
  assert.match(out[1], /^Represent /);
  assert.match(out[2], /^Teach /);       // irregular taught -> teach
  assert.match(out[3], /^Work /);
  assert.match(out[4], /^Provision /);
  assert.match(out[5], /^Convert /);
});

test('present: already-mapped verbs still work', () => {
  const out = laminate('present', ['Owned change governance.', 'Delivered advisory engagements.', 'Directed a 7-person team.']);
  assert.match(out[0], /^Own /);
  assert.match(out[1], /^Deliver /);
  assert.match(out[2], /^Direct /);
});

test('past: base-form leading verbs re-tense to past', () => {
  const out = laminate('past', ['Administer the infrastructure.', 'Teach the course.', 'Win the contract.']);
  assert.match(out[0], /^Administered /);
  assert.match(out[1], /^Taught /);
  assert.match(out[2], /^Won /);
});

test("auto: no re-tense (leaves the stored tense)", () => {
  const out = laminate('auto', ['Administered the infrastructure.']);
  assert.equal(out[0], 'Administered the infrastructure.');
});
