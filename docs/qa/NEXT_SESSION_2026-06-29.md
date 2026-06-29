# AntCV — Next session handoff (2026-06-29)

## ► COPY-PASTE NEW-SESSION PROMPT
> AntCV — continue from `docs/qa/NEXT_SESSION_2026-06-29.md` (PWA **1.50.961**, docx-worker **1.14.94**,
> access-relay **1.3.2**, suite 521/521). SYNC FIRST (`git fetch && git pull --rebase origin main`).
> Read that handoff + MEMORY.md ([[data-loss-on-restore]], [[sidebar-fill-gap-is-antiblank-slack]],
> [[pagination-two-map-and-worker-test]], [[docx-worker-bundle-no-build]], [[minified-mirror-shadow-hazard]]).
> There is **NO local renderer** here — docx pagination/header fixes are verified STRUCTURALLY via the
> worker node harness; PIXELS need the owner's real CloudConvert export. The top open item is the
> **CV 3-page convergence (A)** + the **candidate-header contacts-spread-left (B)** — they share ONE
> root: the page-1 photo-header bridge uses a different column grid than pages 2-3. Fix them together
> in `workers/docx-worker/src/index.js` (finer/separate header grid + equal page-table grids + drop the
> photo-path trailing break), ship FLAG-GATED if needed, owner verifies the export. Then the export-only
> pagination parity (E) and the floating-spine spine fill.
> ALSO (owner "do not forget", NOT render-gated — section "OPEN — COVER-LETTER FORMAT SETTINGS"): **F1**
> make the CL SLOGAN an editable section + a control in the CL format panel (today it's derived from
> meta.subtitle, uneditable); **F2** default WHAT I BRING to `rich_block` (rich_context) not `table`;
> **F3** surface the signature control as a subsection in the CL format panel (today it's under Layout's
> PROFILE PHOTO). These are preview-verifiable — good to do first.
> One verified fix at a time; cache-bust quintet; worker deploy via deploy.yml.

---

**Current state:** PWA **1.50.961**, docx-worker **1.14.94**, access-relay **1.3.2**, unit suite 521/521.
SYNC FIRST (`git fetch && git pull --rebase origin main`). Cache-bust quintet on every loaded PWA file;
`app.js` is the minified mirror of `app.src.js` (surgical count-guarded edits). Worker deploy =
`gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`.

NO LOCAL RENDERER here (no LibreOffice; Office is Word, not CloudConvert's engine). Pagination/layout
fixes can be STRUCTURALLY verified by driving the worker in node + inspecting `word/document.xml`, but
their PIXEL result needs the owner to export a real CloudConvert PDF. Don't ship blind render changes.

---

## SHIPPED THIS SESSION (2026-06-28/29) — all verified, suite/boot green

- **access-relay 1.3.2 — GEN-CONTAMINATION-PRESERVE-DRAFTS-001** (CRITICAL data loss). `/api/prefs/
  wipe-generated` blanket-nulled EVERY saved app's cv/cl_sections on a full regen; scoped to the ACTIVE
  app only. Verified live (3 of 4 of the owner's saved apps had been nulled) + `diag-wipe-generated-
  preserves-drafts.mjs` 4/4. See [[data-loss-on-restore]].
- **1.50.957 — DATA-LOSS-LOAD-GRACE-001.** Loading an empty/damaged saved app no longer blanks the
  editor into the me() template; keeps the current draft + shows a notice. Both switch sites (topbar +
  Settings) + app.js mirror. The 3 already-nulled drafts are UNRECOVERABLE — owner must regen them.
- **1.50.958 — TOOLS-PAGE1-BAND-001.** `SIDEBAR_PAGE1_BAND` 300→270. TOOLS & METHODS (627px) now fits
  page 1 (budget 624→654); CERTS still flows to page 2. Verified live (`autoPages.tools` = no break).
- **1.50.959 — CL-SIGNATURE-CONTROL-001.** Layout upload control (sidecar `antcv-cl-signature-
  control.js`, no app.js mirror) + CL-end preview `<img>` (app.src.js + app.js mirror). Export was
  already done (worker 1.14.93). End-to-end: upload PNG/JPG in Layout → CL preview + exported PDF.
- **1.50.960 / worker 1.14.94 — SLOGAN-CL-001 + NAME-FOLLOWS-SIG-001.** (1) A tagline heading at the
  top of the CL body (candidate subtitle uppercased; Gabriel unsolicited = "PROCESSES • PRODUCTS •
  PEOPLE", reuses meta.subtitle). (2) CL sign-off reordered to "Kind regards," → signature → typed
  name, and the name adopts the signature's CJLR alignment. Preview (app.src.js + app.js mirror) +
  worker buildLinearDocument; verified `diag-cl-slogan-sig.mjs` 2/2 + existing CL diags green.
- **1.50.961 — FORCE-LAST-GRP-SETTLE-001.** Environmental, Durability & Compliance now cuts to page 3.
  The `__forceLastGrpStick` cache re-applied on block-count alone, pinning a stale start page (after
  TOOLS freed page 2, regulatory now starts page 2). Fix: cache validity also requires the section's
  start page to match; re-evaluates on a genuine settle, dance-damping preserved. Verified LIVE
  (`autoPages.regulatory = {0:2,19:3}` → Environmental on page 3, stable across 5 re-measures, no dance).

---

## OPEN — COVER-LETTER FORMAT SETTINGS (owner 2026-06-29, "do not forget") — NOT render-gated

Owner wants these CL features promoted into the **cover-letter format settings panel** (the CL
Settings/format panel, not only the Layout tab). All three are preview-verifiable (no real export needed
for the control/preview; the export side for slogan + signature already ships — worker 1.14.94).

### F1. SLOGAN as an editable SECTION + a panel control
SLOGAN-CL-001 (1.50.960) currently DERIVES the slogan from `meta.subtitle` (uppercased) — there is no way
to edit the slogan text independently or hide it. Owner wants a real **slogan section** with its own
control in the CL format panel: editable text (default for Gabriel unsolicited = "PROCESSES • PRODUCTS •
PEOPLE"), show/hide, and (nice) alignment. Storage: a standalone key (e.g. `antcv:clSlogan` /
`antcv:clSloganHidden`) like the signature keys, OR a real CL section `{id:'slogan', type:'rich_block'/
heading}` that the builder reads. Builder reads it INSTEAD of `meta.subtitle` when present (subtitle stays
the fallback default). Touch: preview srcdoc builder (app.src.js CL branch — the slogan IIFE I inlined at
the top of the CL body td) + app.js mirror + worker `buildLinearDocument` (the `__slogan` block at the top
of `bodyChildren`) + a panel control sidecar (mirror the `antcv-cl-signature-control.js` pattern).

### F2. WHAT I BRING — default to rich_block (rich_context), not `table`
The CL `bring` section is `type:"table"` (rows). Owner wants the DEFAULT to be `rich_block` (the universal
"rich_context" type), like the other CL sections already converted ([[rich-block-universal-section]]).
Add a migration sidecar (mirror `antcv-hwic-to-rich-block-760.js` / the bring is the LAST own-type CL
section besides greeting/closure) that converts `bring` table rows → rich_block items (each row's
`[label, value]` → a `{b:label, t:value}` row, or a grp+rows shape), idempotent + self-converging; and/or
change the me() skeleton + generation hydration to emit rich_block for `bring`. Verify preview + worker
render + the diag-full-doc-health. NOTE the bring table is referenced in CL width/closure logic — check
nothing reads `bring.rows` after conversion.

### F3. SIGNATURE control as a subsection in the CL format panel
The signature control (`antcv-cl-signature-control.js`, 1.50.959) currently injects under the PROFILE
PHOTO control in the **Layout** tab. Owner wants it ALSO/instead as a **subsection in the CL format
panel**. Either add a second mount target (the CL format panel) or move it there. Keep the single-mount /
own-marker / no-sticky-leak discipline (mount ONCE per panel; if mounted in two panels, guard each with a
distinct marker so neither leaks). Same standalone keys; no behavior change — just placement.

---

## OPEN — RENDER-GATED (need the owner's real CloudConvert export to verify)

### A. [HIGH] CV 3-page convergence — tail (INTERESTS/ACCESSIBILITY/RECOMMENDATIONS) spills to page 4
Owner attached a hand-edited **`..._3page proper.docx`** that renders 3 pages with IDENTICAL text. A
structural diff (agent, 2026-06-29) found the 3-page version differs ONLY in layout mechanics:
1. **Removed a trailing empty `pageBreakBefore` paragraph** before the final `<w:sectPr>` (the direct
   4th-page driver in the owner's real export). NOTE: a clean no-photo CV does NOT reproduce this in the
   current worker (`test/diag-trailing-page.mjs`: 3 tables, 2 breaks, no trailing break) — so the stray
   break is tied to the PHOTO-HEADER page-1 path. Investigate the page-1 bridge/header branch of
   `buildTwoColumnDocument` for an extra `__pageBreakPara()` / empty render slot when a photo header is
   present.
2. **Equalized the page-table grids.** The hand-fix made every two-column page-table use the SAME
   `gridCol` pair `4230 / 7328` (tblW 11558). The owner's export had page-2 at `4320 / 7382` (11702) —
   WIDER — because the page-1 candidate-header bridge uses a 3-col grid (`3420 / 810 / 7676`) that
   doesn't match pages 2-3. Same root as issue B (header). Make all page-table grids identical.
3. **Structural model (the documented "page-anchored floating spine"):** the hand-fix converts the
   page-2/3 tables to floating text-anchored tables (`<w:tblpPr w:vertAnchor="text" w:tblpY="1"/>` +
   `<w:tblOverlap w:val="never"/>`) under a `<w:sectPr w:type="continuous"/>`, so they pack against the
   preceding content instead of each being pushed to a guaranteed inline page. This is the real fix and
   matches [[sidebar-fill-gap-is-antiblank-slack]]'s "page-anchored floating spine" direction. Larger
   rework — implement FLAG-GATED (default off, like `balanceOverflow`), structurally verify (`tblpPr`
   present), owner verifies the render, then default-on.
Extracted XML: scratchpad `current.xml` / `target.xml`; probe: `test/diag-trailing-page.mjs`.

### B. [HIGH] Candidate-header contacts not spread leftwards (export only; preview is correct) — issue #6
The bridge header's photo + text cells snap to the body column grid, so the contact line stays centered/
right instead of spreading left. Owner: "left-align is NOT the fix; the cells aren't actually separate."
Fix = a finer header grid (3 cols + gridSpan) OR a SEPARATE header table so the photo cell is genuinely
narrower and the contact line reclaims the width. `workers/docx-worker/src/index.js` bridge headerRow
(~24827) + the page-1 grid. This is the SAME page-1-grid mismatch feeding A.2 — fix together.

### C. Environmental, Durability & Compliance → page 3 — DONE (FORCE-LAST-GRP-SETTLE-001, 1.50.961, verified live)

### D. [MED] Change Request Lead role → page 1
Page-1 main through that role = 774px; export page-1 main holds ~744 (ROLE-ORPHAN-PAGE1-001 set
`MAIN_PDF_LINE_BONUS`=20 on THIS exact role to stop its bullets orphaning in the PDF). ~30px over. Owner
chose to TRIM one bullet (the longest: "Coordinated cross-team change requests… impact analysis across
optics, electronics, firmware, validation, suppliers…") rather than push the budget. Owner is doing the
trim in the editor. After trim, the role fits page 1 with no budget change.

### E. Lower-priority queue (carried)
- Export-only pagination PARITY (Recommendations/Interests/Accessibility land later in the PDF than the
  preview): `assembleColumn` (`buildTwoColumnDocument` ~24636) advances `running` only via
  `__firstPageOf` (a section's FIRST page) and never counts the INTERNAL `__antcvPB` markers that
  spanning sections (experience/split-lists/rich_block) emit — so a tail section's leading break is
  wrongly kept, landing it a page late. Fix: advance `running` by each section's internal break count.
  (Related to A — same column-assembly function.)
- Sidebar colored spine stops ~2cm short of the page bottom — DELIBERATE anti-blank-page slack; the real
  fix is the floating-spine (A.3). Do NOT raise the body-row mins ([[sidebar-fill-gap-is-antiblank-slack]]).
- "SW projects: AntCV" Additional-Info value should be a live hyperlink (markdown/URL → ExternalHyperlink).
- AI-notice → sidebar computed as the LAST step (post-pagination).

## DISCIPLINE
- A/B/E touch the docx worker and need a REAL CloudConvert export to verify pixels — ship structural
  changes flag-gated or with the owner exporting. C/D are coordinator-side and preview-verifiable.
- Worker has no build step ([[docx-worker-bundle-no-build]]); edit `src/index.js`. Deploy via deploy.yml.
