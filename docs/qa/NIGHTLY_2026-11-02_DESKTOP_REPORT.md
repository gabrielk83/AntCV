# AntCV desktop nightly — 2026-11-02

**Outcome:** no code shipped. Root cause of the 5-day CI nightly outage found: the `ANTHROPIC_API_KEY` repo secret is out of credit. Filed as row 136 `CI-NIGHTLY-CREDIT-EXHAUSTED-001` (owner action). Band E1-E4 PASS. Live state = repo.

## Preflight / sync

- Host: Gabo-PC, Opus 5.5, scheduled run.
- `routine-preflight start`: exit 3 WORKSPACE DIRTY (owner WIP in `package.json`, `workers/access-relay/src/index.js`, `workers/access-relay/tests/cluster-qual-fit-scoring.test.mjs`, same files as 10-30). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvznnrc7` on `origin/main` `57b24a07`. Shared clone not touched.
- TOKEN OK, expires 2026-11-08T12:21Z (5.7 d left). No DISPATCH GAP line printed. Previous start 2026-11-01 (1.3 d ago).
- Shift claim `1.51.5222-1.51.5241`. No version consumed; released at end.

## Duplicate / CI overlap

- No CI report since `NIGHTLY_2026-10-28_CI_REPORT.md`. No DESKTOP NIGHTLY entry for today → full run.
- **CI nightly failed 10-29, 10-30, 10-31, 11-01, 11-02.** The action hides output; the cause is in each run's `claude-execution-output` artifact: assistant message `Credit balance is too low`, `terminal_reason: api_error`. 10-29 ran 15 turns ($0.88) then hit it; the next four failed on turn 1 at $0. `nightly.yml` is the only workflow using `ANTHROPIC_API_KEY`. Row 136.

## Baseline

| Check | Result |
|---|---|
| `node scripts/run-tests.mjs pwa` | 1860/1860 pass |
| `node pwa/test/boot-smoke.mjs` | glDemo=function, errors=0, OK |
| `node scripts/check-register.mjs` | OK, 93 ACTIVE (94 after row 136) |

No code changed, so no post-change suite run was needed; register re-checked after edits: OK.

## Bands A-D

Not advanced. Same blockers as 10-30: every open A-D row needs a signed-in real LLM generation (owner credits on an unattended run), a second physical device, a real mobile device, or an owner eyeball. Row 123 was the one candidate a desktop run could patch; its own text marks the app.js init edit owner-gated, so it was left.

Worker deploy check: `85079eaa` COMMS-LINE-001 (11-01) changed `workers/proxy` and `workers/demo-proxy` `writing-style-engine.js` without a VERSION bump, so `/health` cannot show it. Deploy runs `41317636129` (target proxy) and `41318443151` (target demo-proxy) succeeded after the merge. Deployed; not OWED.

## Band E

| Leg | Result |
|---|---|
| E1 row 21 `SETTINGS-ROLLER-RESET-001` | verified. `diag-settings-history-guard.mjs` OK in real Chromium (guarded: panel closes, no reload, sentinel re-armed; kill-switch control: navigates away). Blocked: owner live verify. |
| E1 row 22 `CL-SLOGAN-RICHCONTENT-001` | verified. Phase-1 sidecar loaded, kill-switch present. Blocked: owner (phase 2 spec). |
| E1 row 3 `FLOAT-SPINE-001` | verified. Gate default-OFF, unchanged. Blocked: owner visual re-export. |
| E1 row 20 `CONTACT-TRACK-TIGHT-001` | verified. Same 4 anchors; live docx-worker = repo. Blocked: owner CloudConvert PDF eyeball. |
| E1 row 123 `PKG-ID-PERSIST-MIGRATE-001` | verified, still OPEN. `browser-qa --only palette-mix` FAIL on prod, known orphan shape; render correct. Blocked: owner (app.js init edit). |
| E2 Settings churn | `--selftest` PASS; diag PASS, 4/4 panels at rest. |
| E3 button audit pass 2 | 208 buttons (207 on 10-30), 0 regressions, 0 recoveries, 0 page errors. One visibility move: "CJLR: cycle left / center / right / justify" hidden 1 → 2 (state left by an earlier click; same flap class as 10-30). `PANEL_BUTTON_AUDIT_2026-11-02.{md,json}`. |
| E4 Results preview/export parity | RESULTS-PREVIEW-EXPORT-PARITY OK. |

## Live attest

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS, 9/9 served, executed, identical to repo |
| `browser-qa --only version-live,sidecars-live` | 2/2 PASS (version-live timed out on 10-30; passes today) |
| served `sw.js` CACHE | `antcv-1.51.5202-tracker-merge-3way` = repo |
| served `app.js?v` | `1.51.5094-brand-ink-fit` = repo |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.175-ai-mark-props` |

## Evidence index

- CI artifacts: `claude-execution-output` on runs `40842376276`, `41027848381`, `41184555558`, `41292364347`, `41421138029`.
- Suite, E2/E3/E4 and live logs: session scratchpad (not committed).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-02.md` + `.json`.
- Register: `OPEN_REGISTER.md` (row 136 added; rows 21/22/3/20/123 → 2026-11-02), `REGISTER_ACTIVE_DETAIL.md` (row 136 section, 5 reconcile notes), `REGISTER_RUNLOG.md`.

## Owner-verify

- Nothing shipped, nothing to verify live.

## Owner decisions

- **Top up or rotate `ANTHROPIC_API_KEY`** (GitHub repo secret). Then run `gh workflow run nightly.yml` once. Check whether the same Anthropic account funds a production Claude key; if so, Claude-routed generations fail too (not checked; secrets not readable here).
- Token expires 2026-11-08. Re-save before then (row 110).

## Non-claims

- No real LLM generation, no CloudConvert export, no D1 read this run.
- Did not confirm the cv-proxy Claude key's balance.
- COMMS-LINE-001 worker deploy confirmed from deploy-run logs only, not from served code.
- Owner WIP in the shared clone was not read, built or tested.
