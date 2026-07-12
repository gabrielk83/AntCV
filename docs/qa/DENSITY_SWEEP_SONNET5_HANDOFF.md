# GOLD-TARGET-LAYOUT-DENSITY-001 — Sonnet 5 sweep phase (hand-off)

> Written 2026-07-13 by the Fable 5 architecture session. The architecture is SHIPPED
> (commits `fdaf483`, `0c50401`, `021ceeb`, `a3e91bc`; versions 1.51.375-377). Your job
> is the per-application sweep: apply the density loop DATA-ONLY across the saved
> applications, verify each byte-exact, and report a table. No code changes expected;
> if you find a code defect, fix it under its own hotfix id + cache-bust protocol.

## What exists (do not rebuild)

| Piece | Where | What it does |
|---|---|---|
| Line-metrics measurer | `scripts/job-tracker/measure_density.py` | Byte-exact render (app's own buildPayload → docx-worker `/generate-pdf` → PyMuPDF words) → per-item last-line fill, char deltas (`add_min/lo/hi`, `add_wrap`, `trim_chars`), runts (<60%), STRETCHED lines (wide justify gaps vs the column median — paragraph appeal), `quality_pct` (defect-free share, target 97.5%), per-page sidebar gap, pages. CLI: `--app N [--doc cl] [--json out]`. |
| Convergence loop | `scripts/job-tracker/density_fit.py` | MEASURE→TARGET→REWRITE, max 4 iters, stops at 97.5% quality. Deterministic 1-3-word clause-boundary trims; batched LLM grow-or-shrink-or-respace with candidates from TWO model families (anthropic + openai via cv-proxy `x-provider`), best-fitting candidate wins, each winner fact-audited by the OTHER family. Growth may draw from the USER KERNEL digest + application context (owner 2026-07-13); shrinks prefer shorter synonyms of identical meaning; table cells are shrink-only respace (one-line rule). Gates: numbers+acronyms verbatim, banned words, dashes, wrap ceiling, cross-family no-new-claims verifier, 2-attempt cap, upstream-pin detection. Writes text-verified, never index-trusted. CLI: `--app N [--doc cl] --apply [--json out]`. Env: `ANTCV_DENSITY_MODEL` (anthropic candidate), `ANTCV_DENSITY_MODEL2` (openai candidate, default gpt-5-mini). |
| gen-runner hook | `gen-runner.py` persist path | `--measure` now runs the loop AFTER `fit_to_pages` (fixes what ships; page budget dominates). New apps come out density-fitted automatically. |
| Width hints (app-side) | `pwa/antcv-bullet-targets.js` SHIP 3 (1.51.375) | Enrich/Fit-it/compress prompts get a WIDTH CALIBRATION block with live chars-per-line. |
| Column balance | `pwa/antcv-auto-pagebreak-block-001.js` `__balanceGate` (1.51.376/377) | Demotes trailing whole sidebar units to minimize the worst per-page gap; last page targets the MAIN column's bottom (gold-calibrated). Knobs `SIDEBAR_BALANCE_MAX_GAP`/`_MIN_GAIN` via `AntcvAutoPagebreak.config()`. |

## The sweep

For every saved application EXCEPT: **723** (owner's showcase, never touch), **670**
(contaminated, awaiting owner delete), **794/796** (owner stubs, no sections):

1. `python scripts/job-tracker/density_fit.py --app N --apply --json out/N_cv.json`
2. `python scripts/job-tracker/density_fit.py --app N --doc cl --apply --json out/N_cl.json`
3. Verify byte-exact after each `--apply`: re-GET `/api/applications/N`, confirm the
   PUT landed (the CLI PUTs only on improvement; "apply skipped" is a valid outcome).
4. Collect per app: QUALITY % before→after (the headline metric, target 97.5),
   runts before→after (rewritable and total), stretched before→after, max sidebar
   gap before→after, pages before→after, rewrites applied (trim vs llm), pinned
   count, residual defects with reasons.

Report one table + a short honest paragraph on residue classes.

## Constraints (all enforced by the tools, listed so you do not relax them)

- **Never fabricate to lengthen.** The no-new-claims verifier + number/acronym gates
  reject invented scope ("sold across multiple product lines" class). If an item
  cannot be fixed without new facts, it stays and is REPORTED — that is correct
  behavior, not a failure.
- **Personality sections** (interests, profile, work_style, accessibility) are
  grow-only; deterministic trims never touch them (team joke, "(foreningsarbejde)",
  accessibility phrasing are protected content).
- **verbatim policy** sections (certs, education, pubs, languages, core_comp,
  greeting, closure) are measured + reported, never rewritten.
- **NEVER run the sweep while a live PWA session is open on the account**
  (save-on-open contamination, marathon lesson 9). Check with the owner's session
  habits: prefer night hours; abort if you see fresh `updated_at` churn you didn't cause.
- **One session at a time.** `git pull --rebase` before any commit; this repo is
  worked from desktop + cloud in parallel.
- Provider billing: the loop uses `claude-sonnet-5` via cv-proxy (override with
  `ANTCV_DENSITY_MODEL`). On `provider_exhausted`-style failures the loop degrades to
  trims-only — note it in the report rather than retrying forever.
- Token: `~/.antcv/token` (self-refreshes). Fixture: `~/.antcv/export_settings.json`
  must exist (it does on the desktop box).

## Known residue classes (expected, report don't chase)

- **Pinned upstream**: payload text sourced from fixture pins/overrides
  (`resultsOverride`, Gabriel pins, export merges) — a cv_sections write is a no-op.
  Logged as `pinned` in the JSON. Fixing means editing the pin source (owner call).
- **Verbatim runts**: languages/education/pubs single-line fills of 40-60% are their
  nature; the owner may later choose label rewordings (e.g. "(Univ. of Toronto)" →
  "(Toronto)" per line-distribution-guidelines) — owner-gated.
- **Un-growable personality lines**: growing "Reading: Technology, society and
  systems thinking" needs personal facts the model may not invent. Leave.
- **zh apps**: clause boundaries (，、；) are wired but untested live — measure first
  (`measure_density.py --app N`), eyeball one rewrite before `--apply`, and respect
  the GZN corrections in memory `china-market-deliverable`.

## Verification instruments

- Before/after PDFs: `measure_density.py --app N --json` renders live; PNG spot-checks
  via PyMuPDF `get_pixmap`. The balance gate is PREVIEW-side (autoPages) — verify it
  in a live browser session (antcv.pages.dev, memory `live-verify-browser-pane`),
  NOT via the headless renders (the fixture's autoPages is empty).
- Gold reference: `Downloads/CV_Gabriel_Karp-Gershon_Trackman_PM_Hardware.pdf` —
  final page columns end TOGETHER ~45% down; that is the target look, not
  fill-to-bottom.
