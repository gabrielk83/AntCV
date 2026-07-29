# RELAY-COST-QUALITY-TUNE — weekly run 2026-07-15

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Data source this run: D1 `ant_memory`
`llm_provider_health`, aggregated over the last 7 days (`window_start >= max-604800`), pulled via
the Cloudflare MCP `d1_database_query` (relay admin-token path unavailable to the sandbox shell;
D1 read used instead). Snapshot scored offline through `scripts/relay-cost-quality-tune.mjs`
(floor 0.90, margin 0.10, min-calls 20).

## Step 1a — model-table freshness audit (BEFORE scoring)

- `node --test workers/proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- `node --test workers/demo-proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- Pins confirmed correctly priced (longest-key-wins) in BOTH `RATES` tables + present in each
  `multi-llm.js` cascade: `claude-opus-4-8` [5,25], `gpt-5.5` [30,60], `gpt-5.4-mini` [0.75,4.5],
  `claude-sonnet-5` [3,15]. No price drift, no table fix needed this week.

## Telemetry (last 7 days, per scoreable role)

**coherence** (`apply_correction`):

| provider | calls | ok | $/call | health |
|---|---|---|---|---|
| openai | 1759 | 100% | $0.01104 | 1.00 |

anthropic (the current head): **zero** apply_correction traffic in the window.

**analysis** (`analyze_fit` + `parse_jd`), per-provider blended:

| provider | calls | ok | $/call | health | costQuality | note |
|---|---|---|---|---|---|---|
| gemini | 2333 | 100% | $0.00218 | 0.69 | 317.7 | all parse_jd; **30% retry**; ZERO analyze_fit |
| openai | 2310 | 100% | $0.00896 | 0.94 | 105.3 | strong analyze_fit (n=1984, health 1.0); parse_jd thin (n=326, retry 2.0) |
| mistral | 26033 | 100% | $0.13058 | 0.70 | 5.36 | parse_jd workhorse; latency 221s |
| anthropic | 2608 | 100% | $0.23632 | 0.70 | 2.96 | parse_jd only; latency 302s |

## Decision — before → after

| role | before (head) | after (head) | action | driver |
|---|---|---|---|---|
| writer | anthropic | anthropic | keep | no telemetry (gen is client-dispatched) |
| supervisor | mistral | mistral | keep | no telemetry |
| coherence | anthropic | **openai** | **FLIP (shipped)** | openai carries 100% @100% ok; anthropic head 0 traffic |
| analysis | anthropic (unpinned) | anthropic (unpinned) | **HOLD (surfaced)** | task-conflation risk — see below |
| kernel | anthropic (unpinned) | anthropic (unpinned) | keep | no matching telemetry |

- `MODEL_ROLES` before: `{"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}`
- `MODEL_ROLES` after:  `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`
- **ROLLBACK:** set coherence back to `anthropic` in both `workers/proxy/wrangler.toml` +
  `workers/demo-proxy/wrangler.toml`, redeploy proxy + demo-proxy.

### Why coherence → openai shipped
`apply_correction` is the coherence role's real telemetry label. Over the last 7 days it ran
entirely on openai (n=1759, 100% ok, health 1.0) and the anthropic head produced **nothing** —
the head was effectively inert. The pin now matches the empirically-working provider; anthropic
remains in the cascade tail as fallback (guardrail satisfied: Anthropic fallback still reachable;
no cascade-tail provider removed). Single task, single provider — no conflation risk.

### Why analysis → gemini was HELD (not shipped) — RELAY-TUNE-COVERAGE-GAP-001
The scorer's best-costQuality pick is gemini (317.7), but the `analysis` role **conflates two
tasks that no single provider dominates**:
- `analyze_fit`: openai owns it (n=1984, health 1.0, retry 0). gemini has **zero** ground truth.
- `parse_jd`: gemini is cheapest but shows **30% first-attempt retry** and health 0.69; openai's
  parse_jd is thin/weak (n=326, retry 2.0).

Pinning the blended role to gemini would redirect a currently-100%-success openai `analyze_fit`
stream to a provider with no measured performance for that task — precisely the format-broken-
output-invisible-to-telemetry trap (cost-quality benchmark detection gap). A cheap winner on a
0.69-health / 30%-retry signal is the case the routine says to VERIFY before moving, not ship on
cost alone. **Owner-surfaced recommendation:** either (a) top up gemini `analyze_fit` ground truth
via the benchmark harness before flipping next week, or (b) split `analysis` into per-task heads
(analyze_fit→openai, parse_jd→cheapest-adequate) — an owner-gated architecture change, since
`roleHeadOrder` is per-role and the two tasks share one role key.

## Client-dispatch levers (NOT MODEL_ROLES-tunable — surfaced only)
The proxy forwards the client `ee()` router's `x-provider` + model verbatim, so these move at the
client router, not here (owner-gated). Weekly spend + cheapest-adequate alternative:

| task | weekly spend | current lead | cheapest adequate | potential saving/wk |
|---|---|---|---|---|
| compress | $4197.17 | anthropic $2385.93 | gemini $0.00012/call | ~$4164.62 |
| consensus_poll | $2875.48 | openai $2442.75 | gemini $0.00008/call | ~$2867.93 |
| long_context | $1661.58 | openai $1629.18 | gemini $0.00024/call | ~$1571.97 |
| consensus_reinforce | $52.13 | openai $50.56 | gemini $0.00015/call | ~$49.58 |

QUALITY-GATE caveat carries: telemetry flags are blind to format-broken output — verify a sample
before any client-router move. (This is the largest remaining cost lever by far — ~$8.6k/wk — but
it is not addressable by this routine.)

## Guardrails / gates honoured
- gen/flagship (`claude-opus-4-8`) untouched (owner-gated) — not proposed.
- PushNotify sent with the proposal before deploy (hard gate b); no mid-run override received.
- Adequacy floor 0.90 respected; coherence challenger openai at 100%.
- Anthropic fallback reachable for every role; no cascade-tail provider removed.
- Prior `MODEL_ROLES` recorded above for one-command rollback.
- Suites green before push: model-table-freshness 5/5 ×2, relay-cost-quality-tune 14/14.

## Deploy — DONE
- proxy: run 29447832182 ✓ success; `GET cv-proxy.karp-gabriel-a.workers.dev/health` → 200
  `{"ok":true,"service":"cv-proxy","version":"3.8.3-gemini-flash-ramble"}`.
- demo-proxy: run 29447903547 ✓ success; `GET antcv-demo-proxy.karp-gabriel-a.workers.dev/health`
  → 200 (same version). One deployer at a time (no other deploy in-flight, verified via `gh run list`).
- Note: this is a worker-config + docs change (no pwa asset / `?v=` cache-bust consumed), so no
  version-range shift claim was reserved; deployer exclusivity was ensured by the in-flight check.
- Commit `a9923fb` on main. Rollback = revert the MODEL_ROLES line in both wrangler.toml
  (`coherence`→`anthropic`) + redeploy proxy + demo-proxy.

## Operational note for future runs
The relay admin-token `/api/llm-health` path is not reachable from the sandbox shell this run, so
telemetry came from D1 `llm_provider_health` via the Cloudflare MCP `d1_database_query`. A single
call-weighted **full-table** aggregate over all tasks trips D1's per-query CPU limit (207k rows);
query **per-task with a literal `window_start` cutoff** (`>= max-604800`) instead — those return in
~20 ms each. Snapshot assembled to the `/api/llm-health` `rows[]` shape and scored offline with
`scripts/relay-cost-quality-tune.mjs --data`.
