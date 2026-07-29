// header-rule-control.test.mjs
// ============================================================
// HEADER-ITEM-RULE-001 UI + parity helpers: the sidecar exposes the render
// helpers the live preview and HTML export call (guarded splices). Defaults
// (absent store) = copenhagen-modern = today's look.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-header-rule-control.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const R = { createElement: (tag, props) => ({ tag, props }) };
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    document: { body: null, addEventListener() {}, querySelectorAll: () => [], createElement: () => { throw new Error('no dom'); } },
    MutationObserver: function () { this.observe = () => {}; },
    setTimeout() { return 0; }, clearTimeout() {},
    console, JSON, Array, Object, String, Number, Math, isFinite, CustomEvent: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { w: sandbox.window, R, store };
}

test('defaults = mockup lock 2026-07-23: NO rules inside the header box (all fields off)', () => {
  const { w, R } = load();
  assert.equal(w.__antcvHdrRuleDiv(R, 'specialisation', '#01B9BD', '4px 0 5px'), null, 'spec rule default OFF');
  assert.equal(w.__antcvHdrRuleDiv(R, 'contact', '#01B9BD', '3px 0 0'), null, 'contact rule default OFF');
  assert.equal(w.__antcvHdrRuleDiv(R, 'name', '#01B9BD', '2px 0 0'), null, 'name rule default OFF');
  assert.equal(Object.keys(w.__antcvHdrRuleStyle('specialisation', '#01B9BD')).length, 0);
  assert.equal(Object.keys(w.__antcvHdrRuleStyle('name', '#01B9BD')).length, 0);
  assert.equal(w.__antcvHdrRuleHtml('specialisation', '#01B9BD', 3, 1), '');
  assert.equal(w.__antcvHdrRuleHtml('name', '#01B9BD', 2, 0), '');
});

test('store overrides: hide spec, thick red contact, name on', () => {
  const { w, R } = load({ headerItemRule: JSON.stringify({
    specialisation: { on: false },
    contact: { on: true, pt: 2, color: 'ff0000' },
    name: { on: true },
  }) });
  assert.equal(w.__antcvHdrRuleDiv(R, 'specialisation', '#01B7BB', 'x'), null, 'spec hidden');
  const c = w.__antcvHdrRuleDiv(R, 'contact', '#01B7BB', 'x');
  assert.match(c.props.style.borderBottom, /^2\.5px solid #ff0000$/);   // 2pt -> 2.67 -> 2.5px rounded
  assert.match(w.__antcvHdrRuleHtml('contact', '#01B7BB', 1, 0), /border-bottom:2pt solid #ff0000/);
  const n = w.__antcvHdrRuleStyle('name', '#01B7BB');
  assert.match(n.borderBottom, /solid #01B7BB$/, 'name on with theme colour');
});

test('garbage store falls back to defaults (all off); helpers never throw', () => {
  const { w, R } = load({ headerItemRule: '{not json' });
  assert.equal(w.__antcvHdrRuleDiv(R, 'contact', '#01B9BD', 'x'), null, 'bad store -> default OFF, no throw');
  assert.equal(w.__antcvHdrRuleHtml('name', '#01B9BD', 2, 0), '');
});
