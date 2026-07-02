# OPEN REGISTER — rolling consolidated backlog (maintained by the nightly reconcile slot)

> Standing order: `docs/qa/NIGHTLY_BACKLOG_RECONCILE.md`. This file is a ROLL-UP —
> prose detail lives in the linked docs. Rows are ordered oldest-verified-first so
> the nightly slot always chews the stalest end. `verified:` = the last date a
> human/agent confirmed the row against the CURRENT code, not the date it was filed.
> Seeded 2026-07-02 (late session) from ACTIVE_BUGS batches 1-8 + the
> PROJECT_ISSUES_OPEN_CLOSED chain (07-02 ← 07-01 ← 06-30 ← 06-29) + MASTER_BACKLOG +
> FEATURES_REGISTRY + auto-memory. Chain items not re-verified tonight carry `verified: no`.

## OPEN — verify-first queue (oldest/staleness first)

| # | Item | Source / detail | verified |
|---|------|-----------------|----------|
| 1 | ~~Candidate-header 3-col-grid placement (spread-left #2)~~ CLOSED — the 06-29 3-col-grid plan was SUPERSEDED by the owner's reference DOCX geometry, shipped as CONTACT-FULLWIDTH-001 (wk 1.14.119) + FIGURE-CONTACT-REF-001 (wk 1.14.120: page-anchored 1.50" medallion posH 0.433", contact 8pt ind 1.8"); 1.14.120 sat committed-but-UNDEPLOYED until 2026-07-03 (live /health said 1.14.119) — deployed + verified live 2026-07-03; pixel confirmation rides row 29 | NEXT_SESSION_2026-06-29 → wk 1.14.119/120 | 2026-07-03 |
| 2 | Quick-gen page convergence (#4) + CV 3-page convergence, export-only pagination parity | NEXT_SESSION_2026-06-29 (render-gated set) | no |
| 3 | SW-projects hyperlink + line-end overflow | 2026-06-29 batch OPEN list | no |
| 4 | Page-anchored floating spine (sidebar navy fill to page bottom — real fix; PAGE1_BODY_MIN pins stay) | memory sidebar-fill-gap; ACTIVE_BUGS | no |
| 5 | Photo bridge: in-cell float-wrap | memory photo-bridge-nonfloat | no |
| 6 | rich_block RULE editor decoupling ("— Rule" button disabled when headline hidden). Export half DONE (headlineRule + WHY-RULE-EXPORT-PARITY-001 1.51.64) | 2026-06-28 queued feature | partial 2026-07-02 |
| 7 | Candidate-header: Contact row click collapses section + per-field rule lines | 2026-06-28 diagnosed/queued | no |
| 8 | Wizard+Settings UX tier-2/3 structural items | docs/qa/WIZARD_SETTINGS_UX_2026-06-16.md | no |
| 9 | CL slogan/signature F3 — distinct CL-format panel placement | memory cl-slogan-signature | no |
| 10 | Kernel v2 + upload→kernel ingestion | docs/plan/KERNEL-V2-AND-INGESTION.md (not started) | no |
| 11 | Cluster demand model: worker pipeline + nightly recruitment-site refresh | memory cluster-demand-model | no |
| 12 | Ordering spec: JD-cluster top-20 skills weighting | memory ordering-jd-cluster-top-skills (not modelled) | no |
| 13 | DATA-LOSS residual: client load-grace guard — likely CLOSED (DATA-LOSS-LOAD-GRACE-001 1.50.957); verify + close | memory data-loss-on-restore vs 06-29 batch | no |
| 14 | Access-relay D1-WRITE-RETRY deploy — likely CLOSED (memory: deployed 2026-07-02); verify `d1_write_failed` gone + close | PROJECT_ISSUES 07-02 carry-forward #2 | no |
| 15 | SIDEBAR-PAGE23-DANCE — likely CLOSED (sig-cache 1.50.9xx + SIDEBAR-PROMOTE-MARGIN-001 1.51.63); verify live + close | 2026-06-28 diagnosed | no |
| 16 | diag-ai-notice-anchor RED since worker 1.14.75 | memory stale-status-deadflags | no |
| 17 | PAN-IDRAET-BULLET-NEARDUP-001 — EXPORT half SHIPPED 1.51.70 (within-role near-dup collapse in sanitizeForExport, single-source both modes, KEEP_MIN=2, cleaner line wins). Preview-side hide DEFERRED (index-based edit path — ORPHAN-WRITE-VERIFY risk; needs live browser + index-safe marker) | memory preview-memo-results-only; NIGHTLY 07-03 Task 4.2 | partial 2026-07-03 |
| 18 | JD-SCAN-HALLUCINATION-001 ingest reorder (garble → vision FIRST; filename↔company check; "used OCR" notice) — needs real models/owner present | ACTIVE_BUGS; ORPHANS_V2 prompt stretch | 2026-07-02 |
| 19 | GEN-UNSOL-STALE-JD-001 Patch D (scrub known prior company when meta.company returns empty) | ACTIVE_BUGS 1.51.54 block | 2026-07-02 |
| 20 | ~~Gen-prompt example-text leftovers~~ CLOSED — GEN-DEHARDCODE-003 shipped 1.51.67 (all five example lists neutralized; sweep complete, see CLOSED list) | GEN-DEHARDCODE-002 report → ACTIVE_BUGS batch 10 | 2026-07-02 |
| 21 | Latent sid-fallback pattern in 234/247/249 (giant-container grab when the target section is absent; 237 hardened 1.51.60) | SETTINGS batch 5 note | 2026-07-02 |
| 22 | Settings sweep-army burst cost (heavy-but-recovering churn under owner-scale kernel: 279/356/341/language-ui) — optimization track | freeze diag profiles (batches 5+7) | 2026-07-02 |
| 23 | Anita demo residuals (batch-9 narrowed): docx missing photo + PDF contact placement are SESSION-STATE-gated (bridge indent verified correctly photo-gated in the worker; re-import persona + hard-refresh + re-export decides). Hill&Colony header was an EXTRACTION artifact — present in the PDF; the real issue was the Results bleed (fixed via per-role results, re-import gated) | ACTIVE_BUGS batch 9 | 2026-07-02 |
| 24 | OWNER regen verifications owed: orphan preflight acceptance set (hard-refresh first!); CL foundation/bring/interests on a fresh Anita gen; Gabriel CL unchanged-good | ACTIVE_BUGS batches 7-8 | 2026-07-02 |
| 25 | ~~CL-LINE-FILL-RESIDUAL-001 + CL-SIGNATURE-SPACING-001~~ CLOSED (batch 12, 1.51.71 + wk 1.14.121) — LINE-FILL-SLOTS-001 prompt rule now names opening_content / foundation_hands_on / foundation_professionally (last line must fill; <~60 chars → add stored detail); signature spacing +12px/+6px shipped in the worker (closing before 330, name before 150) AND both preview paths (React 26/14, HTML 21pt/12.5pt). LINE-FILL half is prompt-level — owner regen confirms | ACTIVE_BUGS batch 12 | 2026-07-03 |
| 26 | ~~CV-ORPHANS-RESIDUAL-001~~ CLOSED (batch 12, 1.51.71) — NOT stale-SW: all 7 runts in the owner's PDF (fracs 0.15-0.27, PyMuPDF-measured) were SIDEBAR labeled values; the preflight was main-column-only BY DESIGN. SIDEBAR-ORPHANS-001 extends it: sidebar labeled_list values measured at sidebar geometry + L2 NBSP-bound, never L3, never stored-section writes | ACTIVE_BUGS batch 12 | 2026-07-03 |
| 27 | ~~ROLE-RESULTS-MISSING-TA-SG-001~~ CLOSED (batch 12, 1.51.71) — Security Guard result VERIFIED PRESENT in the owner's PDF p3 (no bug); Teaching Assistant had NO pin anywhere (the TAU split leaves a bare title the RA matcher misses). TA pin added to PINS + _GAB_EXACT + kernel role_results_exact (SEM/Raman/confocal training — stored fact); merged "R&D and Teaching Assistant" excluded by lookahead | ACTIVE_BUGS batch 12 | 2026-07-03 |
| 28 | ~~CORECOMP-TABLE-CELL-PAD-001~~ CLOSED (batch 12, wk 1.14.121 + 1.51.71) — worker table cell L/R margins 90→150 DXA (6px→10px, header + data rows); preview parity (React 7px→10px L/R, HTML 5pt→7.5pt) | ACTIVE_BUGS batch 12 | 2026-07-03 |
| 29 | ~~SIDEBAR-HEADLINE-PAGE2-ALIGN-001 + HEADER-CONTACT-PHOTO-FIT-001~~ CLOSED (batch 12) — sidebar half: each page is its own two-column table (cell top margins re-apply); measured 5pt sidebar-higher on p2-3 → continuation pages add +100 DXA to the sidebar cell top (wk 1.14.121; page 1 keeps 240). Contact half: already fixed by wk 1.14.120 (owner's PDF predates the deploy); owner re-export confirms both | ACTIVE_BUGS batch 12 (owner pics) | 2026-07-03 |

## CLOSED this seeding (evidence)

- Owner PDF review batch 11 (rows 25-29) — resolved in batch 12: PWA 1.51.71 + docx-worker 1.14.121 (commit f98b07b; suite 699/699, docx diags 34/38 == baseline, boot-smoke green). Owner re-export + CL regen confirm the visuals.

- Orphans v2 (EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001) — 1.51.57; real-font diag clears the acceptance set; owner PDF gate pending (row 24).
- Demo/template flicker loops (STORM-EMPTY-SLOT-CONVERGE-001, PW-CJLR-FOREIGN-SECTION-001) — 1.51.56/1.51.59.
- CL base template struct (TEMPLATE-STRUCT-DEFAULT-001) — 1.51.58; converters tone-default + hydration family — 1.51.64.
- Gabriel gen-prompt de-hardcode rounds — 1.51.60/62/64 (+ workers 3.7.x).
- Demo-proxy gen-job/coherence/salary parity — workers 3.7.0, deployed + verified live.
- Preview pagination promotion gate (SIDEBAR-PROMOTE-MARGIN-001) — 1.51.63.
- app.js conflict-marker incident — shipped broken as 1.51.65, repaired 1.51.66 (verified live).
- Gen-prompt example-list leftovers (row 20) — GEN-DEHARDCODE-003, 1.51.67 (translator KEEP-VERBATIM, LANG-CROSS metrics/tech, tools taxonomy, cert relevance, patent bullet; tests gen-prompt-dehardcode 003 blocks). De-hardcode sweep COMPLETE.
- Demo-cap UX (cap 429 mis-advised as transient rate limit; Anita skeleton placeholders were the cap symptom) — DEMO-CAP-UX-001, 1.51.68 (ladder stop + banner + fail-fast; BYOK passes; unit/demo-cap-ux.test.mjs); quintet 1.51.69.
- Candidate-header 3-col-grid placement (row 1, spread-left #2) — superseded by owner-reference geometry CONTACT-FULLWIDTH-001 (wk 1.14.119) + FIGURE-CONTACT-REF-001 (wk 1.14.120); root cause of the batch-11 HEADER-CONTACT-PHOTO-FIT-001 report was 1.14.120 committed-but-UNDEPLOYED (live /health = 1.14.119 at owner's export). Deployed 2026-07-03 via deploy.yml (run 28602458782), live /health = 1.14.120-figure-contact-ref; suite 781/781 + diag-photo-bridge-export + diag-contact-fullwidth green pre-deploy. Owner pixel check rides row 29.
