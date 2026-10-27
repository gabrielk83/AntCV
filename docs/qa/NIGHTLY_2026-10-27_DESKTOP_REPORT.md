# AntCV nightly — desktop 2026-10-27 (Gabo-PC)

**Outcome:** no code shipped. Live attest PASS, Band E2-E4 PASS, E1 rows 31/98/99/100/101/110 re-verified with desktop-only legs. No version consumed, no shift claim.

## Preflight / sync

- Preflight exit 3 (owner WIP in `package.json`, `workers/access-relay/src/index.js`, its cluster test). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvqeyahm` on `origin/main` `37fbb40f` (CI 10-27 already in; rebased onto `e0165104` at push).
- First `git fetch` raced the job-tracker nightly (`cannot lock ref`); re-fetched, worktree created clean.
- TOKEN OK, expires 2026-11-01T19:31:42Z (5.5 d). No DISPATCH GAP line (previous start 1.0 d ago).
- CI 10-27 swept rows 68/75/77/81/83/88/87/86. This run took the next six stalest (all @ 2026-10-16) and the legs CI cannot reach.

## Baseline

| Check | Result |
|---|---|
| `run-tests.mjs pwa` | 1850/1850 pass |
| `boot-smoke.mjs` | first attempt: `page.goto` timeout 30 s; host network stalled (antcv.pages.dev 000 @ 12 s, cdnjs 000 @ 24 s). Network recovered within a minute; retry glDemo=function, errors=0. No pwa/ change since the 10-26 pass. |
| `check-register.mjs` | OK, 93 ACTIVE rows |

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 served, executed, content-identical (two 401 resource loads = unauthenticated probe, expected) |
| `browser-qa.mjs --only version-live,sidecars-live` | 2/2 PASS |
| served sw.js CACHE | `antcv-1.51.5139-demand-seed-refresh` = repo |
| served app.js `?v` | `1.51.5094-brand-ink-fit` = repo |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.175-ai-mark-props`; all = repo |

## Band E

| Leg | Result |
|---|---|
| E1 staleness | rows 31, 98, 99, 100, 101, 110 → verified 2026-10-27, all kept ACTIVE (below) |
| E2 Settings churn | selftest PASS; DIAG PASS, 4/4 panels at rest |
| E3 button audit | run 1: 209 buttons, 0 regressions, labels gone "What I Bring row 0 alignment…" + "⇥ Fit". Run 2: 211 buttons, 0 regressions, 0 page errors, only "⇥ Fit" gone. Kept run 2 as `PANEL_BUTTON_AUDIT_2026-10-27.md`. |
| E4 export/preview parity | RESULTS-PREVIEW-EXPORT-PARITY OK |

**E3 "⇥ Fit":** flap, not a regression. Absent in both runs today, also absent 10-06 and 10-23, present every other audit since 10-04. No pwa/ file changed since the 10-26 audit that saw it. It sits next to "Make It Fit (sidebar)", whose visibility count moved this run, so it is a state/timing artefact of which panel is open. Not the CL slogan "⇥ Fit" (no slogan buttons appear in any audit). Source of the label not pinned this run. Watch: if it is absent three runs in a row, trace it.

## E1 rows

| Row | ID | Status | Evidence | Blocker for the rest |
|---|---|---|---|---|
| 31 | META-STATE-CORRUPTION-002 | verified | `META-DRIFT-GUARD-002` ×2, `META-DOWNGRADE-GUARD-003` ×2 in `app.src.js`; guard tests green; served app.js = repo | owner session (live poisoned row) |
| 98 | BYOK-COST-AUDIT-001 | verified | `total_cost_usd_est` ×7, proxy/demo-proxy `byok-qualify.js` byte-identical; both proxies live = repo | none |
| 99 | REG-GROUP-FOLD-NAMED-001 | verified | `diag-reg-fold-dance.mjs` DIAG PASS: one group, bounded writes, 0 page errors | owner check ("sidebar dancing") |
| 100 | GRAB-ZONE-DISMISS-THRESHOLD-001 | verified | `diag-mobile-grab-zone-touch.mjs` A1/A2 40 px graze scrolls forward, B 120 px dismisses, 0 page errors | real device (Android) |
| 101 | ZOOM-FLOOR-001 | verified | same diag leg C: 46 % → 10 % floor, + → 20 % | none |
| 110 | ANTCV-TOKEN-EXPIRED-2026-09-02-001 | verified | token OK 5.5 d; authed `GET /api/job-tracker` 200 | leg (a) long-lived routine token, owner decision |

## Bands A-D

Not advanced. A1/A2 need a live mobile gen + a second device; B needs a signed-in repro with real content; C/D need live LLM routing, a worker deploy or a CloudConvert render. Nothing drivable at this HEAD that CI or the 10-26 desktop run had not verified.

## Evidence index

- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-27.md` / `.json`
- `docs/qa/last-browser-qa.json` (not committed, local run output)
- Register: `REGISTER_RUNLOG.md` top entry; `OPEN_REGISTER.md` + `REGISTER_ACTIVE_DETAIL.md` rows 31/98/99/100/101/110

## Owner-verify

- Row 110: token expires 2026-11-01. If no relay-backed routine runs inside its refresh window before then, re-save `~/.antcv/token`.

## Owner decisions

None new.

## Non-claims

- No generation run, no signed-in click-through, no worker deploy, no PWA change.
- "⇥ Fit" source not traced; called a flap from history, not proven.
- Row 100 Android behaviour not observed on a real device; headless touch only.
