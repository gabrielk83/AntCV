# AntCV open register

The scannable index of open work — one line per open item, stalest first.

| file | what lives there |
|---|---|
| **this file** | the index: number, ID, `verified:` date, one line of scope |
| `REGISTER_ACTIVE_DETAIL.md` | the full verbatim text and history of every ACTIVE row |
| `REGISTER_CLOSED.md` | finished rows + evidence; kept so old row references resolve |
| `REGISTER_RUNLOG.md` | nightly / weekly run summaries, newest first |

## Conventions (read once)

- **The ticket ID is the key, not the row number.** Row numbers are a positional counter and
  parallel routines have raced on them — see the renumber map below.
- **Every ACTIVE row carries exactly one `verified:` date, in this file’s `verified` column.**
  Before the 2026-08-26 split the date lived in a different column in each of two tables, so a
  staleness scan for `verified:` silently missed the oldest rows — 18 and 25 sat 55 days stale
  behind the sweep. Rank staleness on this column and nothing else.
- `verified:` = the last date a human or agent confirmed the row **against the current code**,
  not the date it was filed. Advancing a row updates that date here AND the text in the detail file.
- **STANDING** rows are regression anchors the nightly diag set re-runs every time. They are not
  unstarted work — do not spend the stalest-row slot on them.
- A finished row moves to `REGISTER_CLOSED.md`. Do not leave it here marked CLOSED.
- `scripts/check-register.mjs` enforces all of the above and runs in the PWA suite.

## Renumbered rows (collision fixes, 2026-08-26)

Two routines filing on the same day each took “the next number”. The row the standing nightly
prompt references kept its number; the later filer moved. A document written before 2026-08-26
citing an old number may mean either row — the ID disambiguates.

| old # | new # | ID | old # also means |
|---|---|---|---|
| 38 | **103** | `RELAY-TUNE-COVERAGE-GAP-001` | GEN-BACKGROUND-001 |
| 39 | **104** | `RELAY-TUNE-NAN-FALLBACK-001` | GEN-MODELROLE-001 |
| 40 | **105** | `JOBSRC-FETCH-001` | SO-003 |
| 41 | **106** | `POSTING-OBSOLETE-001` | SO-004 |
| 102 | **107** | `IMPORT-REWRAP-SIBLING-DROP-001` | DEMAND-SEED-SEARCH-TOKEN-MISSING-001 |

## ACTIVE — stalest first

| # | ID | verified | scope |
|---|---|---|---|
| 38 | `GEN-BACKGROUND-001` | 2026-08-27 | CLIENT — ENGINE SHIPPED 1.51.132 (antcv-gen-job-client.js, window.AntcvGenJob, 8 tests, ine |
| 76 | `JOBTRACKER-LLM-REFIT-BUTTON-001` | 2026-08-27 | (deferred enhancement) — the fit SCORE that orders the Top-5 is deterministic by design (ranking stability). O |
| 82 | `ROLE-CANON-AUDIT-LEG-001` | 2026-08-27 | (follow-up) — the golden gating matrix now carries roles.canon_titles (en/da/es/zh) and the CLIENT enforces it |
| 94 | `CONTENT-LANG-STAMP-001` | 2026-08-27 | (prevention leg of APP-SWITCH-CONTENT-LANG-001) — the LOAD half is fixed (1.51.1800: the selector is derived f |
| 25 | `TABLE-GEOMETRY-PARITY-001` | 2026-07-02 | Table geometry parity — diagnose real CloudConvert PDF vs preview measurement |
| 6 | `BANNED-WORDS-MERGE-001` | 2026-07-03 | Wizard/Settings UX — owner eyeball gate on merged banned-words UI + 6-file loader test |
| 8 | `KERNEL-V2-READER-001` | 2026-07-03 | Kernel v2 — bullets-path v2 migration, es/zh tier, §6 regression pass on uploaded docx |
| 12 | `AI-NOTICE-LEFT-CLOUDCONVERT-001` | 2026-07-03 | diag-ai-notice-anchor RED CLOSED (2026-07-03): the WORKER was right — AI-NOTICE-LEFT-CLOUDCONVERT-001 (owner 2 |
| 21 | `SETTINGS-ROLLER-RESET-001` | 2026-07-03 | FIXED (1.51.90): mechanism CONFIRMED live — history.back() with Settings open was a REAL navigation (side/tilt |
| 22 | `CL-SLOGAN-RICHCONTENT-001` | 2026-07-03 | CL slogan rich-content phase 2 — real sections.cl rich_block object, dedupe render sites |
| 33 | `WHY-RULE-EXPORT-PARITY-001` | 2026-07-03 | Export align parity — name-line + section-headline alignment lost on PDF/DOCX export |
| 24 | `ANALYTICS-BUTTONS-SESSION-TIMEOUT-001` | 2026-07-03 | Analytics buttons — both sides fixed, needs owner click-through confirm |
| 26 | `TOOLS-SIDEBAR-COMPRESS-001` | 2026-07-03 | Tools sidebar compress — exact owner gold-text (Instruments/Lab strings) as deterministic rule |
| 30 | `LLM-IMAGE-ROUTING-001` | 2026-07-03 | LLM image routing — make provider selection image-aware, filter vision-blind providers |
| 32 | `CL-PLATFORM-SIGNALS-001` | 2026-07-03 | CL platform-signals — hardware-platform JD tone/positioning gen-prompt rule |
| 34 | `ROLE-MERGE-STORED-001` | 2026-07-04 | Export/preview parity sweep — role-merge parity is the owner-escalated top item (rules 46/47 belts SHIPPED 1.5 |
| 27 | `MAIN-RUNT-ORPHAN-SWEEP-001` | 2026-07-04 | Orphan sweep v3 — work-style tail truncation, page-3 ghost, real-PDF 1.5-page verify |
| 28 | `NIL-GEN-ADAPTATION-001` | 2026-07-04 | NIL gen adaptation — CV ~1.5-page gen-level target (current export still 5pp) |
| 29 | `NIL-TARGETED-STATE-STICK-001` | 2026-07-04 | NIL state-stick — leg C: stale-row snapshot restore + auto-save downgraded-meta belt |
| 2 | `LINKIFY-EXPORT-001` | 2026-07-05 | SW-projects line-end overflow leg (hyperlink half already closed) |
| 39a | `AUTOSAVE-NO-DOWNGRADE-001` | 2026-07-05 | TAB/DEVICE ISOLATION residuals — auto-save poison-writer CLOSED (AUTOSAVE-NO-DOWNGRADE-001) + same-device stal |
| 41 | — | 2026-07-05 | SO-004 CRASH — React #185 on editor field commits, shared renderer. |
| 42 | `GEN-LANGFAB-001` | 2026-07-05 | fabricated languages (invented German, wrong Danish); deterministic language-fact belt vs ke |
| 43 | — | 2026-07-05 | CA-006 — Application label bleeds into first role title; guard the write site. |
| 44 | `JD-ANALYSIS-PRINT-001` | 2026-07-05 | analysis PDF button exports the CV; fix the export doc-type. |
| 46 | `MOBILE-PANEL-ZOOM-001` | 2026-07-05 | (owner, mobile P0) — on a phone browser at default zoom the main/Settings panel controls |
| 47 | `MOBILE-TOPBAR-SAFEAREA-001` | 2026-07-05 | + MOBILE-TOPBAR-EXPORT-FAB-001 (owner, mobile P0) — top bar unreachable at 100% zoo |
| 48 | `TOPBAR-UNDO-UNIFY-001` | 2026-07-05 | (owner, mobile) — remove the redundant purple Export FAB (green pill already floats natu |
| 49 | `SIDEBAR-GROUP-PAGE-BREAK-001` | 2026-07-05 | (owner, design guidance) — a very long TOOLS & METHODS group (e.g. "Project & del |
| 50 | `UPLOAD-SCREEN-TOP-CLIP-001` | 2026-07-05 | (owner 2026-07-05, same live session as rows 46-49): the upload screen's EN/gear/Editor header row was still c |
| 51 | `PREVIEW-SCROLL-JITTER-001` | 2026-07-05 | (owner 2026-07-05, live session, reported as two symptoms: "application analysis panel is stuck again, does no |
| 39 | `GEN-MODELROLE-001` | 2026-07-06 | code shipped AND MODEL_ROLES set in both wrangler.toml (owner map). Remaining = live-deplo |
| 53 | `CROSS-APP-EXPORT-CONTAMINATION-001` | 2026-07-07 | (owner 2026-07-06, P0 — real export) — target was the KOMBIT "AI-udvikler"  |
| 54 | `GEN-JD-TAILOR-KERNEL-RECALL-001` | 2026-07-07 | (owner 2026-07-07) — targeted tailoring narrows/compresses to the JD but does  |
| 55 | `TARGETED-OUTPUT-FURNITURE-001` | 2026-07-07 | (owner 2026-07-07) — targeted-output furniture/personalization defects on the KO |
| 56 | `GEN-JD-RELEVANCE-TRIM-001` | 2026-07-07 | (owner 2026-07-07) — sibling of row 54: row 54 RECALLS relevant items the narrow set |
| 60 | — | 2026-07-07 | PANEL-CONTROLS-2026-07-07 (owner, editor/preview panel controls — 6 legs, diagnostic-first, auto-deploy prod s |
| 61 | `LINE-DISTRIBUTION-GUIDELINES-001` | 2026-07-07 | (KOMBIT lessons v1→v7, owner asked to crystallize) — conclusions on line-fill / orphan control, the single mos |
| 57 | `TARGETED-CV-POLISH-RULES-001` | 2026-07-07 | (owner 2026-07-07, universal rules from a full CV review) — CONTENT: (1) each bul |
| 59 | `GENERATOR-BASELINE-001` | 2026-07-07 | (owner 2026-07-07, "make the lessons enter the generator baseline") — two things the GE |
| 63 | `ANALYSIS-STALE-ON-APP-LOAD-001` | 2026-07-07 | / NEW-1 (owner 2026-07-07) — loading a saved application does NOT load ITS JD a |
| 64 | `ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001` | 2026-07-07 | / NEW-2 (owner 2026-07-07) — exporting the JD-analysis PDF omits the  |
| 58 | `EXPORT-SETTLED-001` | 2026-07-07 | MOBILE-BUGS-2026-07 (owner "Mobile App Bug Findings Report", 2026-07-07) — 9 findings: MOB-001 Danish UI shows |
| 62 | `HEADER-BANNER-DESIGN-RULES-001` | 2026-07-08 | (owner 2026-07-07, KOMBIT gold) — bake the correct CV/CL header-banner design i |
| 74 | `JD-SWAP-STALE-RATIONALE-001` | 2026-07-08 | LIVE-APP DRIVE (owner 2026-07-08: estimator calibration → generate 4 via the app). Three outcomes: (A) PARITY- |
| 73 | — | 2026-07-08 | CV REVIEW-4 — LINE-FILL DEEP PASS + accessibility/competency (owner 2026-07-08: "lines are very very uneven",  |
| 72 | `AI-NOTICE-ANCHOR-FIX-001` | 2026-07-08 | CV REVIEW-3 + worker 1.14.136 (owner 2026-07-08) — "handle as UNIVERSAL for gen/enhance/fix". WORKER (universa |
| 71 | `AI-NOTICE-INLINE-001` | 2026-07-08 | CV REVIEW-2 FIXES + worker 1.14.135 (owner 2026-07-08, 9 issues). All applied + verified on the Trackman CV: ( |
| 70 | — | 2026-07-08 | CV REBUILD v2 (owner 2026-07-08: "do the CV for my review") + slogan/closure rule refinements. Trackman CV re- |
| 69 | — | 2026-07-08 | CL POLISH v2 + SYSTEMIC EM-DASH (owner 2026-07-08 CL review). Three standing CL rules, applied to the Trackman |
| 67 | `CV-CORECOMP-BLANK-001` | 2026-07-08 | DESKTOP-RUN OPEN QUEUE (owner reconcile 2026-07-08 — these were NOT in the register and would have aged out; m |
| 66 | `LINKEDIN-CLICK-001` | 2026-07-08 | TRACKMAN-DELIVERABLE-REVIEW-2026-07-08 (owner, on the generated Trackman CV+CL) — a batch of GENERATOR-BASELIN |
| 65 | `PTR-STALE-GUARD-001` | 2026-07-08 | ANALYSIS+SYNC-BATCH-2026-07-08 (owner report, 5 issues; gap-export CONFIRMED FIXED by NEW-2/row 64): (A) LANG- |
| 68 | `JD-SYNC-001` | 2026-07-09 | REGISTER-ESCAPE SWEEP (owner 2026-07-08: "look for all scopes of work that escaped the register, incl. incomin |
| 75 | `JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001` | 2026-07-13 | (owner-gated live test) — the manual-add auto-fill flow (deterministic tier on add + async LLM refine: tier up |
| 77 | `JOBTRACKER-TOP5-PERIODIC-RESCORE-001` | 2026-07-13 | (optional) — Top-5 is re-evaluated on every add/edit (the fit-ranked useMemo). Owner asked whether a PERIODIC  |
| 78 | `JOBTRACKER-OPEN-DESKTOP-REVERIFY-001` | 2026-07-13 | CLOSED 2026-07-13 — live-verified end-to-end on the deployed 1.51.392 via Browser pane on a FRESH device (the  |
| 81 | `PHOTO-FUSE-OWNER-VERIFY-001` | 2026-07-13 | (owner-gated visual check) — the 1.51.390-393 photo-panel rework (PW-CJLR-PHOTO-LEAK-002 guard + PHOTO-BTN-FUS |
| 83 | `JD-REMOVE-OWNER-VERIFY-001` | 2026-07-13 | (owner-gated live check) — JD-REMOVE-STICKY-001 (1.51.395, see the 2026-07-13 CLOSED block) is suite- and pred |
| 88 | — | 2026-07-13 | OWNER-ROUND-3-BACKLOG (Aimpoint-810 deep review close-out, 2026-07-13; full detail in the ACTIVE_BUGS OWNER-RO |
| 87 | `OWNER-ROUND-2-RESIDUE-001` | 2026-07-13 | (Aimpoint app-810 review, 2026-07-13, commit 73264c6) — the golden/detection/label/slogan/Scholar fixes landed |
| 86 | `GOLD-SESSION-FOLLOWUPS-001` | 2026-07-13 | (density/gold session residue, 2026-07-13) — the marathon closed its main arc (see the ACTIVE_BUGS 2026-07-13  |
| 89 | `MODEL-TABLE-FRESHNESS-001` | 2026-07-13 | CODE FIXED 2026-07-13 (shift lane 1.51.518-1.51.537, isolated worktree; DEPLOY OWED) — the proxy cost tables n |
| 96 | `CV-HEADER-BOX-001` | 2026-07-17 | CV header redesign (plan §5), not started. Target (owner's hand-fixed 1017_Ibsen_Photonics_CV_FINAL_v4.docx):  |
| 97 | `DELIVERABLES-3CO-001` | 2026-07-18 | the three brand-correct deliverable sets (Ibsen / Aimpoint / Demant). Owner ask 2026-07-17: regenerate CV+CL f |
| 95 | `CV-POLISH-BATCH-001` | 2026-07-19 | (owner CV review, desktop session 2026-07-19 — Ibsen 1017 regen). Five CV-quality defects reported against a l |
| 92 | `EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001` | 2026-07-21 | (owner 2026-07-20; NOT reproduced on current content) — owner's Ibsen PDF: the EXPORT main column breaks after |
| 93 | `AUTO-ANALYSE-ON-JD-LOAD-ERROR-001` | 2026-07-21 | (owner 2026-07-21, transient — NOT captured) — owner repeatedly hit an "auto-run analysis on JD load" error th |
| 31 | `META-STATE-CORRUPTION-002` | 2026-07-29 | Poisoned NIL row repair — set row meta from its own display name, guard auto-save |
| 98 | `BYOK-COST-AUDIT-001` | 2026-07-29 | (2026-07-05, PR #331, register-escape — never given a row). byok-qualify.js's own docstring documented total_c |
| 99 | `REG-GROUP-FOLD-NAMED-001` | 2026-07-29 | (2026-07-05, PR #331, register-escape). REGULATORY CONTEXT rendered two near-duplicate group headers side by s |
| 100 | `GRAB-ZONE-DISMISS-THRESHOLD-001` | 2026-07-29 | + GRAB-ZONE-SCROLL-FORWARD-001 (2026-07-05, PR #332 + same-day follow-up, register-escape). Owner (Android): " |
| 101 | `ZOOM-FLOOR-001` | 2026-07-29 | (2026-07-05, PR #334, register-escape). Owner: "allow Zoom out down to 10-20, currently it is down to 35%… tha |
| 19 | `JD-SCOPE-OCC2-GUARD-001` | 2026-08-15 | JD-scope isolation — two-real-device test |
| 103 | `RELAY-TUNE-COVERAGE-GAP-001` | 2026-08-26 | (found by weekly cost-quality tune 2026-07-13): the tune loop is blind to 100% of real traffic and can never f |
| 45 | — | 2026-08-20 | PERF-001 — multi-second main-thread stalls on export/preview; profile → debounce/memoize. |
| 40 | — | 2026-08-21 | SO-003 DATA LOSS — core-comp row-count change wipes Selected Outcomes (cloud-persisted). |
| 35 | `OVERLAY-EARLY-HALT-001` | 2026-08-22 | NEW — OVERLAY-EARLY-HALT-001 regen-confirm. Shipped 1.51.41 (heartbeat-gated watchdog replacing the fixed 2-mi |
| 36 | `GEN-CORECOMP-BROAD-001` | 2026-08-22 | NEW — GEN-CORECOMP-BROAD-001 regen-confirm. Shipped 1.51.41 (unsolicited CORE COMPETENCIES broadened to PdM/BA |
| 37 | `FOCUS-LABEL-EO-001` | 2026-08-22 | NEW — FOCUS-LABEL-EO-001 regen-confirm. Shipped 1.51.42/43 (canonicalised EO focus-area label post-process). N |
| 3 | `FLOAT-SPINE-001` | 2026-08-23 | Floating spine: byte-diff flag-on doc vs reference, add grid equalization + spacer anchor |
| 14 | `JD-SCAN-HALLUCINATION-001` | 2026-08-23 | JD-scan-hallucination ingest reorder — needs real models + owner present |
| 20 | `CONTACT-TRACK-TIGHT-001` | 2026-08-24 | Owner verify list — 6 sub-items (alignment, sidebar runts, CL spacing, Sirin result, abbreviation, contact tra |
| 52 | `GROUP-EMPTY-HIDE-001` | 2026-08-25 | (owner 2026-07-06, screenshot) — a labeled-list group (TOOLS & METHODS) with a heading bu |
| 1 | — | 2026-08-26 _(STANDING)_ | Quick-gen page convergence + CV 3-page convergence, export-only pagination parity |
| 11 | `SIDEBAR-PROMOTE-MARGIN-001` | 2026-08-26 _(STANDING)_ | SIDEBAR-PAGE23-DANCE CLOSED (verified 2026-07-03, headless): diag-sidebar-promote-margin (owner-scale sidebar  |
| 16 | `SID-FALLBACK-HARDEN-001` | 2026-08-26 _(STANDING)_ | Sidebar TOOLS/REGULATORY justify↔left flap — re-check after hard refresh, diagnose if persists |
| 17 | `SETTINGS-PERSONAL-STABILIZE-001` | 2026-08-26 _(STANDING)_ | Settings sweep-army cost on Layout/Account/Advanced panels (Personal panel already fixed) |
| 18 | `ANITA-PERSONA-NO-PHOTO-001` | 2026-08-26 | Anita demo residuals — docx-photo + PDF-contact legs ROOT-CAUSED + FIXED 2026-08-26 (desktop nightly, PWA 1.51 |
| 23 | `NIGHTLY-PREVIEW-BUTTON-AUDIT-001` | 2026-08-26 _(STANDING)_ | Preview-button audit pass 2 (65 not-visible, 23 overlay-obstructed) + live dangerous-button audit |
| 105 | `JOBSRC-FETCH-001` | 2026-08-26 | follow-through — teach the discovery routine to CALL job_sources.py instead of hand-fetching board search page |
| 106 | `POSTING-OBSOLETE-001` | 2026-08-26 | follow-through — wire check-postings.py --apply into the twice-weekly discovery run and the nightly, and settl |
| 102 | `DEMAND-SEED-SEARCH-TOKEN-MISSING-001` | 2026-08-26 | (found by the weekly demand-seed run 2026-08-26, first run to PROBE rather than assume). the routine's prescri |
| 107 | `IMPORT-REWRAP-SIBLING-DROP-001` | 2026-08-26 | (2026-08-26 desktop nightly, residual of row 18). The settings-import rewrap now carries photo across (1.51.44 |

---

_Split from a single 524 KB file on 2026-08-26 (owner-approved). Row text was moved verbatim,
never rewritten; `scripts/check-register.mjs` asserts every pre-split row still exists._
_Standing order: `docs/qa/NIGHTLY_BACKLOG_RECONCILE.md`._
_Seeded 2026-07-02 from ACTIVE_BUGS batches 1-8 + the PROJECT_ISSUES chain + MASTER_BACKLOG._
