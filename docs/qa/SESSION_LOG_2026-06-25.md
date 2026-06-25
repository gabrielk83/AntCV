# Session log — 2026-06-25 (pagination + sidebar + watermark + content-caps)

Desktop session. PWA `1.50.762 → 1.50.917`, docx-worker `1.14.83 → 1.14.86`. Suite 472/472 throughout.
Focus: the owner's live iteration on a real **unsolicited** CV/CL export (Gabriel persona) — sidebar
pagination, main-column pagination, the AI notice, content length caps, and editor bugs.

> **Verification constraint (important):** this env has **no PDF renderer** (`pdftoppm` absent; the
> Chrome PDF viewer is a `chrome://` URL the screenshot tool can't read), and the automated preview
> tab became **unreliable at rendering the full editor** (often renders 0–1 experience roles after a
> reload). So the last-mile pagination/watermark calibration was done blind + via the live
> `antcv:autoPages` map readout, and several items below are **shipped-but-owner-must-verify**.

---

## CLOSED this session

- **SIDEBAR-STABLE-001 (1.50.913)** — TOOLS & METHODS stays WHOLE on page 1 (no dance); certs +
  education → page 2. Root: the page-1 sidebar band over-deducted (PAGE1_BAND + photo, and the photo
  measure flipped 0↔156 = the dance) + a stale break the reconcile missed. Fix: band = PAGE1_BAND
  alone; deterministic sidebar pass is authoritative (clears any break it didn't produce). *Owner
  follow-up: white space UNDER tools still jumps — see OPEN #3.*
- **MAIN-PDF-LINE-001 (1.50.910)** — Change Request Lead (role 1) back on page 1. The main export
  line used USABLE_PDF (deflated for the sidebar); the main renders close to preview, so it under-
  sized page-1 capacity. Added MAIN_PDF_LINE_BONUS on the main line. Verified (experience `2->2`).
- **MAIN-PDF-LINE-PAGE1-001 (1.50.915) + MAIN-PAGE-N-BAND-001 (1.50.916-917)** — the page-1 bonus
  was wrongly applied to pages 2+ (over-filled page 2). Split: page 1 gets +MAIN_PDF_LINE_BONUS,
  pages 2+ get −MAIN_PAGE_N_BAND (CONT header + taller rows). Page-1/2 dance now **stable**. Band
  tuned 160→105 to target Research Assistant (role 7) at the top of page 3. *Owner must verify the
  exact role — see OPEN #5.*
- **SIDEBAR-INFLATE-GRPWHOLE-001 + FORCE-LAST-GRP cached-sticky (1.50.896→906)** — regulatory's
  Environmental group → page 3 with "(CONT.)". Coordinator now budgets the sidebar in export units
  (1.2 inflate) + a deterministic post-process pins the last group to the next page, cached by a
  stable signature (block count + col width) so it holds yet re-evaluates on real edits. *Owner
  follow-up: regulatory + languages STILL jump in/out of page 3 — see OPEN #2.*
- **FORCE-LAST-GRP cache invalidation (1.50.907)** — keyed on sidebar block count + column width so
  the regulatory break survives re-measure noise but re-evaluates when an upper item is hidden / the
  sidebar is widened (owner caveat: don't oscillate, but allow going up).
- **FIELD-CAPS (1.50.909)** — CV CORE COMPETENCIES Focus Area ≤25, Strategic Expertise ≤125; CL HOW
  I WOULD CONTRIBUTE intro ≤125. Folded into `antcv-core-comp-compress.js` (word-boundary, no ellipsis).
- **FINAL-ROLE-CONDENSE-002 (1.50.894)** — volunteer/foreningsarbejde role ≤3 bullets (4 if merged);
  "Environmental, Durability & Materials Compliance" → "…& Compliance".
- **LOGIN-VERSION-FLASH (1.50.907)** — boot no longer flashes the stale `1.50.722-babel-fish`; the
  gate shows nothing until `window.ANTCV_VERSION` resolves.
- **RICH-BLOCK-GROUP-ALIGN-DEFAULT-001 (1.50.908 + worker 1.14.86)** — grouped rich_block (tools,
  regulatory) defaults group-name rows CENTER + content rows LEFT, preview + export; CJLR overrides win.
- **HWIC-INTRO-DETECT-ROBUST-001 (1.50.912)** — HWIC intro/closing detected by paragraph-length (not
  just a trailing ":"), so the ≤125 cap stripping the ":" no longer makes them regain markers.
  *Regressed by the HWIC editor jumpiness — see OPEN #4.*
- **WM-COLUMN-CLASSIFY-001 (1.50.911) + AI-WM-SIDEBAR-PARENT-001 (1.50.914)** — AI notice column
  chosen by actual column container (not page midline); preview re-parents into the sidebar for the
  left corner. Export was already correct (page-left = sidebar). **REGRESSED in 917; re-fixed in 918.**

### Added 2026-06-26 (next-session continuation)

- **AI-NOTICE-MISSING-PREVIEW-001 (1.50.918)** — the 914 re-parent into `.antcv-document-sidebar`
  hid the notice (the last page's sidebar column can be short/empty/overflow-clipped, so the marker
  placed at the page bottom fell outside its box and was clipped). Re-parent into the PAGE-BOX
  instead: full-page span keeps it visible while the left inset still lands at the page's left edge
  (= sidebar). `antcv-watermark-page-anchor-341.js`. *Owner verify in preview.*
- **CORE-COMP-FOCUS-TIGHTEN-001 (1.50.919)** — the 909 `CAP_FOCUS=25` truncated Focus-Area labels
  the `Coord.`→`Coordination` expansion pushed over 25 (`Technical team Coordination` →
  `Technical team`). Owner's call: write them concisely, not truncate — drop a redundant `team`
  before a Coordination noun (`Project team Coordination` → `Project Coordination`). New `tighten()`
  in `antcv-core-comp-compress.js`; `core-comp-compress-coord.test.mjs` updated. (This was the hidden
  HEAD test regression — the 06-25 suite was actually 469/472, not 472/472.)
- **HWIC-INTRO-DETECT-001 / -COLON-KEEP-001 (1.50.919)** — the 912 "first row ≥50 chars = intro"
  heuristic mis-classified real first/last contribution bullets (also ≥50 chars) as intro/closing,
  demoting them to markerless every render = the OPEN #4 marker jitter. Fixed at the root instead:
  `antcv-core-comp-compress.js` now re-attaches the intro's trailing `:` after the HWIC cap, so the
  760 converter's `:`-only intro detection stays reliable and the length heuristic was dropped.
  Restored the `contribute-peel-fix.test.mjs` REPAIR test to green. *Resolves the marker-reset facet
  of OPEN #4; the editor-fighting facet (header flip / closure-button removal) still needs live repro.*
- **Worker DET-COORD-PACK-001 (1.14.85)** — same-page sidebar sections pack onto one page (no
  per-section page). **Cert double-header / first-item whole-move (1.14.84).**

---

## OPEN (carry to next session)

1. **AI-NOTICE-MISSING-PREVIEW-001** `[FIX SHIPPED 1.50.918, owner-verify]` — root cause confirmed:
   the 914 re-parent into `.antcv-document-sidebar` placed the absolutely-positioned marker (anchored
   at the PAGE bottom) outside the last page's sidebar box — that column can be short / empty /
   overflow-clipped — so it was clipped away. Fix (`antcv-watermark-page-anchor-341.js` `anchorToCorner`
   left branch): re-parent into the PAGE-BOX instead of the sidebar. The page-box always spans the
   full page, so the left inset still resolves against the page's true left edge (= the sidebar's
   left edge) AND the marker stays visible. Idempotent (guarded by `parentNode`). *Owner must confirm
   the notice is back in the preview AND in the sidebar's bottom-left corner.*
2. **SIDEBAR-PAGE23-DANCE-001** `[OPEN]` — regulatory (Environmental) + Languages still jump in/out
   of page 3. The FORCE-LAST-GRP cached-sticky stabilised the FORCE itself, but the page-2/3 sidebar
   boundary still flickers (likely the 913 band change re-opened a measure↔render flip for the
   sections AFTER regulatory). Needs the sidebar page-2/3 boundary cached/deterministic like page 1.
3. **TOOLS-GAP-JUMP-001** `[OPEN]` — tools stays on page 1 (good) but the WHITE SPACE under it jumps.
   Residual dance: the page-1 sidebar fill/last-item position flickers even though the break doesn't.
4. **HWIC-EDITOR-JUMPINESS-001** `[PARTIAL — marker facet fixed 1.50.919, owner emphasised]` —
   entering the HOW I WOULD CONTRIBUTE editor panel makes the WHAT I BRING table above it **super
   jumpy**: it flips the two header texts ("Strategic Expertise" ↔ "Focus Area") and resizes the
   columns, the bullet marker returns to its previous mode on every change, and the change REMOVES
   the closure button. **The bullet-marker-reset facet is fixed (HWIC-INTRO-DETECT-001, 919):** the
   912 length heuristic that re-classified real bullets as intro/closing each render is gone. STILL
   OPEN: the WHAT I BRING header text-flip + column resize + closure-button removal — root in the
   HWIC controls (`antcv-how-contribute-controls-245.js`) + the WHAT I BRING header CJLR sidecar
   (`antcv-what-i-bring-header-cjlr-249.js`) re-rendering/fighting on focus. Needs reproduction with
   the editor open (a fresh session with working live preview).
5. **RESEARCH-ASSISTANT-PAGE3-VERIFY** `[SHIPPED-UNVERIFIED]` — MAIN_PAGE_N_BAND=105 targets role 7
   (Research Assistant) at the top of page 3, aligned with Environmental. Couldn't verify live (tab
   render). Owner tunes `AntcvAutoPagebreak.config({ MAIN_PAGE_N_BAND:N })` — higher = earlier role,
   lower = later — and reports the value to commit as default.
6. **GROUP-HEADER-MANUAL-BREAK-001** `[OPEN]` — a manual page-break (P3 row control) on a GROUP's
   FIRST content row should move the group HEADING + all rows below with it (currently the break lands
   after the header, orphaning it). Apply the group-aware snap (as in FORCE-LAST-GRP) to MANUAL breaks
   in the coordinator + worker.
7. **AI-NOTICE-DYNAMIC-001** `[OPEN]` — at load (template only) the sidebar is fuller so the notice
   goes to main; as roles generate/edit, the emptier column flips and the notice must FOLLOW. The
   anchor re-runs on `sections-updated` + the chooseCorner cache sig includes last-page text length,
   so it SHOULD re-place — verify after a hard-refresh (a stale SW may be masking the 911/914 fixes);
   if still static, add an explicit re-run on `antcv:autoPages` change.

## Live tunables (coordinator `antcv-auto-pagebreak-block-001.js`)
`AntcvAutoPagebreak.config({ ... })`: `PAGE1_BAND` (200), `SIDEBAR_PAGE1_BAND` (null=PAGE1_BAND),
`SIDEBAR_PREVIEW_INFLATE` (1.16), `KEEP_WHOLE_FRAC` (0.62), `FORCE_LAST_GRP_FRAC` (0.35),
`MAIN_PDF_LINE_BONUS` (150, page-1 main), `MAIN_PAGE_N_BAND` (105, pages-2+ main).
