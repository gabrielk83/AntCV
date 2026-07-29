# RELAY-COST-QUALITY-TUNE — weekly run 2026-07-22

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Scored offline through
`scripts/relay-cost-quality-tune.mjs` (floor 0.90, margin 0.10, min-calls 20).

**Result: NO FLIP.** `MODEL_ROLES` unchanged; no deploy. Every tunable role has thin/absent
addressable telemetry this week; the remaining spend sits in client-dispatch tasks the routine
cannot reroute. Details below.

## Data source + methodology correction (read this)

The relay admin-token `/api/llm-health` path is not reachable from the sandbox shell, so telemetry
came from D1 `ant_memory` via the Cloudflare MCP `d1_database_query`. **This run read `llm_calls`
directly (raw per-call rows over the last 7 days), NOT the `llm_provider_health` rolling-window
aggregate the procedure names.** Reason: `llm_provider_health` holds 199,310 overlapping
rolling-window rows; summing `total_cost_usd`/`call_count` across a 7-day span multi-counts each
call across every window it appears in. That over-count is why the 2026-07-15 report shows
"26,033 mistral calls" and "$4,197/wk compress" / "~$8.6k/wk" figures — phantom volume, not real
traffic. AntCV is a single-seeker tool; the honest raw counts from `llm_calls` are:

- **434 total LLM calls in the last 7 days · ~$6.79 true spend/wk** (most recent call 8 min before
  this run — logging is live; this is simply a quiet week).

The decision is identical under either source (no eligible challenger for any tunable role), but
the raw `llm_calls` numbers are the ones that are true, and the min-calls floor is honest against
them (analysis/parse_jd = 14 real calls, correctly below the 20 floor — the window aggregate would
have shown thousands of phantom calls and falsely cleared the floor).

## Step 1a — model-table freshness audit (BEFORE scoring)

- `node --test workers/proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- `node --test workers/demo-proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- Pins confirmed present + correctly priced (longest-key-wins) in BOTH `RATES` tables + each
  `multi-llm.js` cascade: `claude-opus-4-8` [5,25], `gpt-5.5` [30,60], `gpt-5.4-mini` [0.75,4.5],
  `claude-sonnet-5` [3,15]. No price drift, **no table fix needed this week.**

## Telemetry — last 7 days, raw `llm_calls`, per (task, provider)

All rows 100% success, zero retries, zero placeholder-leak / malformed-output flags.

| task | provider | calls | $/call | weekly $ | role mapping |
|---|---|---|---|---|---|
| compress | gemini | 65 | $0.000119 | | client-dispatch (untunable) |
| compress | openai | 60 | $0.002875 | | client-dispatch |
| compress | claude | 56 | $0.042606 | | client-dispatch |
| compress | mistral | 56 | $0.009718 | $3.110 total | client-dispatch |
| long_context | openai | 123 | $0.007689 | | client-dispatch |
| long_context | claude | 3 | $0.162167 | $1.432 total | client-dispatch |
| parse_jd | mistral | 14 | $0.133947 | $1.875 | **analysis** (n=14 < 20 floor) |
| consensus_poll | gemini/mistral/openai | 14/14/14 | — | $0.219 | client-dispatch |
| consensus_reinforce | openai | 3 | $0.008490 | $0.025 | client-dispatch |
| enrich | openai | 12 | $0.003575 | $0.043 | (unmapped, negligible) |

## Decision — before → after

| role | before (head) | after (head) | action | driver |
|---|---|---|---|---|
| writer | anthropic | anthropic | keep | no telemetry (gen is client-dispatched) |
| supervisor | mistral | mistral | keep | no telemetry |
| coherence | openai | openai | keep | no `apply_correction` traffic this week; no reason to move |
| analysis | anthropic (unpinned) | anthropic (unpinned) | keep | only mistral/parse_jd, n=14 < 20 min-calls → ineligible |
| kernel | anthropic (unpinned) | anthropic (unpinned) | keep | no matching telemetry |

- `MODEL_ROLES` before AND after: `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`
- No `wrangler.toml` change, no deploy. **ROLLBACK N/A** (nothing shipped for MODEL_ROLES).

"No flip this week (thin/absent addressable telemetry, hysteresis + min-calls floor held)" is a
valid closed-loop outcome: the guardrails correctly refused to chase a 434-call quiet week.

## Client-dispatch levers (NOT MODEL_ROLES-tunable — surfaced only)

The proxy forwards the client `ee()` router's `x-provider` + model verbatim, so these move at the
client router, not here (owner-gated — RELAY-TUNE-COVERAGE-GAP-001, OPEN_REGISTER row 38).

- **compress $3.11/wk** — now led by **claude $2.39/wk** (56 calls @ $0.0426/call); cheapest
  adequate = gemini @ $0.000119/call → ~$3.08/wk potential. NOTE: this is a shift from the
  2026-07-13 picture (openai was the compress outlier at ~$62/wk; the COMPRESS-COST-OPENAI-DROP-001
  client fix + the gpt-5.4-mini repricing resolved that — openai compress is now $0.17/wk). The new
  residual outlier is **claude**: 56 compress calls still landed on claude this week despite the
  RELAY-COST-TIEBREAK-001 client demotion that should sink an adequate cost-loser behind gemini.
  Worth an owner look at whether the tie-break seed is reaching the compress path for all clients.
- **long_context $1.43/wk** — openai $0.95 (123 calls); claude tail 3 calls @ $0.162/call.
- **consensus_poll $0.22/wk**, **consensus_reinforce $0.03/wk** — negligible.

QUALITY-GATE caveat carries: telemetry flags are blind to format-broken output — verify a sample
before any client-router move (cost-quality-benchmark detection gap).

## Routine self-fix shipped this run — RELAY-TUNE-NAN-FALLBACK-001

`scoreRows` line 92 guarded the quality composite on `Number(r.health_score) != null`. Because
`Number(undefined) === NaN` and `NaN != null` is `true`, the intended fallback to `success_rate`
**never fired** when a snapshot lacked `health_score` — poisoning `quality` (and thus
`costQuality`) with NaN. This is precisely the offline path this routine builds when the relay
admin token is unavailable (D1 `llm_calls` has no `health_score` column — this run and 2026-07-15).
Fix: guard on the raw field (`r.health_score != null ? … : Number(r.success_rate) || 0`). Added a
covering test ("missing health_score falls back to success_rate"). Suite: **15/15 green** (was 14).
Before the fix this run's `analysis`/mistral scored `cq=NaN q=NaN`; after, `cq=7.466 q=1.00`
(decision unchanged — still ineligible at n=14). Pure scoring-script change, no deploy, no version
consumed.

## Guardrails / gates honoured

- gen/flagship (`claude-opus-4-8`) untouched (owner-gated) — not proposed.
- No flip → no pre-deploy PushNotify required (hard gate b fires before a deploy; none this week).
- Adequacy floor 0.90 + min-calls 20 respected; no provider cleared eligibility to lead.
- Anthropic fallback reachable for every role; no cascade-tail provider removed.
- Suites green before push: model-table-freshness 5/5 ×2, relay-cost-quality-tune **15/15**.
- Docs + non-versioned script change only; SYNC-FIRST before push; no shift range consumed.
