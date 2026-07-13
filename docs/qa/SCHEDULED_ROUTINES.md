# Scheduled / recurring routines — register + NIGHT SHIFT framing

Every routine below runs autonomously and pushes to `origin/main` (or deploys a worker),
so every one is a parallel session that can collide with the desktop, the cloud Routine, or
another routine. **They are all bound by the same discipline** (`CLAUDE.md` § Sync discipline
+ `docs/qa/NIGHT_SHIFT.md`):

> **STANDING RULE for every scheduled routine.** At the start of each run: (1) `git fetch origin
> && git pull --rebase origin main`; (2) if the run will consume a version number (any `pwa/`
> cache-bust) or touch files a parallel session might, `node scripts/shift.mjs claim --task
> "<routine-name>"` and work in the printed `git worktree`; (3) use version numbers only inside
> the claimed range; (4) `node scripts/shift.mjs release` at the end. A routine that only reads,
> or only writes data/docs, may skip the claim but still SYNCs FIRST and never force-pushes.
> `node scripts/shift.mjs status` reads origin, so it is correct even from a dirty tree.

Each routine's own prompt/config (in the scheduled-tasks store, outside the repo) should point
at this file so the rule travels with it. The authoritative live list of triggers is the
scheduled-tasks store + memory `scheduled-jobs-map`; this doc is the framing + the review-and-tune
routines' procedures.

## Routine register

| Routine | Cadence | Pushes to main / deploys? | Claim required | Notes |
|---|---|---|---|---|
| `antcv-position-discovery` | bi-weekly (Sun + Tue 22:00) | data only (Excel/D1 PROPOSED rows) | no (data-only) — SYNC FIRST | Finds NEW openings vs the Dream Envelope, propose-only. `scripts/job-tracker/discover-positions.py`; memory position-discovery-task. |
| antcv-job-tracker-nightly | nightly | yes (gen-runner may commit; may bump islands/app) | **yes** | Generates/persists tracked applications. `scripts/job-tracker/gen-runner.py`. |
| antcv-nightly | nightly | yes (PWA/worker fixes) | **yes** | Verify-first backlog work; ships cache-busted PWA changes → always claim. |
| weekly demand-seed (CLUSTER-QUAL) | weekly | yes (worker + D1 top-20 refresh) | **yes** (if it ships code) | Cluster demand model refresh. Partly unbuilt. |
| **relay cost-quality tune** (RELAY-COST-QUALITY-TUNE-001) | **weekly** | **yes (proxy `MODEL_ROLES` + deploy)** | **yes** | NEW — see the procedure below. Reviews the week's router telemetry AND modifies the routing function so it improves over time. |
| weekly security audit | weekly | report only | no | Read-only audit → report. |
| relay health probe | ~5-min | none (alert only) | no | Liveness. |
| model-freshness check | daily | none/report | no | Flags stale model ids. |

---

## RELAY-COST-QUALITY-TUNE-001 — weekly review + MODIFY the cost-quality router

**Goal (owner):** the relay cost-quality function must be *reviewed and modified on a weekly
basis so the function is always improving over time* — a closed loop, not just a scorer. Each
week it looks at how every provider actually performed per task, then adjusts which provider
LEADS each task so cost-per-acceptable-output trends down while quality holds.

### The lever
The router (`workers/proxy/src/multi-llm.js`) tries providers in a cascade; `roleHeadOrder(env,
role, baseOrder)` moves the provider named for a role in **`env.MODEL_ROLES`** (a JSON map
`role → providerId` in the proxy `[vars]`, mirrored in demo-proxy) to the HEAD of the cascade for
that role. So **tuning = editing `MODEL_ROLES`** (which provider leads each task); the full cascade
stays as the fallback tail. The adequacy gate + per-task demotion already run at request time —
this routine changes the *starting* choice based on the week's evidence.

### The data
- **`llm_provider_health`** — the rolling-window aggregate the access-relay cron builds from
  `llm_calls` (read this, never `llm_calls` directly). Per (role, provider): call count, ok rate,
  retries, latency, token cost.
- **`llm_quality_signals`** — adequacy-gate outcomes / quality signals per call.
- Ground-truth top-up when telemetry is thin for a role: re-run the benchmark harness
  `scratchpad/bench_{generate,judge,translate}.py` (method + rubric frozen in
  `docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`) for the affected roles only.

### The weekly procedure
1. **SYNC + CLAIM** a shift range (this deploys a worker → coordinate), work in a worktree.
2. **Pull** the last 7 days from `llm_provider_health` + `llm_quality_signals` per role
   (extract / parse_jd / compress / gen / coherence / translate / analysis / supervisor).
3. **Score** each provider per role: `costQuality = adequacy_pass_rate / cost_per_call`
   (tie-break: fewer retries, lower latency). Require the adequacy pass rate ≥ the role's floor
   before a provider is eligible to LEAD.
4. **Decide** the new head per role = the eligible provider with the best `costQuality`. Apply
   **bounded** change: flip at most the head per role per week (no wholesale reshuffle); if the
   current head is within a small margin of the best, keep it (hysteresis — avoid flapping).
5. **Guardrails (never violate):** never remove a provider from the cascade tail (fallback must
   survive); never leave a role with no Anthropic fallback reachable; never raise a role's head to
   a provider below its adequacy floor; keep the PRIOR `MODEL_ROLES` value in the commit body for
   one-command rollback.
6. **Ship:** update `MODEL_ROLES` in `workers/proxy/wrangler.toml` + `workers/demo-proxy/wrangler.toml`,
   `gh workflow run deploy.yml -f target=proxy …` (+ demo-proxy), verify each `/health`.
7. **Report:** append a dated block to `docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md` (or a
   `COST_QUALITY_WEEKLY_<date>.md`) with the per-role before→after head, the scores that drove it,
   and the rollback value. Update the register (OPEN_REGISTER / FEATURES_REGISTRY / ACTIVE_BUGS).
8. **RELEASE** the shift claim.

### Why it improves over time
Each week the head of every role converges toward the best measured cost-quality provider on
*that week's real traffic*, with hysteresis so it doesn't chase noise and guardrails so a cheap-but-
inadequate provider can never win. The dated reports form an audit trail of the function's evolution;
a regression (quality dips after a flip) is visible next week and reverts via the logged rollback.

### Automation — `scripts/relay-cost-quality-tune.mjs`
The scoring + proposal is implemented as `scripts/relay-cost-quality-tune.mjs`. It reads the
current `MODEL_ROLES` from `workers/proxy/wrangler.toml`, pulls the week's health snapshot
(`GET /api/llm-health?window=all` via `ANTCV_RELAY_URL` + `ANTCV_ADMIN_TOKEN`, or `--data
<snapshot.json>` offline), applies the score + guardrails above, and **emits the proposed
`MODEL_ROLES` diff + per-role rationale** — it does NOT deploy. Weekly run:

```
ANTCV_RELAY_URL=… ANTCV_ADMIN_TOKEN=… node scripts/relay-cost-quality-tune.mjs      # dry-run diff
node scripts/relay-cost-quality-tune.mjs --data health.json --apply                 # write both wrangler.toml (still no deploy)
# then review the diff, deploy proxy + demo-proxy via deploy.yml, verify /health, log before→after + rollback
```

Flags: `--floor` (adequacy success-rate floor, default 0.90), `--margin` (cost-quality hysteresis,
default 0.10), `--min-calls` (sample floor, default 20), `--window`, `--apply`, `--json`. The
scoring core (`scoreRows` / `proposeRoles`) is pure + unit-tested (`scripts/tests/relay-cost-quality-tune.test.mjs`,
8 cases: cheaper-wins, hysteresis-holds, floor/min-sample/known-provider guardrails, no-data→keep).
The **apply + deploy stays agent/owner-gated** — a change to `MODEL_ROLES` affects every user's
generation, so the script never ships on its own.
