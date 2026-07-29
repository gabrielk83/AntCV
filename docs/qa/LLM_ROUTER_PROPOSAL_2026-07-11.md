# LLM router proposal — 2026-07-11 (owner review)

Consolidated proposal from the cost-quality benchmark (46 runs, 6 roles × up to 9
models — `docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`). Two parts:
**A. `S`-map / model parameters** (owner-gated — flagship model changes) and
**B. malformed-output detector** (closes the self-correction gap the benchmark exposed).
Everything already-shipped this session (rotations, haiku-drop, proxy fixes) is listed
at the end for context.

## Evidence (46-run generation aggregate)

| Model | Quality | Factual | $/gen | Note |
|---|--:|--:|--:|---|
| claude-opus-4-8 | **7.83** | 8.5 | $2.01 | top quality |
| **gpt-5.4-mini** | **7.67** | 7.67 | **$0.17** | ~tied with opus at **1/12 the cost**, 0 em-dashes |
| claude-sonnet-5 | 6.83 | 8.17 | $0.78 | best-grounded |
| **gpt-5-mini** | 6.40 | 7.0 | **$0.06** | cheap champion (35× < opus) |
| mistral-medium | 4.75 | 5.67 | $0.09 | weak for gen |
| claude-haiku-4-5 | 4.20 | 5.33 | $0.27 | dominated (dropped) |
| gemini-2.5-pro / mistral-large / gemini-flash | 3.5–4.0 | — | — | weak for gen |

Translation (Danish number-invariant gate): **OpenAI = 1.00, Claude/Gemini/Mistral = 0.769** — OpenAI uniquely preserves numbers.

---

## Part A — `S`-map / model parameters (owner decision)

Current `S`-map (`pwa/app.src.js` ~1069) + `C` pricing (~1097):

| Provider | model | quality | danish | cost | $/1M in-out |
|---|---|--:|--:|--:|---|
| anthropic | claude-**sonnet-4-6** | 9 | 8 | 2 | 3 / 15 |
| openai | **gpt-5.5** | 10 | 9 | 4 | **30 / 60** |
| mistral | mistral-large-latest | 7 | 6 | 1 | 3 / 9 |
| gemini | gemini-2.5-flash | 8 | 7 | 1 | 0.15 / 0.6 |

### A1 — SAFE, recommend applying (low risk, clear correctness)
- **anthropic model `claude-sonnet-4-6` → `claude-sonnet-5`.** The code comment literally says *"there is no Sonnet 5"* — that is now false; Sonnet 5 exists, is a drop-in upgrade (adaptive thinking, same $3/$15 tier), and is what the benchmark scored (6.83). Pure staleness fix.
- **Flagship gen path `claude-opus-4-7` → `claude-opus-4-8`** (separate from the `S`-map, ~line 1608/31806). 4.8 is the current Opus, benchmark top (7.83), drop-in.

### A2 — THE COST LEVER (owner call)
- **openai model `gpt-5.5` → `gpt-5.4-mini` as the default gen model**, with `gpt-5.5` kept only for a "max/thorough" tier.
  - Why: gpt-5.4-mini scored **7.67 (~tied with opus 7.83)** at **~$0.75/$4.50** vs gpt-5.5's **$30/$60** — roughly **1/13 the cost for statistically-equal CV quality**, and cleanest output (0.17 em-dashes/run).
  - Param updates that follow: `C.openai` `30/60 → 0.75/4.50`; `S.openai.cost` `4 → 2`; `S.openai.quality` `10 → 8`.
  - **Risk:** the writing belts (banned-words, coherence, brand voice) are Claude-tuned; the benchmark judged content quality but the *live* deliverable also depends on those belts holding on gpt-5.4-mini across more roles. Recommend: flip the **balanced** tier to gpt-5.4-mini first, keep **thorough** on opus-4-8, watch one week of health/ledger, then decide on the rest.
- **`__LLM_BASE` scorer prior (`~1915`): `openai.c` `0.6 → 0.45`** — its production models are genuinely cheap now; this lets the scorer prefer openai on cost-led tasks where it's both cheap and adequate. Keep `anthropic.q = 1.0` (the reasoning tasks analyze_fit / long_context weren't benchmarked — leave Claude leading them).

### A2 conservative alternative
Keep gpt-5.5 as the openai default (no flagship flip); apply only A1 + the scorer `c` nudge. Lower risk, forgoes the ~10× translation/gen cost saving on the openai path.

---

## Part B — malformed-output detector (closes the self-correction gap)

**The gap** (verified this session): the runtime scorer + autorotate are healthy and loop-closed, BUT the quality signals are `placeholder_leak` / `fabrication` / `banned_word` only — **none detect the failure class the proxy bugs caused**: raw SSE leak (`data:{chatcmpl…}`), empty-despite-tokens, or wrong-language output. Proof: **openai held health 1.0 straight through the window it was emitting garbage.** The client adequacy gate (`__antcvOutputInadequate`, app.src.js:2161) only checks too-short / no-braces / brace-imbalance — an SSE leak *has* braces and length, so it **passes as success**. `llm_quality_signals` (the richer-signal table) is **empty/unwired**.

**Proposed fix (two small, additive parts):**
1. **Client (primary):** extend `__antcvOutputInadequate` (app.src.js:2161) — add
   - SSE-leak signature: output matches `/^\s*(event:|data:\s*[{\[])/m` or contains `data: {"id":"chatcmpl` / `"choices"` mid-body ⇒ inadequate;
   - off-target-language: target is non-Latin (zh/he/am/ar) but output is majority-Latin ⇒ inadequate;
   - widen scope from `parse_jd|generate_cv` to include `generate_cl` and `translate*`.
   Effect: the client rejects the garbage, falls through to the next provider, and demotes the broken one **live** — users never see it. (Both-bundle mirror + a unit test on the fixtures.)
2. **Server (persistence):** write the inadequacy/malformed outcome into `llm_calls` (a `malformed_flag`) so the 5-min aggregation lowers `health_score` and autorotate demotes the broken provider **durably (cross-session)** — and light up the dormant `llm_quality_signals` path for `json_valid` / `preserve_numbers`. (Needs the `llm_calls` write site confirmed — relay/proxy.)

Net: had this existed, today's breakage would have auto-demoted openai/mistral instead of scoring them healthy.

---

## Already shipped this session (context, not for review)
- Rotations: `translate`/`translate_da`/`refine_da` → OpenAI (number-invariant); `danishBias` rebalanced. **1.51.331, verified live.**
- Haiku dropped from gen-runner quick tier → gpt-5-mini.
- Proxy provider fixes 3.8.0–3.8.3 (SSE leak, gpt-5 reasoning, gpt-5.4 regex, gemini-2.5 thinking, **gemini-flash-ramble regression fixed**), mirrored to demo-proxy + parity restored.

## Decisions requested
1. **A1** (sonnet-5 + opus-4-8 staleness upgrades) — apply? *(recommended yes)*
2. **A2** (openai default → gpt-5.4-mini, the cost lever) — full flip / balanced-tier-only / conservative-hold?
3. **Part B** (malformed-output detector) — implement now?
