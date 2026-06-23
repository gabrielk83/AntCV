// cl-leadin-keep.test.mjs
// ============================================================
// CL-LEADIN-KEEP-001: keep the who/why bold lead-ins in the CL subsections. When
// generation emits who/why directly as rich_block with an EMPTY lead `b`, the
// 759 sidecar must inject the canonical lead-in (who -> "Who I am", why ->
// "Why this position"|"Why this company" by JD context) + leadColon, and re-sync
// the why position<->company flip, without clobbering a user-customised lead.
// Loads the real sidecar in a vm sandbox and drives run() over a stub localStorage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-text-sections-to-rich-block-759.js', import.meta.url), 'utf8');

function run(sections, { jd = '' } = {}) {
  const store = new Map(Object.entries({ sections: JSON.stringify(sections) }));
  if (jd) store.set('antcv:lastJdText', jd);
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    document: { activeElement: null },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  sandbox.window.AntcvTextSectionsToRichBlock.run();
  return JSON.parse(store.get('sections'));
}
const cl = (...secs) => ({ cv: [], cl: secs });
const cv = (...secs) => ({ cv: secs, cl: [] });
const who = (extra) => Object.assign({ id: 'who', type: 'rich_block', headlineOff: true, items: [{ b: '', t: 'I am a product professional.' }] }, extra);
const why = (b) => ({ id: 'why', type: 'rich_block', headlineOff: true, items: [{ b: b, t: 'This role fits.' }] });
const ws = (b) => ({ id: 'work_style', type: 'rich_block', headlineOff: true, items: [{ b: b, t: 'Structured and calm under pressure.' }] });

test('empty WHO lead -> "Who I am" + leadColon', () => {
  const out = run(cl(who()));
  const s = out.cl[0];
  assert.equal(s.items[0].b, 'Who I am');
  assert.equal(s.leadColon, true);
  assert.equal(s.items[0].t, 'I am a product professional.'); // body untouched
});

test('empty WHY lead, no JD -> "Why this company"', () => {
  const out = run(cl(why('')));
  assert.equal(out.cl[0].items[0].b, 'Why this company');
  assert.equal(out.cl[0].leadColon, true);
});

test('empty WHY lead, JD present -> "Why this position"', () => {
  const out = run(cl(why('')), { jd: 'JOB DESCRIPTION: a long job description well over thirty chars.' });
  assert.equal(out.cl[0].items[0].b, 'Why this position');
});

test('canonical WHY re-syncs with context (position with JD)', () => {
  const out = run(cl(why('Why this company')), { jd: 'JOB DESCRIPTION: a long job description well over thirty chars.' });
  assert.equal(out.cl[0].items[0].b, 'Why this position');
});

test('user-customised lead is NOT clobbered', () => {
  const out = run(cl(why('About the mission')));
  assert.equal(out.cl[0].items[0].b, 'About the mission');
});

test('text who -> converted to rich_block with lead-in + leadColon', () => {
  const out = run(cl({ id: 'who', type: 'text', title: 'WHO I AM', content: 'I am a pro.' }));
  const s = out.cl[0];
  assert.equal(s.type, 'rich_block');
  assert.equal(s.headlineOff, true);
  assert.equal(s.leadColon, true);
  assert.equal(s.items[0].b, 'Who I am');
  assert.equal(s.items[0].t, 'I am a pro.');
});

// WORKSTYLE-LEADIN-001 (owner 2026-06-23): the CV work_style lead-in was empty
// when generation emits it directly as a rich_block; default it to "Work style".
test('empty CV work_style lead -> "Work style" + leadColon', () => {
  const out = run(cv(ws('')));
  const s = out.cv[0];
  assert.equal(s.items[0].b, 'Work style');
  assert.equal(s.leadColon, true);
  assert.equal(s.items[0].t, 'Structured and calm under pressure.'); // body untouched
});

test('text CV work_style -> rich_block with "Work style" lead-in + leadColon', () => {
  const out = run(cv({ id: 'work_style', type: 'text_inline', title: 'Work style', content: 'Methodical.' }));
  const s = out.cv[0];
  assert.equal(s.type, 'rich_block');
  assert.equal(s.headlineOff, true);
  assert.equal(s.leadColon, true);
  assert.equal(s.items[0].b, 'Work style');
  assert.equal(s.items[0].t, 'Methodical.');
});

test('user-customised work_style lead is NOT clobbered', () => {
  const out = run(cv(ws('How I operate')));
  assert.equal(out.cv[0].items[0].b, 'How I operate');
});

test('idempotent: a second run makes no further change', () => {
  const once = run(cl(who(), why('')));
  const twice = run(once);
  assert.deepEqual(twice, once);
});
