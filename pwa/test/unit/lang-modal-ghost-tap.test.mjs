/* LANG-MODAL-GHOST-TAP-001 (owner 2026-07-10) mirror-lock.
 *
 * The _antcvChoice3 confirm modal (used by the language switch) "flashed" on the
 * preview screen: it opened then closed within a few ms because a trailing
 * pointerup/click from the SAME gesture that opened it auto-fired the freshly-
 * inserted primary button. MOB-006 had armed the BACKDROP after a delay but left
 * the BUTTON handlers synchronous. Fix: attach the button handlers inside a
 * setTimeout too, so a same-gesture ghost (fires within a few ms) is missed while
 * a real tap (seconds later) still lands.
 *
 * This test locks BOTH bundles: the source attaches the handlers inside a
 * setTimeout, and the minified mirror carries the delayed form (and NOT the bare
 * synchronous form).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
const MIN = fs.readFileSync(new URL('../../app.js', import.meta.url), 'utf8');

test('app.src.js: choice3 button handlers are attached inside a setTimeout (ghost-tap guard)', () => {
  assert.ok(SRC.includes('LANG-MODAL-GHOST-TAP-001'), 'source carries the LANG-MODAL-GHOST-TAP-001 marker');
  // the handler attachment must live inside a setTimeout, not run synchronously
  const m = SRC.match(/setTimeout\(\(\) => \{\s*\(\(t\.onclick = __act\), t\.addEventListener\("pointerup", __act\)\);\s*\}, 350\);/);
  assert.ok(m, 'source attaches (onclick + pointerup) inside setTimeout(...,350)');
});

test('app.js: minified mirror carries the delayed button-handler attachment', () => {
  const delayed = 'setTimeout(()=>{t.onclick=g,t.addEventListener("pointerup",g)},350)';
  assert.equal(MIN.split(delayed).length - 1, 1, 'exactly one delayed attachment present');
  // the bare synchronous form must be gone
  const bare = 't.onclick=g,t.addEventListener("pointerup",g)})()';
  assert.equal(MIN.split(bare).length - 1, 0, 'no bare synchronous attachment remains');
});

test('app.js: sacred-bundle invariants intact', () => {
  assert.ok(MIN.startsWith('(()=>{'), 'app.js starts with the IIFE head');
  assert.ok(!/^["']use strict/.test(MIN.slice(0, 40)), 'app.js has no "use strict"');
});
