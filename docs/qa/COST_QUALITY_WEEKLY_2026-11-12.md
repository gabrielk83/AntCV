# RELAY-COST-QUALITY-TUNE — weekly run 2026-11-12 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Opus 5.5. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/` + an untracked DAMC doc), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mwcqge59` off `origin/main` `80e358fc`.
Duplicate-run check: no `COST_QUALITY_WEEKLY` file in the last 6 days (newest 2026-11-05) → full run.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin's own rollback is `'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path + preflight notes

Preflight: token OK (expires 2026-11-17T23:14:49Z, 6.0 d left). **DISPATCH GAP 6.6 d** — previous
start 2026-11-05. That is the normal weekly cadence plus app-open jitter, not a missed fire.

No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` and no D1 MCP connector in this session. D1 read with
wrangler from the shared clone's `workers/access-relay` (`d1 execute ant_memory --remote --json`,
`SELECT` only). Pulled raw `llm_calls` 30 d (195 rows) and `llm_provider_costs` (34 rows). Snapshot
built per (provider, task) with every cost recomputed from tokens through `rateForStrict()` at today's
audited table, then `relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN; four ids fixed

Fetched 2026-11-12: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `docs.mistral.ai/inference/pricing`,
`ai.google.dev/gemini-api/docs/pricing` (301 → `aistudio.google.com/docs/pricing`). 90 page ids diffed
mechanically against `rateForStrict()`. Mistral `GET /v1/models` not re-probed: no new Mistral slug
this week, and every page slug already resolves.

**Pins verify:** `claude-sonnet-5` [2,10] (footnote 3: the $3/$15 rise will not occur),
`claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (gen pin), `claude-fable-5` / `-5-1`
[10,50], `claude-haiku-4-5` [1,5]; `gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30]; `mistral-large` [0.5,1.5];
`gemini-2.5-flash` [0.3,2.5]. `mistral-large-4` / `-4-0` holds at [0.70,2.10] (second week at that price).

**RED, fixed this run** (all three mirrors, CRLF-aware, one anchor each, dated comments; the two
`demo-enforcement.js` copies stay byte-identical):

| id | resolved to (before) | vendor 2026-11-12 | error | ticket |
|---|---|---|---|---|
| `claude-fable-5-2` (new) | `claude-fable-5` [10,50] | [8,40] | 1.25x OVER | ANTHROPIC-52-RATES-2026-11-001 |
| `claude-mythos-5-2` (new, limited) | `claude-mythos-5` [10,50] | [8,40] | 1.25x OVER | ANTHROPIC-52-RATES-2026-11-001 |
| `gpt-6-cyber` (trusted access) | FALLBACK [3,15], strict `null` | [20,100] | 6.7x UNDER | OPENAI-GPT6-CYBER-RATES-2026-11-001 |
| `gemini-4-carbon` (new) | FALLBACK [3,15], strict `null` | [2,10] (doubles 12-01) | 1.5x OVER | GEMINI4-CARBON-RATES-2026-11-001 |

None is an AntCV pin or in a default cascade; the new tests assert they stay out. The page shows
display names only for Anthropic; ids follow the existing `claude-<family>-<major>-<minor>` form.

Tests: `model-table-freshness.test.mjs` (proxy + demo-proxy, byte-identical) **48/48 each** (was 46;
`VENDOR_CATALOGUE_2026_11_12` added, earlier catalogues untouched); `pwa/test/relay-model-rates-mirror.test.mjs`
**15/15** (was 14).

**Left unkeyed by rule:** OpenAI realtime / audio / live / image / TTS / transcribe / embedding;
Mistral OCR, Voxtral, embed, moderation, self-hosted Shieldstral / Timestral; Gemini transcribe, TTS,
image, embedding, robotics, Lyria. Also the OpenAI fine-tuned dated ids (fine-tuning closed to new users).

**Gemini rows read from the fetcher's summary, not verbatim text** (page truncated at 40 k of 110 k
chars): `gemini-2.5-flash` / `-pro`, `gemini-3.1-*`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite`,
native-audio. All matched the table. Re-read verbatim next week if the fetch allows.

**Dated vendor changes ahead (not table errors today):**
- **2026-12-01, Google:** `gemini-2.5-flash` requests route to another model (last week: `gemini-3.5-flash-lite`,
  billed [0.30,2.50]); `gemini-2.5-pro` routes too (last week: `gemini-3.8-flash` [0.75,3.75]). Target names
  were truncated in today's fetch. The AntCV gemini pin changes model on that date without a code change.
  **The next tune (≈11-19) is the last before the switch.**
- **2026-12-01:** `gemini-4-argon` and `gemini-4-carbon` double to [4,20]. Re-key at the first tune after.
- **2026-12-03:** `gemini-omni-1.1-flash` routes to `gemini-omni-1.2-flash` (not keyed; video model).
- **2026-11-30:** `gpt-5.6-sol` promo ends; no post-promo price published.
- **2026-12-31:** `gpt-6-astra-law` promo "at least through" this date.
- **2027-01-01:** Gemini 3.6 / 3.8 Flash double to [1.50,7.50].

## 2. Step 1b — cost-source audit: reconciles to the cent

(i) `llm_provider_costs` (34 rows, unchanged, SELECT only): the newest row per model equals the audited
rate for every model in telemetry — `gpt-5.4-mini` [0.75,4.5], `mistral-large-latest` [0.5,1.5],
`gemini-2.5-flash` [0.3,2.5] (an older 2024 row at [0.075,0.3] is superseded by `effective_from`).
None of the four ids fixed today has a row or any traffic. **No D1 write owed.**

(ii) PWA `C` map (`pwa/app.src.js` 1259-1261): anthropic/claude [2,10], openai [0.75,4.5], mistral
[0.5,1.5], gemini [0.3,2.5] = the audited mirrors at provider level. Row 115 stands.

(iii) Recompute from raw tokens (30 d window):

| task | provider | model | source | n (7 d / 30 d) | stored $ 30 d | recomputed $ 30 d |
|---|---|---|---|---|---|---|
| long_context | openai | gpt-5.4-mini | PWA v0.24 | 165 / 165 | 1.457829 | 1.457824 |
| analysis | mistral | mistral-large-latest | **srv:cascade** | 11 / 11 | 0.085481 | 0.085480 |
| parse_jd | mistral | mistral-large-latest | PWA | 1 / 3 | 0.077354 | 0.077354 |
| consensus_reinforce | openai | gpt-5.4-mini | PWA | 1 / 3 | 0.022101 | 0.022101 |
| consensus_poll | openai | gpt-5.4-mini | PWA | 1 / 3 | 0.013664 | 0.013664 |
| compress | openai | gpt-5.4-mini | PWA | 1 / 2 | 0.013590 | 0.013590 |
| consensus_poll | mistral | mistral-large-latest | PWA | 1 / 3 | 0.009406 | 0.009406 |
| analyze_fit | openai | gpt-5.4-mini | PWA | 0 / 1 | 0.003231 | 0.003231 |
| compress | gemini | gemini-2.5-flash | PWA | 0 / 1 | 0.002971 | 0.002971 |
| consensus_poll | gemini | gemini-2.5-flash | PWA | 1 / 3 | 0.002833 | 0.002833 |
| **TOTAL** | | | | **182 / 195** | **1.688460** | **1.688454** |

Sub-cent rounding only (stored values are rounded per row).

## 3. Traffic + scoring — no flip

**7 d (2026-11-05 → 11-12): 182 `llm_calls`**, all 100% success, 0 retries, 0 malformed / placeholder /
fabrication / banned-word flags. Sessions on 11-05 (11:06-23:45 UTC), 11-06 00:09, 11-08 12:35-13:05.

**First server-side rows.** The 11 `analysis` calls carry `client_version = "srv:cascade"`: the
LLM-LOG-SERVER-001 proxy logger (fixed in code 2026-11-03) is deployed and writing. This is the first week
the tune sees Worker-side traffic for a `MODEL_ROLES` role. Row 103 (RELAY-TUNE-COVERAGE-GAP-001) advanced.

**New client task `long_context`:** 165 PWA calls on openai `gpt-5.4-mini`, $0.0088/call, $1.46 for the week
(86% of all spend). Client-dispatch lever, not `MODEL_ROLES`-tunable.

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | evidence (recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | no telemetry | keep |
| analysis | mistral (pinned 09-29) | 7 d: mistral cq=107.4 n=12 ($0.0093/call). 30 d: mistral cq=86.0 n=14; openai n=1 (`analyze_fit`) | keep (n<20, sole provider at the head) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

The analysis pin holds: 11/11 server cascade calls landed on mistral at the head, no fallback taken.
At this rate (11-12 calls/week) the role clears the n≥20 floor in about two weeks, but a challenger
needs its own traffic to score.

Client-dispatch levers: `long_context` openai $0.0088/call; compress openai $0.0070/call (11-06; gemini's
10-20 call was $0.0030, n=1 each, still not enough to act); consensus_poll leads openai $0.0038/call,
consensus_reinforce openai $0.0073/call.

## 4. Deploy

**DEPLOY OWED (not run by this routine):** proxy, demo-proxy and access-relay carry today's rate-table
change. No live traffic touches the four ids, so nothing is mis-metered today. Run one at a time:
`gh workflow run deploy.yml -f target=proxy -f mode=deploy -f confirm=proxy`, then `demo-proxy`, then
`access-relay`, and check each `/health`. Left owed because the shared clone carries owner WIP in
`workers/access-relay/src/index.js`; a relay deploy from `main` is safe (WIP is local), but a deploy
on a day with uncommitted relay work is the owner's call.

## 5. Owed / owner calls

1. **Worker deploys ×3** (§4). Low urgency: no traffic on the new ids.
2. **Gemini 2.5 routing on 2026-12-01** (§1): one tune left before the gemini pin silently changes model.
   Keep, or move the pin explicitly. Owner call.
3. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5): still
   no claude call in 30 d. Owner call, shift lane, cache-bust set.
4. **Row 124** (retired ids in `PROVIDER_MODELS` tails): unchanged (`mistral-large-2411`,
   `mistral-medium-2312`, `gemini-2.0-flash`, `gemini-1.5-pro`). Owner call.
5. **`long_context`** is now 86% of logged spend. If it is meant to run on openai, nothing to do; if it
   should follow the cost router, that is a client `ee()` change. Owner call.
6. **Scheduled prompt text** still pins `gpt-5.5 [30,60]`; vendor and table say [5,30].
