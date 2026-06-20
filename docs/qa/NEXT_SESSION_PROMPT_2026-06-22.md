# AntCV — Next Session Prompt (2026-06-22)

Self-contained boot prompt for a FRESH AntCV session (no memory of prior chats — everything is in
the repo). Repo root: `C:\Users\karpg\GitHub\AntCV` (React PWA + Cloudflare Workers, owner Gabriel).
Current shipped: **1.50.745** (PWA, auto-deploys on push) + docx-worker **1.14.79** + proxy/demo-proxy
**3.6.0** (manual deploy). Owner style: direct, factual, compressed, no corporate filler.

## STEP 0 — Orient (read first)
1. `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` — the live register. Read the **"OWNER BATCH —
   NVIDIA CV/CL exports + preview (2026-06-21, 14 items)"** section AND the **"Owner corrections
   (2026-06-21) — AUTHORITATIVE"** block under it. That is this session's backlog with per-item
   root-cause + fix location + gating. Also read the top NIGHTLY/UPDATE blocks (728→745).
2. `CLAUDE.md` — app.js is GATED/dangerous: edit `app.src.js` (source) then MIRROR into minified
   `app.js` (names DIFFER — anchor on string literals, copy minified blocks verbatim, guard each
   mirror edit with an exact occurrence count; assert app.js still startsWith "(()=>{" and no
   "use strict"). NEVER `npm run build:app`. Run `node pwa/test/boot-smoke.mjs` after ANY app.js/
   sidecar change. Cache-bust QUARTET on every changed loaded file (bump its `?v=` in index.html +
   `sw.js` CACHE + `antcv-version-override.js` TARGET_VERSION + add the PREVIOUS target to
   STALE_VERSIONS, never the new one). A pre-push hook now runs `scripts/check-cache-bust.mjs
   --range` and BLOCKS a push if a changed loaded asset's `?v` didn't advance — so finish the
   quartet or the push fails.
3. Memories (`C:\Users\karpg\.claude\projects\C--Users-karpg-GitHub-AntCV\memory\MEMORY.md` index),
   ESPECIALLY: `salmon-splitter-permanent` (the #2 fix lives here + the oscillation trap),
   `minified-mirror-shadow-hazard`, `headless-pwa-testing`, `stale-sw-version-mask-hazard`,
   `targeted-app-persistence`, `export-sanitize-and-preview-parity`, `gabriel-cv-facts`,
   `powershell-git-commit-quoting`, `deploy-model`.

## STEP 1 — Priority order (highest leverage first)

### P1 — Targeting persistence + PERSIST THE JD (the big unlock)
The NVIDIA app rendered as **"Unsolicited"** with `antcv:lastJdText` EMPTY, which gates several owner
items at once: #13 (the "WHY THIS POSITION" heading flip never fires), much of #9 (CL generates
unsolicited-style twin tables), and the wrong CL framing. Fix the root: when a JD-targeted app is
active, the company must categorize as `targeted` AND the JD text must be PERSISTED with the
application (so `antcv:lastJdText`≥30 and the cluster/why gates can read it). See the 728-732
persistence chain (AUTO-COMMIT-001 etc., `app.src.js:15914/19596/19643/14340`) + [[targeted-app-persistence]].
VERIFY: regenerate/attach the NVIDIA JD → chip reads NVIDIA (not Unsolicited), `antcv:lastJdText`
is non-empty, `antcv-why-context-title.js` flips the heading to "WHY THIS POSITION", CL stops
reading unsolicited.

### P2 — #1 Results past tense (CONFIRMED real on 745)
Root cause: `antcv-docx-client.js` `_expTenseMode()` (~:1956) returns `'auto'` unless
`styleConfig.expTense==='present'`, and `_tenseLead` is a NO-OP in `'auto'` (:1936). The verb map is
complete. The owner's BULLETS are already present but the Results stay past = mixed tense. Do NOT
hard-force Results→present blindly (TENSE-FULL-CLAUSE-001 keeps role+result the SAME tense).
**OWNER DECISION NEEDED FIRST (ask + wait):** "Results/bullets ALWAYS present for Copenhagen/Nordic,
or PER-ROLE (present for current, past for ended)?" Then either (a) make the Present control persist
+ be read (the LANGUAGES-card tense control), or (b) default Copenhagen `_expTenseMode` to 'present'.
Pure function → unit-testable on the owner's strings ("Owned…"→"Own…", "Directed…"→"Direct…").

### P3 — #2 Salmon: FORCE an earlier preview sidebar break (owner's top visual issue)
CORRECTED model (owner 2026-06-21): the preview does NOT "fit" — it puts MORE items on page 1 than a
real PDF page holds, so it OVER-fills page 1 and shows NO sidebar break (page-2 sidebar empty); the
PDF correctly continues the sidebar to page 2. 1.50.745's "only-adjust" does NOTHING here (no
existing break to move). FIX = in `antcv-auto-pagebreak-block-001.js` FORCE a preview sidebar break
at the real-page-equivalent (tightened) line even when the sidebar fits the 1123px page-box, so
Languages→page 2 matches the PDF. The hard part is the OSCILLATION attempt-1 hit (break flipped
between sidebar sections) — solve via stronger sticky/HOLD on the forced break, or break only the
overfilling column. PREVIEW MAP ONLY; the export/DOCX sidebar break must stay (owner: removing it
breaks the DOCX). THE MOST blue-screen-prone area — boot-smoke + the committed diag
`pwa/test/diag-sidebar-preview-break.mjs` (extend it to the sidebar-OVERFILLS-but-fits-page-box
case); verify export map unchanged + stable across cycles before shipping. `SIDEBAR_PREVIEW_INFLATE`
is the tuning knob (console: `AntcvAutoPagebreak.config({SIDEBAR_PREVIEW_INFLATE:N})`).
Also #4: confirm the measurer fingerprint re-triggers a FULL re-measure on sidebar-width + content
changes. #3 (undo for sidebar width) is a separate feature.

### P4 — CL render cluster (#10 / #11 / #14) — app.js render, do together
- #10: the CL section shows BOTH the H2 heading AND the text_inline colored label (duplicate).
  `antcv-why-context-title.js` strips an in-CONTENT label but this duplicate is the H2 + the
  text_inline render's own title-derived label. Fix the text_inline render (app.src.js) to emit ONE,
  not both.
- #11: the inline label should be sentence case — "Who I am:" not "WHO I AM:" (resolves with #10 if
  the inline label is removed and only the H2 stays, OR lowercase the inline label).
- #14: the CL WHAT-I-BRING table needs ~3px more spacing before the following paragraph
  (table marginBottom or paragraph marginTop +3px), preview + worker parity.

### P5 — #7 deterministic + regen-gated content
- #7 (deterministic): drop the "Uruguayan variant" qualifier from the Spanish language line; KEEP
  English + Hebrew as native/fluent (never touch them). Small content normalizer/strip + unit test.
- REGEN-GATED (need an owner regen to verify): #5 trim certs to JD context (rugby-coach cert out),
  #6 add laser-safety standard (kernel/data gap + prompt), #8 accessibility −30-40% (terser rewrite),
  #12 CL Strategic-Expertise cells too DETAILED (not too long) → prompt for terser cells, #9 twin
  tables distinct seeds (after P1).

## STEP 2 — Discipline
- **SYNC FIRST (anti-regression):** before any edit run `git fetch origin && git pull --rebase origin main` — a claude.ai cloud/mobile Routine also pushes to main, so rebase onto it so your work never regresses it. NEVER force-push/reset main; on a non-ff rejection, `pull --rebase` then push. The `scripts/git-hooks/pre-push` hook enforces this (blocks a push when local main is behind origin). See CLAUDE.md "Sync discipline".
- One deployer at a time; never parallel deploy.yml. PWA auto-deploys on push to main; workers
  (`docx-worker`/`proxy`/`demo-proxy`) deploy via `gh workflow run deploy.yml -f target=<w> -f
  mode=deploy -f confirm=<w>` then `gh run watch <id> --exit-status`.
- `node scripts/run-tests.mjs` all-green (348+) before every push. Add a unit/diag test per fix.
- Verify PAST the sign-in gate headlessly (boot-smoke passes on the sign-in screen — not enough);
  use the `headless-pwa-testing` recipe. Don't ship a change you can't verify green — revert or WIP.
- Mobile tracking: push at session start (items picked), each ship, any owner-decision (then WAIT
  for a one-line reply — e.g. the P2 tense question), and completion.

## STEP 3 — Report
Final push + written report: shipped (ID + version), verified how, parallelised vs serial, skipped +
why, anything needing the owner. Update the register + memories with durable lessons.
