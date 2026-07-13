# Backlog reconcile — pre-register June-era items (2026-07-13)

Verify-first sweep of the June-era `ACTIVE_BUGS.md` / `MASTER_BACKLOG.md` items that
predate the `OPEN_REGISTER.md` renumbering and were never re-checked against current
code. Verdicts are evidence-based (file:line / commit / version marker), verified
against PWA `1.51.580`, docx-worker `1.14.150`, access-relay `auth-33`. An item is
FIXED only with concrete evidence, not absence of complaints.

**Headline: 18 FIXED-with-evidence, 13 still OPEN/PARTIAL.** The June-era raw owner
lists (`ACTIVE_BUGS.md:1893-1899`, `:3734-3745`) are superseded copies — several items
they still tag `[OPEN]` shipped long ago; treat those two blocks as historical.

## FIXED (concrete evidence)

| Item | Evidence |
|---|---|
| EXPORT-002 — PDF fail → visible recovery + retry | `antcv-pdf-error-toast.js` v1.40.194 (index.html:879); dispatch `antcv-docx-client.js:3856`; auto print-fallback `app.src.js:49949-49963`; 1× network retry `antcv-docx-client.js:476-487`. Recovery = amber toast + auto `window.print()`; retry automatic not a button |
| LOGIN-GATE-001 — boot order | `antcv-login-loading-gate.js` v1.50.722 (index.html:84) masks wizard flash + runs orphan/palette migration underneath. Live boot-order eyeball is the only residual |
| HARDREFRESH-001 — confirm fires, no reload | `antcv-hardrefresh-force-349.js` v1.50.789 bounded-await cleanup (2500ms) then forceReload, capture-phase hook (:105-135). Commits f39705b/453aad9, closed 1403f83 |
| DEMO-PERSIST-001 — demo user classed paid | `workers/access-relay/src/index.js:565-572` getUserMode pins DEMO_EMAILS to 'demo' |
| DEMO-BADGE-001 — badge hardcoded to email | `app.src.js:1505-1511` `__antcvDemoActive()` reads live `demo_mode` (+ BYOK suppress) |
| PRIVACY-DEMO-001 — LED invisible in demo | commit 073de89 (1.50.356) "pill stays visible", closed 8bb4d59; `antcv-privacy-led.js` (index.html:724) |
| SETTINGS-SUBTAB-001 / APPHIST-ZIDX-001 / APP-HISTORY-001 | commit 5cc08f5 (1.50.355) SETTINGS-NAV-Z-001 + sidecars settings-front-327, app-history-zfix-291, app-history-back-to-preview-341. Live z-index eyeball owed |
| GEN-UNSOL-002 — header falls to Unsolicited | commit ea30b2f (1.50.358); `app.src.js:26327-26342` keeps JD-grounded company, scrubs placeholders; GEN-UNSOL-003 hardening 1.50.391 |
| HOWCONTRIBUTE-001 — HWIC bullets missing in preview | commit bbf4d59 (1.50.354), closed 8bb4d59; how-contribute-controls-245 + hwic-to-rich-block-760 |
| PERF-002 — consensus quorum (2-3 of 4) | `app.src.js:27873-27902` `__quorumSettle`, called quorum 2/20000ms (:27915, :28000) |
| PERF-004 — enrich↔compress convergence skip | `app.src.js:28233-28259` `__tightSkip` (comment "PERF-004 (1.50.359)") |
| CL-HEADER-001 — Application: line editable | `antcv-candidate-preview-editor-341.js:262` wrapApplicationSentence editable leaves (CA-002), v1.51.139 |
| NAME-ALIGN-001 — preview half | `antcv-name-align-fix.js` v1.1.0 (index.html:813) applies stored CJLR to name node via !important |
| PRIVACY-FAB-FLICKER-001 (source) | commit 073de89 / 1.50.356; MASTER_BACKLOG FIXED✓ "at source". True confirm needs live render |
| ANALYSIS-SALARY-001 — fit-panel salary | `workers/proxy/src/jd-analysis.js:55` schema + `:226` `salary_estimate`; shipped 1.50.450, tests 18/18 |
| WIZARD-LANG-SELECTOR-001 — two side-by-side tables | `antcv-wizard-language-slide-339.js` reorderable, ★ default; CLOSED 1.50.412, diag 3/3 |
| PROCESSING-QUEUE-INDICATOR-001 — contradiction | badge half shipped (`Ce` per-section states app.src.js ~3835-3905); CJLR-everywhere CLOSED (1.50.381/383). Status-column "remains" note is stale vs Notes |
| PACKAGE-PALETTE-MIX-001 — orphan 'scandinavian' | APPJS-ID-SCHEME-UNIFY 1.50.387: app.src.js:313 + map :15150 + migrate-in-place :19595; diag 3/3. FT-VISUAL-PACKAGES row-42 "OPEN" is stale |

## Still OPEN / PARTIAL

| Item | State | Note |
|---|---|---|
| PERF-005 — retire redundant /api/jd-analysis | PARTIAL | jd-analysis.js still separate; full fold tried 1.50.154, reverted (GEN-EMPTY-001); merge-344 only reuses it |
| HIWC-RERENDER-LOOP-001 | PARTIAL / UNVERIFIABLE | sidecars passively avoid it; needs live rAF/mutation profiling |
| GRAMMAR-MARKER-SCROLL-LAG-001 (mobile) | OPEN | overlay re-sync on scroll not shipped; mobile live test |
| PDF-ASK-WHERE-TO-SAVE-001 | OPEN | PDF uses anchor/print, ignores the checkbox; only DOCX uses showSaveFilePicker |
| EXPORT-PRINT-DIALOG-001 | OPEN | browser-print fallback still opens print setup (server-PDF path downloads direct); overlaps above |
| INTERESTS-CONTENT-001 / ADDITIONAL-INFO-HIDE-WHEN-INTERESTS | OPEN / UNVERIFIABLE | only dedup exists (sections-normalize-415.js:1364); content + hide-when behavior gen-gated |
| KERNEL-HOBBIES-SPLIT-001 | OPEN | ACTIVE_BUGS:1895 |
| SETTINGS-REORG-001 | OPEN (partial) | spelling row moved into LanguageCard.tsx; topbar-language Account→Personal + tense-hide unverified |
| WIZARD-ABOUTME-CONFLICT-001 | OPEN | append-confirm on contradiction not shipped |
| SPELL-FI-VOIKKO-001 | OPEN | only "Voikko soon" badge (1.50.573); no libvoikko engine |
| JD-FETCH-HOST-001 (jobs.nvidia.com) | OPEN | only the remediation message was fixed (1.50.433); non-Workday/JS-host fetch still wrong |
| CUSTOM-LLM-OVERHAUL-001 remaining legs | OPEN (partial) | discover + auto-audit done (1.50.412/414); grep `customLlms` in access-relay = empty → relay persist NOT shipped; wizard selector + per-task mapping open |
| FT-PERSTYLE-KERNELS Phase C | OPEN (partial) | App-History styled-kernel selector table shipped (`antcv-app-history-style-kernels.js` v1.51.240); auto-load-on-style-switch not confirmed |
| AUTO-PAGEBREAK-BLOCK-001 residuals | OPEN | (a) experience-role/CL page buttons still whole-role cascade; (b) worker-side photo on export continuation strip — docx-worker follow-on |

## Doc corrections applied

- `ACTIVE_BUGS.md:1893-1899` and `:3734-3745` marked as superseded historical copies (they re-list PERF-002/004, ANALYSIS-SALARY-001 as OPEN; all shipped).
- `FEATURES_REGISTRY.md` row-42 (PACKAGE-PALETTE-MIX "OPEN") and row-62 Status-column ("CJLR-everywhere remains") contradict their own newer close-out notes — Notes columns are authoritative.
- The 13 genuinely-open items above are carried into `NEXT_SESSION_PROMPT.md`'s pre-register open list rather than left buried under June dates.
