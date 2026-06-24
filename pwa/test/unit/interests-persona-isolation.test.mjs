/* interests-persona-isolation.test.mjs — INTERESTS-LEAK-SOURCE-001 (owner 2026-06-23)
 * A non-Gabriel persona must never carry Gabriel's leaked canonical INTERESTS. The
 * sidecar strips, from the CV `interests` section, rows that are byte-identical to his
 * canon — but ONLY when a distinctive marker (cats / "literally a team player") proves
 * the block leaked from his canon, ONLY for a non-Gabriel persona, never touching the
 * persona's own rows, never refilling an emptied section, and leaving Gabriel untouched.
 *
 * The sidecar is a <script> IIFE: stub window/localStorage/timers, eval, drive _isolate().
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(path.join(ROOT, 'antcv-interests-persona-isolation.js'), 'utf8');

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
globalThis.window = globalThis.window || {};
globalThis.window.addEventListener = () => {};
globalThis.window.dispatchEvent = () => {};
globalThis.window.requestAnimationFrame = (fn) => { fn(); return 0; };
const _setTimeout = globalThis.setTimeout, _setInterval = globalThis.setInterval;
globalThis.setTimeout = () => 0;
globalThis.setInterval = () => 0;
(0, eval)(SRC);
globalThis.setTimeout = _setTimeout;
globalThis.setInterval = _setInterval;

const API = globalThis.window.AntcvInterestsPersonaIsolation;
assert.ok(API && typeof API._isolate === 'function', 'sidecar published _isolate');

// The full leaked Gabriel canon, in both shapes.
const CANON_LV = [
  { l: 'Rugby & inclusive sport', v: 'Team operations, coach assist, literally a team player' },
  { l: 'Tai-chi', v: 'Stability and calm under pressure' },
  { l: 'Cultural exchange', v: 'Languages, food culture and board games' },
  { l: 'Hiking', v: 'Outdoor recovery and mental reset' },
  { l: 'Reading', v: 'Technology, society and systems thinking' },
  { l: 'Supervision', v: 'Handling three feline strategic napping experts (cats)' },
];
const CANON_BT = CANON_LV.map((c) => ({ b: c.l, t: c.v }));

function secsWith(items, type) {
  return { cv: [{ id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: type || 'labeled_list', items }] };
}

test('non-Gabriel: full leaked canon (labeled_list) is stripped and the section hidden', () => {
  const { changed, secs } = API._isolate(secsWith(CANON_LV.map((x) => ({ ...x }))), false);
  assert.equal(changed, true);
  assert.equal(secs.cv[0].items.length, 0, 'all canon rows removed');
  assert.equal(secs.cv[0].on, false, 'emptied section hidden, not refilled');
});

test('non-Gabriel: rich_block {b,t} canon is stripped shape-agnostically', () => {
  const { changed, secs } = API._isolate(secsWith(CANON_BT.map((x) => ({ ...x })), 'rich_block'), false);
  assert.equal(changed, true);
  assert.equal(secs.cv[0].items.length, 0);
  assert.equal(secs.cv[0].on, false);
});

test("non-Gabriel: the persona's OWN rows survive; only the canon rows go", () => {
  const own = { l: 'Beekeeping', v: 'Apiary management and winter preparedness' };
  const items = [own, ...CANON_LV.map((x) => ({ ...x }))];
  const { changed, secs } = API._isolate(secsWith(items), false);
  assert.equal(changed, true);
  assert.deepEqual(secs.cv[0].items, [own], 'only the persona row remains');
  assert.notEqual(secs.cv[0].on, false, 'section stays visible (still has a row)');
});

test('non-Gabriel: NO distinctive marker -> no trigger, nothing removed', () => {
  // Generic rows that overlap canon labels but lack the cats / team-player marker.
  const generic = [
    { l: 'Hiking', v: 'Weekend trails near Aarhus' },
    { l: 'Reading', v: 'History and biographies' },
  ];
  const { changed, secs } = API._isolate(secsWith(generic.map((x) => ({ ...x }))), false);
  assert.equal(changed, false, 'no marker => untouched');
  assert.equal(secs.cv[0].items.length, 2);
});

test('GABRIEL: his own canon interests are NEVER touched', () => {
  const { changed } = API._isolate(secsWith(CANON_LV.map((x) => ({ ...x }))), true);
  assert.equal(changed, false, 'gabriel=true is a hard no-op');
});

test('idempotent: a second pass after a strip is a no-op', () => {
  const first = API._isolate(secsWith(CANON_LV.map((x) => ({ ...x }))), false);
  assert.equal(first.changed, true);
  const second = API._isolate(first.secs, false);
  assert.equal(second.changed, false, 'nothing left that matches');
});

test('group markers and missing/invalid sections are safe', () => {
  // grp rows are preserved; a marker on a grp does not trigger.
  const items = [{ grp: true, t: 'Interests' }, ...CANON_LV.map((x) => ({ ...x }))];
  const { changed, secs } = API._isolate(secsWith(items, 'rich_block'), false);
  assert.equal(changed, true);
  assert.deepEqual(secs.cv[0].items, [{ grp: true, t: 'Interests' }], 'grp marker kept, canon rows gone');
  // no cv array
  assert.equal(API._isolate({}, false).changed, false);
  assert.equal(API._isolate({ cv: 'nope' }, false).changed, false);
});

test('run() writes back cleaned sections for a non-Gabriel persona and is idempotent', () => {
  store = {
    personalInfo: JSON.stringify({ name: 'Anita Aarup', email: 'anita@example.com' }),
    sections: JSON.stringify(secsWith([
      { l: 'Logistics', v: 'Route optimisation and seasonal planning' },
      ...CANON_LV.map((x) => ({ ...x })),
    ])),
  };
  API.run();
  const out = JSON.parse(store.sections);
  assert.equal(out.cv[0].items.length, 1, 'only Anita row remains');
  assert.equal(out.cv[0].items[0].l, 'Logistics');
  const before = store.sections;
  API.run();
  assert.equal(store.sections, before, 'second run is a no-op');
});

test('run() is a hard no-op for a Gabriel persona', () => {
  store = {
    personalInfo: JSON.stringify({ name: 'Gabriel Alexander Karp Gershon' }),
    sections: JSON.stringify(secsWith(CANON_LV.map((x) => ({ ...x })))),
  };
  const before = store.sections;
  API.run();
  assert.equal(store.sections, before, 'gabriel session untouched');
});
