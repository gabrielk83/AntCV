# Next-session prompt — autonomous AntCV bugfix + feature implementation

Paste the block below into a fresh session.

---

You are working autonomously on AntCV (React PWA on Cloudflare Pages + Workers). Read
`CLAUDE.md` first, then `docs/qa/ACTIVE_BUGS.md`, `docs/FEATURES_REGISTRY.md`, and the
latest `docs/qa/session-*-fixes.md` changelog for current state.

## Autonomy
Full autonomy — run tests, rebuild app.js, update + deploy workers, commit, and push
freely; report after, no pauses. Ship tight named bundles, not sweeping rewrites.
Keep branches `main`, `claude/antcv-roadmap-bugs-L9Sqa`, and
`plan/2026-06-06-analysis-followups` identical (a concurrent session may also push to
`main` — always `git fetch origin main` + merge before pushing, and if it collides on a
version string, bump yours so the SW cache-bust stays honest).

## Hard rules (from CLAUDE.md + this session)
- Edit `pwa/app.src.js` (source); rebuild with `npx terser pwa/app.src.js --compress
  --mangle -o pwa/app.js`. NEVER esbuild/`build:app` (prepends `"use strict"`,
  blue-screens). After: verify `node --check`, head `(()=>{`, 0 `use strict`, and the
  diff is only your change.
- Cache-bust trio on any app.js change: `app.js?v=` in `pwa/index.html`, `CACHE` in
  `pwa/sw.js`, `TARGET_VERSION` in `pwa/antcv-version-override.js` (and add the PREVIOUS
  version to `STALE_VERSIONS` — NEVER the current one). Bump a sidecar's `?v=` when you
  edit it.
- The salmon splitter is PERMANENT — never remove `__antcvSalmon`; only tune it.
- Worker deploy: `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f
  confirm=docx-worker`, then verify `/health`. PWA auto-deploys on push to `main`.
- Verify headlessly before deploy. PWA: Playwright diags in `pwa/test/` (boot-smoke +
  the diag-*.mjs). Worker: drive the LIVE `index.js` fetch handler in node — it exports
  only the handler, env `{}` skips auth, and the bundle replaces `globalThis.process`
  so write output via `fs.writeSync(1, …)`. See `workers/docx-worker/test/diag-twocol-paged.mjs`.

## Current state — 2026-06-16 (read first)

Shipped to **1.50.521** + **access-relay** + **docx-worker 1.14.74**; suite **308/308**, boot-smoke clean. Latest session registry is at the TOP of `docs/qa/ACTIVE_BUGS.md` (2026-06-16). Highlights:
- **KERNEL V2 COMPLETE** — Task 1a (v2 in D1 `user_kernel.kernel_v2`) + §2 tense (isCurrent flag) + §3 language (cross-lingual policy) + §4 upload→kernel ingestion (engine, file→text, preview modal, D1 POST/GET, merged import button, reader bridge into generation, login auto-sync, structured apply, language step). Full plan + status: `docs/plan/KERNEL-V2-AND-INGESTION.md`. Upload-test fixtures: `pwa/test/fixtures/kernel-v2/`.
- **Owner data reconciled** in D1 (11 reverse-chron roles incl. security guard + Copenhagen Wolves + split Meprolight; see [[gabriel-cv-facts]]).
- **Many content/feature ships** (outcome dropdown+seeding, role-decompose, group-name visibility, exp-order, profile text). See the registry.

**Top OPEN items** (`docs/qa/ACTIVE_BUGS.md` OPEN ISSUES): **SIDEBAR-NARROW-FIGURE-OVERLAP-001** (item 26, NOT STARTED — band/main/sidebar text overlaps the photo when the sidebar is narrow); the regen-dependent prompt items (metric sharpness, dorm-guard) — owner verifies on regen; **SETTINGS** bucket (LANGUAGES-CARD-PERSONAL-001 mount, SETTINGS-SCROLL-RESET-001, DISCLOSURE-TRIANGLE); and the older preview/export pagination items below. Kernel-v2 follow-ups are refinements only (not blockers) — see the plan doc.

---

## Priority 1 (do first) — PB-PREVIEW-SIDEBAR-SALMON-PUSH-001
In the CV page-box PREVIEW, the long sidebar (REGULATORY CONTEXT) does NOT break at the
salmon line — it PUSHES the salmon down, leaving the page-box taller than A4. The owner:
"make sure the sidebar text is going through the salmon and not pushing the salmon."
The main-column analog was fixed in 1.50.318 (scoped the export-break fallback so the CV
breaks at the A4 line). The sidebar needs the same: the measurer's PREVIEW map
(`antcv:autoPagesPreview`, computed at `USABLE`≈1053px in `compute(USABLE, PREVIEW_KEY)`)
must detect the sidebar overflow at a GROUP boundary and write it, so the page-box
flatMap (`o`, `app.src.js` ~38530) splits the sidebar there and the page-box height is
bounded by the salmon. Likely cause: the sidebar overflow is written only to the export
map (924px) and the CV-preview-only read (`__antcvAutoPB`, now `doc!=='cl' → {}` when the
preview map lacks the section) returns `{}` → no preview split → whole sidebar in one
page-box → salmon pushed down. Fix so the sidebar overflow lands in the preview map at
the A4 line, snapped to a group start. Verify with a measurer-isolation harness (a
synthetic sidebar column of known-height groups; assert `autoPagesPreview[sid]` carries
a group-start break, and the salmon sits at the A4 line not below the sidebar). Full
spec in `docs/qa/ACTIVE_BUGS.md`.

## Then work the backlog (highest-value first)
From `docs/qa/ACTIVE_BUGS.md` and `docs/FEATURES_REGISTRY.md`:
- **PB-WORKER-TWOCOL-PAGED-001** `[VERIFYING]` — per-page two-column tables shipped
  (1.14.39); confirm owner Word-export is clean, else iterate.
- **PB-WORKER-SIDEBAR-RATIO-001 follow-up** — the export now uses the preview's DEFAULT
  0.33 sidebar ratio; wire the client to forward `sidebar_ratio` (read `cvSidebarRatio`)
  so a user-ADJUSTED split also matches (the worker already honors a forwarded ratio).
- **PAGEBREAK-STYLE-OPTIONS-001** — advanced-style menu: keep-(Cont.)-headlines toggle
  (default ON), repeat-candidate-header per page (default OFF), page numbers
  (off/top-right/bottom-right). Spec in FEATURES_REGISTRY.
- **PREVIEW-SUBTITLE-RACE-001** — a concurrent session shipped `antcv-subtitle-sequence-368.js`;
  confirm it's wired + working.
- **CL-PDF-PRINT-PATH-001**, **EXPORT-PREVIEW-FEATURES-001**, and the other OPEN items.

For each: reproduce → diagnose → targeted patch → headless verify → ship → flag for
owner export review. Report a tight summary after each bundle.

---
