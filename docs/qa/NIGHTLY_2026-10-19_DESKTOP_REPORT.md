# AntCV desktop nightly — 2026-10-19 (Gabo-PC, Opus 5.5, worktree-isolated)

**Outcome:** shipped `1.51.5074-settings-route-fallback` (SETTINGS-ROUTE-NOOP-001, new row 129 CLOSED): the island settings route now opens the panel. Live attest PASS before the ship. Band E2-E4 PASS. Token OK.

## Preflight / sync

- `routine-preflight start` exit 3 (WORKSPACE DIRTY: owner WIP in `package.json` + `workers/access-relay`) → worktree `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mvexio2s` on `origin/main` `5bb60c71`; rebased onto `92ea2f39` (CI nightly 10-19 landed mid-run) by the shift claim.
- TOKEN OK, expires 2026-10-25T20:15:59Z (6.5 d). No DISPATCH GAP line printed; previous start 2.6 d ago (10-16).
- Shift claim `1.51.5074-1.51.5093` (session `sh_mveyixr7_2rkq`), consumed 1.51.5074.
- Overlap: no CI report for 10-19 at run start; it landed during the run and E1-swept rows 21/22/3/20/123 — the same five rows this run took. Their dates were not re-touched here. No DESKTOP NIGHTLY entry existed for today.

## Baseline (before any edit)

- `run-tests.mjs pwa` 1834/1834. `boot-smoke` glDemo=function, errors=0. `check-register` OK, 92 ACTIVE.

## Live attest (desktop-only)

| Check | Result |
|---|---|
| `diag-live-guard-sidecars.mjs` | PASS 9/9 (3 boot 401s expected) |
| `browser-qa --only version-live,sidecars-live` | 2/2 |
| served `sw.js` CACHE / boot seed / override `?v` / TARGET_VERSION | all `1.51.5073-unsol-company` = repo |
| served `app.js?v` | `1.51.5053-cc-tooltips-plain` = repo; served `app.js` and `index.html` byte-identical to the repo after CR strip |
| 10-18/19 ships | served `app.js` carries "The role needs" ×15 (CC-HEADERS-PLAIN-001/002); served `antcv-bullet-targets.js?v=1.51.5073-unsol-company` identical to the repo (UNSOLICITED-COMPANY-001) |
| `/health` ×4 | 200: access-relay `auth-38-subtitle-guard-qual-put`, cv-proxy + demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.174-appline-edit` (`pdf_via: cloudconvert`) = repo |
| authed relay reads (saved token) | `/api/me` 200, `/api/applications` 200, `/api/job-tracker` 200; no write |

Post-push live verify: see the section at the end.

## Band E

- **E2** `diag-settings-panel-churn` selftest PASS; 4 panels 0 mutations. Re-run after the fix: PASS.
- **E3** `diag-panel-button-audit` 209 buttons, 0 THROWS / 0 DEAD. Diff vs 10-16: 0 regressions, 0 recoveries, 0 labels gone/added, 1 visibility move ("CJLR: cycle" hidden 10 → 3, accounts for 216 → 209), 11 active↔ui-only timing flips. Report `PANEL_BUTTON_AUDIT_2026-10-19.md`.
- **E4** `diag-results-preview-export-parity` OK.
- **E1** (stalest 21/22/3/20/123 @10-09; CI took the same five today):
  - **21 SETTINGS-ROLLER-RESET-001** — guard diag FAILED 2/3 at baseline on this host. Diagnosed (see below), fixed as row 129; after the fix 4/4 OK. Row stays ACTIVE on the real-hardware Back eyeball.
  - **22** sidecar loaded ×1, kill-switch ×2 — unchanged; phase 2 owner-gated.
  - **3** `floatSpine` gate ×6 worker, docx-client line intact (one line, two matches — same as before); live worker = repo.
  - **20** four worker anchors present; live worker = repo; owner CloudConvert session owed.
  - **123** `browser-qa --only palette-mix` still FAIL live (`lsResolved:false`), as the row states; render correct via `__pkgNorm`. Fix is an app.js init write-back the row marks owner-gated; not done.

## Fix: SETTINGS-ROUTE-NOOP-001 (row 129, CLOSED)

Repro → probe → patch:

1. Guard diag FAIL in the guarded (first, cold) run: `openBefore {open:false, sentinel:false}`. Navigation log: no reload; the open call simply never pushed the sentinel.
2. Retry of the same call in the failing page: still closed. A real ⚙ click in that page: opens. So only the global route was dead.
3. `String(window._antcvOpenSettingsRoute)` in the failing run: `r=>e.openSettings(r)` (the islands `SettingsRouter` hook); in passing runs: app.js's route. `window._antcvOpenSettings` is `undefined` in every run — app.js keeps it render-local, yet the island's `useModalNav.openSettings` relies on it to open the panel.
4. Fix in `src/islands/SettingsRouter/SettingsRouter.tsx`: after `nav.openSettings()`, with no `_antcvOpenSettings`, call app.js's route — the live global if app.js re-rendered after the island, else the one the island replaced. The first fix version only used the replaced one and still no-op'd once (island mounted before app.js's first render); the live-global read closed that.
5. Build: identity round-trip gate first — unedited source rebuilt with `vite build` and `vite build --config vite.panels.config.ts` was byte-identical to the committed `antcv-react-islands.js` and `antcv-react-islands-panels.js`. Then rebuilt with the fix; core `VERSION` 1.51.619 → 1.51.5074 (it is the lazy panels `?v`).

Evidence:

| Probe | Original | Fixed |
|---|---|---|
| island path (`AntcvReactSettingsRouter.openSettings`) opens the panel | 0/3 | 5/5 |
| `diag-settings-history-guard.mjs` | 1/3 OK | 4/4 OK |
| `settings-route-fallback.test.mjs` | 2/3 (red) | 3/3 |

Suite 1834 → 1837/1837. Boot smoke OK. `check-cache-bust --set` OK, `--range origin/main..HEAD` OK (2 assets bumped). E2 PASS after the fix.

## Bands A-D

Not advanced. Prior desktop runs verified the shipped code legs; the residuals need a second physical device (A1/A2, rows 19/63/64), a signed-in content repro (B), a real LLM generation or D1 telemetry (C/D, rows 39/42/35/36/37), or an owner decision (rows 115/117/124). Live attest re-confirms rows 38/39a/40-44 at the served versions.

## Owner-verify

1. Settings opened from a sidecar route (e.g. the Applications shortcut in `antcv-settings-front-327`) opens the panel every time after a hard refresh.
2. Row 21: real roller-side Back with Settings open (unchanged).

## Owner decisions

- Row 123: approve the app.js init write-back for the orphan `stylePackage` id.
- Rows 115 / 117 / 124: unchanged.
- Row 12: CI's 5th recommendation to CLOSE stands.

## Non-claims

- Not tested on a real device or a signed-in production session; the fix is proven in headless Chromium against the local tree.
- No worker deploy, no D1 write, no app.js edit, no `npm run build:app`.
- E1 dates for rows 22/3/20/123 were set by CI today, not by this run.

## Evidence index

- Commit `fix(settings): 1.51.5074-settings-route-fallback` — source, both bundles, cache-bust set, unit test.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-10-19.md` / `.json`.
- Register: row 129 in `REGISTER_CLOSED.md`, row 21 note in `REGISTER_ACTIVE_DETAIL.md`, top block in `ACTIVE_BUGS.md`, run summary in `REGISTER_RUNLOG.md`.

## Post-push live verify

Pushed `3403f322`. Pages served `sw.js` CACHE `antcv-1.51.5074-settings-route-fallback`, boot seed and `antcv-react-islands.js?v` at the same version; served `antcv-react-islands.js`, `antcv-react-islands-panels.js?v=1.51.5074` (fallback marker present) and `antcv-version-override.js` byte-identical to the repo. `diag-live-guard-sidecars` 9/9 and `browser-qa version-live,sidecars-live` 2/2 after the deploy.
