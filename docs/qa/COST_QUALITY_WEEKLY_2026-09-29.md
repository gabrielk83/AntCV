# RELAY-COST-QUALITY-TUNE — weekly run 2026-09-29 (desktop, scheduled)

Scheduled desktop trigger, Opus 5.5. First full scoring run since 09-06: the 09-17 and 09-23 runs
stalled on permission prompts (ROUTINE-PERMISSION-STALL-001) and left no report. Shared clone was
DIRTY (owner WIP in `workers/access-relay/`, `package.json`), so all work ran in the isolated
worktree `.claude/worktrees/routine-antcv-relay-cost-quality-tune-mun5utvn` off `origin/main`
`e8028f64`. Duplicate-run check: no `COST_QUALITY_WEEKLY_*` in the last 6 days → full run.

No shift lane claimed: nothing under `pwa/` that needs a cache-bust changed (three worker source
files, three test files, docs). No version number consumed.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`.

## 0. Data path

No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` and no `~/.antcv/token` on this machine (preflight:
`TOKEN MISSING`). The D1 MCP connector named in the routine prompt is **not connected in this
session** (Cloudflare bindings connector shows `needs_auth`; no D1 tool loaded). Fallback used:
`npx wrangler d1 execute ant_memory --remote` — wrangler on this machine is logged in. All queries
were `SELECT`; `changed_db:false`, `rows_written:0` on every call. Raw `llm_calls` → per
(provider, task) snapshot with every cost recomputed at audited rates → `relay-cost-quality-tune.mjs --data`.

## 1. Step 1a — freshness audit: pins GREEN, 10 new/mispriced ids fixed

Fetched 2026-09-29: `platform.claude.com/docs/en/about-claude/pricing.md`,
`developers.openai.com/api/docs/pricing`, `mistral.ai/pricing`, `ai.google.dev/gemini-api/docs/pricing`.

**Every pin verifies:** `claude-sonnet-5` [2,10] (introductory-price note still says the $3/$15 rise
will not occur), `claude-opus-4-8` [5,25], `claude-opus-5` [5,25], `claude-fable-5` / `-5-1` [10,50],
`claude-mythos-5` / `-5-1` [10,50], `claude-haiku-4-5` [1,5], `gpt-5.4-mini` [0.75,4.5],
`gpt-5.5` [5,30], `gpt-6-astra` [10,50], `gpt-5.6-sol/terra/luna` [4,20]/[2,12]/[0.2,1.2],
`mistral-large` [0.5,1.5], `gemini-2.5-flash` [0.3,2.5], `gemini-2.5-flash-lite` [0.1,0.4],
`gemini-3.8-flash` [0.75,3.75], `gemini-3.5-flash` [1.5,9]. No regression in the table.

**RED on ten ids the vendors list that the table did not.** Five sat on an existing key's prefix,
so longest-key-wins gave them a SIBLING's rate. That is worse than the fallback because
`rateForStrict()` answers with a number, not `null`, and nothing flags it:

| id | resolved to (before) | vendor | error | ticket |
|---|---|---|---|---|
| `claude-opus-5-5` | `claude-opus-5` [5,25] | [4,20] | 1.25x OVER | ANTHROPIC-55-RATES-2026-09-001 |
| `claude-sonnet-5-5` | `claude-sonnet-5` [2,10] | [2,10] | right by accident | ANTHROPIC-55-RATES-2026-09-001 |
| `gpt-5.5-pro` | `gpt-5.5` [5,30] | [30,180] | **6x UNDER** | GPT6-SOL-LUNA-RATES-2026-09-001 |
| `gpt-5.4-pro` | `gpt-5.4` [2.5,15] | [30,180] | **12x UNDER** | GPT6-SOL-LUNA-RATES-2026-09-001 |
| `gpt-6-sol` | FALLBACK [3,15] | [2,10] | 1.5x OVER | GPT6-SOL-LUNA-RATES-2026-09-001 |
| `gpt-6.1-sol` | FALLBACK [3,15] | [2,10] | 1.5x OVER | GPT6-SOL-LUNA-RATES-2026-09-001 |
| `gpt-6-luna` | FALLBACK [3,15] | [0.10,0.50] | **30x OVER** | GPT6-SOL-LUNA-RATES-2026-09-001 |
| `gemini-3.5-flash-lite` | `gemini-3.5-flash` [1.5,9] | [0.30,2.50] | 5x OVER in | GEMINI31-RATES-2026-09-001 |
| `gemini-3.1-flash-lite` | FALLBACK [3,15] | [0.25,1.50] | 12x OVER in | GEMINI31-RATES-2026-09-001 |
| `gemini-3.1-pro(-preview)` | FALLBACK [3,15] | [2,12] ≤200k | 1.5x OVER | GEMINI31-RATES-2026-09-001 |

`gpt-5.5-pro` / `gpt-5.4-pro` are not new models, but they sit directly on AntCV's two openai pins,
so any id carrying those strings priced at the pin's rate. Added with the new ones for that reason.
Other older OpenAI ids that still resolve to the shorter `gpt-5` key (`gpt-5.2` [1.75,14],
`gpt-5-nano` [0.05,0.4], `gpt-5-pro` [15,120], `gpt-5.2-pro`) were left alone. None is a pin or a
successor, and the scope here is ids released since the last pass. Listed for the next full audit.

**Gemini promo note widened.** The Gemini page now states that ALL 3.x prices are promotional
through 2026-12-31 and rise on 2027-01-01. The existing note named only `gemini-3.8-flash`. The new
comment block says to re-verify the whole 3.x block at the first tune of 2027. `gemini-3.5-flash`
[1.5,9] may be one of them. The page gave no post-2026 number for it.

**Fix:** the three byte-identical mirrors (`workers/proxy/src/demo-enforcement.js`,
`workers/demo-proxy/src/demo-enforcement.js`, `workers/access-relay/src/model-rates.js`) each gain
the ten keys with dated comments. 19/19 `rateForStrict()` spot resolutions verified correct,
including that `claude-opus-5`, `claude-sonnet-5`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5`,
`gemini-3.5-flash`, `gemini-2.5-flash`, `mistral-large-latest` are undisturbed. Tests extended:
`model-table-freshness.test.mjs` (proxy + demo-proxy, identical) +6 → **26/26 each** (was 20);
`pwa/test/relay-model-rates-mirror.test.mjs` +1 → **8/8**. Pricing is not adoption:
`PROVIDER_MODELS` unchanged, and a new test asserts none of the ten ids entered a default cascade.
The PWA `C` map is provider-level and the pinned models' prices did not move, so nothing to change there.

## 2. Step 1b — cost-source audit: D1 still wrong, now owed 23 days

`llm_provider_costs` re-listed. **The superseding INSERTs from 09-06 §3 and 09-10 §B are still not
applied.** Newest rows still say `('claude','claude-sonnet-5',3,15)` and `('openai','gpt-5.5',30,60)`.

Proof from this week's traffic, recomputed from raw tokens (1b(iii)):

| task | provider | n | stored $ | recomputed $ | ratio |
|---|---|---|---|---|---|
| parse_jd | claude | 1 | 0.246639 | **0.164426** | **1.5000** |
| parse_jd | mistral | 2 | 0.043191 | 0.043191 | 1.0000 |
| apply_correction | openai | 2 | 0.028769 | 0.028769 | 1.0000 |
| consensus_reinforce | openai | 2 | 0.011832 | 0.011832 | 1.0000 |
| fuse | openai | 1 | 0.006821 | 0.006821 | 1.0000 |
| analyze_fit | openai | 2 | 0.005621 | 0.005620 | 1.0000 |
| compress | gemini | 2 | 0.004469 | 0.004469 | 1.0000 |
| consensus_poll | openai | 2 | 0.004186 | 0.004187 | 1.0000 |
| consensus_poll | mistral | 2 | 0.002965 | 0.002965 | 1.0000 |
| consensus_poll | gemini | 2 | 0.000852 | 0.000852 | 1.0000 |
| **TOTAL (7 d)** | | **18** | **0.355345** | **0.273131** | **1.301** |

30-day: 46 calls, stored $1.2923 vs recomputed $0.9504 (1.360x), again all on claude. Every other
provider reconciles to the cent, so the mirrors and the `C` map are right and D1 is the single
wrong source. 1b(ii) reconciles: `C` map anthropic/claude [2,10], openai [0.75,4.5], mistral
[0.5,1.5], gemini [0.3,2.5] = the audited mirrors.

**Owed, owner-gated. Unchanged from 09-06/09-10, plus the new Anthropic ids:**

```sql
INSERT INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('claude', 'claude-sonnet-5',   2, 10, 1788652800),
  ('claude', 'claude-opus-5',     5, 25, 1788652800),
  ('claude', 'claude-fable-5',   10, 50, 1788652800),
  ('claude', 'claude-fable-5-1', 10, 50, 1788652800),
  ('openai', 'gpt-5.5',           5, 30, 1788998400);
```

The two new Anthropic ids need no D1 row. With no row, telemetry prices from the (now correct) relay
table. Adding D1 rows only creates a second copy to keep in step.

## 3. Traffic + scoring — no flip

7 d (2026-09-22 → 09-29): **18 calls, all in one session on 2026-09-28 21:33–21:38 UTC.** 30 d: 46
calls in four sessions (09-06 ×2, 09-08, 09-28). 100% success, 0 retries this week, 0 malformed /
placeholder / fabrication / banned-word flags.

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot, 7 d and 30 d: **no change**.

| role | head | evidence | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | openai n=2 cq=69.5 ($0.0144/call) | keep (n<20) |
| analysis (unpinned) | anthropic default | openai cq=355.9 n=2 · mistral cq=46.3 n=2 · anthropic cq=6.1 n=1 (7 d); 30 d adds gemini cq=97.3 n=3 | keep (n<20, activation floor 30) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

Traffic is too thin to move any head. Same finding as the last three reports. The loop cannot
improve on four sessions a month. See §6.

**One real signal inside the thin data.** `parse_jd` (analysis role): one claude call = $0.164 at
the true rate, which is **60%** of the week's entire true spend, from 1 of 18 calls. mistral does the
same task at $0.0216/call (7.6x cheaper), openai `analyze_fit` at $0.0028. The ordering has held for
five consecutive reports (08-26, 09-06, 09-10, now 7 d and 30 d). It is below the sample floor
only because traffic is low, not because the evidence is mixed.

## 4. Deploy state (corrects the 09-10 "never run" note)

- `proxy` + `demo-proxy` + `access-relay` were deployed **2026-09-15** by owner-directed local
  `wrangler deploy` (register row 89), covering the 09-06 and 09-10 rate fixes. `proxy` +
  `demo-proxy` redeployed again today 19:52–19:54 UTC via `deploy.yml` from `0c1a860d`.
- **This run's ten keys are OWED ×3** (`proxy`, `demo-proxy`, `access-relay`), one at a time, then
  `/health`. Left owed, per the routine guardrail: none of the ten ids has traffic, so nothing is
  mispriced in production today, and other sessions were deploying workers from `main` throughout the
  evening ("one deployer at a time"). The deploy path itself works: row 109 (`DEPLOY-YML-CF-AUTH-BROKEN-001`)
  was CLOSED by the desktop nightly during this run.

## 5. Side finding — `run-tests.mjs` could not run from a routine worktree (fixed upstream as RUN-TESTS-CMDLINE-001)

`node scripts/run-tests.mjs` exited 1 with only its file list and no test output. Cause:
it passes ~291 **absolute** test paths on one `node --test` argv. From the routine worktree path
(`<repo>/.claude/worktrees/routine-…/`, introduced by `a9eb1f6a` earlier today to fix the
permission stall), that is just over the Windows 32,767-char command-line limit. `spawnSync` fails
with ENAMETOOLONG, `status` is `null`, and the runner reports `?? 1` silently. Every routine that
follows the new worktree rule would read an all-green suite as a failure.

This run wrote the same fix (relative paths + print `res.error`), but on rebase `origin/main` already
carried it: `66687345` (RUN-TESTS-CMDLINE-001), pushed by a parallel session during this run. Kept
upstream's version and dropped this run's. Suite with the relative-path fix: **2113/2113 pass, exit 0**
from the same worktree.

## 6. Owner calls surfaced (not taken)

1. **D1 write (§2)** — now 23 days owed. Every claude call keeps logging 1.5x until it lands.
2. **Deploy ×3 (§4)** for this run's keys.
3. **`analysis` role pin.** Five reports, same order, anthropic 7–60x the cost of the alternatives
   on `parse_jd`. The `--activation-min-calls 30` floor will not be reached at four sessions a
   month. Options: lower the floor for `analysis` only, or pin `analysis → mistral` by owner call
   (mistral is ok=100% on n=5 over 30 d). Not a writer/gen role, so not gated by that rule, but it
   fails the tune's own sample guardrail, so not applied here.
4. **Adopt `claude-opus-5-5`?** [4,20] is cheaper than the current flagship pin `claude-opus-4-8`
   [5,25] (−20%) and it is the newer model. The 09-06 `thinking:{type:"disabled"}` caveat (Fable 400s on
   it; Opus 5 accepts it at effort ≤ high) has to be re-checked for 5.5 before a swap. Owner-gated gen pin.
5. Data path: the D1 MCP connector is not reachable from this desktop session. This run used logged-in
   wrangler, which `66687345` has since written into `SCHEDULED_ROUTINES.md` STANDING RULE 0 as the approved
   fallback. The scheduled-task prompt still names only the MCP connector; worth aligning.

---

# Owner follow-up 2026-09-29/30 — OPUS55-ADOPT-001 (all four §6 calls taken)

Owner, same evening: run the D1 insert, redeploy the three workers, pin `analysis`, adopt
`claude-opus-5-5`. Shift lane `1.51.4666-1.51.4685`, worktree `.claude/worktrees/opus55-adopt`.

**D1 (§2) — APPLIED.** `wrangler d1 execute ant_memory --remote`: 6 rows, `changes:6`. Superseding
rows for `claude-sonnet-5` [2,10], `claude-opus-5` [5,25], `claude-fable-5` / `-5-1` [10,50],
`gpt-5.5` [5,30], and `claude-opus-5-5` [4,20] (`effective_from` 2026-09-29) so the new pin is priced
even before the relay redeploy. Verified by SELECT: each model's newest row is the corrected one. The first
attempt returned `Authentication error [code: 10000]` (expired OAuth access token; the token scope does
include `d1 (write)`). `wrangler whoami` refreshed it and the retry succeeded.

**`analysis` → mistral — APPLIED** in `workers/proxy/wrangler.toml` + `workers/demo-proxy/wrangler.toml`.
`roleHeadOrder(analysis)` = `[mistral, anthropic, openai, gemini]`; anthropic stays in the tail.
**Rollback:** `MODEL_ROLES = '{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`.

**`claude-opus-5-5` adopted.** The four PWA gen-pin sites (`callClaude` body, the provider ping, its
default arm, the Settings worker test) `claude-opus-4-8` → `claude-opus-5-5` in `app.js` + `app.src.js`.
Proxy cascade: `claude-opus-5-5` inserted ahead of `claude-opus-4-8` (4-8 kept as the next fallback;
`claude-sonnet-5` still heads). Opus 5.5 differs from 4.8 in ways that would have broken AntCV. Fixed in
both proxies before the swap:

1. **Thinking cannot be disabled** (`{type:"disabled"}` and `budget_tokens` → 400). The PWA sends no
   `thinking`, so its calls run adaptive at Opus 5.5's default effort `medium` (4.8 ran with no thinking;
   expect somewhat higher latency and output tokens per call). The cascade `callAnthropic` now sends
   `output_config:{effort:"low"}` to the always-thinking models so its fixed 8000 `max_tokens` still covers the JSON.
2. **`content[0]` is the thinking block.** `callAnthropic` and `byok-qualify` read `content[0].text`, which
   would have logged every Opus 5.5 call as `empty content`. They now join the `text` blocks (`anthropicText`).
   The PWA was already safe (stream keeps only `text_delta`; JSON path joins `.text`).
3. **Latent bug:** the Sonnet-5 guard `/claude-sonnet-5/` (cascade + pass-through) also matched
   `claude-sonnet-5-5`, which 400s on `thinking:disabled`. Now `/claude-sonnet-5(?![-.]?\d)/`. The
   always-thinking set `/claude-(opus-5-5|sonnet-5-5|fable-5|mythos-5)/` also gets sampling params stripped
   in the pass-through, since those 400 too.

Cache-bust `1.51.4666-opus55-adopt`: every `index.html` stamp that was on `1.51.4646-linear-length` (11,
including `app.js?v`, the `ANTCV_VERSION` seed, version-override, docx-client, copenhagen, pdf-preview-gate),
`sw.js` CACHE, `TARGET_VERSION`, with `1.51.4646-linear-length` added to `STALE_VERSIONS`.

**Tests:** freshness 30/30 ×2 (+4: cascade order, thinking regexes, `anthropicText`, pass-through guard);
relay mirror 8/8 (`claude-opus-5-5` in the live list); full suite **2127/2127**; boot smoke
`glDemo=function, errors=0`; `app.js` head `(()=>{`, 0 `"use strict"`.

**Not verified live:** no Anthropic key on this machine, so no real Opus 5.5 call was made. First real
generation after deploy is the check: watch `llm_calls` for `model='claude-opus-5-5'` with `success=1`.

**Live verification 2026-09-30 (owner saved `~/.antcv/keys.env`).** `claude-opus-5-5` with the exact
`callClaude` body shape (model, max_tokens, system, messages, no `thinking`): HTTP 200, `end_turn`,
4.1 s, blocks `thinking,text`, 62 in / 123 out. `content[0].text` = `null`, which confirms that the
`anthropicText` fix was required; the old code would have logged every call as `empty content`. The same
model through the deployed `cv-proxy` pass-through (Settings "test worker" shape): HTTP 200, SSE, and the
app's `text_delta` parser receives the answer. OpenAI, Mistral, Gemini and the demo Anthropic key all
return 200 on `/models`. Rollback no longer expected.

---

# Desktop cross-check 2026-10-01 (scheduled, Opus 5.5)

Duplicate-run check found this report (2 days old), so this run did steps 1a + 1b only. No scoring,
no flip proposal. Worktree `~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mup66ugi` off
`origin/main` `9bc60c8c`; the shared clone was dirty. No `pwa/` asset changed, so no shift lane and no
version number.

**`MODEL_ROLES` unchanged** (`analysis`→mistral from the owner follow-up stands). Rollback value:
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`.

## 1a — pins GREEN; two new Gemini ids priced (GEMINI36-37-RATES-2026-10-001)

Fetched 2026-10-01: platform.claude.com pricing.md, developers.openai.com pricing, mistral.ai/pricing,
ai.google.dev pricing. Every pin verifies: `claude-sonnet-5` [2,10] (the note still says the $3/$15
rise will not occur), `claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20] (now the gen
pin), `claude-fable-5` / `-5-1` [10,50], `claude-haiku-4-5` [1,5], `gpt-5.4-mini` [0.75,4.5], `gpt-5.5`
[5,30], `mistral-large` [0.5,1.5], `gemini-2.5-flash` [0.3,2.5]. All 35 vendor ids checked through
`rateForStrict()` resolve to the vendor number, except two.

**RED:** `gemini-3.7-flash` and `gemini-3.6-flash` are new on the Gemini page at [0.75,3.75]
(promotional through 2026-12-31, same as 3.8-flash). Neither contained a key: `rateFor()` gave
FALLBACK [3,15] (4x OVER in and out), `rateForStrict()` gave `null`. Added to all three mirrors with a
dated comment. Mirrors still byte-identical above the END-OF-MIRROR line. Tests: freshness +2 → 32/32
in proxy and demo-proxy (files identical); relay mirror +1 → 9/9. A new assert keeps both ids out of
the default gemini cascade.

No new Anthropic, OpenAI or Mistral ids since 09-29. Still deferred to a full audit (not new, not
pins, no traffic): `gpt-5.2` [1.75,14], `gpt-5.2-pro` [21,168], `gpt-5-pro` [15,120], `gpt-5-nano`
[0.05,0.4] all resolve to the shorter `gpt-5` key [1.25,10].

## 1b — D1 reconciles; PWA `C` map does not match the new gen pin

(i) `llm_provider_costs` (SELECT, `changed_db:false`): every model's newest row equals the audited
rate. The 09-29 superseding INSERT is live. No row exists for any Gemini 3.x id, so those price from
the relay table.

(iii) 7-day `llm_calls`: **18 calls, the same 2026-09-28 session the 09-29 report scored. No LLM
traffic since.** Stored $0.355345 vs recomputed $0.273131 (1.301x), all on the single pre-fix claude
`parse_jd` call. Every other row reconciles to the cent. The D1 fix cannot be confirmed on a new call
until traffic arrives. Likewise no `claude-opus-5-5` call is in telemetry yet; the first one is the
check (see also row 114: `/job/*` gens write no `llm_calls`).

(ii) **Finding, not fixed (PWA-COST-METER-OPUS55-001).** The `C` map prices `anthropic` and `claude`
at [2,10], the sonnet-5 rate. The PWA dispatcher sends provider `claude` to `q()` (`app.src.js:1811`),
whose body pins `claude-opus-5-5` [4,20] since `1.51.4666`, and meters it with `C.claude`
(`app.src.js:3251`). When the call is served as opus-5-5, the client per-generation meter
(GEN-COST-CEILING-001) and the client-reported `cost_usd` are 2x low. The 09-28 calls on this
provider logged `claude-sonnet-5`, so the served model depends on the proxy path; the first
post-adoption telemetry row will show which. Server telemetry is NOT affected: it prices from D1, then
the relay table, and uses the client number only on a miss. Tune scores are unaffected. Fix for the
owner: meter by the returned model id instead of the provider. That is an `app.js` + `app.src.js`
change with the full cache-bust set in a shift lane, so it was not done in a cross-check run.

## Owed

- **Deploy ×3** (`proxy`, `demo-proxy`, `access-relay`) for the two Gemini keys. Left OWED: neither id
  has traffic or is in a cascade, so nothing in production is mispriced today.
- Owner call on PWA-COST-METER-OPUS55-001 above.
