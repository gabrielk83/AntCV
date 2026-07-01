# AntCV — Corrections session prompt (start 2026-07-02)

Paste this as the opening message. You continue AntCV (React PWA on Cloudflare Pages + Workers).

**SYNC FIRST:** `git fetch origin && git pull --rebase origin main`. Never force `main`. PWA auto-deploys
on push; workers deploy via `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`
then `gh run watch <id> --exit-status`. Read `CLAUDE.md` + the memory index first.

**State (do NOT regress — all shipped + verified 2026-07-01):** PWA **1.51.40**, docx-worker **1.14.114**,
suite **587/587**. The full CLOSED list is in `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-07-01.md` — read it so
you DON'T redo finished work. In particular these are DONE and must not be reverted: core_comp
snapshot/clean/dedup guard; CL-BLANK proseOf-body-only + sync-snapshot; accessibility create+labeled_list;
empty-role hide; HWIC "[object Object]" export fix; work_style repair+134-cap; CL closure rule-match
(wk 1.14.113, `diag-cl-rules.mjs`); signature wide-margin crop + thumbnail adapt; AI-notice Layout control
(wk 1.14.114, `diag-ai-notice-pos.mjs`); AI-notice preview luminance contrast; preview hyperlink styling
(colour-by-background, no blink). Blank-section "dancing" is FIXED (owner confirmed).

**Discipline:** edit `pwa/app.src.js` (source) then MIRROR into minified `pwa/app.js` (names DIFFER —
anchor on string literals, count-guarded; after: `node --check pwa/app.js`, startsWith "(()=>{", no
"use strict", `node pwa/test/boot-smoke.mjs`). Sidecars are plain files (no mirror). Cache-bust QUINTET on
every changed loaded asset (its `?v` in index.html + sw CACHE + version-override TARGET/STALE + ANTCV_VERSION
seed; never put the current version in STALE). `node scripts/run-tests.mjs` all-green before every push;
add a test per fix. Diagnose on the owner's LIVE signed-in app via Chrome MCP; verify worker changes with
the `workers/docx-worker/test/diag-*.mjs` harness (drives the real fetch handler, unzips document.xml).
A real LLM generation can't be reproduced headlessly — the owner regenerates to verify generation items.

## WORK THIS ORDER

### 1. GENERATION-OVERLAY-TIMING — the root of the blank content (HIGH)
The "purple-black" generation overlay closes BEFORE generation + JD analysis finish, so the owner sees
blank why/who/bring and exports a semi-empty CL/CV. Owner: "keep it on ≥4 more minutes — generation does
not end before the JD analysis is ready, most content is blank before that; the 1st-time generation seems
stuck on this stage." FIX: keep the overlay up until JD-analysis + lamination COMPLETE (app.js generation
flow — find the overlay-close trigger and gate it on the completeness signal / JD-analysis-ready, not on
the raw LLM return). The completeness check already exists (the "2 key sections need content" warning). This
is the upstream cause of the CL semi-empty (why/who/bring placeholders) AND the CL "only lower rule
visible". Verify with ONE real regen from the owner (can't reproduce headlessly). Do NOT hard-force a fixed
delay that blocks a fast valid generation — gate on the real completion signal.

### 1b. UNSOLICITED CORE COMPETENCIES too specific (regen-gated, tie to #1)
Owner (2026-07-01): the unsolicited CV's CORE COMPETENCIES came back too NARROW ("EO & photonic
sensors", "Imaging", "Materials & devices") — for an UNSOLICITED draft the competencies should be
the BROAD PdM/BA/process identity, not the electro-optics niche. The generation prompt already
distinguishes unsolicited (broad) vs JD-targeted — verify the unsolicited branch drives core_comp
from the broad identity, not the photonics cluster. Regen-gated.

### 2. ROLE-DEDUP + ORDERING (HIGH)
`pwa/antcv-sections-normalize-415.js` `dedupeRoles` merges only IDENTICAL titles + overlapping years. The
owner's EXPERIENCE has DUPLICATES from company-spelling variants:
- Computer Systems Administrator — "IDF, Communication Corps" vs "Israel Defense Forces, Communication Corps"
- Students Council Representative — "Tel Aviv University" vs "…- Electrical Engineering"
- Team Operations Manager — "(foreningsarbejde), Pan Idræt" vs "& Assistant Coach (Volunteer), Copenhagen Wolves RFC - Pan Idræt"
FIX: merge same-title / same-year-range roles whose COMPANY strings are spelling variants (normalise company:
expand common acronyms e.g. IDF↔Israel Defense Forces, strip trailing qualifiers after "-"/","), keeping the
RICHER bullet+result set. Then **VOLUNTARY roles sort LAST** — Students Council Representative + rugby
(foreningsarbejde / "Volunteer") go after the paid history — and within the voluntary block keep
reverse-chron: owner (2026-07-01) "Students Council should be AFTER Rugby operations (earlier volunteer
work, was placed before)". Rugby 2023-present precedes Students Council 2005-2007. Also: **3 empty roles
jump in/out** right after the PROFESSIONAL EXPERIENCE heading — the empty-slot-hide (EXPERIENCE-EMPTY-SLOT-HIDE-001, 1.51.32) is fighting
another injector during the sections-updated storm; make it idempotent + ensure nothing re-adds the hidden
slots (stable across passes). Diagnose on the owner's LIVE `localStorage.sections`. Node-test the dedup +
voluntary-last ordering.

### 3. COVER LETTER open issues (do AFTER 1+2)
Most CL blanks are downstream of the overlay timing. After 1 lands, on a REAL regen verify:
who/why/bring/contribute/closure ALL fill on ONE generation; both CL horizontal rules render + match on the
export (the code is correct — `diag-cl-rules.mjs`; the only-lower symptom is the placeholder `why`); the CL
signature renders intact; the recruiter-Q&A page renders when the JD has questions. Fix any residual CL
apply-path gaps (see the appjs-appsrc-contribute-divergence memory — grep the DEPLOYED app.js directly for CL
hydration; app.src.js-only edits there are phantom).

### 3b. Editable section HEADING value from the section-list panel (feature)
Owner (2026-07-01): a rich_block section's HEADING VALUE should be editable directly from the section
sidebar/preview panel (the list with the ON/OFF + move + ×/→ chips, e.g. "HOW I WOULD CONTRIBUTE" /
"Closure"). Today that panel toggles/moves/deletes but doesn't let you rename the heading inline. Add an
inline editable title (mirror the existing rich-block editor's title field) in that panel row.

### 4. Smaller / regen-gated / owner-input
- **AI-notice LEFT export — FIXED wk 1.14.116, owner-verify.** Root cause traced live: the DOCX had the
  correct `mso-position-horizontal:left`, but CloudConvert/LibreOffice IGNORES the left|center keyword
  (only `right` worked) and dropped the box at the anchor paragraph (main column). Now `aiNoticeVmlRun`
  uses an EXPLICIT page-relative `margin-left` offset (left=0pt, center, right=pageW-320). Owner
  re-exports to confirm the PDF finally honors LEFT. `diag-ai-notice-pos.mjs` asserts the offsets.
- **Focus-area label** — "Optics, photonics &" (truncated) → owner wants Focus Area **"EO & Photonic devices"**,
  Strategic Expertise **"Electro-optics (EO), photonics, semiconductor physics"**. LLM-generated (no source
  string) → fix in the generation prompt / Gabriel kernel seed (regen-gated). Owner already inline-edited live.
- **AI-notice AUTO** — still pushes RIGHT wrongly (crude last-page BLOCK-COUNT proxy in the worker
  `buildTwoColumnDocument`, ~24748). To fix correctly, get the owner's specific CV (`localStorage.sections` +
  which side auto chose vs which column is actually emptier on the last page) and reconcile block-count vs the
  preview-measured hint (`antcv:aiWmSide` from `antcv-watermark-page-anchor-341.js` chooseCorner). Manual
  L/C/R control is the reliable override meanwhile.
- **d1_write_failed** — server-side D1 write failure from access-relay `user_kernel`/prefs sync
  (`workers/access-relay/src/index.js` ~896 `env.DB…run()`), surfaced to the client (NOT in app.js as a literal;
  likely transient write contention during rapid saves). Add a client retry-with-backoff on the kernel/prefs PUT
  (mind the fetch-wrapper hazard) + confirm the root via D1/wrangler logs. Low urgency unless it blocks saves.

## GROUND TRUTH / GOTCHAS
- Gabriel: EN+HE native, ES professional, DA B1, no German; Kanzen Konsulenter ApS (end 2026); broad PdM/BA
  identity; hearing-impaired not career-limiting; unsolicited subtitle "Processes • Products • People".
- Export builds from React state via `pwa/antcv-docx-client.js` `sanitizeForExport`; the docx render is
  `workers/docx-worker/src/index.js` (hand-inlined bundle, no build step — edit the inlined copy).
- Never remove `__antcvSalmon` (page-split indicator). Don't speculatively edit the fetch-wrapper / export
  chain. One deployer at a time; never parallel deploy.yml.
- Commit messages via `git commit -F <file>` (PS mangles -m quotes); end with
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
