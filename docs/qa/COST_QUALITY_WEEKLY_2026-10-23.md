# RELAY-COST-QUALITY-TUNE — weekly run 2026-10-23 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Opus 5.5. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/`), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mvknvtnd` off `origin/main` `e8a0e459`.
Duplicate-run check: the newest report is 2026-10-15 (8 days old) → full run, not a cross-check.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin's own rollback is `'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path + preflight notes

Preflight: token OK (expires 2026-10-27T07:23:46Z, 4.0 d left); dispatch gap 7.7 d (normal weekly
cadence). No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` here and no D1 MCP connector in this session, so
D1 was read with wrangler from the shared clone's `workers/access-relay` (`d1 execute ant_memory
--remote --json`, `SELECT` only). The first call returned a transient `7403` (account not authorized);
the retries succeeded. Pulled: raw `llm_calls` 30 d (25 rows) and `llm_provider_costs` (34 rows).
Snapshot built per (provider, task) with every cost recomputed from tokens through `rateForStrict()`
at today's audited table, then `relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN; one price change, two new ids

Fetched 2026-10-23: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `docs.mistral.ai/inference/pricing`,
`ai.google.dev/gemini-api/docs/pricing`; Mistral `GET /v1/models` (read-only, 63 ids). Every page id
was diffed mechanically against `rateFor()` and the `VENDOR_CATALOGUE_2026_10_15` list.

**Pins verify:** `claude-sonnet-5` [2,10] (footnote 3 still says the $3/$15 rise will not occur),
`claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (gen pin), `claude-fable-5` / `-5-1`
[10,50], `claude-haiku-4-5` [1,5]; `gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30]; `mistral-large` [0.5,1.5]
(`mistral-large-latest` still aliases `mistral-large-2512` = Large 3); `gemini-2.5-flash` [0.3,2.5].
Anthropic lists nothing unpriced. Promo dates unchanged: `gpt-5.6-sol` "at least through November 21,
2026"; `gemini-4-argon` [2,10] through 2026-11-30, [4,20] from 2026-12-01; Gemini 3.x through 2026-12-31.
(The scheduled prompt still says `gpt-5.5 [30,60]`; vendor and all three mirrors say [5,30]. Prompt text
is stale, table is right — same as 10-15.)

**RED, fixed this run:**

| id | resolved to (before) | vendor 2026-10-23 | error | ticket |
|---|---|---|---|---|
| `mistral-large-4` / `-4-0` | sale key [0.68,2.09] | **list [1.36,4.18]** — the sale is over | 2x UNDER in and out | MISTRAL-LARGE4-SALE-END-2026-10-001 |
| `zai-glm-5-3-flash` (new) | `zai-glm` [1.4,4.4] | [0.15,0.50] | 9.3x OVER in, 8.8x OVER out | ZAI-GLM53-FLASH-RATES-2026-10-001 |
| `gpt-rosalind-research` / `-discovery` (new; billing from 2026-10-05) | FALLBACK [3,15], strict `null` | [5,25] | 1.67x UNDER | GPT-ROSALIND-RATES-2026-10-001 |

None is an AntCV pin or in a default cascade; the new tests assert they stay out. Fix in the three
byte-identical mirrors (`workers/proxy/src/demo-enforcement.js`, `workers/demo-proxy/src/demo-enforcement.js`,
`workers/access-relay/src/model-rates.js`), CRLF-aware, one anchor each, dated comments. Tests:
`model-table-freshness.test.mjs` (proxy + demo-proxy, identical) **44/44 each** (was 42; the 10-15
catalogue rows for Large 4 are corrected to the vendor rate, not trimmed, and a
`VENDOR_CATALOGUE_2026_10_23` list carries the new ids); `pwa/test/relay-model-rates-mirror.test.mjs`
**13/13** (was 12).

**Left unkeyed by rule, written in the table comment:** OpenAI realtime / audio (`gpt-realtime-2.1`
text [4,24], `-mini` [0.6,2.4], `gpt-realtime-2`, `-1.5`, `gpt-audio-*`) and per-minute `gpt-live-1`;
Mistral `labs-leanstral-1-5` (not on the pricing page), Voxtral, OCR, embed, moderation; Gemini
transcribe, TTS, image, embedding, robotics. Owner call: the Gemini live models WERE keyed at their text
rate on 10-15, so if the realtime family should follow that precedent, it is four more keys.

## 2. Step 1b — cost-source audit: D1 reconciles; stored cost 1.256x, all on one pre-fix row

(i) `llm_provider_costs` (34 rows, unchanged since 10-15, SELECT only): the newest row per model equals
the audited rate for every model in telemetry — `claude-sonnet-5` [2,10], `gpt-5.4-mini` [0.75,4.5],
`mistral-large-latest` [0.5,1.5], `gemini-2.5-flash` [0.3,2.5] (plus `claude-opus-5-5` [4,20], no traffic).
No row for `mistral-large-4`, `zai-glm-5-3-flash` or `gpt-rosalind-*`: correct — with no row, telemetry
prices from the relay table once the relay carries today's keys. **No D1 write owed.**

(ii) PWA `C` map (`pwa/app.src.js` ~1220–1235): anthropic/claude [2,10], openai [0.75,4.5], mistral
[0.5,1.5], gemini [0.3,2.5] = the audited mirrors at provider level. Row 115 stands (`C.claude` is the
sonnet-5 rate while `q()` pins opus-5-5); still no opus-5-5 call in `llm_calls`.

(iii) Recompute from raw tokens:

| task | provider | model | n (7 d / 30 d) | stored $ 30 d | recomputed $ 30 d | ratio |
|---|---|---|---|---|---|---|
| parse_jd | claude | claude-sonnet-5 | 0 / 1 | 0.246639 | **0.164426** | **1.5000** |
| parse_jd | mistral | mistral-large-latest | 1 / 3 | 0.069763 | 0.069763 | 1.0000 |
| apply_correction | openai | gpt-5.4-mini | 0 / 2 | 0.028769 | 0.028769 | 1.0000 |
| consensus_reinforce | openai | gpt-5.4-mini | 1 / 3 | 0.017362 | 0.017362 | 1.0000 |
| consensus_poll | openai | gpt-5.4-mini | 1 / 3 | 0.009204 | 0.009204 | 1.0000 |
| analyze_fit | openai | gpt-5.4-mini | 1 / 3 | 0.008852 | 0.008851 | 1.0001 |
| compress | gemini | gemini-2.5-flash | 1 / 3 | 0.007440 | 0.007440 | 0.9999 |
| fuse | openai | gpt-5.4-mini | 0 / 1 | 0.006821 | 0.006821 | 1.0000 |
| consensus_poll | mistral | mistral-large-latest | 1 / 3 | 0.006605 | 0.006605 | 1.0001 |
| consensus_poll | gemini | gemini-2.5-flash | 1 / 3 | 0.001866 | 0.001866 | 0.9998 |
| **TOTAL** | | | **7 / 25** | **0.403321** | **0.321107** | **1.256** |

7 d alone: stored $0.047976 = recomputed $0.047976 (1.0000). The whole 30 d gap is still the single
2026-09-28 claude `parse_jd` row logged at the pre-09-30 [3,15]. Scored on the recomputed column.

## 3. Traffic + scoring — no flip

**7 d (2026-10-16 → 10-23): 7 `llm_calls`**, one session on 2026-10-20 09:44–10:24 UTC — the first
traffic since 2026-09-28. 100% success, 0 retries, 0 malformed / placeholder / fabrication /
banned-word flags. 30 d: 25 calls (the 09-28 session + this one).

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | evidence (recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | 30 d: openai n=2 ok=100% cq=69.5 ($0.0144/call) | keep (n<20) |
| analysis | mistral (pinned 09-29) | 7 d: openai cq=309.5 n=1 · mistral cq=37.6 n=1. 30 d: openai cq=338.9 n=3 · mistral 43.0 n=3 · anthropic 6.1 n=1 | keep (n<20) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

**First post-pin evidence for `analysis`→mistral:** the 10-20 `parse_jd` went to mistral
(`mistral-large-latest`, 183 s, $0.0266), not claude. The head order works as pinned. openai still
scores ~8x better per call on `analysis`, but on `analyze_fit` (short prompts) vs mistral on `parse_jd`
(40k-token prompts) — different tasks folded into one role, so the cq gap is not like-for-like. Nothing
moves before n≥20.

Client-dispatch levers (not `MODEL_ROLES`-tunable): compress leads gemini $0.0030/call (7 d),
consensus_poll leads openai $0.0050/call, consensus_reinforce openai $0.0055/call. All 100% success.

## 4. Deploy

See §4.1 below (filled after push).

## 5. Owed / owner calls

1. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5): owner
   call, shift lane, cache-bust set. The 10-20 session made no claude call, so still unproven live.
2. **Row 124** (retired ids in `PROVIDER_MODELS` tails): unchanged, owner call.
3. **Promo expiries**, in order: `gpt-5.6-sol` after 2026-11-21; **`gemini-4-argon` doubles to [4,20]
   on 2026-12-01**; the whole Gemini 3.x block at the first tune of 2027.
4. **Realtime/audio keys** (§1): key the OpenAI realtime family at its text rate like the Gemini live
   models, or keep excluding it. Owner call.
5. **Mistral alias watch**: `mistral-large-latest` still = Large 3 (`mistral-large-2512`). When it moves
   to Large 4, add an explicit `mistral-large-latest` key at [1.36,4.18] — now 2.7x the current pin, so
   that move would raise every supervisor/analysis mistral call.
6. **Relay token** expires 2026-10-27; preflight will flag it. Not needed by this routine.
7. **Scheduled prompt text** still pins `gpt-5.5 [30,60]`; table and vendor say [5,30].
