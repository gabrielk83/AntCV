/* DIAGNOSTIC — NORDIC-ONELINE-001 (owner 2026-06-12: "for nordic minimal
 * allow up to one line per bullet and one line per table"). Drives the REAL
 * engine:
 *   1. nordic-minimal (the default style): a 56+ char expertise cell flags;
 *   2. the same cell under achievement-driven stays clean (two-line cap 90);
 *   3. a >95-char outcomes bullet flags under nordic; an under-cap one does
 *      not;
 *   4. experience bullets are covered via the JSON path;
 *   5. plain-text fallback is HEADING-SCOPED: an overlong bullet under
 *      SELECTED OUTCOMES flags, the same line under HOW I WOULD CONTRIBUTE
 *      does not (CL prose bullets exempt);
 *   6. the retry instruction carries the one-line guidance.
 */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const eng = await import('../src/writing-style-engine.js');

const req = (style) => eng.parseWritingStyleRequest({ target_language: 'en', writingStyle: style });
const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

const LONG_CELL = 'Hardware-software interface ownership and requirements traceability'; // 68 chars
const doc = (over) => JSON.stringify({ sections: {
  core_competencies: { rows: [{ focus_area: 'Architecture', expertise: over ? LONG_CELL : 'Hardware-software interface, 5 domains' }] },
  selected_outcomes: { items: [{ title: 'Cut cycle 40%', body: 'From 25 to 15 days.' }] },
} });

{
  const r = eng.evaluateSce(doc(true), req('nordic-minimal'));
  check('1. nordic: 68-char cell flags (one-line cap 48)', !r.clean && r.bannedPhraseHits.some(h => /expertise cell too long .*max 48/.test(h)), JSON.stringify(r.bannedPhraseHits));
}
{
  const r = eng.evaluateSce(doc(true), req('achievement-driven'));
  check('2. other styles keep the 90 cap (same cell clean)', r.clean, JSON.stringify(r.bannedPhraseHits));
}
{
  const long = 'Cut the customer change-request review cycle from twenty-five days to fifteen by introducing a structured pre-board screening checklist for 3 programmes'; // ~150
  const r = eng.evaluateSce(JSON.stringify({ sections: { selected_outcomes: { items: [{ title: 'Cycle', body: long }] } } }), req('nordic-minimal'));
  check('3a. nordic: >95-char outcomes bullet flags', !r.clean && r.bannedPhraseHits.some(h => /bullet exceeds one line/.test(h)), JSON.stringify(r.bannedPhraseHits));
}
{
  const r = eng.evaluateSce(JSON.stringify({ sections: { selected_outcomes: { items: [{ title: 'Cut cycle 40%', body: 'From 25 to 15 days via pre-board checks.' }] } } }), req('nordic-minimal'));
  check('3b. under-cap bullet stays clean', r.clean, JSON.stringify(r.bannedPhraseHits));
}
{
  const long = 'Owned change control across three automotive tier-1 customer programmes and the full system architecture handover toward production readiness in 2024'; // ~149
  const r = eng.evaluateSce(JSON.stringify({ sections: { experience: [{ company: 'X', items: [long] }] } }), req('nordic-minimal'));
  check('4. experience bullets covered (JSON)', !r.clean && r.bannedPhraseHits.some(h => /bullet exceeds one line/.test(h)), JSON.stringify(r.bannedPhraseHits));
}
{
  const long = 'Coordinated the optical, electrical and software teams through both ASPICE re-certifications with 0 major findings and structured pre-board screening';
  const flagged = eng.evaluateSce('SELECTED OUTCOMES\n- ' + long + '\n', req('nordic-minimal'));
  const exempt = eng.evaluateSce('HOW I WOULD CONTRIBUTE\n- ' + long.replace('0 major', 'zero major') + '\n', req('nordic-minimal'));
  const exemptOneLineHits = exempt.bannedPhraseHits.filter(h => /bullet exceeds one line/.test(h));
  check('5. plain-text fallback heading-scoped (outcomes flags, CL prose exempt)',
    flagged.bannedPhraseHits.some(h => /bullet exceeds one line/.test(h)) && exemptOneLineHits.length === 0,
    JSON.stringify({ f: flagged.bannedPhraseHits, e: exemptOneLineHits }));
}
{
  const prompts = [];
  const r = await eng.runWithSceRetry({
    req: req('nordic-minimal'),
    callLlm: async (fix) => { prompts.push(fix); return doc(true); },
  });
  const carried = prompts.length >= 2 && prompts.slice(1).every(p => /max 48/.test(p));
  check('6. retry carries the one-line guidance + flags after retries', carried && r.flagged === true, JSON.stringify({ prompts: prompts.length, flagged: r.flagged }));
}

const ok = checks.every(Boolean);
log(ok ? 'SCE-NORDIC-ONELINE OK' : 'SCE-NORDIC-ONELINE FAIL');
process.exit(ok ? 0 : 1);
