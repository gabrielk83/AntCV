/* DIAGNOSTIC — GEN-SCE-FLAG-001 server half (2026-06-12 late):
 *   1. executeSceWithRetry AWAITS its sce-eval KV put (a stubbed env's put
 *      resolves BEFORE the function returns — previously fire-and-forget,
 *      which Cloudflare cancels at isolate teardown: the proven cause of
 *      90 days of zero ANALYTICS keys);
 *   2. early-return paths log reason-coded sce-skip events and surface the
 *      X-AntCV-Sce-Skip header (previously silent);
 *   3. a flagged 3rd draft still returns X-AntCV-Flagged: 1.
 */
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const eng = await import('../src/writing-style-engine.js');

const req = eng.parseWritingStyleRequest({ target_language: 'en' });
const puts = [];
const env = { ANALYTICS: { put: async (k, v) => { await new Promise(r => setTimeout(r, 20)); puts.push({ k, v: JSON.parse(v) }); } } };

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

const anthropic = (text) => JSON.stringify({ content: [{ type: 'text', text }] });

{
  puts.length = 0;
  const r = await eng.executeSceWithRetry({ data: anthropic('A calm, factual line with 3 numbers.'), shape: 'anthropic_messages', writingStyleRequest: req, env });
  check('1. sce-eval put AWAITED (landed before return)', puts.length === 1 && puts[0].v.kind === 'sce-eval' && puts[0].v.sceClean === true, JSON.stringify(puts));
  check('1b. clean headers', r.headers['X-AntCV-Sce-Clean'] === '1' && !r.headers['X-AntCV-Flagged']);
}
{
  puts.length = 0;
  const r = await eng.executeSceWithRetry({ data: 'NOT JSON AT ALL', shape: 'anthropic_messages', writingStyleRequest: req, env });
  check('2a. parse-fail logs sce-skip + header', puts.length === 1 && puts[0].v.kind === 'sce-skip' && puts[0].v.reason === 'parse-fail' && r.headers['X-AntCV-Sce-Skip'] === 'parse-fail', JSON.stringify({ puts, h: r.headers }));
}
{
  puts.length = 0;
  const r = await eng.executeSceWithRetry({ data: JSON.stringify({ unexpected: true }), shape: 'anthropic_messages', writingStyleRequest: req, env });
  check('2b. no-llm-text logs sce-skip + header', puts.length === 1 && puts[0].v.reason === 'no-llm-text' && r.headers['X-AntCV-Sce-Skip'] === 'no-llm-text', JSON.stringify({ puts, h: r.headers }));
}
{
  puts.length = 0;
  const dirty = anthropic('We will spearhead a robust journey.');
  const r = await eng.executeSceWithRetry({
    data: dirty, shape: 'anthropic_messages', writingStyleRequest: req, env,
    reCallProvider: async () => ({ ok: true, text: dirty }),
  });
  check('3. flagged 3rd draft: X-AntCV-Flagged + attempts=3 + eval logged',
    r.flagged === true && r.headers['X-AntCV-Flagged'] === '1' && r.attempts === 3 && puts.length === 1 && puts[0].v.flagged === true,
    JSON.stringify({ h: r.headers, attempts: r.attempts, puts: puts.length }));
}

const ok = checks.every(Boolean);
log(ok ? 'SCE-TELEMETRY-AWAIT OK' : 'SCE-TELEMETRY-AWAIT FAIL');
process.exit(ok ? 0 : 1);
