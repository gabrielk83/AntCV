# AntCV nightly — 2026-07-05 (structured full-coverage plan; local antcv-nightly + cloud Routine; MULTI-MODEL)

Autonomous maintenance on `C:\Users\karpg\GitHub\AntCV` (cloud Routine: the repo clone).
Owner: Gabriel. Style: direct, compressed, no filler. Shipped at dispatch: PWA **1.51.131** ·
docx-worker **wk 1.14.132** · access-relay **1.3.3/auth-26** · proxy **3.7.1** · suite **937/937**.
Owner directive 2026-07-04: **"treat mobile and tab isolation as high priority … make sure the plan
for nightly is structured and full coverage is planned."** This prompt IS that structure.

## HOW TO WORK THIS (read once)

- **Full coverage = the register.** `docs/qa/OPEN_REGISTER.md` is the single source of open work
  (rows 1-45 + the TO-DO summary). Every band below maps to register rows. A nightly is "full
  coverage" when it either advances a row or records a verify result for it — nothing is skipped
  silently. Report per-row at the end.
- **Bands are PRIORITY, not a to-do-all list.** Work Band A first, top-down; only drop to the next
  band when Band A is blocked (owner-decision / needs-real-device / needs-live-models). One SOLID
  verified fix beats five half-fixes — owner hard rule "an end result, not a brickable mid product."
- **MULTI-MODEL dispatch (owner "allow other models to run tasks"):** each task is self-contained.
  Parallel sessions use SEPARATE git worktrees (single-line app.js edits conflict — re-apply on the
  latest base). Cheapest capable model takes mechanical tasks (verify sweeps, harness runs, doc
  reconcile); app.js/app.src.js mirror splices + worker changes go to the STRONGEST model. A task a
  model can't finish safely is REPORTED half-done, never half-pushed.

## HARD RULES (violating any = failed run)

1. **SYNC FIRST**: `git fetch origin && git pull --rebase origin main` before any edit. NEVER force-push.
2. **Verify-first / diagnostic-first**: every row gets a repro/probe/test BEFORE a fix. Registry rows
   are often already shipped or mis-stated (e.g. GEN-MODELROLE was "not started" but is code-shipped
   fail-soft). Confirm current state, then act.
3. **app.js is minified-sacred**: surgical in-place edits mirrored to app.src.js (names DIFFER — anchor
   on string literals, occurrence-count guard, assert app.js still `startsWith("(()=>{")`, no
   `"use strict"`). Author JS-literal patches with Write/node scripts, NEVER bash/python heredocs.
   Parse-gate with `new vm.Script` (or `node --check` for the ESM docx-client). **NEVER `npm run
   build:app` — esbuild blue-screened prod (CLAUDE.md). "Rebuild" in the owner's backlog means an
   app.js CHANGE via mirroring, not a bundle rebuild.**
4. **Cache-bust quintet** on every pwa asset change: index.html `?v=` (incl. version-override's OWN
   `?v` line + docx-client's module import when touched) + sw.js CACHE + TARGET_VERSION +
   STALE_VERSIONS (append PREVIOUS, never current) + ANTCV_VERSION seed.
5. **Suite green** via `node scripts/run-tests.mjs pwa` (NEVER raw `node --test` — it hangs) +
   `node pwa/test/boot-smoke.mjs` when app.js changed + a render-past-sign-in headless check after an
   app.js integration. Workers deploy via `gh workflow run deploy.yml -f target=<w> -f mode=deploy
   -f confirm=<w>`, ONE deployer at a time, `gh run watch --exit-status`.
6. Flagship gen model stays **claude-opus-4-7** unless the owner approves a change (propose with D1
   evidence). Content fixes measured on FRESH generations (spec rule 38), not hand-guided exports.
7. Register every fix in `docs/qa/ACTIVE_BUGS.md` + advance the `OPEN_REGISTER.md` row.

---

## BAND A — MOBILE & TAB ISOLATION (owner P0, do first)

**A1 — GEN-BACKGROUND-001-CLIENT (register row 38), the single most important item.**
Server is done (`gen-job.js` + `/job/*` dispatch on main in both proxy bundles). The PWA still runs
the old streaming loop → a backgrounded mobile tab breaks generation. Steps, in order:
  1. VERIFY the /job/* dispatch is LIVE (curl the deployed proxy `/job/…`; on-main ≠ live — if not
     deployed, that's a `gh workflow run deploy.yml -f target=proxy` first).
  2. SPEC the client state-machine in a short doc (create → poll with backoff → resume on
     visibilitychange/foreground → cancel; where it plugs into the existing gen driver in app.src.js;
     the exact minified anchor). Do NOT splice before the spec exists.
  3. Implement as a surgical app.src.js edit mirrored to app.js (rule 3). Behind a kill-switch
     (`antcv:disable-gen-job`) that falls back to the streaming loop, so a bad splice can't brick gen.
  4. Headless test: start a gen, set `document.hidden=true` + dispatch `visibilitychange`, assert the
     job keeps polling and resumes on foreground; kill-switch restores streaming.
  This is high-risk (touches the gen core) — if the spec/anchor isn't rock-solid, ship the SPEC +
  a WIP branch and PushNotify the owner rather than a shaky splice.

**A2 — TAB/DEVICE ISOLATION residuals (register row 39a).** The setItem-writer probe (boot-storm
pattern) on `meta`/`sections`/`antcv:app:*` during ONE row selection + ONE gen in a real tab; find
the writer that restored the stale Trackman snapshot (row 29 leg C) and guard it at source. Also
row 19 (two-real-device test — owner-gated) and the same-device stale cloud active_application
pointer (the foreign-device guard doesn't protect it).

## BAND B — DATA LOSS / CRASH (owner, high)

**B1 — SO-003 (row 40, DATA LOSS):** changing Core Competencies row count wipes Selected Outcomes,
cloud-persisted. Headless repro → find the writer that drops the outcomes section on a core_comp
resize → fix at source + a loss-guard belt.
**B2 — SO-004 (row 41, CRASH):** React #185 on field commits across multiple editors. Reproduce
headlessly per editor, capture the component stack, isolate the shared bad-key/object-child renderer.

## BAND C — CONTENT CORRECTNESS

**C1 — GEN-LANGFAB-001 (row 42):** fabricated languages (invented German, wrong Danish). Deterministic
post-gen LANGUAGE-FACT belt reconciling generated languages against the kernel `languages` (drop
non-kernel languages, correct levels; name-neutral). **C2 — CA-006 (row 43):** Application label bleeds
into the first role title — find the write site, guard it (header furniture ≠ role content).
**C3 — JD-ANALYSIS-PRINT-001 (row 44):** the analysis PDF button exports the CV — fix the export
doc-type/payload target.

## BAND D — POLISH / PERF & DESIGN

**D1 — PERF-001 (row 45):** multi-second main-thread stalls on export/preview. Chrome/boot-cpu-profile
around export + preview toggle → find the sync long task → debounce/memoize/offload.
**D2 — GEN-MODELROLE-001 (row 39):** NOT "not started" — code is shipped fail-soft, inert until the
`MODEL_ROLES` env is set. Surface the decision table (docs/plan/GEN-MODELROLE-001_design.md) + a
cost/quality recommendation from D1 `llm_calls`; owner sets the env. This is the SUPERVISOR-model
lever that also hardens GEN-LANGFAB (a different-model self-review catches fabrication).

## BAND E — STANDING COVERAGE (every run, ~30-60 min, never skipped)

**E1 — Register staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot):** take the 3-5 oldest `verified:no`
rows (currently 1, 3, 9, 14, 16, 20, 35-37) → verify against CURRENT code → close-with-evidence or
refresh + set the date. A run that only closes two stale rows properly is a GOOD run.
**E2 — Settings-panel stability sweep (row 17):** re-run `diag-personal-panel-probe.mjs`; point it at
the Layout/Account/Advanced panels; change-gate any writer still churning (Personal is fixed 1.51.128).
**E3 — Button-audit pass 2 (row 23):** re-run `diag-panel-button-audit.mjs`, diff vs the last report;
re-open menus for the 65 not-visible entries; the payload-diff leg for CJLR/roller/colour families.
**E4 — Export/preview parity (row 34):** the ROLE-MERGE stored-sections parity (top item) + the
export-only-mutation inventory (rule 45).

## OWNER-GATED (prep only, don't force): rows 25 (real-PDF table geometry), 20/20a-f (verify list),
22 ph2 (CL slogan rich_block — spec first), 35-37 (regen-confirm). List them in the report for the
owner's morning pass, with tonight's owner-eye items appended (Trackman regen: smart slogan + no
3-line bullets + old-role caps + PM tools + still sidebar; kernel v11 import).

## MOBILE TRACKING (owner watches from phone; push in ~/.claude/settings.json)
PushNotification (one line, <200 chars) at: SESSION START (band+items picked); each SHIP
("shipped <ID> <version>"); OWNER-DECISION needed (one-reply phrasing, then WAIT — esp. A1 spec sign-off,
D2 model map); COMPLETION (shipped + left). No routine-progress pushes; a mobile reply overrides.

## REPORT → `docs/qa/NIGHTLY_2026-07-05_REPORT.md`: per BAND and per register row — verified/shipped/
refreshed/blocked, evidence, versions, which model ran which task, and the owner-verify + owner-decision
lists. A nightly is complete when every open register row has a status word for this run.
