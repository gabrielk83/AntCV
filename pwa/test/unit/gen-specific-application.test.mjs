// gen-specific-application.test.mjs
// ============================================================
// GEN-UNSOL-003 (owner 2026-06-12: "when it is a specific application,
// Application is not unsolicited but for the company"). Mirrors the
// generate-path keep/force gate in app.src.js (~21779) so its truth table is
// locked:
//   force-Unsolicited fires ONLY for an explicit showcase or a no-JD
//   generation. With a JD present, the result is NEVER "Unsolicited" —
//   the LLM company is kept; an empty/placeholder company stays empty
//   (header shows the role), and the stale Unsolicited-kernel context
//   (io.company === "Unsolicited") can no longer relabel a specific
//   application.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// the gate, replicated from app.src.js (post-1.50.391)
function decide({ explicitShowcase, jdText, llmCompany, ioCompany }) {
  const noJD = !(jdText && String(jdText).trim());
  let co = String(llmCompany || '').trim();
  if (/^[<\[]/.test(co)) co = '';               // schema-placeholder scrub
  if (!noJD && /^(unsolicited|open\s+application|n\/?a)$/i.test(co)) co = ''; // literal-echo scrub (JD present)
  const jdNamedCompany = !!co && !/^(unsolicited|open\s+application|n\/?a)$/i.test(co);
  const force =
    explicitShowcase ||
    noJD ||
    (!jdNamedCompany && noJD && ioCompany === 'Unsolicited');
  return force ? 'Unsolicited' : co;            // forced → Unsolicited; else kept (possibly '')
}

test('no JD → always Unsolicited (hallucinated companies discarded)', () => {
  assert.equal(decide({ jdText: '', llmCompany: 'Terma' }), 'Unsolicited');
  assert.equal(decide({ jdText: '', llmCompany: '' }), 'Unsolicited');
});

test('explicit showcase → Unsolicited even with a JD', () => {
  assert.equal(decide({ explicitShowcase: true, jdText: 'JD text', llmCompany: 'NKT' }), 'Unsolicited');
});

test('JD + LLM company → kept (the specific application)', () => {
  assert.equal(decide({ jdText: 'JD text', llmCompany: 'NKT Photonics', ioCompany: 'Unsolicited' }), 'NKT Photonics');
});

test('JD + empty company + stale Unsolicited kernel context → NOT relabelled (the GEN-UNSOL-003 fix)', () => {
  assert.equal(decide({ jdText: 'JD text', llmCompany: '', ioCompany: 'Unsolicited' }), '');
});

test('JD + placeholder echo → scrubbed to empty, never Unsolicited', () => {
  assert.equal(decide({ jdText: 'JD text', llmCompany: '<EXACT employer name from the JD>', ioCompany: 'Unsolicited' }), '');
  assert.equal(decide({ jdText: 'JD text', llmCompany: '[Company Name]', ioCompany: 'Unsolicited' }), '');
});

test('JD + literal "Unsolicited"/"n/a" echo → scrubbed to empty, never the label', () => {
  assert.equal(decide({ jdText: 'JD text', llmCompany: 'Unsolicited', ioCompany: 'Unsolicited' }), '');
  assert.equal(decide({ jdText: 'JD text', llmCompany: 'n/a', ioCompany: 'Unsolicited' }), '');
  assert.equal(decide({ jdText: 'JD text', llmCompany: 'Open Application', ioCompany: 'Unsolicited' }), '');
});
