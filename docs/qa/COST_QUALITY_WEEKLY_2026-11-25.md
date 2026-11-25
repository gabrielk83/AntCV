# RELAY-COST-QUALITY-TUNE — weekly run 2026-11-25 (desktop, scheduled)

Scheduled desktop trigger (Gabo-PC), Opus 5.5. Shared clone was DIRTY (owner WIP in `package.json`
+ `workers/access-relay/` + an untracked DAMC doc), so all work ran in the isolated worktree
`~/antcv-worktrees/routine-antcv-relay-cost-quality-tune-mwwm8pnh` off `origin/main` `ae2b99f0`.
Duplicate-run check: no `COST_QUALITY_WEEKLY` file in the last 6 days (newest 2026-11-19) → full run.

Shift lane 1.51.6685-1.51.6704 (the PWA cost map changed). One version used: `1.51.6685-mistral-large4`.

**`MODEL_ROLES` unchanged. Rollback value unchanged:**
`'{"writer":"anthropic","supervisor":"mistral","coherence":"openai","analysis":"mistral"}'`
(the `analysis`→mistral pin's own rollback is `'{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`).

**Headline: a live pin changed model.** `mistral-large-latest` now aliases Mistral Large 4, not Large 3.
Same id, +40% price. Fixed in code. One D1 row is owner-gated (§2).

## 0. Data path + preflight notes

Preflight: token OK (expires 2026-12-02T19:10Z, 6.9 d left). Dispatch gap 6.2 d: weekly cadence, no fire missed.

No `ANTCV_ADMIN_TOKEN` / `ANTCV_RELAY_URL` and no D1 MCP connector. D1 read with wrangler from the shared
clone's `workers/access-relay` (`SELECT` only): raw `llm_calls` 30 d (188 rows) and `llm_provider_costs`
(34 rows). Snapshot per (provider, task), costs recomputed from tokens, then `relay-cost-quality-tune.mjs --data`.

Vendor pages were fetched with `curl` (no WebFetch tool in this session): raw text, complete, no summarizer. That closes the
truncation the 11-19 run reported (Anthropic 40 k of 56 k, Gemini 80 k of 116 k).

## 1. Step 1a — freshness audit: one live pin RED, one new id; both fixed

Pages: `platform.claude.com/docs/en/about-claude/pricing.md`, `developers.openai.com/api/docs/pricing.md`,
`docs.mistral.ai/inference/pricing`, `ai.google.dev/gemini-api/docs/pricing` (→ `aistudio.google.com/docs/pricing.md`).
Plus Mistral `GET /v1/models` (read-only, owner key). 114 ids diffed mechanically against `rateForStrict()`
(relay) and `rateFor()` (proxy).

| id | resolved to (before) | vendor 2026-11-25 | error | ticket |
|---|---|---|---|---|
| `mistral-large-latest` (**LIVE PIN**, cascade head) | `mistral-large` [0.5,1.5] | [0.70,2.10] (Large 4) | 1.4x UNDER | MISTRAL-LATEST-LARGE4-001 |
| `glm-5-latest` (alias of `zai-glm-5-3`) | FALLBACK [3,15], strict `null` | [1.40,4.40] | 2.1x OVER in, 3.4x OVER out | GLM5-LATEST-RATE-2026-11-001 |

**MISTRAL-LATEST-LARGE4-001, evidence.** `/v1/models` 2026-11-25 lists `mistral-large-latest` under
`mistral-large-4`; `mistral-large-2512` has no alias left. The 11-05 probe had it on `mistral-large-2512`.
**The 11-12 and 11-19 runs did not probe** ("no new Mistral model this week"), so the switch date is only
known as 11-05 < date ≤ 11-25. An alias can move with no new model on the page. `SCHEDULED_ROUTINES.md`
step 1a-quinquies now makes the probe unconditional. Large 3 and Medium 3.5 are gone from the pricing page;
the models page lists both deprecated 06/09/2026, retiring 05/03/2027 (day-first, inferred from neighbouring
`00/04/2026` entries), replacement Large 4. Their keys stay for explicit-id calls.

Changed: explicit `mistral-large-latest` key in all three mirrors (the two `demo-enforcement.js` copies stay
byte-identical); PWA `C.mistral` [0.5,1.5] → [0.7,2.1] in `app.js` (3 bytes) and `app.src.js`, with the app.js
lockstep cache-bust set. `pwa/test/llm-cost-provider-rates.test.mjs` ties the two.

**Pins verify:** `claude-sonnet-5` [2,10], `claude-opus-4-8` / `claude-opus-5` [5,25], `claude-opus-5-5` [4,20]
(gen pin), `claude-fable-5` / `-5-1` [10,50], `-5-2` [8,40], `claude-haiku-4-5` [1,5]; `gpt-5.4-mini` [0.75,4.5],
`gpt-5.5` [5,30]; `gemini-2.5-flash` [0.3,2.5]. Anthropic lists no model newer than Fable 5.2 / Opus 5.5 /
Sonnet 5.5 / Haiku 5.5. `mistral-large-4` holds at [0.70,2.10] (fourth week).

**New ids already right, now pinned by test:** OpenAI `gpt-6.2-astra-healthcare` [8,40], `gpt-6.2-sol-healthcare`
[2,10], `gpt-6-astra-healthcare` [10,50], `gpt-6.1-sol-healthcare` [2,10] (each resolves through its base key);
`gemini-omni-1.2-flash` text [1.5,9] through `gemini-omni`.

Tests: freshness **52/52** each (was 50; `VENDOR_CATALOGUE_2026_11_25` added); relay mirror **17/17** (was 16);
`run-tests.mjs` ALL PASS; boot smoke `glDemo=function, errors=0`. The catalogue rows for `mistral-large-latest`
moved to the new vendor rate: a vendor change, not a trim.

**Left unkeyed by rule:** OpenAI image / realtime / audio / live / TTS / transcribe / embedding / moderation;
Mistral OCR, embed, Voxtral, moderation, Timestral, Shieldstral; Gemini live-translate, transcribe, TTS, image
(incl. new Nano Banana 2.1), Genie 4, Omni video, embedding, robotics, Lyria, Decision.

**Dated vendor changes ahead:**
- **2026-11-30:** `gpt-5.6-sol` promo ends; the page gives no post-promo number.
- **2026-12-01, Google:** `gemini-2.5-flash` routes to `gemini-3.5-flash-lite` ([0.30,2.50], same as today) and
  `gemini-2.5-pro` to `gemini-3.8-flash` ([0.75,3.75]). Both now read verbatim. **This is the last scheduled tune before the
  switch** (next Wed is 12-02). Our gemini pin changes model with no code change; the billed rate does not move.
- **2026-12-01:** `gemini-4-argon` and `gemini-4-carbon` double to [4,20]. Re-key at the 12-02 tune, with `gemini-2.5-pro`.
- **2026-12-03:** `gemini-omni-1.1-flash` routes to 1.2 (covered by the `gemini-omni` key).
- **2026-12-31:** GPT-6 Rosalind, the two -law and four -healthcare configurations: promo "at least through" this date.
- **2027-01-01:** Gemini 3.6 / 3.8 Flash double to [1.50,7.50].

## 2. Step 1b — cost-source audit: one D1 row now wrong, owner-gated

(i) `llm_provider_costs` (34 rows, unchanged): `gpt-5.4-mini` and `gemini-2.5-flash` match the audited rate.
**`('mistral','mistral-large-latest',0.5,1.5)` is now wrong and wins over the corrected table** (telemetry reads
D1 before `model-rates.js`). Until it is superseded, every mistral call is logged 1.4x under. **Owner, run:**

```sql
INSERT INTO llm_provider_costs (provider, model, prompt_cost_per_1m_tokens, completion_cost_per_1m_tokens, effective_from) VALUES
  ('mistral', 'mistral-large-latest', 0.70, 2.10, 1795564800); -- 2026-11-25T00:00Z, MISTRAL-LATEST-LARGE4-001
```

Not applied by this run (a production write to this table is owner-gated). Same superseding convention as 08-20 and 09-06.

(ii) PWA `C` map (`pwa/app.src.js`): anthropic/claude [2,10], openai [0.75,4.5], mistral [0.7,2.1] (new), gemini
[0.3,2.5] = the audited mirrors at provider level. Row 115 stands.

(iii) Recompute from raw tokens (30 d, 2026-10-26 → 11-25; same 188 rows as 11-19, no call since 11-08):

| task | provider | model | n | stored $ | at Large 3 $ | at Large 4 $ |
|---|---|---|---|---|---|---|
| long_context | openai | gpt-5.4-mini | 165 | 1.457829 | 1.457824 | 1.457824 |
| analysis | mistral | mistral-large-latest | 11 | 0.085481 | 0.085480 | 0.119672 |
| parse_jd | mistral | mistral-large-latest | 2 | 0.050782 | 0.050783 | 0.071096 |
| consensus_reinforce | openai | gpt-5.4-mini | 2 | 0.016571 | 0.016571 | 0.016571 |
| compress | openai | gpt-5.4-mini | 2 | 0.013590 | 0.013590 | 0.013590 |
| consensus_poll | openai | gpt-5.4-mini | 2 | 0.008646 | 0.008646 | 0.008646 |
| consensus_poll | mistral | mistral-large-latest | 2 | 0.005766 | 0.005766 | 0.008072 |
| consensus_poll | gemini | gemini-2.5-flash | 2 | 0.001819 | 0.001819 | 0.001819 |
| **TOTAL** | | | **188** | **1.640484** | **1.640479** | **1.697290** |

The mistral calls ran 11-03 → 11-08. 12 of 15 ran on 11-03 or 11-05 (the 11-05 probe still
showed Large 3); the three 11-06 and 11-08 calls are undetermined. Stored reconciles at the Large 3 rate (sub-cent rounding). Going forward Large 4 applies.

## 3. Traffic + scoring — blind week, no flip

**7 d (2026-11-18 → 11-25): 0 `llm_calls`.** Last row 2026-11-08T13:05Z (17 days). Not an outage by itself: gen-runner,
gen-job and Claude-built packages do not log. Score falls back to 30 d.

`relay-cost-quality-tune.mjs --data`: 7 d → **BLIND** (no rows); 30 d → **no change**, at both Mistral rates.

| role | head | evidence (30 d, recomputed at today's rates) | decision |
|---|---|---|---|
| writer | anthropic | no telemetry | keep |
| supervisor | mistral | no telemetry | keep |
| coherence | openai | no telemetry | keep |
| analysis | mistral (pinned 09-29) | mistral cq=68.1 n=13 ($0.01467/call; 95.4 and $0.01048 at Large 3), 100% ok, 0 retries | keep (n<20, sole provider) |
| kernel (unpinned) | anthropic default | no telemetry | keep |

All 188 calls: 100% success, 0 retries, 0 malformed / placeholder / fabrication / banned-word flags. These numbers
describe **Large 3**. AntCV has no logged quality evidence for Large 4 on `supervisor` or `analysis`.

Client-dispatch levers (owner-gated `ee()` change): `long_context` openai $0.0088/call (86% of 30 d spend); compress
openai $0.0068/call; consensus_poll leads openai $0.0043/call; consensus_reinforce openai $0.0083/call.

## 4. Deploy

- **PWA:** auto-deployed from `09d14274`, run **45702487888** success. Live check: `antcv.pages.dev` serves
  `1.51.6685-mistral-large4` in `index.html` and `sw.js`, and `app.js` carries `mistral:{inputPer1M:.7,outputPer1M:2.1}`.
- **access-relay: DEPLOYED.** Only `09d14274` sits on `workers/access-relay` since the 11-24 deploy of `005b4be1`.
  `deploy.yml target=access-relay` run **45702656865** from `09d14274` success; new deployment 21:16Z; `/health` 200
  `auth-41-jt-doc-size`. No endpoint exposes the rate table.
- **proxy + demo-proxy: OWED, owner call (row 147).** Last deployments 2026-11-05. A deploy also ships POSTING-GUARD-001
  (`91deec12`), which row 147 holds for the owner. **New weight this week:** the undeployed demo cap still meters
  the live mistral pin at [0.5,1.5], 1.4x under.

## 5. Owed / owner calls

1. **D1 INSERT** in §2. Without it telemetry under-prices every mistral call.
2. **Mistral pin.** `mistral-large-latest` is now Large 4 (+40%, announced 10-06 as Public Preview). Keep it, or pin
   `mistral-large-2512` (Large 3, retires 2027-03-05). It leads `supervisor` and `analysis`. Quality on our
   prompts is unmeasured. Row 157.
3. **proxy + demo-proxy deploy** (row 147): carries 11-12, 11-19 and 11-25 rate tables and POSTING-GUARD-001.
4. **Gemini 2.5 routing on 2026-12-01** (§1): last tune before it. Keep, or move the pin explicitly.
5. **Row 115** (PWA `C` map meters `claude` at sonnet-5 while the gen pin is opus-5-5): no claude call in 30 d.
6. **Row 124** (retired ids in `PROVIDER_MODELS` tails): unchanged.
7. **`long_context`** is 86% of logged 30 d spend on openai. Owner call if it should follow the cost router.
8. **Scheduled prompt text** is stale twice: `gpt-5.5 [30,60]` (vendor [5,30], fourth week flagged) and `mistral-large
   [0.5,1.5]` as the live pin (now [0.70,2.10]).
