# Session Log — 2026-07-24 (CLUSTER-QUAL-001 weekly demand-seed tuning)

Scope this run: the **weekly demand-tuning routine** (spec §7.6), not general app
maintenance. First run under the STANDING RULE 0 preflight+heartbeat gate
(`scripts/routine-preflight.mjs`, added 2026-07-21). Touched only
`pwa/antcv-cluster-demand.js`, `pwa/index.html`, `pwa/sw.js`,
`pwa/antcv-version-override.js` (cache-bust quintet), `docs/analysis/*`,
`docs/qa/*`, and D1 (`application_qualification` / `cluster_top_qualifications`
via the `source='research'` writer). No app.js/app.src.js changes (out of
scope for this routine per CLAUDE.md).

## Context: 11-day gap since the last real refresh

The last shipped research was 2026-07-13 (`1.51.478-demand-seed-refresh`).
The 2026-07-17 scheduled fire produced **no report and no push** — a silent
no-op, exactly the failure mode `docs/qa/SCHEDULED_ROUTINES.md` STANDING RULE 0
was written to catch (this was one of the two incidents cited when that rule
was added 2026-07-21). This run is therefore the **first execution of the new
preflight/heartbeat gate for this routine** (`ROUTINE_HEALTH.jsonl` had zero
prior entries for `antcv-demand-seed-weekly` before today's `start` line) and
carries two weeks of accumulated market drift, which is why all 9 clusters
returned evidence-backed changes instead of the usual handful.

## CLOSED this run

- **Preflight caught a dirty shared clone** (owner had uncommitted work in the
  desktop checkout) and routed this run into an isolated worktree per STANDING
  RULE 0 — confirms the gate works as designed, not just in the abstract.
- **CLUSTER-QUAL-001 §7.6 weekly refresh — all 9 clusters.** Researched
  current market demand via 9 parallel WebSearch passes (one per cluster, each
  given the currently-shipped top-20 as baseline and instructed to change only
  on real evidence). Google CSE proxy still not used — no `CSE_PROXY_TOKEN` in
  this session's env and the Google path still 403s per
  `docs/deployment/google-cse-setup.md` §6 (Brave-first fix committed, not yet
  deployed to access-relay). `docs/analysis/cluster_top20_research_2026-07-24.json`
  is the full output (per-item source URLs, `changes_this_run` rationale per
  cluster).
- **Client SEED updated (9/9 clusters), `pwa/antcv-cluster-demand.js`
  `1.51.478 → 1.51.3722`.** Notable shifts: pm_process gained a business/
  commercial-acumen item and broadened its matrix-org item to PMI's 2026
  "systems-level complexity" framing; research_phd promoted publication record
  to r3 and added a new nanofabrication/cleanroom item; consulting and
  executive both promoted AI fluency further (r5→r2, r4→r2 respectively) with
  executive also promoting emotional intelligence r11→r3; finance reordered
  its top-4 on Morgan McKinley's 2026 pay-premium ranking; people_soft
  promoted critical-thinking and business-acumen ahead of AI-literacy per
  Pin.com's 2026 State of Talent Acquisition report (73% of TA leaders name
  critical thinking the top skill need, ranked above AI skills). Full
  per-cluster evidence trail in the research JSON's `changes_this_run`.
- **D1 research writer run:** `node scripts/cluster-demand-research-push.mjs`
  against `https://antcv-access-relay.karp-gabriel-a.workers.dev` —
  `{"ok":true,"clusters_updated":9,"total_inserted":198}` (198, not 180,
  because the union writer retains a qual dropped from the new top-20 at a
  floor weight rather than deleting it — nothing lost, per the 07-13 fuse).
- **Cache-bust quintet** → `1.51.3722-demand-seed-refresh` (index.html `?v=`
  ×2 [`antcv-cluster-demand.js` src + `ANTCV_VERSION` seed], `sw.js` CACHE,
  `antcv-version-override.js` TARGET_VERSION + STALE_VERSIONS append
  `1.51.3702-photo-center` [the prior TARGET, not the new one]). Shift range
  claimed: `1.51.3722-1.51.3741`.
- **Verified:** `node -e` load check (9 clusters × 20 items, all load,
  unsolicited `activeClusters()` returns all 9, `score()` smoke test
  non-zero); `node scripts/run-tests.mjs pwa` — **1464/1464 pass, 0 fail**
  (full green, unlike 07-10's 8 pre-existing unrelated failures — those live
  in `workers/access-relay/tests/*` and a Denmark-postcode suite outside the
  `pwa` scope this command runs).

## OPEN (carry forward)

- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — still open per
  `docs/deployment/google-cse-setup.md` §6; Brave-first fallback code is
  committed (`auth-33-cse-brave`) but access-relay has not been redeployed
  with it since. Next run: check whether a deploy has landed before assuming
  still-blocked.
- **Silent no-op class (2026-07-17)** — root cause was environmental (fired
  into a state where SYNC/claim likely failed silently, pre-dating the
  preflight gate); the STANDING RULE 0 heartbeat added 2026-07-21 is the fix
  and this run is its first successful exercise for this routine. No further
  action needed unless a future run STARTS but never ENDS in
  `ROUTINE_HEALTH.jsonl` (`node scripts/routine-preflight.mjs report --days 14`
  would surface that).
- **9/9 clusters changed this run** (vs. the usual 4-5) — a one-time
  catch-up effect from the 07-17 gap, not evidence the model is unstable.
  Expect the next on-time weekly run (07-31) to return to the smaller,
  bounded-shift pattern.
