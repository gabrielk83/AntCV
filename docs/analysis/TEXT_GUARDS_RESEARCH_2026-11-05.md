# Stronger fact guard and echo check — local and small-cloud options (2026-11-05)

Research for TEXT-GUARDS-001.

- **Tier 0 is shipped:** `scripts/job-tracker/fact_guard.py`, `echo_check.py`, `guard_rules.json`. It is deterministic, has no model and runs anywhere.
- **Tiers 1 and 2 below are options, not built.**
- **[UNV]** marks a claim the research could not verify. CPU latencies are estimates unless a model card states them.
- The model, licence and benchmark facts come from the model cards and https://llm-aggrefact.github.io/ as read on 2026-11-05. Re-check before pinning.

## What AntCV already has
- **Proxy number check:** `workers/proxy/src/source-fractures.js` `numberGrounding`, with a metric ledger. It already keeps job-ad figures from grounding candidate claims. The tier-0 Python guard follows the same rule.
- **Tier-2 LLM judge:** `workers/proxy/src/supervisor.js`.

## Fact guard: claim-level grounding (tier 1)

| Model (HF ID) | Size | Licence | Languages | LLM-AggreFact | Runs on |
|---|---|---|---|---|---|
| alexandrainst/scandi-nli-large-v2 | 354M | Apache-2.0 | DA/SV/NB | not listed; MCC DA 75.7 (DanFEVER) | PC CPU, about 0.3–1 s per pair; no ONNX port |
| yaxili96/FactCG-DeBERTa-v3-Large | 0.4B | MIT | EN | 75.6 (best under 1B) | PC CPU |
| lytang/MiniCheck-Flan-T5-Large | 0.8B | MIT | EN | 75.0 | PC CPU; ONNX via optimum [UNV] |
| vectara/hallucination_evaluation_model (HHEM-2.1-open) | about 0.1B | Apache-2.0 | EN | not listed | PC CPU, 1.5 s per 2k tokens per the card; needs `trust_remote_code` |
| MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7 | 279M | MIT | 100 languages (SV trained, DA not) | MCC DA 68.4 | PC, or browser via the Xenova ONNX port |
| @cf/cloudflare/clef-flash (HF Cloudflare/clef) | 9B | Apache-2.0 | not stated [UNV] | 76.6 | Workers AI, about 3.5k neurons per M input tokens |
| @cf/cloudflare/clef | 27B | Apache-2.0 | not stated [UNV] | 79.0 | Workers AI, about 22k neurons per M input tokens |

**Ruled out**
- Bespoke-MiniCheck-7B: CC BY-NC (non-commercial).
- Small local models inside a Worker: the 128 MB memory limit and the 10 ms CPU limit on the free plan.

**Entity extraction**
- Build the allowlist from the kernel's own structured fields: employers, tools, degrees.
- DaCy `chcaa/da_dacy_small_trf` (Apache-2.0) is an optional extra. It pins spaCy <3.6, so it needs its own virtual environment.

## Echo check beyond exact 5-grams

| Method | What it adds | Where |
|---|---|---|
| Stemmed word 5-grams + character 5-gram containment (shipped) | inflection swaps; Danish compounds | anywhere |
| ROUGE-L / LCS (shipped as a token LCS) | reordered near-verbatim sentences | anywhere. `rouge-score`'s default tokenizer deletes æ/ø/å. |
| MinHash-LSH (`datasketch`, MIT; pin v2.x) | reuse across hundreds of past letters | PC. Brute force is fine below about 10^5 sentences. |
| intfloat/multilingual-e5-small (MIT, DA/SV) | pairs a draft sentence with its nearest job-ad sentence | PC, or browser via Xenova |
| @cf/baai/bge-m3 (MIT) | the same pairing | Workers AI |

Similarity to the job ad is the point of tailoring, so it must never be the echo signal on its own. Embeddings only pair sentences; the lexical scores decide.

## Recommended path
1. **Tier 0 (done).** Next: calibrate the thresholds on AntCV's own outputs (below).
2. **Tier 1 on the PC** (`gen-runner.py`, opt-in `--nli`):
   - For each claim sentence, retrieve the top 3–5 kernel facts with e5-small.
   - Run NLI with scandi-nli-large-v2 for DA/SV, or FactCG for EN.
   - "Neutral" is a WARN. FAIL only on contradiction, or on an unsupported figure, name or credential (tier 0).
   - Install cost: about 1.5 GB of models plus torch. That needs the owner's OK, because it downloads.
3. **Tier 2:** the existing supervisor cascade, or clef-flash in the Worker. Run it only on the claims tier 1 leaves unsupported.
4. **Pin** each HF repo plus its commit revision, onnxruntime, datasketch, and the Workers AI model IDs. Keep one versioned rules JSON (`guard_rules.json`) for both Python and JS.

## Evaluation plan (before tuning thresholds)
1. Take about 40 recent packages (EN/DA/SV) and split them into about 600 sentences. Keep this set out of git; committed test cases use `docs/personas/anita`.
2. Label each sentence:
   - facts: SUPPORTED / INFERRED-OK / UNSUPPORTED / NON-CLAIM;
   - echo: LIFT / NEAR-LIFT / KEYWORD-OK / CLEAN / REUSE.
3. Add about 300 planted errors:
   - changed figures;
   - a fact moved to another role;
   - "contributed" changed to "led";
   - an invented credential;
   - a shifted date;
   - lifts with one word swapped, or with Danish inflection changes.
4. Measure:
   - balanced accuracy per language;
   - recall on the planted errors at 1 or fewer false flags per document.
   Tune on one half and report on the other.
