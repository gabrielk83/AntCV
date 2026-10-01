# AntCV nightly — 2026-10-01 (CI cloud run, Opus 4.8)

Unattended GitHub Actions run on `gabrielk83/AntCV`. Band E1 staleness sweep + live-deploy sanity.
No code shipped — nothing was cloud-verifiable to fix without a signed-in browser or live LLM.

## Environment / constraints

- `ALLOW_DEPLOY=false` → no worker deploys.
- No signed-in browser pane, no live LLM, Playwright chromium NOT installed in this runner.
- `app.js` / `app.src.js` / `workers/**` edits are PR-only here; none were needed.
- Base: HEAD `f6f6f68c`, synced clean (`git pull --rebase` → already up to date).

## Gates

- Suite: `node scripts/run-tests.mjs pwa` → **1746/1746 green**.
- `node scripts/check-register.mjs` → OK (run before push).
- Live-deploy sanity: `antcv.pages.dev` serves `app.js?v=1.51.4727-close-space`, equal to the repo
  HEAD `pwa/index.html` `?v` and `pwa/sw.js` CACHE — PWA auto-deploy is healthy. Worker `/health`
  not probed (the worker hostnames are owner-local; curl to guessed subdomains returned 000).

## Band E1 — staleness sweep (6 stalest `verified:` rows, all refreshed to 2026-10-01)

| Row | ID | Finding this run | Remaining |
|---|---|---|---|
| 82 | `ROLE-CANON-AUDIT-LEG-001` | Re-ran `scripts/job-tracker/test_gold_residue.py` → **18/18 pass**. `role_canon_issues(cv, lang, gold)` still wired into `gold_audit.run()` as `checks["role_canon"]`. The detail's old "NOT yet wired (uncommitted WIP)" wording survives only in the verbatim OPEN-queue snapshot; the leg is confirmed wired + green. | Owner es/zh canon-wording eyeball. |
| 94 | `CONTENT-LANG-STAMP-001` | `content_language` leg INTACT: present in `pwa/app.js` (2 refs) and the access-relay whitelist (`workers/access-relay/src/index.js`). Suite green. | Live generate/translate-persist regen confirming the stamp is written + read authoritatively — model-gated, CI can't drive. |
| 76 | `JOBTRACKER-LLM-REFIT-BUTTON-001` | Unchanged — deferred OPTIONAL enhancement, not a defect. Deterministic Top-5 ranking is by design. No code owed; nothing regressed. | Only build an on-demand "re-judge fit" LLM button if the deterministic tier proves too coarse on real edge JDs. |
| 47 | `MOBILE-TOPBAR-SAFEAREA-001` | Fix intact — `.antcv-topbar` safe-area padding (`env(safe-area-inset-top)) 12px 8px 12px`) in both bundles; `antcv-topbar-tools-347.js` still skips relocating `#antcv-pdf-preview-fab` ≤900px; redundant `antcv-mobile-export-fab.js` correctly ABSENT. | Live phone re-verify of the FAB relocation on a real device (owner/desktop — no device in CI). |
| 50 | `UPLOAD-SCREEN-TOP-CLIP-001` | Fix intact — `pwa/test/unit/upload-screen-top-clip.test.mjs` (scoped `.fade` flex-start + dead-`scrollTop`-ref removal, both bundles) green in the suite. | Owner live re-verify, with and without an active background generation. |
| 51 | `PREVIEW-SCROLL-JITTER-001` | Fix intact — `pwa/test/unit/preview-scroll-jitter.test.mjs` green (cosmetic deps `Ke, ya` still absent from the fit-recompute effect's dep array in both bundles). | Owner live re-verify. |

A note on the sweep: rows 47/50/51 were all "SHIPPED, live re-verify pending" — a DESKTOP/live
capability absent in CI. The cloud-appropriate action is to confirm the shipped code is still present
(no regression) and record that live-verify is still owed. Rows 82/94 had real code evidence
checkable in CI; both were confirmed intact, with 82's audit-leg test actively re-run green.

## Shipped

None. No fix was cloud-verifiable without a browser or live generation this run.

## Post-deploy live-verify owed to a desktop run

- Rows 47, 50, 51: the shipped fixes are regression-locked by green unit tests, but the owner's
  live on-device re-verify is still outstanding (mobile topbar FAB relocation; upload-screen
  top-clip with/without a background gen; preview scroll jitter on a cosmetic style change).

## Owner-gated / blocked (carry forward)

- Row 82: es/zh canon-wording eyeball.
- Row 94: live translate-persist regen (needs real models).
- Rows 47/50/51: owner live on-device re-verify.
- Row 76: deferred optional; only if the deterministic fit tier proves too coarse in practice.

## Registers updated this run

- `OPEN_REGISTER.md` — `verified:` → 2026-10-01 for rows 76, 82, 94, 47, 50, 51.
- `REGISTER_ACTIVE_DETAIL.md` — a 2026-10-01 re-verify block added to each of the six rows.
- `REGISTER_RUNLOG.md` — this run's summary at the top.
- This report.

No `ACTIVE_BUGS.md` or `FEATURES_REGISTRY.md` edit (no code fix, no feature advanced).
