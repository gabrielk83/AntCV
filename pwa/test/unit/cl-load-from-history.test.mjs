// cl-load-from-history.test.mjs
// ============================================================
// The 2026-07-29 owner report on loading an application from the preview topbar's
// Application History (all six symptoms traced to real data in production D1):
//
//   SLOGAN-PLACEMENT-PERAPP-001  the CL slogan came back EMPTY. antcv:clSloganMode /
//                                antcv:clSloganHidden are GLOBAL sticky keys no load
//                                path reset, and the per-app placement the generator
//                                decided (meta.slogan_placement) was never read — so
//                                one 'leadin' app hid the tagline for every app after.
//   SUBTITLE-PI-FALLBACK-001     the specialisation line vanished. The nightly writes a
//                                MINIMAL meta with no subtitle and several rows carry an
//                                empty `subtitle` column, so __su resolved to "".
//   PALETTE-STICK-CLEAR-APPLOAD-001  colours locked to the first branded app. The
//                                JD-list Open path clears brand state symmetrically;
//                                the two Application-History loaders never did.
//   APPLINE-RULE-NATIVE-001      the rule under the application line blinked — the
//                                sidecar wrote it as an inline style on a React node.
//   SLOGAN-RULE-MISTARGET-001    a rule appeared under the OPENING — the slogan finder
//                                fell back to "first contenteditable in the CL flow".
//   CL-V5-CONTRIB-3-CLOSE-001 /  contribute shipped a lead + 2 unlabelled bullets and no
//   CL-V5-WHO-GOAL-001           closing; WHO I AM shipped without its "My goal" row.
//
// Asserts on the shipped files (source + minified mirror) and on the sidecar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const src = await readFile(here('../../app.src.js'), 'utf8');
const app = await readFile(here('../../app.js'), 'utf8');
const rule = await readFile(here('../../antcv-appline-rule.js'), 'utf8');

const BOTH = [['app.src.js', src], ['app.js', app]];
const count = (s, needle) => s.split(needle).length - 1;

// ------------------------------------------------- SLOGAN-PLACEMENT-PERAPP-001

test('both files define __antcvApplySloganPlacement and export it on window', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('function __antcvApplySloganPlacement'), name + ': helper defined');
    assert.ok(s.includes('window.__antcvApplySloganPlacement'), name + ': exported');
  }
});

test('the placement helper maps meta.slogan_placement and drops a sticky hide', () => {
  for (const [name, s] of BOTH) {
    const i = s.indexOf('function __antcvApplySloganPlacement');
    const body = s.slice(i, i + 500);
    assert.ok(body.includes('slogan_placement'), name + ': reads the per-app placement');
    assert.ok(body.includes('antcv:clSloganMode'), name + ': writes the mode key');
    assert.ok(/removeItem\(["']antcv:clSloganHidden["']\)/.test(body), name + ': clears the sticky hide');
  }
});

test('BOTH Application-History loaders call the placement helper', () => {
  for (const [name, s] of BOTH) {
    assert.equal(count(s, 'window.__antcvApplySloganPlacement(n.meta)'), 2,
      name + ': settings loader + topbar loader');
  }
});

// ------------------------------------------------------ SUBTITLE-PI-FALLBACK-001

test('both files define __antcvPiSpec and export it', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('function __antcvPiSpec'), name + ': helper defined');
    assert.ok(s.includes('window.__antcvPiSpec'), name + ': exported');
  }
});

test('the subtitle restore falls back to personalInfo.specialization', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('window.__antcvPiSpec ? window.__antcvPiSpec() : ""') ||
              s.includes('window.__antcvPiSpec?window.__antcvPiSpec():""'),
      name + ': the loader uses the global-specialisation fallback');
  }
});

test('__antcvPiSpec never returns a bracket placeholder', () => {
  const i = src.indexOf('function __antcvPiSpec');
  const body = src.slice(i, i + 400);
  assert.ok(body.includes('/^\\[/.test(s)'), 'a "[…]" specialisation resolves to ""');
});

// --------------------------------------------- PALETTE-STICK-CLEAR-APPLOAD-001

test('BOTH Application-History loaders reset brand state before re-applying', () => {
  for (const [name, s] of BOTH) {
    assert.equal(count(s, 'PALETTE-STICK-CLEAR-APPLOAD-001'), 2, name + ': both loaders marked');
  }
  // the clear must come from the loader, not only from the JD-list Open path
  const clears = count(src, 'window.__antcvBrandFit = !1; localStorage.removeItem("antcv:brandV2");');
  assert.ok(clears >= 2, 'app.src.js: both loaders clear the flag AND the global brand slots');
});

test('the loader re-applies only THIS app\'s own brand', () => {
  const i = src.indexOf('PALETTE-STICK-CLEAR-APPLOAD-001');
  const body = src.slice(i, i + 1800);
  assert.ok(body.includes('n.meta && n.meta.brandV2'), 'prefers the per-app fitted brandV2');
  assert.ok(body.includes('n.meta && n.meta.styleConfig'), 'else maps the per-app styleConfig slots');
  assert.ok(body.includes('__bvA.slots.headerBg'), 'a slotless/headerless brand is not armed');
});

// ------------------------------------------------------ APPLINE-RULE-NATIVE-001

test('the application-line rule is rendered natively, from headerItemRule', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('function __antcvAppLineRuleStyle'), name + ': helper defined');
    assert.ok(s.includes('window.__antcvAppLineRuleStyle'), name + ': exported + used by the render');
  }
  const i = src.indexOf('function __antcvAppLineRuleStyle');
  const body = src.slice(i, i + 900);
  assert.ok(body.includes('headerItemRule'), 'reads the per-field rule store');
  assert.ok(body.includes('antcv:applineRule'), 'honours the legacy store as a fallback');
  assert.ok(body.includes('if (v.on === false) return {}'), 'an explicit user OFF is respected');
  assert.ok(body.includes('borderBottom'), 'emits the border');
});

test('the native app-line node carries position:relative so the sidecar never writes it', () => {
  for (const [name, s] of BOTH) {
    const i = s.indexOf('data-antcv-app-line-native');
    const body = s.slice(i, i + 2200);
    assert.ok(/position: ?"relative"/.test(body), name + ': position is owned by React');
    assert.ok(body.includes('__antcvAppLineRuleStyle'), name + ': the rule style is spread in');
  }
});

test('the sidecar no longer paints a border on the native node', () => {
  assert.ok(rule.includes("if (el.hasAttribute('data-antcv-app-line-native')) return;"),
    'renderRule bails out for the React-owned line');
  const i = rule.indexOf('function renderRule');
  const guard = rule.indexOf("hasAttribute('data-antcv-app-line-native')");
  const paint = rule.indexOf("setProperty('border-bottom'", i);
  assert.ok(guard > i && guard < paint, 'the guard runs BEFORE any border write');
});

// ----------------------------------------------------- SLOGAN-RULE-MISTARGET-001

test('the native slogan node carries a dedicated marker', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('data-antcv-cl-slogan-native'), name + ': slogan marker present');
  }
});

test('the slogan finder never falls back to a generic contenteditable', () => {
  const i = rule.indexOf('function sloganEl');
  const body = rule.slice(i, i + 500);
  assert.ok(body.includes('data-antcv-cl-slogan-native'), 'matches the native slogan node');
  assert.ok(!body.includes('[contenteditable]'), 'the opening-paragraph fallback is gone');
});

// -------------------------------------------------- CL-V5-CONTRIB-3-CLOSE-001

test('the contribute skeleton is lead + 3 bullets + a plain closing row', () => {
  for (const [name, s] of BOTH) {
    assert.ok(!s.includes('[Team trust - short label]'), name + ': the 4th bullet is gone');
    assert.ok(s.includes('CLOSING GOAL LINE'), name + ': the closing row is in the skeleton');
  }
});

test('the apply chain projects contribute onto lead + <=3 bullets + closing', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('CL-V5-CONTRIB-3-CLOSE-001'), name + ': the projection ships');
  }
  const at = src.indexOf('const __cRow');
  const body = src.slice(at - 200, at + 2600);
  assert.ok(body.includes('.slice(0, 3)'), 'bullets are capped at three');
  assert.ok(body.includes('contribute_closing'), 'the closing line is resolved');
  assert.ok(body.includes('type: "rich_block"'), 'the result is a rich_block the preview renders');
});

test('the prompts ask for exactly three contribute bullets and a mandatory closing', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('EXACTLY THREE contribute_items'), name + ': nordic rule locked to 3');
    assert.ok(s.includes('contribute_items: EXACTLY 3 bullets'), name + ': schema locked to 3');
    assert.ok(s.includes('"contribute_items":["b1","b2","b3"]'), name + ': the example shows 3');
    assert.ok(!s.includes('"contribute_items":["b1","b2","b3","b4"]'), name + ': no 4-bullet example');
    assert.ok(s.includes('contribute_closing is MANDATORY'), name + ': the closing is required');
  }
});

// ------------------------------------------------------- CL-V5-WHO-GOAL-001

test('who_goal is scored on its own so a goal-less draft is retried', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes('CL-V5-WHO-GOAL-001'), name + ': the gate change ships');
    assert.ok(s.includes('/7 critical CL fields filled'), name + ': the gate counts 7 fields');
    assert.ok(!s.includes('/6 critical CL fields filled'), name + ': the old 6-field message is gone');
  }
  assert.ok(!src.includes('t(e.who_operate) || t(e.who_goal)'),
    'app.src.js: who_goal is no longer OR-swallowed by who_operate');
  assert.ok(!app.includes('t(e.who_operate)||t(e.who_goal)'),
    'app.js: who_goal is no longer OR-swallowed by who_operate');
});

test('the v5 prompt marks who_goal mandatory', () => {
  for (const [name, s] of BOTH) {
    assert.ok(s.includes("who_goal ('My goal') is MANDATORY"), name + ': stated in the sequence rule');
  }
});
