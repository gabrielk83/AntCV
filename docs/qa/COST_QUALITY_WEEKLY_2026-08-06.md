# RELAY-COST-QUALITY-TUNE — weekly run 2026-08-06

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Scored offline through
`scripts/relay-cost-quality-tune.mjs` (floor 0.90, margin 0.10, min-calls 20).

**Result: NO FLIP.** `MODEL_ROLES` unchanged; no deploy, no version consumed. A very quiet week —
~22 LLM calls / ~$1.15 spend over 7 days. Every tunable role has thin/absent addressable telemetry
(far below the 20-call floor); the guardrails correctly refused every candidate.

## Data source (this run)

Relay admin token is not in the sandbox env, but `/api/llm-health` authorizes ANY signed-in user
(not admin-only — `workers/access-relay/src/index.js:5441`), so telemetry came from that endpoint
using the owner PWA JWT at `~/.antcv/token`. **I read the single `window=10080` (7-day) window only —
NOT a sum across the overlapping w60/w1440/w10080 windows** — so the phantom-volume multi-count trap
(documented 2026-07-22 / 2026-07-29) does not apply here. Caveat carried: I could not independently
cross-check against raw `llm_calls` this run (no D1 MCP `d1_database_query` tool in this session, no
admin token). It does not change the outcome: every per-(task,provider) count is n=1–5, an order of
magnitude below min-calls=20, so the no-flip conclusion is robust to any counting error.

- **~22 LLM calls / ~$1.15 true spend over the last 7 days** (single-seeker tool; a very quiet week,
  down from ~761 calls the week of 2026-07-29).

## Step 1a — model-table freshness audit (BEFORE scoring)

- `node --test workers/proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- `node --test workers/demo-proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- Pins confirmed present + correctly priced (longest-key-wins) in BOTH `RATES` tables + each
  `multi-llm.js` cascade: `claude-opus-4-8` [5,25], `gpt-5.5` [30,60], `gpt-5.4-mini` [0.75,4.5],
  `claude-sonnet-5` [3,15]. All four also confirmed still pinned in `pwa/app.src.js`. No price
  drift, **no table fix needed this week.**
- **Latent gap carried from 2026-07-29 (still OPEN, still not active):** `gemini-3-flash-preview` +
  `gemini-3.1-pro-preview` are in the app model pickers (`pwa/app.src.js`) but have no explicit
  `RATES` key in either `demo-enforcement.js` — they would fall through to `FALLBACK_RATE` [3,15]
  and misprice a flash model ~30× IF dispatched. Real gemini traffic this week is unchanged
  (`gemini-2.5-flash` [0.10,0.40], correctly priced), so not corrupting current scoring. Add explicit
  keys at verified public rates + extend `model-table-freshness.test.mjs` before either enters
  rotation (owner/next-run, gated on confirming public pricing). Registered — OPEN_REGISTER row 38.

## Telemetry — last 7 days, `/api/llm-health` window=10080, per (provider, task)

All 11 rows 100% success; zero placeholder-leak / malformed-output / banned / fabrication flags.
Only one non-zero retry (gemini parse_jd, retry_rate 0.5 on n=2).

| provider | task | calls | $/call | weekly $ | role mapping |
|---|---|---|---|---|---|
| claude | parse_jd | 1 | $0.73949 | $0.74 | **analysis** (n=1 < 20 floor) |
| mistral | parse_jd | 2 | $0.14302 | $0.29 | **analysis** (n=2 < 20 floor) |
| openai | apply_correction | 2 | $0.01691 | $0.03 | **coherence** (n=2 < 20 floor) |
| mistral | consensus_poll | 2 | $0.01501 | $0.03 | client-dispatch |
| openai | consensus_reinforce | 2 | $0.00838 | $0.02 | client-dispatch |
| openai | analyze_fit | 5 | $0.00267 | $0.01 | **analysis** (n=5 < 20 floor) |
| openai | consensus_poll | 2 | $0.00360 | $0.01 | client-dispatch |
| gemini | parse_jd | 2 | $0.00338 | $0.01 | **analysis** (n=2 < 20 floor) |
| openai | fuse | 1 | $0.00656 | $0.01 | client-dispatch |
| openai | compress | 1 | $0.00579 | $0.01 | client-dispatch |
| gemini | consensus_poll | 2 | $0.00037 | $0.00 | client-dispatch |

Note the two `parse_jd` outliers per call: **claude $0.739/call** (opus-tier on one long JD, n=1) and
**mistral $0.143/call** (n=2). Both map to the unpinned `analysis` role and are far below the sample
floor — surfaced, not actionable this week. The compress ensemble that dominated prior weeks
(claude leg ~$5.4/wk on 2026-07-29) barely ran this week (openai n=1, $0.01) — nothing to flag.

## Decision — before → after

| role | before (head) | after (head) | action | driver |
|---|---|---|---|---|
| writer | anthropic | anthropic | keep | no telemetry (gen is client-dispatched) |
| supervisor | mistral | mistral | keep | no telemetry |
| coherence | openai | openai | keep | apply_correction openai n=2 < 20 min-calls → ineligible |
| analysis | anthropic (unpinned) | anthropic (unpinned) | keep | best provider (openai) n=5 < 20 min-calls → ineligible |
| kernel | anthropic (unpinned) | anthropic (unpinned) | keep | no matching telemetry |

- `MODEL_ROLES` before AND after: `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`
- No `wrangler.toml` change, no deploy. **ROLLBACK N/A** (nothing shipped for MODEL_ROLES).

"No flip this week (thin/absent addressable telemetry; min-calls floor held)" is a valid closed-loop
outcome — the guardrails held on a genuinely quiet week.

## Client-dispatch levers (NOT MODEL_ROLES-tunable — surfaced only)

The proxy forwards the client `ee()` router's `x-provider` + model verbatim, so these move at the
client router, not here (owner-gated — RELAY-TUNE-COVERAGE-GAP-001, OPEN_REGISTER row 38). All are
already governed client-side by RELAY-COST-TIEBREAK-001. This week they are negligible: compress
$0.01, consensus_poll ~$0.04, consensus_reinforce $0.02, fuse $0.01 — nothing worth an owner call.

QUALITY-GATE caveat carries: telemetry flags are blind to format-broken output — verify a sample
before any client-router move (cost-quality-benchmark detection gap).

## Guardrails / gates honoured

- gen/flagship (`claude-opus-4-8`) untouched (owner-gated) — not proposed.
- No flip → no pre-deploy PushNotify required (hard gate b fires before a deploy; none this week).
- Adequacy floor 0.90 + min-calls 20 respected; no provider cleared eligibility to lead.
- Anthropic fallback reachable for every role; no cascade-tail provider removed.
- Suites green before push: model-table-freshness 5/5 ×2, relay-cost-quality-tune 15/15.
- Docs-only change; SYNC-FIRST before push; shift 1.51.4106-4125 claimed, no version consumed.
