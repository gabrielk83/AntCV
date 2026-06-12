/* DIAGNOSTIC — SCE Selected-Outcomes numeric-metric enforcement (owner
 * 2026-06-12: "make sure numerical outcomes are always present").
 * Drives the REAL engine module:
 *   1. metric-free selected_outcomes JSON → evaluateSce flags it;
 *   2. a single digit anywhere in the section → clean;
 *   3. written multipliers ("threefold") count as metrics;
 *   4. runWithSceRetry passes the metric guidance into the retry
 *      fix-instruction and returns flagged:true when all retries stay
 *      metric-free (the client-side guard owns surfacing that).
 */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const eng = await import('../src/writing-style-engine.js');

const req = { target_language: 'en', extraBannedWords: {}, extraBannedPhrases: {}, ats: false };
const doc = (items) => JSON.stringify({ sections: { selected_outcomes: { items } } });

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

{
  const r = eng.evaluateSce(doc([{ title: 'Requirements into scope', body: 'Translated requirements into executable scope.' }]), req);
  check('metric-free outcomes flagged', !r.clean && r.bannedPhraseHits.some(h => /no numeric metric/.test(h)), JSON.stringify(r));
}
{
  const r = eng.evaluateSce(doc([{ title: 'Cycle time', body: 'Cut change cycle from 250 to 10 days.' }]), req);
  check('numeric outcomes clean', r.clean, JSON.stringify(r.bannedPhraseHits));
}
{
  const r = eng.evaluateSce(doc([{ title: 'Throughput', body: 'Raised throughput threefold across the line.' }]), req);
  check('written multiplier counts', r.clean, JSON.stringify(r.bannedPhraseHits));
}
{
  const prompts = [];
  const r = await eng.runWithSceRetry({
    req,
    callLlm: async (fix) => { prompts.push(fix); return doc([{ title: 'Scope', body: 'Delivered scope without numbers.' }]); },
  });
  const retried = prompts.length >= 2 && prompts.slice(1).every(p => /no numeric metric/.test(p));
  check('retry carries the metric guidance + flags after retries', retried && r.flagged === true, JSON.stringify({ prompts: prompts.length, flagged: r.flagged }));
}

const ok = checks.every(Boolean);
log(ok ? 'SCE-OUTCOMES-METRIC OK' : 'SCE-OUTCOMES-METRIC FAIL');
process.exit(ok ? 0 : 1);
