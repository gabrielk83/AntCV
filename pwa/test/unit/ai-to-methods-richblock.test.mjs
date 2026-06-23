// ai-to-methods-richblock.test.mjs
// ============================================================
// AI-TO-METHODS-RICHBLOCK-001: TOOLS & METHODS migrated to rich_block (grp markers
// + {b,t} rows). The "AI-assisted" row floats above the first group; the sidecar
// must move it to the end of the Methods group. Loads the real sidecar in a vm sandbox.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-ai-assisted-to-methods.js', import.meta.url), 'utf8');

function makeSandbox() {
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: { activeElement: null },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    requestAnimationFrame: null,
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}
let api;
beforeEach(() => { api = makeSandbox().window.AntcvAiToMethods; });

const TM = () => [
  { b: 'AI-assisted', t: 'Experiment setup, log triage, measurement analysis' },
  { grp: true, t: 'Expertise' },
  { b: 'Optics', t: 'Electro-optics' },
  { grp: true, t: 'Tools' },
  { b: 'Software', t: 'Jira' },
  { grp: true, t: 'Methods' },
  { b: 'Validation', t: 'V&V' },
];

test('sidecar exposes the rich_block relocate API', () => {
  assert.equal(typeof api._relocateRich, 'function');
  assert.equal(typeof api._relocate, 'function');
});

test('floating AI-assisted row moves to the END of the Methods group', () => {
  const items = TM();
  assert.equal(api._relocateRich(items), true);
  const order = items.map((it) => it.grp ? '[' + it.t + ']' : it.b);
  assert.deepEqual(order, ['[Expertise]', 'Optics', '[Tools]', 'Software', '[Methods]', 'Validation', 'AI-assisted']);
});

test('idempotent: AI row already at end of Methods → no move', () => {
  const items = TM();
  api._relocateRich(items);          // first move
  assert.equal(api._relocateRich(items), false); // second is a no-op
});

test('no Methods group → no move', () => {
  const items = [{ b: 'AI-assisted', t: 'x' }, { grp: true, t: 'Tools' }, { b: 'Software', t: 'Jira' }];
  assert.equal(api._relocateRich(items), false);
});

test('AI row inside another group still relocates to Methods', () => {
  const items = [
    { grp: true, t: 'Tools' },
    { b: 'AI-assisted', t: 'x' },     // wrongly under Tools
    { grp: true, t: 'Methods' },
    { b: 'Validation', t: 'y' },
  ];
  assert.equal(api._relocateRich(items), true);
  const order = items.map((it) => it.grp ? '[' + it.t + ']' : it.b);
  assert.deepEqual(order, ['[Tools]', '[Methods]', 'Validation', 'AI-assisted']);
});

test('legacy labeled_list relocate still works', () => {
  const items = [
    { l: 'AI-assisted', v: 'x' },
    { group: 'Methods', l: 'Validation', v: 'y' },
  ];
  assert.equal(api._relocate(items), true);
});
