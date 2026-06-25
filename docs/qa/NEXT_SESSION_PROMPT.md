# Next session — AntCV (start here)

**Authoritative current state + closed/open lists: `docs/qa/SESSION_LOG_2026-06-25.md`.** Read it first.
PWA `1.50.919`, docx-worker `1.14.86`, suite 474/474.

**SYNC FIRST** (`git fetch origin && git pull --rebase origin main`) — the cloud routine + parallel
worktrees push to `main`. `app.js` is the minified mirror of `app.src.js` (surgical edits, must start
`(()=>{`, count-guarded replace). Cache-bust quintet on every loaded-file change (file `?v` + the
`window.ANTCV_VERSION` seed + `vo.src` in index.html + `sw.js` CACHE + version-override TARGET, add
the previous to STALE).

> **Cloud env constraints (recorded 2026-06-25):** CDN (unpkg.com) is blocked in cloud — React fails
> to load → boot-smoke cannot run. Playwright/headless verification of pagination/watermark is not
> possible in cloud. All items marked "needs live browser" must be done from desktop.

## Open queue (priority order)

1. **SIDEBAR-PAGE23-DANCE-001 [OPEN]** — regulatory (Environmental) + Languages still jump in/out of
   page 3. The FORCE-LAST-GRP cached-sticky stabilised the forced break, but the page-2/3 sidebar
   boundary still flickers. Fix: apply the same deterministic, signature-cached boundary approach used
   for page 1 to the page-2/3 split. File: `pwa/antcv-auto-pagebreak-block-001.js`. Needs Playwright +
   live verify. Desktop only.

2. **TOOLS-GAP-JUMP-001 [OPEN]** — TOOLS & METHODS stays whole on page 1 (no break dance), but the
   white gap underneath it still flickers. Root: the page-1 sidebar fill/last-item position flickers
   even though the break is stable. Diagnose with `AntcvAutoPagebreak.config({...})` in the console.
   Needs live browser.

3. **HWIC-EDITOR-JUMPINESS-001 [PARTIAL — marker facet fixed 1.50.919]** — entering the HOW I WOULD
   CONTRIBUTE editor makes WHAT I BRING header text flip ("Strategic Expertise" ↔ "Focus Area"),
   columns resize, and the closure button disappears. Marker-reset facet is fixed (1.50.919). Remaining:
   header flip + column resize + closure button. Root: `antcv-how-contribute-controls-245.js` +
   `antcv-what-i-bring-header-cjlr-249.js` fighting on focus. Needs reproduction with editor open and a
   working live preview tab.

4. **RESEARCH-ASSISTANT-PAGE3-VERIFY [SHIPPED-UNVERIFIED]** — `MAIN_PAGE_N_BAND=105` targets role 7
   (Research Assistant) at the top of page 3. Owner tunes live: `AntcvAutoPagebreak.config({ MAIN_PAGE_N_BAND: N })` —
   higher N = earlier role, lower = later. Report the value to commit as default.

5. **GROUP-HEADER-MANUAL-BREAK-001 [OPEN]** — a manual P3 row break on a group's FIRST content row
   should move the group HEADING + all rows below with it (currently the break orphans the header).
   Apply the group-aware snap (as in FORCE-LAST-GRP) to manual breaks in the coordinator
   (`pwa/antcv-auto-pagebreak-block-001.js`) and the worker. Needs Playwright + live verify.

6. **AI-NOTICE-DYNAMIC-001 [CODED — verify]** — the watermark already listens to
   `antcv:auto-pages-changed` (line 431 of `antcv-watermark-page-anchor-341.js`) so it SHOULD re-place
   as content generates. Verify after a hard-refresh (stale SW may mask the 911/914 fixes). If still
   static, add an explicit re-run on `antcv:autoPages` localStorage change.

7. **Regen-gated content [OPEN]** — all need an owner signed-in generation:
   - #5 Certs trim to JD context — spec: `docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md`.
   - #6 Laser safety standard — kernel/data gap + prompt.
   - #8 Accessibility −30-40% — target: "Hearing impaired: Cochlear implant user. Captions & written follow-up work well."
   - #12 CL Strategic-Expertise cells — terser cells (less detail, not shorter).
   - UNSOLICITED gen quality (CV-UNSOLICITED-ALL-ROLES-001, CV-MERGE-TITLE-ORDER-001,
     CV-MERGE-BULLET-RESULT-UNION-001, CV-UNSOLICITED-PUBS-FULL-001).

8. **BOOT-FREEZE [OPEN — systemic]** — `antcv-splitter-flip.js` + `antcv-sidebar-position.js`
   coalesced 1.50.818; the core `app.src.js` pagination storm is still the highest systemic perf issue.

## Coordinator tunables + values
See bottom of `SESSION_LOG_2026-06-25.md`. Key: `PAGE1_BAND=200`, `MAIN_PDF_LINE_BONUS=150`,
`MAIN_PAGE_N_BAND=105`, `SIDEBAR_PREVIEW_INFLATE=1.16`, `FORCE_LAST_GRP_FRAC=0.35`.

## Closed (all shipped, carry-forward context)
- P1 Targeting persistence: `[SHIPPED 1.50.728-732, 752, 819]`
- P2 Results tense: `[SHIPPED 1.50.748, 754]`
- P3 Salmon force-break + N-page + flush: `[SHIPPED 1.50.749/751/753]`
- P4 CL render cluster (#10/#11/#14): `[SHIPPED 1.50.747]`
- AI-NOTICE-MISSING-PREVIEW-001: `[SHIPPED 1.50.918]`
- HWIC-INTRO-DETECT-001 (marker jitter): `[SHIPPED 1.50.919]`
- CORE-COMP-FOCUS-TIGHTEN-001: `[SHIPPED 1.50.919]`
- SIDEBAR-STABLE-001 (tools whole on page 1): `[SHIPPED 1.50.913]`
- MAIN-PDF-LINE-001 / PAGE1-001 / PAGE-N-BAND-001: `[SHIPPED 1.50.910/915/916-917]`
- FIELD-CAPS (Focus ≤25, StratExpert ≤125, HWIC intro ≤125): `[SHIPPED 1.50.909]`
- RICH-BLOCK-GROUP-ALIGN-DEFAULT-001: `[SHIPPED 1.50.908 + worker 1.14.86]`
- FORCE-LAST-GRP cached-sticky: `[SHIPPED 1.50.906-907]`
