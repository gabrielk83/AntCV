/* CV-SUBTITLE-PIN-001 — Gabriel's unsolicited CV subtitle must stay "Processes • Products • People"
 * and not revert to the template placeholder on kernel-showcase restore. Loads the REAL sidecar in a
 * shimmed global and drives run(): template/empty -> pinned; non-template owner edit -> kept;
 * non-Gabriel -> untouched; CL applicationLabel never touched. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-cv-subtitle-pin-760.js'), 'utf8');
const GOOD = 'Processes • Products • People';

function load(name, meta) {
  const store = new Map();
  if (name !== undefined) store.set('personalInfo', JSON.stringify({ name }));
  store.set('meta', JSON.stringify(meta));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, dispatchEvent() { return true; } };
  const StorageEventShim = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'setTimeout', 'StorageEvent', 'CustomEvent', SRC)(win, localStorage, () => 0, StorageEventShim, StorageEventShim);
  win.AntcvCvSubtitlePin.run();
  return JSON.parse(store.get('meta'));
}

test('Gabriel + template subtitle -> pinned to standing line', () => {
  const m = load('Gabriel Alexander Karp-Gershon', { subtitle: '[Specialisation — 1–3 focus areas, separated by •]', applicationLabel: 'Application: Product / Project Expert - Unsolicited' });
  assert.equal(m.subtitle, GOOD);
  assert.equal(m.applicationLabel, 'Application: Product / Project Expert - Unsolicited', 'CL line untouched');
});

test('Gabriel + empty subtitle -> pinned', () => {
  const m = load('Gabriel Karp', { subtitle: '' });
  assert.equal(m.subtitle, GOOD);
});

test('Gabriel + DA template -> pinned', () => {
  const m = load('Gabriel Karp', { subtitle: '[Specialisering — 1–3 fokusområder, adskilt med •]' });
  assert.equal(m.subtitle, GOOD);
});

test('Gabriel + real owner-edited subtitle -> kept (not clobbered)', () => {
  const m = load('Gabriel Karp', { subtitle: 'Strategy • Delivery • Teams' });
  assert.equal(m.subtitle, 'Strategy • Delivery • Teams');
});

test('non-Gabriel + template -> untouched', () => {
  const m = load('Anita Example', { subtitle: '[Specialisation — 1–3 focus areas, separated by •]' });
  assert.equal(m.subtitle, '[Specialisation — 1–3 focus areas, separated by •]');
});

test('already pinned -> idempotent (no error)', () => {
  const m = load('Gabriel Karp', { subtitle: GOOD });
  assert.equal(m.subtitle, GOOD);
});
