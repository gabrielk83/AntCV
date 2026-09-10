# RELAY-COST-QUALITY-TUNE — desktop freshness pass 2026-09-06 (ANTHROPIC-RATES-2026-09-001)

Owner-directed desktop run (Fable 5.1, shift lane `1.51.4486-1.51.4505`, isolated worktree off
`origin/main` `b2a804b1`). Two asks: (1) let the weekly tune run on this desktop as well; (2) the
Anthropic 5-generation models are out and the price tables never learned them.

This is the **step 1a + 1b half** of RELAY-COST-QUALITY-TUNE-001, not a scoring run. No
`MODEL_ROLES` proposal was made; the next scheduled run (Wed 2026-09-09 22:00, now also on this
desktop) scores on a corrected table. **`MODEL_ROLES` unchanged, rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`.

## 1. Trigger — the tune now fires from this desktop too

`C:\Users\Karpg\.claude\scheduled-tasks\` did not exist on this machine: none of the routines in
`SCHEDULED_ROUTINES.md` had a local trigger here, and `ROUTINE_HEALTH.jsonl` had no entries. The
08-12 and 08-19 dispatches were missed (ROUTINE-MISSED-DISPATCH-2026-08), which is the redundancy
case. Created `antcv-relay-cost-quality-tune` here, Wed 22:00 local, prompt pointing at
`SCHEDULED_ROUTINES.md` as the authority, with three desktop-specific additions:

- **duplicate-run check** — a same-week `COST_QUALITY_WEEKLY_*.md` already on `main` turns the run
  into a cross-check (1a + 1b only, appended to the existing report), so two triggers never propose
  two flips;
- **data path** — no `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` env and no `~/.antcv/token` on this
  machine, so the live `/api/llm-health` path is unavailable; the D1 MCP connector (`ant_memory`
  `499c3de9…`) is, and was proven read-only in this session. The prompt spells out the raw
  `llm_calls` → health-snapshot → `--data` method of the 08-26 run;
- **the Anthropic pin list** (below) so the audit checks the 5-generation ids from now on.

## 2. Step 1a — model-table freshness audit: RED, fixed

Verified 2026-09-06 against `platform.claude.com/docs/en/about-claude/pricing.md` (fetched, not
recalled). Two findings, both in all three byte-identical `RATES` mirrors:

| id | table said | vendor says | mechanism | skew |
|---|---|---|---|---|
| `claude-sonnet-5` | [3, 15] | **[2, 10]** | comment assumed the launch price would end 2026-08-31 and "standard $3/$15" would follow; Anthropic **cancelled** the rise (pricing-page note `claude-sonnet-5-introductory-pricing`) | **1.5x OVER** on every sonnet-5 call and on the demo cap |
| `claude-opus-5` | — | [5, 25] | no key; shares no prefix with a legacy entry, so `rateFor()` → `FALLBACK_RATE` [3,15], `rateForStrict()` → `null` | 1.67x UNDER |
| `claude-fable-5-1` | — | [10, 50] | same fall-through to [3,15] | 3.3x UNDER |
| `claude-fable-5` | — | [10, 50] | same | 3.3x UNDER |

`claude-opus-4-8` [5,25] and `claude-haiku-4-5` [1,5] re-verified correct. The OpenAI / Mistral /
Gemini rows were verified on 2026-08-20 and are not re-checked here.

**Fix shipped (`1.51.4486-anthropic-rates`):**

- the three mirrors (`workers/proxy/src/demo-enforcement.js`, `workers/demo-proxy/src/demo-enforcement.js`,
  `workers/access-relay/src/model-rates.js`) gain `claude-fable-5-1`, `claude-fable-5`, `claude-opus-5`
  with dated comments, and `claude-sonnet-5` → [2,10]; `fable-5-1` deliberately sits above `fable-5`
  (longest-key-wins) so a future price split cannot land on the shorter key;
- `model-table-freshness.test.mjs` (proxy + demo-proxy, identical): sonnet-5 pin re-pointed, +3 tests
  (opus-5, fable-5-1, fable-5 presence guard) — **13/13 each** (was 10/10);
- `pwa/test/relay-model-rates-mirror.test.mjs`: sonnet-5 pin re-pointed, +1 "priced ahead of
  adoption" test for the three new ids;
- **PWA `C` map** (`pwa/app.js` + `app.src.js`): `anthropic` and `claude` 3/15 → **2/10**, because
  `llm-cost-provider-rates.test.mjs` pins the client meter to `rateFor(<pinned model>)` and the cost
  router (RELAY-COST-TIEBREAK-001) reads the client number. Ship set as `1.51.4346-cost-rates`:
  `app.js?v`, `ANTCV_VERSION` seed, `antcv-version-override.js?v` + `TARGET_VERSION` (+
  `1.51.4446-content-lang-stamp` into `STALE_VERSIONS`), `antcv-docx-client.js?v`,
  `antcv-copenhagen-v2-001.js?v`, `antcv-pdf-preview-gate.js?v`, `sw.js` CACHE.

**Not changed, on purpose:** `PROVIDER_MODELS.anthropic` (the DEFAULT cascade) does not gain
`claude-opus-5` / `claude-fable-*`. Heading the cascade with a new model is a routing decision — the
same class as the `gpt-5.5` non-gap pinned on 2026-08-20 — and `callAnthropic()` sends
`thinking:{type:"disabled"}` only for `/claude-sonnet-5/`; Opus 5 accepts that at effort ≤ high, Fable
5.x returns 400 on it. Pricing them is what makes a BYOK or `opts.models` override call meter
correctly today; adopting them is an owner call (see §6).

**Verification:** `node scripts/run-tests.mjs` **2012/2012** (7 skipped, 0 fail); boot smoke
`glDemo=function, errors=0`; `app.js` head `(()=>{`, 0 `"use strict"`; the three mirrors re-proven
byte-identical by the mirror test.

## 3. Step 1b — cost-source audit: D1 override row is now WRONG (owner-gated)

`llm_provider_costs` (read-only via D1 MCP) carries `('claude','claude-sonnet-5', 3, 15,
effective_from 1787184000 = 2026-08-20)`. That row matches by **exact** `(provider, model)` and
**wins** over the corrected relay table — the precise mechanism of COST-SOURCE-AUDIT-GAP-001. Until
it is superseded, every sonnet-5 call keeps logging at 1.5x. No row exists for the three new ids, so
those fall through to the (now correct) relay table.

A production D1 write is owner-gated. The exact statement, `effective_from` = 2026-09-06 00:00 UTC:

```sql
INSERT INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('claude', 'claude-sonnet-5',  2, 10, 1788652800),
  ('claude', 'claude-opus-5',    5, 25, 1788652800),
  ('claude', 'claude-fable-5',  10, 50, 1788652800),
  ('claude', 'claude-fable-5-1',10, 50, 1788652800);
```

(Superseding, not deleting, is the convention the 08-20 correction used.)

**Good news in the same table:** the newest `gemini/parse_jd` call (2026-09-06 11:38) logged
$0.0221 against a recomputed $0.0221 at the audited [0.3, 2.5] — the first live evidence that the
08-20 D1 correction prices real calls. COST-SOURCE-AUDIT-GAP-001's "unverified against live traffic"
caveat from the 08-26 report is now partly answered (gemini yes; claude/mistral not exercised).

## 4. Traffic snapshot (30 d to 2026-09-06, raw `llm_calls`, cost recomputed at audited rates)

| provider / model | task | n | logged $ | recomputed $ | skew | last call |
|---|---|---|---|---|---|---|
| gemini / gemini-2.5-flash | compress | 128 | 0.0111 | 0.0619 | 0.18x | 08-30 |
| claude / claude-sonnet-5 | compress | 124 | 4.8012 | **1.0521** | **4.56x** | **08-18** |
| openai / gpt-5.4-mini | compress | 124 | 0.2904 | 0.2904 | 1.00x | 08-18 |
| mistral / mistral-large-latest | compress | 92 | 0.8276 | 0.1379 | 6.00x | 08-18 |
| gemini / gemini-2.5-flash | consensus_poll | 6 | 0.0014 | 0.0036 | 0.39x | 08-30 |
| mistral / mistral-large-latest | consensus_poll | 6 | 0.0591 | 0.0126 | 4.69x | 08-30 |
| mistral / mistral-large-latest | parse_jd | 5 | 0.5850 | 0.1185 | 4.94x | 08-30 |
| openai / gpt-5.4-mini | analyze_fit | 5 | 0.0138 | 0.0138 | 1.00x | 08-19 |
| openai / gpt-5.4-mini | consensus_poll | 5 | 0.0160 | 0.0160 | 1.00x | 08-30 |
| openai / gpt-5.4-mini | apply_correction | 4 | 0.0620 | 0.0620 | 1.00x | 08-19 |
| openai / gpt-5.4-mini | consensus_reinforce | 3 | 0.0130 | 0.0130 | 1.00x | 08-18 |
| gemini / gemini-2.5-flash | parse_jd | 2 | 0.0221 | 0.0221 | 1.00x | **09-06** |
| openai / gpt-5.4-mini | fuse | 2 | 0.0112 | 0.0112 | 1.00x | 08-18 |
| **TOTAL** | | **506** | **6.71** | **1.82** | **3.7x** | |

The claude skew grew from 3.04x (08-26 report) to 4.56x only because the *true* rate dropped to
[2,10]; the logged number is the same 10/30 fallback as before. The claude compress leg is still the
largest single spend — **$1.05 of $1.82 (58%)** — but at the correct price it is 24x, not 36x, the
gemini leg per call.

**Observation, not a bug filing — CLAUDE HAS NOT BEEN CALLED SINCE 2026-08-18.** Every task with
traffic after the 08-19/08-20 cost fixes (`compress`, `consensus_poll`, `parse_jd`) ran on gemini,
mistral or openai only. The 08-18 burst was a gen-runner batch (all four providers); interactive
traffic since then has not reached the claude leg once. Either the client `ee()` ladder / the cost
tiebreak is still demoting anthropic (on what number?), or the traffic simply did not need it. The
next scoring run must look at this before trusting any "anthropic n=0 → keep" line: a head that is
never called cannot be measured.

## 5. Owed

- **Worker deploys ×3:** `proxy`, `demo-proxy`, `access-relay` via `deploy.yml` (one at a time), then
  each `/health` — the rate tables only take effect when deployed. PWA auto-deploys on push.
- **D1 write** (§3 SQL) — owner.
- **Owner's `JOBLIST-FILTER-003` WIP** in the shared clone (uncommitted at this run, stamped
  `1.51.4466-joblist-progress-filter`, lane `1.51.4466-1.51.4485`) touches the same cache-bust lines
  and the top of `ACTIVE_BUGS.md`. It must rebase onto this commit and keep the HIGHER stamps for the
  shared files (`sw.js` CACHE, `TARGET_VERSION`, `antcv-version-override.js?v`) — its own `?v` bumps
  are on files this run did not touch (`antcv-react-islands.js`).

## 6. Owner calls surfaced (not taken)

1. **Adopt `claude-opus-5`?** Drop-in successor to `opus-4-8` at the same [5,25], thinking on by
   default. The PWA thorough-gen pin (`app.src.js` ~1832 / 33962 / 36768) and the cascade line are the
   two sites. A pin change re-runs `llm-cost-provider-rates.test.mjs` automatically (it reads the
   pinned model out of the bundle). Not a tune-loop lever; a gen-role change is owner-gated by rule.
2. **`analysis` role** (fourth run running: openai best, blocked by `--min-calls 20`) — carried
   unchanged from 08-26.
3. **The claude silence** (§4) — decide whether it is expected.

---

# Desktop cross-check 2026-09-10 (scheduled run, RELAY-COST-QUALITY-TUNE-001)

Scheduled desktop trigger fired 2026-09-10. The duplicate-run check found this report already on
`main` (committed 09-06, inside the 6-day window), so the run degraded to **cross-check only**:
re-run step 1a (freshness) + step 1b (cost-source audit), append here, propose no second flip.
Shared clone was DIRTY (owner WIP), so all work ran in an isolated worktree off `origin/main`
`afbfc8a4`. Shift lane `1.51.4546-1.51.4565` claimed and released **without consuming a version
number** — nothing under `pwa/` that needs a cache-bust was touched.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`.

## A. Step 1a re-run — the 09-06 fixes hold; four vendors had moved again

Every id the 09-06 pass corrected still verifies against the vendor page today:
`claude-sonnet-5` [2,10] (the introductory-pricing note is still live — the $3/$15 rise is still
cancelled), `claude-opus-5` [5,25], `claude-opus-4-8` [5,25], `claude-fable-5` / `-5-1` [10,50],
`claude-haiku-4-5` [1,5], `gpt-5.4-mini` [0.75,4.5], `mistral-large` [0.5,1.5],
`gemini-2.5-flash` [0.3,2.5], `gemini-2.5-flash-lite` [0.1,0.4]. **No regression.**

The audit was **RED on nine other ids** — one wrong, eight missing. All nine are now fixed in the
three RATES mirrors (`workers/proxy/src/demo-enforcement.js`, `workers/demo-proxy/src/demo-enforcement.js`,
`workers/access-relay/src/model-rates.js`), per 1a's "required modification, not optional" clause.

### A1. `gpt-5.5` was [30,60]; the vendor says **[5,30]** — GPT55-RATE-2026-09-001

developers.openai.com/api/docs/pricing lists `gpt-5.5` (<272K context) at **$5.00 in / $30.00 out**.
The table has carried [30,60] since 2026-07 — a **6x OVER-price on input** against the demo cap.

This is 1a-bis(iii) landing a second time, and worse than the first. The number survived every
freshness pass since July because **`model-table-freshness.test.mjs` asserted the table's own
value**, so table and test agreed with each other and disagreed with the vendor. A pin test that
copies the table cannot detect a stale table; only the vendor fetch can. Both the 09-06 sonnet-5
error and this one have that shape.

Corrected in all three mirrors and in **three** test sites (the third is the one the full-suite run
caught): `workers/proxy/test/model-table-freshness.test.mjs` ×2 (the rate pin and the
cascade-invariant test), `workers/demo-proxy/test/` mirror, and
`pwa/test/relay-model-rates-mirror.test.mjs:73`. `gpt-5.5` stays OUT of `PROVIDER_MODELS` — 1a-bis(ii)
is untouched; only the price moved.

### A2. Eight new model ids, none priced — and "missing" is never inert

| id | resolved to (before) | real rate | error |
|---|---|---|---|
| `claude-mythos-5-1` | FALLBACK [3,15] | [10,50] | 3.3x UNDER |
| `claude-mythos-5` | FALLBACK [3,15] | [10,50] | 3.3x UNDER |
| `gpt-6-astra` | FALLBACK [3,15] | [10,50] | 3.3x UNDER |
| `gpt-5.6-sol` | `gpt-5` [1.25,10] | [4,20] | 3.2x UNDER in |
| `gpt-5.6-terra` | `gpt-5` [1.25,10] | [2,12] | 1.6x UNDER in |
| `gpt-5.6-luna` | `gpt-5` [1.25,10] | [0.20,1.20] | **6.25x OVER in** |
| `gemini-3.8-flash` | FALLBACK [3,15] | [0.75,3.75] | **4x OVER** |
| `gemini-3.5-flash` | FALLBACK [3,15] | [1.50,9.00] | 2x OVER |

Both directions matter (1a-bis(iv)): an UNDER-price hides demo-cap burn, an OVER-price **demotes the
provider in this very tune**. `gemini-3.8-flash` is the sharp one — Gemini leads the cheap tasks on
price, and a 4x phantom rate is exactly the LLM-COST-GEMINI-RECONCILE-001 failure mode again.

Two ordering invariants added with the keys, both the same shape as the existing Fable and
Flash-Lite guards: `claude-mythos-5-1` must stay longer than `claude-mythos-5`, and the whole
`gpt-5.6`/`gpt-6` block must stay longer than `gpt-5`. Verified: 19/19 `rateFor()` resolutions
correct after the edit, including that `gpt-5`, `gemini-2.5-flash` and `mistral-large-latest` are
undisturbed. `gemini-3.8-flash`'s [0.75,3.75] is **promotional through 2026-12-31 and rises to
[1.50,7.50] on 2027-01-01** — a test now pins the presence of that dated note, so the first tune of
2027 has to re-verify it rather than inherit it.

Pricing is not adoption: `PROVIDER_MODELS` is unchanged for every one of the eight (1a-bis(ii)).
They are priced so a BYOK or explicit `opts.models` call meters correctly instead of guessing.

## B. Step 1b re-run — the 09-06 D1 write is STILL OWED, and is still wrong by exactly 1.5x

`llm_provider_costs` re-listed today. **The superseding INSERT from 09-06 §3 has not been applied.**
The 2026-08-20 row `('claude','claude-sonnet-5',3,15)` is still the newest and still wins over the
corrected mirrors, exactly as predicted.

Proof from this week's raw `llm_calls` (7d, 28 calls), recomputing every cost from raw tokens at the
audited rates per 1b(iii):

| task | provider | n | stored | recomputed | ratio |
|---|---|---|---|---|---|
| compress | gemini | 4 | $0.009415 | $0.009415 | 1.0000 |
| consensus_poll | gemini | 4 | $0.003571 | $0.003571 | 1.0000 |
| consensus_poll | mistral | 4 | $0.009494 | $0.009494 | 1.0000 |
| consensus_poll | openai | 4 | $0.013866 | $0.013867 | 1.0000 |
| consensus_reinforce | openai | 3 | $0.018877 | $0.018877 | 1.0000 |
| parse_jd | **claude** | 3 | **$0.779271** | **$0.519514** | **1.5000** |
| parse_jd | gemini | 3 | $0.030823 | $0.030823 | 1.0000 |
| parse_jd | mistral | 3 | $0.071677 | $0.071677 | 1.0000 |
| **TOTAL** | | **28** | **$0.936994** | **$0.677238** | **1.384** |

165,677 in + 18,816 out at [3,15] = $0.779271 — the stored number to six decimals. At the true
[2,10] it is $0.519514. Every other provider reconciles to the cent, so the mirrors and the PWA `C`
map are correct and D1 is the single wrong source. The week over-reports **$0.2598 (38.4%)**, all of
it on claude, on the role claude leads.

Step 1b(ii) reconciles: the `C` map in `pwa/app.src.js` prices anthropic/claude [2,10], openai
[0.75,4.5], mistral [0.5,1.5], gemini [0.3,2.5] — all equal to the audited worker RATES. Nothing to
change there, which is why this run consumed no version number.

**Still owed, unchanged from 09-06 (owner-gated):**

```sql
INSERT INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('claude', 'claude-sonnet-5',  2, 10, 1788652800),
  ('claude', 'claude-opus-5',    5, 25, 1788652800),
  ('claude', 'claude-fable-5',  10, 50, 1788652800),
  ('claude', 'claude-fable-5-1',10, 50, 1788652800);
```

`openai/gpt-5.5` also has a D1 row at the wrong [30,60]. It has no traffic, so it corrupts nothing
today, but it will the first time a thorough-tier call lands. Add to the same owner-gated write:

```sql
INSERT INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('openai', 'gpt-5.5', 5, 30, 1788998400);
```

## C. Scoring — run for confirmation only, no flip

`relay-cost-quality-tune.mjs --data` on the recomputed snapshot: **no change**, every role kept.
Nothing clears `--min-calls 20` (best sample n=4). `analysis`: gemini cq=97.3 · mistral cq=41.9 ·
anthropic cq=5.8, all ok=100%, all n=3 — the same ordering as 08-26 and 09-06, still below the
activation floor. Consistent with the cross-check mandate; no second flip proposed.

**The claude-silence observation from §4 above is now partly answered.** Claude *was* called this
week — 3 `parse_jd` calls, first traffic since 2026-08-18. So the leg is reachable; it was traffic
shape, not a permanent demotion. It is still the most expensive leg by far ($0.52 of $0.68 true
spend, 77%, on 3 of 28 calls), and its cost is still the one number D1 inflates.

## D. Tests

`node scripts/run-tests.mjs`: **2073 tests, 2066 pass, 0 fail** (exit 0). The two
`model-table-freshness` suites are 20/20 each (was 15). `pwa/test/relay-model-rates-mirror.test.mjs`
7/7 — it caught the third `gpt-5.5` pin site that the two worker suites did not cover. No `pwa/app.js`
change, so no boot smoke was required.

## E. Owed after this run

- **Worker deploys ×3** — `proxy`, `demo-proxy`, `access-relay` via `deploy.yml`, one at a time,
  then each `/health`. **This now covers both the 09-06 rate fixes and this run's** — the 09-06 report
  listed the same three deploys as owed and `llm_provider_costs`/telemetry evidence suggests they were
  never run. Left OWED here rather than fired blind, per the routine's guardrail.
- **D1 write** (§B, both statements) — owner.
- **First tune of 2027:** re-verify `gemini-3.8-flash`; its promotional rate doubles 2027-01-01.

## F. Owner calls surfaced (not taken)

1. Carried from 09-06: adopt `claude-opus-5`; the `analysis` role activation floor.
2. **New — the pin tests copy the table.** Both stale-price defects found in two weeks
   (`claude-sonnet-5`, `gpt-5.5`) were invisible to `model-table-freshness.test.mjs` because the test
   asserted the same literal the table held. The test guards *renames and substring collisions*, which
   it does well; it cannot guard *prices*. Only the weekly vendor fetch can, and it is a manual step in
   a routine that runs at most weekly. Worth deciding whether the vendor diff should be its own cheap
   scheduled check rather than a step inside this one.
