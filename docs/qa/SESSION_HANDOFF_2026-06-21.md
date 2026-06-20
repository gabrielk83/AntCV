# Session handoff — 2026-06-21 (desktop, owner live)

Fresh-session orientation. Read this first, then `CLAUDE.md` + the memory index. Main is at
**1.50.755** (PWA auto-deploys). A feature branch `feat/publications-main-rich` holds in-progress
work (NOT merged — see "Rich sections build" below).

---

## SHIPPED to main this session (all verified)

| Version | ID | What | Verified |
|---|---|---|---|
| **1.50.753** | SALMON-EMPTY-REGION-001 | Flush preview salmon — the dead ~190px gap above the page-1→2 break is gone. The circular min-height lock had a THIRD actor the cascade map missed: `antcv-sidebar-subsection-pagebreaks-329.js` injects `.antcv-page-row,.antcv-document-sidebar{min-height:1123px!important}`. Coordinated fix: `antcv-page-fit.js` non-last row `min-height:0!important`; `antcv-sidebar-fill-equalize-227.js` sizes the navy to the taller column's CONTENT (children-sum) via inline `!important`. Last row keeps A4. | `diag-salmon-empty-region.mjs` (stable 6 cycles, zero oscillation), boot-smoke, 366/366. |
| **1.50.754** | RESULTS-FIRSTPAINT-REFRESH-001 + SINGLE-SOURCE-OF-TRUTH-001 | Preview Results were stuck PAST tense + role-0 repeated. NOT a tense bug: the app render uses the export lamination (single source of truth) but on first paint that async module isn't loaded → raw past-tense fallback that never refreshed; AND `antcv-results-laminate-510.js` clobbered it. Fix (both in the 510 sidecar): nudge one `antcv:sections-updated` when `AntcvApplyOutcomesMode` loads; DEFER `apply()` once it's available. | **Live-verified via Chrome MCP on the owner's unsolicited app** — all 9 roles present-tense + distinct. boot-smoke, 366/366. See [[results-firstpaint-stale-laminator]]. |
| **1.50.755** | EXPORT-PREVIEW-HUG-001 | Export-preview "kill the dead space" (owner picked Option B over fill-width). The Document-export modal fits a whole A4 page by height (~54-68%), leaving a big grey band beside the portrait page. Now hugs the iframe to the displayed page width + centres it (thin symmetric margin), keeping the whole-page view. Sidecar-only (`antcv-pdf-preview-gate.js`). | boot-smoke. **NEEDS owner live re-check** (hard-refresh, open export preview). |

---

## STILL OPEN (owner named these explicitly)

### Salmons (sidebar cut / blank space) — gated on an owner reload
- The three salmon fixes shipped: SALMON-EMPTY-REGION-001 (753), SALMON-PAGE3-MISSING-001 (751),
  SALMON-SIDEBAR-BREAK-EARLY-001 FORCE (749).
- **OPEN #1 (live review): "sidebar cut not estimated properly → blank spaces."** Owner reported on
  1.50.752 — BEFORE the 753 flush-salmon fix. **First action: owner hard-reload + re-check on ≥753.**
  If still off: the residual is the SIDEBAR-LONGER-THAN-MAIN page break landing late (sidebar
  TOOLS 16 + REGULATORY 30 + certs + langs runs well past the main column). Work in
  `antcv-auto-pagebreak-block-001.js` (sidebar pass), verify with the preview-break diag; do NOT
  blind-hack — most blue-screen-prone area. See [[salmon-splitter-permanent]].
- **OPEN #3 (live review): "not all TOOLS & METHODS groups displayed."** Likely the same long-sidebar
  pagination as #1 (groups pushed past the page box) — confirm after the #1 reload.

### Fit / export preview — shipped, needs verify
- EXPORT-PREVIEW-HUG-001 (1.50.755) is the "fit preview / stretch to full view" fix (Option B).
  **OPEN: owner live re-check.** Tuning knob if the margin is still too wide: the `hug` formula in
  `antcv-pdf-preview-gate.js` `fitWidth()` (`Math.ceil((pw + 24) * eff) + 24`).
- Related (from the P3 brief, NOT done): confirm the auto-pagebreak measurer fingerprint
  re-triggers a FULL re-measure on sidebar-WIDTH + content changes (#4). The salmon force factor is
  `AntcvAutoPagebreak.config({SIDEBAR_PREVIEW_INFLATE:N})` (default 1.32).

### Table twins — generation-gated (regen needed)
- **#6 (live review): 3 of 4 CV CORE COMPETENCIES rows mirror the CL WHAT I BRING table** (relabeled
  headers; only "Validation & compliance" is CV-unique). The twin tables need DISTINCT seeds.
  Generation/prompt fix — register **P5 #9** ("twin tables distinct seeds"). Cannot be verified
  deterministically without a live regen. See [[two-tables-mirror-and-results-numeric]].

### Other open from the live unsolicited review (2026-06-22 register block)
- **#2 Enterprise Architect → software** — in TOOLS & METHODS it's duplicated across "Product &
  systems" AND "Engineering software". Data/categorization (kernel/prompt) — regen-gated.
- **#5 CL "WHO I AM" / "WHY YOUR COMPANY" show the bracketed TEMPLATE** not content — the generation
  didn't produce who/why body text (the `[WHO I AM - …]` placeholder IS the section text).
  Generation-gated (or a render rule to hide a placeholder-only section).
- Full triage in `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` → "OWNER LIVE REVIEW — Unsolicited".

### Carried from earlier in the batch
- **P1 JD-SYNC-001 live verify** (1.50.752) — sign in, load NVIDIA targeted app, confirm
  `antcv:lastJdText` populates within ~2s + WHY heading flips. Needs a signed-in browser.
- **Settings:** SETTINGS-WRITINGSTYLE-STICKY-001 (WritingStylePicker island bleeds across subtabs),
  REVIEW-DATA-DEAD-001 ("Review my data" button dead). Both in the register.

---

## RICH SECTIONS BUILD — branch `feat/publications-main-rich` (the next focused pass)

Owner 2026-06-22, two new richly-edited sections sharing ONE row-editor + controls engine. Full,
locked spec: **`docs/qa/RICH_SECTIONS_SPEC_2026-06-22.md`** (on the branch). Owner approved building
the WHOLE thing on the branch and merging to main in ONE coherent piece (option "A").

**Three control tiers (built once, applied to both):**
- Per-row: ▲▼ reorder · visibility · marker show/hide · the row's fields · CJLR · Page · Enhance ·
  Fit-it · ✕ delete · **+ Add**.
- Per-paragraph (intro/closure): CJLR · Enhance · Fit-it · Page-break.
- Whole-section (high-level, in the section panel): place before/after · ◹ move (Publications:
  main↔sidebar; HWIC: between subsections) · CJLR-all · Enhance-all · Fit-it-all · on/off
  (`section.on`) · ✕ delete-section. Whole-section CJLR/Enhance/Fit fans out to every row + paragraph.

### Feature 1 — PUBLICATIONS & PATENTS (CV, main, movable to sidebar)
**Phase 1 DONE on branch (verified, NOT merged):**
- New `id:"pubs"`, `type:"list_italic"`, `richPub:true`, MAIN, between Professional Experience and
  Recommendations. Skeleton edited in `app.src.js` + mirrored to `app.js` (⚠ the section var is `t`
  in minified vs `e` in source — the shadow hazard; the render gate is `!t.richPub` in `app.js`,
  `!e.richPub` in source).
- Old sidebar `publications` skeleton block removed; `antcv-publications-main-757.js` migrates the
  old items into the new section, retires the old, places it between experience & recs (idempotent,
  respects a manual move). `index.html`: 757 loaded; 273 + 278 retired.
- list_italic preview render gated so `richPub` skips the legacy year-only strip (full citation).
- **The new section is ALREADY editable** via the native `list_italic` editor (`Te`, app.src.js:8489
  — generic, no id gate): visibility/Name/Details/delete/▲▼/+Add. So retiring the old one is NOT an
  editability regression.
- Verified: `pwa/test/diag-publications-main-migrate.mjs` PASS; boot-smoke; 366/366.

**Phase 2 TODO — 5-field editor:** split the single Details field into Authors · Journal/Publisher ·
Year · Pages (5 fields total with Name, all optional). Recommended: extend the `Te` list_italic case
(app.src.js:8489-8680) gated on `e.richPub` to render 5 inputs, with the 4 detail fields in a
side-store `antcv:pubFields[sid][i]` so `items[]` stays composed STRINGS (safe for all readers).
Compose `items[n] = name — [authors, journal, year, pages].filter(Boolean).join(', ')` (match the
existing `Ee(title, details)` composer / `xe()` splitter — verify the em-dash separator). Fallback
when the side-store is empty (migrated data): seed Name from `xe(items[n]).title`, put the rest in
one detail field. Mirror to `app.js` carefully (larger React block — guard occurrence counts,
assert `(()=>{` + no "use strict", boot-smoke).

**Phase 3 TODO — controls engine:** marker show/hide (render the bullet marker like the `bullets`
type, toggleable per-row + section-wide) + per-row CJLR/Page/Enhance/Fit + the whole-section bar
above. Reuse: `antcv-section-control-bar.js`, `antcv-experience-role-cjlr-230.js`,
`antcv-sidebar-item-page-controls-359.js`, `antcv-section-move-button-341.js`.

### Feature 2 — HOW I WOULD CONTRIBUTE (CL) — composite "text · verb/content bullets · text"
Restructure the existing CL HWIC section into: **intro paragraph** (textarea + paragraph controls) →
**verb/content bullet list** (each row: ▲▼ · visibility · marker · **Verb** field · **Content** field
· CJLR · Enhance · Fit · Page · ✕ · +Add) → **closure paragraph** (textarea + paragraph controls),
PLUS the whole-section high-level bar. Keep bullet `items[]` as composed strings ("Verb content");
structured `{verb,content}` in side-store `antcv:contribFields[sid][i]`. The verb/content split lets
the tense engine target the leading verb (same idea as the Results lamination). Build on
`antcv-how-contribute-controls-245.js` + the CL `__antcvBreaks` paginator. Reuse the Feature 1
engine.

### Build discipline (the brick-avoidance contract)
- Edit `app.src.js`, mirror to minified `app.js` — names DIFFER (shadow hazard: anchor on string
  literals, count occurrences, assert `(()=>{` + no `"use strict"`). `node pwa/test/boot-smoke.mjs`
  after EVERY app.js/sidecar change. NEVER `npm run build:app`.
- Cache-bust QUARTET on every changed loaded file AT MERGE TIME (bump `?v=` in index.html +
  `version-override.js` dynamic `?v` at index.html:364 + `sw.js` CACHE + `TARGET_VERSION`; add the
  PREVIOUS target to STALE, never the new one). The pre-push hook gates on the `?v` bump.
- Headless verify past the sign-in gate per phase (see [[headless-pwa-testing]]). Merge the whole
  feature set only when coherent. Branch keeps production safe meanwhile.

---

## Quick branch resume
```
git checkout feat/publications-main-rich
git rebase main            # main is 1.50.755; branch will need ?v >= 756 at merge
node pwa/test/diag-publications-main-migrate.mjs   # Phase 1 still green
```
Then build Phase 2 → 3 → HWIC per `RICH_SECTIONS_SPEC_2026-06-22.md`, cache-bust, merge.
