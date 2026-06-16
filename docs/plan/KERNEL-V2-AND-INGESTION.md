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

SPEC ANCHORED. The interim v1 kernel fixes shipped this session (security guard,
Copenhagen Wolves canon, Meprolight split, reverse-chron order, names, tools group names,
unsolicited profile) are SUPERSEDED by this v2 kernel once loaded — v2 is the canonical
source going forward. Execution = the dedicated multi-session effort above, starting with
Task 1a + §2.
