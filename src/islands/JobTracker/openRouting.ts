// OPEN-JD-VISIBLE-001 — canonical, import-free definition of the Job Tracker
// "Open on AntCV" routing contract. Kept standalone (no runtime imports) so
// Node's type-stripping test runner can load it directly, exactly like
// top5controls.ts.
//
// THE BUG THIS PINS (owner, pre-2026-07-12): clicking "Open on AntCV" on a job
// row dumped the row's JD into the Additional Signals textarea instead of the
// uploaded-application drop-zone. The fix split the two payloads:
//
//   • jd_text          — the REAL job description. Its OWN field. It is NEVER
//                        placed in supporting_context, and on restore it seeds
//                        the uploaded-application drop-zone (zt/Bt), not signals.
//   • supporting_context — Dream-Envelope + target-facts + research + the
//                        owner-added ADDITIONAL SIGNALS block. On restore ONLY
//                        the ADDITIONAL SIGNALS block is lifted into the signals
//                        textarea.
//
// These two functions are the contract. The shipped code mirrors them:
//   - write side : prepareAndOpen() in JobTracker.tsx builds supporting_context
//                  in this order and sends jd separately as jd_text.
//   - read side  : the cold-start + Read-from-Cloud restore paths in
//                  pwa/app.src.js use OWNER_SIGNALS_RE (verbatim) to lift only
//                  the owner block into the signals textarea.
// jobtracker-open-jd-routing.test.mjs asserts both the invariant and that the
// shipped files still match this source (a silent regression fails the suite).

export const OWNER_SIGNALS_HEADING = 'ADDITIONAL SIGNALS (owner-added)';

// The EXACT regex used at both restore sites in pwa/app.src.js. It captures
// everything after the heading up to the next \n\n<UPPERCASE HEADING>[:(] block
// (e.g. the trailing "BRAND-FIT:" line) or end of string — so the JD, which
// lives in a different field entirely, can never be captured here.
export const OWNER_SIGNALS_RE =
  /ADDITIONAL SIGNALS \(owner-added\):\s*\n?([\s\S]*?)(?=\n\n[A-Z][A-Z -]{2,}[:(]|$)/;

// Lift ONLY the owner-added signals out of a supporting_context blob. Mirrors
// the shipped restore code: `const m = sc.match(RE); m ? m[1].trim() : ''`.
export function extractOwnerSignals(supportingContext: string): string {
  const m = String(supportingContext || '').match(OWNER_SIGNALS_RE);
  return m ? String(m[1] || '').trim() : '';
}

// Assemble supporting_context in the SAME order as prepareAndOpen(). The JD is
// deliberately NOT a parameter: it structurally cannot enter this string — it
// travels in the separate jd_text field. ownerSig is the ONLY free-text the
// owner typed for the row; it is the only thing restore routes back to signals.
// ENVELOPE-PRECEDENCE-001 (owner 2026-11-01, D1 3525): the envelope is CALIBRATION, never
// positioning. Under the old "TARGET-ROLE GUIDELINES" heading the model took the envelope
// title ("Technical Product Manager / AI Workflow") as the candidate's identity and a
// Product Manager CV opened "IT professional with 15+ years". The posting's own role
// family sets the profile identity, subtitle and headline; the envelope sets altitude.
export const ENVELOPE_HEADING = 'TARGET-ROLE CALIBRATION (Dream Envelope - calibration only, never positioning):';
export function positioningLine(role: string): string {
  const r = String(role || '').trim();
  return 'POSITIONING PRECEDENCE (ENVELOPE-PRECEDENCE-001): the JOB DESCRIPTION sets the positioning'
    + (r ? ' - this posting is "' + r + '"' : '') + '. The CV profile identity sentence, the subtitle, the profile slogan and the'
    + ' cover-letter headline name THIS role family; the envelope below only calibrates seniority, title band, location, mobility'
    + ' and compensation altitude. Never adopt an envelope title as the candidate\'s identity, and never open a targeted profile'
    + ' with the unsolicited "IT professional" line.\n\n';
}

export function assembleSupportingContext(parts: {
  envText: string;
  role?: string;
  targetFacts?: string;
  researchBlock?: string;
  ownerSig?: string;
  brandFitLine?: string;
}): string {
  return (
    positioningLine(parts.role || '') + ENVELOPE_HEADING + '\n' + (parts.envText || '') +
    (parts.targetFacts || '') +
    (parts.researchBlock || '') +
    (parts.ownerSig ? '\n\n' + OWNER_SIGNALS_HEADING + ':\n' + parts.ownerSig : '') +
    (parts.brandFitLine || '')
  );
}
