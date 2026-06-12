/* DIAGNOSTIC — owner batch 2026-06-12 evening: 'discuss' is a banned word
 * (en inflections + da diskutere-forms) and em dashes are violations in any
 * language (retry instruction says replace "—" with "-"). Drives the REAL
 * engine module. */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const eng = await import('../src/writing-style-engine.js');

const req = (lang) => ({ target_language: lang, extraBannedWords: {}, extraBannedPhrases: {}, ats: false });

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

{
  const r = eng.evaluateSce('Keen to discuss the change workflow in person.', req('en'));
  check('en "discuss" flagged', !r.clean && r.bannedWordHits.some(h => /discuss/i.test(h)), JSON.stringify(r.bannedWordHits));
}
{
  const r = eng.evaluateSce('We discussed the requirements and discussing them again helped.', req('en'));
  check('en inflections flagged', r.bannedWordHits.length >= 2, JSON.stringify(r.bannedWordHits));
}
{
  const r = eng.evaluateSce('Jeg vil gerne diskutere arbejdsgangen.', req('da'));
  check('da "diskutere" flagged', !r.clean && r.bannedWordHits.some(h => /diskuter/i.test(h)), JSON.stringify(r.bannedWordHits));
}
{
  const r = eng.evaluateSce('Change governance 2020 — 2025 across programmes.', req('en'));
  check('em dash flagged', !r.clean && r.bannedPhraseHits.some(h => /em dash used/.test(h) && /replace "—" with "-"/.test(h)), JSON.stringify(r.bannedPhraseHits));
}
{
  const r = eng.evaluateSce('Change governance 2020 - 2025 across programmes. A hyphen-rich, well-known draft.', req('en'));
  check('hyphens stay clean', r.clean, JSON.stringify(r.bannedPhraseHits));
}
{
  const many = 'a — b\nc — d\ne — f\ng — h\n';
  const r = eng.evaluateSce(many, req('en'));
  const dashHits = r.bannedPhraseHits.filter(h => /em dash used/.test(h));
  check('em-dash hits capped at 3', dashHits.length === 3, String(dashHits.length));
}
{
  const prompts = [];
  const r = await eng.runWithSceRetry({
    req: req('en'),
    callLlm: async (fix) => { prompts.push(fix); return 'Cycle work 2020 — 2025.'; },
  });
  const carried = prompts.length >= 2 && prompts.slice(1).every(p => /replace "—" with "-"/.test(p));
  check('retry carries the dash guidance + flags after retries', carried && r.flagged === true, JSON.stringify({ prompts: prompts.length, flagged: r.flagged }));
}

const ok = checks.every(Boolean);
log(ok ? 'SCE-DISCUSS-EMDASH OK' : 'SCE-DISCUSS-EMDASH FAIL');
process.exit(ok ? 0 : 1);
