# Next session — AntCV (start here)

**Authoritative current state + closed/open lists: `docs/qa/SESSION_LOG_2026-07-01.md`.** Read it
first. PWA `1.51.29`, docx-worker `1.14.110` (unchanged this run), access-relay `1.3.2`, suite
551/551. Two independent sessions worked the same backlog concurrently 2026-07-01 and both landed
complementary fixes — see the session log for how the merge was reconciled.

**SYNC FIRST** (`git fetch origin && git pull --rebase origin main`) — the cloud routine + desktop
sessions both push to `main`. `app.js` is the minified mirror of `app.src.js` (surgical edits, must
start `(()=>{`, zero `"use strict"`, count-guarded replace via a node script when the file is too
large for the Read tool — see `CLAUDE.md` patch protocol). Cache-bust quintet on every loaded-file
change (file `?v` + the `window.ANTCV_VERSION` seed + `app.js?v` + `vo.src` in index.html + `sw.js`
CACHE + version-override TARGET_VERSION, add the PREVIOUS target to STALE_VERSIONS never the new
one). `node scripts/check-cache-bust.mjs --range HEAD` gates uncommitted changes.

> **Cloud env constraints (reconfirmed 2026-07-01):** `unpkg.com` (React/ReactDOM CDN) is blocked
> in the cloud sandbox (`CONNECT tunnel failed, response 403`), so `pwa/test/boot-smoke.mjs`
> CANNOT pass here for any change — this is environmental, not a regression signal. Verify app.js
> edits via `node --check`, the `(()=>{...}` / no-`"use strict"` invariant, and targeted `node:vm`
> unit tests that load the real source and exercise the changed logic. Full boot-smoke + any
> Playwright diag + worker deploys + signed-in live verification are owed to a desktop run.

## Open queue (priority order)

1. **Live regen-cycle verification of the 1.51.29 convergence fixes [OPEN — needs desktop/owner].**
   `docs/qa/SESSION_LOG_2026-07-01.md` fixed CV-CORECOMP-BLANK-001 / CL-BLANK-001 /
   CV-ACCESS-DROP-001 with TWO complementary layers each (a guard/repair layer from one session, a
   root-cause apply-path layer from another — see the session log). 22 new/updated `node:vm` unit
   tests, suite now 551/551, but NONE verified against a real LLM generation. Next step: run a
   generate → regenerate cycle (ideally 2nd generation on the same application, signed in) and
   confirm CORE COMPETENCIES / CL prose (especially closure/foundation) / Accessibility all survive.
2. **Deferred feature batch (owner list, still not started):** editable CL slogan section; 3-state
   What-I-Bring lead show/hide/monochrome toggle; sign-off pinned to page bottom (except a
   recruiter-Q&A last page); refresh the exportable DOCX + JSON templates to match current me();
   CV orphan tails (20-40 char) in bullets/sidebar lists/table cells; Strategic-Expertise cell
   overflow (worker table width); zoom 5% step + export-preview default 75%.
3. **SIDEBAR-PAGE23-DANCE-001 [OPEN, carried from 2026-06-25]** — regulatory (Environmental) +
   Languages still jump in/out of page 3 in the preview. File: `pwa/antcv-auto-pagebreak-block-001.js`.
   Needs Playwright + live verify — desktop only (see cloud env constraints above).
4. **TOOLS-GAP-JUMP-001 [OPEN, carried]** — TOOLS & METHODS stays whole on page 1, but the white gap
   underneath still flickers. Needs live browser.
5. **HWIC-EDITOR-JUMPINESS-001 [PARTIAL, carried]** — entering the HOW I WOULD CONTRIBUTE editor
   flips WHAT I BRING header text / resizes columns / hides the closure button. Marker-reset facet
   fixed 1.50.919; the rest needs reproduction with a working live preview tab.
6. **BOOT-FREEZE [OPEN — systemic, carried]** — `antcv-splitter-flip.js` + `antcv-sidebar-position.js`
   coalesced 1.50.818; the core `app.src.js` pagination storm is still the highest systemic perf
   issue. Needs profiling on a real browser, not diagnosable from static code review alone.
7. **Regen-gated content items (older backlog, still open, unchanged):**
   - #5 Certs trim to JD context — spec: `docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md`.
   - #6 Laser safety standard — kernel/data gap + prompt.
   - #8 Accessibility −30-40% length — target: "Hearing impaired: Cochlear implant user. Captions
     & written follow-up work well."
   - #12 CL Strategic-Expertise cells — terser cells (less detail, not shorter).
   - UNSOLICITED gen quality (CV-UNSOLICITED-ALL-ROLES-001, CV-MERGE-TITLE-ORDER-001,
     CV-MERGE-BULLET-RESULT-UNION-001, CV-UNSOLICITED-PUBS-FULL-001).

## Closed 2026-07-01 (this session — see SESSION_LOG_2026-07-01.md for full detail)

- CV-CORECOMP-BLANK-001 (#2): `[FIXED 1.51.29]` `antcv-corecomp-loss-guard.js` snapshot/restore + apply-path `e.rows` fallback.
- CL-BLANK-001 (#4): `[FIXED 1.51.29]` `proseOf` body-only fix + foundation/closure/opening switched to `__clReal()`.
- CV-ACCESS-DROP-001 (#7): `[FIXED 1.51.29]` `repairAccessibilityFromPI` section-creation + personalInfo GET-replace → local-preferring merge.

## Closed (earlier batches, carry-forward context)

- #1 role-result dup, #5 WHY horizontal rule, #3 lost-2-positions, #6 signature (resolved, no code):
  `[FIXED 1.51.26-27]` — see `docs/qa/EXPORT_REVIEW_2026-07_ISSUE_MAP.md` RE-REVIEW section.
- P1 Targeting persistence, P2 Results tense, P3 Salmon force-break, P4 CL render cluster (the
  historical NVIDIA batch): `[SHIPPED 1.50.7xx-8xx]` — see `docs/qa/CLOUD_ROUTINE_PROMPT.md`
  "NVIDIA BATCH STATUS" (historical) section. All non-regen items shipped; regen-gated items above
  still need an owner signed-in generation to verify in output.
- SIDEBAR-STABLE-001, FIELD-CAPS, RICH-BLOCK-GROUP-ALIGN-DEFAULT-001, FORCE-LAST-GRP,
  AI-NOTICE-MISSING-PREVIEW-001, HWIC-INTRO-DETECT-001, CORE-COMP-FOCUS-TIGHTEN-001:
  `[SHIPPED 1.50.9xx]` — see prior `SESSION_LOG_2026-06-25.md`.

## Coordinator tunables + values (pagination, unchanged this session)

See `SESSION_LOG_2026-06-25.md` bottom. Key: `PAGE1_BAND=200`, `MAIN_PDF_LINE_BONUS=150`,
`MAIN_PAGE_N_BAND=105`, `SIDEBAR_PREVIEW_INFLATE=1.16`, `FORCE_LAST_GRP_FRAC=0.35`.
