// cl-slogan-case.test.mjs — SLOGAN-CASE-001 (owner 2026-11-03, CL-ACADEMY-001)
// ============================================================
// The cover-letter headline renders in SENTENCE CASE (the academy letter: "Smart locks that
// households trust and buy") instead of forced capitals, in the preview AND the export.
// antcv:clSloganCase = 'caps' is the opt-back; with no stored choice, turning the academy format
// off (antcv:disable-cl-academy-format) restores capitals too.
//
// Preview == export: the rule lives in three copies (app.src.js, its app.js mirror, and the
// docx-worker's sloganCased). This test runs all three on the same inputs and checks every
// render site goes through the shared helper.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const src = await readFile(here('../../app.src.js'), 'utf8');
const app = await readFile(here('../../app.js'), 'utf8');
const client = await readFile(here('../../antcv-docx-client.js'), 'utf8');
const control = await readFile(here('../../antcv-cl-slogan-control.js'), 'utf8');
const element = await readFile(here('../../antcv-cl-slogan-element.js'), 'utf8');
const worker = await readFile(here('../../../workers/docx-worker/src/index.js'), 'utf8');

const BOTH = [['app.src.js', src], ['app.js', app]];

function slice(s, from, to) {
  const i = s.indexOf(from);
  assert.ok(i >= 0, 'start marker: ' + from);
  const j = s.indexOf(to, i);
  assert.ok(j > i, 'end marker: ' + to);
  return s.slice(i, j);
}
function fakeStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null) };
}
// Build { mode, cased } from one app file's helper source, over a fake localStorage.
function appHelpers(s, store) {
  const code = slice(s, 'function __antcvSloganCaseMode', s === src ? 'try { if (typeof window' : 'try{"undefined"!=typeof window&&(window.__antcvSloganCap');
  return new Function('localStorage', code + '\nreturn { mode: __antcvSloganCaseMode, cased: __antcvSloganCased };')(fakeStorage(store));
}
const workerCased = new Function(slice(worker, 'function sloganCased(', '__name(sloganCased') + '\nreturn sloganCased;')();

const CASES = [
  ['Smart locks that households trust and buy', 'Smart locks that households trust and buy'],
  ['smart locks that households trust and buy', 'Smart locks that households trust and buy'],
  ['IR detectors built for Hamamatsu Photonics', 'IR detectors built for Hamamatsu Photonics'],
  ['PHOTONICS THAT SHIPS ON TIME', 'Photonics that ships on time'],
  ['Processes • Products • People', 'Processes • Products • People'],
  ['PROCESSES • PRODUCTS • PEOPLE', 'Processes • Products • People'],
  ['"quoted" headline', '"Quoted" headline'],
  ['让家庭信赖的智能锁', '让家庭信赖的智能锁'],
  ['Positioning line', 'Positioning line'],
  ['', ''],
];

test('sentence case: app.src.js, app.js and the worker give the same text (preview == export)', () => {
  const s = appHelpers(src, {}), a = appHelpers(app, {});
  for (const [input, want] of CASES) {
    assert.equal(s.cased(input), want, 'app.src.js: ' + input);
    assert.equal(a.cased(input), want, 'app.js: ' + input);
    assert.equal(workerCased(input, 'sentence'), want, 'worker: ' + input);
  }
});

test('caps mode: all three uppercase, and the worker uppercases when no mode is sent', () => {
  const s = appHelpers(src, { 'antcv:clSloganCase': 'caps' }), a = appHelpers(app, { 'antcv:clSloganCase': 'caps' });
  for (const [input] of CASES) {
    assert.equal(s.cased(input), input.toUpperCase());
    assert.equal(a.cased(input), input.toUpperCase());
    assert.equal(workerCased(input, 'caps'), input.toUpperCase());
    assert.equal(workerCased(input, undefined), input.toUpperCase(), 'older client: no field -> capitals');
  }
});

test('mode: sentence by default, caps on opt-back or with the academy format off', () => {
  for (const [name, s] of BOTH) {
    assert.equal(appHelpers(s, {}).mode(), 'sentence', name + ': default');
    assert.equal(appHelpers(s, { 'antcv:clSloganCase': 'caps' }).mode(), 'caps', name + ': opt-back');
    assert.equal(appHelpers(s, { 'antcv:clSloganCase': '"caps"' }).mode(), 'caps', name + ': JSON-quoted value');
    assert.equal(appHelpers(s, { 'antcv:disable-cl-academy-format': '1' }).mode(), 'caps', name + ': academy off');
    assert.equal(appHelpers(s, { 'antcv:disable-cl-academy-format': '1', 'antcv:clSloganCase': 'sentence' }).mode(), 'sentence', name + ': explicit choice wins');
    assert.equal(appHelpers(s, { 'antcv:clSloganCase': 'nonsense' }).mode(), 'sentence', name + ': unknown value -> default');
    // an explicit mode argument beats storage
    assert.equal(appHelpers(s, { 'antcv:clSloganCase': 'caps' }).cased('ab cd', 'sentence'), 'Ab cd', name + ': explicit mode');
  }
});

test('both helpers are exported on window for the docx-client and the slogan panels', () => {
  assert.ok(src.includes('window.__antcvSloganCaseMode = __antcvSloganCaseMode; window.__antcvSloganCased = __antcvSloganCased;'));
  assert.ok(app.includes('window.__antcvSloganCaseMode=__antcvSloganCaseMode,window.__antcvSloganCased=__antcvSloganCased'));
});

test('print/HTML export path: the slogan goes through the helper, not toUpperCase', () => {
  assert.ok(src.includes(`margin:0 0 12pt">' + __antcvSloganCased(st) + '</p>'`), 'app.src.js print path');
  assert.ok(app.includes(`margin:0 0 12pt">'+__antcvSloganCased(st)+'</p>'`), 'app.js print path');
  for (const [name, s] of BOTH) assert.ok(!/12pt">' ?\+ ?st\.toUpperCase\(\)/.test(s), name + ': no forced capitals left');
});

test('live preview: DOM text equals the export text, uppercase LOOK only in caps mode', () => {
  for (const [name, s] of BOTH) {
    const i = s.indexOf('data-antcv-cl-slogan-native');
    assert.ok(i > 0, name + ': slogan node');
    const body = s.slice(i, i + 6000);
    assert.ok(/__antcvSloganCased\(st, ?"sentence"\)/.test(body), name + ': ref writes the sentence-case text');
    assert.ok(/textTransform: ?(__antcvSloganCaseMode\(\) ?=== ?"caps"|"caps" ?=== ?__antcvSloganCaseMode\(\)) ?\? ?"uppercase" ?: ?"none"/.test(body), name + ': conditional textTransform');
    assert.ok(!/textTransform: ?"uppercase", ?(\/\/|opacity)/.test(body), name + ': no unconditional uppercase on the slogan');
  }
});

test('docx-client forwards meta.slogan_case from the same helper', () => {
  assert.ok(client.includes("out.slogan_case = window.__antcvSloganCaseMode()"));
  const i = client.indexOf('out.slogan_align =');
  const j = client.indexOf('out.slogan_case =');
  assert.ok(i > 0 && j > i && j - i < 800, 'next to slogan_align in the CL slogan block');
});

test('worker prints sloganCased(__slogan, __m.slogan_case), not toUpperCase', () => {
  assert.ok(worker.includes('text: sloganCased(__slogan, __m.slogan_case),'));
  assert.ok(!worker.includes('text: __slogan.toUpperCase()'));
});

test('slogan panels show the headline in the same case, with a Case toggle as the opt-back', () => {
  for (const [name, s] of [['control', control], ['element', element]]) {
    assert.ok(s.includes('window.__antcvSloganCased(s)'), name + ': uses the shared helper');
    assert.ok(!/(sm|s|t)\.toUpperCase\(\)/.test(s), name + ': no direct uppercase of the slogan');
  }
  assert.ok(control.includes("textCase: 'antcv:clSloganCase'"), 'control owns the key');
  assert.ok(control.includes("[['sentence', 'Sentence case'], ['caps', 'CAPS']]"), 'Settings toggle');
  assert.ok(element.includes("set('antcv:clSloganCase', caseMode() === 'caps' ? 'sentence' : 'caps')"), 'Sections-panel toggle');
});
