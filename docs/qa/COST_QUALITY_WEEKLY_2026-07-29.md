# RELAY-COST-QUALITY-TUNE — weekly run 2026-07-29

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Scored offline through
`scripts/relay-cost-quality-tune.mjs` (floor 0.90, margin 0.10, min-calls 20).

**Result: NO FLIP.** `MODEL_ROLES` unchanged; no deploy, no version consumed. Every tunable role
has thin/absent addressable telemetry; the remaining spend sits in client-dispatch tasks the
routine cannot reroute. Details + a concrete false-positive-caught note below.

## Data source (read this — same correction as 2026-07-22)

Relay admin-token `/api/llm-health` is not reachable from the sandbox shell, so telemetry came from
D1 `ant_memory` via the Cloudflare MCP `d1_database_query`. **The honest source is raw `llm_calls`,
NOT the `llm_provider_health` rolling-window aggregate the procedure names** — the health table
holds overlapping rolling windows, so summing `call_count`/`total_cost_usd` across a 7-day span
multi-counts every call across every window it appears in (the phantom-volume trap first documented
2026-07-22).

This run **demonstrated the trap live**: I first summed `llm_provider_health` and the scorer
proposed a FLIP `analysis → openai` (it read `parse_jd` as **n=1253**, clearing the min-calls floor,
and openai's `analyze_fit` cost-quality crushed mistral's `parse_jd`). Re-pulling from raw
`llm_calls` shows `parse_jd` is only **n=12 < 20** → `analysis` is ineligible → **no change**. The
phantom count would have shipped a pin justified by traffic MODEL_ROLES cannot even steer. Raw
`llm_calls` is the source of truth; a future scorer fix should read it (or de-dupe windows) directly.

- **~761 LLM calls / ~$9.8 true spend over the last 7 days** (single-seeker tool; a quiet week).

## Step 1a — model-table freshness audit (BEFORE scoring)

- `node --test workers/proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- `node --test workers/demo-proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- Pins confirmed present + correctly priced (longest-key-wins) in BOTH `RATES` tables + each
  `multi-llm.js` cascade: `claude-opus-4-8` [5,25], `gpt-5.5` [30,60], `gpt-5.4-mini` [0.75,4.5],
  `claude-sonnet-5` [3,15]. No price drift, **no table fix needed this week.**
- Cross-checked every model id referenced in `pwa/app.src.js` against `RATES`: all dispatched
  models resolve to a correct explicit key. Real gemini traffic uses `gemini-2.5-flash` [0.10,0.40]
  (verified in `llm_calls`), NOT a fallback. **One latent gap found** (not active, not corrupting
  this week): `gemini-3-flash-preview` and `gemini-3.1-pro-preview` appear in the app model pickers
  but have no explicit `RATES` key — they would fall through to `FALLBACK_RATE` [3,15] (Sonnet) if
  ever dispatched, mispricing a flash model ~30×. Registered (OPEN_REGISTER row 38) to add explicit
  keys at verified public rates before either enters rotation.

## Telemetry — last 7 days, raw `llm_calls`, per (task, provider)

All rows 100% success, zero retries, zero placeholder-leak / malformed-output / banned / fabrication
flags.

| task | provider | calls | $/call | weekly $ | role mapping |
|---|---|---|---|---|---|
| compress | claude | 141 | $0.038346 | $5.41 | client-dispatch (ensemble leg) |
| compress | mistral | 141 | $0.008949 | $1.26 | client-dispatch |
| compress | openai | 141 | $0.002262 | $0.32 | client-dispatch |
| compress | gemini | 152 | $0.000071 | $0.01 | client-dispatch |
| parse_jd | mistral | 12 | $0.135249 | $1.62 | **analysis** (n=12 < 20 floor) |
| long_context | openai | 112 | $0.007735 | $0.87 | client-dispatch |
| consensus_poll | mistral/openai/gemini | 18/18/12 | — | $0.27 | client-dispatch |
| consensus_reinforce | openai | 8 | $0.006263 | $0.05 | client-dispatch |
| enrich | openai | 4 | $0.002746 | $0.01 | (unmapped, negligible) |
| analyze_fit | openai | 2 | $0.002910 | $0.01 | **analysis** (n=2 < 20 floor) |

`compress` fans out to all four providers at near-equal volume (141/141/141 + gemini 152) — an
ensemble/consensus shape, not a single reroutable head. Its cost is dominated by the **claude leg
($5.41/wk = ~55% of total spend)**, which is ~540× costlier per call than the gemini leg.

## Decision — before → after

| role | before (head) | after (head) | action | driver |
|---|---|---|---|---|
| writer | anthropic | anthropic | keep | no telemetry (gen is client-dispatched) |
| supervisor | mistral | mistral | keep | no telemetry |
| coherence | openai | openai | keep | no `apply_correction` traffic this week |
| analysis | anthropic (unpinned) | anthropic (unpinned) | keep | openai n=2 + mistral n=12, both < 20 min-calls → ineligible |
| kernel | anthropic (unpinned) | anthropic (unpinned) | keep | no matching telemetry |

- `MODEL_ROLES` before AND after: `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`
- No `wrangler.toml` change, no deploy. **ROLLBACK N/A** (nothing shipped for MODEL_ROLES).

"No flip this week (thin/absent addressable telemetry; min-calls floor held)" is a valid
closed-loop outcome — the guardrails correctly refused a false-positive flip from a phantom count.

## Client-dispatch levers (NOT MODEL_ROLES-tunable — surfaced only)

The proxy forwards the client `ee()` router's `x-provider` + model verbatim, so these move at the
client router, not here (owner-gated — RELAY-TUNE-COVERAGE-GAP-001, OPEN_REGISTER row 38). All are
already governed client-side by RELAY-COST-TIEBREAK-001 (bounded cost penalty folded into
health_score for cost-sensitive tasks).

- **compress $7.00/wk** — claude leg $5.41/wk (141 calls @ $0.0383/call) is the residual outlier,
  same class the 2026-07-22 run flagged: it persists despite the tie-break demotion that should
  sink an adequate cost-loser behind gemini ($0.000071/call). Because compress fans out to all four
  providers ~equally, the question for the owner is whether the ensemble NEEDS the claude leg for
  quality; if not, dropping claude from the compress dispatcher saves ~$5.4/wk. Worth checking the
  tie-break seed reaches the compress path for all clients (two weeks running now).
- **parse_jd (mistral) — $1.62/wk, avg latency 235 SECONDS.** Not a cost outlier, but the latency is
  extreme (vs openai's 4.5s on analyze_fit). Client-dispatched; flagged for an owner look at the
  mistral parse_jd path (timeout/model choice) rather than a routing change.
- **long_context $0.87/wk** (openai), **consensus_poll $0.27/wk**, **consensus_reinforce $0.05/wk** —
  negligible.

QUALITY-GATE caveat carries: telemetry flags are blind to format-broken output — verify a sample
before any client-router move (cost-quality-benchmark detection gap).

## Guardrails / gates honoured

- gen/flagship (`claude-opus-4-8`) untouched (owner-gated) — not proposed.
- No flip → no pre-deploy PushNotify required (hard gate b fires before a deploy; none this week).
- Adequacy floor 0.90 + min-calls 20 respected; no provider cleared eligibility to lead.
- Anthropic fallback reachable for every role; no cascade-tail provider removed.
- Suites green before push: model-table-freshness 5/5 ×2, relay-cost-quality-tune 15/15.
- Docs-only change; SYNC-FIRST before push; shift 1.51.4066-4085 claimed, no version consumed.
