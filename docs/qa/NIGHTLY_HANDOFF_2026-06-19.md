# Nightly handoff — 2026-06-19 (owner-directed: open-items + full permissions)

Owner (2026-06-19): "give instructions and full permissions (bypass permissions) to the next
nightly including the permission to render gabriel.bg." This handoff is the authoritative brief for
the next autonomous nightly session. Shipped through **1.50.691** on `main` (origin = local).

## PERMISSIONS GRANTED (owner, explicit) — bypass, no pauses

The nightly runs with FULL autonomy. Do NOT pause for per-action approval. Specifically authorised:

1. **app.src.js → app.js mirror** edits + `app.js?v=` bumps + the cache-bust QUARTET
   (`app.js?v=` in index.html · `CACHE` in sw.js · `TARGET_VERSION` in antcv-version-override.js ·
   add the PREVIOUS version to `STALE_VERSIONS`). Never put the current version in STALE.
2. **Sidecar** edits + their `?v=` bump in index.html.
3. **Worker** edits (`workers/docx-worker/src/index.js` inlined bundle) + manual `wrangler deploy`
   (one deployer). proxy ↔ demo-proxy parity.
4. **Island** edits (`src/islands/**`) + `npm run build` + `antcv-react-islands.js?v=` bump.
5. Commit + push to `main` freely; deploy relay/workers freely. Report at milestones.
6. **RENDER GABRIEL_BG — generation self-verify (the key new grant).** The nightly MAY trigger a
   real generation using Gabriel's kernel (which renders `GABRIEL_BG` into the prompt) to
   SELF-VERIFY the prompt-side fixes below — it no longer has to defer those to an owner regen.
   Use Gabriel's live kernel/`personalInfo` (his real data; see [[gabriel-cv-facts]]). Treat a
   prompt fix as "verified" only after a regen shows it in the rendered Preview + export. This
   covers: tense, numeric outcomes, bring≠core, unsolicited breadth, interests-fill, accessibility
   first-person, AI-assisted-workflows-in-Methods, WHO/WHY no-inline-label.

## QUEUE (owner-ordered 2026-06-19 — do in THIS order)

### 1. preview ≠ PDF Results (and preview repetitive) — FIRST FIX shipped 1.50.693, RENDER-VERIFY
The preview already runs the export's applyOutcomesMode and maps results by role `id`; the PDF
renders role.results directly. Confirmed failure mode: DUPLICATE / MISSING role ids collapse the
preview map → one result repeats under several roles + others mismatch, PDF correct.
**Shipped:** `antcv-role-id-stabilize.js` (1.50.693) gives every role a unique non-empty id.
**STILL VERIFY (permission #6, render GABRIEL_BG):** confirm Preview Results == PDF on every role.
If a mismatch REMAINS after ids are unique, the next hypotheses are (a) the `window.__antcvRR` memo
keyed on the raw sections string serving stale across a render, and (b) React-state roles vs
localStorage-sections roles out of sync (preview iterates React `e`, map built from localStorage).
See [[two-tables-mirror-and-results-numeric]], [[v2-kernel-lamination-shape]], [[domain-and-outcomes-parity]].

### 2. Page-break (autobrake) misplaced + manual break is row-scoped, not section-scoped
(a) The auto page-break landed AFTER "System Architect, Innoviz" instead of BEFORE it, splitting the
role across the page boundary. The break should fall BEFORE a role, not mid-role.
(b) OWNER 2026-06-19: the MANUAL page-break button (↧ "Move this row and all following rows to next
page", `data-antcv-pb-icon-fixed`; glyph from antcv-page-break-icon-357.js, behaviour from the
row-level `antcv:itemPages` model) only splits the CURRENT section's table — "nothing under the
table (Professional Experience) moves to page 2." The itemPages model is per-section-per-row, so a
core_comp row set to page 2 splits that table but does NOT push subsequent SECTIONS. Needed: a
section-level "everything from here down → next page" break that the salmon split + worker export
both honour. autoPages / [[salmon-splitter-permanent]] / [[pagination-two-map-and-worker-test]].
Verify the salmon split AND the worker export both break before the role / push following sections.

### 3. AI-Notice overlap
The AI watermark/notice rams into the END of the longer (main) column in the CV. Rule
([[design-rules-watermark-table]]): the watermark goes in the section whose LAST page has LESS text;
it must never overlap body content. Fix placement so it sits clear of the main column's last line.

### 4. Tense — present chosen but Results + role content render PAST  ([[tense-results-roles-past]])
`styleConfig.expTense='present'` is honoured by the prompt (`__tenseRule`, app.src ~23067) on a
REGEN, but the LAMINATED Results (`applyOutcomesMode`) + role bullets render in their STORED tense.
Either confirm a present regen fixes it (permission #6), or add a render-time leading-verb tense
pass (Owned→Own, Built→Build, Reduced→Reduce, Directed→Direct, Cut→Cut, Secured→Secure) applied to
laminated Results + role bullets when `expTense` is 'present'|'past'. Keep preview ↔ export parity.

### 5. Core-competencies CJLR export parity (shipped preview side 1.50.692)
Preview now honours the native CJLR (`section.rowAlign[]`) with header=center / body=justify
defaults (234 sidecar `getAlign` reads rowAlign; it was overriding it before). REMAINING: the
docx-worker rowAlign default must MATCH (header center, body justify) so export = preview; today the
worker likely defaults left → a preview≠PDF gap (ties into item 1). Verify by rendering GABRIEL_BG.

### 6. Pre-existing CI unit-test failures (predate this session — NOT regressions)
`node --test pwa/test/unit/*.test.mjs` has 7 failures unrelated to this session's work
(confirmed: in buildPayload / table-dims paths untouched here):
- `placeholder-export-guard` (×2): the export NBSP-binds orphans (ORPHAN-NBSP-EXPORT-001,
  656) and the placeholder-strip regex then fails to match the NBSP'd placeholder, so an
  unfilled "[WHY THIS POSITION …]" placeholder survives export. Likely a REAL ordering bug
  (strip placeholders BEFORE NBSP-binding), not just a stale test — verify with a render.
- `table-dims-forward` / table-width (×5): the CL table export width reference changed in
  1.50.671 (CL-TABLE-WIDTH-PAGE-REF-001) from 9602 → ~11506; the tests still expect
  9602×1.10=10562 (actual 12657=11506×1.10). Confirm 12657 is the intended new value, then
  update the expectations (or fix the code if 671 over-shot).
(Test-drift my OWN changes caused was already fixed: CJLR justify default, edit-guard order,
recs string, howcontribute NBSP — committed 129908c.)

## OWNER-VERIFY / NEEDS-A-CLICK (don't blind-fix)
- **Core Competencies duplicate controls** (3 page-breaks + 2 CJLR per row): owner must identify
  WHICH page-break + WHICH CJLR actually drive the preview before any are hidden
  ([[dont-hide-controls-as-duplicates]]). Safe parts already shipped 1.50.691 (CJLR default centered;
  smaller inputs). CJLR-over-group EXPORT parity (docx-worker) still open.

## STANDING DISCIPLINE
- Verify PAST the sign-in gate ([[headless-pwa-testing]]) — boot-smoke is necessary, not sufficient.
- Prompt-side fixes are now nightly-verifiable via permission #6 (render GABRIEL_BG), not
  owner-only.
- Minified mirror: names DIFFER — anchor on string literals, watch the shadow hazard
  ([[minified-mirror-shadow-hazard]]). PS 5.1 mojibake: never Get-Content/Set-Content the UTF-8
  sidecars ([[powershell-git-commit-quoting]]).
