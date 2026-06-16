# AntCV — Reconciled Old-Open Backlog

Generated 2026-06-16 by reconciling `docs/qa/MASTER_BACKLOG.md` + the next-session handoff
against the closure ledger in `docs/qa/ACTIVE_BUGS.md` (sha 3e457aa) and deployed code
(docx-worker 1.14.74, Pages deploy 69aec3a1). This is a derived roll-up, not a source of truth —
`ACTIVE_BUGS.md` top block still wins for execution.

Updated 2026-06-16 (cluster inspections 4 + 5): Generation/content dissolved (HOWCONTRIBUTE-001,
GEN-UNSOL-002 confirmed shipped via the ACTIVE_BUGS "stale OPEN tags — already shipped" block;
GEN-002b folded into CL-006); Settings closures applied (PRIVACY-DEMO-001 shipped 1.50.356,
PRIVACY-SETTINGS-001 fixed 1.50.81).

## Headline counts

| Stage | Count |
|---|---:|
| Rows exposed in handoff (Section A + B) | 169 |
| Unique IDs after removing exact dupes | 173 |
| After collapsing VF-* + nav-z aliases | 152 |
| After removing closures (verified in ACTIVE_BUGS / code) | 134 |
| After removing 2026-06-15 ACTIVE-queue items | 107 |
| After cluster-4/5 inspection closures | **102 true live old-open** |
| — of which Definition-of-Done meta gates (not discrete bugs) | 11 |
| — of which VERIFYING (code shipped, only owner closes) | 13 |
| **— genuinely actionable old bug/feature rows** | **78** |
| — of those, PROBE-FIRST (run probe before any code) | 5 |

## Legacy / staleness verdict

The '~160 old opens' figure is a **row count of an unreconciled legacy roll-up**, not live bugs.
Three structural inflations were confirmed:

1. **Aliases** — `VF-001..018` are second names for existing CL/WM/CA/PP/SO/PB rows; the
   `SETTINGS-NAV-Z-001` z-index trap absorbs APP-HISTORY-001, SETTINGS-SUBTAB-001, AH-001,
   APPHIST-ZIDX-001, VF-014, SETTINGS-AHZ-001 (owner: all one bug).
2. **Already closed** — the entire demo/shell cluster (DEMO-PERSIST/BADGE/TOGGLE, HARDREFRESH),
   the build blocker (APPJS-REBUILD-001), the pagination engine (ENGINE-PAGESPLIT-001/PB-007),
   PERSONAL-EDIT-CRASH-001, PACKAGE-PALETTE-MIX-001, SPECIALISATION-EDIT-001, EXPORT-PAGE2-001,
   plus the handoff's own owner-confirmed-resolved block — all were closed in ACTIVE_BUGS but
   the handoff (built from MASTER_BACKLOG) never reconciled them.
3. **Meta gates** — GEN-001..011 are §3 Definition-of-Done parity rules, enforced per-fix,
   not discrete tickets.

Residual staleness risk: the 13 VERIFYING items are code-shipped and likely already correct —
they only need an owner live check (Preview+DOCX/PDF, desktop+mobile). Cluster-4 inspection showed
"stale OPEN tags" are a real category — buried OPEN lines that a later ACTIVE_BUGS block already
closed — so expect a further fraction of the 78 actionable rows to fall out on contact.

## Closed since the handoff — DO NOT WORK (verified in ACTIVE_BUGS / code)

Includes cluster-4/5 inspection additions: `HOWCONTRIBUTE-001` (1.50.354), `GEN-UNSOL-002`
(1.50.358), `PRIVACY-DEMO-001` (1.50.356), `PRIVACY-SETTINGS-001` (1.50.81). `GEN-002b` folded into
`CL-006`.

`AI-NOTICE-WRONG-SIDE-001`, `ANALYSE-JD-BUTTON-POS-001`, `ANALYSIS-PANEL-MISSING-FIT-001`, `ANALYSIS-PANEL-ORDER-001`, `ANALYSIS-PRINT-COMPLETE-001`, `APPHISTORY-RELOAD-001`, `APPHISTORY-SAME-LINE-001`, `APPJS-REBUILD-001`, `BUILD-APP-BROKEN-001`, `CL-CONTACT-ONELINE-001`, `CL-DOUBLE-SALMON-001`, `CL-EMPTY-BODY-FIELDS-001`, `CL-EXPORT-EDGE-MARGINS-001`, `CL-GHOST-COMPANY-001`, `CL-NO-SALMON-001`, `CL-PAGINATE-001`, `CL-PDF-PRINT-PATH-001`, `CL-PREVIEW-WATERMARK-001`, `CL-SALMON-SLOW-001`, `COPENHAGEN-BLUE-BRIGHTER-001`, `CORE-COMP-RETRY-HANG-001`, `DEMO-BADGE-001`, `DEMO-FETCHJD-WORKERURL-001`, `DEMO-PERSIST-001`, `DEMO-RELAY-IDENTITY-001`, `DEMO-RELAY-IDENTITY-002`, `DEMO-TOGGLE-001`, `DOCX-CL-SECTION-WIDTH-001`, `DOCX-EXPORT-REGRESSION-001`, `DOCX-HEADER-BAND-001`, `DOCX-SIDEBAR-GREEN-001`, `ENGINE-PAGESPLIT-001`, `EXPORT-FALLBACK-ON-FIRST-001`, `EXPORT-PAGE2-001`, `EXPORT-PHOTO-POS-CLAMP-001`, `EXPORT-PREVIEW-FEATURES-001`, `FALLBACK-MODEL-001`, `GEN-BACKGROUND-001`, `GEN-UNSOL-002`, `GEN-UI-CANCEL-BUTTON-MOBILE`, `HARDREFRESH-001`, `HIWC-EDIT-001`, `HIWC-EDIT-002`, `HIWC-EDIT-003`, `HOWCONTRIBUTE-001`, `JD-CLOUD-VISIBILITY-001`, `JD-URL-DEMO-001`, `JD-URL-GEN-001`, `KERNEL-CLOUD-PERSIST-001`, `KERNEL-EXPERIENCE-EMPTY-001`, `KERNEL-HISTORY-KEEP-001`, `KERNEL-REGEN-DEADLOCK-001`, `KERNEL-REGEN-GUARD-001`, `KERNEL-SHOWCASE-EMPTY-SLOT-001`, `KERNEL-SPECIALIZATION-LINE-001`, `KERNEL-STUCK-LAST-CMD-001`, `LABEL-HISTORY-001`, `LINKEDIN-JD-SLUG-MORE-001`, `LLM-COST-QUALITY-ROUTER-001`, `LLM-CREDIT-400-MISCLASS-001`, `LLM-FALLBACK-MODEL-404-001`, `LLM-MAXTOKENS-TRUNCATION-001`, `LLM-QUALITY-PERSIST-001`, `LLM-SILENT-INADEQUATE-001`, `MAIN-HEADINGS-GREEN-001`, `NAME-ALIGN-001`, `PACKAGE-PALETTE-MIX-001`, `PB-007`, `PB-AUTO-OVERFLOW-001`, `PB-OUTCOMES-WIPE-001`, `PB-PREVIEW-GROUPNAME-EDIT-001`, `PB-PREVIEW-SIDEBAR-FILL-001`, `PB-PREVIEW-SIDEBAR-SALMON-PUSH-001`, `PB-WORKER-CL-LIST-CONT-001`, `PB-WORKER-CONT-DOUBLE-001`, `PB-WORKER-CONT-HEADER-001`, `PB-WORKER-SIDEBAR-CONT-001`, `PB-WORKER-SIDEBAR-FILL-001`, `PB-WORKER-SIDEBAR-PAGINATION-001`, `PDF-BLANK-PAGE-001`, `PERSONAL-EDIT-CRASH-001`, `PHOTO-001`, `PHOTO-002`, `PHOTO-004`, `PHOTO-005`, `PHOTO-POSITIONS-EXPORT-001`, `PREVIEW-CONT-HEADING-LEGACY-001`, `PREVIEW-PDF-GEOMETRY-001`, `PREVIEW-PDF-SIDEBAR-GEOM-001`, `PREVIEW-SUBTITLE-RACE-001`, `PRIVACY-DEMO-001`, `PRIVACY-FAB-FLICKER-001`, `PRIVACY-SETTINGS-001`, `PROD-STUB-001`, `PROFILE-END-COMMUNICATION-001`, `REGULAR-MODE-STALE-SETUP-001`, `RESULTS-LAMINATION-001`, `RESULTS-PDF-INK-BLACK-001`, `ROLE-DECOMP-001`, `SALMON-AUTO-EXPORT-001`, `SALMON-CHURN-DISAPPEAR-001`, `SALMON-CV-DUPLICATE-001`, `SALMON-CV-MAINROLE-BREAK-001`, `SALMON-EXPORT-EXPERIENCE-001`, `SALMON-MOBILE-001`, `SALMON-PARALLEL-COLUMNS-001`, `SECTION-RULE-INK-MATCH-001`, `SHARE-TARGET-JD-URL-001`, `SPECIALISATION-EDIT-001`, `TABLE-HEADER-MATCH-BAND-001`

## True live old-open backlog — 102 IDs by bucket

Tier key: **ACTIONABLE** = open, needs live repro then code · **PROBE-FIRST** = diagnostic probe
before any edit · **VERIFYING** = shipped, owner live-acceptance owed · **META** = DoD gate, not a ticket.

### Generation / content (13) — cluster DISSOLVED on inspection

11 meta DoD gates + 1 actionable worker item. HOWCONTRIBUTE-001 and GEN-UNSOL-002 closed (shipped);
GEN-002b folded into CL-006. GEN-001b is a worker-side kernel-generation item, not a UI ticket.

| ID | Tier | Aliases / note |
|---|---|---|
| GEN-001 | META | — |
| GEN-001b | ACTIONABLE | worker-side kernel generation (underfills CV sections) |
| GEN-002 | META | — |
| GEN-003 | META | — |
| GEN-004 | META | — |
| GEN-005 | META | — |
| GEN-006 | META | — |
| GEN-007 | META | — |
| GEN-008 | META | — |
| GEN-009 | META | — |
| GEN-010 | META | — |
| GEN-011 | META | — |
| GEN-UI-001..003 | ACTIONABLE | (counted under Generation UI bucket) |

### Settings / visual package (10) — FIRST AUTONOMOUS-VIABLE CLUSTER

| ID | Tier | Aliases / note |
|---|---|---|
| VISUAL-PKG-001 | ACTIONABLE | `[code]` relabel STYLE PACKAGE → Visual package (safest unit after WM) |
| VISUAL-PKG-002 | ACTIONABLE | `[islands]` enrich package buttons with icons |
| VISUAL-PKG-003 | ACTIONABLE | `[islands]` relocate descriptor next to Alt circles |
| MERGE-DUP-001 | ACTIONABLE | `[islands]` hide legacy select, bridge legacy buttons to WritingStylePicker |
| MERGE-DUP-002 | ACTIONABLE | `[console]` confirm dedup-341 split, merge tone-chip sections |
| MERGE-DUP-003 | ACTIONABLE | `[islands]` unify save tones into save customs |
| SECTION-LAYOUT-001 | ACTIONABLE | `[islands]` collapsible/collapsed; refresh on style change |
| LOCATION-001 | ACTIONABLE | `[code]` split Location into Location + City |
| DEMO-WARN-001 | ACTIONABLE | `[console]` gate "Setup needed" on demo-valid signal |
| SETTINGS-HEAD-001 | VERIFYING | `[console]` unify headline style; Languages placement (partial) |

### Cover letter (10)

| ID | Tier | Aliases |
|---|---|---|
| CL-001 | ACTIONABLE | VF-001 |
| CL-002 | ACTIONABLE | — |
| CL-003 | ACTIONABLE | VF-002 |
| CL-004 | ACTIONABLE | VF-003 |
| CL-005 | ACTIONABLE | — |
| CL-006 | ACTIONABLE | VF-017; absorbs GEN-002b (capture WIB table signals in CL generation) |
| CL-007 | VERIFYING | — |
| CL-BODY-CONTROLS-001 | ACTIONABLE | — |
| CL-HEADER-001 | PROBE-FIRST | — |
| CL-LAYOUT-002 | ACTIONABLE | — |

### Pagination / page-break (10)

| ID | Tier | Aliases |
|---|---|---|
| PAGEBREAK-002 | ACTIONABLE | — |
| PAGEBREAK-005 | ACTIONABLE | — |
| PB-001 | ACTIONABLE | — |
| PB-002 | ACTIONABLE | — |
| PB-003 | ACTIONABLE | — |
| PB-004 | PROBE-FIRST | TB-002 |
| PB-005 | VERIFYING | — |
| PB-006 | ACTIONABLE | VF-018 |
| PB-SIDEBAR-001 | ACTIONABLE | — |
| PDF-LAYOUT-001 | ACTIONABLE | — |

### List-row controls (tables/pubs/outcomes/move) (9)

| ID | Tier | Aliases |
|---|---|---|
| MERGED-MOVE-CONTROL-001 | ACTIONABLE | — |
| PP-001 | PROBE-FIRST | VF-010 |
| PP-002 | ACTIONABLE | — |
| PP-003 | PROBE-FIRST | — |
| PUB-ROW-MULTIROW-001 | ACTIONABLE | — |
| SO-001 | ACTIONABLE | VF-009 |
| SO-002 | ACTIONABLE | — |
| TB-001 | ACTIONABLE | — |
| TB-003 | VERIFYING | VF-008 |

### Performance (7)

| ID | Tier | Aliases |
|---|---|---|
| HIWC-RERENDER-LOOP-001 | ACTIONABLE | — |
| PERF-001 | ACTIONABLE | — |
| PERF-002 | ACTIONABLE | — |
| PERF-003 | ACTIONABLE | — |
| PERF-004 | ACTIONABLE | — |
| PERF-005 | ACTIONABLE | — |
| RERENDER-STORM-001 | ACTIONABLE | — |

### Import / language / wizard (7)

| ID | Tier | Aliases |
|---|---|---|
| IMPORT-001 | ACTIONABLE | — |
| IMPORT-COUNT-001 | ACTIONABLE | — |
| LANG-001 | ACTIONABLE | — |
| ONBOARD-001 | VERIFYING | — |
| WIZARD-001 | VERIFYING | — |
| WIZARD-002 | ACTIONABLE | — |
| WIZARD-BLIP-001 | ACTIONABLE | — |

### Mobile (7)

| ID | Tier | Aliases |
|---|---|---|
| MOB-ALT-001 | VERIFYING | — |
| MOB-BOTTOMNAV-001 | VERIFYING | — |
| MOB-TOPBAR-001 | VERIFYING | — |
| MOB-TOPBAR-002 | VERIFYING | — |
| MOBILE-EXTRACTION-001 | ACTIONABLE | — |
| MOBILE-FUSE-001 | ACTIONABLE | — |
| MOBILE-TABLEWIDTH-001 | VERIFYING | — |

### Candidate/application controls (6)

| ID | Tier | Aliases |
|---|---|---|
| APP-SENTENCE-STYLE-001 | ACTIONABLE | — |
| CA-001 | ACTIONABLE | VF-005 |
| CA-002 | ACTIONABLE | — |
| CA-003 | ACTIONABLE | VF-006 |
| CA-004 | ACTIONABLE | VF-007 |
| CA-005 | ACTIONABLE | — |

### Preview shell / nav-z (6)

| ID | Tier | Aliases |
|---|---|---|
| PRV-001 | ACTIONABLE | VF-011 |
| PRV-002 | ACTIONABLE | VF-012 |
| PRV-003 | ACTIONABLE | VF-013 |
| PRV-004 | ACTIONABLE | VF-015 |
| PRV-005 | VERIFYING | — |
| SETTINGS-NAV-Z-001 | PROBE-FIRST | VF-014, APP-HISTORY-001, SETTINGS-SUBTAB-001, SETTINGS-AHZ-001, AH-001, APPHIST-ZIDX-001 |

### Watermark (5) — SPEC COMPLETE (docs/qa/WM_AI_NOTICE_ANCHOR_SPEC_2026-06-16.md)

| ID | Tier | Aliases |
|---|---|---|
| WM-001 | ACTIONABLE | VF-004 |
| WM-002 | ACTIONABLE | — |
| WM-003 | (closed — owner-confirmed) | — |
| WM-004 | ACTIONABLE | — |
| WM-005 | ACTIONABLE | — |

### Layout / export / responsive (4)

| ID | Tier | Aliases |
|---|---|---|
| EXPORT-001 | ACTIONABLE | — |
| EXPORT-002 | ACTIONABLE | — |
| LAYOUT-001 | ACTIONABLE | — |
| RESPONSIVE-001 | ACTIONABLE | — |

### Generation UI (3)

| ID | Tier | Aliases |
|---|---|---|
| GEN-UI-001 | ACTIONABLE | — |
| GEN-UI-002 | ACTIONABLE | — |
| GEN-UI-003 | ACTIONABLE | — |

### Planned features (2)

| ID | Tier | Aliases |
|---|---|---|
| DELETE-SAVE-001 | ACTIONABLE | — |
| FEATURE-CONF-001 | ACTIONABLE | — |

### Other (2)

| ID | Tier | Aliases |
|---|---|---|
| LOGIN-GATE-001 | ACTIONABLE | — |
| VAL-001 | VERIFYING | VF-016 |

### Photo (2)

| ID | Tier | Aliases |
|---|---|---|
| PHOTO-003 | ACTIONABLE | — |
| PHOTO-PLACEMENT-001 | ACTIONABLE | — |

## PROBE-FIRST set (run these before touching code)

- **CL-HEADER-001** — `antcv-cl-header-probe.js`; the application header attach (`wrapApplicationSentence`) lands on the wrong node / wrong font.
- **PB-004** — table row-break needs a per-document-keyed store (CV-Core vs CL-WIB must not collide on a shared section id) reaching the DOCX worker `row_pages`; not a hotfix.
- **PP-001** — Publications controls historically clipped (273 grid→flex); needs prod/relay DOM.
- **PP-003** — HIGH-RISK shared row-control model; confirm `pub-injected-reaper-352` before any edit.
- **SETTINGS-NAV-Z-001** — `antcv-apphist-zindex-probe.js`; settings/app-history renders behind the preview (z-index trap).

## Cluster inspection status (2026-06-16)

| Cluster | Verdict |
|---|---|
| Watermark (5) | SPEC COMPLETE; autonomous-viable. |
| Settings / visual package (10) | First autonomous-viable cluster; safe subset = VISUAL-PKG-001/002/003 + MERGE-DUP-001/003. |
| List-row controls (9) | NOT autonomous — owner-present, probe-first (7 prior failed iterations; SectionControlBar migration). |
| Pagination (10) | Engine shipped; remainder live-rendered, owner-present. |
| Generation / content (13) | Dissolved — 11 meta, 2 shipped, GEN-002b→CL-006, GEN-001b worker-side. |

## 2026-06-15 ACTIVE-queue items removed from this list (tracked in ACTIVE_BUGS top block)

`ADDITIONAL-INFO-HIDE-WHEN-INTERESTS-001`, `ADDITIONAL-INFO-SPLIT-001`, `AI-WATERMARK-EXPORT-LOCATION-001`, `BAND-HEADER-BG-SEAM-001`, `CL-FORMAT-CONTROL-001`, `CL-PREVIEW-TABLE-WIDTH-001`, `CL-TABLE-DIMS-FALLBACK-001`, `CL-WIDTH-CAP-001`, `DISCLOSURE-TRIANGLE-CONSISTENCY-001`, `DOC-SUPERVISION-001`, `EXP-TENSE-NOT-APPLYING-001`, `EXPORT-PREVIEW-ZOOM-001`, `HIWC-ORPHAN-TIGHTEN-001`, `INTERESTS-CONTENT-001`, `LANGUAGES-CARD-PERSONAL-001`, `OUTCOMES-FORMAT-RESULTS-OPTION-001`, `PDF-ASK-WHERE-TO-SAVE-001`, `PREVIEW-EXPORT-PAGEBREAK-PARITY-001`, `PROFILE-UNSOLICITED-GENERIC-001`, `RESULTS-DOCX-MISSING-001`, `RESULTS-METRIC-SHARPNESS-001`, `RESULTS-TIGHTENING-STRIP-001`, `SECTION-LAYOUT-GRAPHIC-001`, `SECTION-TYPE-NORMALIZE-INLINE-001`, `SETTINGS-SCROLL-RESET-001`, `SIDEBAR-NARROW-FIGURE-OVERLAP-001`, `SUBSECTION-RENAME-REORDER-001`
