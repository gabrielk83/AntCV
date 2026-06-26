// sections-normalize-idempotent.test.mjs
// ============================================================
// STORM-IDEMPOTENT-001 (owner 2026-06-26, live console probe): antcv-sections-normalize-415.js
// LISTENS to AND DISPATCHES antcv:sections-updated. Several normalisers return a new-but-equal
// structure (reorder-to-the-same-order), so `changed` went true on already-normalised data and 415
// wrote + dispatched EVERY cycle — ping-ponging sections-updated with other sidecars thousands of
// times (the "re-applied normalisers after restore" storm that re-renders the whole app and makes
// Settings / HWIC / WHAT-I-BRING flicker). The fix: snapshot the input, and only write + dispatch
// when the SERIALISED result actually differs. This test loads the real sidecar in a vm sandbox and
// asserts repeated normalise() calls CONVERGE to zero dispatches (no infinite storm).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-sections-normalize-415.js', import.meta.url), 'utf8');

function load(sections) {
  const store = new Map(Object.entries({ sections: JSON.stringify(sections) }));
  let dispatches = 0;
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {} },
    JSON, Object, Array, String, Number, Boolean, RegExp, Math, parseInt, parseFloat, isNaN, Date,
    setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {},
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { activeElement: null, addEventListener() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o || {}); },
    StorageEvent: function (t, o) { this.type = t; Object.assign(this, o || {}); },
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.dispatchEvent = (e) => { if (e && e.type === 'antcv:sections-updated') dispatches++; return true; };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return {
    api: sandbox.window.AntcvSectionsNormalize,
    store,
    dispatches: () => dispatches,
    resetDispatches: () => { dispatches = 0; },
  };
}

// A Gabriel-ish doc: an experience section with roles + a couple of sidebar/main sections that the
// normalisers touch (loc defaulting, ordering, dedupe). Exercises the real normaliser chain.
const SECTIONS = {
  cv: [
    { id: 'profile', type: 'text', title: 'PROFILE', content: 'A broad product/business profile.' },
    {
      id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true,
      roles: [
        { id: 'r1', title: 'Change Request Lead', company: 'Innoviz', years: '2022 – 2024', on: true, bullets: ['Mapped the change flow.', 'Cut cycle time.'] },
        { id: 'r2', title: 'Product Manager', company: 'Kanzen Konsulenter ApS', years: '2024 – 2026', on: true, bullets: ['Built KPI reporting.'] },
      ],
    },
    { id: 'tools', type: 'rich_block', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, items: [{ b: 'Power BI', t: 'reporting' }] },
  ],
  cl: [],
};

test('repeated normalise() converges to ZERO dispatches (no sections-updated storm)', () => {
  const probe = load(SECTIONS);
  assert.ok(probe.api && typeof probe.api._normalize === 'function', 'sidecar exposes _normalize');

  const ctx = load(SECTIONS);
  const perCall = [];
  for (let i = 0; i < 6; i++) {
    ctx.resetDispatches();
    ctx.api._normalize();
    perCall.push(ctx.dispatches());
  }
  // The first call may legitimately normalise once (e.g. default a loc); after that the document is a
  // fixpoint and MUST stop dispatching. The old code dispatched on every call (the storm).
  const tail = perCall.slice(2); // calls 3..6
  assert.deepEqual(tail, [0, 0, 0, 0], `normalise kept dispatching after steady state: ${JSON.stringify(perCall)}`);
});

test('a fully-normalised document dispatches nothing on the very first normalise()', () => {
  // Pre-normalise once, read the settled doc back, then load fresh from it: the first call must be silent.
  const warm = load(SECTIONS);
  for (let i = 0; i < 5; i++) warm.api._normalize();
  const settled = JSON.parse(warm.store.get('sections'));

  const ctx = load(settled);
  ctx.resetDispatches();
  ctx.api._normalize();
  assert.equal(ctx.dispatches(), 0, 'an already-normalised doc must not write/dispatch (idempotent)');
});

test('FINAL-ROLE-CONDENSE-FOLD: caps the volunteer role to 3 bullets AND is idempotent (no oscillation)', () => {
  // canonCopenhagenWolves rebuilds the Copenhagen Wolves role (and re-adds CW_BULLET); the folded-in
  // cap must trim it to <=3 in the SAME pass and then hold — otherwise canon ↔ cap storm forever.
  const doc = {
    cv: [{
      id: 'experience', type: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true,
      roles: [
        { id: 'r1', title: 'Product Manager', company: 'Innoviz', years: '2022 – 2024', on: true, bullets: ['a', 'b'] },
        { id: 'r2', title: 'Team Operations', company: 'Copenhagen Wolves RFC', years: '2019 – 2022', on: true,
          bullets: ['Coached the squad.', 'Ran logistics.', 'Organised fixtures.', 'Managed kit.', 'Handled comms.', 'Booked pitches.'] },
      ],
    }],
    cl: [],
  };
  const ctx = load(doc);
  for (let i = 0; i < 5; i++) ctx.api._normalize();           // settle
  const settled = JSON.parse(ctx.store.get('sections'));
  const vol = settled.cv[0].roles.find((r) => /copenhagen wolves|pan idr|foreningsarbejde/i.test((r.company || '') + ' ' + (r.title || '')));
  assert.ok(vol, 'volunteer role present');
  assert.ok(vol.bullets.length <= 4, `volunteer bullets capped (got ${vol.bullets.length})`);

  // …and a further normalise on the settled doc must be a silent no-op (the canon↔cap storm is gone).
  const ctx2 = load(settled);
  ctx2.resetDispatches();
  ctx2.api._normalize();
  assert.equal(ctx2.dispatches(), 0, 'settled volunteer-capped doc does not re-dispatch (no canon↔cap oscillation)');
});

test('source keeps the real-change idempotency guard (regression lock)', () => {
  assert.ok(/__after\s*===\s*__before/.test(src), 'the __after === __before guard was removed — the storm can return');
  assert.ok(/__before\s*=\s*JSON\.stringify\(b\)/.test(src), 'the __before snapshot was removed');
});
