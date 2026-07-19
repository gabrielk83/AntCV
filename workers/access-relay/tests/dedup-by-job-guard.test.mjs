/* DEDUP-BY-EMPLOYER-ROLE-001 regression guard (owner 2026-07-18).
 *
 * The ON CONFLICT(user_hash, jd_hash) key dedups on the JD *text*, so re-generating the
 * same job after a re-scrape (JD text drifts on dynamic careers pages) spawned a NEW row
 * instead of updating the existing application — the owner's three Ibsen "Project Manager
 * for SBC" duplicates. shouldDedupeByJob() gates when /job/create should UPDATE the
 * existing (user_hash, jd_company, jd_role) row instead. This guards that gate.
 *
 * Run: node --test workers/access-relay/tests/dedup-by-job-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}
const fnSrc = extract('function shouldDedupeByJob(', '\n}');
const ctx = { String };
vm.createContext(ctx);
vm.runInContext(fnSrc + '\nthis.shouldDedupeByJob = shouldDedupeByJob;', ctx);
const { shouldDedupeByJob } = ctx;

const JD = 'Project Manager for SBC. '.repeat(20); // >200 chars

test('a real targeted job (employer + role + substantive JD) dedups by employer+role', () => {
  assert.equal(shouldDedupeByJob(false, 'Ibsen Photonics', 'Project Manager for SBC', JD), true);
});

test('"save as new" always forces a distinct row (no dedup)', () => {
  assert.equal(shouldDedupeByJob(true, 'Ibsen Photonics', 'Project Manager for SBC', JD), false);
});

test('no employer (unsolicited) does not dedup by employer', () => {
  assert.equal(shouldDedupeByJob(false, '', 'Project Manager for SBC', JD), false);
  assert.equal(shouldDedupeByJob(false, 'Unsolicited', 'Project Manager for SBC', JD), false);
});

test('missing role does not dedup (avoids merging different roles at one employer)', () => {
  assert.equal(shouldDedupeByJob(false, 'Ibsen Photonics', '', JD), false);
});

test('a tiny/empty JD is not treated as a real targeted job', () => {
  assert.equal(shouldDedupeByJob(false, 'Ibsen Photonics', 'Project Manager for SBC', 'short'), false);
});

test('two DIFFERENT roles at the same employer both dedup within their own (company, role)', () => {
  // both are eligible to dedup — but by DIFFERENT (company, role) keys, so they never
  // collapse into one another (the SQL WHERE matches jd_role exactly).
  assert.equal(shouldDedupeByJob(false, 'NVIDIA', 'Optical System Engineer', JD), true);
  assert.equal(shouldDedupeByJob(false, 'NVIDIA', 'Silicon Photonics Design', JD), true);
});
