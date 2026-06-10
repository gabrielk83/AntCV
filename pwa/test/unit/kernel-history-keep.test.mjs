// kernel-history-keep.test.mjs
// ============================================================
// KERNEL-HISTORY-KEEP-001 (owner 2026-06-10): the unsolicited / kernel showcase
// row dropped out of the application-history dropdown once enough tailored apps
// accumulated (the dropdown showed only Dl.slice(0,5)). The fix pins the
// unsolicited row FIRST, then up to 5 company-named apps. Mirror of that
// display-list logic (app.src.js topbar dropdown).

import { test } from 'node:test';
import assert from 'node:assert/strict';

function isUnsol(a) {
  const c = String((a && a.jd_company) || '').trim().toLowerCase();
  return c === '' || c === 'unsolicited';
}
// Mirror of the dropdown display-list builder.
function displayList(Dl) {
  const unsol = Dl.find(isUnsol);
  const others = Dl.filter((a) => a && a !== unsol);
  return unsol ? [unsol, ...others.slice(0, 5)] : others.slice(0, 5);
}

const real = (id, co) => ({ id, jd_company: co });
const kernel = (id) => ({ id, jd_company: 'Unsolicited' });

test('kernel pinned first when many tailored apps exist (was dropping)', () => {
  const Dl = [real(1, 'A'), real(2, 'B'), real(3, 'C'), real(4, 'D'), real(5, 'E'), real(6, 'F'), kernel(99)];
  const shown = displayList(Dl);
  assert.equal(shown[0].id, 99, 'kernel pinned first');
  assert.ok(shown.some((a) => a.id === 99), 'kernel always present');
  assert.equal(shown.length, 6, 'kernel + 5 others');
});

test('kernel kept even at 3 tailored apps', () => {
  const Dl = [real(1, 'A'), real(2, 'B'), real(3, 'C'), kernel(99)];
  const shown = displayList(Dl);
  assert.ok(shown.some((a) => a.id === 99));
  assert.equal(shown[0].id, 99);
});

test('empty-company row treated as kernel', () => {
  const Dl = [real(1, 'A'), { id: 7, jd_company: '' }];
  assert.equal(displayList(Dl)[0].id, 7);
});

test('no kernel row → just newest 5 company apps', () => {
  const Dl = [real(1, 'A'), real(2, 'B'), real(3, 'C'), real(4, 'D'), real(5, 'E'), real(6, 'F')];
  const shown = displayList(Dl);
  assert.equal(shown.length, 5);
  assert.ok(!shown.some(isUnsol));
});

test('kernel not duplicated when already among the first rows', () => {
  const Dl = [kernel(99), real(1, 'A'), real(2, 'B')];
  const shown = displayList(Dl);
  assert.equal(shown.filter((a) => a.id === 99).length, 1);
});
