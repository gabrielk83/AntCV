// jobtracker-progress-filter.test.mjs
// ============================================================
// JOBLIST-FILTER-003 — owner-reported 2026-09-06: "IN THE JOB LIST THE FILTER-OUT
// OF SUBMITTED is not filtering out when unchecked" (the ★ In progress /
// "Submitted / in progress" legend checkbox).
//
// Same class as JOBLIST-FILTER-002. The In-progress swatch gated on the FFF2CC
// band only, but a row marked Submitted / Interview / Offer from the tracked-
// status dropdown keeps its original T1/T2/T3 band — the dropdown never touches
// the band — so unticking the swatch hid nothing. The predicate now buckets such
// rows as 'progress' and that bucket answers ONLY to the In-progress swatch.
//
// Exercises the REAL predicate from rowVisibility.ts, not a regex over the
// source; the last test pins that the shipped bundle was rebuilt from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  passesTierFilter, visBucket, closedBucket, isInProgressRow, PROGRESS_BAND, ARCHIVE_BAND,
} from '../../../src/islands/JobTracker/rowVisibility.ts';

const BAND_KEYS = ['DDEBF7', 'E2EFDA', 'FCE4D6', 'FFF2CC', 'D9D9D9'];
const DEFAULT_BANDS = BAND_KEYS.filter((b) => b !== 'D9D9D9'); // In progress ticked, Archive not
const NO_PROGRESS = DEFAULT_BANDS.filter((b) => b !== 'FFF2CC'); // In progress unticked

// [rank, company, role, loc, commute, group, fit, posting, TRACKED, next, FLAG, uk, BAND]
function row({ tracked = 'Identified (posting saved)', flag = '', band = 'DDEBF7' } = {}) {
  return [1, 'NVIDIA', 'Optical System Engineer, Validation', 'Denmark', '', '', '',
    'OPEN', tracked, 'Tailor', flag, 'uk1', band];
}

const shown = (r, bands = DEFAULT_BANDS, showRejected = false) =>
  passesTierFilter(r, bands, showRejected, BAND_KEYS);

// ---- THE REPORTED BUG ------------------------------------------------------
test('THE BUG: a T1-banded row with a "Submitted" STATUS is hidden when In progress is unticked', () => {
  assert.equal(shown(row({ tracked: 'Submitted', band: 'DDEBF7' }), NO_PROGRESS), false);
});

test('THE BUG at T2 and T3 too', () => {
  assert.equal(shown(row({ tracked: 'Submitted', band: 'E2EFDA' }), NO_PROGRESS), false);
  assert.equal(shown(row({ tracked: 'Submitted', band: 'FCE4D6' }), NO_PROGRESS), false);
});

test('Interview and Offer statuses are in-progress too', () => {
  assert.equal(shown(row({ tracked: 'Interview' }), NO_PROGRESS), false);
  assert.equal(shown(row({ tracked: 'Offer' }), NO_PROGRESS), false);
});

test('ticking In progress reveals the submitted row again', () => {
  assert.equal(shown(row({ tracked: 'Submitted', band: 'DDEBF7' }), DEFAULT_BANDS), true);
});

// ---- exactly one checkbox governs the row ----------------------------------
test('a submitted row answers to In progress, NOT to its tier band', () => {
  const r = row({ tracked: 'Submitted', band: 'DDEBF7' });
  // T1 unticked, In progress ticked -> still shown: the tier swatch no longer owns it.
  assert.equal(shown(r, ['E2EFDA', 'FCE4D6', 'FFF2CC']), true);
  // T1 ticked, In progress unticked -> hidden.
  assert.equal(shown(r, NO_PROGRESS), false);
});

test('the FFF2CC band still buckets as progress on its own', () => {
  assert.equal(visBucket(row({ band: 'FFF2CC' })), 'progress');
  assert.equal(shown(row({ band: 'FFF2CC' }), NO_PROGRESS), false);
  assert.equal(shown(row({ band: 'FFF2CC' }), DEFAULT_BANDS), true);
});

// ---- pre-submission statuses stay tier-governed ----------------------------
test('CV/CL drafting and drafted are NOT in progress — nothing has been sent', () => {
  for (const tracked of ['Not started', 'Identified (posting saved)', 'CV/CL drafting', 'CV/CL drafted']) {
    assert.equal(isInProgressRow(row({ tracked })), false, tracked);
    assert.equal(visBucket(row({ tracked })), null, tracked);
    assert.equal(shown(row({ tracked }), NO_PROGRESS), true, tracked + ' shows with In progress unticked');
    assert.equal(shown(row({ tracked }), ['E2EFDA', 'FCE4D6', 'FFF2CC']), false, tracked + ' hides with T1 unticked');
  }
});

// ---- precedence: closed beats in-progress -----------------------------------
test('PRECEDENCE: a rejected row is governed by ⛔, not by In progress', () => {
  const r = row({ tracked: 'Rejected', band: 'FFF2CC' });
  assert.equal(visBucket(r), 'rejected');
  assert.equal(shown(r, DEFAULT_BANDS, false), false, 'In progress on, ⛔ off -> hidden');
  assert.equal(shown(r, NO_PROGRESS, true), true, '⛔ on, In progress off -> shown');
});

test('PRECEDENCE: an archived row on the FFF2CC band is governed by Archive', () => {
  const r = row({ tracked: 'Archive / closed', band: 'FFF2CC' });
  assert.equal(visBucket(r), 'archive');
  assert.equal(shown(r, DEFAULT_BANDS), false, 'Archive off -> hidden even with In progress on');
  assert.equal(shown(r, [...NO_PROGRESS, ARCHIVE_BAND]), true, 'Archive on -> shown even with In progress off');
});

test('visBucket agrees with closedBucket on every closed shape', () => {
  for (const r of [row({ band: 'D9D9D9' }), row({ tracked: 'Archive / closed' }), row({ tracked: 'Rejected' }), row({ flag: 'Dropped (fit)' })]) {
    assert.equal(visBucket(r), closedBucket(r));
  }
});

// ---- word-boundary guard ---------------------------------------------------
test('NEGATIVE: prose containing "offer"/"interview" as substrings is not swept up', () => {
  assert.equal(isInProgressRow(row({ tracked: 'Coffers audit pending' })), false);
  assert.equal(isInProgressRow(row({ tracked: 'Preinterviewed by agency' })), false);
});

test('PROGRESS_BAND is the FFF2CC swatch the legend uses', () => {
  assert.equal(PROGRESS_BAND, 'FFF2CC');
});

// ---- the bundle actually ships this ----------------------------------------
const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE = readFileSync(join(HERE, '..', '..', 'antcv-react-islands.js'), 'utf8');

test('bundle: the deployed island was rebuilt from this source', () => {
  assert.ok(/submitted\|applied\|interview/.test(BUNDLE), 'in-progress predicate missing from bundle — run npm run build');
});
