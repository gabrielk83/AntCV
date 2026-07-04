// roles-active-floor.test.mjs
// ============================================================
// ROLES-ACTIVE-FLOOR-001 (owner 2026-07-05): a targeted gen left EVERY experience
// role on:false (0 active). A CV must never have 0 active roles. The floor restores
// the real roles (keeping merge-hidden ones off), only when 0 are active, never
// touching a CV that already has active roles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-roles-active-floor.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; }, performance: { now: () => 0 } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout: () => 0,
    performance: { now: () => 0 },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    console: { log() {} },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvRolesActiveFloor, store };
}

const exp = (roles) => ({ cv: [{ id: 'experience', type: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, roles }], cl: [] });
const roles = (store) => JSON.parse(store.get('sections')).cv.find((s) => s.id === 'experience').roles;

test('0 active roles -> the non-merge-hidden roles are restored to on:true', () => {
  const { api, store } = load({ sections: JSON.stringify(exp([
    { id: 'r1', title: 'Product / Project Expert', on: false },
    { id: 'r2', title: 'Change Request Lead', on: false },
    { id: 'r3', title: 'Change Request Lead & System Architect', on: false, __antcvMergeHidden: true },
    { id: 'r4', title: 'System Architect', on: false },
  ])) });
  api.run();
  const rs = roles(store);
  assert.equal(rs.find((r) => r.id === 'r1').on, true);
  assert.equal(rs.find((r) => r.id === 'r2').on, true);
  assert.equal(rs.find((r) => r.id === 'r4').on, true);
  assert.equal(rs.find((r) => r.id === 'r3').on, false, 'the merge-hidden role stays hidden');
});

test('a CV that already has >=1 active role is left untouched', () => {
  const before = exp([{ id: 'r1', title: 'A', on: true }, { id: 'r2', title: 'B', on: false }]);
  const { api, store } = load({ sections: JSON.stringify(before) });
  api.run();
  const rs = roles(store);
  assert.equal(rs.find((r) => r.id === 'r2').on, false, 'a deliberately-hidden role is NOT turned on when others are active');
});

test('if every role is merge-hidden, turn them all on rather than leave 0 active', () => {
  const { api, store } = load({ sections: JSON.stringify(exp([
    { id: 'r1', title: 'X & Y', on: false, __antcvMergeHidden: true },
    { id: 'r2', title: 'P & Q', on: false, __antcvMergeHidden: true },
  ])) });
  api.run();
  assert.ok(roles(store).every((r) => r.on === true), 'never leave the CV with no experience');
});

test('roles without an explicit on:false (default-active) are not counted as 0', () => {
  const before = exp([{ id: 'r1', title: 'A' }, { id: 'r2', title: 'B' }]); // no on field -> active
  const { api, store } = load({ sections: JSON.stringify(before) });
  const snap = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), snap, 'default-active roles -> floor is inert');
});

test('kill switch disables the floor', () => {
  const { api, store } = load({ sections: JSON.stringify(exp([{ id: 'r1', title: 'A', on: false }])), 'antcv:disable-roles-active-floor': '1' });
  const snap = store.get('sections');
  api.run();
  assert.equal(store.get('sections'), snap);
});

test('pure helper: isActive treats on:false as inactive, everything else active', () => {
  const { api } = load({});
  assert.equal(api._isActive({ on: false }), false);
  assert.equal(api._isActive({ on: true }), true);
  assert.equal(api._isActive({}), true);
});
