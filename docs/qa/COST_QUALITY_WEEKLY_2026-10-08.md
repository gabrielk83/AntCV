# RELAY-COST-QUALITY-TUNE — weekly run 2026-10-08 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Fable 5.1. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/`), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-muzfmrta` off `origin/main` `2436cdb1`.
Duplicate-run check: the newest report is 2026-09-29 (9 days old) → full run, not a cross-check.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin is the owner follow-up of 09-29; its own rollback is
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

## 0. Data path

The Cloudflare D1 MCP connector was reachable from this session (first time on this desktop; the
09-29 and 10-01 runs had to fall back to wrangler). `llm_calls` (30 d) and `llm_provider_costs`
were read with two `SELECT`s, `changed_db:false`, `rows_written:0`. No `ANTCV_ADMIN_TOKEN` /
`ANTCV_RELAY_URL`, so the script ran offline: raw calls → per (provider, task) snapshot with every
cost recomputed from tokens at the audited rates → `relay-cost-quality-tune.mjs --data`.

The Mistral alias check in §1 used the owner's saved `~/.antcv/keys.env` for one `GET /v1/models`
(read-only; the key was not printed or stored anywhere else).

## 1. Step 1a — freshness audit: pins GREEN, four new ids priced

Fetched 2026-10-08: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `docs.mistral.ai/inference/pricing` (mistral.ai/pricing
now redirects there; the marketing page lists only Large), `ai.google.dev/gemini-api/docs/pricing`.

**Every pin verifies:** `claude-sonnet-5` [2,10] (the footnote still says the $3/$15 rise will not
occur), `claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (gen pin),
`claude-sonnet-5-5` [2,10], `claude-fable-5` / `-5-1` and `claude-mythos-5` / `-5-1` [10,50],
`claude-haiku-4-5` [1,5], `gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30], `gpt-5.5-pro` / `gpt-5.4-pro`
[30,180], `gpt-6-astra` [10,50], `gpt-6-sol` / `gpt-6.1-sol` [2,10], `gpt-6-luna` [0.1,0.5],
`gpt-5.6-sol/terra/luna` [4,20]/[2,12]/[0.2,1.2], `mistral-large` [0.5,1.5] (Large 3),
`mistral-medium` [1.5,7.5], `mistral-small` [0.15,0.6], `gemini-2.5-flash` [0.3,2.5],
`gemini-2.5-flash-lite` [0.1,0.4], `gemini-2.5-pro` [1.25,10], the whole Gemini 3.x block
(3.8/3.7/3.6-flash [0.75,3.75] promotional to 2026-12-31, 3.5-flash [1.5,9], 3.5-flash-lite [0.3,2.5],
3.1-flash-lite [0.25,1.5], 3.1-pro [2,12]). No regression in the table. No new Gemini id.

**RED on four ids the vendors list that the table did not:**

| id | resolved to (before) | vendor | error | ticket |
|---|---|---|---|---|
| `claude-haiku-5-5` | FALLBACK [3,15] (strict `null`) | [0.10,0.50] ≤100k tokens; [0.50,2.50] above | **30x OVER** in and out | ANTHROPIC-HAIKU55-RATES-2026-10-001 |
| `mistral-large-4` / `-4-0` | `mistral-large` [0.5,1.5] | SALE [0.68,2.09]; list [1.36,4.18] | 1.36x / 1.39x UNDER (2.7x / 2.8x at list) | MISTRAL-LARGE4-RATES-2026-10-001 |
| `gpt-5.5-cyber` | `gpt-5.5` [5,30] (the pin) | [12.50,75] | 2.5x UNDER | GPT-CYBER-RATES-2026-10-001 |
| `gpt-5.6-cyber` | `gpt-5` [1.25,10] | [12.50,75] | 10x / 7.5x UNDER | GPT-CYBER-RATES-2026-10-001 |

Notes on each:

- **Haiku 5.5** is new on the Anthropic page and is priced by prompt length. Pinned at the ≤100k
  tier: the largest AntCV prompt in `llm_calls` is ~55k tokens. The page also marks Haiku 3.5 as
  retired on the first-party API; its key stays for older deployed models. Not an AntCV pin.
- **Mistral Large 4** was released 2026-10-06 (API ids `mistral-large-4`, alias `mistral-large-4-0`).
  Both contain `mistral-large`, so longest-key-wins handed them Large 3's rate. **The live pin is
  safe today:** `GET /v1/models` (2026-10-08) says `mistral-large-latest` aliases
  `mistral-large-2512` = Large 3, so every AntCV mistral call still prices at [0.5,1.5]. Two things
  to re-verify at every tune, both written into the table comment: the `-latest` alias will move to
  Large 4 one day (then an explicit `mistral-large-latest` key at the Large 4 rate is needed, since
  the substring rule cannot tell the alias apart), and the sale has no stated end date.
- **The Cyber tiers** are restricted-access models nobody at AntCV will dispatch, but
  `gpt-5.5-cyber` carries the pinned `gpt-5.5` string, which is exactly why the `-pro` tiers were
  priced on 09-29. Same rule, same fix.
- **`gpt-5.6-sol` [4,20] is promotional**: the OpenAI page now says the price is available "at
  least through November 21, 2026" with no post-promo number. The rate is unchanged; the comment
  now says to re-verify at the first tune after that date.

**Fix:** the three byte-identical mirrors (`workers/proxy/src/demo-enforcement.js`,
`workers/demo-proxy/src/demo-enforcement.js`, `workers/access-relay/src/model-rates.js`) each gain
the four keys with dated comments; mirrors verified byte-identical above the END-OF-MIRROR line.
Spot resolutions through `rateForStrict()`: the four new ids resolve to the vendor number and
`claude-haiku-4-5`, `claude-3-5-haiku`, `mistral-large-latest`, `mistral-large-2512`,
`mistral-large-2411`, `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.6-sol`, `gpt-5.4-mini`, `claude-sonnet-5`,
`claude-opus-5-5`, `gemini-2.5-flash` are undisturbed. Tests extended:
`model-table-freshness.test.mjs` (proxy + demo-proxy, identical) +4 → **36/36 each** (was 32);
`pwa/test/relay-model-rates-mirror.test.mjs` +1 → **10/10** (was 9). Pricing is not adoption:
`PROVIDER_MODELS` unchanged, and the new tests assert none of the four ids entered a default
cascade. The PWA `C` map is provider-level and no pinned model's price moved, so nothing to change
there.

Still deferred to a full audit (not new, not pins, no traffic): `gpt-5.2` [1.75,14], `gpt-5.2-pro`,
`gpt-5-pro` [15,120], `gpt-5-nano` [0.05,0.4], `gpt-5.3-codex` [1.75,14], `gpt-5.1` [1.25,10] all
resolve to the shorter `gpt-5` key [1.25,10]; `o4-mini` [1.1,4.4], `chat-latest` [5,30],
`gpt-rosalind-research` [5,25], `gpt-5-search-api` fall to FALLBACK. Mistral also lists Ministral 3
(3B/8B/14B), Codestral [0.3,0.9] and a hosted Z.ai GLM 5.3 [1.4,4.4]; none contains a key, none is
reachable from AntCV.

## 2. Step 1b — cost-source audit: D1 reconciles; stored cost still 1.35x on the two pre-fix claude rows

(i) `llm_provider_costs` (34 rows, SELECT only): the newest row per model equals the audited rate
for every model that appears in telemetry — `claude-sonnet-5` [2,10], `claude-opus-5-5` [4,20],
`gpt-5.4-mini` [0.75,4.5], `gpt-5.5` [5,30], `mistral-large-latest` [0.5,1.5],
`gemini-2.5-flash` [0.3,2.5]. The 09-30 superseding INSERT is live. No row for `claude-haiku-5-5`,
`mistral-large-4` or the Cyber tiers: correct — with no row, telemetry prices from the relay table
once the relay carries today's keys. Adding D1 rows would only create a second copy to keep in step.

(ii) PWA `C` map: anthropic/claude [2,10], openai [0.75,4.5], mistral [0.5,1.5], gemini [0.3,2.5]
= the audited mirrors at provider level. Row 115 (PWA-COST-METER-OPUS55-001) stands: the `claude`
key still carries the sonnet-5 rate while `q()` pins opus-5-5 [4,20]. Not fixed here (app.js +
cache-bust set + shift lane; owner call). No opus-5-5 call has reached `llm_calls` yet, so the
served model on that path is still unobserved.

(iii) Recompute from raw tokens, 30 d (the 7 d window is empty, §3):

| task | provider | model | n | stored $ | recomputed $ | ratio |
|---|---|---|---|---|---|---|
| parse_jd | claude | claude-sonnet-5 | 2 | 0.501867 | **0.334578** | **1.5000** |
| parse_jd | mistral | mistral-large-latest | 3 | 0.067250 | 0.067250 | 1.0000 |
| apply_correction | openai | gpt-5.4-mini | 2 | 0.028769 | 0.028769 | 1.0000 |
| consensus_reinforce | openai | gpt-5.4-mini | 3 | 0.018384 | 0.018384 | 1.0000 |
| fuse | openai | gpt-5.4-mini | 1 | 0.006821 | 0.006821 | 1.0000 |
| compress | gemini | gemini-2.5-flash | 3 | 0.006478 | 0.006478 | 1.0000 |
| consensus_poll | openai | gpt-5.4-mini | 3 | 0.006149 | 0.006149 | 1.0000 |
| analyze_fit | openai | gpt-5.4-mini | 2 | 0.005621 | 0.005620 | 1.0001 |
| consensus_poll | mistral | mistral-large-latest | 3 | 0.004446 | 0.004445 | 1.0002 |
| consensus_poll | gemini | gemini-2.5-flash | 3 | 0.001290 | 0.001290 | 0.9996 |
| **TOTAL (30 d)** | | | **25** | **0.647075** | **0.479784** | **1.349** |

The whole gap is the two claude `parse_jd` rows (2026-09-08 and 2026-09-28), both logged before
the 09-30 D1 fix at the old [3,15]. Every other row reconciles to the cent. The fix cannot be
confirmed on a fresh row until a claude call happens.

## 3. Traffic + scoring — no flip (empty week; 30 d used)

**7 d (2026-10-01 → 10-08): ZERO `llm_calls`.** Last call of any task: 2026-09-28 21:38 UTC. Per
the routine, scoring fell back to **30 d: 25 calls** in two sessions (2026-09-08 14:06 UTC ×7,
2026-09-28 21:33–21:38 UTC ×18), 100% success, 0 retries, 0 malformed / placeholder / fabrication /
banned-word flags.

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | 30 d evidence (recomputed cost) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | openai n=2 ok=100% cq=69.5 ($0.0144/call) | keep (n<20) |
| analysis | mistral (pinned 09-29) | openai cq=355.9 n=2 · mistral cq=44.6 n=3 · anthropic cq=6.0 n=2 | keep (n<20) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

Client-dispatch levers (not `MODEL_ROLES`-tunable): compress leads gemini $0.0022/call,
consensus_poll leads openai $0.0021/call, consensus_reinforce openai $0.0061/call. All at 100%
success; nothing to move at this volume.

No head can move on two sessions a month. The `analysis` pin from 09-29 has had no traffic to
prove or disprove it: the 09-28 session predates it. First `parse_jd` after the pin is the check
(expect provider `mistral` first, with claude only on a fallback).

## 4. Deploy

**DEPLOYED ×3 this run, one at a time via `deploy.yml` (`mode=deploy`, `confirm=<target>`), after the
code commit `9d7466d3` was pushed and the full suite passed (2240 tests, 0 fail):**

| worker | run | from | result | `/health` after |
|---|---|---|---|---|
| proxy (`cv-proxy`) | 37772931509 | `9d7466d3` | success, step "Deploy proxy" | 200, `3.8.4-brand-ink-match` |
| demo-proxy (`antcv-demo-proxy`) | 37773485941 | `7814fda4` | success | 200, `3.8.4-brand-ink-match` |
| access-relay (`antcv-access-relay`) | 37773581157 | `7814fda4` | success | 200, `auth-38-subtitle-guard-qual-put` |

The last two ran from `7814fda4` because another session pushed a job-tracker commit
(POSTING-409-REPROBE-001) between dispatches; it touches no `workers/` file, so each deploy
shipped exactly the rate-table commits since the previous deploy of 2026-09-29 (`1a572a6d`): the
10-01 Gemini 3.7/3.6 keys (`f09926c2`) and today's four keys (`9d7466d3`). No other worker change
was pending on `main`. Before this run the three workers had been deployed last on 2026-09-29
22:13–22:15 UTC, so the 10-01 "deploy ×3 OWED" is now cleared.

Not verified live beyond `/health`: no endpoint exposes the rate table, and no new id has traffic.
The first `llm_calls` row for any of the four ids is the proof that the relay prices it (strict
lookup non-null, no client-cost fallback warning).

## 5. Owed / owner calls

1. **Row 115** (PWA `C` map meters `claude` at the sonnet-5 rate while the gen pin is opus-5-5):
   owner call, shift lane, cache-bust set. Unchanged from 10-01.
2. **Mistral alias watch**: when `mistral-large-latest` starts aliasing `mistral-large-4`, add an
   explicit `mistral-large-latest` key at the Large 4 rate in all three mirrors (the substring rule
   cannot separate the alias from `mistral-large`); and re-read the Large 4 sale price each tune.
3. **Promo expiries**: `gpt-5.6-sol` after 2026-11-21; the whole Gemini 3.x block at the first tune
   of 2027.
4. **First post-pin traffic**: one real generation would settle three open questions at once
   (D1 fix on a fresh claude row, the served model on the opus-5-5 path for row 115, and the
   `analysis`→mistral head order). Nothing in telemetry since 2026-09-28.
