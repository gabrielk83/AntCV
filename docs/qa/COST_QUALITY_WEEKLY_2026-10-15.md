# RELAY-COST-QUALITY-TUNE — weekly run 2026-10-15 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Fable 5.1. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/`), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mv9pzhg7` off `origin/main` `7836166d`.
Duplicate-run check: the newest report is 2026-10-08 (7 days old) → full run, not a cross-check.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin is the owner follow-up of 09-29; its own rollback is
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path + preflight notes

Preflight reported **TOKEN EXPIRED** (`~/.antcv/token`, expired 2026-10-15T11:12:36Z) and a 7.2-day
dispatch gap (the normal weekly cadence). This routine does not use the relay token (no
`ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` here either), so nothing in this run was blocked by it, but the
nightlies that attest live will 401 until the owner re-saves it (preflight prints the console
one-liner).

D1 was read with wrangler from the shared clone's `workers/access-relay` (`d1 execute ant_memory
--remote --json`, `SELECT` only; every result `changed_db:false`, `rows_written:0`): `llm_calls`
(7 d count, 30 d rows) and `llm_provider_costs`. The script ran offline: raw calls → per
(provider, task) snapshot with every cost recomputed from tokens through `rateForStrict()` →
`relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN, one new id priced

Fetched 2026-10-15: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `docs.mistral.ai/inference/pricing`,
`ai.google.dev/gemini-api/docs/pricing`.

**Every pin verifies, nothing moved since 10-08:** `claude-sonnet-5` [2,10] (footnote 3 still says
the $3/$15 rise will not occur), `claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20]
(gen pin), `claude-sonnet-5-5` [2,10], `claude-fable-5` / `-5-1` and `claude-mythos-5` / `-5-1` [10,50],
`claude-haiku-5-5` [0.10,0.50] ≤100k / [0.50,2.50] above, `claude-haiku-4-5` [1,5]; `gpt-5.4-mini`
[0.75,4.5], `gpt-5.5` [5,30], `gpt-5.5-pro` / `gpt-5.4-pro` [30,180], `gpt-6-astra` [10,50],
`gpt-6-sol` / `gpt-6.1-sol` [2,10], `gpt-6-luna` [0.1,0.5], `gpt-5.6-sol/terra/luna`
[4,20]/[2,12]/[0.2,1.2] (Sol still promotional "at least through November 21, 2026"); `mistral-large`
[0.5,1.5] (Large 3), `mistral-large-4` still on SALE [0.68,2.09] (list [1.36,4.18]), `mistral-medium`
[1.5,7.5], `mistral-small` [0.15,0.6]; `gemini-2.5-flash` [0.3,2.5], `gemini-2.5-flash-lite` [0.1,0.4],
`gemini-2.5-pro` [1.25,10], the Gemini 3.x block (3.8/3.6-flash [0.75,3.75] promotional to 2026-12-31,
3.5-flash-lite [0.3,2.5], 3.1-flash-lite [0.25,1.5], 3.1-pro-preview [2,12]). No regression in the table.
(The scheduled prompt still says `gpt-5.5 [30,60]`; the vendor page and all three mirrors say [5,30],
corrected 2026-09-10 — the prompt text is stale, the table is right.)

**RED on one id the vendor lists that the table did not:**

| id | resolved to (before) | vendor | error | ticket |
|---|---|---|---|---|
| `gemini-4-argon` | FALLBACK [3,15] (strict `null`) | [2,10] introductory; [4,20] from 2026-12-01 | **1.5x OVER** in and out | GEMINI4-ARGON-RATES-2026-10-001 |

`gemini-4-argon` is the new Gemini flagship, announced at the top of the pricing page. The id contains
no existing key, so `rateFor()` guessed the Sonnet fallback and `rateForStrict()` answered `null`
(telemetry would have fallen back to the PWA-reported cost). Pinned at the introductory price; the
table comment says it DOUBLES on 2026-12-01 and must be re-verified at the first tune after that date.
Not an AntCV pin. Pricing is not adoption: `PROVIDER_MODELS.gemini` unchanged and the new test asserts
the id is not in the default cascade.

**Fix:** the three byte-identical mirrors (`workers/proxy/src/demo-enforcement.js`,
`workers/demo-proxy/src/demo-enforcement.js`, `workers/access-relay/src/model-rates.js`) each gain the
key with a dated comment (CRLF-aware insert, one anchor per file). Spot resolutions through
`rateForStrict()`: `gemini-4-argon` → [2,10]; `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`,
`gemini-2.5-flash-lite`, `gemini-2.0-flash`, `gemini-1.5-flash` undisturbed. Tests extended:
`model-table-freshness.test.mjs` (proxy + demo-proxy, identical) +3 → **39/39 each** (was 36);
`pwa/test/relay-model-rates-mirror.test.mjs` +1 → **11/11** (was 10). Full suite
`node scripts/run-tests.mjs`: ALL PASS. The PWA `C` map is provider-level and no pinned model's price
moved, so nothing to change there.

Still deferred (not pins, no traffic): `gemini-3-flash-preview` [0.5,3] is now labelled legacy on the
page and has no key (falls to FALLBACK); the OpenAI `gpt-5.2` / `gpt-5.1` / `gpt-5-pro` / `gpt-5-nano` /
`gpt-5.3-codex` family still resolves to the shorter `gpt-5` key; `o4-mini`, `chat-latest`,
`gpt-5-search-api` fall to FALLBACK; Mistral's Ministral 3, Codestral and the hosted GLM 5.3 have no key.
None is reachable from AntCV.

## 2. Step 1b — cost-source audit: D1 reconciles; stored cost 1.30x on the one pre-fix claude row

(i) `llm_provider_costs` (34 rows, unchanged since 10-08, SELECT only): the newest row per model
equals the audited rate for every model that appears in telemetry — `claude-sonnet-5` [2,10],
`claude-opus-5-5` [4,20], `gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30], `mistral-large-latest` [0.5,1.5],
`gemini-2.5-flash` [0.3,2.5]. No row for `gemini-4-argon`: correct — with no row, telemetry prices from
the relay table once the relay carries today's key. No D1 write is owed.

(ii) PWA `C` map (`pwa/app.src.js` ~1221–1235): anthropic/claude [2,10], openai [0.75,4.5], mistral
[0.5,1.5], gemini [0.3,2.5] = the audited mirrors at provider level. Row 115 (PWA-COST-METER-OPUS55-001)
stands: `claude` still carries the sonnet-5 rate while `q()` pins opus-5-5 [4,20]. Not fixed here
(app.js + cache-bust set + shift lane; owner call). Still no opus-5-5 call in `llm_calls`.

(iii) Recompute from raw tokens, 30 d (the 7 d window is empty, §3):

| task | provider | model | n | stored $ | recomputed $ | ratio |
|---|---|---|---|---|---|---|
| parse_jd | claude | claude-sonnet-5 | 1 | 0.246639 | **0.164426** | **1.5000** |
| parse_jd | mistral | mistral-large-latest | 2 | 0.043191 | 0.043191 | 1.0000 |
| apply_correction | openai | gpt-5.4-mini | 2 | 0.028769 | 0.028769 | 1.0000 |
| consensus_reinforce | openai | gpt-5.4-mini | 2 | 0.011832 | 0.011832 | 1.0000 |
| fuse | openai | gpt-5.4-mini | 1 | 0.006821 | 0.006821 | 1.0000 |
| analyze_fit | openai | gpt-5.4-mini | 2 | 0.005621 | 0.005620 | 1.0001 |
| compress | gemini | gemini-2.5-flash | 2 | 0.004469 | 0.004469 | 1.0000 |
| consensus_poll | openai | gpt-5.4-mini | 2 | 0.004186 | 0.004187 | 0.9999 |
| consensus_poll | mistral | mistral-large-latest | 2 | 0.002965 | 0.002965 | 1.0002 |
| consensus_poll | gemini | gemini-2.5-flash | 2 | 0.000852 | 0.000852 | 1.0000 |
| **TOTAL (30 d)** | | | **18** | **0.355345** | **0.273131** | **1.301** |

The whole gap is the single claude `parse_jd` row of 2026-09-28, logged before the 09-30 D1 fix at the
old [3,15]. Every other row reconciles to the cent. The 09-08 session has aged out of the 30 d window,
which is why n dropped from 25 to 18 since 10-08.

## 3. Traffic + scoring — no flip (empty week; 30 d used)

**7 d (2026-10-08 → 10-15): ZERO `llm_calls`.** Last call of any task: 2026-09-28 21:38 UTC
(17 days). Per the routine, scoring fell back to **30 d: 18 calls** in one session
(2026-09-28 21:33–21:38 UTC), 100% success, 0 retries, 0 malformed / placeholder / fabrication /
banned-word flags.

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | 30 d evidence (recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | openai n=2 ok=100% cq=69.5 ($0.0144/call) | keep (n<20) |
| analysis | mistral (pinned 09-29) | openai cq=355.9 n=2 · mistral cq=46.3 n=2 · anthropic cq=6.1 n=1 | keep (n<20) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

Client-dispatch levers (not `MODEL_ROLES`-tunable): compress leads gemini $0.0022/call,
consensus_poll leads openai $0.0021/call, consensus_reinforce openai $0.0059/call. All at 100%
success; nothing to move at this volume.

Nothing can move on one session a month. The `analysis` pin from 09-29 still has no post-pin traffic.

## 4. Deploy

**DEPLOYED ×3 this run, one at a time via `deploy.yml` (`mode=deploy`, `confirm=<target>`), after the
code commit `cbe66c2f` was pushed (two rebases: the demand-seed weekly + its shift release landed on
`main` while this run was committing) and the full suite passed:**

| worker | run | from | result | `/health` after |
|---|---|---|---|---|
| proxy (`cv-proxy`) | 38766174548 | `cbe66c2f` | success (lint, unit-tests, deploy-worker) | 200, `3.8.4-brand-ink-match` |
| demo-proxy (`antcv-demo-proxy`) | 38766290667 | `cbe66c2f` | success | 200, `3.8.4-brand-ink-match` |
| access-relay (`antcv-access-relay`) | 38766434433 | `f65a8fca` | success | 200, `auth-38-subtitle-guard-qual-put` |

The relay run started from `f65a8fca` because a job-tracker commit (sweep verdict summary on a PUT
failure) was pushed between dispatches; `git diff --stat cbe66c2f f65a8fca -- workers/` is empty, so
each deploy shipped exactly the rate-table commit since the 2026-10-08 deploys. Not verified live
beyond `/health`: no endpoint exposes the rate table and `gemini-4-argon` has no traffic. The first
`llm_calls` row for it would be the proof (strict lookup non-null, no client-cost fallback warning).

## 5. Owed / owner calls

1. **Relay token expired** (2026-10-15T11:12:36Z): re-save `~/.antcv/token` from the signed-in PWA
   console, or every relay-backed nightly step 401s. Not needed by this routine.
2. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5):
   owner call, shift lane, cache-bust set. Unchanged since 10-01.
3. **Promo expiries**, in order: `gpt-5.6-sol` after 2026-11-21; **`gemini-4-argon` doubles to [4,20]
   on 2026-12-01**; the whole Gemini 3.x block at the first tune of 2027.
4. **Mistral alias watch**: `GET /v1/models` was not re-probed this run (no key use); when
   `mistral-large-latest` starts aliasing Large 4, add an explicit `mistral-large-latest` key at the
   Large 4 rate in all three mirrors.
5. **First post-pin traffic**: one real generation settles the D1 fix on a fresh claude row, the served
   model on the opus-5-5 path (row 115), and the `analysis`→mistral head order. Nothing since 09-28.
6. **Scheduled prompt text** still pins `gpt-5.5 [30,60]`; the table and vendor say [5,30]. Harmless
   (the table wins) but worth correcting in the task store.

## 6. Owner follow-up, same day: full-catalogue sweep — MODEL-TABLE-SWEEP-2026-10-001

Owner, after §1: "notice multiple new models have been released by mistral, gemini, openai and
anthropic". Correct. §1 priced one id and deferred the rest as "not a pin, no traffic" — the same
policy every pass since 08-20 had followed. Second pass in worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mv9pzhg7-sweep` off `origin/main` `911c6d57`.

**Method change.** Re-fetched the four pricing pages and each vendor's models page, probed Mistral
`GET /v1/models` read-only (54 ids, the only source for alias targets), and diffed every listed text id
against `rateFor()` mechanically instead of by eye.

| vendor | unpriced or mis-resolved before | keys added | worst error before |
|---|---|---|---|
| Anthropic | none — every id on the page keyed (Haiku 5.5 since 10-08) | 0 | — |
| OpenAI | 20 ids → `gpt-5` [1.25,10] or FALLBACK [3,15] | 22 | `gpt-5-nano` 25x OVER; `gpt-5.2-pro` 17x UNDER; `gpt-5-pro` 12x UNDER; o-series / `chat-latest` fallback |
| Mistral | 15 live ids → FALLBACK | 13 | `ministral-3b` 30x OVER; `magistral-medium-latest` (alias of Medium 3.5) 2x OVER |
| Gemini | 7 ids → FALLBACK | 4 | `gemini-3-flash-preview` 6x OVER in; `gemini-omni-*` 2x OVER in |

Keys added — OpenAI: `gpt-5.2` / `gpt-5.2-pro` / `gpt-5.1` / `gpt-5-pro` / `gpt-5-nano` / `gpt-5.3-codex` / `gpt-5-search-api` / `chat-latest` / `o1` / `o1-pro` / `o3` / `o3-pro` / `o3-mini` / `o4-mini` / `gpt-4o-2024-05-13` / `gpt-4-turbo` / `gpt-4-0613` / `gpt-3.5-turbo` (+`-1106`, `-instruct`) / `davinci-002` / `babbage-002`. Mistral: `ministral-14b` / `-8b` / `-3b` / `magistral-medium` / `magistral-small` / `mistral-vibe-cli` (+`-fast`) / `codestral` / `codestral-embed` / `mistral-code` / `zai-glm` / `glm-5-2` (`mistral-large-latest` → `mistral-large-2512`
= Large 3 confirmed again; `magistral-medium-latest` / `magistral-small-latest` are now plain aliases of
`mistral-medium` / `mistral-small` and contain neither key). Gemini: `gemini-3-flash` (3-flash-preview) / `gemini-omni` (omni-1.1-flash, omni-flash-preview) / `gemini-3.8-live` / `gemini-3.1-flash-live`. Excluded by rule and
written in the table comment: image, TTS, embedding (except `codestral-embed`, token-priced), OCR,
Veo/Lyria, robotics ER — priced per image / character / second, not per text token.

**Tests.** `VENDOR_CATALOGUE_2026_10_15` (~110 ids, every page id with its vendor rate) is asserted in
`model-table-freshness.test.mjs` (proxy + demo-proxy identical, **42/42** each, +3: catalogue, `o1`/`o3`
short-key hijack guard, adoption guard) and `pwa/test/relay-model-rates-mirror.test.mjs` (**12/12**, +1,
strict lookup). Full suite exit 0, ALL PASS. `check-register.mjs` OK.

**Found on the way — row 124 (owner call).** The `PROVIDER_MODELS` fallback tails carry retired ids:
`mistral-large-2411` / `-2407`, `mistral-medium-2312` (all on Mistral's retired list, absent from
`/v1/models`), `gemini-2.0-flash`, `gemini-1.5-pro` / `-002` (shut down per the Gemini models page).
Heads are live, so nothing is broken; a fallback past the head burns a retry on a dead id. Cascade
edits are adoption (1a-bis(ii)), so not changed here.

**Rule change.** `SCHEDULED_ROUTINES.md` 1a-quater: price the whole token-priced text catalogue every
run, extend the catalogue list and never trim it, probe live id forms, diff mechanically, report
retired cascade ids as an owner call.

### 6.1 Deploy

**DEPLOYED ×3**, one at a time via `deploy.yml` (`mode=deploy`, `confirm=<target>`) after the sweep commit `eb121983` reached `main`: proxy (`cv-proxy`) run 38769211157, demo-proxy (`antcv-demo-proxy`) run 38769334260, access-relay (`antcv-access-relay`) run 38769469911 — every run from `eb121983`, lint + unit-tests + deploy-worker success, `/health` 200 ×3 (`3.8.4-brand-ink-match` ×2, `auth-38-subtitle-guard-qual-put`). The commits that landed on `main` around the dispatches (nightly register, MOB009 guard, two demand-seed shift claims) touch no `workers/` file. As with §4, nothing beyond `/health` is verifiable live until one of the new ids has traffic.
