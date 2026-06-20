/* Unit test — JD-SYNC-001 (2026-06-22)
 * Guard conditions for the auto-sync jd_text persistence:
 * Only includes jd_text in the oo.update payload when the JD is real (≥30 chars,
 * not the unsolicited GENERAL CV stub, not a Manual save sentinel) — never sends
 * jd_text:"" and clears what the server already holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Inline the guard logic matching app.src.js JD-SYNC-001 exactly.
function jdSyncGuard(jdText) {
  const __jT = String(jdText || "").trim();
  if (__jT.length >= 30 &&
      !__jT.startsWith("GENERAL CV") &&
      !__jT.startsWith("Manual save")) {
    return { included: true, jd_text: __jT };
  }
  return { included: false };
}

const GENERAL_CV_STUB =
  "GENERAL CV — UNSOLICITED APPLICATION CONTEXT\n\nThis is NOT a tailored application for a specific role.";
const MANUAL_SAVE = "Manual save — no JD text available.";
const NVIDIA_JD =
  "Test Engineer - Photonic | NVIDIA Corporation. We are seeking a Test Engineer " +
  "to join our photonic integrated circuits team in Copenhagen.";

test('JD-SYNC-001: real JD (NVIDIA) passes guard', () => {
  const r = jdSyncGuard(NVIDIA_JD);
  assert.equal(r.included, true, 'NVIDIA JD included in update');
  assert.equal(r.jd_text, NVIDIA_JD, 'jd_text value correct');
});

test('JD-SYNC-001: empty/null/undefined JD excluded', () => {
  assert.equal(jdSyncGuard("").included, false, 'empty string excluded');
  assert.equal(jdSyncGuard(null).included, false, 'null excluded');
  assert.equal(jdSyncGuard(undefined).included, false, 'undefined excluded');
});

test('JD-SYNC-001: short JD (<30 chars) excluded', () => {
  assert.equal(jdSyncGuard("Test Engineer").included, false, '13-char excluded');
  assert.equal(jdSyncGuard("x".repeat(29)).included, false, '29-char excluded');
});

test('JD-SYNC-001: exactly 30-char real JD passes', () => {
  const r = jdSyncGuard("x".repeat(30));
  assert.equal(r.included, true, '30-char passes threshold');
});

test('JD-SYNC-001: GENERAL CV unsolicited stub excluded', () => {
  assert.equal(jdSyncGuard(GENERAL_CV_STUB).included, false, 'unsolicited stub excluded');
});

test('JD-SYNC-001: Manual save sentinel excluded', () => {
  assert.equal(jdSyncGuard(MANUAL_SAVE).included, false, 'manual-save sentinel excluded');
});

test('JD-SYNC-001: leading whitespace trimmed before check', () => {
  const padded = "  " + NVIDIA_JD;
  const r = jdSyncGuard(padded);
  assert.equal(r.included, true, 'leading whitespace trimmed');
  assert.equal(r.jd_text, NVIDIA_JD, 'trimmed value stored');
});
