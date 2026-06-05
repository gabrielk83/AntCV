# Generate cycle — map + optimisation plan

> Status: analysis authored 2026-06-05 to ground the "fold the Analyse-JD
> checks into Generate instead of adding another cycle" work. Source of truth
> is `pwa/app.js` (minified). Tracking the slow (~7+ min) generate run.

## 1. What Generate actually runs

`generate` is **not one LLM call** — it is a pipeline of ~23 LLM invocations
across **14 task types**, several of which run as a **multi-LLM consensus**
(the same prompt sent to 2–4 providers, then reconciled). Task → provider
order is defined in app.js:

```
consensus_poll:      [mistral, gemini, openai, claude]   // ×2
consensus_reinforce: [openai, claude]                    // ×1
fuse:                [openai, claude, mistral]            // ×2
apply_correction:    [openai, claude, mistral, gemini]   // ×2
analyze_fit:         [claude, openai, mistral, gemini]   // ×1
long_context:        [claude, openai, gemini]            // ×2
compress, enrich, fix_orphans, refine_*, translate_da, parse_jd,
extract / extract_pdf, generate_cv …
```

Invocation counts seen: `enrich 3, compress 3, long_context 2, apply_correction 2,
fix_orphans 2, fuse 2, consensus_poll 2, extract_pdf 1, analyze_fit 1, extract 1,
generate_cv 1, parse_jd 1, consensus_reinforce 1`.

### Why it takes ~7 minutes
- Each consensus task fans out to multiple providers **sequentially** and waits.
- On `429` (provider quota, e.g. OpenAI) or `503` (Gemini overload) the cascade
  **retries with 5 s backoff, up to 3×**, then falls to the next provider.
- A single rate-limited provider inside a consensus poll can add 15 s+; across
  ~23 calls this compounds into minutes. (Observed: `task=consensus_poll
  provider=openai 429` → the run stretched past 7 min.)

## 2. The analysis is already produced inside Generate

`generate_cv` already emits the full rationale the Analysis panel renders:

```
rationale.fit_summary, top_fit_points, gaps,
         tailoring_decisions, cover_letter_strategy
```

The separate **`POST /api/jd-analysis`** call (fired by the Analysis-panel
sidecars) re-derives overlapping signal and adds the JD-only extras:

| Field | Produced by generate_cv | Added by /api/jd-analysis |
|---|---|---|
| fit_summary / top_fit_points / gaps | ✅ | (re-derived) |
| tailoring_decisions / cover_letter_strategy | ✅ | — |
| red_flags | — | ✅ |
| recruiter (+ web search) | — | ✅ (server-side search) |
| questions_in_jd | — | ✅ |
| detected_language | (implicit) | ✅ |
| assumptions / confidence_notes / recommendations | — | ✅ (new) |

So when "Generate" runs, calling `/api/jd-analysis` afterwards is a **redundant
extra cycle** for everything except `recruiter` web-search.

## 3. Optimisation plan (fold in, don't add a cycle)

**Direct app.js edit (next):** extend the `generate_cv` task's JSON schema +
system prompt so it ALSO returns `red_flags`, `questions_in_jd`,
`detected_language`, `assumptions`, `confidence_notes`, `recommendations` — the
model already has the JD and the drafted CV/CL in context, so these cost ~0
extra latency versus a second `/api/jd-analysis` round-trip. Write them into the
same `rationale` object the panel already reads. The only thing that stays a
separate (and optional) call is **recruiter web-search**, because it needs the
server-side Brave/search backend, not the LLM.

Result: the Analysis panel + the branded PDF get the full check-set **for free**
from the generate pass; the standalone `/api/jd-analysis` call is only used for
the "Analyse JD against a *new/changed* JD" case (where there was no generate).

## 4. Further perf levers (documented, not yet applied)

- **Trim consensus width.** 4-provider polls are the main cost. For most tasks a
  2-provider consensus (or single strong provider with a cheap verifier) would
  cut wall-clock substantially with little quality loss.
- **Parallelise independent providers** within a consensus instead of awaiting
  sequentially.
- **Surface provider failures to the user.** A `429`/quota or repeated `503`
  should raise a visible notice ("OpenAI quota hit — using fallbacks, this run
  is slower") instead of console-only, so a 7-minute run is explained.
- **Skip redundant refinement** (`compress`×3, `enrich`×3) when the draft is
  already within length/quality bounds.

## 5. Upload-extraction parity (for reference)

All three JD/material upload points share the same engines:

| Input | PDF (incl. image-based) | Image file |
|---|---|---|
| Wizard (user kernel) | `extractPDFText` cascade | `/api/extract-jd-image` |
| Generate CV/CL (JD) | `extractPDFText` cascade | `/api/extract-jd-image` |
| Analyse JD | `extractPDFText` (delegated, 1.50.152) | `/api/extract-jd-image` |

`extractPDFText` = pdf.js text → garbled detector → Claude native-PDF text →
vision OCR. Exposed as `window.AntcvExtractPDFText` in 1.50.152.
