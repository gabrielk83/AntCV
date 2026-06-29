# AntCV — Next session handoff (2026-06-29)

**Current state:** PWA **1.50.959**, docx-worker **1.14.93**, access-relay **1.3.2**, unit suite 521/521.
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

### C. [MED] Environmental, Durability & Compliance → page 3 (FORCE-LAST-GRP not firing)
After TOOLS-PAGE1-BAND-001 freed page 2, REGULATORY CONTEXT now fits entirely on page 2 (`autoPages.
regulatory = {0:2}`), so its last group (Environmental, item 20) sits at the bottom of a ~97%-full page
2. The owner wants it isolated onto page 3. FORCE-LAST-GRP (`antcv-auto-pagebreak-block-001.js` ~1043)
should move it (regulatory tot 493 > threshold 323, 5 groups, beforePage 2) but DOESN'T — the
block-count-keyed `__forceLastGrpStick` cache likely pinned a transient startPage from boot (handoff
"confirm FORCE_LAST_GRP doesn't fight the sig-cache"). Cache ON and OFF both give {0:2} now. Fix: make
`__forceLastGrpStick` re-evaluate when the section's measured start page changes, not only on block-count
shrink — without re-introducing the page-2/3 dance. Coordinator-side; preview-verifiable (no render).

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
