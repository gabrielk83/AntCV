/* EDITOR-IDLE-CHURN (desktop nightly 2026-11-25) — four sidecars wrote to the DOM for as long
 * as the editor was open, with nothing changing:
 *   METRIC-GUARD-LOOP-001, OVERLAY-READY-RICHBLOCK-001, OWNER-GUARD-CLASS-WRITE-001,
 *   ALT-CIRCLES-WRITE-001.
 * The sidecars run here in a vm on a minimal DOM that counts writes. The whole-app gate is
 * pwa/test/diag-rerender-storm.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PWA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(PWA, f), 'utf8');
const store = (init) => {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

// ── metric guard ──────────────────────────────────────────────────────────
const outcomes = (items) => JSON.stringify({ cv: [{ id: 'outcomes', title: 'SELECTED OUTCOMES', on: true, type: 'bullets', items }], cl: [] });
function bootGuard(items) {
  const writes = { add: 0, remove: 0, warn: 0 };
  const host = {
    chips: [], style: {}, getAttribute: (n) => (n === 'data-sid' ? 'outcomes' : null),
    querySelector: () => host.chips[0] || null,
    appendChild(c) { c.parent = host; host.chips.push(c); writes.add++; },
  };
  const document = {
    readyState: 'complete', body: {}, addEventListener() {},
    querySelector: (s) => (/data-sid="outcomes"/.test(s) ? host : null),
    querySelectorAll: (s) => (/metric-guard-chip/.test(s) ? host.chips.slice() : []),
    createElement: () => ({
      style: {}, addEventListener() {},
      closest(s) { return s === '[data-sid]' ? this.parent : null; },
      remove() { host.chips = host.chips.filter((x) => x !== this); writes.remove++; },
    }),
  };
  const localStorage = store({ sections: outcomes(items) });
  const window = { addEventListener() {} };
  vm.runInNewContext(read('antcv-outcomes-metric-guard-390.js'), {
    window, document, localStorage, console: { warn() { writes.warn++; } }, setTimeout() {}, clearTimeout() {},
    MutationObserver: class { observe() {} }, getComputedStyle: () => ({ position: 'relative' }) });
  return { check: window.AntcvMetricGuard.check, writes, host, localStorage };
}
const BARE = [{ b: 'Delivered', t: 'requirements into executable scope.' }];

test('metric guard: repeated checks on an unchanged section write once and warn once', () => {
  const g = bootGuard(BARE);
  for (let i = 0; i < 5; i++) assert.deepEqual([...g.check()], ['outcomes']);
  assert.equal(g.host.chips.length, 1);
  assert.deepEqual(g.writes, { add: 1, remove: 0, warn: 1 });
});

test('metric guard: the chip clears on a number, and comes back with a new warning', () => {
  const g = bootGuard(BARE);
  g.check();
  g.localStorage.setItem('sections', outcomes([{ t: 'cut from 250 to 10 days' }]));
  assert.equal(g.check().length, 0);
  assert.equal(g.host.chips.length, 0);
  g.localStorage.setItem('sections', outcomes(BARE));
  g.check();
  assert.equal(g.host.chips.length, 1);
  assert.equal(g.writes.warn, 2);
});

test('metric guard: a chip React dropped is pinned again; the kill switch clears it', () => {
  const g = bootGuard(BARE);
  g.check();
  g.host.chips = [];
  g.check();
  assert.equal(g.host.chips.length, 1);
  g.localStorage.setItem('antcv:metricguard:off', '1');
  g.check();
  assert.equal(g.host.chips.length, 0);
});

// ── overlay content gate ──────────────────────────────────────────────────
function ready(cv, step = 'editor') {
  const src = read('antcv-overlay.js');
  const a = src.indexOf('function isContentReady()');
  const b = src.indexOf('function updateOverlayVisibility()');
  assert.ok(a > 0 && b > a, 'isContentReady found');
  return vm.runInNewContext(src.slice(a, b) + '\nisContentReady()', {
    localStorage: store({ step: JSON.stringify(step), sections: JSON.stringify({ cv, cl: [] }) }) });
}
const rb = (items, extra) => [{ id: 'profile', on: true, type: 'rich_block', items, ...extra }];
const exp = (roles) => [{ id: 'experience', on: true, type: 'experience', roles }];

test('overlay gate: rich_block text, its bullets, section bullets and roles count as content', () => {
  assert.equal(ready(rb([{ b: '', t: 'Optical engineer.', bullets: [] }])), true);
  assert.equal(ready(rb([{ b: '', t: '', bullets: ['Owned the stack.'] }])), true);
  assert.equal(ready(rb([{ b: '', t: '', bullets: [{ t: 'Owned the stack.' }] }])), true);
  assert.equal(ready(rb([], { bullets: ['Owned the stack.'] })), true);
  assert.equal(ready(exp([{ title: 'PM', bullets: [] }])), true);
  assert.equal(ready(exp([{ title: '[Role title]', company: 'Acme' }])), true);
  assert.equal(ready(exp([{ title: '[Role title]', bullets: ['Owned the stack.'] }])), true);
});

test('overlay gate: placeholders, hidden sections, hidden roles and the upload step stay not-ready', () => {
  assert.equal(ready(rb([{ b: 'Focus', t: '[Profile text]', bullets: ['[Bullet 1]'] }])), false);
  assert.equal(ready(rb([{ b: 'Label only', t: '', bullets: [] }])), false);
  assert.equal(ready(rb([{ t: 'Real.' }], { on: false })), false);
  assert.equal(ready(exp([{ title: '[Role title]', company: '[Company name]', years: '[YYYY]', bullets: ['[Bullet 1 — scope]'] }])), false);
  assert.equal(ready(exp([{ on: false, title: 'PM' }])), false);
  assert.equal(ready(rb([{ t: 'Real.' }]), 'upload'), false);
});

test('overlay gate: the older shapes still count', () => {
  assert.equal(ready([{ id: 'p', on: true, type: 'text', content: 'Real.' }]), true);
  assert.equal(ready([{ id: 't', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] }]), true);
  assert.equal(ready([{ id: 'p', on: true, type: 'text', content: '[Profile text]' }]), false);
});

// ── write-only-on-change ──────────────────────────────────────────────────
test('owner guard: the body class is written only when it changes', () => {
  const src = read('antcv-app-content-owner-guard.js');
  for (const [op, cond] of [['remove', 'd.body.classList.contains'], ['add', '!d.body.classList.contains']]) {
    const call = "d.body.classList." + op + "('antcv-content-stale')";
    assert.equal(src.split(call).length - 1, 1, op);
    assert.ok(src.includes('if (' + cond + "('antcv-content-stale')) " + call), op + ' is guarded');
  }
});

test('alt circles: a second paint on an unchanged group writes nothing', () => {
  const src = read('antcv-mobile-ui-418.js');
  const a = src.indexOf('function c354_isCircle(');
  const b = src.indexOf('// 354 capture-phase click');
  assert.ok(a > 0 && b > a);
  let writes = 0;
  const el = (attrs, children = []) => {
    const at = { ...attrs };
    const n = {
      nodeType: 1, tagName: 'DIV', children, getAttribute: (k) => (k in at ? at[k] : null),
      setAttribute(k, v) { writes++; at[k] = v; },
      removeAttribute(k) { if (k in at) { writes++; delete at[k]; } },
      style: { removeProperty() {}, setProperty() { writes++; } },
      getBoundingClientRect: () => ({ top: 10, left: 0, bottom: 20 }),
    };
    children.forEach((c) => { c.parentElement = n; });
    return n;
  };
  const circ = (c) => el({ title: c, style: 'width: 14px; border-radius: 50%; cursor: pointer' });
  const kids = [circ('#283556'), circ('#1F2937'), circ('#0F4761')];
  const host = el({}, kids);
  const ctx = { document: { querySelectorAll: () => kids } };
  vm.runInNewContext(src.slice(a, b) + '\nthis.paint = c354_paint;', ctx);
  ctx.paint();
  assert.equal(host.getAttribute('data-antcv-altdrop'), '1');
  assert.equal(host.getAttribute('data-antcv-altdrop-open'), '0');
  assert.equal(kids[0].getAttribute('data-antcv-alttrigger'), '1');
  assert.equal(kids[2].getAttribute('data-antcv-altcircle'), '1');
  const first = writes;
  ctx.paint();
  assert.equal(writes, first);
  host.setAttribute('data-antcv-altdrop-open', '1');
  ctx.paint();
  assert.equal(host.getAttribute('data-antcv-altdrop-open'), '1', 'an open group stays open');
});
