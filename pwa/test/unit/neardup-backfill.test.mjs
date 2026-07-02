// PAN-IDRAET-BACKFILL-001 — the build-time backfill sidecar (antcv-neardup-backfill.js)
// appends a DISTINCT bullet from the user's data to any STORED role whose near-dups
// would collapse below KEEP_MIN=2, so preview AND export both show it (parity by
// construction). Index-safe (append-only), once-per-role (flag), idempotent.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- window / DOM-less shims (must exist BEFORE importing the modules) ---
const _ls = {};
globalThis.localStorage = {
  getItem: (k) => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
let _dispatched = 0;
globalThis.dispatchEvent = () => { _dispatched++; return true; };
if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class { constructor(type, opts) { this.type = type; Object.assign(this, opts || {}); } };
}

// docx-client exposes AntcvDedupNearBullets / AntcvBackfillRoleBullets on window.
await import('../../antcv-docx-client.js');
assert.equal(typeof globalThis.AntcvBackfillRoleBullets, 'function', 'docx-client exposed backfill');
assert.equal(typeof globalThis.AntcvDedupNearBullets, 'function', 'docx-client exposed dedup');

// the sidecar IIFE registers AntcvNeardupBackfill.
await import('../../antcv-neardup-backfill.js');
const SC = globalThis.AntcvNeardupBackfill;
assert.ok(SC && typeof SC.run === 'function', 'sidecar registered');

const B1 = 'Manage logistics for about 25 players and coaches, including travel and equipment';
const B3 = 'Manage logistics for 25 players, including travel bookings';

function seed() {
  _ls['personalInfo'] = JSON.stringify({
    experience: [{
      title: 'Team Manager', company: 'Pan Idraet',
      bullets: [B1, B3, 'Chaired the parents committee and ran monthly fixtures'],
    }],
  });
  _ls['sections'] = JSON.stringify({
    cv: [{
      type: 'experience',
      roles: [
        { id: 'r1', title: 'Team Manager', company: 'Pan Idraet', on: true, bullets: [B1, B3] },
        { id: 'r2', title: 'Coach', company: 'Other Club', on: true, bullets: ['Ran daily drills', 'Tracked attendance and fitness'] },
      ],
    }],
  });
}
const roles = () => JSON.parse(_ls['sections']).cv[0].roles;

test('run(): appends a distinct kernel bullet to the near-dup role, leaves the other role alone', () => {
  seed();
  SC.run();
  const r = roles();
  assert.equal(r[0].bullets.length, 3, 'near-dup role gained one bullet');
  assert.ok(r[0].bullets.some((b) => /parents committee/.test(String(b))), 'the distinct kernel bullet was appended');
  assert.deepEqual(r[0].bullets.slice(0, 2), [B1, B3], 'existing bullets kept in place (append-only, index-safe)');
  assert.equal(r[0]._ndBackfill, 1, 'role marked backfilled');
  assert.equal(r[1].bullets.length, 2, 'the distinct-bullet role is untouched');
});

test('run(): idempotent + respects deletion — a flagged role is never re-backfilled', () => {
  seed();
  SC.run();                                   // first pass appends
  // simulate the user DELETING the appended bullet (role back to the near-dup pair, flag stays)
  const s = JSON.parse(_ls['sections']);
  s.cv[0].roles[0].bullets = [B1, B3];
  _ls['sections'] = JSON.stringify(s);
  const before = _dispatched;
  SC.run();                                   // must NOT re-add
  const r = roles();
  assert.deepEqual(r[0].bullets, [B1, B3], 'deletion respected — not re-added');
  assert.equal(_dispatched, before, 'no write/dispatch on the no-op pass');
});

test('run(): a role with no near-dup collapse is left untouched (no flag, no change)', () => {
  _ls['personalInfo'] = JSON.stringify({ experience: [] });
  _ls['sections'] = JSON.stringify({
    cv: [{ type: 'experience', roles: [
      { id: 'r1', title: 'A', company: 'B', on: true, bullets: ['Distinct one about pipelines', 'Distinct two about reviews'] },
      { id: 'r2', title: 'C', company: 'D', on: true, bullets: ['Another distinct', 'And another'] },
    ] }],
  });
  SC.run();
  const r = roles();
  assert.equal(r[0].bullets.length, 2);
  assert.ok(!('_ndBackfill' in r[0]), 'no flag set when nothing collapses');
});

test('_backfillRole: floor-gate — 3 bullets with one dup collapse to 2, no backfill needed', () => {
  const r = { title: 'A', company: 'B', on: true, bullets: [B1, B3, 'A genuinely different achievement'] };
  const changed = SC._backfillRole(r);
  // collapse([B1,B3,X]) = [B3, X] length 2 >= floor 2 -> no backfill
  assert.equal(changed, false, 'no change when collapse still meets the floor');
  assert.equal(r.bullets.length, 3);
});
