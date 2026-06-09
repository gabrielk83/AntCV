// cl-ghost-hunt.test.mjs
// ============================================================
// CL-GHOST-COMPANY-001 hardening (owner 2026-06-09: "make sure the fetch still
// passes ghost hunt and prevents hallucinations — otherwise we'll see Terma
// again"). Two app.src.js (1.50.330) behaviours, mirrored here:
//   (a) the force-Unsolicited + body-scrub branch now ALSO fires whenever NO JD
//       was provided (__noJD) — because with no JD, any company the LLM put in
//       meta.company is a hallucination. The old code let a hallucinated name make
//       __jdNamedCompany true, skipped the branch, and KEPT the ghost.
//   (b) the scrub NEUTRALISES the ghost in place (-> "your organisation"/possessive)
//       instead of dropping sentences / leaving the literal "[Company]"; it now
//       also covers contribute_intro + contribute_closing (where the original
//       "help Terma build" ghost lived).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// mirror the branch decision
function forcesUnsolicited({ explicitShowcase = false, noJD = false, llmCompany = '', ioCompany = '' }) {
  const llmCo = (llmCompany || '').trim();
  const jdNamedCompany = !!llmCo && !/^(unsolicited|open\s+application|n\/?a)$/i.test(llmCo);
  return !!explicitShowcase || !!noJD || (!jdNamedCompany && ioCompany === 'Unsolicited');
}

// mirror the scrub t()
function makeScrub(company) {
  const e = (company || '').trim();
  if (!e || /^(unsolicited|open\s+application|n\/?a)$/i.test(e)) return (s) => s;
  const esc = e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (t) => (typeof t !== 'string' ? t
    : t.replace(new RegExp('\\b' + esc + "(['’]s)\\b", 'gi'), "your organisation's")
       .replace(new RegExp('\\b' + esc + '\\b', 'gi'), 'your organisation')
       .replace(/\s{2,}/g, ' ').trim());
}

// ============================================================
test('G1 — no JD + LLM hallucinated a company → STILL forces Unsolicited (closes the hole)', () => {
  // OLD logic would NOT have forced this (jdNamedCompany=true skipped the branch).
  assert.equal(forcesUnsolicited({ noJD: true, llmCompany: 'Terma', ioCompany: 'Acme' }), true);
});

test('G2 — JD present + LLM extracted a real company → does NOT force (tailored unaffected)', () => {
  assert.equal(forcesUnsolicited({ noJD: false, llmCompany: 'Terma', ioCompany: '' }), false);
});

test('G3 — no JD, LLM left company empty → forced Unsolicited (kernel path), nothing to scrub', () => {
  assert.equal(forcesUnsolicited({ noJD: true, llmCompany: '', ioCompany: 'Unsolicited' }), true);
});

test('G4 — scrub neutralises the ghost in the contribute_closing (the original Terma case)', () => {
  const scrub = makeScrub('Terma');
  const out = scrub('My aim would be to help Terma build precise optical systems for the team.');
  assert.ok(!/Terma/i.test(out), 'no ghost company name remains');
  assert.ok(!/\[Company\]/i.test(out), 'no bracketed placeholder leaks');
  assert.match(out, /help your organisation build/i);
});

test('G5 — scrub handles the possessive form ("Terma\'s focus")', () => {
  const scrub = makeScrub('Terma');
  assert.equal(scrub("Terma's focus on aerospace optics aligns with my background."),
    "your organisation's focus on aerospace optics aligns with my background.");
});

test('G6 — scrub preserves multi-word company names + the rest of the sentence', () => {
  const scrub = makeScrub('Terma Aerospace');
  const out = scrub('I would welcome the chance to support Terma Aerospace in defence optics.');
  assert.ok(!/Terma/i.test(out));
  assert.match(out, /support your organisation in defence optics/i);
});
