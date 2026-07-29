# AntCV — Cloud Routine Prompt (repo-only, no local memory)

Paste this into a **claude.ai Routine** (or point the routine at this file). It runs on Anthropic's
cloud against the GitHub repo **gabrielk83/AntCV**, so it has NO access to the local Claude Code
auto-memory (`~/.claude/…/memory`) — every fact it needs is inlined below or lives in the repo.
Owner: Gabriel. Style: direct, factual, compressed, no corporate filler.

---

You are an autonomous AntCV maintenance run on the GitHub repo **gabrielk83/AntCV** (a React PWA in
`pwa/` + Cloudflare Workers in `workers/`). Ship VERIFIED fixes only. Hard rule: **an end result,
not a brickable mid-product** — one solid verified fix beats several half-verified ones.

## AUTHORITATIVE PLAN (read first — SUPERSEDES the historical backlog lower in this file)
Work the SAME live plan the desktop nightly works, not the dated NVIDIA/1.50.x lists below (those
are HISTORICAL context, mostly shipped):
1. The newest dated `docs/qa/NIGHTLY_*_PROMPT.md` (its PRIORITY BANDS are the standing plan; if none
   newer than 2026-07-05 exists, use `docs/qa/NIGHTLY_2026-07-05_PROMPT.md`).
2. `docs/qa/OPEN_REGISTER.md` — the single source of open work; a run is "full coverage" when every
   open row is advanced or given a verify-result. Work Band A first; drop to the next only when blocked.
3. `docs/qa/SCHEDULED_ROUTINES.md` — the standing rules (SYNC FIRST, shift-claim + worktree for any
   versioned change, END-OF-RUN REGISTER REPORTING). STANDING RULE 0's heartbeat is a LOCAL-desktop
   mechanism — it does NOT apply in cloud; here "did it run + what happened" is answered by the
   claude.ai routine's own run history plus your end-of-run report commit (see REPORT).

## WHY CLOUD IS THE RIGHT SUBSTRATE FOR THE NIGHTLIES (2026-07-21)
The local desktop nightlies kept missing days: they only run while the Claude app is open (03:30 was
almost never open → always deferred), and a deferred catch-up run collided with the owner's live work
in the shared clone (dirty tree → its rebase aborts). A cloud run has NEITHER problem — it fires on
Anthropic's cron regardless of the owner's machine, in a FRESH ISOLATED clone with no shared WIP to
collide with. Remaining cloud trade-offs are the CLOUD CAVEATS below (no local memory — this prompt
inlines the facts; worker deploy + signed-in live-verify may be unavailable → flag them owed to a
desktop run). SYNC FIRST still matters: the desktop also pushes to `main`, so always rebase, never force.

> **VERSION NOTE (the numbers below are stale — check live before quoting).** As of 2026-07-10 PWA
> is ~**1.51.259**, workers redeployed several times. Do NOT trust the "1.51.29 / 3.6.0" figures in
> the next paragraph; read `pwa/sw.js` CACHE + `git log` for the real current versions. For the most
> recent job-tracker + shared-engine work (coherence-repair fix, KV-quota masking fix, brand-on-Open,
> TARGET FACTS, web COMPANY RESEARCH, signal-image OCR), read `docs/qa/JOBTRACKER_SESSION_2026-07-10.md`
> and `docs/qa/ACTIVE_BUGS.md` (top block).
>
> **SHIFT PROTOCOL — claim a version range before you work (2026-07-10).** Multiple sessions push to
> `origin/main` and have collided on version numbers + shared-working-tree WIP (e.g. a merge that regressed
> the cache-bust quintet below the deployed version). Before editing: (1) `git fetch origin && git pull
> --rebase origin main`; (2) `node scripts/shift.mjs claim --task "<what>"` — reserves a version-number range
> in `docs/qa/NIGHT_SHIFT.md` (computed from the true high-water mark, robust to a regressed TARGET) and prints
> a `git worktree add` line; (3) work in that worktree, not the shared clone; (4) use only numbers inside your
> range; (5) `node scripts/shift.mjs release` when done. `status` lists active claims. Full detail: `docs/qa/NIGHT_SHIFT.md`.
>
> **CLOUD SYNC MODEL CHANGED (2026-07-10, PARALLEL-GEN-POINTER-002).** The account active pointer is no
> longer a single `active_application` row — there is now a **per-device** `active_application_device`
> table so parallel generations across tabs/browsers/devices never clobber each other. Any relay code that
> touches the active pointer MUST go through `readActivePointer`/`writeActivePointer` (both tables) and pass
> `?device_id=` on prefs/active GETs — never re-add a raw `INSERT INTO active_application … ON CONFLICT
> (user_hash)`. The docx-worker also gained RTL (he/ar) + CJK (zh) + Ethiopic (am) export. Full detail:
> `docs/qa/SESSION_2026-07-10_PARALLEL_GEN_AND_LANG.md`.

Historical: at authoring time PWA **1.51.29** (auto-deploys on push to `main`), docx-worker
**1.14.110**, access-relay **1.3.2**, proxy/demo-proxy **3.6.0**.

## ENVIRONMENT SETUP SCRIPT (claude.ai routine config — NOT the prompt)
Leave the routine's environment **setup script EMPTY** (or at most `node --version`). It must be
**pure shell**. Do NOT put `/login`, `/remote-control`, or any `/slash` command in it — those are
interactive Claude Code CLI commands, not shell, and the cloud sandbox runs the setup script with
`sh`, so a `/login` line fails with `exit code 127: /login: No such file or directory` and the whole
session aborts (observed 2026-06-21). The cloud session is already authenticated under the owner's
account — no login step is needed. AntCV needs no install for the core work (zero-dependency
`node --test`; git push is all that's required) — only add `npm install` if a run actually complains.

## CLOUD CAVEATS (read first)
- **No local auto-memory** — rely on this prompt + the repo docs. Do NOT reference any `C:\Users\…`
  path; everything is repo-relative.
- You can edit + commit + push to `main` (PWA auto-deploys). **Worker deploys** (`deploy.yml`) and
  **live signed-in verification on antcv.pages.dev** may NOT be available in cloud — if you can't run
  `gh`/`wrangler` or a headless browser, make the code change + add/keep tests green + push, and
  clearly flag in your report that the worker deploy / live verify is owed to a desktop run.
- If a fix can only be verified live/headless and you can't do that here, leave it as a clearly
  labelled WIP commit + report it — never claim unverified success.
- **POST-DEPLOY LIVE VERIFY is a DESKTOP capability (owner 2026-07-10).** Desktop Claude Code runs
  have an in-app Browser pane that verifies the live `antcv.pages.dev` deploy (procedure:
  `docs/qa/LIVE_VERIFY_BROWSER_PANE.md`). The cloud routine does NOT have it — for every PWA change
  you ship, add a line to your report: **"post-deploy live-verify owed to a desktop run"** (deployed
  version live? changed `?v` fetched fresh? code marker in the built bundle?). The next desktop run
  clears the owed verify. This exists because a concurrent merge once reverted a changed sidecar's
  `?v` below the shipped value — tests were green but the fix never reached browsers (stale-`?v`
  phantom ship).

## STEP 0 — Orient (read in the repo)
1. `docs/qa/EXPORT_REVIEW_2026-07_ISSUE_MAP.md` — the authoritative export-review register. The
   `## RESOLUTION` block lists what's already FIXED (A1/B1/B2/C1–C8). The **CURRENT BACKLOG** below
   (in this file) is what remains after the owner's 2026-07-01 re-review.
2. `docs/qa/NEXT_SESSION_2026-07-01.md` — the generic CL/CV template plan + deferred features.
3. `CLAUDE.md` — repo conventions + the app.js gate.
4. `docs/qa/OPEN_REGISTER.md` + `docs/qa/NIGHTLY_BACKLOG_RECONCILE.md` — the STANDING
   backlog-reconcile slot (owner 2026-07-03): every run verifies/refreshes the 3-5 stalest
   register rows in addition to its dated tasks. Older open items must never age out.

## INLINED ESSENTIAL FACTS (these normally live in the local memory)
- **app.js is GATED.** Edit `pwa/app.src.js` (the human source) then MIRROR the change into the
  minified `pwa/app.js`. **Names DIFFER** between the two — anchor mirror edits on STRING LITERALS,
  print the surrounding minified context, copy it verbatim, and guard each mirror edit with an exact
  occurrence count. After any app.js edit: `node --check pwa/app.js`, assert it still
  `startsWith("(()=>{")` and contains NO `"use strict"`, and run `node pwa/test/boot-smoke.mjs`
  (must print `glDemo=function, errors=0`). NEVER run `npm run build:app` (known-unsafe; it adds
  "use strict" and blue-screens the app). A short minified name can shadow a different local in a
  nested scope — verify the binding in-scope or inline the logic.
- **Cache-bust QUINTET** on every CHANGED loaded file (anything referenced with `?v=` in
  `pwa/index.html`): bump that file's `?v=` in `index.html` + `pwa/sw.js` `CACHE` constant +
  `pwa/antcv-version-override.js` `TARGET_VERSION` (and ADD the PREVIOUS target to `STALE_VERSIONS`,
  NEVER the new one) + the `window.ANTCV_VERSION = '1.51.x'` seed in `index.html` (the deferred
  module ~line 326 — the login gate reads it BEFORE version-override pins TARGET; a stale seed
  flashes the wrong version on boot). `antcv-version-override.js` changes every release, so its OWN
  `?v=` must bump every release too. A pre-push hook runs `node scripts/check-cache-bust.mjs --range <upstream>..HEAD`
  and BLOCKS the push if a changed loaded asset's `?v` didn't advance — so complete the quartet.
  `pwa/app.src.js` is the source, never loaded, has no `?v` — it is correctly excluded.
- **Salmon / pagination (the #2 fix) is the MOST blue-screen-prone area.** The measurer is the
  sidecar `pwa/antcv-auto-pagebreak-block-001.js` (NOT app.src.js). It writes two maps:
  `antcv:autoPagesPreview` (preview, line ~1053px) and `antcv:autoPages` (export/DOCX, ~924px).
  `__antcvSalmon` / the `▼ PAGE n ▼` bar is PERMANENT — never remove or gate it, only tune.
  For #2: the PREVIEW over-fills page 1 (puts more items than a real page) and shows NO sidebar
  break; the PDF correctly continues the sidebar to page 2. So you must FORCE an earlier preview
  sidebar break (1.50.745's "only-adjust" does nothing because there's no existing break to move).
  TWO HARD RULES: (1) PREVIEW MAP ONLY — never write a sidebar break into the EXPORT `autoPages`
  map; the worker paginates the sidebar itself and a forwarded sidebar break SCRAMBLES the PDF +
  the DOCX needs its own break. (2) The 1st force attempt OSCILLATED — the break flipped between
  sidebar sections each measure cycle. Tame it (stronger sticky/HOLD on the forced break, or break
  only the overfilling column). Knob: `SIDEBAR_PREVIEW_INFLATE` (console-tunable via
  `AntcvAutoPagebreak.config({SIDEBAR_PREVIEW_INFLATE:N})`). Verify with
  `pwa/test/diag-sidebar-preview-break.mjs` (Playwright; extend it to the sidebar-overfills-but-
  fits-the-1123px-page-box case) — assert the export map is UNCHANGED and the break is STABLE across
  cycles. If you can't run Playwright in cloud, do NOT ship #2 — leave a WIP + report.
- **Targeting persistence (P1).** A JD-targeted generation (e.g. NVIDIA) kept reverting to the
  "Unsolicited" kernel and `antcv:lastJdText` was EMPTY, which gates several owner items. The
  persistence chain is in `pwa/app.src.js` (CLAMP-GUARD ~19643, META-DRIFT-GUARD ~19596,
  CATEGORIZE-ON-ATTACH ~14340, AUTO-COMMIT ~15914). The fix must (a) categorize a real-company JD
  app as `targeted` not `unsolicited`, and (b) PERSIST the JD text with the active application so
  `antcv:lastJdText`≥30 — then `pwa/antcv-why-context-title.js` flips the CL heading to
  "WHY THIS POSITION" and the unsolicited framing stops.
- **#1 tense root cause.** `pwa/antcv-docx-client.js` `_expTenseMode()` (~line 1956) returns
  `'auto'` unless `styleConfig.expTense==='present'`, and `_tenseLead` (~1935) is a NO-OP in
  `'auto'`. The base↔past verb map (`_T_B2P` ~1925) is complete. So Results stay past because the
  tense setting isn't 'present' (the Languages-card tense control not sticking) — NOT a verb gap. Do
  NOT hard-force Results→present blindly (TENSE-FULL-CLAUSE keeps role + result the SAME tense).
- **export sanitize lives in `pwa/antcv-docx-client.js` `sanitizeForExport()`** — the export builds
  from React state, so content cleaning (strip fabricated tools, hide irrelevant roles, merge
  same-company roles) is applied there at document-build time. The editable preview can't show
  index-path-based merges/hides; text-only transforms (tense) go via `window.AntcvTenseClause`.
- **docx-worker `workers/docx-worker/src/index.js` is a HAND-INLINED bundle** that drifts from
  `src/*.js` — if you edit a worker helper, edit the inlined copy in `index.js` too or the deploy
  ships stale code.
- **Gabriel ground-truth (do not fabricate):** languages = English + Hebrew NATIVE/fluent, Spanish
  professional (for this job DROP the "Uruguayan variant" qualifier; keep EN/HE native), Danish B1,
  NO German. Kanzen Konsulenter ApS (no "i nord", end 2026). Broad PdM/BA identity, not narrow
  electro-optics. Hearing-impaired but not career-limiting. Patent only in publications.
- **Commit messages:** PowerShell mangles `-m` with quotes — write the message to a file and
  `git commit -F <file>` (or a bash heredoc). End with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## PRIORITY ORDER — HISTORICAL (context only; work the AUTHORITATIVE PLAN at the top instead)

> Everything below is a 2026-07-01→07-10 snapshot, almost entirely SHIPPED. Do NOT treat it as the
> live queue — it is kept for code-pointer context (app.js gates, salmon, targeting persistence).
> The live queue is `docs/qa/OPEN_REGISTER.md` + the newest `NIGHTLY_*_PROMPT.md` bands.

### **CURRENT BACKLOG (owner re-review 2026-07-01) — FIXED 1.51.29, regen-cycle verify owed**

Two independent runs worked this backlog concurrently (see `CLAUDE.md` "Sync discipline") and
landed complementary, non-overlapping fixes for every item — both kept. Full detail + code
pointers: `docs/qa/EXPORT_REVIEW_2026-07_ISSUE_MAP.md` RE-REVIEW section;
session narrative: `docs/qa/SESSION_LOG_2026-07-01.md`.

The owner's central frustration is **convergence / restore reliability**: a single generation
intermittently leaves a section blank, so the owner has to **regenerate 2–3 times** to get a
complete CV+CL. Owner's words: *"the way you push from memory is nok."* Summary (two layers each):

- **CV-CORECOMP-BLANK-001 (#2) — FIXED.** *Guard:* new sidecar `antcv-corecomp-loss-guard.js`
  (snapshot/restore keyed per application, mirrors `antcv-cl-prose-loss-guard-985.js`). *Root
  cause:* `core_comp_rows` apply (app.src.js ~25076) had no fallback to the section's own existing
  (`e.rows`) real rows, unlike profile/work_style — fixed, mirrored to `app.js`.
- **CL-BLANK-001 (#4) — FIXED.** *Guard:* `antcv-cl-prose-loss-guard-985.js`'s `proseOf` now reads
  the body (`it.t`) only — an empty-body-but-labelled rich_block no longer masquerades as real and
  defeats restore. *Root cause:* `foundation`/`closure`/`opening` used the narrower `a()`
  placeholder-stripper instead of the `__clReal()` helper `who`/`why`/`contribute` already use; the
  Nordic CLOSURE placeholder's nested brackets + lack of an em-dash defeated `a()`, leaking the raw
  template into the saved section (which the export then blanks). Switched all four to
  `__clReal()`.
- **CV-ACCESS-DROP-001 (#7) — FIXED.** *Section layer:* `repairAccessibilityFromPI` (415) no
  longer dead-ends on `idx<0` — it now CREATES the ACCESSIBILITY section from
  `personalInfo.accessibility` when the section is absent (gen-2 routed it into ADDITIONAL
  instead). *Source-of-truth layer:* `antcv-generate-cloud-sync-277.js`'s GET-after-PUT step did a
  wholesale `personalInfo` REPLACE from the cloud response; if the PUT half silently failed, the
  GET clobbered `personalInfo.accessibility` itself with a stale cloud copy. Changed to a
  local-preferring merge.

**NOT verified live** (owed to a desktop/signed-in run): a real owner generate→gate→worker→sync
cycle, ideally a 2nd generation on the same application, confirming CORE COMPETENCIES / CL prose /
Accessibility all survive. Neither run had a signed-in browser or could drive a real LLM
generation — verification was by static tracing + 22 new/updated vm-sandboxed unit tests, full
suite 551/551 green, not a live cycle.

**Deferred feature batch (owner list, after the convergence work):** editable CL slogan section;
3-state What-I-Bring lead show / hide / **monochrome** toggle; sign-off pinned to page bottom
(except a last page that is the recruiter-Q&A); refresh the exportable **DOCX + JSON templates** so
they match current me(); CV orphan tails (20–40 char) in bullets / sidebar lists / table cells;
Strategic-Expertise cell overflow (worker table width); zoom 5% step + export-preview default 75%.

---

### **NVIDIA BATCH STATUS (14 items) — as of 1.50.833 (HISTORICAL — all shipped/regen-gated)**

All non-regen items shipped. Regen-gated items need an owner signed-in generation to verify.

| # | Item | Status |
|---|---|---|
| 1 | Results tense (preview) | `[SHIPPED 1.50.748 + 1.50.754]` Copenhagen always present; first-paint refresh fixed. |
| 2 | Salmon sidebar break | `[SHIPPED 1.50.749/751/753]` FORCE break + N-page + flush salmon. |
| 3 | Undo for sidebar-width | `[OPEN — feature]` |
| 4 | Sidebar size fingerprint re-trigger | `[OPEN — feature]` |
| 5 | Certs: trim to JD context | `[OPEN — regen-gated]` JD-SPECIFIC-CV-COMPRESSION-SPEC committed. Needs prompt + regen. |
| 6 | Standards: add laser safety | `[OPEN — kernel/data gap + regen]` |
| 7 | Languages: drop Uruguayan variant | `[SHIPPED 1.50.746]` |
| 8 | Accessibility: trim 30-40% | `[OPEN — regen-gated]` Target: "Hearing impaired: Cochlear implant user. Captions & written follow-up work well." |
| 9 | Twin tables distinct | `[SHIPPED 1.50.806]` Needs owner regen to verify in output. |
| 10 | WHO I AM / WHY: dual heading | `[SHIPPED 1.50.747]` |
| 11 | Opening sentence case | `[SHIPPED 1.50.747 — auto-resolved]` |
| 12 | CL Strategic-Expertise cells too detailed | `[OPEN — regen-gated]` |
| 13 | WHY YOUR COMPANY wording | `[RENDER CORRECT — JD-SYNC-001 1.50.752 ships code; needs live verify]` |
| 14 | CL paragraph 3px spacing | `[SHIPPED 1.50.747]` |

### **P0–P4 ALL SHIPPED** — current backlog is P5 / open features / regen-gated

**P0 SALMON-EMPTY-REGION-001** `[SHIPPED 1.50.753]` Flush salmon: non-last page-box sizes to content.
**P1 Targeting persistence + JD-SYNC-001** `[SHIPPED 1.50.728-732, 752]` + UNSOLICITED-IDENTITY-SOURCE-FIX-001 `[SHIPPED 1.50.819]`. Live verify: load NVIDIA targeted app signed-in → confirm `antcv:lastJdText` populates within ~2s + WHY heading flips to "WHY THIS POSITION". Needs signed-in browser (not verifiable in cloud).
**P2 Results tense** `[SHIPPED 1.50.748 + 1.50.754]` Copenhagen Modern/Scandinavian always present; first-paint refresh.
**P3 Salmon force-break** `[SHIPPED 1.50.749/751/753]` Force break + N-page + flush salmon.
**P4 CL render cluster** `[SHIPPED 1.50.747]` Inline label hidden; sentence case auto-resolved; 3px spacing.

### **Current open / regen-gated items (P5)**
- **#5 Certs trim to JD context** (regen-gated) — spec: `docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md`.
- **#6 Laser safety standard** (kernel/data gap + regen).
- **#8 Accessibility −30-40%** (regen-gated) — target: "Hearing impaired: Cochlear implant user. Captions & written follow-up work well."
- **#12 CL Strategic-Expertise cells** (regen-gated) — terser cells.
- **JD-SYNC-001 live verify** — needs signed-in browser; code in place (1.50.752).
- **#3/#4** — undo stack for sidebar-width / fingerprint re-trigger (features, not bugs).
- **UNSOLICITED gen quality** — 4 CV-regen items: all-roles on:true in unsolicited, merge title order, bullet+result union, Publications full (CV-UNSOLICITED-ALL-ROLES-001, CV-MERGE-TITLE-ORDER-001, CV-MERGE-BULLET-RESULT-UNION-001, CV-UNSOLICITED-PUBS-FULL-001). Regen-gated.
- **BOOT-FREEZE** (`antcv-splitter-flip.js` + `antcv-sidebar-position.js` coalesced 1.50.818; core app.src.js pagination storm still open — highest systemic perf issue).
- **REVIEW-DATA-DEAD-001** — "Review my data" button dead; sidecar `antcv-data-export-360.js` listener lost on DOM rebuild.
- **SETTINGS-WRITINGSTYLE-STICKY-001** — WritingStylePicker island bleeds across settings subtabs.
- **AI-notice position** — owner decision needed: page-edge (`page`, current) vs bottom-margin (`margin`); then fix worker or test.

## DISCIPLINE
- **SYNC FIRST (anti-regression, owner requirement):** before any edit run `git fetch origin && git pull --rebase origin main`, and before pushing pull --rebase again. The DESKTOP clone also pushes to main — rebasing (never force-pushing/resetting) guarantees this cloud run does not regress the desktop's work and vice-versa. On a non-ff rejection, `pull --rebase` then push; NEVER `git push --force`/`reset --hard` on main.
- `node scripts/run-tests.mjs` all-green (362+) before every push; add a unit/diag test per fix.
- One change → mirror (if app.js) → boot-smoke → cache-bust quartet → tests → commit → push.
- One deployer at a time; never parallel `deploy.yml`. PWA auto-deploys on push; workers deploy via
  `gh workflow run deploy.yml -f target=<docx-worker|proxy|demo-proxy> -f mode=deploy -f confirm=<same>`
  then `gh run watch <id> --exit-status` (only if `gh` is available in this environment).

## REPORT
End with a written report: shipped (item + version), what you verified (and what you could NOT
verify in cloud — worker deploy / live render), what you skipped + why, and anything needing the
owner. Update `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` (mark items SHIPPED x.y.z).

**WHEN THE RUN ENDS — DOCUMENT THE OPEN + CLOSED LIST (owner requirement, 2026-06-25):** before
finishing, write/refresh a dated session log `docs/qa/SESSION_LOG_<YYYY-MM-DD>.md` with TWO explicit
sections — **CLOSED this run** (item + ID + version + how verified) and **OPEN (carry forward)**
(item + ID + the next concrete step + why-not-done, e.g. "needs a real export / live render this env
can't do"). Also refresh `docs/qa/NEXT_SESSION_PROMPT.md` so the next run/session starts from the
current open queue. Commit + push these docs with the code. A run is not "done" until the open/closed
state is written down — never leave the status only in chat.

**END-OF-RUN REGISTER REPORTING (owner 2026-07-13 — standing rule 5 in
`docs/qa/SCHEDULED_ROUTINES.md`, applies to this routine too):** in the same end-of-run commit,
(a) advance/refresh every `docs/qa/OPEN_REGISTER.md` row the run touched and ADD a row for any new
bug/task discovered; (b) log every code fix in `docs/qa/ACTIVE_BUGS.md` (top block); (c) register
any feature shipped or advanced in `docs/FEATURES_REGISTRY.md`. The session log above is the
narrative; these three registers are the canonical state — update BOTH.
