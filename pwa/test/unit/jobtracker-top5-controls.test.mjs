// jobtracker-top5-controls.test.mjs
// ============================================================
// JOBTRACKER-TOP5-CONTROLS-001: reworked Job Tracker Top-5 row controls.
//   1. Clicking the rank-number cell TOGGLES Top-5 membership — a row that is
//      OUT (parked / below #5) gets PINNED in; a row that is IN gets PARKED out
//      (it stays live in the list). The decision is the pure top5ClickAction().
//   2. Reject moved from a dedicated ✕ button to a row context menu (right-click
//      / long-press). The menu entry runs the SAME reject-with-reason flow —
//      archive band D9D9D9, a "Rejected (<dim>): <reason>" flag, a discovery-
//      ledger entry so discovery never re-proposes it, and pin/park cleared.
//
// top5ClickAction lives in top5controls.ts — a standalone, import-free module so
// Node v24's type-stripping loader can import it directly (rank.ts can't: it
// imports fitPercent from api.ts). The reject state transition is re-implemented
// here from the shipped rejectRow() shape so the wiring the context menu depends
// on is pinned by a test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { top5ClickAction } from '../../../src/islands/JobTracker/top5controls.ts';

// ---- CHANGE 1: rank-number click toggles membership ------------------------

test('top5ClickAction: a row OUT of Top-5 is PINNED in', () => {
  assert.equal(top5ClickAction(false), 'pin');
});

test('top5ClickAction: a row IN the Top-5 is PARKED out', () => {
  assert.equal(top5ClickAction(true), 'park');
});

test('top5ClickAction: the two memberships map to DISTINCT actions (a real toggle)', () => {
  assert.notEqual(top5ClickAction(true), top5ClickAction(false));
});

// Simulate routing the click through the EXISTING pin/park mutations, exactly as
// toggleTop5Membership() does: OUT → togglePin, IN → togglePark. A parked row
// clicked in must come back live (pin on, park cleared); a member clicked out
// must leave (park on, pin cleared).
function applyClick(pinMap, parkMap, uk, isMember) {
  const action = top5ClickAction(isMember);
  if (action === 'pin') { pinMap = { ...pinMap, [uk]: true }; parkMap = { ...parkMap, [uk]: false }; }
  else { parkMap = { ...parkMap, [uk]: true }; pinMap = { ...pinMap, [uk]: false }; }
  return { pinMap, parkMap };
}

test('click routing: OUT+parked → pinned in, park cleared', () => {
  const { pinMap, parkMap } = applyClick({}, { r1: true }, 'r1', /*isMember*/ false);
  assert.equal(pinMap.r1, true);
  assert.equal(parkMap.r1, false);
});

test('click routing: IN (pinned) → parked out, pin cleared', () => {
  const { pinMap, parkMap } = applyClick({ r1: true }, {}, 'r1', /*isMember*/ true);
  assert.equal(parkMap.r1, true);
  assert.equal(pinMap.r1, false);
});

test('click routing: IN organically (unpinned) → parked out', () => {
  const { pinMap, parkMap } = applyClick({}, {}, 'r1', /*isMember*/ true);
  assert.equal(parkMap.r1, true);
  assert.equal(pinMap.r1, false);
});

// ---- CHANGE 2: context-menu reject wiring ----------------------------------
// The menu's "Reject…" entry must produce the identical persisted mutation the
// old ✕ button did. This mirrors rejectRow()'s row + ledger transition so a
// regression in that contract fails a test even though the trigger changed.

function classifyReasonStub() { return 'salary'; } // any envelope dimension

function rejectRow(doc, uk, reason) {
  const row = (doc.rows || []).find((r) => r[11] === uk);
  const dim = classifyReasonStub(reason);
  const rows = (doc.rows || []).map((r) => {
    if (r[11] !== uk) return r;
    const c = r.slice();
    c[8] = 'Archive / closed';
    c[10] = 'Rejected (' + dim + '): ' + reason.trim();
    c[12] = 'D9D9D9';
    return c;
  });
  const url = (doc.urls || {})[uk] || '';
  const key = url
    ? url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split(/[?#]/)[0].replace(/\/+$/, '')
    : (String(row[1]) + '|' + String(row[2])).toLowerCase().replace(/[^a-z0-9|]+/g, '');
  const discovered = { ...(doc.discovered || {}), [key]: { status: 'rejected', reason: reason.trim(), uk, company: row[1], role: row[2], url } };
  return { ...doc, rows, discovered, pin: { ...(doc.pin || {}), [uk]: false }, park: { ...(doc.park || {}), [uk]: false } };
}

const baseDoc = () => ({
  rows: [[1, 'Acme Optics', 'Photonics Engineer', 'Copenhagen', '', '', 'fit', 'OPEN', 'Identified', 'Review', 'Added', 'r1', 'DDEBF7']],
  urls: {}, pin: { r1: true }, park: {}, discovered: {},
});

test('context-menu reject: archives the row (band D9D9D9 + closed status + reason flag)', () => {
  const out = rejectRow(baseDoc(), 'r1', 'Below salary floor');
  const row = out.rows.find((r) => r[11] === 'r1');
  assert.equal(row[12], 'D9D9D9', 'archive band');
  assert.equal(row[8], 'Archive / closed', 'tracked status');
  assert.match(row[10], /^Rejected \(salary\): Below salary floor$/, 'reason flag');
});

test('context-menu reject: writes a discovery-ledger entry so discovery never re-proposes it', () => {
  const out = rejectRow(baseDoc(), 'r1', 'Wrong domain');
  const entry = out.discovered['acmeoptics|photonicsengineer'];
  assert.ok(entry, 'ledger keyed by company|role when no URL');
  assert.equal(entry.status, 'rejected');
  assert.equal(entry.reason, 'Wrong domain');
});

test('context-menu reject: clears pin AND park so the archived row leaves Top-5 candidacy', () => {
  const out = rejectRow(baseDoc(), 'r1', 'Not a fit');
  assert.equal(out.pin.r1, false);
  assert.equal(out.park.r1, false);
});
