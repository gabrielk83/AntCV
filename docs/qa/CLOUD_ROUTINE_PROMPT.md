# AntCV — Cloud Routine Prompt (repo-only, no local memory)

Paste this into a **claude.ai Routine** (or point the routine at this file). It runs on Anthropic's
cloud against the GitHub repo **gabrielk83/AntCV**, so it has NO access to the local Claude Code
auto-memory (`~/.claude/…/memory`) — every fact it needs is inlined below or lives in the repo.
Owner: Gabriel. Style: direct, factual, compressed, no corporate filler.

---

You are an autonomous AntCV maintenance run on the GitHub repo **gabrielk83/AntCV** (a React PWA in
`pwa/` + Cloudflare Workers in `workers/`). Current shipped: PWA **1.50.833** (auto-deploys on push
to `main`), docx-worker **1.14.80**, proxy/demo-proxy **3.6.0**. Work the prioritised backlog below,
ship VERIFIED fixes only. Hard rule: **an end result, not a brickable mid-product** — one solid
verified fix beats several half-verified ones.

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

## STEP 0 — Orient (read in the repo)
1. `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` — the live register. Read the section
   **"OWNER BATCH — NVIDIA CV/CL exports + preview (2026-06-21, 14 items)"** and the
   **"Owner corrections (2026-06-21) — AUTHORITATIVE"** block under it: that is this run's backlog,
   per item with root cause + fix location + gating.
2. `docs/qa/NEXT_SESSION_PROMPT_2026-06-22.md` — the same backlog as a priority-ordered plan.
3. `CLAUDE.md` — repo conventions + the app.js gate.

## INLINED ESSENTIAL FACTS (these normally live in the local memory)
- **app.js is GATED.** Edit `pwa/app.src.js` (the human source) then MIRROR the change into the
  minified `pwa/app.js`. **Names DIFFER** between the two — anchor mirror edits on STRING LITERALS,
  print the surrounding minified context, copy it verbatim, and guard each mirror edit with an exact
  occurrence count. After any app.js edit: `node --check pwa/app.js`, assert it still
  `startsWith("(()=>{")` and contains NO `"use strict"`, and run `node pwa/test/boot-smoke.mjs`
  (must print `glDemo=function, errors=0`). NEVER run `npm run build:app` (known-unsafe; it adds
  "use strict" and blue-screens the app). A short minified name can shadow a different local in a
  nested scope — verify the binding in-scope or inline the logic.
- **Cache-bust QUARTET** on every CHANGED loaded file (anything referenced with `?v=` in
  `pwa/index.html`): bump that file's `?v=` in `index.html` + `pwa/sw.js` `CACHE` constant +
  `pwa/antcv-version-override.js` `TARGET_VERSION` (and ADD the PREVIOUS target to `STALE_VERSIONS`,
  NEVER the new one). `antcv-version-override.js` changes every release, so its OWN `?v=` must bump
  every release too. A pre-push hook runs `node scripts/check-cache-bust.mjs --range <upstream>..HEAD`
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

## PRIORITY ORDER

### **NVIDIA BATCH STATUS (14 items) — as of 1.50.833**

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
