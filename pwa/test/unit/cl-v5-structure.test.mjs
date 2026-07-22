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
      removeItem: (k) => { delete store[k]; },
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

test('migrateV5 uses NO persistent flag and clears a stale -001 flag', () => {
  // CL-V5-MIGRATE-DURABLE-002: a persistent localStorage flag guarding a hydration-owned
  // blob is the bug. Inserting never sets a flag; observing role_view present clears any
  // stale -001 flag so it can never resurrect the "skip forever" behaviour.
  const store = {};
  const api = loadSidecar(store);
  assert.equal(api.migrateV5(preV5()).changed, true, 'inserts');
  assert.equal(store['antcv:cl-v5-role-view-migrated'], undefined, 'no flag written by the insert');

  // A letter poisoned by the old bug: flag "1" but role_view ABSENT. The stateless ensure
  // re-inserts regardless of the flag (this is exactly the owner's live 3Shape failure).
  const poisonedStore = { 'antcv:cl-v5-role-view-migrated': '1' };
  const poisoned = loadSidecar(poisonedStore);
  assert.equal(poisoned.migrateV5(preV5()).changed, true, 'a stale "1" flag no longer blocks re-insertion');

  // Once role_view is read back present, the stale flag is scrubbed.
  const staleStore = { 'antcv:cl-v5-role-view-migrated': '1' };
  const withStale = loadSidecar(staleStore);
  const withRv = preV5().concat([{ id: 'role_view', type: 'rich_block', items: [] }]);
  assert.equal(withStale.migrateV5(withRv).changed, false, 'present -> inert');
  assert.equal(staleStore['antcv:cl-v5-role-view-migrated'], undefined, 'stale flag scrubbed');
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

// ---------------------------------------------------- CL-V5-TONE-GATE-001 (live-verified)
// An ABSENT `toneRegister` is the app's own DEFAULT (scandinavian). The old gate returned
// false for it, so on the owner's real account run() bailed and NOTHING in this sidecar
// fired — the v5 ORDER was loaded and idle while sections.cl kept the pre-v5 order.
test('the tone gate treats an ABSENT toneRegister as the Nordic default', () => {
  for (const [label, store] of [
    ['absent', {}],
    ['null literal', { toneRegister: 'null' }],
    ['empty string', { toneRegister: '""' }],
    ['nordic-minimal', { toneRegister: '"nordic-minimal"' }],
    ['scandinavian', { toneRegister: '"scandinavian"' }],
    ['unparseable', { toneRegister: 'not json' }],
  ]) {
    assert.equal(loadSidecar(store).isNordicMinimal(), true, label + ' -> Nordic default');
  }
});

test('an EXPLICIT non-Nordic register still opts out', () => {
  for (const reg of ['achievement-driven', 'mediterranean-formal', 'prestige-structured']) {
    assert.equal(loadSidecar({ toneRegister: JSON.stringify(reg) }).isNordicMinimal(), false, reg);
  }
});

test('run() actually reaches the CL when toneRegister is absent (the live failure)', () => {
  const store = { sections: JSON.stringify({ cl: preV5() }) };
  loadSidecar(store).run();
  const ids = JSON.parse(store.sections).cl.map((s) => s.id);
  assert.equal(ids.join('|'), 'greeting|opening|why|role_view|bring|contribute|who|foundation|closure');
});

// ------------------------------------------- CL-V5-MIGRATE-DURABLE-002 (live-verified)
// Every load the app hydrates `sections` from the stored (pre-v5) cloud record, which has
// no role_view; the me() floor only fills empty sections, it does not inject missing ones.
// -001 armed a persistent flag once role_view was read back present, but the NEXT load's
// hydration stripped role_view while the flag stayed "1" — so migrateV5 skipped forever and
// the owner's live CL (3Shape) had the correct v5 ORDER but no "How I see the role" at all.
// -002 drops the persistent flag: role_view is ensured every load, like reorder/bringBullets.
test('a hydration overwrite that discards role_view is repaired on EVERY later load', () => {
  const store = { sections: JSON.stringify({ cl: preV5() }) };
  const api = loadSidecar(store);

  api.run();
  assert.ok(JSON.parse(store.sections).cl.some((s) => s.id === 'role_view'), 'inserted');
  assert.equal(store['antcv:cl-v5-role-view-migrated'], undefined, 'no persistent flag written');

  // hydration rewrites sections from the pre-v5 record — role_view is stripped
  store.sections = JSON.stringify({ cl: preV5() });
  loadSidecar(store).run();   // a fresh page load (module attempt counter reset)
  assert.ok(JSON.parse(store.sections).cl.some((s) => s.id === 'role_view'), 're-inserted on the next load');

  // even a letter carrying the poisoned "1" flag from the old build is repaired
  store.sections = JSON.stringify({ cl: preV5() });
  store['antcv:cl-v5-role-view-migrated'] = '1';
  loadSidecar(store).run();
  assert.ok(JSON.parse(store.sections).cl.some((s) => s.id === 'role_view'), 'poisoned flag no longer blocks');
});

test('re-insertion is bounded per page load — it can never become a write storm', () => {
  const store = { sections: JSON.stringify({ cl: preV5() }) };
  const api = loadSidecar(store);
  let inserts = 0;
  for (let i = 0; i < 40; i++) {
    store.sections = JSON.stringify({ cl: preV5() });   // a hostile stripper: wipes it every time
    api.run();
    if (JSON.parse(store.sections).cl.some((s) => s.id === 'role_view')) inserts++;
  }
  assert.ok(inserts <= 5, 'gave up after the attempt ceiling, got ' + inserts);
});

// ---------------------------------------- CL-V5-FOUNDATION-KEEP-001 (live-verified)
// v5 ships FOUNDATION off because its content belongs in the "Who I am" end-block. On a
// PRE-v5 letter the who rows are still placeholders, so turning foundation off deleted a
// real paragraph and put nothing in its place (the owner's live CL: the Codebeamer/FMEA
// hardware-path prose vanished).
const realFoundation = () => ({
  id: 'foundation', type: 'rich_block', on: false, items: [
    { b: 'Foundation', t: 'I connect what I do best with the outcomes this employer is after.' },
    { b: 'Hands-on', t: 'across the full hardware product path: requirements and ALM tooling, FMEA.', mk: true },
    { b: 'Professionally', t: 'that grounding lets me take product ownership across disciplines.', mk: true },
  ],
});
const phWho = () => ({ id: 'who', type: 'rich_block', items: [
  { b: 'Who I am', t: 'lead' },
  { b: 'Professional summary', t: '[Identity tied to the role]', mk: true },
  { b: 'My goal', t: '[The contribution wanted]', mk: true },
] });
const realWho = () => ({ id: 'who', type: 'rich_block', items: [
  { b: 'Who I am', t: 'I work best where uncertainty and delivery move together.' },
  { b: 'Professional summary', t: 'Over 15 years in electro-optical hardware and governance.', mk: true },
  { b: 'How I operate', t: 'Calm and structured, I make data-led decisions.', mk: true },
] });
// the live half-filled case: "How I operate" real, but the row that actually carries
// foundation's substance (Professional summary) still a placeholder.
const halfWho = () => ({ id: 'who', type: 'rich_block', items: [
  { b: 'Who I am', t: 'I work best where uncertainty and delivery move together.' },
  { b: 'Professional summary', t: '[Identity tied to the role]', mk: true },
  { b: 'How I operate', t: 'Calm and structured, I make data-led decisions.', mk: true },
  { b: 'My goal', t: '[The contribution wanted]', mk: true },
] });

test('a hidden foundation with REAL prose is kept visible while who is still placeholder', () => {
  const api = loadSidecar({});
  const out = api.foundationKeep([realFoundation(), phWho()]);
  assert.equal(out.changed, true, 'un-hidden');
  assert.equal(out.list.find((s) => s.id === 'foundation').on, true);
  assert.equal(api.foundationKeep(out.list).changed, false, 'idempotent — no write storm');
});

test('once the v5 who carries REAL content, foundation stays hidden as v5 intends', () => {
  const api = loadSidecar({});
  assert.equal(api.foundationKeep([realFoundation(), realWho()]).changed, false);
});

test('a foundation that is only placeholders stays hidden — nothing would be lost', () => {
  const api = loadSidecar({});
  const empty = { id: 'foundation', type: 'rich_block', on: false, items: [
    { b: 'Foundation', t: '[Legacy pre-v5 section]' },
    { b: 'Hands-on', t: '[Select only skills that match]', mk: true },
  ] };
  assert.equal(api.foundationKeep([empty, phWho()]).changed, false);
});

test('a HALF-filled who does not release foundation — no flip-flop between loads', () => {
  const api = loadSidecar({});
  const out = api.foundationKeep([realFoundation(), halfWho()]);
  assert.equal(out.changed, true, 'kept visible: Professional summary is still a placeholder');
  assert.equal(out.list.find((s) => s.id === 'foundation').on, true);
});

// ---------------------------------------- CL-V5-WHY-LEADIN-001 + ROLEVIEW-VISIBLE-001
test('normalizeV5 rewords the why lead-in default variants to "Why this company and position"', () => {
  const api = loadSidecar({});
  const cl = [
    { id: 'why', type: 'rich_block', items: [{ b: 'Why this company and role', t: 'body' }] },
  ];
  const out = api.normalizeV5(cl);
  assert.equal(out.changed, true);
  assert.equal(out.list[0].items[0].b, 'Why this company and position');
  // idempotent + the current v5 value converges too
  assert.equal(api.normalizeV5([{ id: 'why', type: 'rich_block', items: [{ b: 'Why this position', t: 'x' }] }]).list[0].items[0].b, 'Why this company and position');
  assert.equal(api.normalizeV5(out.list).changed, false, 'already normalized -> no change');
});

test('normalizeV5 never touches a custom why lead-in the user typed', () => {
  const api = loadSidecar({});
  const cl = [{ id: 'why', type: 'rich_block', items: [{ b: 'My reasons for applying', t: 'x' }] }];
  const out = api.normalizeV5(cl);
  assert.equal(out.changed, false);
  assert.equal(out.list[0].items[0].b, 'My reasons for applying');
});

test('normalizeV5 seeds the role_view lead sentence so the section renders', () => {
  const api = loadSidecar({});
  const cl = [{ id: 'role_view', type: 'rich_block', items: [
    { b: 'How I see the role', t: '' },
    { b: '[Employer priority 1]', t: '', mk: true },
  ] }];
  const out = api.normalizeV5(cl);
  assert.equal(out.changed, true);
  assert.match(out.list[0].items[0].t, /three connected priorities/);
  // real lead sentence is preserved (idempotent, no re-seed storm)
  assert.equal(api.normalizeV5(out.list).changed, false);
  const real = [{ id: 'role_view', type: 'rich_block', items: [{ b: 'How I see the role', t: 'Custom intro line.' }] }];
  assert.equal(api.normalizeV5(real).changed, false, 'real content is never overwritten');
});
