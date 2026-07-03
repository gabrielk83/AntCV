# GEN-BACKGROUND-001-CLIENT — wiring spec + the decomposition finding (2026-07-04)

Owner P0: "the resumable job backend (gen-job.js) is live server-side, but the PWA never
switched to it. Still runs the old streaming loop, so mobile tab-backgrounding still breaks
generation." This doc is the completion path.

## STATUS

- **Server:** DONE and on `main` in BOTH proxy bundles — `gen-job.js` (`/job/create`,
  `/job/step`, `GET /job/{id}`, `/job/cancel`, KV-checkpointed per section, cross-section
  coherence phase) + `handleJobRoute` dispatch wired into `proxy/src/index.js` and
  `demo-proxy/src/index.js`. **VERIFY it is DEPLOYED live** (`curl` the live proxy
  `/job/create` with a bad body → expect a 400 `no_sections`, not a 404). On-main ≠ live.
- **Client ENGINE:** DONE 1.51.132 — `pwa/antcv-gen-job-client.js`, `window.AntcvGenJob`
  (`run`/`resume`/`cancel`/`hasActive`/`onForeground`), 8 unit tests
  (`gen-job-client.test.mjs`): create→step→coherence→done, reload-resume, hidden-tab
  pacing, transient-retry, 4xx-terminal, cancel. Loaded by index.html, INERT until the app
  calls `run()`. Kill-switch for the integration: `antcv:disable-gen-job`.
- **Client INTEGRATION (app.js):** NOT done — needs the owner's approval on approach because
  of the finding below.

## THE FINDING (why this is not a one-line swap)

The current app generation (app.src.js gen cascade) is **ONE big multi-provider `/v1/messages`
call** that returns the whole document (profile + experience_roles + all sidebar sections +
CL) as a single JSON response, plus separate showcase/analysis/coherence calls. It is **not
per-section.**

gen-job's backgrounding survival comes from advancing **many SHORT per-section `/step`
requests** — completed sections are KV-checkpointed, so a backgrounded tab loses nothing and a
reload resumes from the checkpoint. A **single 3–6 min `/step` is NOT viable** (Workers can't
hold one that long; if the client's fetch dies on backgrounding, the invocation dies too). So:

> **Wiring the engine to real generation ALSO requires decomposing the main generation into a
> per-section plan** — `sections[].prompt` = each section's own `/v1/messages` body. There is no
> low-risk shortcut: a one-section job with the whole prompt gives neither mid-call backgrounding
> survival nor (on Workers' limits) a completable `/step`.

## TWO APPROACHES (owner picks)

**A. Full per-section decomposition (the designed end state).** Split the main gen prompt into
per-section prompts (PROFILE, SELECTED OUTCOMES, EXPERIENCE, sidebar groups, CL parts), build
the `sections[]` plan, and delegate to `AntcvGenJob.run(plan, cb)`. cb.onProgress renders each
section as it checkpoints (the ui_state pink/yellow/done indicator already exists server-side);
cb.onDone assembles the final document from `sections[].result`; the coherence findings drive
the "what was reconciled" note. **Highest value (true backgrounding survival + cross-section
coherence), highest effort** — it re-shapes the gen core and needs its own spec + a kill-switch
+ a fresh-gen quality regression (the per-section output must match today's single-call quality).

**B. Interim resume-on-reload only (smaller).** Keep the single call, but persist the in-flight
run + inputs; on reload/foreground, if the previous run didn't finish, offer to re-run
automatically. This is NOT gen-job (no server job), gives NO mid-call backgrounding survival —
it only removes the "lost everything, start from scratch" reload cost. Lower value; do not
present it as closing GEN-BACKGROUND-001.

**Recommendation:** A, staged — (1) engine shipped ✅; (2) verify server live; (3) decompose ONE
low-risk section first (e.g. PROFILE) behind the kill-switch, prove the round-trip + quality on a
fresh gen; (4) extend section-by-section; (5) flip the default once the full plan matches
single-call quality. Never flip the default until a fresh-gen A/B shows parity.

## INTEGRATION CONTRACT (when approach A proceeds)

```
// at the point the gen cascade would start the streaming run:
if (localStorage.getItem('antcv:disable-gen-job') !== '1' && window.AntcvGenJob) {
  const plan = buildSectionPlan(...);      // NEW: decompose gen into sections[]
  window.AntcvGenJob.onForeground(cb);     // resume faster when the tab returns
  return window.AntcvGenJob.run(plan, {
    onProgress: (view) => renderSectionStates(view),   // pink/yellow/done + partial results
    onDone:     (view) => assembleAndCommit(view),     // sections[].result -> sections store
    onError:    (err, view) => fallbackOrSurface(err), // fall back to the streaming loop
  });
}
// else: the existing streaming loop (unchanged fallback).
```
On boot, once, if `AntcvGenJob.hasActive()`: `AntcvGenJob.resume(cb)` to pick up a run that a
reload interrupted.

## TESTS TO ADD WITH THE INTEGRATION
- headless: start a gen, set `document.hidden=true` + dispatch `visibilitychange`, assert the
  step loop keeps polling and resumes on foreground; kill-switch falls back to streaming.
- fresh-gen quality A/B: per-section plan output vs single-call output on the anita persona —
  section completeness + no regression before flipping the default.
