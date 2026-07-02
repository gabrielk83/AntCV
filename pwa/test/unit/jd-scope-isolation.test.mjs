// JD-SCOPE-ISOLATION-001 — antcv-jd-scope.js namespaces the JD keys per current
// application id, tracked PER TAB, so two parallel sessions can't contaminate each
// other. Simulates two tabs sharing ONE localStorage backing (real cross-tab model)
// via separate vm contexts, each with its own window + sessionStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../../antcv-jd-scope.js', import.meta.url), 'utf8');

function mockStorage(backing) {
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
    key: (i) => { const ks = [...backing.keys()]; return i < ks.length ? ks[i] : null; },
    get length() { return backing.size; },
  };
}
// a "tab": its own window + sessionStorage, sharing the given localStorage backing.
function makeTab(sharedBacking) {
  const localStorage = mockStorage(sharedBacking);
  const sessionStorage = mockStorage(new Map());
  const win = { localStorage };
  const sandbox = { window: win, localStorage, sessionStorage, console, Object, String };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return win;
}

test('two tabs on different apps do NOT share JD state', () => {
  const backing = new Map();
  const tabA = makeTab(backing);
  const tabB = makeTab(backing);
  tabA.AntcvJdScope.setCurrentAppId('101');
  tabB.AntcvJdScope.setCurrentAppId('202');

  tabA.localStorage.setItem('antcv:lastJdText', 'JD for Kvadrat');
  // Tab B, on a different app, must NOT see tab A's JD through the same base key
  assert.equal(tabB.localStorage.getItem('antcv:lastJdText'), null, 'tab B is isolated');
  assert.equal(tabA.localStorage.getItem('antcv:lastJdText'), 'JD for Kvadrat', 'tab A reads its own');
  // physically stored under the namespaced key, not the global slot
  assert.equal(backing.get('antcv:app:101:jdText'), 'JD for Kvadrat');
  assert.equal(backing.has('antcv:lastJdText'), false, 'global slot never written');
});

test('two tabs on the SAME app DO share (cross-tab sync preserved)', () => {
  const backing = new Map();
  const tabA = makeTab(backing);
  const tabB = makeTab(backing);
  tabA.AntcvJdScope.setCurrentAppId('55');
  tabB.AntcvJdScope.setCurrentAppId('55');
  tabA.localStorage.setItem('antcv:applicationQuestions', '[{"q":"why us"}]');
  assert.equal(tabB.localStorage.getItem('antcv:applicationQuestions'), '[{"q":"why us"}]');
});

test('isMyJdKey matches only this tab\'s namespaced keys', () => {
  const backing = new Map();
  const tabA = makeTab(backing);
  tabA.AntcvJdScope.setCurrentAppId('101');
  assert.equal(tabA.AntcvJdScope.isMyJdKey('antcv:app:101:jdText'), true);
  assert.equal(tabA.AntcvJdScope.isMyJdKey('antcv:app:101:questions'), true);
  assert.equal(tabA.AntcvJdScope.isMyJdKey('antcv:app:202:jdText'), false, 'foreign app ignored');
  assert.equal(tabA.AntcvJdScope.isMyJdKey('antcv:lastJdText'), false, 'base name is not the real key');
  assert.equal(tabA.AntcvJdScope.isMyJdKey('personalInfo'), false);
  assert.equal(tabA.AntcvJdScope.isMyJdKey(null), false);
});

test('non-JD keys pass straight through, unnamespaced', () => {
  const backing = new Map();
  const tab = makeTab(backing);
  tab.AntcvJdScope.setCurrentAppId('101');
  tab.localStorage.setItem('personalInfo', '{"name":"x"}');
  tab.localStorage.setItem('sections', '[]');
  assert.equal(backing.get('personalInfo'), '{"name":"x"}');
  assert.equal(backing.get('sections'), '[]');
  assert.equal(tab.localStorage.getItem('personalInfo'), '{"name":"x"}');
});

test('all four JD keys are namespaced (incl. the questions fingerprint + company)', () => {
  const backing = new Map();
  const tab = makeTab(backing);
  tab.AntcvJdScope.setCurrentAppId('77');
  tab.localStorage.setItem('antcv:applicationQuestionsJd', 'fp');
  tab.localStorage.setItem('antcv:activeAppCompany', 'Kvadrat');
  assert.equal(backing.get('antcv:app:77:questionsJd'), 'fp');
  assert.equal(backing.get('antcv:app:77:company'), 'Kvadrat');
  tab.localStorage.removeItem('antcv:activeAppCompany');
  assert.equal(backing.has('antcv:app:77:company'), false, 'removeItem redirects too');
});

test('default app id is kernel; null/empty coerce to kernel', () => {
  const backing = new Map();
  const tab = makeTab(backing);
  assert.equal(tab.AntcvJdScope.getCurrentAppId(), 'kernel');
  tab.AntcvJdScope.setCurrentAppId('9');
  assert.equal(tab.AntcvJdScope.getCurrentAppId(), '9');
  tab.AntcvJdScope.setCurrentAppId(null);
  assert.equal(tab.AntcvJdScope.getCurrentAppId(), 'kernel');
});

test('Stage 2: deviceId is stable per install and stored under a NON-JD key', () => {
  const backing = new Map();
  const tab = makeTab(backing);
  const d1 = tab.AntcvJdScope.deviceId();
  const d2 = tab.AntcvJdScope.deviceId();
  assert.ok(d1 && d1.length > 3);
  assert.equal(d1, d2, 'stable across calls');
  assert.equal(backing.get('antcv:deviceId'), d1, 'persisted un-namespaced');
});

test('Stage 2: shouldAdoptCloudPointer — the cross-device "don\'t yank me" decision', () => {
  const backing = new Map();
  const S = makeTab(backing).AntcvJdScope;
  const A = S.shouldAdoptCloudPointer.bind(S);
  // no cloud app -> nothing to guard
  assert.equal(A({ cloudAppId: null }), true);
  // my own pointer -> adopt
  assert.equal(A({ cloudAppId: '5', cloudDeviceId: 'dev1', myDeviceId: 'dev1', myTabAppId: '9' }), true);
  // I'm on kernel (no specific app) -> adopt
  assert.equal(A({ cloudAppId: '5', cloudDeviceId: 'dev1', myDeviceId: 'dev2', myTabAppId: 'kernel' }), true);
  // same app -> adopt
  assert.equal(A({ cloudAppId: '5', cloudDeviceId: 'dev1', myDeviceId: 'dev2', myTabAppId: '5' }), true);
  // ANOTHER device switched the pointer to a DIFFERENT app while I'm editing mine -> KEEP mine
  assert.equal(A({ cloudAppId: '5', cloudDeviceId: 'dev1', myDeviceId: 'dev2', myTabAppId: '9' }), false);
  // null/empty tab app id coerces to kernel -> adopt
  assert.equal(A({ cloudAppId: '5', cloudDeviceId: 'dev1', myDeviceId: 'dev2', myTabAppId: null }), true);
});

test('one-time migration copies a pre-existing global JD into the current app slot', () => {
  const backing = new Map();
  backing.set('antcv:lastJdText', 'in-flight JD');   // legacy global present before load
  const tab = makeTab(backing);                       // installs at default app 'kernel'
  assert.equal(backing.get('antcv:app:kernel:jdText'), 'in-flight JD', 'migrated to namespaced slot');
  assert.equal(backing.get('antcv:jdScopeMigrated'), '1');
  // idempotent: a second tab does not re-migrate / clobber
  backing.set('antcv:app:kernel:jdText', 'edited');
  makeTab(backing);
  assert.equal(backing.get('antcv:app:kernel:jdText'), 'edited');
});

// ── JD-SCOPE-OCC2-GUARD-001 (register row 19, owner 2026-07-03): BOTH cloud
// restore paths must carry the foreign-device guard — occ-1 (cold-start) shipped
// with Stage 2; occ-2 (read-from-cloud / manual-save sentinel path) was open. ──
test('both restore paths carry the foreign-device guard in BOTH bundles', () => {
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  const count = (h, n) => h.split(n).length - 1;
  // occ-1 (src __foreignDevice / app __antcvFd) + occ-2 (src __foreignDevice2 / app __antcvFd2)
  assert.equal(count(src, '_pointer_device_id') >= 2, true, 'src: both restore blocks read the pointer stamp');
  assert.equal(count(app, '_pointer_device_id') >= 2, true, 'app.js: both restore blocks read the pointer stamp');
  assert.equal(count(src, 'JD-SCOPE-OCC2-GUARD-001'), 1, 'src occ-2 guard marker');
  assert.equal(count(src, 'Vt(__foreignDevice2 ? "" : e.jd_text)'), 1, 'src occ-2 Vt guarded');
  assert.equal(count(src, '(__isUnsolicited || __foreignDevice2 || t || n)'), 1, 'src occ-2 mirror guarded');
  assert.equal(count(app, 'cn(__antcvFd2?"":e.jd_text)'), 1, 'app.js occ-2 Vt guarded');
  assert.equal(count(app, '"antcv:lastJdText",o||__antcvFd2||r||a?'), 1, 'app.js occ-2 mirror guarded');
});
