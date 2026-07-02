// jd-targeted-meta-stick.test.mjs
// ============================================================
// JD-TARGETED-META-STICK-001 + SLOGAN-TARGETED-REFRESH-001 (owner 2026-07-03,
// the NIL application regression): a stale kernel-showcase stub pinned in
// Un.current by cloud-restore hijacked a JD-TARGETED generation — forced meta
// back to "Unsolicited" (header subtitle), leaked the stub into Additional
// signals and antcv:lastJdText, and left the CL slogan band on the standing
// unsolicited line. Src↔app.js parity anchors for all patched sites (terser
// preserves string/regex literal contents; a fix landing in one file but not
// the mirror breaks these).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PWA = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(PWA, 'app.src.js'), 'utf8');
const app = readFileSync(join(PWA, 'app.js'), 'utf8');

// Literal fragments that must exist in BOTH files after the patches.
const BOTH = [
  // P1 + P4a: the stub-shape regex guard
  '/^GENERAL CV [—–-] UNSOLICITED APPLICATION CONTEXT/i',
  // P3: the slogan-refresh auto-value key (new storage key)
  'antcv:clSloganAuto',
  // P4b/P4c: stub gates on the AUTO-COMMIT writers
  '/^Manual save/i',
];

test('every meta-stick anchor exists in app.src.js', () => {
  const missing = BOTH.filter((a) => !src.includes(a));
  assert.deepEqual(missing, [], `absent from app.src.js: ${missing.join(' | ')}`);
});

test('every meta-stick anchor exists in app.js (mirror in sync)', () => {
  const missing = BOTH.filter((a) => !app.includes(a));
  assert.deepEqual(missing, [], `absent from app.js — src edited but NOT mirrored: ${missing.join(' | ')}`);
});

test('P1: the stub-clear guard sits before the Additional-signals push in both files', () => {
  // src: guard then the push; app.js: guard expression then sn&&p.push(...)
  const srcIdxGuard = src.indexOf('UNSOLICITED APPLICATION CONTEXT/i.test(String(Un.current))');
  const srcIdxPush = src.indexOf('"Additional signals:\\n" + (Un.current || Ut)');
  assert.ok(srcIdxGuard > 0 && srcIdxPush > 0 && srcIdxGuard < srcIdxPush, 'src: guard must precede the signals push');
  const appIdxGuard = app.indexOf('UNSOLICITED APPLICATION CONTEXT/i.test(String(so.current))&&(so.current=null)');
  const appIdxPush = app.indexOf('"Additional signals:\\n"+(so.current||sn)');
  assert.ok(appIdxGuard > 0 && appIdxPush > 0 && appIdxGuard < appIdxPush, 'app.js: guard must precede the signals push');
});

test('P2: leftover showcase ref is gated on no-JD in both files', () => {
  assert.ok(src.includes('(!!(Un && Un.current) && __noJD)'), 'src P2 missing');
  assert.ok(app.includes('L.get("kernelShowcaseInProgress",!1)||so&&so.current&&g||g||'), 'app.js P2 missing');
});

test('P3: slogan refresh clears only the standing/auto value, in both files', () => {
  assert.ok(src.includes('localStorage.setItem("antcv:clSloganAuto", String(W.subtitle).trim())'), 'src P3 missing');
  assert.ok(app.includes('localStorage.setItem("antcv:clSloganAuto",String(q.subtitle).trim())'), 'app.js P3 missing');
});

test('P4c: AUTO-COMMIT lastJdText gate carries the stub startsWith checks in both files', () => {
  assert.ok(src.includes('!__jdT.startsWith("GENERAL CV")'), 'src P4c missing');
  assert.ok(app.includes('!$jdT.startsWith("GENERAL CV")'), 'app.js P4c missing');
});

test('app.js head invariants hold after the mirror edits', () => {
  assert.ok(app.trimStart().startsWith('(()=>{'));
  assert.equal(app.includes('use strict'), false);
});

// Behavioral spot-check of the P3 slogan guard logic (extracted verbatim
// semantics: clear only when current == standing specialization or == last
// auto value; a bespoke owner line is never touched).
function sloganGuard(store, W, specialization) {
  const __n = (s) => String(s || '').replace(/\s*[•*|]\s*/g, ' • ').trim().toUpperCase();
  if (W && W.company && 'Unsolicited' !== W.company && W.subtitle) {
    const __cur = __n(store.get('antcv:clSlogan'));
    const __std = __n(specialization);
    const __auto = __n(store.get('antcv:clSloganAuto'));
    if (__cur && (__cur === __std || __cur === __auto)) {
      store.set('antcv:clSlogan', '');
      store.set('antcv:clSloganAuto', String(W.subtitle).trim());
    }
  }
}

test('slogan guard: standing unsolicited line is cleared on a targeted gen', () => {
  const store = new Map([['antcv:clSlogan', 'PROCESSES • PRODUCTS • PEOPLE']]);
  sloganGuard(store, { company: 'NIL Technology', subtitle: 'Nanofabrication • Optics • Prototyping' }, 'Processes • Products • People');
  assert.equal(store.get('antcv:clSlogan'), '');
  assert.equal(store.get('antcv:clSloganAuto'), 'Nanofabrication • Optics • Prototyping');
});

test('slogan guard: a bespoke manual owner line survives', () => {
  const store = new Map([['antcv:clSlogan', 'MY HAND-WRITTEN LINE']]);
  sloganGuard(store, { company: 'NIL Technology', subtitle: 'Nanofabrication • Optics • Prototyping' }, 'Processes • Products • People');
  assert.equal(store.get('antcv:clSlogan'), 'MY HAND-WRITTEN LINE');
});

test('slogan guard: unsolicited gen never touches the override', () => {
  const store = new Map([['antcv:clSlogan', 'PROCESSES • PRODUCTS • PEOPLE']]);
  sloganGuard(store, { company: 'Unsolicited', subtitle: 'X • Y • Z' }, 'Processes • Products • People');
  assert.equal(store.get('antcv:clSlogan'), 'PROCESSES • PRODUCTS • PEOPLE');
});

test('slogan guard: a prior auto value is refreshed on the NEXT targeted gen', () => {
  const store = new Map([
    ['antcv:clSlogan', 'NANOFABRICATION • OPTICS • PROTOTYPING'],
    ['antcv:clSloganAuto', 'Nanofabrication • Optics • Prototyping'],
  ]);
  sloganGuard(store, { company: 'Vestas', subtitle: 'Turbines • Control • Delivery' }, 'Processes • Products • People');
  assert.equal(store.get('antcv:clSlogan'), '');
  assert.equal(store.get('antcv:clSloganAuto'), 'Turbines • Control • Delivery');
});
