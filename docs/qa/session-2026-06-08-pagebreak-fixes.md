# Session changelog — 2026-06-08 — pagination / two-column / CL salmon

All fixes shipped in this session, in order. PWA auto-deploys from `main`; the
docx-worker deploys via `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy
-f confirm=docx-worker`. Branches `main` / `claude/antcv-roadmap-bugs-L9Sqa` /
`plan/2026-06-06-analysis-followups` kept identical.

## PWA (app.js, version constant `Ai`)

| Version | What |
|---------|------|
| `1.50.314-cont-dupe-inflate` | (start of session) CV duplicate "(Cont.)" fix groundwork + WORD_INFLATE 1.11→1.14. |
| `1.50.315-cl-midlist` | **CL mid-list break.** `__antcvBreaks` tags each CL item node with its break key (`data-antcv-cl-item-key`) via `cloneElement`; the measurer refines an overflowing CL section to the first overflowing **bullet** (writes `autoPages[sid].bullet_N`) so the salmon lands BETWEEN bullets; the docx-client overlays auto breaks for text_bullets-shaped keys into `item_pages`. |
| `1.50.316-preview-a4` | **Preview fills A4 (decouple).** The measurer writes TWO maps: `antcv:autoPages` (export, Word-equivalent line ~924px) and `antcv:autoPagesPreview` (preview, true A4 ~1053px). `__antcvAutoPB` reads the preview map so each preview page fills to A4; the export client keeps reading `autoPages`. Also: CL table row-break detection in the measurer. |
| `1.50.317-salmon-permanent` | **Salmon never vanishes.** `__antcvAutoPB` per-section union: prefer the preview break; if a section has none, fall back to its export break so the salmon shows whenever the section exports to page 2. |
| `1.50.318-salmon-scope` | **Scope the fallback to CL.** The 1.50.317 fallback broke the CV (a main section that fits the A4 line broke one role early, leaving a gap above the salmon). Fallback now CL-only; the CV uses preview-only breaks. |
| `1.50.319-salmon-scope` | Version reconcile after a concurrent session merged subtitle-race / sidecar-368 work (also on 1.50.318) into `main`; bumped to keep the SW cache-bust honest. |

## docx-worker (`src/index.js`, `VERSION`)

| Version | What |
|---------|------|
| `1.14.36-segment-no-repeat` | (start) CV duplicate "(Cont.)" — `tableHeader: s.type !== "experience" && !s._antcvSegment`. |
| `1.14.37-cl-midlist-cont` | CL `renderTextBullets`: a mid-body break repeats the heading as "TITLE (Cont.)" (CL only). |
| `1.14.38-table-cont` | **Table page-break for Word.** A splitting table renders as top-level row-chunk segments (not inside the section-wrapper cell, where Word ignores `pageBreakBefore`) — each its own header + "(Cont.)". |
| `1.14.39-twocol-paged` | **Per-page two-column tables (PB-WORKER-TWOCOL-PAGED-001).** `pbBreakPara()` tags every break paragraph (`__antcvPB`); experience/table/sidebar-list sections split into top-level segments; `buildTwoColumnDocument` splits each column on the markers and emits ONE `[SIDEBAR_W, MAIN_W]` table per page (header band page 1 only, sidebar navy every page). |
| `1.14.40-cont-no-double` | **No doubled "(CONT.)".** The sidebar segment branch left `_page` on its chunk items, so `renderSimpleList`/`renderLabeledList` ALSO emitted their own cont-header → "REGULATORY CONTEXT (CONT.) (CONT.)". Clear `_page` on chunk items; the single "(Cont.)" comes from the segment wrapper. |
| `1.14.41-sidebar-ratio` | **Sidebar width parity (PB-WORKER-SIDEBAR-RATIO-001).** Worker hardcoded `SIDEBAR_W=4636` (~0.389) but the preview's `cvSidebarRatio` defaults to 0.33 → export main ~6% narrower → justified text overflowed the edge. Column widths now derive from a forwarded `sidebar_ratio` (clamped, default 0.33) via `ctx.sidebarW`/`ctx.mainW`. |

## Tests added / fixed
- `pwa/test/diag-cl-midlist-measurer.mjs` — measurer writes a mid-list `bullet_N`.
- `pwa/test/diag-preview-a4-table.mjs` — export break earlier than preview break; table row-break in both maps.
- `workers/docx-worker/test/diag-twocol-paged.mjs` — drives the LIVE `index.js` fetch handler, unzips `word/document.xml` (minimal central-directory ZIP reader + `inflateRawSync`), asserts one top-level table per page + body-level breaks + content preservation.
- `pwa/test/diag-export-autobreak.mjs` — updated the stale experience assertion to the 1.50.298 contract (effective role.page = max(manual, auto) + cascade).

## Verification notes
- app.js rebuilds with `npx terser pwa/app.src.js --compress --mangle -o pwa/app.js` (identity-gated: a clean source round-trips byte-identical). NEVER esbuild (`build:app` is unsafe — prepends `"use strict"`, blue-screens).
- The worker bundle replaces `globalThis.process` on import, so test harnesses must write output via `fs.writeSync(1, …)`, not `console.log`.
- The live worker (`index.js`) exports only the fetch handler; drive it with `worker.fetch(new Request('https://x/generate', {method:'POST', body: JSON.stringify(payload)}), {}, {waitUntil(){},passThroughOnException(){}})` (env `{}` skips the auth check). `generate.js` is dead (not imported by `index.js`).
