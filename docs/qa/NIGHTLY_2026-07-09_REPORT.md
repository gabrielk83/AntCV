# AntCV nightly — 2026-07-09 report

Baseline: PWA **1.51.222** (main, in sync with origin — `main...origin/main` = 0/0). Suite **1199/1199** green.
Model: this run executed by claude-opus-4-8 (single serial session; no parallel worktrees needed).
Note: this is the first nightly since 2026-07-07; the cloud/mobile Routine shipped heavily in between
(1.51.195 → 1.51.222 — the job-tracker V3/V4 suite, MOB-006/008 fixes, cross-device gen-leak fix
1.51.201, JD-swap stale-rationale 1.51.216, rationale object-render crash guard 1.51.221, date-scrub
1.51.222). Bands A–D were verified shipped/owner-gated in the 07-06/07-07 runs and have not regressed.

## Headline action — Row 68(A): at-risk WIP PRESERVED

Owner's stated **#1 priority (2026-07-08, register row 68A):** the per-app `style_config` brand-fit fix
was drafted but **UNCOMMITTED** in worktree `C:/Users/karpg/GitHub/AntCV-brandfit-scope` — 5 files that
existed only in that working tree and would be lost if the worktree were pruned.

**Done this run:** committed the WIP to its feature branch `brandfit-per-app-scope`
(commit `fc2477c`, 5 files, 162 insertions) and **pushed it to `origin/brandfit-per-app-scope`** as a
durable backup branch. The work now survives worktree pruning AND local repo loss.

- Scope preserved: `schema.sql` (application.style_config column + ALTER-TABLE note), access-relay
  `shapeApplicationRow` (surfaces per-app style_config), `pwa/app.src.js` + `pwa/app.js` (brand-fit
  colours write per-application not to account-wide KV keys), `tests/application-style-config.test.mjs`.
- **NOT done (deliberate, per owner):** not merged to main; the live
  `ALTER TABLE application ADD COLUMN style_config TEXT;` was NOT run (owner: do not run without fresh
  confirmation). The branch is 108 commits behind main and needs a rebase + review before any merge.
- The pre-push main-regression hook fired a **false positive** (it flags the *feature branch* being
  behind main, which is by design). Verified the real invariant it guards — `main...origin/main` = 0/0,
  main is fully in sync — then bypassed with `--no-verify` per the hook's own guidance, for a
  feature-branch backup push that cannot touch main.

**Owner follow-up:** when unpressured, rebase `brandfit-per-app-scope` onto current main, review, run the
D1 ALTER TABLE against production (with fresh confirmation), then merge. Register row 68(A) → PRESERVED.

## Band E — standing coverage (every run)

- **E1 register staleness sweep** — full survey of all rows; every open row has a status word below.
  Rows shipped since 07-07 by cloud/mobile: 63/64 (analysis stale/export, 1.51.196/198), 65 (cross-device
  gen-leak, 1.51.201), 74B (JD-swap stale rationale, 1.51.216), plus the job-tracker feature rows. No row
  found implemented-but-still-open beyond those.
- **E2 settings-panel stability (row 17)** — `diag-personal-panel-probe` on 1.51.222: **0 mutations/8s,
  0 page errors, DIAG PASS**. No regression from the 07-07 baseline.
- **E3 button-audit (row 23)** — `diag-panel-button-audit` on 1.51.222: **196 buttons, 0 page errors**;
  active 116, not-visible-or-disabled 55, skipped-dangerous 12, ui-only 13. Within the 07-06/07-07 range
  (51–55 not-visible), no regression.
- **E4 export/preview parity (row 34)** — DONE prior (1.51.154 role-merge stored-sections + 1.51.194
  group-empty-hide parity); no parity-affecting change on main tonight (my only commit was to a separate
  feature branch), so nothing to re-verify.

## Every open register row — status word this run

| Row | Status this run |
|---|---|
| 1 | open — no convergence code (render/owner-gated; legs in 25/27) |
| 2 | diagnosed+locked (prior) |
| 3 | refreshed — float-spine flag default-OFF (unchanged) |
| 6, 8 | carry (owner-eyeball / kernel-v2) — untouched |
| 9 | PARTIAL — write pipeline exists; nightly research-refresh + `source='research'` writer still open |
| 14, 17, 30, 32, 33, 34 | DONE (prior) |
| 16 | prior re-run; owner live-verify open |
| 19 | owner-gated (second physical device) |
| 20, 25, 27, 28 | owner real-export eyeball (blocked) |
| 22 | owner-gated (spec first) |
| 23 | button-audit re-run this run — 196 buttons / 0 err / 55 not-visible (no regression) |
| 24 | owner click-through (blocked) |
| 26 | open — untouched |
| 29, 31 | partial / owner-gated |
| 35, 36, 37 | CLOSE-WITH-EVIDENCE (prior E1) |
| 38/38a | A1 shipped; real-mobile A/B owner-gated |
| 39 | VERIFIED-LIVE (07-06) |
| 39a | PARTIAL 2/3 legs shipped; leg 3 (two devices) owner-gated |
| 40, 42, 43, 44 | SHIPPED (belts, prior) |
| 41 | instrumented; waiting live Android crash (owner-gated) |
| 45 | PARTIAL 1.51.158 — cloud-sync setTimeout leg still open (needs live app.js profiling) |
| 46, 47 | CLOSED / SHIPPED |
| 48 | SHIPPED |
| 49 | not started (docx page-distribution core; dedicated session) |
| 52 | SHIPPED 1.51.194 (deployed) |
| 53 | not started — P0 cross-app contamination; diagnostic-first, owner morning |
| 54, 55, 56 | not started — JD kernel-recall / targeted furniture / JD-relevance trim (content-gen) |
| 57 | not started — TARGETED-CV-POLISH-RULES (30 rules); applied by hand to KOMBIT; generator-baseline |
| 58 | MOB-008 SHIPPED 1.51.195; MOB-009 diagnosed→folds to 59A; others triage vs 51/53/54/55/56 |
| 59 | (A) generator-owned (ties 27/49/57); (B) FIXED in hand-edit tooling; (C) needs renderer/generator |
| 60 | diagnosed (code map); live-DOM capture + patch pending (auto-deploy prod — needs live repro) |
| 61 | guidelines crystallized; feed the generator orphan-measure pass (59A) |
| 62 | header-banner rules DEPLOYED docx-worker 1.14.133; validated on Trackman 07-08; 2 follow-ups open |
| 63 | SHIPPED 1.51.196; owner live-verify pending |
| 64 | SHIPPED 1.51.196, HARDENED 1.51.198 |
| 65 | (A) modal 1.51.200 verify; **E FIXED 1.51.201**; B/C/D diagnosed, need focused work + device info |
| 66 | captured 07-08 (Trackman review); re-deliver from kernel + generator baseline |
| 67 | reconciled 07-08 — (B) slogan shipped; (A) owner/desktop LLM, (C) live desktop, (D) regen-gated, (E) unsolicited-gen |
| 68 | **(A) PRESERVED this run** (committed + pushed backup branch); B–F feed baseline / owner-gated |
| 69 | DONE 07-08, deployed docx-worker 1.14.134 |
| 70 | DONE 07-08 (CV rebuild v2); awaiting owner review |
| 71 | DONE 07-08, deployed docx-worker 1.14.135 |
| 72 | DONE 07-08, deployed docx-worker 1.14.136 |
| 73 | DONE 07-08 (line-fill deep pass); residual page-2 slack → 61 float-spine |
| 74 | (A) DONE (estimator autofit finding); (B) FIXED+deployed 1.51.216 awaiting 1 owner gen; **(C) OPEN — background-stall, biggest mobile first-gen blocker, diagnostic-first next (sensitive stream code)** |

No open register row was left without a status word this run.

## Owner-decision list
- **A1 flip-default** (`antcv:gen-resume` → default-on): still gated on a clean real-mobile A/B (needs your phone).
- **Row 68(A) merge**: rebase `brandfit-per-app-scope` onto main + run the D1 ALTER TABLE (fresh confirm) + merge — unpressured, your call on timing.

## Owner-verify list (carried)
- Rows 63/64: load a saved app → its own JD analysis loads (not the prior app's); analysis-PDF export keeps filled gap detail + recruiter answers.
- Row 65E: generating a targeted app on desktop no longer flips the unsolicited app under review on mobile.
- Row 74B: one foreground generation confirms the JD-swap no longer targets the previous JD's company.
- Rows 35–37: one live 3–6 min unsolicited regen to formally close the regen-confirm trio.
- Row 52 / 42 / 43 / 44: carried from 07-07 (dangling group heading, fabricated languages, "Application:" bleed, analysis-PDF print).

## Owner-gated / blocked (prep only)
- Rows 19 + 39a leg-3 (second physical device); row 41 (live Android #185); row 45 cloud-sync leg (live DevTools profiling); rows 53–56/57/59/66 (content-gen family — larger than a safe one-nightly close); rows 20/25/27/28 (real PDF export eyeball); row 49 (docx page-distribution core); row 74C (background stream-throttle — sensitive SSE code, diagnostic-first with a real device).

## Durable lessons → auto-memory
- Preservation-commit discipline for at-risk worktree WIP + the pre-push hook's feature-branch false-positive (see memory update).
