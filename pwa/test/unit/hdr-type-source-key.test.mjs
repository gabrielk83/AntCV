// hdr-type-source-key.test.mjs
// ============================================================
// Owner 2026-07-29 follow-up: "font size resizing and compression is not doing
// anything in the preview" and "the horizontal line before why this company is
// still visible".
//
//   HDR-TYPE-SOURCE-KEY-001  the copenhagen band emits size + letter-spacing with
//                            !important but read them from styleConfig.fontSizes, a
//                            legacy mirror that is normally absent — while the panel
//                            writes the canonical top-level `fontSizes`. So the band
//                            always shipped its 23/18/13px defaults over whatever the
//                            user set, and every tracking delta resolved to 0.
//   HDR-TYPE-USER-WINS-001   even with the right key, the measured fit is emitted last
//                            and overwrote the panel size. A line moved OFF its default
//                            is no longer re-fitted.
//   (repaint)                nothing fired sections-updated on a panel change and
//                            `storage` never fires in the writing tab, so the stylesheet
//                            was never rebuilt. The three fontSizes setters now dispatch
//                            antcv:fontsizes-changed and the sidecar listens.
//   WHY-RULE-DEFAULT-OFF-001 the rule above WHY is antcv-cl-text-cleanup stamping
//                            headlineRule:true on the `why` section (Item 8), which
//                            app.js renders — NOT the slogan rule. Hidden by default now.
//   CL-V5-CONTRIB-3-CLOSE-001 ensureContribStructure un-marked the last row
//                            unconditionally, demoting the 3rd bullet when no closing row
//                            existed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const cph = await readFile(here('../../antcv-copenhagen-v2-001.js'), 'utf8');
const clean = await readFile(here('../../antcv-cl-text-cleanup.js'), 'utf8');
const app = await readFile(here('../../app.js'), 'utf8');
const src = await readFile(here('../../app.src.js'), 'utf8');

const count = (s, n) => s.split(n).length - 1;

// ------------------------------------------------- HDR-TYPE-SOURCE-KEY-001

test('the band reads the CANONICAL fontSizes store, not the styleConfig mirror', () => {
  const i = cph.indexOf('var __fsOv0 = {}');
  const body = cph.slice(i, i + 1000);
  assert.ok(body.includes('window.__antcvFontPrefs'), 'prefers the app-exported canonical reader');
  assert.ok(body.includes("localStorage.getItem('fontSizes')"), 'falls back to the canonical key directly');
  const canonAt = body.indexOf("getItem('fontSizes')");
  const legacyAt = body.indexOf("getItem('styleConfig')");
  assert.ok(canonAt > -1 && legacyAt > canonAt, 'styleConfig.fontSizes is only a FALLBACK now');
});

test('an empty canonical store still falls through to the legacy mirrors', () => {
  const i = cph.indexOf('var __fsOv0 = {}');
  const body = cph.slice(i, i + 1000);
  assert.ok(body.includes('Object.keys(__canon).length'), 'an empty {} does not shadow the fallback');
});

// -------------------------------------------------- HDR-TYPE-USER-WINS-001

test('a panel size moved off the default suppresses the measured fit for that line', () => {
  assert.equal(count(cph, '__userSet('), 3, 'name, contact and spec are all gated');
  assert.ok(cph.includes("!__userSet('nameSize')"), 'name fit yields to the panel');
  assert.ok(cph.includes("!__userSet('contactSize')"), 'contact fit yields to the panel');
  assert.ok(cph.includes("!__userSet('specialisation')"), 'spec fit yields to the panel');
});

test('"user set it" means differs-from-default, not merely present', () => {
  const i = cph.indexOf('var __userSet');
  const body = cph.slice(i, i + 320);
  assert.ok(body.includes('__DEF[k].indexOf(v) < 0'), 'compares against the app defaults');
  assert.ok(cph.includes('contactSize: [9, 10]'), 'both historic contact defaults count as default');
});

// ------------------------------------------------------------- repaint

test('the three fontSizes setters announce a change', () => {
  assert.equal(count(app, 'antcv:fontsizes-changed'), 3, 'app.js: set-all + size step + tracking step');
  assert.equal(count(src, 'antcv:fontsizes-changed'), 3, 'app.src.js mirror');
});

test('the band sidecar rebuilds on that announcement', () => {
  assert.ok(cph.includes("window.addEventListener('antcv:fontsizes-changed', apply)"), 'listener wired');
  assert.ok(cph.includes("e.key === 'fontSizes'"), 'cross-tab storage writes repaint too');
});

// ------------------------------------------------- WHY-RULE-DEFAULT-OFF-001

test('the why-section rule is no longer auto-stamped on', () => {
  assert.ok(!clean.includes('sec.headlineRule = true'), 'nothing turns the rule on any more');
  assert.ok(clean.includes('function ensureWhyRuleOff'), 'the healer replaced ensureWhyVRule');
  assert.ok(!clean.includes('ensureWhyVRule'), 'the old name is gone from the call site too');
});

test('the healer only undoes the rule THIS sidecar set, and is a one-shot', () => {
  const i = clean.indexOf('function ensureWhyRuleOff');
  const body = clean.slice(i, i + 700);
  assert.ok(body.includes('sec.__whyRuleSet === true'), 'a user-set rule is left alone');
  assert.ok(body.includes('sec.headlineRule = false'), 'the auto rule is cleared');
  assert.ok(body.includes('delete sec.__whyRuleSet'), 'the marker is dropped so it converges');
});

test('app.js still renders headlineRule — so clearing it is what hides the line', () => {
  assert.ok(app.includes('t.headlineRule&&'), 'the render leg exists and reads the flag');
});

// ---------------------------------------------- CL-V5-CONTRIB-3-CLOSE-001

test('the contribute last-row un-mark needs a real closing row to exist', () => {
  const i = clean.indexOf('function ensureContribStructure');
  const body = clean.slice(i, i + 1400);
  assert.ok(body.includes('sec.items.length >= 5'), 'lead + 3 bullets + closing before demoting the last row');
});
