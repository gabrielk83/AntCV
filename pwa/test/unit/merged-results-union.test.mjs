// MERGED-RESULTS-UNION (spec rule 17 ">1 Result", SECTIONS-STORM-2026-07-23):
// the REAL export merge (antcv-docx-client mergeSameCompanyRoles, exposed as
// window.AntcvMergeSameCompanyRoles) must carry BOTH constituents' Results on
// the merged role. {...grp[0]} alone kept only the first role's line — the
// owner's "Results on one role only" report (DTU Wind, 1.51.3342).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

await import('../../antcv-docx-client.js');
const merge = globalThis.window.AntcvMergeSameCompanyRoles;

test('the export merge is exposed on window', () => {
  assert.equal(typeof merge, 'function');
});

test('merged role unions BOTH constituents\' results in constituent order', () => {
  const out = merge([
    { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2020 - 2025', on: true, bullets: ['a'], results: 'Cut open CCBs from 250 to 10.' },
    { id: 'r2', title: 'System Architect', company: 'Innoviz', years: '2017 - 2020', on: true, bullets: ['b'], results: 'Reduced LiDAR cost by 90%.' },
  ]);
  const m = out.find((r) => /&/.test(String(r.title)));
  assert.ok(m, 'merged role emitted');
  assert.equal(m.results, 'Cut open CCBs from 250 to 10. Reduced LiDAR cost by 90%.');
});

test('identical results de-dup; an empty constituent result contributes nothing', () => {
  const out = merge([
    { id: 'r1', title: 'EO Team Leader', company: 'Meprolight', years: '2013 - 2016', on: true, bullets: ['a'], results: 'Same line.' },
    { id: 'r2', title: 'R&D EO Engineer', company: 'Meprolight', years: '2011 - 2013', on: true, bullets: ['b'], results: 'Same line.' },
    { id: 'r3', title: 'Optics Engineer', company: 'Sirin', years: '2016 - 2017', on: true, bullets: ['c'], results: '' },
  ]);
  const m = out.find((r) => /&/.test(String(r.title)));
  assert.equal(m.results, 'Same line.', 'duplicate line carried once');
  const sirin = out.find((r) => r.company === 'Sirin');
  assert.equal(sirin.results, '', 'single role untouched');
});

test('only the second constituent has a result: the merged role still carries it', () => {
  const out = merge([
    { id: 'r1', title: 'Research Assistant', company: 'Tel Aviv University', years: '2011 - 2013', on: true, bullets: ['a'] },
    { id: 'r2', title: 'Teaching Assistant', company: 'Tel Aviv University', years: '2012 - 2014', on: true, bullets: ['b'], results: 'Set 20 exams for ~150 students.' },
  ]);
  const m = out.find((r) => /&/.test(String(r.title)));
  assert.equal(m.results, 'Set 20 exams for ~150 students.', 'grp[0] lacking a result no longer erases the union');
});
