// compression-linewidth-general.test.mjs
// ============================================================
// COMPRESSION-VS-LINE-WIDTH-001 + TONE-DEFAULT-SCANDINAVIAN-002 (owner 2026-07-03):
// "make sure the orphan fixes are not gabriel-limited and not just fit for
// unsolicited — a lesson learned in general about the allowed level of
// compression versus desired line width."
// (a) The general compression-floor rule lives in the UNCONDITIONAL
//     COMPRESSION-TIGHT push — every candidate, style, targeted + unsolicited.
// (b) The Nordic-template block (which carries LINE-FILL / LINE-FILL-SLOTS)
//     treats an ABSENT toneRegister as the app default (scandinavian) instead
//     of silently skipping fresh/demo sessions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

const count = (hay, needle) => hay.split(needle).length - 1;

test('the general compression-floor rule is in the UNCONDITIONAL push, once, in BOTH files', () => {
  for (const [name, code] of [['src', src], ['app.js', app]]) {
    assert.equal(count(code, 'COMPRESSION-VS-LINE-WIDTH-001'), 1, name + ': rule present once');
    const ct = code.indexOf('COMPRESSION — WRITE TIGHT');
    const gr = code.indexOf('COMPRESSION-VS-LINE-WIDTH-001');
    assert.equal(ct !== -1 && gr > ct && gr - ct < 2500, true,
      name + ': the rule extends the unconditional COMPRESSION-TIGHT string (not the tone-gated template block)');
    assert.equal(code.includes('targeted AND unsolicited alike'), true, name + ': explicit both-app-types wording');
  }
});

test('the Nordic template gate (LINE-FILL carrier) defaults ON when toneRegister is absent', () => {
  // src keeps readable spacing; app.js is minified — assert each file in its own shape
  assert.equal(count(src, 'let __nordic = true;'), 1, 'src gate defaults true');
  assert.equal(src.includes('__v == null || __v === "" || __v === "nordic-minimal" || __v === "scandinavian"'), true, 'src: empty stored value also counts as default');
  assert.equal(count(app, 'let __nordic=!0;'), 1, 'app.js gate defaults true');
  assert.equal(app.includes('null==__v||""===__v||"nordic-minimal"===__v||"scandinavian"===__v'), true, 'app.js: empty stored value also counts as default');
  // the old absent->skip shape must be gone
  assert.equal(count(src, 'let __nordic = false;'), 0);
  assert.equal(count(app, 'let __nordic=!1;'), 0);
});

test('LINE-FILL slots rule still present (nordic block) and the export preflight is persona-neutral', async () => {
  assert.equal(count(src, 'LINE-FILL-SLOTS-001'), 1);
  assert.equal(count(app, 'LINE-FILL-SLOTS-001'), 1);
  // the export preflight sidecar has no name guard and no unsolicited/targeted gate
  const pf = await readFile(new URL('../../antcv-orphan-export-preflight.js', import.meta.url), 'utf8');
  assert.equal(/\bgabriel\b/i.test(pf), false, 'preflight carries no persona guard');
  assert.equal(/unsolicited|targeted/i.test(pf.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')), false, 'preflight code has no app-type gate');
});
