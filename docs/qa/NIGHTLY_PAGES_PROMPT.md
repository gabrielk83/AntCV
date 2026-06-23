# Nightly prompt — CV pagination blowup (CV-SIDEBAR-SPILL-9-PAGES-001)

Dispatch this to the cloud Routine / nightly. It is self-contained. Paste the block below.

---

AntCV — fix the unsolicited CV exporting to 9 pages (sidebar-spill pagination).

SYNC FIRST: `git fetch origin && git pull --rebase origin main` (NEVER force main). Read CLAUDE.md (app.js source-of-truth + cache-bust quintet + diagnose-first; `npm run build:app` is UNSAFE — make surgical edits, mirror app.src.js↔app.js by site). Repo is past 1.50.839.

PROBLEM. A full-breadth UNSOLICITED CV exports to **9 pages** (should be ~3-4). Confirmed via the owner's `CV_..._Unsolicited_..._20260624.pdf` (`/Type/Page` = 9). This is **PRE-EXISTING, not a regression** — the 0623 MERGED 5-role CV was ALSO 9 pages. Do NOT revert the un-merge (UNSOLICITED-NOT-TARGETED-001, 1.50.837) — full breadth is correct and owner-approved; the bug is how that breadth PAGINATES.

DIAGNOSIS (already gathered — start here, confirm, then fix):
- Per-page non-blank line density of the 9-page export: **43 / 72 / 7 / 58 / 1 / 4 / 1 / 0** — pages 3, 5, 6, 7, 8 are near-empty, page 8 is blank.
- The thin pages carry SIDEBAR content alone: p5 = publications, p6 = languages/interests/recommendations, p7 = the AI-assisted watermark, p3 = leftover certificates. The MAIN column (experience) is exhausted by ~p4, so the SIDEBAR continues ALONE down pages 5-8 with the main column empty beside it.
- Live `localStorage` (antcv.pages.dev, owner signed in): the EXPORT break map `antcv:autoPages` breaks each long sidebar section onto its own page — `{"education":{"0":2},"regulatory":{"0":2},"languages":{"0":2},"accessibility":{"0":3}}`. The sidebar sections are long: tools(13) + certs(9) + education(4) + regulatory(many groups) + publications + languages + interests + accessibility + recommendations. The sidebar is FAR longer than the main column.
- ROOT CAUSE: this is a docx-worker per-page two-column **column-balancing** failure. The `SIDEBAR_NPAGE` / `SIDEBAR_UNIFIED` engine (antcv-auto-pagebreak-block-001.js) + the worker's `buildTwoColumnDocument` paginate the long sidebar into its OWN pages instead of (a) balancing it against the short main column or (b) flowing the overflow sidebar content into the freed main-column space on later pages. It is NOT the preview-only SALMON-NPAGE-LIMIT-MISMATCH-001 change (export map untouched there) — verify by confirming `antcv:autoPages` is unaffected by `SIDEBAR_PREVIEW_INFLATE`.

GOAL: the full-breadth unsolicited CV paginates to a sane page count (~3-4) with **no near-empty pages and no trailing blank page**, sidebar and main aligned per sheet, salmon correct in both preview columns, and the EXPORT == PREVIEW page structure. Keep the salmon permanent ([[salmon-splitter-permanent]]). Do NOT regress the already-fixed a/b/d/e (full breadth, no merge, publications shown, results not repeated).

APPROACH (diagnose-first, develop against diags — the real big doc WILL freeze a live tab, so iterate headless):
1. Reproduce headless: build a long-sidebar + ~11-role CV (mirror the owner's shape; `docs/personas/anita` for a full personalInfo) and drive BOTH the measurer (`pwa/test/diag-sidebar-preview-break.mjs` pattern) AND the docx-worker (`workers/docx-worker/test/diag-twocol-paged.mjs`) to reproduce the 9-page / near-empty-page output. Count `/Type/Page` and per-page density in the generated DOCX/PDF.
2. Decide the balancing model with the owner's intent: when the sidebar outlasts the main, the trailing sidebar-only pages should be COMPACTED (no blank page; the AI watermark should not get its own page — see [[design-rules-watermark-table]]) and ideally the sidebar overflow should reflow across the full sheet width once the main column ends, OR the two columns should be balanced so neither runs many pages past the other.
3. Implement in the measurer (export map) and/or the docx-worker per-page two-column builder. The worker bundle `workers/docx-worker/src/index.js` is hand-maintained (no build step — [[docx-worker-bundle-no-build]]); edit the inlined block. The measurer is a sidecar.
4. Kill the trailing BLANK page and the watermark-on-its-own-page first — that is the lowest-risk, highest-visibility win.

CONSTRAINTS: diagnose-first; app.js blue-screen history (surgical edits mirrored app.src.js↔app.js, never `build:app`); cache-bust quintet on every loaded-file change ([[stale-sw-version-mask-hazard]] — the owner was bitten this week by a stale SW masking fixes; verify the REAL loaded `app.js?v` after deploy). `node --test --test-force-exit pwa/test/unit/*.test.mjs` + boot-smoke + the salmon diags (`diag-sidebar-preview-break`, `diag-salmon-empty-region`, `diag-cl-salmon`, `diag-cl-double-salmon`, `diag-sidebar-salmon-push`) MUST stay green. Worker deploy is manual `gh workflow run deploy.yml` (owner-approved). Live-confirm via Claude-in-Chrome on the owner's signed-in profile only at the END (the big doc freezes — develop against diags, confirm on a real export last).

DELIVERABLE: measurable before/after page count + per-page density from the diags (9 pages → ~3-4, zero near-empty/blank pages), salmon correct, a/b/d/e not regressed, and a one-paragraph note in `docs/qa/ACTIVE_BUGS.md` updating CV-SIDEBAR-SPILL-9-PAGES-001.

SIDE NOTE (related, lower priority — fix if cheap, else log): CV-GHOST-PLACEHOLDER-ROLES-PREVIEW-001 — the generator's `on:false` "unused slot" roles (`[Role title], [Company]`) render as ghost rows in the PREVIEW (export correctly skips them); add a preview-render filter for placeholder roles (title matching `^\[.*\]$` / bullets `<unused slot>`).
