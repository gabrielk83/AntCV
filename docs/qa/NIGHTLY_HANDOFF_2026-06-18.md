# Nightly handoff — 2026-06-18 (post kernel-v2 upload + regen)

**Current deployed head:** 1.50.603 (login gate mode-card hold).
**Context:** Gabriel uploaded `gabriel-kernel-expanded-2026-06-18.json` (50 keys) and
regenerated an Unsolicited "Product / Project Expert" CV+CL. The kernel ingested
(groups, regulatory, security-guard, FVU all present in DATA) but several render +
lamination + generation bugs surfaced. This is the full status for the nightly.

## Operating rules (READ — these constrain every fix)
- `pwa/app.js` is GATED. Edit `pwa/app.src.js` (the de-minified source) AND mirror
  surgically into `pwa/app.js` via a node single-match script (verify count===1).
  Never `npm run build:app`. `node --check` both after. See CLAUDE.md + the
  app-js-source doc.
- React islands live in `src/islands/*`; rebuild with `npm run build` (vite) →
  `pwa/antcv-react-islands.js`. tsc has 2 pre-existing TS6133 warnings (non-blocking).
- After ANY change: cache-bust trio — bump the file's `?v=` in `pwa/index.html`,
  `pwa/sw.js` `CACHE`, `pwa/antcv-version-override.js` `TARGET_VERSION` (+ add the
  PREVIOUS target to `STALE_VERSIONS`, never the current). For app.js changes bump
  the `app.js?v=` in index.html line ~329.
- Worker changes (docx export, watermark): `workers/docx-*` — the deploy bundle
  `src/index.js` inlines drifted copies; edit the inlined block too. Deploy manually
  via `gh workflow run deploy.yml`.
- Commit messages end with the Co-Authored-By trailer. PWA auto-deploys on push to
  main; one deployer at a time.

## Kernel verification still pending (owner to confirm; do NOT fabricate further)
- FVU institution + year (left blank — KVUC/VUC likely).
- Regulatory standards: only ASPICE attested; the other ~19 inferred — owner to prune.
- Students Council years/body inferred.

---

## OPEN ISSUES (this batch)

### G-GROUPS-001 — Tools & Methods groups render but are HIDDEN; flat items duplicate them
Symptom: TOOLS & METHODS shows the OLD flat items (Project Workflow / Engineering
Software / …) as visible, while the new `{group}` headers (Expertise / Tools /
Methods) and their items are toggled OFF (eye-off in the section editor). The exposed
values duplicate what's inside the (hidden) groups.
Diagnosis: kernel ingestion brought in BOTH the legacy flat tools AND the grouped
structure; the grouped items default to `on:false` (or the group renderer hides
them), and the flat duplicates stay on. Likely sites: `pwa/antcv-group-name-visibility.js`,
the tools render in `app.src.js` (~5886, the `{group}`/`{l,v}` path), and the
ingestion in `pwa/antcv-data-importer.js` / `pwa/antcv-kernel-ingest.js`.
Fix direction: when a section has `{group}` headers, the grouped items must default
VISIBLE and the legacy flat duplicates must be hidden/removed (de-dup by value).
Render the group header + its items together. CLASSIFY: ingestion + render. No regen
needed once render is fixed, but a re-ingest/re-apply of the kernel may be.

### G-GROUPS-002 — Regulatory Context groups mostly hidden
Same root as G-GROUPS-001, in the REGULATORY section. 4 group headers + 20 items
ingested; most items eye-off. Fix together with G-GROUPS-001.

### G-GROUPS-003 — Additional Information not split into sub-subsections
Owner wants Languages / Accessibility / Interests as independent sub-subsections.
Kernel provides the grouped `additional` structure, but the export renders one flat
block. Same group-render family. CLASSIFY: render (+ worker export must honour the
sub-group headers in ADDITIONAL INFORMATION).

### LAM-RESULTS-001 — Per-role "Results:" lines show the WRONG role's outcome ("funny")
Symptom (CV screenshot): under "Product / Project Expert" the Results line reads
"Security Guard, Student Dormitories — Tel Aviv University, 2010."; under "Change
Control Lead" it reads "Students Council Representative — …, 2005-2007." The Results
lamination is mapping outcomes to the WRONG roles. The SELECTED OUTCOMES panel is
"hardly related" — many rows show "[Verb]" placeholders and mismatched role tags.
Diagnosis: the outcome→role match (outcomeRoleMap / lamination precedence — see
[[gabriel-master-profile-and-lamination]] memory + RESULTS-LAMINATION-003) is keying
by the wrong field or order after the v2 kernel changed role ids/shape. Sites:
`pwa/antcv-outcome-role-select.js`, the lamination in `app.src.js` (search
`role.results`/`outcomes`/`proofPointIds`), and the generation prompt outcomes_items
mapping (~23022). CLASSIFY: lamination/generation. Likely needs a prompt/lamination
fix THEN regen. HIGH PRIORITY — this is the most visible content bug.

### EXPORT-PREVIEW-SHRINK-001 — Export preview shows a tiny page in a big gray area
Symptom: the Document-export modal renders the page shrunk into a small region with
large gray margins (regression after 1.50.600 un-clamp). Cause: `fitWidth` in
`pwa/antcv-pdf-preview-gate.js` (~618) scales by `min(width-scale, ONE-page-HEIGHT
scale)`; after the 1.50.600 screen un-clamp the measured page/paper height is the
FULL multi-page content, so the height-scale collapses the whole thing tiny.
Fix direction: fit by WIDTH ONLY (drop the one-page-height term, or measure a single
page-row height not the whole paper) and let the modal body scroll vertically.
CLASSIFY: render (sidecar), no regen. I (assistant) may take this first — it's my
regression.

### CL-WIB-002 — CL Strategic Expertise still too long; table doesn't reach the ends
Symptom: after regen the CL WHAT I BRING cells still wrap; the table doesn't fill to
the paper edge (owner had to manually drag rows wider in preview). 1.50.601 set the
preview to 90%/maxWidth 115% and lowered the prompt cap to 62 chars — verify (a) the
new app.js actually loaded (cache), (b) the regen used the new cap, (c) the export
WORKER column ratio (defaultClW / Focus-Area width) matches the preview so the export
fills + wraps less. Sites: `app.src.js` ~5082 (preview wrapStyle, DONE), the worker
table builder (Focus-Area vs Strategic-Expertise width), prompt ~23022 (cap, DONE).
CLASSIFY: worker parity (+ maybe tighten cap to ~55). Owner explicitly de-selected
"give Strategic Expertise more room" earlier, so prefer tightening text + matching
width, not widening the column.

### SALMON-3PAGE-001 — Salmon auto-split not showing despite ~3 pages of content
Symptom: content clearly exceeds 2 pages but the salmon page-split indicator / auto
pagination doesn't appear for page 3. Salmon splitter is PERMANENT (never remove —
[[salmon-splitter-permanent]]). Sites: the autoPages/autoPagesPreview measurer +
`__antcvSalmon` injection. Diagnosis needed: the measurer may cap at 2 pages or the
3rd-page break isn't computed. CLASSIFY: pagination (render). Headless repro hard;
see [[headless-pwa-testing]] + [[pagination-two-map-and-worker-test]].

### WATERMARK-SIDE-001 — AI watermark on the MORE-text side
Rule ([[design-rules-watermark-table]]): the "AI-assisted document" watermark goes in
the section whose LAST page has LESS text. It's currently on the main (more-text)
column. Sites: watermark placement in `app.src.js` (search `AI-assisted` / aiNotice,
~42360 CL path) AND the export WORKER (the PDF watermark). Fix: choose the
lighter-last-page column. CLASSIFY: render + worker.

## CARRYOVER (still open from earlier in the session)
- RESULTS-NUMERIC-001: push per-role Results toward NUMERIC (non-numeric favored).
  Prompt ~23022 outcomes rule. Regen. Fold with LAM-RESULTS-001.
- RESULTS-ORPHAN-001: Meprolight / Computer-Admin Results lines orphan (<4 words last
  line). Prompt ORPHAN RULE doesn't cover the derived Results line. Regen.
- PUB-CHAIN-001: publications keep full publisher chain; non-academic CV should drop
  it (title + year only). Prompt/render. 
- SIDEBAR-BREATHING-001: the preview sidebar "breathes" (reflows/resizes) on every
  vertical scroll. Preview layout instability. Render, needs diagnosis (sidebar width
  recompute on scroll — likely a sidecar measuring on scroll).
- BULLET-CAP (#1): SHIPPED 1.50.602 (continuation/volunteer ≤3 bullets) — verify on
  this regen (volunteer role bullet count).

## SUGGESTED ORDER FOR THE NIGHTLY
1. EXPORT-PREVIEW-SHRINK-001 (clear regression, render-only).
2. G-GROUPS-001/002/003 (one render-family fix unlocks 3 owner items).
3. LAM-RESULTS-001 + RESULTS-NUMERIC-001 + RESULTS-ORPHAN-001 (one prompt/lamination
   pass, owner validates with one regen).
4. WATERMARK-SIDE-001, SALMON-3PAGE-001, CL-WIB-002 (worker-touching).
5. PUB-CHAIN-001, SIDEBAR-BREATHING-001.

Each fix: surgical, cache-bust trio, `node --check`, commit + push, report.
