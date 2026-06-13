// demo-badge-setup.test.mjs
// ============================================================
// DEMO-BADGE-SETUP-001 (owner 2026-06-13): an active demo user must see the
// 🟡 DEMO badge in the setup/landing header (the "set menu"), not only in
// settings + editor. The live render needs the server /config (B.demo_mode)
// which the headless harness can't populate without real auth, so this is a
// structural lock on the built bundle:
//   - the new setup-header badge (unique title) exists;
//   - there are now TWO 🟡 DEMO badge sites (editor topbar + setup), where
//     there used to be one;
//   - the gate is __antcvDemoActive() (same predicate as the working editor
//     and settings badges).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('DEMO-BADGE-SETUP-001 — setup-header badge present in the bundle', () => {
  // unique title of the setup-step badge (string literal survives minification;
  // the gating predicate itself is minified so it is not asserted by name).
  assert.ok(bundle.includes('your account uses the shared demo worker'),
    'setup-header demo badge title missing from bundle');
});

test('DEMO-BADGE-SETUP-001 — two 🟡 DEMO badge sites (editor topbar + setup)', () => {
  const n = (bundle.match(/🟡 DEMO/g) || []).length;
  assert.equal(n, 2, `expected 2 "🟡 DEMO" badge sites, found ${n}`);
});
