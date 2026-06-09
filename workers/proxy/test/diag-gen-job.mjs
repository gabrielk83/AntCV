// diag-gen-job.mjs — headless test of the resumable generation job logic.
// Run: node diag-gen-job.mjs   (from workers/proxy/test, with ../src/gen-job.js)
import { createJob, stepJob, getJob, cancelJob } from '../src/gen-job.js';

// ---- mock KV (CV_PROXY_DATA) ----
function mockKV() {
  const store = new Map();
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store,
  };
}

// ---- mock handleRequest (runSection): returns an SSE stream like Anthropic ----
function sseResponse(text) {
  const enc = new TextEncoder();
  const chunks = [
    'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":' + JSON.stringify(text) + '}}\n',
    'data: {"type":"message_delta","usage":{"output_tokens":' + text.length + '}}\n',
    'data: [DONE]\n',
  ];
  const stream = new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

let failOnce = { count: 0 };
async function mockRunSection(req, env) {
  const body = await req.json();
  const sectionText = body.__section_text || 'GENERATED';
  // simulate a transient 5xx the first time section "outcomes" is hit
  if (sectionText === 'OUTCOMES' && failOnce.count === 0) {
    failOnce.count++;
    return new Response('{"error":"overloaded"}', { status: 503, headers: { 'content-type': 'application/json' } });
  }
  return sseResponse('<<' + sectionText + '>>');
}

const CORS = {};
const identityFn = null; // anon owner

// mock coherence pass — returns one repetition finding and a rewrite for "outcomes".
let coherenceMode = 'rewrites';
async function mockCoherenceFn(env, payload) {
  if (coherenceMode === 'fail') return { ok: false, error: 'cascade down' };
  if (coherenceMode === 'throw') throw new Error('boom');
  const findings = [{
    kind: 'repetition',
    sections: ['profile', 'outcomes'],
    detail: 'Both PROFILE and OUTCOMES state the LiDAR change-control win in near-identical words.',
    fix: 'Keep it in OUTCOMES; generalise the PROFILE sentence.',
  }];
  if (coherenceMode === 'rewrites') {
    return { ok: true, findings, summary: '1 repetition reconciled', usage: { output_tokens: 20 },
      rewrites: { outcomes: '<<OUTCOMES-REVISED>>' } };
  }
  // findings-only mode: gen-job will re-run flagged sections through runSection
  return { ok: true, findings, summary: '1 repetition flagged', usage: { output_tokens: 12 } };
}

function makeReq(method, urlPath, jsonBody) {
  return new Request('https://cv-proxy.test' + urlPath, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: jsonBody ? JSON.stringify(jsonBody) : undefined,
  });
}

async function main() {
  const env = { CV_PROXY_DATA: mockKV() };
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  FAIL:', msg); } };

  // 1) create a 3-section job
  const sections = [
    { id: 'profile', title: 'PROFILE', prompt: { model: 'claude', messages: [], __section_text: 'PROFILE' } },
    { id: 'outcomes', title: 'SELECTED OUTCOMES', prompt: { model: 'claude', messages: [], __section_text: 'OUTCOMES' } },
    { id: 'experience', title: 'EXPERIENCE', prompt: { model: 'claude', messages: [], __section_text: 'EXPERIENCE' } },
  ];
  let r = await createJob(makeReq('POST', '/job/create', { sections, provider: 'anthropic', model: 'claude' }), env, CORS, identityFn);
  let j = await r.json();
  ok(r.status === 200 && j.job_id && j.sections === 3, 'create returns job_id + 3 sections');
  const jobId = j.job_id;

  // 2) step section 1 (profile)
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.status === 'running' && j.next === 1, 'after step1 next=1, running');
  ok(j.sections[0].state === 'done' && j.sections[0].result === '<<PROFILE>>', 'profile done with result');

  // 3) ---- simulate BACKGROUNDING: client goes away. Re-GET the job (resume) ----
  r = await getJob(makeReq('GET', '/job/' + jobId), env, CORS, identityFn, jobId);
  j = await r.json();
  ok(j.sections[0].result === '<<PROFILE>>' && j.next === 1, 'resume: profile still done, next=1 (no work lost)');

  // 4) step section 2 (outcomes) — first attempt returns 503 (transient), must NOT advance
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.next === 1 && j.sections[1].state === 'pending' && j.note && j.note.retrying === 'outcomes', '503 retries same section, next unchanged');

  // 5) step again — now outcomes succeeds
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.next === 2 && j.sections[1].state === 'done' && j.sections[1].result === '<<OUTCOMES>>', 'outcomes done after retry, next=2');

  // 6) step section 3 (experience) -> all sections done -> COHERENCE phase (not done yet)
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.status === 'coherence' && j.next === 3, 'after final section -> coherence phase (not done)');
  ok(j.sections[2].result === '<<EXPERIENCE>>', 'experience result present');

  // 6b) next step runs the coherence pass (rewrites mode) -> done, outcomes revised
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.status === 'done', 'coherence step finalises job -> done');
  ok(j.coherence && j.coherence.state === 'done', 'coherence state done');
  ok(j.coherence.findings.length === 1 && j.coherence.findings[0].kind === 'repetition', 'coherence surfaced repetition finding');
  ok(j.coherence.repaired.includes('outcomes') && j.sections[1].result === '<<OUTCOMES-REVISED>>', 'coherence rewrote outcomes');
  ok(j.sections[1].coherence_revised === true, 'revised section flagged');

  // 7) stepping a done job is idempotent (coherence not re-run)
  r = await stepJob(makeReq('POST', '/job/step', { job_id: jobId }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  j = await r.json();
  ok(j.status === 'done' && j.next === 3, 'stepping done job is idempotent');

  // 8) totals accumulated
  ok(j.totals.output_tokens > 0, 'usage totals accumulated (' + j.totals.output_tokens + ')');

  // 9) forbidden owner mismatch
  const idFnOther = async () => ({ sub: 'someone-else' });
  r = await getJob(makeReq('GET', '/job/' + jobId), env, CORS, idFnOther, jobId);
  ok(r.status === 403, 'owner mismatch -> 403');

  // 10) cancel a fresh job mid-flight
  r = await createJob(makeReq('POST', '/job/create', { sections, provider: 'anthropic' }), env, CORS, identityFn);
  const j2 = await r.json();
  r = await cancelJob(makeReq('POST', '/job/cancel', { job_id: j2.job_id }), env, CORS, identityFn);
  const jc = await r.json();
  ok(jc.status === 'cancelled', 'cancel sets status cancelled');
  r = await stepJob(makeReq('POST', '/job/step', { job_id: j2.job_id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  const jc2 = await r.json();
  ok(jc2.status === 'cancelled', 'stepping a cancelled job stays cancelled');

  // 11) ui_state colour mapping mid-run: step 1 of a fresh 3-section job, then GET.
  failOnce.count = 1; // disable the outcomes 503 for this run
  let r3 = await createJob(makeReq('POST', '/job/create', { sections, provider: 'anthropic' }), env, CORS, identityFn);
  const j3id = (await r3.json()).job_id;
  await stepJob(makeReq('POST', '/job/step', { job_id: j3id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  r3 = await getJob(makeReq('GET', '/job/' + j3id), env, CORS, identityFn, j3id);
  const j3 = await r3.json();
  ok(j3.sections[0].ui_state === 'done', 'ui_state: completed section = done (no bg)');
  ok(j3.sections[1].ui_state === 'queued' && j3.sections[2].ui_state === 'queued', 'ui_state: not-yet-run sections = queued (yellow)');

  // 12) findings-only coherence mode -> gen-job re-runs the flagged section via runSection
  coherenceMode = 'findings';
  // finish remaining sections
  await stepJob(makeReq('POST', '/job/step', { job_id: j3id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn); // outcomes
  await stepJob(makeReq('POST', '/job/step', { job_id: j3id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn); // experience -> coherence
  let rc = await stepJob(makeReq('POST', '/job/step', { job_id: j3id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn); // coherence pass
  const jc3 = await rc.json();
  ok(jc3.status === 'done' && jc3.coherence.state === 'done', 'findings-only: coherence finalises');
  ok(jc3.coherence.repaired.includes('profile') || jc3.coherence.repaired.includes('outcomes'), 'findings-only: re-ran a flagged section via runSection');

  // 13) coherence NEVER fails the job (cascade error) -> job still done, coherence error noted
  coherenceMode = 'fail';
  let r4 = await createJob(makeReq('POST', '/job/create', { sections, provider: 'anthropic' }), env, CORS, identityFn);
  const j4id = (await r4.json()).job_id;
  for (let i = 0; i < 3; i++) await stepJob(makeReq('POST', '/job/step', { job_id: j4id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  let r4c = await stepJob(makeReq('POST', '/job/step', { job_id: j4id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  const j4 = await r4c.json();
  ok(j4.status === 'done', 'coherence cascade failure still completes the job');
  ok(j4.coherence.state === 'error' && j4.coherence.error, 'coherence error recorded, run not lost');

  // 14) coherence throw -> also safe
  coherenceMode = 'throw';
  let r5 = await createJob(makeReq('POST', '/job/create', { sections, provider: 'anthropic' }), env, CORS, identityFn);
  const j5id = (await r5.json()).job_id;
  for (let i = 0; i < 3; i++) await stepJob(makeReq('POST', '/job/step', { job_id: j5id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  let r5c = await stepJob(makeReq('POST', '/job/step', { job_id: j5id }), env, CORS, mockRunSection, identityFn, 'https://cv-proxy.test', mockCoherenceFn);
  const j5 = await r5c.json();
  ok(j5.status === 'done' && j5.coherence.state === 'error', 'coherence throw still completes the job');

  coherenceMode = 'rewrites'; // reset

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
