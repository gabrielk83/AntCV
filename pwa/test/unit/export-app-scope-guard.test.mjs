// EXPORT-APP-SCOPE-GUARD (register row 53, CROSS-APP-EXPORT-CONTAMINATION-001 leg a).
// The guard wraps window.exportDocxViaWorker and reconciles the filename/header company
// to the authoritative active application, or blocks a two-real-company cross-app pair.
// Loads antcv-export-app-scope-guard.js in a vm sandbox with a mock window and drives it
// end-to-end (both the pure decision core AND the installed window wrap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-export-app-scope-guard.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
  };
}

// Build a sandbox "page": mock window with localStorage, AntcvJdScope, confirm; run SRC.
// The real export fn is installed AFTER SRC (mirrors index.html assigning
// window.exportDocxViaWorker after the module import) via the defineProperty setter.
function makePage({ authCompany = '', appId = '', kill = false, confirmReturns = false } = {}) {
  const backing = new Map();
  if (kill) backing.set('antcv:disable-export-scope-guard', '1');
  const calls = [];
  const win = {
    localStorage: mockStorage(backing),
    AntcvJdScope: {
      getCurrentAppId: () => appId,
      getCompany: () => authCompany,
    },
    confirm: () => confirmReturns,
    console: { warn() {}, error() {}, log() {} },
  };
  const sandbox = { window: win, console: win.console, Object, Array, String, Promise, RegExp };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  // now assign the "real" export fn (captured by the interceptor's setter)
  win.exportDocxViaWorker = function realExport(args) {
    calls.push(args);
    return Promise.resolve({ ok: true });
  };
  return { win, calls, api: win.__antcvExportScopeGuard };
}

// ---------- pure decision core ----------

test('decide: match -> pass through', () => {
  const { api } = makePage({ authCompany: 'KOMBIT', appId: '550' });
  const d = api.decideExportScope({ meta: { company: 'KOMBIT A/S' } }, { authCompany: 'KOMBIT', appId: '550' });
  assert.equal(d.action, 'pass');
});

test('decide: meta reverted to Unsolicited, active is real -> reconcile forward', () => {
  const { api } = makePage();
  const d = api.decideExportScope({ meta: { company: 'Unsolicited' } }, { authCompany: 'Nordea', appId: '77' });
  assert.equal(d.action, 'reconcile');
  assert.equal(d.patch.company, 'Nordea');
});

test('decide: meta real, active still Unsolicited -> pass (meta is the real draft)', () => {
  const { api } = makePage();
  const d = api.decideExportScope({ meta: { company: 'Nordea' } }, { authCompany: 'Unsolicited', appId: '77' });
  assert.equal(d.action, 'pass');
});

test('decide: two DIFFERENT real companies -> block', () => {
  const { api } = makePage();
  const d = api.decideExportScope({ meta: { company: 'Trackman A/S' } }, { authCompany: 'KOMBIT', appId: '550' });
  assert.equal(d.action, 'block');
  assert.equal(d.metaCompany, 'Trackman A/S');
  assert.equal(d.authCompany, 'KOMBIT');
});

test('decide: no authoritative identity (kernel) -> pass', () => {
  const { api } = makePage();
  const d = api.decideExportScope({ meta: { company: 'Trackman' } }, { authCompany: '', appId: 'kernel' });
  assert.equal(d.action, 'pass');
});

test('decide: template export -> pass', () => {
  const { api } = makePage();
  const d = api.decideExportScope({ meta: { company: 'Trackman' }, filename: 'CV Template' },
    { authCompany: 'KOMBIT', appId: '550', isTemplate: true });
  assert.equal(d.action, 'pass');
});

// ---------- installed window wrap (end-to-end) ----------

test('CONTAMINATED pair (cv/filename/brand=Trackman, active app=KOMBIT) is BLOCKED', async () => {
  const { win, calls } = makePage({ authCompany: 'KOMBIT', appId: '550', confirmReturns: false });
  const res = await win.exportDocxViaWorker({
    sections: { cv: [{ co: 'Trackman' }], cl: [{ co: 'KOMBIT' }] },
    meta: { company: 'Trackman A/S', role: 'Projektleder, Hardware' },
    doc: 'cl',
    styleConfig: { brand: 'trackman-orange' },
    filename: 'CoverLetter_Trackman',
  });
  assert.equal(calls.length, 0, 'real export must NOT run for a blocked cross-app pair');
  assert.equal(res.blockedByScopeGuard, true);
});

test('BLOCK is overridable — confirm=OK proceeds with the real export', async () => {
  const { win, calls } = makePage({ authCompany: 'KOMBIT', appId: '550', confirmReturns: true });
  await win.exportDocxViaWorker({ meta: { company: 'Trackman A/S' }, doc: 'cl' });
  assert.equal(calls.length, 1, 'explicit OK lets the export through');
});

test('AGREEING pair passes through unchanged (inert)', async () => {
  const { win, calls } = makePage({ authCompany: 'KOMBIT', appId: '550' });
  const args = { meta: { company: 'KOMBIT', role: 'AI-udvikler' }, doc: 'cv', filename: 'CV_KOMBIT' };
  await win.exportDocxViaWorker(args);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].meta.company, 'KOMBIT', 'company untouched');
  assert.equal(calls[0].filename, 'CV_KOMBIT', 'filename untouched when everything agrees');
});

test('RECONCILE forward: meta=Unsolicited, active=Nordea -> company fixed + filename dropped', async () => {
  const { win, calls } = makePage({ authCompany: 'Nordea', appId: '77' });
  await win.exportDocxViaWorker({ meta: { company: 'Unsolicited', role: 'Analytics Engineer' }, doc: 'cv', filename: 'CV_Unsolicited' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].meta.company, 'Nordea', 'company reconciled to active app');
  assert.equal(calls[0].filename, undefined, 'stale filename dropped so it recomputes from reconciled meta');
});

test('kill-switch makes the guard fully inert (contaminated pair passes through)', async () => {
  const { win, calls } = makePage({ authCompany: 'KOMBIT', appId: '550', kill: true });
  await win.exportDocxViaWorker({ meta: { company: 'Trackman A/S' }, doc: 'cl' });
  assert.equal(calls.length, 1, 'kill-switch bypasses the guard entirely');
  assert.equal(calls[0].meta.company, 'Trackman A/S', 'no reconcile when disabled');
});
