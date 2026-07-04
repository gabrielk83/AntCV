# AntCV nightly — 2026-07-05 (structured full-coverage plan; local antcv-nightly + cloud Routine; MULTI-MODEL)

Autonomous maintenance on `C:\Users\karpg\GitHub\AntCV` (cloud Routine: the repo clone).
Owner: Gabriel. Style: direct, compressed, no filler. Shipped as of 2026-07-04: PWA **1.51.135** ·
docx-worker **wk 1.14.132** · access-relay **1.3.3/auth-26** · proxy **3.7.1** · suite **968/968**.
Owner directive 2026-07-04: **"treat mobile and tab isolation as high priority … make sure the plan
for nightly is structured and full coverage is planned."** This prompt IS that structure.
Since dispatch: A2's client leg (same-device stale pointer) SHIPPED — see A2 below.

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

**A1 — GEN-BACKGROUND-001 (register rows 38 + 38a). APPROACH A SHIPPED END-TO-END 1.51.133/134; now
OWNER-A/B + FLIP-DEFAULT.** Owner chose A. Finding: AntCV gen is a DEPENDENT client pipeline (each
stage's prompt built from prior results), not independent server sections — so the fit is
CHECKPOINT-MEMOIZATION at the `ee()` LLM chokepoint, not a /job/* switch. SHIPPED + LIVE, default OFF
(opt-in `antcv:gen-resume=1`, kill `antcv:disable-gen-memo`): `antcv-gen-memo.js` memoizes each completed
gen LLM call; a surgical `ee()`/`Le()` wrapper in BOTH bundles replays completed calls on a re-run;
gen-done clear(); INPUT-SIGNATURE (JD+meta) for cross-reload; AUTO-RESUME-ON-FOREGROUND re-invokes the
app generate fn (`window.__antcvGenTrigger`) once per interrupted checkpoint. 11 memo tests + both-bundle
mirror lock; suite 956/956 + boot-smoke.
  Steps this run — DO NOT re-implement (verify-first, it's shipped): (1) A/B on a REAL mobile gen with
  `antcv:gen-resume=1`: start a gen → background/lock mid-run → foreground → confirm it auto-resumes fast
  (completed calls replay, only the interrupted one re-runs) AND a mid-run reload resumes; capture whether
  output matches a normal (flag-off) gen — it must (the memo is output-neutral). (2) If the A/B is clean,
  propose FLIPPING THE DEFAULT (make `antcv:gen-resume` default-on with the kill-switch retained) — a
  one-line sidecar change + quintet; PushNotify the owner before flipping. (3) REMAINING follow-on only
  if the owner wants true MID-CALL survival: the server-driven decompose using the shipped
  `antcv-gen-job-client.js` /job engine — big, owner-gated, spec first. Do NOT touch the gen core further
  without a fresh-gen A/B.

**A2 — TAB/DEVICE ISOLATION residuals (register row 39a). 2 of 3 legs SHIPPED — VERIFY-FIRST, do
NOT re-implement.** Leg 1 (server, AUTOSAVE-NO-DOWNGRADE-001, access-relay, DEPLOYED): PUT
/api/applications/:id blocks a meta downgrade (real company → empty/Unsolicited) and a blank
cv/cl overwrite over populated content; explicit null wipes and genuine upgrades still pass.
Leg 2 (client, PTR-STALE-GUARD-001, PWA 1.51.135): the `__foreignDevice` guard only ever protected
against ANOTHER device's active_application pointer; it never protected a SAME-device pointer that
is simply STALE (a race / lagging PUT / second same-device tab) and points at a different real
application — new sidecar `antcv-pointer-stale-guard.js` compares the pointer's
`_pointer_updated_at` against the local `antcv:metaStamp` (277-SEQUENCE-GUARD-001 pattern,
backward-safe, inert without both timestamps) and is OR-ed into the drift check at both adoption
sites in both bundles. 11 unit tests + a both-bundle mirror lock; suite 968/968 + boot-smoke.
Together legs 1+2 close BOTH halves of the "the fuck?" Trackman revert class of bug.
Steps this run — verify, don't rebuild: (1) confirm access-relay is actually running the deployed
guard (curl a downgrade PUT against a real row, expect the company preserved). (2) LIVE A/B the
client leg: open two tabs on the same device (or a tab + a quick row-switch race), force a stale
pointer scenario, confirm the fresher local draft survives cold-restore; check console for the
`PTR-STALE-GUARD-001` log line firing when expected and staying silent otherwise. **REMAINING (leg
3, owner-gated):** row 19 two-real-device test — needs an actual second physical device, can't be
faked headlessly. If leg-3 needs prep, stage the repro steps but do not fabricate a "device" via a
second tab (that's leg 2, already covered) — flag it in the report as needing the owner's second
device/phone.

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
**D2 — GEN-MODELROLE-001 (row 39): VERIFY-LIVE ONLY, not a design task.** Verify-first found it is fully
wired: code in multi-llm/supervisor/gen-coherence/index (both proxies) AND `MODEL_ROLES =
{"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}` already SET in BOTH wrangler.toml
[vars] (owner-decided 2026-06-13). Action: confirm the last proxy + demo-proxy deploy carried the var
(wrangler [vars] apply on deploy — check deploy timestamp vs the wrangler commit) and D1 `llm_calls` shows
the split routing (supervisor→mistral, writer/coherence→anthropic). If not deployed: `gh workflow run
deploy.yml -f target=proxy` + demo-proxy, then curl a supervisor-tagged call and confirm the provider.
This is the SUPERVISOR-model lever that also hardens GEN-LANGFAB (a different-model review catches
fabrication) — so verifying it live directly helps Band C.

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
