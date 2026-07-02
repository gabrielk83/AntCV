# OPEN REGISTER — rolling consolidated backlog (maintained by the nightly reconcile slot)

> Standing order: `docs/qa/NIGHTLY_BACKLOG_RECONCILE.md`. This file is a ROLL-UP —
> prose detail lives in the linked docs. Rows are ordered oldest-verified-first so
> the nightly slot always chews the stalest end. `verified:` = the last date a
> human/agent confirmed the row against the CURRENT code, not the date it was filed.
> Seeded 2026-07-02 from ACTIVE_BUGS batches 1-8 + the PROJECT_ISSUES chain + MASTER_BACKLOG.
> **RENUMBERED 2026-07-03 (owner ask: "show what is actually open"):** closed rows moved to
> the CLOSED section below; references to old row numbers in ACTIVE_BUGS batches ≤15 use the
> OLD numbering. Verify-first sweep 2026-07-03 closed old rows 1, 5, 10(core), 13, 14, 20, 25-29.

## OPEN — verify-first queue (oldest/staleness first)

| # | Item | Source / detail | verified |
|---|------|-----------------|----------|
| 1 | Quick-gen page convergence + CV 3-page convergence, export-only pagination parity | NEXT_SESSION_2026-06-29 (render-gated set) | no |
| 2 | SW-projects hyperlink + line-end overflow | 2026-06-29 batch OPEN list | no |
| 3 | Page-anchored floating spine (sidebar navy fill to page bottom — real fix; PAGE1_BODY_MIN pins stay) | memory sidebar-fill-gap; ACTIVE_BUGS | no |
| 4 | rich_block RULE editor decoupling — EDITOR half ("— Rule" button disabled when headline hidden); export half DONE (headlineRule + WHY-RULE-EXPORT-PARITY-001, 1.51.64) | 2026-06-28 queued feature | partial 2026-07-02 |
| 5 | Candidate-header: Contact row click collapses section + per-field rule lines | 2026-06-28 diagnosed/queued | no |
| 6 | Wizard+Settings UX tier-2/3 structural items | docs/qa/WIZARD_SETTINGS_UX_2026-06-16.md | no |
| 7 | CL slogan/signature F3 — distinct CL-format panel placement | memory cl-slogan-signature | no |
| 8 | Kernel v2 REMAINDER only — the core is SHIPPED (the old "not started" row was stale): Task 1a + §2 TENSE (1.50.515) + §3 LANG-CROSS (1.50.516) + §4 ingestion engine/extraction/UI/D1/reader-bridge/auto-sync (1.50.517-521 + relay kernel-v2 routes) are all live. REMAINING: (a) migrate generation readers to consume `kernel_v2` DIRECTLY (tense/history still read the v1 `history` bridge), (b) surface per-role `langInvariantTokens[]` as the explicit DO-NOT-TRANSLATE list in STORED WORK HISTORY, (c) expand cross-language beyond the EN/DA flag to es/zh + the lazy `language_view` tier (LANG-EXPAND-001), (d) §6 regression parity pass (P/DOCX/PDF, desktop+mobile) on a sample UPLOADED docx | docs/plan/KERNEL-V2-AND-INGESTION.md (status log) | 2026-07-03 |
| 9 | Cluster demand model: worker pipeline + nightly recruitment-site refresh | memory cluster-demand-model | no |
| 10 | Ordering spec: JD-cluster top-20 skills weighting | memory ordering-jd-cluster-top-skills (not modelled) | no |
| 11 | SIDEBAR-PAGE23-DANCE — likely CLOSED (sig-cache 1.50.9xx + SIDEBAR-PROMOTE-MARGIN-001 1.51.63); live verify + close | 2026-06-28 diagnosed | no |
| 12 | diag-ai-notice-anchor RED since worker 1.14.75 (one of the 4 standing docx-diag baseline fails: ai-notice-anchor, cjlr-table-export, pageflow-export, spacing-linkedin-export) | memory stale-status-deadflags | no |
| 13 | PAN-IDRAET-BULLET-NEARDUP-001 preview-side hide — export half SHIPPED 1.51.70 (sanitizeForExport collapse); preview hide DEFERRED (index-based edit path, ORPHAN-WRITE-VERIFY risk; needs live browser + index-safe marker) | memory preview-memo-results-only; NIGHTLY 07-03 | partial 2026-07-03 |
| 14 | JD-SCAN-HALLUCINATION-001 ingest reorder (garble → vision FIRST; filename↔company check; "used OCR" notice) — needs real models/owner present | ACTIVE_BUGS; ORPHANS_V2 prompt stretch | 2026-07-02 |
| 15 | GEN-UNSOL-STALE-JD-001 Patch D (scrub known prior company when meta.company returns empty) — partially mitigated by CL-PROSE-UNSOL-POISON-001 (1.51.75) + JD-SCOPE-ISOLATION (1.51.72/73); re-verify what remains | ACTIVE_BUGS 1.51.54 block | 2026-07-02 |
| 16 | Latent sid-fallback pattern in 234/247/249 (giant-container grab when the target section is absent; 237 hardened 1.51.60) | SETTINGS batch 5 note | 2026-07-02 |
| 17 | Settings sweep-army burst cost (heavy-but-recovering churn under owner-scale kernel: 279/356/341/language-ui) — optimization track | freeze diag profiles (batches 5+7) | 2026-07-02 |
| 18 | Anita demo residuals: docx missing photo + PDF contact placement are SESSION-STATE-gated (re-import persona + hard-refresh + re-export decides); CL foundation/bring/interests on a fresh Anita gen | ACTIVE_BUGS batches 8-9 | 2026-07-02 |
| 19 | JD-SCOPE-ISOLATION residuals: cold-restore occ-2 ("manual-save sentinel" path) NOT device-guarded; multi-device flow unit+headless verified but NOT tested with two real devices; `shouldAdoptCloudPointer` wired only for the JD-inherit case | ACTIVE_BUGS 2026-07-03 JD-scope entry; memory jd-scope-isolation | 2026-07-03 |
| 20 | OWNER VERIFY LIST (consolidated, batches 12-16 + parallel sessions) — one Hard Refresh + CL regen + CV re-export checks all: (a) p2/p3 sidebar↔main headline alignment — wk 1.14.122 spacer, round-2 fix NOT yet proven in a real CloudConvert PDF (round 1 failed there); (b) sidebar runts gone (1.51.75 font-metric + 1.51.72 tighten); (c) CL +12/+6px signature spacing + the 3 line-fill slots (regen, prompt-level); (d) Sirin Result numberless (1.51.76) and an inline edit STICKS; (e) "Uni. of Toronto" abbreviation in the export; (f) contact letter-tracking (CONTACT-TRACK-TIGHT-001, wk 1.14.123) | ACTIVE_BUGS batches 12-16 | 2026-07-03 |

## CLOSED (evidence; most recent first)

- Old row 13 (DATA-LOSS load-grace guard) — VERIFIED 2026-07-03: DATA-LOSS-LOAD-GRACE-001 code in BOTH bundles (`__hasReal` guard ×6 in app.js; the ID string is a src-only comment).
- Old row 14 (access-relay D1-WRITE-RETRY) — VERIFIED 2026-07-03: D1-WRITE-RETRY-001 in workers/access-relay/src/index.js (retry wrapper + 2 call sites); relay redeployed 2026-07-03 (JD-SCOPE Stage 2). Watch: `d1_write_failed` recurrence in telemetry.
- Old row 10 CORE (Kernel v2 + upload→kernel ingestion) — was stale "not started": SHIPPED 1.50.515-521 + relay kernel-v2 routes per docs/plan/KERNEL-V2-AND-INGESTION.md status log (D1 staging, tense, language, ingest engine, file extraction, import UI + conflict/gap modals, D1 persistence, entry button, reader bridge, auto-sync, structured apply, language step). Remainder tracked as NEW row 8.
- Old row 5 (photo bridge in-cell float-wrap) — SUPERSEDED by FIGURE-CONTACT-REF-001 (wk 1.14.120): the page-anchored medallion escapes the column/table entirely (worker comment marks the supersession); owner confirmed placement good 2026-07-03.
- Old row 29 (SIDEBAR-HEADLINE-PAGE2-ALIGN + HEADER-CONTACT-PHOTO-FIT) — batch 12/13: align round 2 = wk 1.14.122 spacer paragraph (owner PDF confirm rides new row 20a); contact fixed wk 1.14.120, owner confirmed placement, tracking tightened wk 1.14.123 (eyeball rides new row 20f).
- Old rows 25-28 (CL line-fill + signature spacing; CV orphans root cause; TA/SG results; core-comp table padding) — batches 12-13, PWA 1.51.71/72 + wk 1.14.121/122; sidebar runt mystery closed batch 15 (SIDEBAR-FONT-METRIC-001, 1.51.75, 8/8 proven in diag-orphan-preflight-sidebar.mjs).
- Old row 20 (gen-prompt example-text leftovers) — GEN-DEHARDCODE-003, 1.51.67; de-hardcode sweep COMPLETE.
- Old row 1 (candidate-header 3-col grid) — superseded by owner reference DOCX geometry (wk 1.14.119/120), deployed + owner-confirmed 2026-07-03.
- Owner round-2 batch 13: RESULTS-PIN-OWNER-EDIT-001 + SIDEBAR-TIGHTEN-001 (1.51.72) + ALIGN-002 (wk 1.14.122); batch 14: COMPRESSION-VS-LINE-WIDTH-001 general rule + TONE-DEFAULT-SCANDINAVIAN-002 (1.51.74); batch 16: RESULTS-PIN-NO-NUMBER-001 (1.51.76).
- Orphans v2 (EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001) — 1.51.57; sidebar half 1.51.71/75.
- Demo/template flicker loops — 1.51.56/1.51.59. CL base template struct — 1.51.58; converters tone-default + hydration family — 1.51.64.
- Gabriel gen-prompt de-hardcode rounds — 1.51.60/62/64/67 (+ workers 3.7.x). Demo-proxy gen-job/coherence/salary parity — workers 3.7.0, verified live.
- Preview pagination promotion gate (SIDEBAR-PROMOTE-MARGIN-001) — 1.51.63. app.js conflict-marker incident — broken 1.51.65, repaired 1.51.66.
- Demo-cap UX (DEMO-CAP-UX-001) — 1.51.68/69. PAN-IDRAET export half — 1.51.70.
