// sid-fallback-harden.test.mjs
// ============================================================
// SID-FALLBACK-HARDEN-001 (register row 16): sidecars 234/247/249 carried the
// same latent giant-container grab that 237 fixed in 1.51.60
// (OUTCOMES-PREVIEW-MISMATCH-001) — when the target section is ABSENT, a
// text-regex DOM fallback over `section, div` matched a huge app container
// and the control stamped styles across everything inside it (the
// center<->left flicker loop class). Hardened to 237's pattern:
//   - DATA gate: no section in the stored data -> return null, touch nothing;
//   - DOM fallback accepts [data-sid] hosts ONLY (never arbitrary divs);
//   - 247's header scan additionally requires a SHORT own text (a real
//     header), not any container whose full text contains the phrase.
// String-locks all four sidecars (237 as the reference invariant).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const f234 = await readFile(new URL('../../antcv-core-competencies-row-controls-234.js', import.meta.url), 'utf8');
const f247 = await readFile(new URL('../../antcv-additional-info-row-controls-247.js', import.meta.url), 'utf8');
const f249 = await readFile(new URL('../../antcv-what-i-bring-header-cjlr-249.js', import.meta.url), 'utf8');
const f237 = await readFile(new URL('../../antcv-selected-outcomes-row-controls-237.js', import.meta.url), 'utf8');

test('all four sidecars still parse', () => {
  for (const s of [f234, f247, f249, f237]) assert.doesNotThrow(() => new vm.Script(s));
});

test('234: data-gate + [data-sid]-only fallback, no section/div grab', () => {
  assert.match(f234, /if\(!coreSection\(\)\) return null;/);
  assert.ok(!f234.includes("querySelectorAll('[data-sid], section, div')"), 'loose selector removed');
  assert.match(f234, /querySelectorAll\('\[data-sid\]'\)/);
});

test('249: data-gate + [data-sid]-only fallback, no section/div grab', () => {
  assert.match(f249, /if\(!coreSection\(\)\)return null;/);
  assert.ok(!f249.includes("querySelectorAll('[data-sid],section,div')"), 'loose selector removed');
  assert.match(f249, /querySelectorAll\('\[data-sid\]'\)/);
});

test('247: data-gate + short-own-text header requirement', () => {
  assert.match(f247, /if \(!findAdditionalSection\(\)\) return null;/);
  assert.match(f247, /t\.length <= 48 && \/additional information\/i\.test\(t\)/);
});

test('237 reference invariant unchanged (the pattern source)', () => {
  assert.match(f237, /if\(!outcomeSection\(\)\)return null;/);
  assert.ok(!/querySelectorAll\('\[data-sid\],\s*section,\s*div'\)/.test(f237));
});
