# Kernel v2 + Tense/Language + Upload→Kernel Ingestion — implementation plan

> **Source:** owner brief `antcv-code-session-brief.md` (2026-06-16) + the validated
> `gabriel-kernel-v2.json` (owner's complete kernel: 12 experience entries, tense +
> language blocks, merge groups, structured outcomes/proofPoints). This file anchors
> that brief in the repo as the spec for a MULTI-SESSION build. The kernel JSON itself
> is per-user data → it lives in D1 `ant_memory.user_kernel`, NOT the repo (owner rule).
> Owner's file path (for the load step): `C:\Users\karpg\Downloads\gabriel-kernel-v2.json`.

## Hard constraints (from the brief — read before any edit)

- **Large-file rule (NON-NEGOTIABLE):** `pwa/app.js` (~900KB) and `pwa/app.src.js` are
  edited LOCALLY (Edit tool + local git push) — NEVER written inline via MCP
  `github_write_file`/`github_commit_multiple_files`. (This local-desktop workflow is
  what this repo's sessions already use; the rule is a guard against the MCP large-file
  incident.) MCP write tools are for SMALL files only (sidecars, JSON, docs).
- **Parity:** every fix must match Preview + DOCX + PDF, desktop AND mobile. No
  preview-only / wrong-item / only-after-hard-refresh fixes.
- **No fabrication, ever:** extract/confirm real data, flag gaps, never invent — for ANY
  user's data, not just the owner's.
- **wrangler.toml:** any new/modified one needs the `[observability.logs] enabled +
  invocation_logs` block after `compatibility_date`.
- **proxy/demo-proxy parity:** mirror `workers/proxy/src` changes into
  `workers/demo-proxy/src` where a matching copy exists.

## Key architectural note (coupling)

The v2 kernel shape (`schemaVersion: "2.0-kernel"`, `experience[]` with
`{title, company, start, end, isCurrent, scope[], outcomes[{title,result,numeric}],
proofPoints[], langInvariantTokens[]}`, plus top-level `tenseMode`, `language`,
`generationRules`, `mergedVariants`, `selectedOutcomes`) DIFFERS from the current D1 v1
`user_kernel.history` shape (`workHistory[{id, role, company, years, bullets}]`). The
generation reader (GABRIEL_BG via `ie()` → "STORED WORK HISTORY", app.src.js ~2678) and
`scripts/gen_kernel_snapshot.mjs` consume the v1 shape. **Therefore Task 1a (load v2) and
§2–3 (reader updates) are COUPLED** — loading v2 raw into the v1 `history` column breaks
the readers. Safe staging: store v2 in a NEW field/column (non-destructive) and migrate
the readers to it, or transform v2→v1 for the bullets path while the structured
outcomes/tense/language readers are added.

## Bug / generation-rule IDs to encode

- **KERNEL-SCHEMA-V2-001** — adopt `tenseMode` + per-role `isCurrent` + `language` block.
- **TENSE-RENDER-001** — read the `isCurrent` flag; NEVER parse date strings at render.
  auto = per-role (isCurrent→present, else past); present/past = all. Parity across P/D/PDF.
- **LANG-CROSS-001** — single cross-lingual call (kernel-EN + JD-target → output-target).
  `crossPolicy` field-classes (roleScope/outcomeResult/connectiveProse = crosses;
  companyName/patentNumber/metricsNumerals/toolStandardNames/publicationTitle = invariant);
  `roleTitlePolicy` default crosses, `da: keepSourceWhereIdiomatic`; pass per-role
  `langInvariantTokens[]` as a do-not-translate list. LANG-EXPAND-001 tier = lazy, cached
  in `language_view`.
- **IMPORT-INGEST-001** — non-JSON upload (docx/pdf/txt/LinkedIn) → kernel create/append;
  extraction + STRUCTURAL INFERENCE ONLY (dates→isCurrent, overlapping employer→merge
  CANDIDATE not auto-merge, detect sourceLang). No fabrication.
- **IMPORT-CONFLICT-001** — append/merge: same role (id, or title+company+overlapping
  dates) with a different date/title/metric → KEEP BOTH + FLAG + user resolution modal.
  NEVER auto-overwrite metrics/numerics.
- **IMPORT-GAP-001** — after ingestion, list roles/fields with gaps (no outcome/proofPoint/
  scope), ASK the user, never auto-fill.
- **ONBOARD-LANG-001** — new-user `activeDefaults` = detected sourceLang only (do NOT
  inherit owner's [en,da,es,zh]); user adds languages in the onboarding wizard + Settings.
- (existing, keep) **GEN-ROLEFORM-001** (merge-group: emit merged OR split per document,
  never both, never delete), **GEN-IDF-001** (hidden-by-default: idf, tau-security,
  students-council), **VERB-RULE** (directed/supervised/ran; never bare "led a team").

## Task order (from the brief)

1. **Task 1a — load owner kernel v2 into D1 `user_kernel`** (binding `ant_memory`,
   user_hash `GVdLYawOzO5SmG8ehBfy0Z6m43pb_5QC`). Non-destructive staging (new field/
   column) so v1 readers keep working until §2–3 land. Verify render in all 3 outputs.
2. **§2 TENSE** — add `tenseMode` + per-role `isCurrent` read path; generation prompt
   renders verbs from the flag. Test owner (kanzen/wolves present, rest past). New-user
   default `auto`.
3. **§3 LANGUAGE** — crossPolicy + langInvariantTokens + roleTitlePolicy in the single
   cross-lingual call. Test ES/ZH cross, DA title-keep, invariant tokens verbatim.
4. **§4 INGESTION** (biggest) — extraction → structural inference → gap flag → create/merge
   with conflict resolution. Build behind the existing IMPORT path.
5. **§4f UI** — onboarding wizard language selection + Settings import + resolution modal +
   gap-fill prompt.
6. **Regression** — parity P/DOCX/PDF desktop+mobile, for a sample uploaded docx AND the
   owner kernel v2.

## Status (2026-06-16)

**Task 1a DONE** — the owner's `gabriel-kernel-v2.json` is staged in D1
`user_kernel.kernel_v2` (a NEW, non-destructive TEXT column; the v1 `history` is
untouched so generation keeps running). Written transcription-free via a Node-built SQL
file run through `wrangler d1 execute ant_memory --remote --config
workers/access-relay/wrangler.toml`. Verified: `length(kernel_v2)`=19972 (exact),
`json_valid`=1, schemaVersion `2.0-kernel`, 12 experience entries, tenseMode `auto`,
experience[0]=`Product / Project Expert isCurrent=1`.

**§2 TENSE-RENDER-001 DONE (1.50.515).** The AUTO experience-tense rule is now FLAG-driven,
not date-parsed: the STORED WORK HISTORY builder (GABRIEL_BG, app.src.js + minified app.js)
tags ` | CURRENT ROLE` from each role's `isCurrent`; the AUTO rule writes tagged roles in
present, untagged in past (even if dates look open-ended), never inferring from the year
string. D1 bridge: v1 `history` gets `tenseMode='auto'` + `isCurrent=true` on kanzen +
copenhagen_wolves (sourced from v2 flags). Verified `diag-tense-render.mjs` (the non-flagged
`2010 - present` role is NOT tagged; the flagged closed-date role IS). NOTE: this reads the
flag from the **v1 `history`** bridge for now; migrating the reader to consume `kernel_v2`
directly (with `tenseMode` present/past too) is part of the full v2 reader work.

**§3 LANG-CROSS-001 DONE (1.50.516).** Added a self-gating `__langRule` to the main
generation prompt (app.src.js, injected `${__tenseRule}${__langRule}${__brandFitRule}`;
mirrored to app.js as `__lr` between `${y}${w}`). When the OUTPUT LANGUAGE is not English it
translates prose (roleScope / outcomeResult / connectiveProse) directly in-target, keeps the
invariant classes VERBATIM (company names, patent number, metrics/numerals, tool/standard/
protocol names, publication titles), crosses role titles by default but in DANISH keeps the
idiomatic English term (e.g. "Change Control Lead"), and honors a per-role `DO-NOT-TRANSLATE:`
token list if present. Verified: rule text + injection present in src AND minified, boot-smoke,
297/297. FOLLOW-UP (full v2 reader): surface per-role `langInvariantTokens[]` into the STORED
WORK HISTORY line as the explicit `DO-NOT-TRANSLATE:` list (the generic invariant classes cover
most today); expand target languages beyond the current EN/DA flag to es/zh + the lazy tier.

### §4 ingestion — sliced

- **Slice 1 — ENGINE: DONE.** `pwa/antcv-kernel-ingest.js` — pure, UI-free, deterministic,
  node-tested (`pwa/test/unit/kernel-ingest.test.mjs`, 6 checks; suite 297→303). Covers:
  4a `parseTextToDraft` (already-extracted CV text → draft roles/dates/contact, conservative,
  no guessing); 4b/4e `inferStructural` (isCurrent from the date flag, GEN-IDF-001 hidden-by-
  default for military/security-guard/student/TA roles, same-company-overlap → merge
  CANDIDATE not auto-merge, ONBOARD-LANG-001 new-user `activeDefaults=[detected sourceLang]`,
  `tenseMode='auto'`, best-effort `langInvariantTokens`); 4c `detectGaps` (flag roles missing
  scope/outcomes/proofPoints/dates — never auto-fill); 4d `mergeKernels` (CREATE if no
  existing; else merge — new roles add, same role with a differing title/date/METRIC →
  keep-both-and-FLAG, existing value preserved, metrics NEVER auto-overwritten; non-conflicting
  scope merges additively); `ingest()` orchestrator → `{kernel, mode, conflicts, gaps,
  sourceLang}`. NO fabrication anywhere. Not yet loaded in the browser (no consumer) — the UI
  slice imports it.
- **Slice 2 — file→text extraction: DONE.** Added `detectImportKind` + `extractTextFromFile`
  + `ingestFile` to `antcv-kernel-ingest.js` (browser-gated; reuses the app's `window.pdfjsLib`
  + `window.loadMammoth`, `file.text()` for txt/json, `window.AntcvOcrImage` for images). A raw
  kernel `.json` bypasses the heuristic parser and goes straight to create/merge. Node-tested
  (kind dispatch, txt CV end-to-end, json passthrough, graceful no-browser/unsupported errors;
  suite 303→307). Still a pure library — the extraction fns only run when called in-browser.
- **Slice 3 — UI (§4f): STARTED (1.50.517).** `pwa/antcv-kernel-import.js` (IIFE sidecar) +
  the engine loaded as a module (`<script type=module>` → window.AntcvKernelIngest). Exposes
  `window.AntcvKernelImport.openPicker()` / `.runImport(file)`: drop a .docx/.pdf/.txt/.json →
  engine ingests → a PREVIEW MODAL shows roles (with hidden/current tags), CONFLICTS (existing
  vs incoming per field, radio defaulting to keep-existing — IMPORT-CONFLICT-001) and GAPS
  (IMPORT-GAP-001). "Stage" writes the resolved kernel to the STANDALONE key
  `antcv:ingestedKernel` — NON-DESTRUCTIVE (never touches live data). Verified
  `diag-kernel-import.mjs` (fresh create shows 3 roles + gaps; re-import = merge with a date
  conflict; existing metric preserved; 0 errors) + boot-smoke + suite 307. **D1 PERSISTENCE DONE (1.50.518 + access-relay):** added `POST /api/profile/kernel-v2` to
  access-relay (auth via the session identity; UPSERTs `user_kernel.kernel_v2` ONLY —
  identity/history/preferences untouched; 401 unauth / 422 not-a-kernel). The modal now has
  "Save to my account" → `saveToAccount(kernel)` POSTs `{kernel}` to `<relay>/api/profile/
  kernel-v2` (credentials:include). `kernel_v2` added to schema.sql (live table already has the
  column from Task 1a). Verified: worker `diag-kernel-v2-write.mjs` (401/422/write + identity
  preserved) + browser `diag-kernel-import.mjs` (correct POST). **REMAINING in Slice 3:** a
  visible Settings/onboarding ENTRY button → `openPicker`; full structured apply of date/metric
  resolutions; language-selection step; and migrating the live readers to consume `kernel_v2`
  so an import actually changes the generated CV (today it stages durably but generation still
  reads the v1 bridge).

The owner re-imports v2 cleanly via Settings → Personal once Slices 2–3 land — `kernel_v2` is
the staging copy until then.

SPEC ANCHORED. The interim v1 kernel fixes shipped this session (security guard,
Copenhagen Wolves canon, Meprolight split, reverse-chron order, names, tools group names,
unsolicited profile) are SUPERSEDED by this v2 kernel once loaded — v2 is the canonical
source going forward. Execution = the dedicated multi-session effort above, starting with
Task 1a + §2.
