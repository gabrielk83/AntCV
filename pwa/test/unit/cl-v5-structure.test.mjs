// cl-v5-structure.test.mjs
// ============================================================
// CL-V5-STRUCT-001 (owner 2026-07-21) — the v5 cover-letter sequence.
//   greeting -> opening -> why -> role_view -> bring -> contribute -> who -> closure
// "How I see the role" (role_view) is NEW; "Who I am" MOVED to the end and carries
// Professional summary / How I operate / Eligibility / My goal; foundation is folded in.
// Structural-separation rule: employer NEED (role_view) / candidate EVIDENCE (bring) /
// proposed APPROACH (contribute) are never fused.
//
// Asserts on the shipped files (src + minified mirror) and executes the sidecar's
// reorder/migrate/bullet logic against a synthetic pre-v5 CL.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const here = (p) => new URL(p, import.meta.url);
const src = await readFile(here('../../app.src.js'), 'utf8');
const app = await readFile(here('../../app.js'), 'utf8');
const sidecar = await readFile(here('../../antcv-nordic-cl-order-971.js'), 'utf8');

// ---------------------------------------------------------------- prompt + apply path

test('the v5 sequence rule ships in BOTH app.src.js and app.js', () => {
  for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
    assert.ok(s.includes('COVER-LETTER SEQUENCE v5 (CL-V5-STRUCT-001)'), name + ': rule present');
    assert.ok(s.includes('STRUCTURAL SEPARATION RULE'), name + ': separation rule present');
    assert.ok(s.includes("How I see the role:' (role_view_intro + role_view_rows)"), name + ': names the new fields');
  }
});

test('the new cl_overrides fields are in the output schema in BOTH files', () => {
  for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
    for (const f of ['"role_view_intro"', '"role_view_rows"', '"who_lead"', '"who_summary"', '"who_operate"', '"who_eligibility"', '"who_goal"']) {
      assert.ok(s.includes(f), name + ': schema declares ' + f);
    }
  }
});

test('the apply path has a role_view branch and a rich_block who branch in BOTH files', () => {
  for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
    assert.ok(s.includes('"role_view"===e.id'), name + ': role_view branch');
    assert.ok(s.includes('row("Professional summary"'), name + ': who Professional summary row');
    assert.ok(s.includes('row("Eligibility"'), name + ': who Eligibility row');
    assert.ok(s.includes('row("My goal"'), name + ': who My goal row');
    // the section is injected when a SAVED pre-v5 application has no role_view
    assert.ok(s.includes('x.id==="role_view"'), name + ': ensure-helper present');
  }
});

test('the CL completeness gate credits the v5 fields (a v5 response is not scored partial)', () => {
  for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
    assert.ok(/t\(e\.who_content\)\s*\|\|\s*t\(e\.who_lead\)/.test(s), name + ': who_lead counts');
    assert.ok(s.includes('e.role_view_rows'), name + ': role_view_rows counts');
    assert.ok(/t\(e\.who_operate\)/.test(s), name + ': who_operate counts');
  }
});

// ------------------------------------------------------------------------- the sidecar

function loadSidecar(store) {
  const listeners = {};
  const sandbox = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    setTimeout: () => 0,
    CustomEvent: class { constructor(t, d) { this.type = t; Object.assign(this, d); } },
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
  sandbox.window.dispatchEvent = () => true;
  vm.createContext(sandbox);
  vm.runInContext(sidecar, sandbox);
  return sandbox.window.AntcvNordicClOrder;
}

const preV5 = () => ([
  { id: 'greeting', type: 'text', content: 'Dear x,' },
  { id: 'opening', type: 'rich_block', items: [{ b: '', t: 'o' }] },
  { id: 'why', type: 'rich_block', items: [{ b: 'Why this position', t: 'w' }] },
  { id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'me' }] },
  { id: 'foundation', type: 'rich_block', items: [{ b: 'Foundation', t: 'f' }] },
  { id: 'bring', type: 'rich_block', items: [{ b: 'What I bring', t: 'b' }, { b: 'N', t: 'a' }] },
  { id: 'contribute', type: 'rich_block', items: [{ b: 'How I would contribute', t: 'c' }, { b: '', t: 'x', mk: true }] },
  { id: 'closure', type: 'text', content: 'bye' },
]);

test('ORDER is the v5 sequence, with legacy foundation parked at the tail', () => {
  const api = loadSidecar({});
  // cross-realm arrays (vm sandbox) fail deepStrictEqual on prototype identity — compare as text
  assert.equal([...api.ORDER].join('|'), 'greeting|opening|why|role_view|bring|contribute|who|foundation|closure');
});

test('reorder() moves who AFTER contribute and puts role_view straight after why', () => {
  const api = loadSidecar({});
  const migrated = api.migrateV5(preV5());
  assert.equal(migrated.changed, true, 'role_view injected into a pre-v5 CL');
  const ids = api.reorder(migrated.list).list.map((s) => s.id);
  assert.equal(ids.join('|'), 'greeting|opening|why|role_view|bring|contribute|who|foundation|closure');
});

test('migrateV5 is one-shot: a user who removes role_view does not get it back', () => {
  const store = {};
  const api = loadSidecar(store);
  assert.equal(api.migrateV5(preV5()).changed, true);
  assert.equal(store['antcv:cl-v5-role-view-migrated'], '1');
  assert.equal(api.migrateV5(preV5()).changed, false, 'second pass is inert');
});

test('migrateV5 is idempotent when role_view already exists, and inert on a foreign doc', () => {
  const api = loadSidecar({});
  const withRv = preV5().concat([{ id: 'role_view', type: 'rich_block', items: [] }]);
  assert.equal(api.migrateV5(withRv).changed, false);
  const api2 = loadSidecar({});
  assert.equal(api2.migrateV5([{ id: 'intro', type: 'text' }]).changed, false, 'not a Nordic CL body');
});

test('rows after the lead-in become bullets in bring, role_view AND who', () => {
  const api = loadSidecar({});
  const list = [
    { id: 'role_view', type: 'rich_block', items: [{ b: 'How I see the role', t: 'lead' }, { b: 'P1', t: 'need' }] },
    { id: 'who', type: 'rich_block', items: [{ b: 'Who I am', t: 'lead' }, { b: 'My goal', t: 'g' }] },
    { id: 'bring', type: 'rich_block', items: [{ b: 'What I bring', t: 'lead' }, { b: 'E1', t: 'e' }] },
  ];
  const out = api.bringBullets(list);
  assert.equal(out.changed, true);
  for (const s of out.list) {
    assert.equal(s.items[0].mk, undefined, s.id + ': lead-in stays a paragraph');
    assert.equal(s.items[1].mk, true, s.id + ': data row is a bullet');
  }
  assert.equal(api.bringBullets(out.list).changed, false, 'idempotent — no re-write storm');
});
