# Cost-quality benchmark — 2026-07-11

Cross-provider generation + translation benchmark to tune the cost-quality router
and the per-generation-type model choice. Owner-requested.

## Method

- **Sample:** 2 roles from the tracked list — `danfoss` (Product Manager) + `techmah`
  (Senior Technical BA). Full 8-section CV+CL generation each, **single pass**, through
  the **real `/job` engine** (same augmentation/coherence path the app uses). No persist.
- **Models (9):** Anthropic haiku-4-5 / sonnet-5 / opus-4-8; OpenAI gpt-5-mini / gpt-5.4-mini;
  Gemini 2.5-flash / 2.5-pro; Mistral large / medium. All forced explicitly via `provider`+`model`.
- **Quality:** an opus-4-8 judge on a 6-axis rubric (factual-grounding, JD-relevance,
  concreteness, banned-compliance, structure, voice) + **deterministic** metrics
  (banned-words, em/en-dash count, section completeness, length, real token cost).
- **Translation:** opus's EN `danfoss` output (a fixed high-quality source) translated to
  **zh + da** by each model, scored on the **babel-fish invariant gate** (number survival —
  the metric the app's fact-preservation check enforces), target-language coverage, and an
  opus fidelity/fluency judge.
- Harness: `scratchpad/bench_{generate,judge,translate}.py` (reuse the gen-runner plan+drive).

## Prerequisite: 4 proxy fixes (the non-Anthropic router was fully broken)

The benchmark's first act was to expose that **generation through any non-Anthropic provider
produced garbage or empty output** — the cost-quality question was unanswerable until fixed.
Proxy **3.7.2 → 3.8.2**, all shipped + deployed:

| Ver | Fix | Symptom before |
|---|---|---|
| 3.8.0 | `NON-ANTHROPIC-STREAM-LEAK-001` — force `stream:false` for OpenAI/Mistral | CV sections filled with raw `data:{chatcmpl…}` SSE |
| 3.8.1 | `GPT5-REASONING-STARVE-001` — `reasoning_effort:minimal` for base gpt-5 family | gpt-5/gpt-5-mini spent the whole budget on reasoning → empty |
| 3.8.2a | narrow the regex to `/^gpt-5(-(mini\|nano))?$/` | gpt-5.4-mini 400'd (`reasoning_effort` unsupported value) |
| 3.8.2b | `GEMINI-25-THINK-STARVE-001` — cap `thinkingBudget:128` for gemini-2.5* | gemini-2.5-pro returned empty on most sections |

After the fixes, all four providers return clean, complete text via `/job`.

## Generation results (2-role avg; quality 1-10, higher better)

| Model | Provider | Quality | Factual | $/gen | Latency | Raw em-dashes |
|---|---|--:|--:|--:|--:|--:|
| **gpt-5.4-mini** | openai | **8.0** | 8.5 | **$0.170** | 58s | **0.0** |
| claude-sonnet-5 | anthropic | 7.5 | 8.0 | $0.770 | 122s | 5.5 |
| claude-opus-4-8 | anthropic | 7.0 | 7.5 | $2.060 | 154s | 6.5 |
| **gpt-5-mini** | openai | 6.0 | 7.0 | **$0.060** | 82s | 5.0 |
| mistral-medium | mistral | 5.0 | 6.0 | $0.090 | 84s | 3.0 |
| gemini-2.5-pro | gemini | 4.5 | 6.0 | $0.360 | 112s | 1.0 |
| gemini-2.5-flash | gemini | 4.0 | 6.0 | $0.070 | 175s | 0.0 |
| mistral-large | mistral | 4.0 | 5.5 | $0.510 | 136s | 7.5 |
| **claude-haiku-4-5** | anthropic | **3.0** | 6.0 | $0.280 | 108s | **10.5** |

**Findings:**
1. **gpt-5.4-mini is the cost-quality winner** — 8.0 quality + best factual grounding (8.5) +
   zero em-dashes, at **$0.17 (12× cheaper than opus)**. Matches/beats the flagship in this sample.
2. **gpt-5-mini is the cheap champion** — 6.0 quality at **$0.06 (35× cheaper than opus)**.
3. **sonnet-5 (7.5 @ $0.77)** is the better Claude cost-quality point; **opus (7.0 @ $2.06)**
   did not justify 2.7× sonnet's cost here.
4. **claude-haiku-4-5 is strictly dominated** — lowest quality (3.0), dirtiest output (10.5
   em-dashes/run), and pricier than gpt-5-mini/gemini-flash/mistral-medium. **The current
   "quick" tier model is a bad choice.**
5. Gemini/Mistral generate complete but weaker content (4–5); gemini-flash is clean (0 dashes)
   but low-quality.

## Translation results (babel-fish invariant gate = number survival)

| Model | zh fidelity | zh num-surv | da fidelity | **da num-surv** | $/lang |
|---|--:|--:|--:|--:|--:|
| **gpt-5-mini** | 9 | 1.0 | 9 | **1.0** | $0.003–0.004 |
| **gpt-5.4-mini** | 9 | 1.0 | 9 | **1.0** | $0.008–0.009 |
| claude-sonnet-5 | 9 | 1.0 | 9 | 0.769 | $0.030–0.036 |
| claude-opus-4-8 | 9 | 1.0 | 9 | 0.769 | $0.076–0.089 |
| gemini-2.5-flash | 9 | 1.0 | 9 | 0.769 | $0.004–0.005 |
| gemini-2.5-pro | 9 | 0.846 | 9 | 0.769 | $0.016–0.020 |
| mistral-large | 9 | 1.0 | 9 | 0.769 | $0.017 |
| mistral-medium | 9 | 1.0 | 9 | 0.769 | $0.005 |
| claude-haiku-4-5 | 9 | 1.0 | **7** | 0.769 | $0.013 |

**Findings:**
1. **Translation is easy + cheap** — nearly every model scores fidelity 8–9. A cheap model
   is as good as opus (20–25× the cost for no gain).
2. **Danish number-preservation splits by provider:** **OpenAI (gpt-5-mini, gpt-5.4-mini) = 1.0
   (perfect); Claude / Gemini / Mistral = 0.769 — they DROP ~23% of numbers translating to
   Danish.** This is exactly the babel-fish invariant the app must protect. **gpt-5-mini wins
   translation** (perfect invariant survival + fidelity 9 + cheapest).
3. **haiku is weakest for Danish** (fidelity 7).
4. The app's cascades `translate:[mistral,gemini,openai,claude]` and
   `translate_da:[claude,openai,mistral,gemini]` (app.src.js ~1838) currently lead with a
   number-dropping provider — **should lead with OpenAI** for invariant safety.
   *(Deterministic caps-survival read ~0.53 across models — the acronym regex was over-broad,
   catching legitimately-translated caps; number-survival is the trustworthy invariant signal.)*

## Recommendations per generation type

| Type | Context | Recommended | Why |
|---|---|---|---|
| **quick** | reuses kernel / similar-app data (easiest) | **gpt-5-mini** | easy task; cheapest capable; replaces the dominated haiku |
| **fast** | from scratch, fan-width 2 | **gpt-5-mini** (best-of-2 lifts it) | cheap; fan-width covers variance |
| **balanced** | from scratch, fan-width 3 | **gpt-5.4-mini** | best cost-quality (8.0 @ $0.17) |
| **thorough** | from scratch, fan-width 4 + coherence | **sonnet-5** (proven for deliverable standards), gpt-5.4-mini as cheaper A/B, opus for the hardest only | highest-stakes; keep a proven flagship |
| **translation** | any language, esp. Danish | **gpt-5-mini** | perfect number-invariant + fidelity 9 + cheapest |

**Immediate, low-risk:** drop **haiku** from generation (dominated) and **lead the translate
cascades with OpenAI** (number-invariant safety).

## Caveats / before changing router defaults

- **n = 2 roles, single pass.** Higher fan-width (balanced/thorough best-of-N + adequacy
  gating) would lift the cheap models further; a larger role sample would firm the ranking.
- **Judge = opus (Claude family)** → possible home-bias — but it ranked gpt-5.4-mini #1 above
  every Claude and haiku last, so bias is not dominating the result.
- **The writing belts (banned-words, coherence, brand voice, deliverable standards) are
  Claude-tuned.** Flipping flagship/thorough generation to OpenAI needs validation that those
  belts + the owner's voice hold on non-Claude output across more roles. Flagship-stays-opus
  remains until owner approves with a broader run.

**Owner decision:** approve a broader confirmatory run (more roles, real fan-width) + belt
validation before flipping router defaults; the immediate haiku-drop + translate-cascade
reorder are safe now.
