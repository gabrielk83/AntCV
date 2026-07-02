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
| 1 | Candidate-header 3-col-grid placement (spread-left #2) | NEXT_SESSION_2026-06-29 | no |
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
| 17 | PAN-IDRAET-BULLET-NEARDUP-001 (within-role near-dup bullets) — blocked on preview memo emitting bullets too | memory preview-memo-results-only; NIGHTLY 07-03 Task 4.2 | 2026-07-02 |
| 18 | JD-SCAN-HALLUCINATION-001 ingest reorder (garble → vision FIRST; filename↔company check; "used OCR" notice) — needs real models/owner present | ACTIVE_BUGS; ORPHANS_V2 prompt stretch | 2026-07-02 |
| 19 | GEN-UNSOL-STALE-JD-001 Patch D (scrub known prior company when meta.company returns empty) | ACTIVE_BUGS 1.51.54 block | 2026-07-02 |
| 20 | ~~Gen-prompt example-text leftovers~~ CLOSED — GEN-DEHARDCODE-003 shipped 1.51.67 (all five example lists neutralized; sweep complete, see CLOSED list) | GEN-DEHARDCODE-002 report → ACTIVE_BUGS batch 10 | 2026-07-02 |
| 21 | Latent sid-fallback pattern in 234/247/249 (giant-container grab when the target section is absent; 237 hardened 1.51.60) | SETTINGS batch 5 note | 2026-07-02 |
| 22 | Settings sweep-army burst cost (heavy-but-recovering churn under owner-scale kernel: 279/356/341/language-ui) — optimization track | freeze diag profiles (batches 5+7) | 2026-07-02 |
| 23 | Anita demo residuals (batch-9 narrowed): docx missing photo + PDF contact placement are SESSION-STATE-gated (bridge indent verified correctly photo-gated in the worker; re-import persona + hard-refresh + re-export decides). Hill&Colony header was an EXTRACTION artifact — present in the PDF; the real issue was the Results bleed (fixed via per-role results, re-import gated) | ACTIVE_BUGS batch 9 | 2026-07-02 |
| 24 | OWNER regen verifications owed: orphan preflight acceptance set (hard-refresh first!); CL foundation/bring/interests on a fresh Anita gen; Gabriel CL unchanged-good | ACTIVE_BUGS batches 7-8 | 2026-07-02 |

## CLOSED this seeding (evidence)

- Orphans v2 (EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001) — 1.51.57; real-font diag clears the acceptance set; owner PDF gate pending (row 24).
- Demo/template flicker loops (STORM-EMPTY-SLOT-CONVERGE-001, PW-CJLR-FOREIGN-SECTION-001) — 1.51.56/1.51.59.
- CL base template struct (TEMPLATE-STRUCT-DEFAULT-001) — 1.51.58; converters tone-default + hydration family — 1.51.64.
- Gabriel gen-prompt de-hardcode rounds — 1.51.60/62/64 (+ workers 3.7.x).
- Demo-proxy gen-job/coherence/salary parity — workers 3.7.0, deployed + verified live.
- Preview pagination promotion gate (SIDEBAR-PROMOTE-MARGIN-001) — 1.51.63.
- app.js conflict-marker incident — shipped broken as 1.51.65, repaired 1.51.66 (verified live).
- Gen-prompt example-list leftovers (row 20) — GEN-DEHARDCODE-003, 1.51.67 (translator KEEP-VERBATIM, LANG-CROSS metrics/tech, tools taxonomy, cert relevance, patent bullet; tests gen-prompt-dehardcode 003 blocks). De-hardcode sweep COMPLETE.
- Demo-cap UX (cap 429 mis-advised as transient rate limit; Anita skeleton placeholders were the cap symptom) — DEMO-CAP-UX-001, 1.51.68 (ladder stop + banner + fail-fast; BYOK passes; unit/demo-cap-ux.test.mjs); quintet 1.51.69.
