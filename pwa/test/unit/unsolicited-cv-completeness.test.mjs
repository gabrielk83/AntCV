// unsolicited-cv-completeness.test.mjs
// ============================================================
// UNSOLICITED-CV-COMPLETENESS-001 (owner 2026-06-23): for a FULLY unsolicited app
// (no JD/position AND no target company) the CV must show ALL roles (on:true) and
// merged titles must read content-first / level-after. Gated to fully-unsolicited.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-unsolicited-cv-completeness.js', import.meta.url), 'utf8');

function load({ jd = '', company = 'Unsolicited', sections = { cv: [], cl: [] } } = {}) {
  const store = new Map(Object.entries({
    sections: JSON.stringify(sections),
    meta: JSON.stringify({ company }),
    ...(jd ? { 'antcv:lastJdText': jd } : {}),
  }));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, requestAnimationFrame: (fn) => { fn(); return 1; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvUnsolicitedCvCompleteness, store };
}
test('reorderTitle: level/function -> function/level, dedup repeated domain (owner case)', () => {
  const { api } = load();
  assert.equal(
    api._reorderTitle('Electro-Optics Team Leader / R&D Electro-Optics Engineer'),
    'R&D Electro-Optics Engineer / Team Leader'
  );
});

test('reorderTitle: already content-first is untouched', () => {
  const { api } = load();
  assert.equal(api._reorderTitle('R&D Electro-Optics Engineer / Team Leader'), 'R&D Electro-Optics Engineer / Team Leader');
});

test('reorderTitle: ambiguous "Lead" (not Team Leader) is NOT reordered', () => {
  const { api } = load();
  assert.equal(api._reorderTitle('Change Request Lead / System Architect'), 'Change Request Lead / System Architect');
});

test('reorderTitle: single-part / non-merged titles untouched', () => {
  const { api } = load();
  assert.equal(api._reorderTitle('Senior Optics & Electro-Optics Engineer'), 'Senior Optics & Electro-Optics Engineer');
  assert.equal(api._reorderTitle('Security Guard, Student Dormitories'), 'Security Guard, Student Dormitories');
});

test('fully-unsolicited: un-hides ALL roles and reorders merged title', () => {
  const sections = { cv: [{ id: 'experience', type: 'experience', roles: [
    { id: 'a', title: 'Product / Project Expert', on: true },
    { id: 'b', title: 'Electro-Optics Team Leader / R&D Electro-Optics Engineer', on: true },
    { id: 'c', title: 'Security Guard', on: false },
    { id: 'd', title: 'Students Council Representative', on: false },
  ] }], cl: [] };
  const { api, store } = load({ company: 'Unsolicited', sections });
  api._apply();
  const roles = JSON.parse(store.get('sections')).cv[0].roles;
  assert.deepEqual(roles.map(r => r.on), [true, true, true, true], 'all roles visible');
  assert.equal(roles[1].title, 'R&D Electro-Optics Engineer / Team Leader');
});

test('NOT fully-unsolicited (JD present): leaves hidden roles + titles alone', () => {
  const sections = { cv: [{ id: 'experience', type: 'experience', roles: [
    { id: 'c', title: 'Security Guard', on: false },
    { id: 'b', title: 'Electro-Optics Team Leader / R&D Electro-Optics Engineer', on: true },
  ] }], cl: [] };
  const { api, store } = load({ jd: 'JOB DESCRIPTION: a real role at a real company, well over thirty chars.', company: 'NVIDIA', sections });
  api._apply();
  const roles = JSON.parse(store.get('sections')).cv[0].roles;
  assert.equal(roles[0].on, false, 'JD-targeted: hidden role stays hidden');
  assert.equal(roles[1].title, 'Electro-Optics Team Leader / R&D Electro-Optics Engineer', 'JD-targeted: title untouched');
});

test('NOT fully-unsolicited (company set, no JD): also skips', () => {
  const { api } = load({ company: 'Demant' });
  assert.equal(api._fullyUnsolicited(), false);
});

test('idempotent', () => {
  const sections = { cv: [{ id: 'experience', type: 'experience', roles: [
    { id: 'b', title: 'Electro-Optics Team Leader / R&D Electro-Optics Engineer', on: false },
  ] }], cl: [] };
  const a = load({ sections });
  a.api._apply();
  const once = a.store.get('sections');
  const b = load({ sections: JSON.parse(once) });
  b.api._apply();
  assert.deepEqual(JSON.parse(b.store.get('sections')), JSON.parse(once));
});
