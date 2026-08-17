// YEARS-GUARD-001 — functional + wiring lock for the client-side
// CONTRADICTION-QA-001 enforcement (the recurring "33+ years" class).
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(path.join(ROOT, 'antcv-years-guard.js'), 'utf8');
const index = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function freshEnv(store) {
  const listeners = {};
  const win = {
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    dispatchEvent: (e) => { (listeners[e.type] || []).forEach((f) => f(e)); },
  };
  const g = {
    window: win,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; } },
    setTimeout: (f) => f(),   // run timers synchronously
    console: { warn: () => {}, debug: () => {} },
    JSON, Object, Array, Math, parseInt, String,
  };
  const fn = new Function('window', 'localStorage', 'CustomEvent', 'setTimeout', 'console', src);
  fn(g.window, g.localStorage, g.CustomEvent, g.setTimeout, g.console);
  return { win, store };
}

test('years-guard rewrites a claim the kernel does not state', () => {
  const store = {
    personalInfo: JSON.stringify({ background: 'engineer with 15+ years across optics' }),
    sections: JSON.stringify({ cv: [], cl: [{ id: 'opening', content: 'With 33+ years across the disciplines below, I bring depth.' }] }),
  };
  freshEnv(store);
  const out = JSON.parse(store.sections);
  assert.match(out.cl[0].content, /15\+ years/);
  assert.doesNotMatch(out.cl[0].content, /33/);
});

test('years-guard leaves kernel-consistent claims alone (idempotent)', () => {
  const store = {
    personalInfo: JSON.stringify({ background: 'engineer with 15+ years across optics' }),
    sections: JSON.stringify({ cv: [{ id: 'profile', content: '15 years in electro-optics.' }], cl: [] }),
  };
  freshEnv(store);
  assert.strictEqual(JSON.parse(store.sections).cv[0].content, '15 years in electro-optics.');
});

test('years-guard does nothing when the kernel states no years figure', () => {
  const store = {
    personalInfo: JSON.stringify({ background: 'an engineer' }),
    sections: JSON.stringify({ cv: [], cl: [{ id: 'opening', content: 'With 33+ years of magic.' }] }),
  };
  freshEnv(store);
  assert.match(JSON.parse(store.sections).cl[0].content, /33\+ years/);
});

test('index.html loads the guard with a ?v', () => {
  assert.match(index, /antcv-years-guard\.js\?v=[^"]+/);
});
