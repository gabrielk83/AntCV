// role-merge-stored.test.mjs
// ============================================================
// ROLE-MERGE-STORED-001 (register row 34): the same-company role merge is moved to
// STORED sections so the preview matches the export. The sidecar inserts the merged
// role + hides the constituents (on:false, eye-reversible), one-shot per app+JD,
// idempotent, unsolicited-untouched. It reuses the EXACT export merge via
// window.AntcvMergeSameCompanyRoles (stubbed here with the same grouping logic).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-role-merge-stored.js', import.meta.url), 'utf8');

// A stub of antcv-docx-client mergeSameCompanyRoles (same grouping semantics).
function stubMerge(roles) {
  if (!Array.isArray(roles)) return null;
  const groups = {}, order = [];
  roles.forEach((r) => { if (!r || r.on === false) return; const k = String(r.company || '').trim().toLowerCase(); if (!k) return; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(r); });
  if (!order.some((k) => groups[k].length >= 2)) return null;
  const emitted = {}, out = [];
  roles.forEach((r) => {
    if (!r || r.on === false) { out.push(r); return; }
    const k = String(r.company || '').trim().toLowerCase(); const grp = groups[k];
    if (!grp || grp.length < 2) { out.push(r); return; }
    if (emitted[k]) return; emitted[k] = true;
    const titles = []; grp.forEach((g) => { if (g.title && titles.indexOf(g.title) < 0) titles.push(g.title); });
    // MERGED-RESULTS-UNION (rule 17): mirror of the real merge's results union.
    const rs = []; grp.forEach((g) => { const t = String(g.results == null ? '' : g.results).trim(); if (t && rs.indexOf(t) < 0) rs.push(t); });
    const m = Object.assign({}, grp[0], { title: titles.join(' & ') });
    if (rs.length) m.results = rs.join(' ');
    out.push(m);
  });
  return out;
}

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const win = {
    addEventListener() {}, dispatchEvent() { return true; },
    AntcvMergeSameCompanyRoles: stubMerge,
  };
  const sandbox = {
    window: win,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout: () => 0, setInterval: () => 0,
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    console: { log() {} },
    JSON, Array, Object, String, Number, Boolean, Error, RegExp, Math,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: win.AntcvRoleMergeStored, store };
}

const INNOVIZ = [
  { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2020 - 2025', on: true, bullets: ['a'], results: 'R1' },
  { id: 'r2', title: 'System Architect', company: 'Innoviz', years: '2017 - 2020', on: true, bullets: ['b'], results: 'R2' },
  { id: 'r3', title: 'Product Expert', company: 'Kanzen', years: '2022 - 2026', on: true, bullets: ['c'], results: 'R3' },
];
const secs = (roles) => ({ cv: [{ id: 'experience', type: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, roles }], cl: [] });
const TARGETED = { meta: JSON.stringify({ company: 'Trackman A/S', role: 'PM' }), 'antcv:lastJdText': 'x'.repeat(60) };
const roles = (store) => JSON.parse(store.get('sections')).cv.find((s) => s.id === 'experience').roles;

test('merges two same-company roles: inserts merged, hides constituents', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  const rs = roles(store);
  const merged = rs.find((r) => r.__antcvStoredMergeRole);
  assert.ok(merged, 'a merged role is inserted');
  assert.equal(merged.title, 'Change Request Lead & System Architect', 'titles joined with " & "');
  assert.equal(merged.on, true);
  // both Innoviz constituents hidden
  const cons = rs.filter((r) => r.company === 'Innoviz' && !r.__antcvStoredMergeRole);
  assert.equal(cons.length, 2);
  assert.ok(cons.every((r) => r.on === false && r.__antcvStoredMergeHidden), 'constituents hidden, marked');
  // Kanzen (single role) untouched
  const kanzen = rs.find((r) => r.company === 'Kanzen');
  assert.equal(kanzen.on, true);
  assert.ok(!kanzen.__antcvStoredMergeHidden);
});

test('idempotent: a second apply does not re-merge (no doubling)', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  const after1 = store.get('sections');
  api._apply();
  const rs = roles(store);
  assert.equal(rs.filter((r) => r.__antcvStoredMergeRole).length, 1, 'still exactly one merged role');
});

test('unsolicited: never merges (full breadth kept)', () => {
  const { api, store } = load({ meta: JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }), 'antcv:lastJdText': 'x'.repeat(60), sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  const rs = roles(store);
  assert.ok(!rs.some((r) => r.__antcvStoredMergeRole), 'no merge for unsolicited');
  assert.ok(rs.every((r) => r.on !== false), 'all roles stay visible');
});

test('no JD in scope: no-op', () => {
  const { api, store } = load({ meta: JSON.stringify({ company: 'Trackman A/S', role: 'PM' }), sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  assert.ok(!roles(store).some((r) => r.__antcvStoredMergeRole), 'no JD -> no merge');
});

test('single role per company: no merge, stamp written', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs([INNOVIZ[0], INNOVIZ[2]])) });
  api._apply();
  const rs = roles(store);
  assert.ok(!rs.some((r) => r.__antcvStoredMergeRole));
  assert.ok(JSON.parse(store.get('sections'))._roleMergeStamp, 'stamp written even when nothing merged');
});

test('kill switch disables the merge', () => {
  const { api, store } = load({ ...TARGETED, 'antcv:disable-role-merge-stored': '1', sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  assert.ok(!roles(store).some((r) => r.__antcvStoredMergeRole));
});

test('re-arms on a restored pre-merge snapshot (stamp travels in the blob)', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  assert.ok(roles(store).some((r) => r.__antcvStoredMergeRole), 'merged first');
  // simulate a stale restore: pre-merge snapshot with NO blob stamp
  store.set('sections', JSON.stringify(secs(INNOVIZ)));
  api._apply();
  assert.ok(roles(store).some((r) => r.__antcvStoredMergeRole), 're-merged after restore');
});

// ── SECTIONS-STORM-2026-07-23 ───────────────────────────────────────────────

test('substructure stamp: an app.js-style {cv,cl} root rebuild does NOT re-arm the merge', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  const b = JSON.parse(store.get('sections'));
  assert.ok(b._roleMergeStamp, 'root stamp written');
  assert.ok(b.cv.find((s) => s.id === 'experience')._roleMergeStamp, 'section stamp written');
  // the storm shape: a writer rebuilds the blob root as {cv,cl}, dropping the root stamp
  store.set('sections', JSON.stringify({ cv: b.cv, cl: b.cl }));
  const before = store.get('sections');
  api._apply();
  assert.equal(store.get('sections'), before, 'section stamp holds — no rewrite, no re-merge');
  assert.equal(roles(store).filter((r) => r.__antcvStoredMergeRole).length, 1, 'no doubling');
});

test('merged role carries BOTH constituents\' results (rule 17 union)', () => {
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(secs(INNOVIZ)) });
  api._apply();
  const merged = roles(store).find((r) => r.__antcvStoredMergeRole);
  assert.equal(merged.results, 'R1 R2', 'both results, constituent order');
});

test('RESULTS-HEAL: a stored merged role with collapsed results is repaired from its hidden constituents', () => {
  // the live DTU Wind shape: merged role kept only grp[0].results after repeated re-merges
  const stored = secs([
    { id: 'r1__merged', title: 'Change Request Lead & System Architect', company: 'Innoviz', years: '2017 - 2025', on: true, bullets: ['a'], results: 'R1', __antcvStoredMergeRole: true },
    { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2020 - 2025', on: false, bullets: ['a'], results: 'R1', __antcvStoredMergeHidden: true },
    { id: 'r2', title: 'System Architect', company: 'Innoviz', years: '2017 - 2020', on: false, bullets: ['b'], results: 'R2', __antcvStoredMergeHidden: true },
    { id: 'r3', title: 'Product Expert', company: 'Kanzen', years: '2022 - 2026', on: true, bullets: ['c'], results: 'R3' },
  ]);
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(stored) });
  api._apply();
  const merged = roles(store).find((r) => r.__antcvStoredMergeRole);
  assert.equal(merged.results, 'R1 R2', 'collapsed results healed to the full union');
  assert.equal(roles(store).filter((r) => r.__antcvStoredMergeRole).length, 1, 'heal does not re-merge');
});

test('RESULTS-HEAL: an owner-edited results line is never clobbered', () => {
  const stored = secs([
    { id: 'r1__merged', title: 'Change Request Lead & System Architect', company: 'Innoviz', years: '2017 - 2025', on: true, bullets: ['a'], results: 'Owner wrote this line herself.', __antcvStoredMergeRole: true },
    { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2020 - 2025', on: false, bullets: ['a'], results: 'R1', __antcvStoredMergeHidden: true },
    { id: 'r2', title: 'System Architect', company: 'Innoviz', years: '2017 - 2020', on: false, bullets: ['b'], results: 'R2', __antcvStoredMergeHidden: true },
  ]);
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(stored) });
  api._apply();
  const merged = roles(store).find((r) => r.__antcvStoredMergeRole);
  assert.equal(merged.results, 'Owner wrote this line herself.', 'owner edit sticks');
});

test('RESULTS-HEAL: runs even when the blob is already stamped (repairs without re-merging)', () => {
  const stored = secs([
    { id: 'r1__merged', title: 'Change Request Lead & System Architect', company: 'Innoviz', years: '2017 - 2025', on: true, bullets: ['a'], results: '', __antcvStoredMergeRole: true },
    { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2020 - 2025', on: false, bullets: ['a'], results: 'R1', __antcvStoredMergeHidden: true },
    { id: 'r2', title: 'System Architect', company: 'Innoviz', years: '2017 - 2020', on: false, bullets: ['b'], results: 'R2', __antcvStoredMergeHidden: true },
  ]);
  const { api, store } = load({ ...TARGETED, sections: JSON.stringify(stored) });
  api._apply();                                     // stamps + heals
  const merged1 = roles(store).find((r) => r.__antcvStoredMergeRole);
  assert.equal(merged1.results, 'R1 R2', 'empty results healed');
  // collapse again (a stale writer) while the stamp is in place
  const b = JSON.parse(store.get('sections'));
  b.cv.find((s) => s.id === 'experience').roles.find((r) => r.__antcvStoredMergeRole).results = 'R2';
  store.set('sections', JSON.stringify(b));
  api._apply();
  const merged2 = roles(store).find((r) => r.__antcvStoredMergeRole);
  assert.equal(merged2.results, 'R1 R2', 'stamped blob still heals collapsed results');
});
