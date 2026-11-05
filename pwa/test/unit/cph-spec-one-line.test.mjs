// cph-spec-one-line.test.mjs
// CPH-SPEC-ONE-LINE-001 (owner 2026-11-05 "header line feels very empty - text is pushed to
// second line"): the Copenhagen band's photo-clear cap (CPH-SPEC-PHOTO-CLEAR-001) wrapped a
// 489 px specialisation into a 370 px box, and SPEC-SHORTER then measured the WRAPPED box, so
// it never shrank the line. The sidecar now measures the one-line ink width with a nowrap
// probe and shrinks to the smaller of the name allowance and the photo-cleared width (floor
// 11 px) before the wrap applies. Owner font size still wins (shrink off, cap wraps).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../antcv-copenhagen-v2-001.js'), 'utf8');

const block = src.slice(src.indexOf('CPH-SPEC-ONE-LINE-001'), src.indexOf('CPH-SPEC-ONE-LINE-001') + 2200);

test('the shrink measures the one-line ink width with a nowrap probe', () => {
  assert.ok(block.includes("white-space:nowrap"), 'nowrap probe');
  assert.ok(block.includes('if (__w1 > 40) __Ws1 = __w1;'), 'probe width replaces the wrapped Range width');
});

test('the allowance is the smaller of the name allowance and the photo-cleared width', () => {
  assert.ok(block.includes('__allow = Math.min(__allow, __fit.specMaxW - 4)'), 'photo-clear width bounds the allowance');
  assert.ok(block.includes('__fit.specFs = Math.max(11, Math.min(18, Math.floor((__sfs * __allow / __Ws1) * 2) / 2))'), 'floor 11 px, fitted on the one-line width');
});

test('CPH-SPEC-ONE-LINE-001b: an explicit owner size is a ceiling - shrunk to one line only when it would wrap in the cap', () => {
  assert.ok(src.includes("var __ownerSpec = (typeof __fsOv.specialisation === 'number' && __fsOv.specialisation > 0);"), 'owner size detected, no longer a hard gate');
  assert.ok(src.includes('var __WsOwner = (__sfs > 0 && __Ws1 > 40) ? (__Ws1 * __ownerPx / __sfs) : 0;'), 'solved from the owner size (idempotent)');
  assert.ok(src.includes('__fit.specFs = Math.max(11, Math.min(__ownerPx, Math.floor((__ownerPx * __capW / __WsOwner) * 2) / 2));'), 'owner px is the ceiling, 11 px the floor');
  assert.ok(src.includes("if (__fit.specFs != null && (!__userSet('specialisation') || __fit.specShrunkOwner))"), 'the fitted size is emitted over an owner size only when shrunk for the cap');
  // worked example: owner 12 pt (16 px), 489 px line, 370 px cap -> 11.5 px, one line; a 300 px line keeps 16 px
  const ownerPx = 16, capW = 366;
  const fit = (Ws) => (Ws > capW ? Math.max(11, Math.min(ownerPx, Math.floor((ownerPx * capW / Ws) * 2) / 2)) : null);
  assert.equal(fit(489), 11.5);
  assert.equal(fit(300), null);
});

test('worked example: 489 px at 16 px inside a 370 px cap lands on 11.5 px, one line', () => {
  const Ws1 = 489, sfs = 16, specMaxW = 370, nameAllow = 0.92 * 500;
  const allow = Math.min(nameAllow, specMaxW - 4);
  const fs2 = Math.max(11, Math.min(18, Math.floor((sfs * allow / Ws1) * 2) / 2));
  assert.equal(fs2, 11.5);
  assert.ok(Ws1 * fs2 / sfs <= specMaxW, 'fits the cap on one line');
});
