# Desktop nightly 2026-11-27 (Gabo-PC, Opus 5.5)

**Outcome:** no product change. Five red diags made green, all stale assertions (row 152, 53 of 74 left). E1-E4 done. Live attest PASS. One new row: the docx-worker for the letter diagram is not deployed (row 159, owner call).

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mwyuphqk`.
- Base `cf6c55f0` (origin/main); claim commit `5c99cdfe`.
- TOKEN OK, expires 2026-12-02T19:10Z (5.4 d left). No DISPATCH GAP warning; previous start 2026-11-25T19:06Z (1.6 d). No desktop run fired on 11-26.
- Shift claim 1.51.6707-1.51.6726; no version used (no loaded `pwa/` asset changed).

## Duplicate / CI overlap

No CI report for today in `docs/qa/` and no desktop entry for 11-26 or 11-27 in `REGISTER_RUNLOG.md`. Full run. CI credit (row 136) not re-checked.

## Baseline → final

| Check | Baseline | Final |
|---|---|---|
| `run-tests.mjs pwa` | 2224 pass, 0 fail | 2224 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 107 rows | OK, 108 rows |

## Bands A-D

| Row | Status |
|---|---|
| 152 `DIAG-FLEET-ROT-001` | **advanced**: 5 green, 53 of 74 left. |
| 159 `DOCX-LETTER-DIAGRAM-UNDEPLOYED-001` | **new**, blocked: owner decision (worker deploy). |
| 151, 147, 153, 154, 157 | blocked: owner decision. Not re-checked. |
| 45, 41, 19, 35 | blocked: owner session / real device / real LLM gen. Not re-checked. |

Other Band A-D rows: no safe unattended leg. No production D1 read this run.

## Row 152: the five diags

All five assert behaviour that a later owner rule changed on purpose. The diag was updated; no product code changed.

| Diag | Owner rule that made it stale | Now asserts |
|---|---|---|
| `tense-control` | TENSE-POPIN-002 (1.50.626): tense lives in the LanguageCard island | no standalone card while the islands bundle loads; `_antcvSetExpTense` persists without flipping the package |
| `group-name` | TOOLS-METHODS-LABELS-SHOW-001 (06-18): every tools label shown | tools labels shown (flag stripped); RULE 1 lone-row hide on a non-tools list; two-row group keeps labels |
| `candidate-header-edit` | UNSOLICITED-SHOWS-NVIDIA-001 (06-23), HEADER-APP-LINE-001 (07-22) | CL with a JD: one native "Application for … at …" line, no "Application:" heading, template colour; CV specialisation edit persists to `personalInfo.specialization` |
| `wm-move-on-length` | AI-NOTICE-PREVIEW-AUTO-SIDEBAR-001 (07-02): auto corner = sidebar side | auto left; a length swap does not move it; sidebar right + pulse → right; manual corner wins |
| `cl-table-dims-export` | BRING-RICH-BLOCK-001 (06-29), CL-TABLE-WIDTH-PAGE-REF-001 (06-18) | non-Nordic style seeded so the table survives; payload width 12657 = 11506 × 1.10 |

Read, not fixed: `additional-partition` (stored groups come back empty; cause not read).

## Band E

### E1 (stalest by `check-register --stalest`)

| Row | Status | Blocker for the rest |
|---|---|---|
| 36 `GEN-CORECOMP-BROAD-001` | **verified**, test 7/7 | real LLM gen |
| 37 `FOCUS-LABEL-EO-001` | **verified**, test 15/15 | real LLM gen |
| 25 `TABLE-GEOMETRY-PARITY-001` | **verified**, markers unchanged, its diag repaired | owner real-PDF pass |
| 6 `BANNED-WORDS-MERGE-001` | **verified**, switches present | owner eyeball |
| 8 `KERNEL-V2-READER-001` | **verified**, test 5/5 | real models, owner docx |

### E2 Settings-panel churn

`--selftest` PASS; real run 4/4 panels at rest (0 mutations).

### E3 button audit pass 2

216 buttons (214 on 11-25), 0 regressions, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-27.md`). Labels added: "Letter diagram", "What I Bring row 0 alignment" (the 11-25 letter-diagram ship). 11 active ↔ ui-only flips (settle timing).

### E4 export/preview parity

`RESULTS-PREVIEW-EXPORT-PARITY OK`.

## Live attest

- `sw.js` CACHE and `app.js?v` = `1.51.6706-letter-diagram` live and in the repo.
- `app.js` live sha1 `1254c955` = git blob (the worktree copy differs only by CRLF).
- `diag-live-guard-sidecars` 9/9; `browser-qa --only version-live,sidecars-live` 2/2.
- `/health` 200 on all four: relay `auth-41-jt-doc-size`, cv-proxy and antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.177-role-line-one`.
- Mismatch: repo docx-worker `1.14.178-letter-diagram` is not live (row 159).

## Evidence index

- `pwa/test/diag-tense-control.mjs`, `diag-group-name.mjs`, `diag-candidate-header-edit.mjs`, `diag-wm-move-on-length.mjs`, `diag-cl-table-dims-export.mjs` (each green after the edit, red before).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-27.md` / `.json`, `docs/qa/last-browser-qa.json`.
- Register rows 6, 8, 25, 36, 37, 152, 159.

## Owner-verify

- None new from this run.

## Owner decisions

- Row 159: deploy docx-worker 1.14.178 (letter diagram as a Word table). Left owed: the #409 commit held it on purpose.
- Carried: row 152 manual role order; 154 banned-list import; 153 `npm audit fix`; 151 tab-claim fix; 147 proxy deploy; 157 D1 rate INSERT; 136 CI key credit.

## Non-claims

- No signed-in click-through, no real generation, no real export.
- How a live DOCX/PDF export renders the letter-diagram row today was not measured.
- 53 diags are still red; none is claimed harmless.
- The diag edits prove the current behaviour matches the newer owner rules; they do not re-test the older behaviour the rules replaced.
