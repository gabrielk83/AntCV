# Next session — AntCV (start here)

**Authoritative current state + closed/open lists: `docs/qa/SESSION_LOG_2026-06-25.md`.** Read it first.
PWA `1.50.917`, docx-worker `1.14.86`, suite 472/472.

**SYNC FIRST** (`git fetch origin && git pull --rebase origin main`) — the cloud routine + parallel
worktrees push to `main`. `app.js` is the minified mirror of `app.src.js` (surgical edits, must start
`(()=>{`, count-guarded replace). Cache-bust quintet on every loaded-file change (file `?v` + the
`window.ANTCV_VERSION` seed + `vo.src` in index.html + `sw.js` CACHE + version-override TARGET, add
the previous to STALE).

> **Environment limits that bit last session:** no PDF renderer here, and the automated Chrome
> preview tab often renders 0–1 experience roles after reload — so live `antcv:autoPages` readouts and
> owner export screenshots are the only reliable verification. Calibrate against those, not a blind guess.

## Open queue (priority order)

1. **AI-NOTICE-MISSING-PREVIEW-001 [REGRESSION, do first]** — notice vanished from the preview in 917;
   likely the 914 `anchorToCorner` left-corner re-parent into `.antcv-document-sidebar` lands it
   hidden/off-screen. Fix the re-parent (keep it visible) or revert to positioning relative to the
   page-box with the sidebar's left coordinate.
2. **SIDEBAR-PAGE23-DANCE-001** — regulatory (Environmental) + Languages jump in/out of page 3; cache
   the sidebar page-2/3 boundary like page 1.
3. **TOOLS-GAP-JUMP-001** — tools is stable on page 1 but the white gap under it flickers.
4. **HWIC-EDITOR-JUMPINESS-001 [owner emphasised]** — entering the HOW I WOULD CONTRIBUTE panel makes
   the WHAT I BRING table flip its two header texts + resize, resets bullet markers each change, and
   removes the closure button. Reproduce with the editor open; look at `antcv-how-contribute-controls-245.js`
   + `antcv-what-i-bring-header-cjlr-249.js` fighting on focus.
5. **RESEARCH-ASSISTANT-PAGE3-VERIFY** — confirm `MAIN_PAGE_N_BAND=105` lands role 7 at page-3 top;
   owner tunes live and reports the value to commit.
6. **GROUP-HEADER-MANUAL-BREAK-001** — a manual P3 break on a group's first row must move the group
   header + rows below (group-aware snap for manual breaks, coordinator + worker).
7. **AI-NOTICE-DYNAMIC-001** — notice must follow the emptier column as content generates/edits;
   verify post hard-refresh, else re-run the anchor on `antcv:autoPages` change.

Coordinator tunables + values: see the bottom of `SESSION_LOG_2026-06-25.md`.
