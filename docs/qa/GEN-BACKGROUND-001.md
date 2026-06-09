# GEN-BACKGROUND-001 — generation dies when the mobile tab is backgrounded [OPEN, High]

**Reported:** 2026-06-09 (mobile, antcv.pages.dev). Screenshot: generation stalled at
18:01 "Wrapping up…" with the yellow "Tab was backgrounded" warning; the run was lost.

## Problem
Generation is a **client-side streaming fetch in the foreground tab**: the app opens
a `fetch` to the proxy per section and reads the body incrementally via
`m.body.getReader()` (app.src.js ~L1198-1243). When the user switches apps / locks the
screen, the mobile OS suspends or throttles the backgrounded tab, the in-flight stream
stalls or is killed, and the generation drops. On return the user must Cancel and start
over — losing 3-6 minutes of work and provider spend.

The current handling is **detection + warning only**, not a fix:
- `wakeLock` (app.src.js ~L641 `b()`): keeps the **screen** awake, but only while the
  tab is foreground. Does nothing once another app is in front. Also auto-released on
  background and not reliably re-acquired (the `visibilitychange` handler at ~L657 is a
  no-op: `"visible"===document.visibilityState && y.size;`).
- The "Tab was backgrounded" banner (app.src.js ~L11102) + the visibility effect at
  ~L10690 only flag that the tab was hidden; they don't preserve or resume the run.

## Why this needs a real solution
Wake lock + "keep the tab in front" is a request the user can't always honor (they get
a call, a notification, the screen times out). Long generations (3-6 min; the screenshot
shows 18 min elapsed) make backgrounding almost certain on mobile. The fix has to make
backgrounding **survivable**, not merely discouraged.

## Solution options (ranked)

### Option A — Server-side resumable job (true fix; biggest change) — RECOMMENDED
Move the generation loop server-side. The proxy/worker runs the full multi-section
generation as a **job** identified by a `job_id`, persisting each section's result as it
completes (KV or D1 — D1 already exists for kernels/applications). The client:
1. POSTs the generation request → gets a `job_id` immediately.
2. Polls `GET /job/{job_id}` (or reconnects an SSE stream) for progress + partial
   results.
Backgrounding the tab is now harmless: the job keeps running on the worker, and on
return the client fetches whatever completed. Add a short TTL on stored jobs + the
existing budget/usage tracking. This is the only option that fully removes the
foreground dependency. Touches: proxy (job runner + store + status endpoint), demo-proxy
(byte-identical per the parity rule), app.src.js (replace the in-tab streaming loop with
submit-then-poll), and the LIVE PREVIEW wiring (render from polled partials instead of
the local stream).

### Option B — Service-worker-owned fetch (partial mitigation)
Run the generation fetch inside the **service worker** instead of the page. SWs are less
aggressively throttled than a hidden tab and survive a page navigation; the SW streams /
buffers results and posts them to the page via `postMessage` (or the page reads them on
return). Caveat: mobile browsers still terminate idle SWs (~30s on some Android builds),
so this reduces but doesn't eliminate drops on very long runs. Lighter than A; could be a
stepping stone. (NB: `sw.js` currently passes through all `.workers.dev` requests and
does not touch generation — this would add a generation path to it.)

### Option C — Per-section checkpoint + auto-resume (pragmatic, ships fast)
Keep generation client-side, but:
1. Persist each completed section to localStorage/IndexedDB the moment it returns (keyed
   by the current app + a generation id), instead of holding the whole run in memory.
2. On `visibilitychange → visible` after a detected stall, **auto-resume from the next
   unfinished section** rather than forcing a full Cancel+restart. The "working/queue"
   state already exists per section in the LIVE PREVIEW, so the resume boundary is known.
3. Re-acquire the wake lock on return to foreground (fix the no-op handler at ~L657).
This does not stop the stall, but turns recovery from "redo everything" into "continue
where it left off" — most of the user-visible pain, at a fraction of A's cost. Good
interim while A is built.

## Recommendation
Ship **C** now (cheap, big UX win, no backend change), and plan **A** as the durable fix
(resumable server-side job). B only if we want an intermediate step without a job store.

## Notes
- Any proxy change must be mirrored to demo-proxy (worker parity rule) and both deployed
  via CI.
- The fix touches `pwa/app.js` (848 KB) — use a terminal/Codespaces session, validate
  with `node --check`, never inline through the MCP write tools.
- Verify on a real device: start a generation, switch apps for >1 min, return — run
  should complete (A/B) or auto-resume from the next section (C), with no full restart.
