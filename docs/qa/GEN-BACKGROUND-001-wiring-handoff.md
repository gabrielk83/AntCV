# GEN-BACKGROUND-001 Option A — index.js wiring + demo-proxy mirror (copy-paste handoff)

Everything in this doc is mechanical: two edits to `workers/proxy/src/index.js`, then
mirror four files into `workers/demo-proxy/src`, then CI deploy. The job logic
(`gen-job.js`) and the coherence pass (`gen-coherence.js`) are already on `main` and
tested (25/25 + 11/11). Do this in a terminal/Codespaces session — `index.js` is 87 KB,
too large to write inline through the MCP tools.

--------------------------------------------------------------------------------
## EDIT 1 — proxy/src/index.js: add the two imports
--------------------------------------------------------------------------------
Find the import block near the top (around line 40):

    import { identityFromBearer } from './jwt-verify.js';

Add these two lines immediately AFTER the existing import group (anywhere among the
top-level imports is fine; next to the other `./` imports keeps it tidy):

    import { handleJobRoute } from './gen-job.js';
    import { runCoherenceReview } from './gen-coherence.js';

--------------------------------------------------------------------------------
## EDIT 2 — proxy/src/index.js: dispatch /job/* routes
--------------------------------------------------------------------------------
In `handleRequest`, find this exact pair of lines (around line 654-656):

    const CORS = corsHeadersFor(request, env, 'x-api-key, x-provider, x-gemini-model');

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

Insert the following block BETWEEN them — i.e. right after the `const CORS = ...` line
and BEFORE the `if (request.method === 'OPTIONS')` line:

    // ---- GEN-BACKGROUND-001 Option A: resumable generation job routes ----
    // /job/create, /job/step, /job/{id}, /job/cancel. Must run BEFORE the generic
    // POST-only /v1/messages machinery below (a /job/{id} status read is a GET, and we
    // do NOT want job calls to go through demo-preflight/body-augmentation — each
    // section's actual LLM call re-enters handleRequest via runSection on /v1/messages,
    // which DOES get the full treatment). No recursion: /v1/messages is not a /job path,
    // so handleJobRoute returns null for the synthetic per-section requests.
    if (url.pathname.includes('/job/')) {
      const jobResp = await handleJobRoute(request, env, CORS, {
        runSection: handleRequest,              // reuse the per-section augmented path
        identityFn: identityFromRequestAsync,   // (request, env) -> {sub,email} | null
        coherenceFn: runCoherenceReview,        // cross-section coherence pass
      });
      if (jobResp) return jobResp;
      // jobResp === null -> not actually a /job route shape; fall through.
    }

Notes:
- `identityFromRequestAsync` (NOT `identityFromBearer`) is the right identity fn: it has
  the `(request, env)` signature gen-job's `ownerOf` expects and resolves CF Access OR a
  verified relay Bearer token. It's already defined in index.js.
- The block is inserted before the OPTIONS short-circuit, but handleJobRoute only matches
  GET/POST on `/job/*`, so OPTIONS preflight for `/job/*` still falls through to the
  existing `if (request.method === 'OPTIONS') return ... CORS` line below — correct.
- KV: gen-job uses `env.CV_PROXY_DATA`, already bound in proxy/wrangler.toml. No new
  binding, no wrangler change. (Keep the existing `[observability.logs]`.)

--------------------------------------------------------------------------------
## VERIFY (proxy) before deploy
--------------------------------------------------------------------------------
    node --check workers/proxy/src/index.js
    node --check workers/proxy/src/gen-job.js
    node --check workers/proxy/src/gen-coherence.js
    node workers/proxy/test/diag-gen-job.mjs          # 25/25
    node workers/proxy/test/diag-gen-coherence.mjs     # 11/11

Optional smoke (wrangler dev): POST /job/create with 2 tiny sections, then POST
/job/step twice, GET /job/{id} between — confirm sections go done and a coherence pass
runs (or skips cleanly if no provider key in dev).

--------------------------------------------------------------------------------
## MIRROR TO demo-proxy (worker parity rule)
--------------------------------------------------------------------------------
demo-proxy carries byte-identical copies of these modules; the only intended difference
is the demo budget. Steps:

1. Copy the two new modules verbatim:
       cp workers/proxy/src/gen-job.js        workers/demo-proxy/src/gen-job.js
       cp workers/proxy/src/gen-coherence.js  workers/demo-proxy/src/gen-coherence.js
       cp workers/proxy/test/diag-gen-job.mjs       workers/demo-proxy/test/diag-gen-job.mjs
       cp workers/proxy/test/diag-gen-coherence.mjs workers/demo-proxy/test/diag-gen-coherence.mjs
   (Create workers/demo-proxy/test/ if it doesn't exist. Fix the import path in the test
   copies if demo-proxy's layout differs — they import `../src/gen-*.js`.)

2. Apply the SAME two edits (imports + the /job/ dispatch block) to
   `workers/demo-proxy/src/index.js`. The demo index.js already imports its own
   `identityFromRequestAsync`/identity helper and computes a `CORS` var the same way —
   place the block at the equivalent spot (right after demo's main `const CORS = ...`,
   before its OPTIONS check). Use demo's own identity fn name if it differs; the contract
   is just `(request, env) -> {sub|email} | null`.

3. Demo budget: gen-job's per-section LLM call goes through `runSection = handleRequest`,
   so demo-proxy's existing demo-preflight/usage tracking fires PER /v1/messages section
   call automatically (one section = one metered call) — no extra budget code needed in
   the job layer. Confirm demo's KV binding for jobs: gen-job uses `env.CV_PROXY_DATA`.
   If demo-proxy's wrangler.toml does NOT bind `CV_PROXY_DATA`, either (a) add that
   binding (point it at demo's data namespace) or (b) change the KV binding name in the
   demo copy of gen-job.js. Check `workers/demo-proxy/wrangler.toml` first.

4. node --check + run both test files from the demo-proxy copies.

--------------------------------------------------------------------------------
## CI DEPLOY (one worker at a time, dry-run first)
--------------------------------------------------------------------------------
GitHub -> Actions -> "AntCV deploy" -> Run workflow:
  - target=proxy,     mode=dry-run  -> if green -> mode=deploy, confirm=<exact proxy name>
  - target=demo-proxy, mode=dry-run -> if green -> mode=deploy, confirm=<exact demo-proxy name>

--------------------------------------------------------------------------------
## POST-DEPLOY SMOKE (real)
--------------------------------------------------------------------------------
- POST {worker}/job/create  { sections:[{id,title,prompt}], provider, source_cv, jd_text }
  -> { job_id }
- POST {worker}/job/step  { job_id }  (repeat until status terminal)
  -> watch sections go pending->running->done; after the last, status 'coherence' then
     'done' with coherence.findings populated and any repaired sections flagged.
- GET  {worker}/job/{job_id}  -> resume view; sections carry ui_state
  (processing/queued/done) for the panel + preview colours.
- Demo: confirm budget enforced per step and relay routing intact.

(Client wiring — create->step->render loop, resume-on-visible, pink/yellow/none colours
from ui_state — is the separate next task in app.src.js/app.js.)
