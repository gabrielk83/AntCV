# GEN-BACKGROUND-001 / Option A — implementation plan (resumable generation job)

Status: **IN PROGRESS** (started 2026-06-09). This doc is the build spec for the
durable, backgrounding-survivable generation path. It refines Option A from
`docs/qa/GEN-BACKGROUND-001.md` into something that fits the existing **stateless
per-section** proxy without adding Durable Objects.

## Constraint that shapes the design
A Cloudflare Worker `fetch` invocation cannot synchronously run a 3-6 min multi-section
generation (CPU/wall limits, and `ctx.waitUntil` is not a guaranteed 6-min background
runner). So we do NOT try to run the whole job in one request. Instead:

> **Job state lives in KV. Each section is produced by a SHORT request that checkpoints
> its result to KV the instant it returns. The job is advanced one section per call.
> Because every completed section is durable in KV, backgrounding the tab can never lose
> finished work — on return the client reads the job and resumes from the next pending
> section (or just collects the result if a driver finished it).**

This is Option A's durability (server-persisted partials + job id + status endpoint)
achieved with KV + a thin step driver, no new infra binding.

## Status checklist
- [x] `workers/proxy/src/gen-job.js` — module (createJob/stepJob/getJob/cancelJob +
      handleJobRoute). Committed 62a8d38.
- [x] `workers/proxy/test/diag-gen-job.mjs` — headless lifecycle test, 13/13. Committed.
- [ ] Wire `handleJobRoute` into `workers/proxy/src/index.js` router (before /v1/messages).
- [ ] Mirror gen-job.js + the router wiring into `workers/demo-proxy/src` (parity).
- [ ] Client: rework the generation loop (app.src.js → app.js) to create→step→render,
      add resume-on-visible, fix the no-op wake-lock re-acquire (~L657).
- [ ] CI deploy proxy → demo-proxy; device verify.

## Storage
KV namespace: reuse **`CV_PROXY_DATA`** (already bound). Keys:
- `job:{job_id}` → the job envelope (JSON). `expirationTtl` ~ 3600s (1h), refreshed on
  each write.
- The envelope holds everything needed to resume, so a single key per job (one
  read/one write per step — cheap, within KV limits).

### Job envelope shape
```
{
  v: 1,
  job_id: "uuid",
  created_at, updated_at,            // epoch ms
  status: "pending"|"running"|"done"|"error"|"cancelled",
  owner: "<auth sub or anon hash>",  // from JWT if present; used to scope reads
  provider, model,                    // routing snapshot at submit
  meta: { lang, ats, stylePackage, … },  // generation context (mirrors client meta)
  sections: [                         // ORDERED plan of work
    { id, title, state, prompt, headers?, result, error, attempts, usage }
    , …
  ],
  next: 0,                            // index of the next pending section
  totals: { input_tokens, output_tokens }  // running sum
}
```
v1 inlines prompts (they're small text). If an envelope ever approached the KV 25 MB
value cap, move prompts to `job:{id}:prompt:{i}` + a `prompt_ref` — not needed now.

## Endpoints (added to proxy/src/index.js router via handleJobRoute)
All POST/GET behind the existing Access/relay + CORS, same as other routes.

1. `POST /job/create`  Body `{ sections:[{id,title,prompt,headers?}], provider, model, meta }`
   → writes envelope `status:"pending"`, `next:0`; returns `{ job_id }` immediately (no LLM call).
2. `POST /job/step`  Body `{ job_id }` — advances exactly one section; idempotent on
   terminal jobs. Marks running, builds the synthetic per-section request, calls
   `handleRequest`, drains the response, checkpoints result+usage to KV, `next++`. On 5xx
   leaves the section pending and retries (≤3); on 4xx fails the job. Each call is short.
3. `GET /job/{job_id}` — status/resume; returns per-section state + result (owner-scoped).
4. `POST /job/cancel`  Body `{ job_id }` → `status:"cancelled"`.

### Who drives `/job/step`?
v1: **the client** drives the step loop. Completed sections are durable in KV, so
resume-after-background is free. v2 (optional, true zero-foreground): a cron/queue
consumer advances pending jobs server-side so a run finishes even if the client never
returns — same step endpoint, different caller.

## Reusing the existing section path (no logic duplication)
`handleRequest(request, env)` already does the per-section work (reads `x-provider`,
augments via `augmentBodyText`, normalises messages per provider, forwards, streams).
`stepJob` builds the exact synthetic `/v1/messages` Request the client would send and
calls `handleRequest` (injected as `runSection`), then drains the SSE/JSON response to a
string. Output is byte-identical and inherits augmentation, injection-defense, provider
handling, and demo-budget accounting. Default to `handleRequest` (not
`handleWithProviderFallback`) to avoid double budget accounting. v1 drains the stream
(works for every provider already wired).

## Wiring snippet (for index.js — to add)
Near the other `url.pathname` checks, BEFORE the generic /v1/messages handling:
```js
import { handleJobRoute } from './gen-job.js';
// …inside handleRequest, after CORS is computed:
if (url.pathname.includes('/job/')) {
  const jobResp = await handleJobRoute(request, env, CORS, {
    runSection: handleRequest,            // reuse the per-section path
    identityFn: identityFromBearer,       // owner scoping
  });
  if (jobResp) return jobResp;
}
```
Guard against recursion: the synthetic request hits `/v1/messages`, not `/job/*`, so
`handleJobRoute` returns null for it — no loop. (Double-check the path check is specific
to `/job/` and won't shadow other routes.)

## Client changes (pwa/app.src.js + app.js)
- Replace the in-tab "for each section: stream fetch" loop with create→step→render.
- Persist `job_id` (localStorage, keyed by app + generation id).
- On `visibilitychange → visible` with an in-flight `job_id`: `GET /job/{id}`, render
  done sections, continue stepping from `next` — no restart.
- Keep wake lock; FIX the no-op re-acquire at ~L657 (re-request on visible).
- Endpoint base resolves like every other JD/generate call (proxyUrl → relay/demo).

## Worker parity
`workers/demo-proxy/src` must carry a byte-identical `gen-job.js` and the same router
wiring (incl. demo budget hook per step). Deploy proxy then demo-proxy separately via CI.

## Verify
- Create → step×N → done; result identical to the old in-tab path.
- Kill the tab after 2/5 sections, reopen → GET job shows 2 done, resumes at 3, finishes.
- Demo: budget enforced per step; relay routing intact.
- Provider 5xx on one section retries that section, doesn't lose prior sections.
