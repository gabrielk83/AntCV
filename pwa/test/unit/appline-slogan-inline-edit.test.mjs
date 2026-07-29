// appline-slogan-inline-edit.test.mjs
// ============================================================
// Owner 2026-07-29: "allow editing of the slogan and of the application line in the
// preview" + "pressing Application line resizing is generating NaNPt between the + and -".
//
//   APPLINE-EDIT-001       the application line was a read-only composed string. It is
//                          editable now over the standalone antcv:clAppLine override, on
//                          all three surfaces (preview, HTML export, DOCX worker).
//   SLOGAN-EDIT-EMPTY-001  the slogan node was contentEditable but simply not RENDERED
//                          when it resolved empty, so a letter without one gave nothing
//                          to click. A faded prompt renders in the preview only.
//   FONTSIZE-STEP-NAN-001  the row displayed a fallback while the stepper added to the
//                          RAW value: undefined + 0.5 = NaN, persisted as null.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const src = await readFile(here('../../app.src.js'), 'utf8');
const app = await readFile(here('../../app.js'), 'utf8');
const client = await readFile(here('../../antcv-docx-client.js'), 'utf8');
const worker = await readFile(here('../../../workers/docx-worker/src/index.js'), 'utf8');

const BOTH = [['app.src.js', src], ['app.js', app]];
const count = (s, n) => s.split(n).length - 1;

// ------------------------------------------------------------ APPLINE-EDIT-001

test('the app line resolves override-first, over a composed fallback', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('__antcvAppLineComposed'), name + ': the composed sentence has its own function');
    assert.ok(s.includes('__antcvAppLineOverride'), name + ': the override has its own reader');
    assert.ok(s.includes('antcv:clAppLine'), name + ': the standalone key');
    assert.ok(s.includes('window.__antcvAppLineComposed'), name + ': exported for the commit path');
  }
});

test('every render site still goes through __antcvAppLineText, so one edit reaches all', () => {
  for (const [name, s] of BOTH) {
    assert.ok(count(s, '__antcvAppLineText(') >= 3, name + ': resolver used at the render sites');
  }
});

test('the editable text is an INNER span, not the div the rule sidecar writes into', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('data-antcv-app-line-text'), name + ': dedicated text node');
    const i = s.indexOf('data-antcv-app-line-text');
    const body = s.slice(i, i + 700);
    assert.ok(/contentEditable: ?!?0|contentEditable: ?true/.test(body), name + ': it is editable');
    assert.ok(body.includes('__antcvAlV'), name + ': model-changed-only ref, so an edit is not clobbered');
  }
});

test('an empty app line still renders, as a faded prompt, in the preview only', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('__alPh'), name + ': placeholder flag');
    assert.ok(s.includes('"Application line"'), name + ': prompt text');
    assert.ok(/opacity: ?__alPh ?\? ?0?\.45 ?: ?1/.test(s), name + ': the prompt is faded');
  }
  // the HTML export builder must still bail out on an empty line — the prompt is
  // preview-only, so an untouched app cannot print it.
  for (const [name, s] of BOTH) {
    assert.ok(/__antcvAppLineText\(\w+\)\s*:\s*""\s*;?\s*(?:\r?\n\s*)?if\s*\(!__al\)\s*return\s*""/.test(s),
      name + ': the srcdoc app-line builder still returns "" for empty');
  }
  assert.ok(!client.includes("out.app_line = 'Application line'"), 'the prompt is never forwarded to the DOCX');
});

test('committing the prompt or the composed sentence CLEARS the override', () => {
  for (const [name, s] of BOTH) {
    const i = s.indexOf('__alCommit');
    const body = s.slice(i, i + 1400);
    assert.ok(body.includes('__antcvAppLineComposed'), name + ': compares against the composed line');
    assert.ok(body.includes('removeItem("antcv:clAppLine")'), name + ': clears rather than storing ""');
  }
});

test('the commit strips any sidecar control text out of the node', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('__antcvEditableText'), name + ': helper present');
  }
  const i = src.indexOf('function __antcvEditableText');
  const body = src.slice(i, i + 700);
  assert.ok(body.includes('contenteditable="false"'), 'the injected control is excluded');
  assert.ok(body.includes('data-antcv-appline-rule-ctrl'), 'the rule control is excluded by name too');
});

test('export parity: the client forwards the override and the worker prefers it', () => {
  assert.ok(client.includes('out.app_line'), 'client forwards meta.app_line');
  assert.ok(client.includes("localStorage.getItem('antcv:clAppLine')"), 'from the same key');
  assert.ok(worker.includes('__m2.app_line'), 'worker reads it');
  const i = worker.indexOf('const __alOv = String(__m2.app_line');
  const body = worker.slice(i, i + 600);
  assert.ok(body.includes('if (!__alText && (__role || __company))'),
    'an override SHORT-CIRCUITS the composition instead of being overwritten by it');
});

// ------------------------------------------------------- SLOGAN-EDIT-EMPTY-001

test('an empty slogan renders a faded prompt in the preview instead of nothing', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('__slPh'), name + ': placeholder flag');
    assert.ok(s.includes('"Positioning line"'), name + ': prompt text');
    assert.ok(/opacity: ?__slPh ?\? ?0?\.45 ?: ?1/.test(s), name + ': faded');
  }
});

test('the slogan prompt can never ship — only the PREVIEW branch changed', () => {
  for (const [name, s] of BOTH) {
    // the export srcdoc branch still bails out on an empty slogan
    assert.ok(/test\(st\)\)\s*return\s*""/.test(s), name + ': srcdoc still returns "" for empty');
  }
});

test('clearing the slogan removes the key rather than storing an empty string', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('removeItem("antcv:clSlogan")'), name + ': cleared, not blanked');
  }
});

// ------------------------------------------------------- FONTSIZE-STEP-NAN-001

test('the size stepper falls back to the value the row displays', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('FONTSIZE-STEP-NAN-001'), name + ': the fix ships');
  }
  assert.ok(app.includes('ua=(e,t,d)=>'), 'app.js: the stepper takes the displayed default');
  assert.ok(src.includes('qr = (e, t, d) =>'), 'app.src.js mirror');
  assert.ok(count(app, 'ua(t,-.5,n)') === 1 && count(app, 'ua(t,.5,n)') === 1, 'app.js: both buttons pass it');
  assert.ok(count(src, 'qr(t, -0.5, n)') === 1 && count(src, 'qr(t, 0.5, n)') === 1, 'app.src.js: both buttons pass it');
});

test('a non-finite step is refused rather than persisted', () => {
  assert.ok(app.includes('if(!isFinite(__v))return n'), 'app.js: state unchanged on NaN');
  assert.ok(src.includes('if (!isFinite(__v)) return n'), 'app.src.js mirror');
});

test('set-all merges over the defaults so a partial object cannot drop a key', () => {
  assert.ok(app.includes('const __m={...ea,...(e&&"object"==typeof e?e:{})}'), 'app.js: pa merges');
  assert.ok(src.includes('const __m = { ...zr, ...(e && "object" == typeof e ? e : {}) }'), 'app.src.js mirror');
});
