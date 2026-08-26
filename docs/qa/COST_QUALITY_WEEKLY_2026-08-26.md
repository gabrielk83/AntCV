# RELAY-COST-QUALITY-TUNE — weekly run 2026-08-26

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Scored offline through
`scripts/relay-cost-quality-tune.mjs` (floor 0.90, margin 0.10, min-calls 20) on a snapshot built
from **raw `llm_calls`** via the Cloudflare D1 MCP (`ant_memory` `499c3de9-8371-428a-9b9f-5d695d58e32b`),
with **every cost recomputed from raw token counts at the step-1a audited rates** (step 1b(iii)).

**Result: NO FLIP.** `MODEL_ROLES` unchanged; no deploy, no version consumed, no shift lane claimed.

**Rollback value (unchanged, both proxies):**
`MODEL_ROLES = '{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`

## The headline: the trailing 7-day window is empty

The most recent LLM call of any task is **2026-08-19 11:26:13 UTC**. The tune week
(2026-08-19 → 2026-08-26) contains **zero calls**. Scoring therefore ran on a **30-day** window so the
run produces evidence rather than an empty table; the no-flip verdict holds under either window.

This is the same quiet-traffic pattern as 2026-08-06 and the 2026-08-07 desktop cross-check, and it
follows a week (2026-08-20 report) that did carry 499 calls. Traffic is bursty, not gone.

## Step 1a — model-table freshness audit (BEFORE scoring)

Green across **all three** `RATES` mirrors (the 2026-08-20 correction 1a-bis(i) is holding):

| test | result |
|---|---|
| `workers/proxy/test/model-table-freshness.test.mjs` | **10/10** |
| `workers/demo-proxy/test/model-table-freshness.test.mjs` | **10/10** |
| `pwa/test/relay-model-rates-mirror.test.mjs` (`access-relay/src/model-rates.js`) | **5/5** |
| `pwa/test/llm-cost-provider-rates.test.mjs` (PWA `C` map parity) | **27/27** |
| `pwa/test/llm-cost-effective-from.test.mjs` | **5/5** |

Pins confirmed present and correctly priced (longest-key-wins): `claude-opus-4-8` [5,25],
`gpt-5.5` [30,60] (priced but deliberately **not** in the default openai cascade, per 1a-bis(ii)),
`gpt-5.4-mini` [0.75,4.5], `claude-sonnet-5` [3,15], `mistral-large`/`-latest` [0.5,1.5],
`gemini-2.5-flash` [0.30,2.50] vs `-flash-lite` [0.10,0.40]. **No price drift, no table fix owed.**

## Step 1b — cost-source audit

**The gap found on 2026-08-20 (COST-SOURCE-AUDIT-GAP-001) is now closed in the data.** D1
`llm_provider_costs` carries a corrected row for every current pin at `effective_from = 1787184000`
(2026-08-20 00:00 UTC), matching the audited worker rates exactly — including the two ids that
previously missed and fell through to the PWA map (`mistral-large-latest`, `claude-sonnet-5`) and the
stale `gemini-2.5-flash` row, which is now superseded rather than deleted.

**But the correction has never priced a live call.** The last call predates `effective_from` by ~12.5
hours, so **100% of the rows in this window were logged at the pre-fix rates**. Recomputing from raw
tokens at the audited rates against the stored `estimated_cost_usd`:

| provider / model | task | n | logged $ | recomputed $ | skew |
|---|---|---|---|---|---|
| gemini / gemini-2.5-flash | compress | 144 | 0.011378 | 0.076883 | **0.15x** (under) |
| openai / gpt-5.4-mini | compress | 138 | 0.328252 | 0.328246 | 1.00x |
| claude / claude-sonnet-5 | compress | 137 | 5.350650 | 1.758771 | **3.04x** (over) |
| mistral / mistral-large-latest | compress | 105 | 0.953979 | 0.158997 | **6.00x** (over) |
| mistral / mistral-large-latest | consensus_poll | 14 | 0.182634 | 0.030439 | 6.00x |
| openai / gpt-5.4-mini | consensus_poll | 13 | 0.042147 | 0.042148 | 1.00x |
| gemini / gemini-2.5-flash | consensus_poll | 12 | 0.001628 | 0.008188 | 0.20x |
| openai / gpt-5.4-mini | analyze_fit | 12 | 0.032980 | 0.032980 | 1.00x |
| mistral / mistral-large-latest | parse_jd | 11 | 1.540689 | 0.256781 | 6.00x |
| openai / gpt-5.4-mini | consensus_reinforce | 9 | 0.054342 | 0.054342 | 1.00x |
| openai / gpt-5.4-mini | apply_correction | 6 | 0.095810 | 0.095810 | 1.00x |
| openai / gpt-5.4-mini | fuse | 3 | 0.017752 | 0.017751 | 1.00x |
| gemini / gemini-2.5-flash | parse_jd | 2 | 0.006758 | 0.038765 | 0.17x |
| claude / claude-sonnet-5 | parse_jd | 1 | 0.739490 | 0.256167 | 2.89x |
| **TOTAL (30d)** | | **607** | **9.358489** | **3.156268** | **2.97x** |

Three separate mispricings, each reproducing an already-filed ticket exactly:
`claude` **3.04x over** = LLM-COST-CLAUDE-RATE-001 (provider-id skew `claude` vs `anthropic`);
`mistral-large-latest` **6.00x over** = priced at [3,9] by the PWA fallback (exact-match miss on the
`-latest` suffix); `gemini-2.5-flash` **0.15x under** = the legacy [0.075,0.30] D1 row.
**openai reconciles to the cent** — it was the only provider with a correct exact-match row all along.

**Consequence for this run:** every score below uses the recomputed column. The stored
`estimated_cost_usd` overstates true 30-day spend by ~3x ($9.36 logged vs **$3.16 true**).

**Consequence for next run:** the first week with traffic after 2026-08-20 is the verification that
the fix works end-to-end. Until then the corrected pipeline is untested in production — treat the
first post-fix week's costs as provisional and re-run this reconciliation before trusting them.

## Steps 2-4 — score + decide

`node scripts/relay-cost-quality-tune.mjs --data <recomputed-30d.json>`:

```
  writer      keep  anthropic    no telemetry for this role - keep
  supervisor  keep  mistral      no telemetry for this role - keep
  coherence   keep  openai       no provider clears n>=20 (best: openai n=6 @ ok=100%) - keep
      openai     cq=62.624  q=1.00  $0.01597/call  ok=100%  n=6
  analysis    keep  anthropic    no provider clears n>=20 (best: openai n=12 @ ok=100%) - keep
      openai     cq=363.857 q=1.00  $0.00275/call  ok=100%  n=12
      gemini     cq=36.115  q=0.70  $0.01938/call  ok=100%  n=2
      mistral    cq=29.987  q=0.70  $0.02334/call  ok=100%  n=11
      anthropic  cq=2.733   q=0.70  $0.25617/call  ok=100%  n=1
  kernel      keep  anthropic    no telemetry for this role - keep
```

Guardrails held correctly: three roles have no telemetry at all, two are below the sample floor.
Quality was perfect everywhere — **607/607 success, zero malformed / leak / fabrication / banned
flags** — so nothing is being kept for quality reasons; this is purely a sample-size hold.

### The standing candidate: `analysis`

`analysis` is pinned to `anthropic` and scores **cq 2.733**; `openai` scores **cq 363.857** — a **133x**
cost-quality gap at identical 100% success, driven by $0.25617/call vs $0.00275/call. This is the
fourth consecutive run where openai is the best-scoring analysis provider and is blocked only by
`--min-calls` (n=12/5/5/12). The floor has now been structurally unreachable for this role for a
month.

Two caveats keep it from being an obvious flip, both unchanged from prior runs: the role conflates
`analyze_fit` (openai's n=12, where it is the only provider with real truth) with `parse_jd` (where
anthropic's single call is the entire anthropic sample), and the n=1 anthropic datapoint is not a
fair baseline. **Owner call, carried:** lower `--min-calls` for low-traffic roles, split `analysis`
into per-task heads, or leave it. No code owed.

## Client-dispatch levers (not `MODEL_ROLES`-tunable)

```
  compress             spend $2.32/30d - leads anthropic $1.76 (0.01284/call)
      cheapest adequate: gemini @ $0.00053/call -> ~$2.04 potential
  consensus_poll       spend $0.08/30d - leads openai $0.04 (0.00324/call)
  consensus_reinforce  spend $0.05/30d - leads openai $0.05 (0.00604/call)
```

`compress` remains the dominant lever: **$1.76 of $3.16 total spend (56%) lands on the claude leg**,
consistent with the residual outlier flagged on 2026-07-22 and 2026-07-29 despite RELAY-COST-TIEBREAK-001.

**The price fix materially shrank this lever.** At the old (wrong) gemini rate the report would show
gemini at ~$0.00007/call; at the correct Flash rate it is **$0.00053/call — 7.6x more expensive than
previously believed**. Gemini is still ~24x cheaper than claude per compress call, so the direction of
the recommendation is unchanged, but the *size* of every pre-2026-08-20 compress saving estimate in
the earlier weekly reports was overstated. The like-for-like caveat from 2026-08-20 also still stands
(gemini mean input 343 tokens vs claude 3,316 — not the same prompt), so a same-prompt benchmark is
still owed before any move. Owner-gated.

## Method note — `llm_provider_health` is usable, but only one row at a time

The overlapping-window trap (2026-07-22 / 2026-07-29) was re-checked, not assumed. Summing
`window_minutes=10080` rows for `claude`/`compress` over 30 days gives 257,241 calls across 2,583
rows; the true figure is 137. But the **individual** weekly rows are sound — `MAX(call_count) = 124`,
`AVG = 92` — so the table is a valid source when read as *the latest single row per (provider, task)*
and invalid when summed. No bug filed; this is the documented behaviour, recorded here so a future
run does not re-file it.

The latest single row per (provider, task) currently reads `call_count` 1-2 — not a table defect, just
the tail of a window whose traffic stopped on 2026-08-19.

## Register / notes

- Row 103 `RELAY-TUNE-COVERAGE-GAP-001` advanced — see `REGISTER_ACTIVE_DETAIL.md`.
- `COST-SOURCE-AUDIT-GAP-001` closed **in the data** (D1 rows correct as of 2026-08-20) but
  **unverified against live traffic** — carried until a week with calls confirms it.
- No new bug filed: the three skews above are all pre-existing, already-filed, and already fixed at
  HEAD; this run confirms the fix is present rather than finding new drift.
