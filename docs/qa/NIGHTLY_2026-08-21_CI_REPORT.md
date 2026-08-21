# AntCV CI Nightly — 2026-08-21 (GitHub Actions, Opus 4.8, unattended)

**Verify + attest + reconcile. NO code shipped to main, no PR, no deploy.** `ALLOW_DEPLOY=false`.

## Sync / baseline
- SYNC FIRST clean: `git fetch origin && git pull --rebase origin main` → **Already up to date**.
- HEAD `a8a765a3` — release **`1.51.4346-cost-rates`** (sw.js CACHE / TARGET_VERSION / ANTCV_VERSION seed all match).
- Baseline = the 08-20 CI report HEAD `02f0fbde` (release `1.51.4326-claude-rate`).

## Code delta since the 08-20 CI report — the cost-rate fix pass, already registered
`git diff --stat 02f0fbde..HEAD -- pwa/ workers/ .github/` = 17 files (936 ins / 50 del): the
**LLM cost-rate correction pass** (`ae55e774` + `df802afb` + `1512d4ef` + `c19a28dd`, release
`a8a765a3`). All of it was authored, tested, deployed and **live-verified by the 08-20 desktop runs**
and self-registered in `OPEN_REGISTER.md` / `ACTIVE_BUGS.md`. Nothing new to ship this run — this is
a verify + attest + reconcile cycle. **`pwa/app.js` DID change in this delta** (mistral/gemini rate
map in the client cost meter) → full re-verify below.

## Verification — ALL GREEN (app.js changed → full re-run)
- **PWA suite `node scripts/run-tests.mjs pwa`: 1606 / 1606** (0 fail, 0 skip).
- **Full-repo suite `node scripts/run-tests.mjs`: 1941 / 1941** (0 fail).
- **boot-smoke** (`node pwa/test/boot-smoke.mjs`): `glDemo=function, errors=0` — HEAD boots past sign-in.
- `pwa/app.js`: `node --check` OK, head `(()=>{window.__antcv`, **0** `"use strict"`.
- **cache-bust gate** `check-cache-bust.mjs --range 02f0fbde..HEAD`: OK — all 2 changed loaded assets got a `?v` bump.

## Render-gated diags (chromium installed this run) — GREEN
- `diag-copenhagen-overflow-storm`: **DIAG PASS** — ON (default) 4 writes / 0px usablePx-drift / 0 err; OFF 1 write / 0px / 0 err.
- `diag-personal-panel-probe`: **DIAG PASS** — 0 mutations / 8s, 0 page errors (Personal panel at rest).
- `diag-align-flap` (row 16): both `tableRow1` / `tableRow2` measure `a:justify inline:justify` consistently — **no justify↔left flap**.

## Live attest — ALL GREEN
- `antcv.pages.dev/sw.js` CACHE **`antcv-1.51.4346-cost-rates`** == repo HEAD → the cost-rate push is LIVE in browsers.
- `antcv.pages.dev/app.js?v=1.51.4346-cost-rates` → HTTP **200**.
- Worker `/health` (all four, `*.karp-gabriel-a.workers.dev`): antcv-access-relay **200**, cv-proxy **200**, antcv-demo-proxy **200**, docx-worker **200**.

## RECONCILE — worker-deploy OWED by the cost-rate pass is now CLOSED
The `OPEN_REGISTER.md` top block (cost-rate fix pass) recorded **"OWED: a proxy + demo-proxy +
access-relay deploy — the worker tables do not auto-deploy."** That deploy was completed the same day:
commit `c19a28dd` records **cv-proxy `7f8e0938`, antcv-demo-proxy `256f8397`, antcv-access-relay
`63c58cca`, all /health 200**, `MODEL_ROLES` read back unchanged (no flip), and the relay's D1
`llm_provider_costs` lookup **live-verified** in production — all four in-traffic models now resolve
(`claude-sonnet-5 [3,15]`, `gpt-5.4-mini [0.75,4.5]`, `mistral-large-latest [0.5,1.5]`,
`gemini-2.5-flash [0.3,2.5]`) where before none did. **The cost-rate correction is fully shipped,
deployed and live-verified as of 08-20; nothing about it is owed.**

## E1 staleness sweep
- **Row 9** (cluster demand worker pipeline) — CLOSED-in-production; the `2026-07-07` stamp is
  historical inside its closed note. Code anchor **still present**: `recomputeClusterTop20` ×5 in
  `workers/access-relay/src/index.js`. Reconfirmed, no drift.
- **Row 16** (sidebar TOOLS/REGULATORY justify↔left flap) — `diag-align-flap.mjs` re-run: no flap
  (both table rows stable at `justify`). Re-dated 2026-08-21; owner live-verify still open.
- **Rows 1 / 3 / 23 / 35 / 36 / 37** — re-verified against this same HEAD by the 08-20 CI + desktop
  runs (release only advanced by the cost-rate delta, already re-verified above). No new drift.
- **Rows 14** DONE, **20** owner-gated 6-item verify list (unchanged).

## Owed / carried OPEN (all owner-side or desktop/live-model — unchanged this run)
- **Post-deploy live-verify of the cost-rate meter** signed-in on `antcv.pages.dev` — owed to a
  desktop run (no in-app Browser pane / no signed-in session in CI). (The deploy + D1 rate resolution
  were already live-verified 08-20; this is the client-meter-in-browser leg.)
- Rows **35/36/37** fresh-generation content check (needs live models, measured on its own run).
- **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only.
- **Row 19 / 39a leg 3** two-real-device test (needs a physical second device).
- **A1** GEN-BACKGROUND flip-default (needs a real mobile foreground gen A/B).
- **SO-004** (row 41) — no headless React #185 repro.
- **CAP-AMPUTATED-NOUNPHRASE-003** — gen-runner (non-PWA), honest fix is generative; filed OPEN.

## Nothing shipped by this run
No PWA/worker code changed by the 08-21 CI nightly → no PR, no cache-bust, no version consumed,
nothing owed live-verify FROM tonight beyond the pre-existing client-meter leg noted above.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
