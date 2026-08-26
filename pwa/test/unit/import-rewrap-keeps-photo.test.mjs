// import-rewrap-keeps-photo.test.mjs
// ============================================================
// IMPORT-REWRAP-DROPS-PHOTO-001 (2026-08-26 desktop nightly, register row 18).
//
// The settings JSON import accepts BOTH shapes: the app's own export
// ({ photo, navyColor, personalInfo: {...} }) and a bare, UNWRAPPED
// personalInfo blob pasted by hand (what docs/personas/*/personalInfo.json is).
// For the unwrapped shape it REWRAPS: `n = { personalInfo: n }`.
//
// The bug: that rewrap ran BEFORE the sibling reads further down the same
// comma-expression (`n.photo && (setPhoto(n.photo), store.set('photo', n.photo))`).
// After the rewrap `n.photo` is undefined, so a top-level `photo` carried by an
// unwrapped blob was silently DISCARDED — the import reported success and the
// profile photo never arrived.
//
// Why it mattered: register row 18 ("Anita demo: docx missing photo + PDF contact
// placement"). Both legs are ONE state — no photo. The docx worker is innocent:
// every band-overlap bridge element (float, contact indent 2592/-216, 8.5pt,
// tracking -10, sidebar spacer) is correctly gated on `pi.photo_b64`
// (workers/docx-worker/test/diag-photo-absent-gating.mjs pins that). And the
// prescribed remedy — "re-import the persona, hard refresh, re-export" — could
// never work, because the persona blob is unwrapped and its photo was dropped.
//
// Fix: build the wrapper from the PRE-rewrap object, carrying `photo` across.
// Both bundles. This test locks the behaviour AND the minified mirror.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcJs = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const minJs = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

// The guard, transcribed from pwa/app.src.js (the settings-import block). Kept
// as a faithful transcription so the behavioural cases below describe the real
// control flow; the two static tests at the end are what pin the real bundles.
function rewrap(blob) {
  let n = JSON.parse(JSON.stringify(blob));
  if (
    !n || 'object' != typeof n || Array.isArray(n) || n.personalInfo || n.apiKey || n.proxyUrl ||
    ('string' != typeof n.name && 'string' != typeof n.email && 'string' != typeof n.phone &&
      !Array.isArray(n.experience) && !Array.isArray(n.workHistory))
  ) {
    // not an unwrapped personalInfo — left alone
  } else {
    n = n.photo ? { personalInfo: n, photo: n.photo } : { personalInfo: n };
  }
  return n;
}

const PHOTO = 'data:image/jpeg;base64,AAAA';

test('unwrapped personalInfo carrying a photo: the photo survives the rewrap', () => {
  const out = rewrap({ name: 'Anita Myre-Kornfeldt', email: 'a@b.c', photo: PHOTO });
  assert.equal(out.photo, PHOTO, 'top-level photo must survive');
  assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt', 'the blob still becomes personalInfo');
});

test('unwrapped personalInfo with NO photo: no stray photo key is invented', () => {
  const out = rewrap({ name: 'Anita Myre-Kornfeldt', email: 'a@b.c' });
  assert.equal('photo' in out, false, 'must not add photo:undefined to the wrapper');
  assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt');
});

test('already-wrapped app-export shape is untouched (photo still read)', () => {
  const out = rewrap({ photo: PHOTO, personalInfo: { name: 'Anita Myre-Kornfeldt' } });
  assert.equal(out.photo, PHOTO);
  assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt');
  assert.equal(out.personalInfo.personalInfo, undefined, 'must not double-wrap');
});

test('the real Anita persona blob takes the rewrap path (it is unwrapped)', async () => {
  const anita = JSON.parse(await readFile(
    new URL('../../../docs/personas/anita/personalInfo.json', import.meta.url), 'utf8'));
  assert.equal(anita.personalInfo, undefined, 'persona file is an UNWRAPPED personalInfo');
  const out = rewrap(anita);
  assert.equal(out.personalInfo.name, 'Anita Myre-Kornfeldt', 'rewrap path confirmed');
  // Whatever the persona ships, an import of it must not lose its photo.
  if (anita.photo) assert.equal(out.photo, anita.photo, 'persona photo must reach the app');
});

test('NEGATIVE CONTROL: the OLD unconditional rewrap really did drop the photo', () => {
  // Sabotage a copy of the fixed expression back to what shipped before, and
  // assert the sabotage is observable — otherwise the tests above prove nothing.
  const old = (blob) => {
    let n = JSON.parse(JSON.stringify(blob));
    n = { personalInfo: n };
    return n;
  };
  const out = old({ name: 'Anita Myre-Kornfeldt', photo: PHOTO });
  assert.equal(out.photo, undefined, 'the pre-fix expression drops the photo (bug reproduced)');
});

test('app.src.js: the rewrap carries photo across', () => {
  const hits = srcJs.split('personalInfo: n, photo: n.photo').length - 1;
  assert.equal(hits, 1, 'exactly one photo-carrying rewrap in app.src.js');
  assert.equal(srcJs.includes('(n = { personalInfo: n })'), false,
    'the old unconditional rewrap must be gone');
});

test('app.js (minified mirror): the rewrap carries photo across', () => {
  const hits = minJs.split('n=n.photo?{personalInfo:n,photo:n.photo}:{personalInfo:n}').length - 1;
  assert.equal(hits, 1, 'exactly one photo-carrying rewrap in app.js');
  // The bare old form must not remain as a standalone statement. It DOES appear
  // as the ternary's else-branch, so assert on the assignment form instead.
  assert.equal(minJs.includes(',n={personalInfo:n}'), false,
    'the old unconditional minified rewrap must be gone');
});
