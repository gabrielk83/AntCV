// cl-slogan-element.test.mjs
// ============================================================
// CL-SLOGAN-ELEMENT-001 (register row 22 phase 1): the slogan surfaced as an
// element of the CL sections panel, PURE UI over the restore-safe standalone
// keys (antcv:clSlogan / -Hidden / -Align). These tests cover the pure logic:
// key reads, effective-text derivation, panel-title source, kill switch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-cl-slogan-element.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { body: null, addEventListener() {}, querySelectorAll: () => [], createElement: () => { throw new Error('no dom in this test'); } },
    MutationObserver: function () { this.observe = () => {}; },
    setTimeout() { return 0; }, clearTimeout() {},
    console, JSON, Array, Object, String, Number, Math, isFinite, CustomEvent: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { w: sandbox.window, store };
}

test('defaults: visible, center, empty text -> falls back to the specialisation subtitle uppercased with | as bullet', () => {
  const { w } = load({ personalInfo: JSON.stringify({ subtitle: 'Processes | Products | People' }) });
  const api = w.AntcvClSloganElement;
  assert.ok(api && typeof api.version === 'string' && /^\d+\.\d+\.\d+/.test(api.version), 'sidecar loaded and exposes a build-version tag');
  const c = api._cfg();
  assert.equal(c.hidden, false);
  assert.equal(c.align, 'center');
  assert.equal(c.text, '');
  assert.equal(api._effectiveText(), 'PROCESSES • PRODUCTS • PEOPLE');
});

test('override keys win: text uppercased, hidden flag, align sanitized', () => {
  const { w } = load({
    'antcv:clSlogan': 'Custom tagline',
    'antcv:clSloganHidden': '1',
    'antcv:clSloganAlign': '"RIGHT"',
  });
  const c = w.AntcvClSloganElement._cfg();
  assert.equal(c.text, 'Custom tagline');
  assert.equal(c.hidden, true);
  assert.equal(c.align, 'right');
  assert.equal(w.AntcvClSloganElement._effectiveText(), 'CUSTOM TAGLINE');
});

test('placeholder subtitles ([...]) never leak into the effective slogan; garbage align falls to center', () => {
  const { w } = load({
    personalInfo: JSON.stringify({ subtitle: '[Your specialization here]' }),
    'antcv:clSloganAlign': 'diagonal',
  });
  assert.equal(w.AntcvClSloganElement._effectiveText(), '');
  assert.equal(w.AntcvClSloganElement._cfg().align, 'center');
});

test('panel-title source reads sections.cl titles in order (anchor = first, confirm = last)', () => {
  const { w } = load({ sections: JSON.stringify({
    cv: [{ id: 'x', title: 'Profile' }],
    cl: [{ id: 'greeting', title: 'Greeting' }, { id: 'why', title: 'WHY THIS POSITION' }, { id: 'closure', title: 'Closure' }],
  }) });
  assert.deepEqual(Array.from(w.AntcvClSloganElement._clTitles()).join('|'), 'Greeting|WHY THIS POSITION|Closure');
});

test('kill switch: scan() with the disable flag removes nothing and mounts nothing (no DOM touched)', () => {
  const { w } = load({ 'antcv:disable-cl-slogan-element': '1' });
  // document.createElement throws in this sandbox — scan() must not reach it when disabled
  assert.doesNotThrow(() => w.AntcvClSloganElement.scan());
});

test('SIGN-OFF element cfg: closing + name + both CJLRs from the standalone keys, defaults center', () => {
  const { w } = load({
    'antcv:clClosing': 'Best regards,',
    'antcv:clClosingAlign': 'left',
    'antcv:clSignName': 'Gabriel',
  });
  const c = w.AntcvClSloganElement._signoffCfg();
  assert.equal(c.closing, 'Best regards,');
  assert.equal(c.closingAlign, 'left');
  assert.equal(c.name, 'Gabriel');
  assert.equal(c.nameAlign, 'center', 'absent name-align defaults to center');
});

test('SIGNATURE element cfg: hidden flag, align sanitized, stored = B64 presence', () => {
  const empty = load({}).w.AntcvClSloganElement._sigCfg();
  assert.equal(empty.hidden, false);
  assert.equal(empty.align, 'center');
  assert.equal(empty.stored, false);
  const c = load({
    'antcv:signatureHidden': '1',
    'antcv:signatureAlign': '"RIGHT"',
    'antcv:signatureB64': 'data:image/png;base64,xyz',
  }).w.AntcvClSloganElement._sigCfg();
  assert.equal(c.hidden, true);
  assert.equal(c.align, 'right');
  assert.equal(c.stored, true);
});
