/* evidence-artifact-strip.test.mjs — ANTI-FABRICATION-ARTIFACT-001 (owner 2026-06-19)
 * Strip the "evidence artifact(s)" fabrication tell (e.g. "Worked in product
 * contexts represented by NYX-100 / NYX-200 and MOR PRO evidence artifacts") from
 * experience role results/bullets + SELECTED OUTCOMES, keep the real content, never
 * blank a field, idempotent. Uses the EXACT string from the QA'd export.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(path.join(ROOT, 'antcv-evidence-artifact-strip.js'), 'utf8');

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
globalThis.document = { activeElement: null };
const _st = globalThis.setTimeout, _si = globalThis.setInterval;
globalThis.setTimeout = () => 0; globalThis.setInterval = () => 0;
(0, eval)(SRC);
globalThis.setTimeout = _st; globalThis.setInterval = _si;

const API = globalThis.window.AntcvEvidenceArtifactStrip;
assert.ok(API && typeof API._strip === 'function', 'sidecar published _strip');

const REAL = 'Supervised 7-person task force for high-security smartphone optics - coordinated ODM team in Sweden; Worked in product contexts represented by NYX-100 / NYX-200 and MOR PRO evidence artifacts';
const KEPT = 'Supervised 7-person task force for high-security smartphone optics - coordinated ODM team in Sweden';

test('drops the trailing evidence-artifact clause, keeps the real result', () => {
  assert.equal(API._strip(REAL), KEPT);
});

test('handles a standalone sentence form', () => {
  const v = 'Led optical validation. Worked in product contexts represented by NYX evidence artifacts.';
  assert.equal(API._strip(v), 'Led optical validation.');
});

test('no-op when there is no evidence-artifact tell', () => {
  assert.equal(API._strip('Cut change-request cycle from 250 to 10 days.'), null);
  assert.equal(API._strip(KEPT), null);
});

test('never blanks a field that is only the fabrication', () => {
  assert.equal(API._strip('Worked in product contexts represented by NYX evidence artifacts.'), null);
});

test('idempotent', () => {
  const once = API._strip(REAL);
  assert.equal(once, KEPT);
  assert.equal(API._strip(once), null);
});

test('_apply cleans role.results in the experience section', () => {
  store = {
    sections: JSON.stringify({
      cv: [
        { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', roles: [
          { id: 'r_meprolight_tl', role: 'Electro-Optics Team Leader', company: 'Meprolight', results: REAL,
            bullets: ['Managed prototype-to-production transfer.', 'Operated NYX-200 evidence artifacts only.'] },
          { id: 'r_innoviz', role: 'Change Control Lead', company: 'Innoviz', results: 'Owned change governance under ASPICE.', bullets: ['Chaired the CCB.'] },
        ] },
      ],
      cl: [],
    }),
  };
  API._apply();
  const out = JSON.parse(store.sections);
  const roles = out.cv[0].roles;
  assert.equal(roles[0].results, KEPT, 'fabrication clause stripped from results');
  assert.deepEqual(roles[0].bullets, ['Managed prototype-to-production transfer.'], 'whole-bullet fabrication dropped');
  assert.equal(roles[1].results, 'Owned change governance under ASPICE.', 'unrelated role untouched');

  const before = store.sections;
  API._apply();
  assert.equal(store.sections, before, 'second apply is a no-op');
});
