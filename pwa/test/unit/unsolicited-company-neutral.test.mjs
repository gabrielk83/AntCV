// unsolicited-company-neutral.test.mjs
// ============================================================
// CL-GHOST-COMPANY-001 (owner 2026-06-09): an UNSOLICITED application
// (no JD) leaked a specific company ("Terma") into the cover-letter body.
//
// The generation prompt in app.src.js (~21107 + ~21229) now:
//   (a) when there is NO JD text (c empty), prepends a hard
//       company-neutrality clause (__neutralCo) to the prompt; and
//   (b) does NOT carry a prior run's JD-specific supporting_context
//       forward into an unsolicited draft (!__noJD gate).
//
// We can't run the LLM here, so we mirror the DETERMINISTIC prompt-
// construction decision EXACTLY (must stay in sync with app.src.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Mirror of app.src.js: __noJD + __neutralCo + the prior-context gate ---
const NEUTRAL =
  'OPEN / UNSOLICITED APPLICATION — NO TARGET COMPANY. There is no job description and no target employer for this draft. Do NOT name ANY specific company ANYWHERE in the cover letter or the CV body — not in WHY THIS POSITION, not in the HOW I WOULD CONTRIBUTE closing line, not in the CLOSURE line, nowhere. Use neutral references only: "your organisation", "your team", "the role". Do NOT infer, guess, or carry forward a company name from prior context, additional signals, or background documents. meta.company MUST be empty.\n\n';

function noJD(c) { return !(c && String(c).trim()); }
function neutralCo(c) { return noJD(c) ? NEUTRAL : ''; }
function carriesPriorContext(c, supportingContext) {
  // app.src.js: !__noJD && yo && typeof yo.supporting_context==='string' && trim()
  return !noJD(c) && !!supportingContext && typeof supportingContext === 'string' && !!supportingContext.trim();
}

// ============================================================
test('U1 — no JD ⇒ neutrality clause is injected and forbids naming a company', () => {
  const k = neutralCo('') + 'You are an expert CV and cover letter writer...';
  assert.ok(k.includes('NO TARGET COMPANY'), 'unsolicited prompt must carry the no-company rule');
  assert.ok(k.includes('meta.company MUST be empty'));
});

test('U2 — JD present ⇒ no neutrality clause (tailored generation unchanged)', () => {
  const k = neutralCo('SENIOR SYSTEMS ENGINEER at Terma. Electro-optical systems...') +
    'You are an expert CV and cover letter writer...';
  assert.equal(neutralCo('SENIOR SYSTEMS ENGINEER at Terma...'), '', 'tailored runs get no neutrality clause');
  assert.ok(!k.includes('NO TARGET COMPANY'));
});

test('U3 — whitespace-only JD counts as NO JD (unsolicited)', () => {
  assert.equal(noJD('   \n  '), true);
  assert.ok(neutralCo('   \n  ').includes('NO TARGET COMPANY'));
});

test('U4 — prior-run JD-specific context is NOT carried into an unsolicited draft', () => {
  // The contamination vector: a prior Terma run left supporting_context.
  assert.equal(
    carriesPriorContext('', 'Terma values aerospace-grade optical sensing; hiring manager prefers...'),
    false,
    'unsolicited draft must drop prior JD context (else the prior company leaks)',
  );
});

test('U5 — prior context IS carried when a real JD is present (tailored unaffected)', () => {
  assert.equal(
    carriesPriorContext('Real JD text for the role at Acme.', 'Acme prefers candidates with X.'),
    true,
  );
});
