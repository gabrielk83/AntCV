// empty-role-hide.test.mjs
// ============================================================
// EMPTY-ROLE-HIDE-001: fully-empty skeleton roles (id r<digits>, no title/company/
// bullets/results) rendered as gray "[Role title], [Company]" placeholder rows in the
// preview. The sidecar hides them (on:false — hide-over-delete) on boot sweeps only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-empty-role-hide.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvEmptyRoleHide, store };
}
const secsWith = (roles) => ({ sections: JSON.stringify({ cv: [{ id: 'experience', type: 'experience', roles }], cl: [] }) });
const FULL = [
  { id: 'r1', title: 'Product Expert', company: 'Kanzen', bullets: ['real bullet'], on: true },
  { id: 'r2', title: 'Engineer', company: 'Sirin', bullets: ['another'], on: true },
];

test('hides fully-empty skeleton roles (the export-16 r8/r9/r10 case)', () => {
  const roles = FULL.concat([
    { id: 'r8', on: true, bullets: [], company: '' },
    { id: 'r9', on: true, bullets: [], company: '' },
    { id: 'r10', on: true, bullets: [], company: '' },
  ]);
  const { api, store } = load(secsWith(roles));
  api.run();
  const out = JSON.parse(store.get('sections')).cv[0].roles;
  assert.equal(out[2].on, false);
  assert.equal(out[3].on, false);
  assert.equal(out[4].on, false);
  assert.equal(out[0].on, true);   // content roles untouched
});

test('a role with ANY content (title, company, bullet, results, years, outcomes) is never hidden', () => {
  const roles = FULL.concat([
    { id: 'r8', on: true, bullets: [], company: 'Acme' },
    { id: 'r9', on: true, bullets: ['has a bullet'], company: '' },
    { id: 'r10', on: true, bullets: [], company: '', results: 'a result' },
    { id: 'r7', on: true, bullets: [], company: '', years: '2020' },
    { id: 'r6', on: true, bullets: [], company: '', outcomes: [{ title: 'x' }] },
  ]);
  const { api, store } = load(secsWith(roles));
  api.run();
  JSON.parse(store.get('sections')).cv[0].roles.forEach((r) => assert.notEqual(r.on, false));
});

test('a non-skeleton id (editor-created role) is never hidden even when empty', () => {
  const roles = FULL.concat([{ id: 'role-1719900000', on: true, bullets: [], company: '' }]);
  const { api, store } = load(secsWith(roles));
  api.run();
  assert.equal(JSON.parse(store.get('sections')).cv[0].roles[2].on, true);
});

test('sparse CV (fewer than 2 content roles) leaves placeholders for the wizard', () => {
  const roles = [FULL[0], { id: 'r8', on: true, bullets: [], company: '' }];
  const { api, store } = load(secsWith(roles));
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('kill-switch blocks the hide', () => {
  const s = secsWith(FULL.concat([{ id: 'r8', on: true, bullets: [], company: '' }]));
  s['antcv:disable-empty-role-hide'] = '1';
  const { api, store } = load(s);
  const before = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), before);
});

test('idempotent: second run writes nothing', () => {
  const { api, store } = load(secsWith(FULL.concat([{ id: 'r8', on: true, bullets: [], company: '' }])));
  api.run();
  const after1 = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), after1);
});
