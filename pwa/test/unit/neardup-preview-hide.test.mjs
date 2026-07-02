// neardup-preview-hide.test.mjs
// ============================================================
// PAN-IDRAET-PREVIEW-HIDE-001: the preview visually hides the SAME within-role
// near-dup bullets the export collapses — via the export's OWN predicate
// (window.AntcvCollapseRoleBullets), index-safe (display:none, no reindex).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-neardup-preview-hide.js', import.meta.url), 'utf8');
const { _collapseRoleBullets } = await import('../../antcv-docx-client.js');

function load() {
  const sandbox = {
    window: { addEventListener() {}, AntcvCollapseRoleBullets: _collapseRoleBullets },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { body: {}, querySelectorAll: () => [] },
    MutationObserver: function () { this.observe = () => {}; },
    setTimeout() { return 0; }, clearTimeout() {},
    console, JSON, Array, Object, String, Number, RegExp,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AntcvNeardupPreviewHide;
}

// The real owner pair (export half's own fixture): near-dup "about 25" vs "25".
const B1 = 'Manage logistics for about 25 players and coaches, including travel and equipment';
const B2 = 'Coordinate match scheduling and referee assignments across the season';
const B3 = 'Manage logistics for 25 players, including travel bookings';

test('hides exactly the bullet the EXPORT drops (cleaner line wins), via the export predicate', () => {
  const api = load();
  const hidden = api._computeHidden([B1, B2, B3], _collapseRoleBullets);
  assert.equal(Array.from(hidden).join(","), "0", 'the "about 25" loser is hidden; the cleaner "25" line and the distinct bullet stay');
});

test('distinct bullets: nothing hidden', () => {
  const api = load();
  assert.equal(Array.from(api._computeHidden([
    'Build and maintain the CI pipeline and release automation',
    B2,
    'Author acceptance criteria and lead sprint reviews with stakeholders',
  ], _collapseRoleBullets)).join(","), "");
});

test('KEEP_MIN parity: a 2-bullet near-dup role hides NOTHING (matches the export floor)', () => {
  const api = load();
  assert.equal(Array.from(api._computeHidden([B1, B3], _collapseRoleBullets)).join(","), "");
});

test('true duplicate texts consume one-to-one (no double hide)', () => {
  const api = load();
  const hidden = api._computeHidden([B2, B2, B1, B3], _collapseRoleBullets);
  // whatever the predicate decides, indexes must be unique and within range
  assert.equal(new Set(hidden).size, hidden.length);
  hidden.forEach((i) => assert.ok(i >= 0 && i < 4));
});

test('no predicate / short lists: never hides', () => {
  const api = load();
  assert.equal(Array.from(api._computeHidden([B1, B3], null)).join(","), "");
  assert.equal(Array.from(api._computeHidden([B1], _collapseRoleBullets)).join(","), "");
});
