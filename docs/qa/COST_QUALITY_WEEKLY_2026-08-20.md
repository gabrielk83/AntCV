# RELAY-COST-QUALITY-TUNE — weekly run 2026-08-20

Automated run of `antcv-relay-cost-quality-tune` (RELAY-COST-QUALITY-TUNE-001). Method + rubric:
`docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`. Scored offline through
`scripts/relay-cost-quality-tune.mjs` (floor 0.90, margin 0.10, min-calls 20) on a snapshot built
from **raw `llm_calls`** via the Cloudflare D1 MCP (`ant_memory` `499c3de9-8371-428a-9b9f-5d695d58e32b`).

**Result: NO FLIP.** `MODEL_ROLES` unchanged; no deploy, no version consumed. The week carried real
volume (499 calls) but **94% of it is `compress`, which `MODEL_ROLES` cannot reorder**; every
addressable role sits at n=4–5, far under the 20-call sample floor.

**Two code changes shipped (script + test only, no PWA bytes, no worker deploy):**
1. `TUNE-BLOCKER-LABEL-001` — the no-flip rationale reported the wrong gate for four weeks.
2. Two regression tests pinning the corrected labels (scorer suite 15 → 17).

**One structural finding registered:** the price table this routine audits in step 1a is **not the
table that produces the numbers it scores on**. Detail below.

## Missed dispatches

`ROUTINE_HEALTH.jsonl` shows this routine last ran **2026-08-05**. The **2026-08-12 and 2026-08-19**
weekly dispatches never fired (no start event, no report file). This run therefore covers a 7-day
window, not the 15 days since the last run — traffic older than 2026-08-13 is not in scope here.
Registered as a routine-reliability item, not a tuning item.

## Step 1a — model-table freshness audit (BEFORE scoring)

- `node --test workers/proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- `node --test workers/demo-proxy/test/model-table-freshness.test.mjs` — **5/5 green**.
- Pins confirmed present + correctly priced (longest-key-wins) in BOTH `demo-enforcement.js` `RATES`:
  `claude-opus-4-8` [5,25], `gpt-5.5` [30,60], `gpt-5.4-mini` [0.75,4.5], `claude-sonnet-5` [3,15].
  All four still pinned in `pwa/app.src.js`. `claude-opus-4-8` + `claude-sonnet-5` present in both
  `multi-llm.js` anthropic cascades. **No price drift, no table fix needed in the audited tables.**

### But the audited table is not the one the tune scores on — COST-SOURCE-AUDIT-GAP-001 (NEW)

Step 1a audits `workers/*/src/demo-enforcement.js` `RATES`. That table governs the **demo budget cap**.
It does **not** produce `llm_calls.estimated_cost_usd`, which is the number every score in this report
divides by. There are **three** price tables and they disagree:

| table | consumer | gemini-2.5-flash | mistral-large | claude-sonnet-5 |
|---|---|---|---|---|
| `workers/*/src/demo-enforcement.js` `RATES` | demo cap — **the only one step 1a audits** | [0.10, 0.40] | [2, 6] | [3, 15] |
| D1 `llm_provider_costs` | **relay override, wins when (provider, model) matches exactly** | [0.075, 0.30] | *(absent — row is `mistral-large`, model id is `mistral-large-latest`)* | *(absent)* |
| `pwa/app.src.js` `C` map | client meter → `cost_usd` → the relay fallback | [0.15, 0.60] | [3, 9] | [3, 15] |

`workers/access-relay/src/telemetry.js:130` looks up `llm_provider_costs` by **exact** `(provider, model)`
and falls back to the PWA-reported `cost_usd` on a miss. **`llm_provider_costs` contains no current
model pin** — only `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gemini-2.5-flash`,
`gemini-2.5-pro`, `mistral-large`, `mistral-medium`, `gpt-5`, `gpt-5-mini`. So today every provider
except gemini is priced by the PWA map, and gemini is priced by a stale D1 row.

This is exactly the corruption step 1a exists to prevent, in a table step 1a never looks at. It is the
mechanism behind **LLM-COST-CLAUDE-RATE-001** (fixed 2026-08-19 in the PWA map, not in D1) and it
**closes LLM-COST-GEMINI-RECONCILE-001** — see below.

### LLM-COST-GEMINI-RECONCILE-001 — EXPLAINED (mechanism found; no code shipped)

The 2026-08-19 nightly logged gemini compress at "almost exactly half" its PWA rate and could not
account for it. Mechanism: the D1 `llm_provider_costs` row for `(gemini, gemini-2.5-flash)` is
**[0.075, 0.30]**, exactly half the PWA map's **[0.15, 0.60]**, and the D1 row **wins**. Arithmetic,
this week's 7d gemini compress (43,594 in + 18,653 out): `43594*0.075 + 18653*0.30 = $0.008865` vs
**$0.008862 logged** — exact to rounding. The "half" was never a token-accounting bug; it is a second
price table overriding the first. Not a factor subset, not `tokens_real`.

**Not fixed this run, deliberately:** the correct public rate for `gemini-2.5-flash` is not settled —
the three tables say [0.075,0.30], [0.10,0.40] and [0.15,0.60], and a targeted check of
`ai.google.dev/gemini-api/docs/pricing` did not return the 2.5-Flash row cleanly. Gemini is under 1.5¢/wk,
so writing a guessed number into three tables (one of them a **production D1 row**) is a worse risk than
carrying it. Verify the public rate, then align all three in one pass. No unbidden production D1 write
was made this run.

## Telemetry — 7 days to 2026-08-20, raw `llm_calls`

Read the **raw table**, not `llm_provider_health` — the overlapping-window multi-count trap
(2026-07-22 / 2026-07-29) does not apply. 499 calls across 4 days; **475 of them on 2026-08-18**
(a bulk day). All 12 (provider, task) rows at **100% success, zero retries, zero placeholder-leak /
malformed-output / banned-word / fabrication flags.**

`logged` is `estimated_cost_usd` as stored; `true` is recomputed from the raw token counts at the
audited public rates (claude [3,15], openai [0.75,4.5], mistral [2,6], gemini [0.10,0.40]).

| provider | model | task | calls | tokens in/out | logged $ | **true $** | skew | role mapping |
|---|---|---|---|---|---|---|---|---|
| claude | claude-sonnet-5 | compress | 124 | 411,230 / 22,964 | 4.8012 | **1.5781** | **3.04x** | client-dispatch |
| mistral | mistral-large-latest | compress | 92 | 238,177 / 12,563 | 0.8276 | **0.5517** | 1.50x | client-dispatch |
| mistral | mistral-large-latest | parse_jd | 4 | 144,240 / 14,121 | 0.5598 | **0.3732** | 1.50x | **analysis** (n=4 < 20) |
| openai | gpt-5.4-mini | compress | 124 | 309,042 / 13,021 | 0.2904 | 0.2904 | 1.00x | client-dispatch |
| openai | gpt-5.4-mini | apply_correction | 4 | 29,988 / 8,777 | 0.0620 | 0.0620 | 1.00x | **coherence** (n=4 < 20) |
| mistral | mistral-large-latest | consensus_poll | 5 | 17,322 / 421 | 0.0558 | 0.0372 | 1.50x | client-dispatch |
| openai | gpt-5.4-mini | analyze_fit | 5 | 11,554 / 1,141 | 0.0138 | 0.0138 | 1.00x | **analysis** (n=5 < 20) |
| openai | gpt-5.4-mini | consensus_reinforce | 3 | 15,491 / 305 | 0.0130 | 0.0130 | 1.00x | client-dispatch |
| gemini | gemini-2.5-flash | compress | 127 | 43,594 / 18,653 | 0.0089 | 0.0118 | 0.75x | client-dispatch |
| openai | gpt-5.4-mini | fuse | 2 | 11,465 / 577 | 0.0112 | 0.0112 | 1.00x | client-dispatch |
| openai | gpt-5.4-mini | consensus_poll | 4 | 13,924 / 151 | 0.0111 | 0.0111 | 1.00x | client-dispatch |
| gemini | gemini-2.5-flash | consensus_poll | 5 | 4,924 / 467 | 0.0005 | 0.0007 | 0.75x | client-dispatch |
| | | **TOTAL** | **499** | | **6.6573** | **2.9542** | **−55.7%** | |

**The week's logged LLM spend is overstated by $3.70 (2.25x).** $3.22 of that is the claude leg
(LLM-COST-CLAUDE-RATE-001, fixed in the PWA on 2026-08-19 — this traffic is 08-18, pre-fix), $0.48 is
mistral (`{3,9}` in the PWA map vs the audited `[2,6]` — **still live, not yet fixed**), and gemini is
understated $0.003 (the D1 override above). Scoring below uses the **true** column throughout, per the
LLM-COST-CLAUDE-RATE-001 note that the tune should be re-read on corrected prices.

**Mistral is the one still-live skew.** `pwa/app.src.js` prices mistral at `{inputPer1M: 3,
outputPer1M: 9}`; both worker `RATES` tables say `mistral-large` [2, 6]. Every mistral call is
therefore logged 1.50x high, and mistral currently **leads the `supervisor` role** — same
demote-on-a-phantom-price mechanism as the claude miss, one third the magnitude. Registered; the fix
is a PWA-bundle change (cache-bust quintet + shift lane), out of scope for a no-deploy tune run.

## Decision — before → after

Scorer output on the corrected-cost snapshot:

| role | before (head) | after (head) | action | driver |
|---|---|---|---|---|
| writer | anthropic | anthropic | keep | no telemetry (gen is client-dispatched) |
| supervisor | mistral | mistral | keep | no telemetry |
| coherence | openai | openai | keep | `apply_correction` openai n=4 < 20 sample floor → ineligible |
| analysis | anthropic (unpinned) | anthropic (unpinned) | keep | best (openai cq=362.3, $0.00276/call) n=5 < 20 → ineligible |
| kernel | anthropic (unpinned) | anthropic (unpinned) | keep | no matching telemetry |

- `MODEL_ROLES` before AND after: `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`
- No `wrangler.toml` change, no deploy. **ROLLBACK N/A** (nothing shipped for MODEL_ROLES).

Note the standing shape of this loop's failure to converge: `analysis` has now shown openai as the
best-scoring candidate three weeks running (n=12 on 07-29, n=5 on 08-06, n=5 today) and has been
blocked by the sample floor every time. The floor is doing its job on n=5, but a role that only ever
sees single-digit weekly traffic will never clear a 20-call gate — the pin will keep deferring
indefinitely. Surfaced for the owner as a parameter question (lower `--min-calls` for
low-traffic roles, or accumulate a multi-week window), not changed unilaterally.

## Shipped this run — TUNE-BLOCKER-LABEL-001 (scorer honesty fix)

`scoreRows` folds **two independent gates** into one `eligible` boolean:
`successRate >= floor && calls >= minCalls`. `proposeRoles` then reported every `!best` as
`'no provider meets the adequacy floor'`. On a quiet week that is the **opposite diagnosis** — the
providers were at 100% success and merely under-sampled. Every no-flip report since 2026-07-15 has
therefore recorded a quality failure that did not happen; read literally, the audit trail says the
providers were inadequate when the evidence was simply thin.

**Fix** (`scripts/relay-cost-quality-tune.mjs`): the `!best` branch now inspects the ranked set and
names the gate that actually blocked. Before → after on this week's data:

```
- coherence   no provider meets the adequacy floor — keep (fallback cascade still runs)
+ coherence   no provider clears the n>=20 sample floor (best: openai n=4 at ok=100%) — keep (fallback cascade still runs)
```

**Guards:** two new cases in `scripts/tests/relay-cost-quality-tune.test.mjs` — thin-but-clean traffic
must say *sample floor* and must NOT say *adequacy floor*; genuinely failing traffic must still say
*adequacy floor*. Scorer suite **17/17** (was 15/15). Pure-function change, no behaviour change to any
proposal — the decision on this week's data is byte-identical before and after.

## Client-dispatch levers (NOT MODEL_ROLES-tunable — surfaced only)

The proxy forwards the client `ee()` router's `x-provider` + model verbatim, so these move at the
client router, not here (owner-gated — RELAY-TUNE-COVERAGE-GAP-001, OPEN_REGISTER row 38). This week
they are **not** negligible, unlike 08-06:

- **`compress` = $2.43/wk true (82% of all spend), 467 of 499 calls.** Four-provider ensemble, all at
  100% success: claude $1.578 (124 calls, $0.01273/call), mistral $0.552 (92, $0.00600), openai $0.290
  (124, $0.00234), gemini $0.012 (127, $0.00009).
- **The scorer's "cheapest adequate: gemini → ~$2.39/wk potential" line is not a like-for-like
  comparison and should not be acted on as written.** The legs receive very different prompts:
  gemini's mean input is **343 tokens** against claude's **3,316** — a 9.7x difference. Per 1M prompt
  tokens the legs are far closer than per-call cost suggests. Any move here needs a same-prompt
  benchmark, not this week's traffic.
- `consensus_poll` $0.049, `consensus_reinforce` $0.013, `fuse` $0.011 — negligible.

QUALITY-GATE caveat carries: telemetry flags are blind to format-broken output — verify a sample
before any client-router move (cost-quality-benchmark detection gap).

## Guardrails / gates honoured

- gen/flagship (`claude-opus-4-8`) untouched (owner-gated) — not proposed.
- No flip → no deploy → hard gate (b) pre-deploy PushNotify does not fire.
- Adequacy floor 0.90 + min-calls 20 respected; no provider cleared eligibility to lead.
- Anthropic fallback reachable for every role; no cascade-tail provider removed.
- No production D1 write; no worker deploy; no PWA bytes touched; no version consumed.
- Suites green: model-table-freshness 5/5 ×2, relay-cost-quality-tune **17/17**.
- SYNC FIRST honoured; workspace was dirty so the whole run was done in an isolated worktree off
  `origin/main` (`8d331f6`), never in the owner's clone.

## Owed / next run

1. **Verify `gemini-2.5-flash` public pricing**, then align all three tables in one pass (includes a
   production D1 `llm_provider_costs` row — owner-gated write).
2. **Fix the mistral `{3,9}` → `[2,6]` skew** in `pwa/app.src.js` + `app.js` (PWA lane, cache-bust
   quintet, shift claim). It is live and mistral leads `supervisor`.
3. **Backfill or extend `llm_provider_costs`** with the current pins, or drop the D1 override path so
   one table governs. Today it silently overrides a corrected PWA map for exactly one provider.
4. **Owner call on `--min-calls` for low-traffic roles** (see the `analysis` note above).
5. Re-read the tune once post-2026-08-19 claude traffic accumulates, per LLM-COST-CLAUDE-RATE-001.

---

# ADDENDUM — same day, owner said "fix observed issues now"

Everything the run above **registered but did not fix** is now fixed, on lane **1.51.4346-4365**,
shipped as `1.51.4346-cost-rates`. Prices were verified against the vendors' own pricing pages
rather than carried from the tables, and two of the four turned out to be wrong.

## Verified public prices (2026-08-20)

| model | source | verified rate | what the repo said |
|---|---|---|---|
| `claude-sonnet-5` | claude-api skill model table | [3.00, 15.00] | [3, 15] — **correct** |
| `claude-opus-4-8` | claude-api skill model table | [5.00, 25.00] | [5, 25] — **correct** |
| `mistral-large-latest` (Large 3) | mistral.ai/pricing/api | **[0.50, 1.50]** | worker [2, 6] (4x over), PWA {3, 9} (**6x over**) |
| `gemini-2.5-flash` | ai.google.dev/gemini-api/docs/pricing | **[0.30, 2.50]** | worker [0.10, 0.40] (that is **Flash-Lite's** rate), D1 [0.075, 0.30] (Gemini 1.5 era), PWA [0.15, 0.60] |

The gemini finding is the sharper one: `[0.10, 0.40]` is not a stale Flash price, it is the price of a
**different model** (Flash-Lite). Flash is 3x that on input and **6.25x** on output.

## Fixed

1. **PWA cost meter** (`pwa/app.src.js` + `pwa/app.js`, occurrence-guarded, byte-delta asserted
   +3, `node --check` clean, head `(()=>{`, zero `"use strict"`): mistral `{3,9}` → `{0.5,1.5}`,
   gemini `{0.15,0.6}` → `{0.3,2.5}`. This is the map RELAY-COST-TIEBREAK-001 reads.
2. **All three worker `RATES` mirrors** (`workers/proxy`, `workers/demo-proxy`,
   `workers/access-relay/src/model-rates.js` — the mirror guard caught the third one, which the
   original run had not noticed): `mistral-large` [2,6] → [0.5,1.5], `mistral-medium` [0.4,2] →
   [1.5,7.5], `mistral-small` [0.2,0.6] → [0.15,0.6], `gemini-2.5-flash` [0.1,0.4] → [0.3,2.5],
   plus a **new explicit `gemini-2.5-flash-lite` [0.1,0.4] key** — it must stay the longer key or
   longest-key-wins silently charges Flash-Lite at the Flash rate.
3. **D1 `llm_provider_costs`** — 19 rows inserted at `effective_from = 1787184000`, covering every
   model in live traffic plus the neighbours (`claude-sonnet-5`, `claude-opus-4-8/4-7/4-6`,
   `claude-haiku-4-5`, `gpt-5.4-mini`, `gpt-5.5`, `gpt-5.4`, `gpt-5`, `gpt-5-mini`,
   `mistral-large{,-latest}`, `mistral-medium{,-latest}`, `mistral-small{,-latest}`,
   `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`). Before this the table held **no
   row for any model in production**. Rows are additive on a new `effective_from`, so
   **ROLLBACK = `DELETE FROM llm_provider_costs WHERE effective_from = 1787184000;`** — the prior
   rows are untouched and would take over again.
4. **Cross-table parity guard** (`pwa/test/llm-cost-provider-rates.test.mjs`, +9 cases → 27):
   the client meter's rate for each provider must equal the worker `RATES` rate for **the model
   that provider is actually pinned to**, with the provider→model mapping read out of the bundle so
   re-pinning a provider forces its rate to be re-verified. Proved by mutation: reverting mistral to
   `{3,9}` turns the guard red, restoring it turns it green. The pre-existing guard could not see
   either defect — it only checked that a key existed.
5. **Freshness tests extended** (`model-table-freshness.test.mjs` ×2, 10 → 20): mistral-large at
   Large 3 pricing, `mistral-large-latest` resolving through the shorter key, gemini Flash vs
   Flash-Lite, and the longest-key-wins ordering.

## Corrections to the run above

- **`LLM-COST-D1-REFERENCE-STALE-001` landed in parallel** (nightly 2026-08-20, already on `main`)
  and restructured `estimateCostUsd` to **D1 row → the relay's own `RATES` → client value**, so D1
  is now an override rather than a prerequisite. The structural half of COST-SOURCE-AUDIT-GAP-001 is
  therefore already closed upstream; what remained — and what this addendum fixes — is that the
  *values* in every one of those tables were wrong.
- **There are three `RATES` mirrors, not two.** `workers/access-relay/src/model-rates.js` is the
  copy the telemetry path actually calls (`rateForStrict`), and it is pinned by
  `pwa/test/relay-model-rates-mirror.test.mjs`. The original run's table only listed two.
- **The unscoped `node scripts/run-tests.mjs` exit-1 was not a runner defect.** It was a fresh
  worktree with no `node_modules`. With the dependency tree present the full repo suite is
  **1939/1939, exit 0**. Withdrawn.
- **`gpt-5.5` missing from the openai cascade is not a gap** — it is correct. `PROVIDER_MODELS` is
  the *default* chain; heading it with a $30/$60 model would make it the default for every openai
  cascade call (~40x the pinned `gpt-5.4-mini`), and tailing it would let a cheap call land there on
  a fallback. It is reachable only via an explicit `opts.models` override. Now pinned as an
  explicit invariant so a future freshness pass does not "fix" it and regress the default cost.

## Re-scored on the verified rates — decision unchanged

| | logged | run above (partly-corrected) | **verified rates** |
|---|---|---|---|
| week total | $6.6573 | $2.9542 | **$2.2825** (−65.7% vs logged) |
| `compress` (the client lever) | — | $2.43/wk | **$2.07/wk** |
| mistral `compress` leg | $0.8276 | $0.5517 | **$0.1379** |
| gemini `compress` leg | $0.0089 | $0.0118 | **$0.0597** |
| mistral `parse_jd` | $0.5598 | $0.3732 | **$0.0933** |

`MODEL_ROLES` proposal is **still NO FLIP** — `{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`,
unchanged, no deploy. The sample floor still blocks every addressable role (n=4–5 < 20). What moved
is the evidence quality, not the decision: mistral's `analysis` cost-quality rose 10.7 → 42.9 (still
well behind openai's 362.3), and gemini is now correctly 5x more expensive per compress call than the
old number implied, which weakens — not strengthens — the standing "switch compress to gemini"
suggestion. That suggestion remains owner-gated and still needs a same-prompt benchmark, since
gemini's mean input is 343 tokens against claude's 3,316.

**Mistral now leads `supervisor` on a price that is 6x cheaper than the meter believed**, which is the
opposite of the LLM-COST-CLAUDE-RATE-001 direction: mistral was being *over*-penalised, not favoured.

## Gates

- Suites: full repo **1939/1939**, PWA 1606 (0 fail), workers 303/303, scripts 30/30,
  freshness 20/20, PWA rate guard 27/27, mirror guard 5/5.
- boot-smoke `glDemo=function, errors=0`; `app.js` head `(()=>{`, zero `"use strict"`, `node --check` clean.
- Cache-bust quintet at `1.51.4346-cost-rates` (index.html ×6 incl. the `ANTCV_VERSION` seed, sw.js
  CACHE, version-override TARGET); previous `1.51.4326-claude-rate` added to `STALE_VERSIONS`,
  current TARGET absent from it (invariant holds).
- No `MODEL_ROLES` change, so no proxy deploy and no pre-deploy PushNotify. **The worker `RATES` +
  relay `model-rates.js` changes DO need a worker deploy to take effect server-side** — see below.
- No em dashes introduced in code comments (normalised to hyphens per the repo standard).

## Still owed

- **Deploy `proxy`, `demo-proxy`, and `access-relay`** so the corrected `RATES` reach production.
  Until then the server-side recompute keeps using the old table and new rows keep logging the stale
  mistral/gemini numbers. The PWA half auto-deploys from `main`; the workers do not.
- Historical `llm_calls.estimated_cost_usd` rows stay overstated (no backfill). Raw token counts are
  intact, so any re-scoring can recompute — as this addendum does.
- Owner call on `--min-calls` for low-traffic roles (unchanged from the run above).

## DEPLOYED — 2026-08-20 (owner: "deploy now")

Desktop `npx wrangler deploy --env=""`, one deployer at a time, `/health` verified after each.
CI worker deploys stay broken (expired Cloudflare token, since 2026-08-04), so the desktop path was used.
Authenticated as the owner's OAuth token (account `17c026b6d08c3e0ba63425cb26a5a7d9`).

| worker | version id | `/health` |
|---|---|---|
| `cv-proxy` | `7f8e0938-093e-4e4f-bf65-4f4f57d8a501` | 200 |
| `antcv-demo-proxy` | `256f8397-58fa-4f46-94c3-02e5599850b6` | 200 |
| `antcv-access-relay` | `63c58cca-a707-4eec-91bf-76e8cfe7cf15` | 200 |
| `docx-worker` (untouched) | — | 200 |

`MODEL_ROLES` read back unchanged on both proxies at deploy time
(`{"writer":"anthropic","supervisor":"m...`), confirming NO FLIP shipped alongside the rate fix.

Each deploy also carried its worker's already-landed backlog: proxy/demo-proxy picked up the
`1.51.4167-evidence-qa` generator rules, access-relay picked up `LLM-COST-D1-REFERENCE-STALE-001`
(`9c2c82a`) and the `1.51.4146-appload-fixes` batch. All were registered fixes already on `main`.

### Live verification

No LLM traffic has landed since 2026-08-19 11:26, so there is no post-deploy row to read yet.
Verified instead by running the relay's **exact** lookup query against production D1 for every model
in live traffic:

| provider / model | D1 now returns |
|---|---|
| claude / claude-sonnet-5 | [3.00, 15.00] |
| openai / gpt-5.4-mini | [0.75, 4.50] |
| mistral / mistral-large-latest | **[0.50, 1.50]** |
| gemini / gemini-2.5-flash | **[0.30, 2.50]** |

All four now resolve, where before **none of them did**. Concretely, the last mistral row written
(`llm_calls` id 9483, 3,787 in + 103 out) logged **$0.012288** — exactly the old `{3,9}` — and the
same call priced through the live path today is **$0.002048**. Since D1 is the first branch, correct
pricing is in force immediately; the deployed worker `RATES` is the correct second branch behind it.
