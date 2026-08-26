// jobtracker-closed-filter.test.mjs
// ============================================================
// JOBLIST-FILTER-002 — owner-reported 2026-08-26: "the archived/closed filter is
// not checked in and still the first two postings visible are archived closed
// ones". Root cause: the Job List filter gated on the row's BAND only, while a
// row can be closed by its TRACKED STATUS and keep its original T1/T2/T3 band.
// The status dropdown never touches the band, so band alone was never a sound
// test for closed-ness — and Top-5 already knew that (isClosedRow), the list
// filter just did not use it.
//
// Also adds a ⛔ Rejected bucket with its own checkbox, default OFF.
//
// These exercise the REAL predicate from rowVisibility.ts (standalone and
// import-free, so Node's type-stripping loader can load it), not a regex over
// the source. The last test pins that the shipped bundle was rebuilt from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  passesTierFilter, closedBucket, isClosedRow, isRejectedRow, ARCHIVE_BAND,
} from '../../../src/islands/JobTracker/rowVisibility.ts';

const BAND_KEYS = ['DDEBF7', 'E2EFDA', 'FCE4D6', 'FFF2CC', 'D9D9D9'];
const DEFAULT_BANDS = BAND_KEYS.filter((b) => b !== 'D9D9D9'); // Archive unchecked

// [rank, company, role, loc, commute, group, fit, posting, TRACKED, next, FLAG, uk, BAND]
function row({ tracked = 'Identified (posting saved)', flag = '', band = 'DDEBF7' } = {}) {
  return [1, 'NVIDIA', 'Optical System Engineer, Validation', 'Denmark', '', '', '',
    'OPEN', tracked, 'Tailor', flag, 'uk1', band];
}

const shown = (r, bands = DEFAULT_BANDS, showRejected = false) =>
  passesTierFilter(r, bands, showRejected, BAND_KEYS);

// ---- THE REPORTED BUG ------------------------------------------------------
// Exactly the two rows from the owner's screenshot: T1 band, "Archive / closed"
// status, Archive swatch unchecked. Before the fix these passed the filter.
test('THE BUG: a T1-banded row with an "Archive / closed" STATUS is hidden when Archive is unchecked', () => {
  const r = row({ tracked: 'Archive / closed', band: 'DDEBF7' });
  assert.equal(shown(r), false);
});

test('THE BUG, tier 2: same row at T2 is hidden too', () => {
  assert.equal(shown(row({ tracked: 'Archive / closed', band: 'E2EFDA' })), false);
});

test('ticking the Archive swatch reveals that row again', () => {
  const r = row({ tracked: 'Archive / closed', band: 'DDEBF7' });
  assert.equal(shown(r, [...DEFAULT_BANDS, 'D9D9D9']), true);
});

// ---- the pre-existing behaviour must not regress ---------------------------
test('a D9D9D9-banded row is still hidden by default', () => {
  assert.equal(shown(row({ band: 'D9D9D9' })), false);
});

test('a live T1 row still shows', () => {
  assert.equal(shown(row()), true);
});

test('unchecking T1 still hides live T1 rows', () => {
  assert.equal(shown(row(), ['E2EFDA', 'FCE4D6', 'FFF2CC']), false);
});

test('a "Dropped (…)" flag still hides the row', () => {
  assert.equal(shown(row({ flag: 'Dropped (salary): below envelope' })), false);
});

test('a withdrawn status is hidden', () => {
  assert.equal(shown(row({ tracked: 'Withdrawn' })), false);
});

test('an unknown band always shows — there is no legend item to hide it by', () => {
  assert.equal(shown(row({ band: 'ABCDEF' })), true);
});

// ---- the new ⛔ Rejected bucket --------------------------------------------
test('a Rejected row is hidden by default (showRejected off)', () => {
  assert.equal(shown(row({ tracked: 'Rejected' })), false);
});

test('ticking ⛔ Rejected reveals it', () => {
  assert.equal(shown(row({ tracked: 'Rejected' }), DEFAULT_BANDS, true), true);
});

test('a rejected row keeps its own bucket even at T1 band', () => {
  assert.equal(closedBucket(row({ tracked: 'Rejected', band: 'DDEBF7' })), 'rejected');
});

// Precedence: isClosedRow() matches "rejected" too. If 'archive' were tested
// first, a rejected row would answer to the Archive box and ⛔ would do nothing.
test('PRECEDENCE: ⛔ Rejected governs a rejected row, NOT the Archive swatch', () => {
  const r = row({ tracked: 'Rejected' });
  assert.equal(shown(r, [...DEFAULT_BANDS, 'D9D9D9'], false), false, 'Archive on, ⛔ off -> still hidden');
  assert.equal(shown(r, DEFAULT_BANDS, true), true, '⛔ on, Archive off -> shown');
});

test('a rejected row on the archive band is still governed by ⛔', () => {
  assert.equal(closedBucket(row({ tracked: 'Rejected', band: 'D9D9D9' })), 'rejected');
});

test('"Rejected (Salary): too low" reads as rejected', () => {
  assert.equal(isRejectedRow(row({ tracked: 'Rejected (Salary): too low' })), true);
});

// Word-boundary guard: a role or status containing these words as substrings
// must not be swept up.
test('NEGATIVE: a live row is not rejected just because prose contains "eject"', () => {
  assert.equal(isRejectedRow(row({ tracked: 'Project kickoff pending' })), false);
  assert.equal(shown(row({ tracked: 'Project kickoff pending' })), true);
});

// ---- one shared definition of closed ---------------------------------------
test('isClosedRow agrees with the list filter on every closed shape', () => {
  for (const r of [
    row({ band: 'D9D9D9' }),
    row({ tracked: 'Archive / closed' }),
    row({ tracked: 'Rejected' }),
    row({ tracked: 'Withdrawn' }),
    row({ flag: 'Dropped (fit)' }),
  ]) {
    assert.equal(isClosedRow(r), true);
    assert.notEqual(closedBucket(r), null);
  }
  assert.equal(isClosedRow(row()), false);
  assert.equal(closedBucket(row()), null);
});

test('ARCHIVE_BAND is the D9D9D9 swatch the sweep and the legend both use', () => {
  assert.equal(ARCHIVE_BAND, 'D9D9D9');
});

// ---- the bundle actually ships this ----------------------------------------
// The .tsx is not what loads in the browser; antcv-react-islands.js is. Catches
// "edited the source but forgot npm run build".
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', '..', '..', 'src', 'islands', 'JobTracker', 'JobTracker.tsx'), 'utf8');
const BUNDLE = readFileSync(join(HERE, '..', '..', 'antcv-react-islands.js'), 'utf8');

test('source: the island filters through passesTierFilter, not a bare band check', () => {
  assert.match(SRC, /passesTierFilter\(r, filterBands, filterRejected, BAND_KEYS\)/);
  assert.doesNotMatch(SRC, /if \(BAND_KEYS\.includes\(band\) && !filterBands\.has\(band\)\) return false;/);
});

test('source: showRejected is persisted and rehydrated', () => {
  assert.match(SRC, /showRejected: boolean;/);
  assert.match(SRC, /showRejected: !!p\.showRejected/);
  assert.match(SRC, /showRejected: filterRejected/);
});

test('source: the ⛔ Rejected checkbox is wired to the toggle', () => {
  assert.match(SRC, /checked=\{showRejected\} onChange=\{onToggleRejected\}/);
});

test('bundle: the deployed island was rebuilt from this source', () => {
  assert.ok(BUNDLE.includes('Rejected / declined'), 'legend label missing from bundle — run npm run build');
  assert.ok(/rejected\|declined/.test(BUNDLE), 'rejection predicate missing from bundle — run npm run build');
});
