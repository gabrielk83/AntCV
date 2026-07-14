## 1.14.156-cjlr-export-parity

- CJLR EXPORT PARITY (owner 2026-07-14/15): mirror the PWA-preview-only CJLR fixes shipped 1.51.1184->1.51.1225 into the worker export so DOCX/PDF matches the on-screen preview. Four items:
  - **GROUP-HEAD-JUSTIFY-001** - a PLAIN rich_block group heading (renderRichBlock grp branch, no seg[], e.g. TOOLS & METHODS "Methods") now resolves a group justify alignment to LEFT (a single-line heading can't spread), mirroring the preview render + antcv-item-align.js. The seg-branch role-line justify = space-between is untouched. Absent align -> default CENTER, so untouched group heads are byte-identical.
  - **FOCUS-TABLE-LEFTCOL-JUSTIFY-001** - the focus-area (core_comp) 2-column table's LEFT ("[Focus]") column now defaults to JUSTIFIED (was LEFT); the right column already did. Mirrors app.src.js left-td textAlign:"justify". Short single-line labels still render left; only a wrapped label spreads.
  - **GROUP-CJLR-ROLES-001** - renderExperience role line now honours the group/per-role align (roles.R.title / roles.R / __group__): justify (= default/absent) keeps the space-between (role+company left, years tab-right) layout; left/center/right group the WHOLE line to that side with the year travelling inline (no right-tab pin). Absent align -> byte-identical to the pre-CJLR export. RTL segment reversal stays deferred in BOTH preview and worker (kept at parity).
  - **HEADLINE-LOC-PREVIEW-001 (confirm)** - the loc-keyed section-headline alignment ({topbar,sidebar,main}, forwarded by antcv-docx-client.js as headline_align) was already applied per-loc by headingParagraph (ctx.headlineAlign, HEADLINE-ALIGN-EXPORT-PARITY); verified, no change needed.
- Also ships the earlier worker-side-but-never-deployed items in this area: per-segment role-line style (role.roleLineStyle) + under-role rule (role.roleLineHr) in renderExperience, the general rich_block group seg[]/hr model + role-line space-between in renderRichBlock, and grpKeep (user-made childless groups stay visible). All are additive/byte-identical when the relevant field is absent (no current payload carries them). Locked by test/diag-cjlr-group-role-export.mjs.

## 1.14.154-role-split-cont

- ROLE-SPLIT-CONT-001 (owner 2026-07-13, OPEN_REGISTER row 87d): a SINGLE multi-bullet experience role that overflows one page in the CloudConvert/LibreOffice render stranded its tail bullets on the continuation page with NO "(CONT.)" section header. COMPLEMENTS 1.14.153-role-keep-whole: that change strengthened the keepNext/keepLines chain so a role that FITS one page moves wholesale to the next page instead of splitting (the common case); this change handles the pathological case where a role is TALLER than any single page and MUST break — the client forwards the crossing bullet via role.bullet_pages and the worker stamps the CONT header at that boundary. Diagnosed against the REAL converter (POST /generate → POST /diag/convert-docx, worker 1.14.152, CloudConvert): a 22-bullet role put bullets 1-13 under "PROFESSIONAL EXPERIENCE" on page 1 and bullets 14-22 headerless on page 2 (no content lost — purely a missing header). Root cause: renderExperience only stamps "(CONT.)" on WHOLE-role page increments (role.page), never mid-role, and the two-column splitter only sees TOP-LEVEL __antcvPB markers, so an in-cell overflow is invisible to it. The client measurer (antcv-auto-pagebreak-block-001.js) treats a role as an ATOMIC block and, per its own comment, LEAVES a role taller than a page unbroken. Fix (worker half): renderSection now honours a per-BULLET page map `role.bullet_pages` { bulletIndex: page } — mirroring the proven table row_pages / list _page split — by expanding an over-long role into a head role + one continuation role per page boundary (continuation roles carry an absolute role.page and cleared title/company/years, so the existing experience chunker turns each into a top-level "(CONT.)" segment under which only the remaining bullets render). SAFE-BY-CONSTRUCTION: inert unless the client forwards bullet_pages — no current payload has this field, so every existing document renders byte-identically. The worker deliberately does NOT guess a split index (it has no height model and no knowledge of page-1 fill; a guessed break risks a stranded head-overflow or an extra/blank page in this PDF-BLANK-PAGE-history area). Client half (make the atomic-role measurer emit bullet_pages at the crossing bullet) tracked separately. Locked by test/diag-role-split-cont.mjs (CONT header + no loss + no dup + tail-after-break for the bullet_pages case; NO break + NO "(CONT.)" for the inert no-field regression case).

## 1.14.81-trailing-blank-trim

- PB-WORKER-TRAILING-BLANK-001 (owner 2026-06-24, "we got 9 pages CV" / blank trailing sheet): a column ending on a page-break marker made splitChildrenByPage push a trailing EMPTY page, so numPages = max(...) counted it and the export emitted a blank trailing sheet. Added trimTrailingEmptyPages() — pops trailing content-less pages from each column before numPages (never removes content; only pops zero-children pages). Verified: diag-twocol-paged 2-page case unchanged (no regression); standalone trim check 3-page→2-page with all content kept. NOTE: does NOT fix the deeper sidebar-longer-than-main spill (sidebar continues onto pages with an empty main cell — needs a full-width re-flow of the overflow, owner-gated on real long-sidebar data).

## 1.14.63-banded-rows

- TABLE-BANDED-ROWS-001 (owner 2026-06-14: "PDF missing the banded-row colours seen in preview"): the competency / What-I-Bring table zebra was both INVERTED and effectively invisible vs the preview. The React preview (`app.src.js` ~5149) bands EVEN data rows (data idx 0,2,4…) with a visible pale teal `#eaf7f7`; the worker banded the ODD rows with near-white `FAFAFA`. The worker now matches the preview: even data rows → `EAF7F7`, odd → none. Applies to both the CV competency table and the CL What-I-Bring table (shared `renderCompetencyTable`). Locked by `test/diag-banded-rows.mjs`. Re-verify owed in a real PDF.

## 1.14.62-palette-fallback-sync

- EXPORT-PALETTE-PARITY (worker fallback): synced the bundle's inlined `getPackageStyle` (`src/index.js`) to the corrected `src/palette.js`. The deployed bundle's copy had drifted to the pre-fix values — `sidebarBg: base` with white sidebar text/labels — so whenever an export payload omitted an override token, the Copenhagen candidate / sidebar text rendered invisible (white) on the pale ground. The fallback now derives `ground` (Copenhagen `C9D6EC`), uses `readableInk(ground)` for the sidebar text + labels (dark on pale, white on dark), keeps the candidate band + table header on the dark brand `base` with luminance-picked ink, and adds the `tableHeaderText` token. Added `readableInk` + `UNIVERSAL_DARK_INK` to the bundle. New `test/diag-bundle-palette-sync.mjs` locks the bundle≡source so a deploy can't reship the stale fallback. Client payload overrides (1.50.453/455) still win when present; this fixes the no-override fallback. Re-verify owed in a real DOCX + PDF.

## 1.14.17

- Photo position `band-overlap` (the PWA "sidebar bridge") is now a RECOGNISED position instead of silently falling back to `sidebar-top` via the unknown-value default. It renders at the TOP of the sidebar with zero top spacing so the disc hugs the header-band/sidebar seam — the faithful PDF-safe mapping. A literal medallion-straddle (half the disc over the navy band) needs a floating frame, which LibreOffice/CloudConvert drop during PDF conversion (the v1.14.0 photo-floating regression), so it is intentionally not attempted. header/main left-vs-right and the other positions are unchanged.

## 1.14.13

- AI-assisted disclosure rendered as a bordered "hanging textbox" matching the PWA preview chip (app.js v1.40.338). 1pt border on all four sides; sidebar context keeps the light-grey-blue palette, linear/CL context uses a muted teal on a very light fill.
- Linear (CL) builder now emits the disclosure on the last page: page 1 for a single-page CL, the jd_questions page (page 2) when present.
- Uses a styled paragraph, not `wp:anchor` floating frames — those don't survive LibreOffice/CloudConvert PDF conversion (v1.14.0 photo-floating regression).

## 1.14.12

- Sidebar Regulatory Context and Additional Information item page breaks are now honored without duplicating the first-section break.
- Body row cantSplit is disabled when sidebar item page breaks are present so Word can paginate the sidebar.
- Sidebar continued sections keep sidebar shading.

# docx-worker CHANGELOG

## v1.14.9 (2026-05-19)

**Adds:** `X-AntCV-Pdf-Pages` response header on `/generate-pdf`.

### What's in the zip

- `src/pdf-page-count.js` — new helper that scans a LibreOffice/
  CloudConvert-produced PDF buffer and returns the page count.
  Two strategies: read the `/Type /Pages` catalog's `/Count` field
  (canonical), with a fallback to counting `/Type /Page` leaf
  objects. Pure ASCII scan; no parser, no Wasm. Capped at 4 MiB
  to keep CPU bounded.
- `PATCH-FOR-INDEX-JS.md` — two small edits to `src/index.js` that
  wire the helper into the `/generate-pdf` response.
- `generate.js`, `wrangler.toml`, `package.json` — unchanged from
  v1.14.8 (version stamp on package.json only).

### Why

The PWA's preview-paper uses CSS-rendered A4 metrics; the worker
uses LibreOffice's pagination. The two have drifted ~3-5%
historically, which means a cover letter that fits 1 page on
screen can spill onto page 2 in the exported PDF. Until now the
user only noticed after the file landed in their Downloads folder.

This release surfaces the worker-side page count so the PWA can
compare it to its own pagination and raise a chip on mismatch.
Backwards-compatible: PWAs that don't read the header just ignore
it.

### Smoke test (post-deploy)

```bash
curl -i -X POST https://docx-worker.<subdomain>.workers.dev/generate-pdf \
  -H "Content-Type: application/json" \
  -H "X-AntCV-Secret: <secret-if-set>" \
  --data @minimal-cv-payload.json | head -30
```

Expected new header line: `X-AntCV-Pdf-Pages: <N>`.

### Local helper smoke test

```bash
cd antcv-docx-worker-1.14.9
node --input-type=module -e "
import { countPdfPages } from './src/pdf-page-count.js';
console.log(countPdfPages('%PDF-1.5\n2 0 obj <</Type /Pages /Count 1>> endobj\n%%EOF'));
// → 1
"
```

### Deploy

```powershell
cd antcv-docx-worker-1.14.9
# 1. Copy src/pdf-page-count.js into your repo's src/ dir.
# 2. Apply the two edits in PATCH-FOR-INDEX-JS.md to src/index.js.
# 3. npx wrangler deploy
```

### Pairs with

- PWA v1.40.196 — `antcv-docx-client.js` reads
  `X-AntCV-Pdf-Pages` and includes it as `pages` on the
  `antcv:pdf-export-success` event detail.
- PWA v1.40.196 — `antcv-pdf-page-mismatch.js` surfaces a
  dismissible chip on mismatch.

---

## v1.14.8 (prior)

- Per-item page assignments wired through to docx body.
- Continuation-header text honors `_page` annotations on
  labeled_list / list / education items.
