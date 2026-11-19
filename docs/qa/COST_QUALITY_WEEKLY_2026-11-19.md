# RELAY-COST-QUALITY-TUNE — weekly run 2026-11-19 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Opus 5.5. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/` + an untracked DAMC doc), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mwnri0db` off `origin/main` `0dacf961`.
Duplicate-run check: no `COST_QUALITY_WEEKLY` file in the last 6 days (newest 2026-11-12) → full run.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker rate tables,
three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin's own rollback is `'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path + preflight notes

Preflight: token OK (expires 2026-11-25T19:06Z, 6.1 d left). **DISPATCH GAP 7.7 d** — previous start
2026-11-11T23:11Z. Weekly cadence plus app-open jitter; no fire was missed.

No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` and no D1 MCP connector in this session. D1 read with wrangler
from the shared clone's `workers/access-relay` (`d1 execute ant_memory --remote --json`, `SELECT` only).
Pulled raw `llm_calls` 30 d (188 rows) and `llm_provider_costs` (34 rows). Snapshot built per
(provider, task) with every cost recomputed from tokens through `rateForStrict()` at today's audited
table, then `relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN; six ids fixed

Fetched 2026-11-19: `platform.claude.com/docs/en/about-claude/pricing.md` (verbatim to 40 k of 56 k chars;
the per-model table is inside the verbatim part), `developers.openai.com/api/docs/pricing` (full),
`docs.mistral.ai/inference/pricing` (full), `ai.google.dev/gemini-api/docs/pricing` (301 →
`aistudio.google.com/docs/pricing`, verbatim to 80 k of 116 k). 87 page ids diffed mechanically against
`rateForStrict()` (relay) and `rateFor()` (proxy).

**Pins verify:** `claude-sonnet-5` [2,10] (footnote 3: the $3/$15 rise will not occur), `claude-opus-4-8` /
`claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (gen pin), `claude-fable-5` / `-5-1` [10,50], `claude-fable-5-2`
[8,40], `claude-haiku-4-5` [1,5], `claude-haiku-5-5` [0.10,0.50] (≤100k tier); `gpt-5.4-mini` [0.75,4.5],
`gpt-5.5` [5,30]; `mistral-large` / `-latest` [0.5,1.5]; `gemini-2.5-flash` [0.3,2.5]. Anthropic lists no model
newer than Fable 5.2 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5. `mistral-large-4` holds at [0.70,2.10] (third week).

**RED, fixed this run** (all three mirrors, CRLF-aware, one anchor each, dated comments; the two
`demo-enforcement.js` copies stay byte-identical):

| id | resolved to (before) | vendor 2026-11-19 | error | ticket |
|---|---|---|---|---|
| `gpt-6.2-astra` (new) | FALLBACK [3,15], strict `null` | [8,40] | 2.7x UNDER | OPENAI-RATES-2026-11-19-001 |
| `gpt-6.2-sol` (new) | FALLBACK [3,15], strict `null` | [2,10] | 1.5x OVER | OPENAI-RATES-2026-11-19-001 |
| `gpt-6.2-astra-law` (new) | FALLBACK [3,15], strict `null` | [8,40] (via the `gpt-6.2-astra` key) | 2.7x UNDER | OPENAI-RATES-2026-11-19-001 |
| `gpt-6-rosalind` | key [15,75] (11-05) | [10,50] promo, "at least through December 31, 2026" | 1.5x OVER | OPENAI-RATES-2026-11-19-001 |
| `gemini-4-neon` (new) | FALLBACK [3,15], strict `null` | [3,15] | right by coincidence; strict null | GEMINI4-NEON-HYDROGEN-RATES-2026-11-001 |
| `gemini-4-hydrogen` (new) | FALLBACK [3,15], strict `null` | [1.5,7.5] | 2x OVER | GEMINI4-NEON-HYDROGEN-RATES-2026-11-001 |

None is an AntCV pin or in a default cascade; the new tests assert they stay out. The 11-05 catalogue
entry for `gpt-6-rosalind` moved to [10,50] in the freshness tests and the mirror test: a vendor price
change, not a trim. Re-verify it in January when the promo window can end.

Tests: `model-table-freshness.test.mjs` (proxy + demo-proxy, byte-identical) **50/50 each** (was 48;
`VENDOR_CATALOGUE_2026_11_19` added); `pwa/test/relay-model-rates-mirror.test.mjs` **16/16** (was 15).
`node scripts/run-tests.mjs` ALL PASS.

**Page slugs that do not resolve, by design:** Mistral shows `ministral-3-14b-25-12` / `-8b-` / `-3b-`; the live
ids (`ministral-14b-2512` etc., from the 10-15 `/v1/models` probe) are keyed and resolve. Mistral
`GET /v1/models` was not re-probed: no new Mistral model this week.

**Left unkeyed by rule:** OpenAI image / realtime / audio / live / TTS / transcribe / embedding / moderation;
Mistral OCR, embed, Voxtral, moderation, self-hosted Shieldstral / Timestral; Gemini live, transcribe, TTS,
image, Omni video, embedding, robotics, Lyria, Decision.

**Gemini rows from the fetcher's summary, not verbatim text** (tail past 80 k): `gemini-2.5-flash` [0.3,2.5],
`gemini-2.5-pro` [1.25,10], `gemini-2.5-flash-lite` [0.1,0.4]. All match the table.

**Dated vendor changes ahead (not table errors today):**
- **2026-12-01, Google:** `gemini-2.5-flash` requests route to `gemini-3.5-flash-lite` (billed [0.30,2.50],
  same as today) and `gemini-2.5-pro` to `gemini-3.8-flash` ([0.75,3.75]). Both target names come from the
  summary part of the fetch, consistent with 11-05. The AntCV gemini pin changes model on that date with no
  code change; the billed rate does not move. **The 11-26 tune is the last before the switch.**
- **2026-12-01:** `gemini-4-argon` and `gemini-4-carbon` double to [4,20] (verbatim, Standard + Batch/Flex/Priority).
  Re-key at the 12-03 tune.
- **2026-12-03:** `gemini-omni-1.1-flash` routes to `gemini-omni-1.2-flash` (not keyed; video model).
- **2026-11-30:** `gpt-5.6-sol` promo ends; the page does not say whether [4,20] is the promo rate.
- **2026-12-31:** `gpt-6-astra-law`, `gpt-6.2-astra-law`, `gpt-6-rosalind` promo "at least through" this date.
- **2027-01-01:** Gemini 3.6 / 3.8 Flash double to [1.50,7.50].
- **2027-03-01:** OpenAI Ultrafast on GPT-6.2 Astra / Sol goes from 3x to 6x Standard (not a token-table rate).

## 2. Step 1b — cost-source audit: reconciles to the cent

(i) `llm_provider_costs` (34 rows, unchanged since 11-12, SELECT only): the newest row per model equals the
audited rate for every model in telemetry — `gpt-5.4-mini` [0.75,4.5], `mistral-large-latest` [0.5,1.5],
`gemini-2.5-flash` [0.3,2.5] (the 2024 row at [0.075,0.3] is superseded by `effective_from`). None of the six
ids fixed today has a row or any traffic. **No D1 write owed.**

(ii) PWA `C` map (`pwa/app.src.js` 1259-1261): anthropic/claude [2,10], openai [0.75,4.5], mistral [0.5,1.5],
gemini [0.3,2.5] = the audited mirrors at provider level. Row 115 stands.

(iii) Recompute from raw tokens (30 d window, 2026-10-20 → 11-19):

| task | provider | model | source | n | stored $ | recomputed $ |
|---|---|---|---|---|---|---|
| long_context | openai | gpt-5.4-mini | PWA | 165 | 1.457829 | 1.457824 |
| analysis | mistral | mistral-large-latest | srv:cascade | 11 | 0.085481 | 0.085480 |
| parse_jd | mistral | mistral-large-latest | PWA | 2 | 0.050782 | 0.050783 |
| consensus_reinforce | openai | gpt-5.4-mini | PWA | 2 | 0.016571 | 0.016571 |
| compress | openai | gpt-5.4-mini | PWA | 2 | 0.013590 | 0.013590 |
| consensus_poll | openai | gpt-5.4-mini | PWA | 2 | 0.008646 | 0.008646 |
| consensus_poll | mistral | mistral-large-latest | PWA | 2 | 0.005766 | 0.005766 |
| consensus_poll | gemini | gemini-2.5-flash | PWA | 2 | 0.001819 | 0.001819 |
| **TOTAL** | | | | **188** | **1.640484** | **1.640479** |

Sub-cent rounding only.

## 3. Traffic + scoring — blind week, no flip

**7 d (2026-11-12 → 11-19): 0 `llm_calls`.** Last row 2026-11-08T13:05Z (11 days). The trailing week is empty,
so the score falls back to 30 d, as the routine says. Per `llm-calls-telemetry-coverage`: an empty window is
not an outage. `llm_calls` logs the PWA in-app cascade and the proxy server cascade; gen-runner, gen-job and
Claude-built packages do not log. The owner's applications this week went through those paths.

`relay-cost-quality-tune.mjs --data`: 7 d snapshot → **BLIND** (no rows); 30 d snapshot → **no change**.

| role | head | evidence (30 d, recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | no telemetry | keep |
| analysis | mistral (pinned 09-29) | mistral cq=95.4 n=13 ($0.0105/call), 100% ok, 0 retries | keep (n<20, sole provider) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

All 188 calls: 100% success, 0 retries, 0 malformed / placeholder / fabrication / banned-word flags.
Client-dispatch levers (owner-gated `ee()` change): `long_context` openai $0.0088/call (89% of 30 d spend);
compress openai $0.0068/call; consensus_poll leads openai $0.0043/call; consensus_reinforce openai $0.0083/call.

## 4. Deploy

- **access-relay:** no commit on `workers/access-relay/src` since the 11-16 rates-only deploy other than this
  run's rate table, so a deploy from `main` carried only this change. **DEPLOYED** after the push-triggered PWA run (44567418739) finished: `deploy.yml target=access-relay` run **44567597500** from `3a73dcd4`, success; `/health` 200 `auth-40-application-snapshots`. Not verified beyond `/health`: no endpoint exposes the rate table.
- **proxy + demo-proxy: OWED, owner call (row 147).** A deploy from `main` also ships POSTING-GUARD-001
  (`91deec12`), which row 147 holds for the owner. Unchanged by this run.

No live traffic touches the six ids, so nothing is mis-metered today.

## 5. Owed / owner calls

1. **proxy + demo-proxy deploy** (row 147): carries 11-12 + 11-19 rate tables and POSTING-GUARD-001.
2. **Gemini 2.5 routing on 2026-12-01** (§1): one tune left (11-26). Rate unchanged; model changes. Keep, or
   move the pin explicitly. Owner call.
3. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5): no claude call
   in 30 d. Owner call, shift lane, cache-bust set.
4. **Row 124** (retired ids in `PROVIDER_MODELS` tails): unchanged. Owner call.
5. **`long_context`** is 89% of logged 30 d spend on openai. Owner call if it should follow the cost router.
6. **Scheduled prompt text** still pins `gpt-5.5 [30,60]`; vendor and table say [5,30] (third week flagged).
