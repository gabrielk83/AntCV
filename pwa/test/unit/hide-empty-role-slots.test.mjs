/* EXPERIENCE-EMPTY-SLOT-HIDE-001 — hideEmptyRoleSlots must set on:false on fully-empty
 * experience slots (empty title + company + no bullets/outcomes) so "[Role title]" rows
 * never render, while never touching a role with any real content. Tests the REAL function
 * extracted verbatim from source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-sections-normalize-415.js');
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('function hideEmptyRoleSlots(');
assert.ok(start >= 0, 'hideEmptyRoleSlots found in source');
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
const fnText = src.slice(start, end);
// only free dependency is console
const hide = new Function('console', fnText + '\nreturn hideEmptyRoleSlots;')({ log() {} });

const realRole = () => ({ title: 'System Architect', company: 'Innoviz', on: true, bullets: ['Directed design reviews'] });
const emptySlot = () => ({ title: '[Role title]', company: '', on: true, bullets: [] });

test('hides fully-empty slots, keeps real roles', () => {
  const cv = [{ id: 'experience', type: 'experience', roles: [realRole(), emptySlot(), emptySlot(), realRole()] }];
  const out = hide(cv);
  assert.ok(Array.isArray(out), 'returns a changed cv');
  const roles = out[0].roles;
  assert.equal(roles[0].on, true, 'real role stays on');
  assert.equal(roles[1].on, false, 'empty slot hidden');
  assert.equal(roles[2].on, false, 'empty slot hidden');
  assert.equal(roles[3].on, true, 'real role stays on');
});

test('a role with a real bullet but empty title/company is NOT hidden', () => {
  const cv = [{ id: 'experience', type: 'experience', roles: [{ title: '', company: '', on: true, bullets: ['Ran the migration end to end'] }] }];
  assert.equal(hide(cv), null, 'no change — real bullet present');
});

test('a role with a real outcome but empty title/company is NOT hidden', () => {
  const cv = [{ id: 'experience', type: 'experience', roles: [{ title: '[Role title]', company: '', on: true, bullets: [], outcomes: [{ result: 'Cut cycle time 30%' }] }] }];
  assert.equal(hide(cv), null, 'no change — real outcome present');
});

test('no-op when there are no empty slots', () => {
  const cv = [{ id: 'experience', type: 'experience', roles: [realRole(), realRole()] }];
  assert.equal(hide(cv), null);
});

test('already-hidden empty slot is left as-is (idempotent)', () => {
  const cv = [{ id: 'experience', type: 'experience', roles: [realRole(), { title: '[Role title]', company: '', on: false, bullets: [] }] }];
  assert.equal(hide(cv), null, 'no change — already on:false');
});
