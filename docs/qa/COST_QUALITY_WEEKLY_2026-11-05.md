# RELAY-COST-QUALITY-TUNE — weekly run 2026-11-05 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Opus 5.5. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/`), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mw3aark6` off `origin/main` `a473a78c`.
Duplicate-run check: no `COST_QUALITY_WEEKLY` file in the last 6 days (newest 2026-10-23) → full run.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin's own rollback is `'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path + preflight notes

Preflight: token OK (expires 2026-11-09T19:34:50Z, 4.5 d left). **DISPATCH GAP 13.0 d** — previous
start 2026-10-23. The 2026-10-29 Wednesday fire did not run on this machine (desktop-app-local task;
the app was presumably closed). No cloud report covered that week either. Owner: check the cloud
trigger is still live.

No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` here and no D1 MCP connector in this session. D1 read with
wrangler from the shared clone's `workers/access-relay` (`d1 execute ant_memory --remote --json`,
`SELECT` only). First call returned the transient `7403`; the retry succeeded (same as 10-23).
Pulled: raw `llm_calls` 30 d (13 rows) and `llm_provider_costs` (34 rows). Snapshot built per
(provider, task) with every cost recomputed from tokens through `rateForStrict()` at today's audited
table, then `relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN; one price change, four unkeyed ids

Fetched 2026-11-05: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `docs.mistral.ai/inference/pricing`,
`ai.google.dev/gemini-api/docs/pricing` (301 → `aistudio.google.com/docs/pricing`, same vendor);
Mistral `GET /v1/models` (read-only, 64 ids). 87 page ids diffed mechanically against `rateForStrict()`.

**Pins verify:** `claude-sonnet-5` [2,10] (footnote 3: the $3/$15 rise will not occur),
`claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (gen pin), `claude-fable-5` / `-5-1`
[10,50], `claude-haiku-4-5` [1,5]; `gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30]; `mistral-large` [0.5,1.5]
(`mistral-large-latest` still aliases `mistral-large-2512` = Large 3); `gemini-2.5-flash` [0.3,2.5].
Anthropic lists nothing unpriced (Sonnet 5.5, Haiku 5.5, Mythos 5 / 5.1 already keyed).

**RED, fixed this run** (all three byte-identical mirrors, CRLF-aware, one anchor each, dated comments):

| id | resolved to (before) | vendor 2026-11-05 | error | ticket |
|---|---|---|---|---|
| `mistral-large-4` / `-4-0` | [1.36,4.18] (10-23 list) | **[0.70,2.10]**, no sale note | 1.94x / 1.99x OVER | MISTRAL-LARGE4-RATE-2026-11-001 |
| `gpt-6.1-terra` (new) | FALLBACK [3,15], strict `null` | [1,5] | 3x OVER | OPENAI-GPT6-TERRA-ROSALIND-RATES-2026-11-001 |
| `gpt-6-rosalind` (new) | FALLBACK [3,15], strict `null` | [15,75] | 5x UNDER | OPENAI-GPT6-TERRA-ROSALIND-RATES-2026-11-001 |
| `deepseek-v4-1-flash-1017` (new on Mistral; page slug `deepseek-v4-flash-1017`) | FALLBACK [3,15], strict `null` | [0.30,1.20] | 10x / 12.5x OVER | DEEPSEEK-V41-FLASH-RATES-2026-11-001 |
| `gemini-2.5-flash-native-audio-preview-12-2025` | `gemini-2.5-flash` [0.30,2.50] | text [0.50,2.00] | 1.67x UNDER in | GEMINI-NATIVE-AUDIO-RATES-2026-11-001 |

Large 4 has now shown three prices in four weeks ([0.68,2.09] sale 10-08, [1.36,4.18] 10-23,
[0.70,2.10] today). Today's number is the vendor page; re-verify every tune. None of the ids is an
AntCV pin or in a default cascade; the new tests assert they stay out.

Comment-only updates: `gpt-5.6-sol` promo now reads "available until November 30, 2026" (was "at
least through November 21"); a dated note on the Gemini 2.5 routing change below.

Tests: `model-table-freshness.test.mjs` (proxy + demo-proxy, byte-identical) **46/46 each** (was 44;
the 10-15 catalogue rows and the 10-08 assertion for Large 4 are corrected to the vendor rate, not
trimmed; `VENDOR_CATALOGUE_2026_11_05` carries the new ids); `pwa/test/relay-model-rates-mirror.test.mjs`
**14/14** (was 13).

**Left unkeyed by rule:** Ministral 3 page slugs (`ministral-3-14b-25-12` etc.) — the live ids
`ministral-{14b,8b,3b}-2512` / `-latest` resolve correctly (1a-quater(iii)). OpenAI realtime / audio,
per-minute models, image, TTS, transcribe, embedding; Mistral Voxtral, OCR, embed, moderation; Gemini
transcribe, TTS, image, embedding, robotics, Lyria.

**Dated vendor changes ahead (not table errors today):**
- **2026-12-01, Google:** every `gemini-2.5-flash` request routes to `gemini-3.5-flash-lite`, billed
  [0.30,2.50] (no rate change); every `gemini-2.5-pro` request routes to `gemini-3.8-flash`, billed
  [0.75,3.75]. The AntCV gemini pin (`gemini-2.5-flash`: compress, consensus_poll) changes MODEL on that
  date without a code change. Owner call on quality. Re-key `gemini-2.5-pro` at the first tune after 12-01.
- **2026-12-01:** `gemini-4-argon` doubles to [4,20].
- **2026-11-30:** `gpt-5.6-sol` promo ends; no post-promo price published.
- **2027-01-01:** Gemini 3.6 / 3.7 / 3.8 Flash double.

## 2. Step 1b — cost-source audit: reconciles to the cent

(i) `llm_provider_costs` (34 rows, unchanged since 10-15, SELECT only): the newest row per model equals
the audited rate for every model in telemetry — `gpt-5.4-mini` [0.75,4.5], `mistral-large-latest`
[0.5,1.5], `gemini-2.5-flash` [0.3,2.5]; `claude-sonnet-5` [2,10] and `claude-opus-5-5` [4,20] (no
traffic). No row for any id changed today. **No D1 write owed.**

(ii) PWA `C` map (`pwa/app.src.js` ~1220): anthropic/claude [2,10], openai [0.75,4.5], mistral
[0.5,1.5], gemini [0.3,2.5] = the audited mirrors at provider level. Row 115 stands.

(iii) Recompute from raw tokens:

| task | provider | model | n (7 d / 30 d) | stored $ 30 d | recomputed $ 30 d | ratio |
|---|---|---|---|---|---|---|
| parse_jd | mistral | mistral-large-latest | 1 / 2 | 0.051143 | 0.051143 | 1.0000 |
| consensus_reinforce | openai | gpt-5.4-mini | 1 / 2 | 0.014786 | 0.014786 | 1.0000 |
| consensus_poll | openai | gpt-5.4-mini | 1 / 2 | 0.009907 | 0.009907 | 1.0000 |
| consensus_poll | mistral | mistral-large-latest | 1 / 2 | 0.006899 | 0.006899 | 1.0000 |
| compress | openai | gpt-5.4-mini | 1 / 1 | 0.006570 | 0.006570 | 1.0000 |
| analyze_fit | openai | gpt-5.4-mini | 0 / 1 | 0.003231 | 0.003231 | 1.0000 |
| compress | gemini | gemini-2.5-flash | 0 / 1 | 0.002971 | 0.002971 | 1.0000 |
| consensus_poll | gemini | gemini-2.5-flash | 1 / 2 | 0.001788 | 0.001788 | 1.0000 |
| **TOTAL** | | | **6 / 13** | **0.097295** | **0.097296** | **1.0000** |

The 2026-09-28 pre-fix claude row has aged out of the 30 d window; stored = recomputed for the first
time since the audit started.

## 3. Traffic + scoring — no flip

**7 d (2026-10-29 → 11-05): 6 `llm_calls`**, one session on 2026-11-03 01:39 UTC. 30 d: 13 calls (the
10-20 and 11-03 sessions). 100% success, 0 retries, 0 malformed / placeholder / fabrication /
banned-word flags.

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | evidence (recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | no telemetry in 30 d | keep |
| analysis | mistral (pinned 09-29) | 7 d: mistral cq=40.7 n=1. 30 d: openai cq=309.5 n=1 (`analyze_fit`) · mistral 39.1 n=2 (`parse_jd`) | keep (n<20) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

Second post-pin `parse_jd` went to mistral (`mistral-large-latest`, 129 s, $0.0246). The pin holds.

Client-dispatch levers (not `MODEL_ROLES`-tunable): **compress went to openai on 11-03 ($0.0066/call)
where 10-20 went to gemini ($0.0030/call)** — 2.2x per call, n=1 each, no retry or failure logged on the
gemini side. Not enough to act on; watch it next week. consensus_poll leads openai $0.0049/call,
consensus_reinforce openai $0.0093/call.

## 4. Deploy

See §6 (filled after the code commit reaches `main`).

## 5. Owed / owner calls

1. **Dispatch gap**: the 2026-10-29 fire was missed on this machine. Check the cloud trigger.
2. **Gemini 2.5 routing on 2026-12-01** (§1): the gemini pin silently becomes `gemini-3.5-flash-lite`.
   Keep, or move the pin (`gemini-3.6-flash` [0.75,3.75] / `gemini-3.5-flash-lite` explicit). Owner call.
3. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5): owner
   call, shift lane, cache-bust set. Still no claude call in 30 d.
4. **Row 124** (retired ids in `PROVIDER_MODELS` tails): unchanged, owner call.
5. **Promo expiries**: `gpt-5.6-sol` after 2026-11-30; `gemini-4-argon` doubles 2026-12-01; Gemini 3.x
   Flash at the first tune of 2027.
6. **Mistral alias watch**: `mistral-large-latest` still = Large 3. At today's Large 4 rate [0.70,2.10]
   an alias move would raise mistral calls 1.4x, not 2.7x.
7. **Relay token** expires 2026-11-09; preflight flags it. Not used by this routine.
8. **Scheduled prompt text** still pins `gpt-5.5 [30,60]`; vendor and table say [5,30].
