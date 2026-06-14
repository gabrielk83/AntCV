// languages-prompt-pin.test.mjs
// ============================================================
// LANG-PIN-001 (owner 2026-06-14): the generation prompt escalated proficiency
// by JD country ("escalate professional to full professional if the JD is in a
// country where that language is dominant"), which inflated Gabriel's B1 Danish
// to "professional" and could drop Spanish. Replaced with an anti-inflation pin
// of the canonical set: EN/HE native, ES professional, DA B1, NO German.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
const min = readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('the proficiency-escalation rule is removed (source + minified)', () => {
  const bad = 'escalate "professional" to "full professional"';
  assert.ok(!src.includes(bad), 'app.src.js still has the escalation rule');
  assert.ok(!min.includes(bad), 'app.js still has the escalation rule');
});

test('the canonical language pin is present (source + minified)', () => {
  const pin = 'English (native), Hebrew (native), Spanish (professional), Danish (B1)';
  assert.ok(src.includes(pin), 'app.src.js missing the canonical language pin');
  assert.ok(min.includes(pin), 'app.js missing the canonical language pin');
  assert.ok(src.includes('there is NO German'), 'missing the no-German rule');
  assert.ok(src.includes('NEVER inflate or escalate'), 'missing the anti-inflation rule');
});
