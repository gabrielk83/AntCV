// PTR-STALE-GUARD-001 (register row 39a residual, owner 2026-07-04) — the
// existing __foreignDevice check only protects a cold-restore from adopting
// ANOTHER device's active_application pointer. It explicitly treats a
// SAME-device pointer as always trustworthy, so a stale pointer (a race /
// lagging PUT / second same-device tab) that points at a DIFFERENT REAL
// application can still get adopted over a newer local draft, because the
// content-based drift guards (META-DRIFT-GUARD-001/002) only catch
// real -> empty/unsolicited, not real -> a different real company.
//
// antcv-pointer-stale-guard.js adds a pure isStalePointer(opts) reusing the
// 277-SEQUENCE-GUARD-001 pattern: compare the pointer's _pointer_updated_at
// against the local antcv:metaStamp timestamp for the CURRENT local identity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-pointer-stale-guard.js', import.meta.url), 'utf8');

function load(initialLocalStorage, jdScope) {
  const store = new Map(Object.entries(initialLocalStorage || {}));
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {} },
    JSON, Object, Array, String, Number, Boolean, RegExp, Math, Date, isFinite,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  sandbox.window = sandbox;
  if (jdScope) sandbox.window.AntcvJdScope = jdScope;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvPointerStaleGuard, store };
}

function metaStamp(company, role, ts) {
  return JSON.stringify({ key: `${company}|${role}`, ts });
}

test('same identity: never stale (nothing to guard)', () => {
  const ctx = load({});
  const result = ctx.api.isStalePointer({
    localCompany: 'NIL Technology', localRole: 'Nanooptics Prototyping Engineer',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerUpdatedAt: new Date(Date.now() - 3600_000).toISOString(),
  });
  assert.equal(result, false);
});

test('local unsolicited/empty: nothing local to protect', () => {
  const ctx = load({});
  assert.equal(ctx.api.isStalePointer({ localCompany: '', rowCompany: 'Trackman A/S' }), false);
  assert.equal(ctx.api.isStalePointer({ localCompany: 'Unsolicited', rowCompany: 'Trackman A/S' }), false);
});

test('no timestamp evidence: stays inert (backward-safe)', () => {
  const ctx = load({}); // no antcv:metaStamp at all
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerUpdatedAt: new Date(Date.now() - 3600_000).toISOString(),
  });
  assert.equal(result, false, 'no metaStamp for this identity -> no evidence -> inert');
});

test('same-device pointer older than the local identity change -> STALE', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, true, 'pointer set 2h ago predates a 1-minute-old local identity change');
});

test('unknown-device pointer (no _pointer_device_id) is treated as same-device and still guarded', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, true);
});

test('foreign-device pointer is NOT this guard\'s job -> returns false', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-B',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, false, 'a different device pointer is __foreignDevice\'s guard, not this one');
});

test('genuinely NEWER same-device pointer still adopts (not stale)', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 3600_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date().toISOString(),
  });
  assert.equal(result, false);
});

test('within clock-skew margin is NOT flagged stale', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now()),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date(Date.now() - 30_000).toISOString(), // 30s old, well within 3-min skew
  });
  assert.equal(result, false);
});

test('kill switch restores old (always-adopt) behaviour', () => {
  const ctx = load({
    'antcv:disable-ptr-stale-guard': '1',
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, false, 'kill switch disables the guard entirely');
});

test('stale metaStamp for a DIFFERENT identity than current local is ignored (no false evidence)', () => {
  // metaStamp recorded for a PRIOR identity — current local identity has no stamp yet.
  const ctx = load({
    'antcv:metaStamp': metaStamp('Old Company', 'Old Role', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'NIL Technology', rowRole: 'Nanooptics Prototyping Engineer',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, false, 'metaStamp key mismatch -> no evidence for THIS identity -> inert');
});

test('role-only mismatch (same company) is still guarded', () => {
  const ctx = load({
    'antcv:metaStamp': metaStamp('Trackman A/S', 'Project Manager, Hardware', Date.now() - 60_000),
  }, { deviceId: () => 'dev-A' });
  const result = ctx.api.isStalePointer({
    localCompany: 'Trackman A/S', localRole: 'Project Manager, Hardware',
    rowCompany: 'Trackman A/S', rowRole: 'Old Legacy Title',
    pointerDeviceId: 'dev-A',
    pointerUpdatedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  assert.equal(result, true);
});
