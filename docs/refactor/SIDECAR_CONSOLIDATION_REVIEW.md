# Sidecar consolidation — per-group review (2026-06-13)

Owner request: "do a per-group review for sidecar merges." Scope: the **160**
`antcv-*.js` sidecars loaded by `pwa/index.html` (in document order). Goal:
identify which groups can be safely merged, which must stay separate, and a
low-risk pilot — WITHOUT compromising performance or the load-bearing order.

## Hard constraints (from CLAUDE.md + this audit)

1. **Load order is behaviour.** Several sidecars wrap `window.fetch` in
   document order; reordering them double-wraps the Response-reconstruction
   path (prior blue-screen incident). The fetch-wrappers are LOCKED.
2. **Edit `app.src.js`, never re-de-minify `app.js`.** Sidecars are separate
   files; merging them does not touch app.js.
3. Every merge ships behind the full gate (node --check, terser identity,
   0× "use strict", boot-smoke, the topic's diags) + cache-bust trio, ONE
   group at a time. No big-bang.

## LOCKED — the fetch-wrapper chain (10 files, NEVER merge/reorder)

These wrap `window.fetch`; their relative order is load-bearing.

| File | index.html line | Role |
|------|-----------------|------|
| antcv-cloud-restore-filter-298.js | 564 | filters cloud-restore reads |
| antcv-kernel-completeness-290.js | 716 | kernel-completeness guard |
| antcv-cloud-put-shrink-guard-289.js | 715 | blocks shrinking cloud writes |
| antcv-sce-flag-toast-399.js | 579 | read-only flagged-draft toast |
| antcv-privacy-led.js | 575 | privacy indicator (read-only wrap) |
| antcv-bullet-targets.js | 598 | bullet-target capture |
| antcv-overlay.js | 559 | overlay/supervisor wrap |
| antcv-react-islands.js | 793 | writing-style envelope (islands) |
| antcv-auth.js | (core) | auth fetch |
| antcv-kernel-completeness-290.js | 716 | (as above) |

Verdict: **LOCK.** Document the chain; do not consolidate. (One dead twin
exists on disk — `antcv-cloud-put-shrink-guard-355.js` — NOT loaded; leave it.)

## Groups (verdicts)

### G1 — Per-section row controls / CJLR  ·  ~16 files, ~250 KB  ·  CANDIDATE (largest payoff, staged)
experience-role-cjlr-230, core-competencies-row-controls-234,
selected-outcomes-row-controls-237, profile-workstyle-cjlr-238,
how-contribute-controls-245 (52 KB), what-i-bring-cjlr-cleanup-246,
additional-info-row-controls-247, embedded-controls-248,
what-i-bring-header-cjlr-249, foundation-controls-327,
what-i-bring-row-controls-327, add-cjlr-order-swap-241,
row-controls-wording-341, row-controls-dedupe-388, item-align,
section-align (59 KB).
- Same topic: inject the C/J/L/R alignment + row controls per section.
- All DOM/MutationObserver, **no fetch wrap** → mergeable in principle.
- BUT each carries section-specific selectors + idempotency guards, and
  `row-controls-dedupe-388` exists precisely because earlier ones double-inject.
- **Plan:** a single `antcv-row-controls.js` with a per-section config table.
  Stage it section-by-section behind the row-controls diags. High payoff
  (~16 → 1, removes the dedupe sidecar), but multi-session effort. NOT a
  one-shot.

### G2 — Section editor panel fixes  ·  **DONE (1.50.418, 2026-06-13)**
section-panel-206, -207, -208 RETIRED; -211 kept as the sole controller.
- Finding on review: 211 (v1.40.351) is already a COMPLETE re-implementation
  — it loads last, stamps every row/title/button with its own `-211` attrs,
  owns the headline-CJLR feature (same `antcv.sectionHeadlineAlignment.v1`
  key, newer defaults + user-touched + flicker-fix idempotent writers), and
  its CSS replicates every 206/207/208 rule. Because it loads last it already
  WON the cascade, so 206/207/208 were overridden dead weight.
- Verified: every 206/207/208 CSS rule has a `-211` equivalent; only 211
  reads their attrs (as graceful classify fallbacks); no external API
  consumer. Removed the 3 `<script>` tags (−3 MutationObservers, −3
  intervals, −3 timeout fans). Files left on disk (unreferenced). boot-smoke
  clean. **Template for the staged G1 work.**

### G3 — Pagination / page-break  ·  ~15 files  ·  DEFER (high-risk)
page-budget, page-fit, auto-pagebreak-block-001, item-pages-render,
page-breaks-everywhere-284, table-page-splits-327, table-row-page-controls-328,
sidebar-subsection-pagebreaks-329, sidebar-item-page-controls-359,
page-break-icon-357, page-button-polish-327, exp-continuation-fix,
pdf-page-mismatch, watermark-page-anchor-341, sidebar-fill-equalize-227.
- The salmon/pagination engine — prior incidents, the `__antcvSalmon`
  permanent rule, two-map preview/export decouple. **DEFER**: too sensitive
  to merge for marginal gain.

### G4 — Cloud sync / restore  ·  ~11 files  ·  LOCK / DEFER
cloud-delete-296, cloud-restore-filter-298 (fetch), ai-consent-cloud-sync-224,
ai-consent-restore-339, photo-cloud-restore-339, personal-info-cloud-restore-282,
load-from-cloud-personal-info-hook-283, orphan-cloud-persist-385,
generate-cloud-sync-277, fit-cv-cloud-sync, cloud-put-shrink-guard-289 (fetch).
- Restore order + the fetch wrappers are load-bearing. **DEFER** (the two
  fetch-wrappers are LOCKED).

### G5 — Mobile UI cleanup  ·  4 files  ·  CANDIDATE (safe, low payoff)
mobile-topbar-cleanup-275, mobile-fab-cleanup-351, mobile-bottom-compact-352,
mobile-alt-circles-dropdown-354.
- Pure DOM, matchMedia-gated, no fetch. Independent. Mergeable into one
  `antcv-mobile-ui.js` behind a mobile-viewport boot-smoke. Low risk, modest
  payoff. Good second pilot.

### G6 — Language  ·  ~7 files  ·  CANDIDATE (medium)
i18n, language-prefs, language-prefs-defaults, lang-bar-filter,
language-ui-fixes-292, translation-patch, wizard-language-slide-339.
- Same topic; wizard-language-slide is large + owner-touched (two-table).
  Merge the prefs/filter trio first; keep the wizard slide separate.

### G7 — Analysis  ·  ~7 files  ·  DEFER (medium-high)
analysis-merge-344, analysis-panel-jd-block-356, analysis-report-pdf-360,
gap-closure-342, bottom-fusion-343, recheck-fit, jd-analysis-and-reupload-fix.
- Active area (owner wants salary + recruiter-questions next). Hold until
  those land, then consolidate.

### G8 — Sections normalize / dedupe  ·  PARTIALLY DONE
sections-updated-dedupe, sections-normalize-415 (now owns role-dup/founder/
recs after SECTIONS-CONSOLIDATE-001), preview-bullets-dedup-341,
personal-tab-dedup-341, pub-injected-reaper-352, row-controls-dedupe-388.
- 415 already absorbed 3 app.js effects. `sections-updated-dedupe` +
  `preview-bullets-dedup-341` could fold in next, but the preview-edit-commit
  path is sensitive (PB-PREVIEW history) — test heavily.

### G9 — PDF / export  ·  DEFER
pdf-po-shim, pdf-preview-gate, print-iframe-preview, pdf-error-toast,
pdf-page-mismatch, jd-pdf-to-docx-341, analysis-report-pdf-360,
demo-watermark, watermark-page-anchor-341.
- Tied to the open `PDF-EXPORT-AUDIT-001`; fix that first, then consolidate.

### G10 — Photo  ·  3 files  ·  CANDIDATE (small)
photo-position, photo-pentagon-shape, photo-bridge-button.
- DOM-only, related. Small, safe merge candidate (after G2/G5 pilots).

## Recommended order (one group per shippable round)

1. **G2 (section-panel 206/207/208 → 211)** — pilot; smallest, clearest.
2. **G5 (mobile UI → one file)** — safe, validates the matchMedia path.
3. **G10 (photo trio)** — small, builds confidence.
4. **G6 (language prefs trio)** — medium.
5. **G1 (row-controls, staged per section)** — biggest payoff, multi-round.
6. Hold **G3/G4/G7/G8/G9** (pagination, cloud, analysis, preview-edit, PDF)
   until their open bugs close — merging a moving/sensitive target is net-negative.

## Performance note

Consolidation REDUCES `<script>` count + duplicate MutationObservers/listeners
(e.g. one observer instead of 4 in G2/G5), so it improves boot + steady-state
cost. The win is real but bounded — the heavy cost is app.js, not the sidecar
count. Each merge must keep the same idempotency guards, or it regresses.
