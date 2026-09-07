# AntCV nightly — CI run 2026-09-07 (GitHub Actions, unattended, Opus 4.8)

**Substrate:** GitHub Actions, `gabrielk83/AntCV`. Unattended. `ALLOW_DEPLOY=false`.
No in-app Browser pane; Playwright browsers were absent on the runner and were installed
(`npx playwright install chromium`) so boot-smoke + the headless diags could run.

**Outcome class:** verification + Band-E standing-coverage run. **Docs + registers only** —
no `pwa/app.js`, `pwa/app.src.js`, or `workers/**` change, so everything here pushes straight
to `main` per the CI safety override. No PR owed by this run.

## Baseline (before any edit)
- `git fetch origin && git pull --rebase origin main` → already up to date, HEAD `2cc4ba4f`.
- `node scripts/shift.mjs status` → no active claims. (Docs-only run — no shift lane claimed.)
- `node scripts/run-tests.mjs pwa` → **1714 pass / 0 fail**.
- `node pwa/test/boot-smoke.mjs` → `glDemo=function, errors=0` → BOOT-SMOKE OK.

## Why no code fix shipped
- **Band A (mobile & tab isolation)** — A1 GEN-BACKGROUND-001 and A2 TAB/DEVICE ISOLATION are
  SHIPPED; what remains is owner A/B on a real phone + a real second device — not doable in CI.
- **Band B/C (data-loss / crash / content correctness)** — rows 40 (SO-003), 41 (SO-004 React
  #185), 42 (GEN-LANGFAB), 43 (CA-006), 44 (JD-ANALYSIS-PRINT) are headlessly reproducible but
  every fix is `app.js`/`app.src.js` surgery, which the CI override routes through a PR for owner
  review AND cannot be fully live-verified unattended. One solid verified result beats a
  half-verified brick, so these were deferred to a desktop/owner run rather than opened blind.
- Ran the **never-skip Band E standing coverage** instead — the "a run that closes/refreshes the
  stale rows properly is a GOOD run" slot.

## Band E1 — register staleness sweep (5 stalest rows, verify-first vs current code)

| Row | ID | Verdict this run | Still owed |
|---|---|---|---|
| 25 | TABLE-GEOMETRY-PARITY-001 | Forwarding pipeline INTACT — `diag-cl-table-dims-export` GREEN (width set / survives export / payload correct) | Real-CloudConvert-PDF fidelity gap (Carlito advance widths, padding, line-clamp) — no CloudConvert in CI; desktop real-PDF pass |
| 6 | BANNED-WORDS-MERGE-001 | Code-complete confirmed — island writes `stylePrefs.banned_*`; kill-switches `antcv:keep-native-banned` + `antcv:no-kernel-chain` present; suite green | Owner eyeball of merged UI + one file of each of the 6 loader types |
| 8 | KERNEL-V2-READER-001 | `pwa/test/unit/kernel-v2-reader.test.mjs` **5/5** GREEN — staged v2-kernel work-history builder intact | (a) bullets-path v2 migration; (c) es/zh tier needs real models; (d) §6 uploaded-docx parity, owner-gated |
| 12 | AI-NOTICE-LEFT-CLOUDCONVERT-001 | `ai-notice-position.test` **3/3** GREEN + worker page-relative `margin-left` (0pt/275pt + jc) confirmed — anchor bug effectively resolved | Row lingers only on the docx-baseline "remaining 3" (cjlr-table-export, pageflow-export, spacing-linkedin-export = SEPARATE tests) → **recommend owner move to REGISTER_CLOSED** and re-file the 3 baseline gaps under their own IDs |
| 21 | SETTINGS-ROLLER-RESET-001 | `diag-settings-history-guard` GREEN headless — guarded: Back consumes sentinel, panel closes, NO reload, sentinel re-armed; kill-switch control navigates away (the reset, reproduced) | Owner live-verify on real roller-side hardware Back button (hard refresh → Settings → press → no Loading gate) |

## Band E2 — settings-panel stability (Row 17 SETTINGS-PERSONAL-STABILIZE-001, STANDING)
- `diag-settings-panels-probe.mjs`: **Personal 0 mut/6s, Account 0 mut/6s, Layout 0 mut/6s**,
  rootFound=true, 0 page errors → DIAG PASS (all standard settings panels at rest).
- `diag-personal-panel-probe.mjs`: 0 mutations/8s, 0 page errors. No regression.

## Band E3 — preview/panel button audit (Row 23 NIGHTLY-PREVIEW-BUTTON-AUDIT-001, STANDING)
- `diag-panel-button-audit.mjs`: **215 buttons** — `{skipped-dangerous:14, ui-only:13, active:140,
  not-visible-or-disabled:48}`, **0 page errors** during the audit, **THROWS section empty** (no
  button throws on click), no DEAD candidates flagged.
- Diff vs prior 2026-08-20 (211 buttons, `{14,15,134,48}`, 0 THROWS): +4 buttons enumerated,
  active 134→140, ui-only 15→13, still 0 THROWS / 0 page errors — **NO REGRESSION**.
- Artifacts committed: `docs/qa/PANEL_BUTTON_AUDIT_2026-09-07.{json,md}`.

## Register edits pushed this run
- `OPEN_REGISTER.md` — verified column: rows 25, 6, 8, 12, 21 → 2026-09-07; STANDING rows 17, 23 → 2026-09-07.
- `REGISTER_ACTIVE_DETAIL.md` — dated `reconcile 2026-09-07` evidence blocks on rows 25, 6, 8, 12, 21, 17, 23.
- `REGISTER_RUNLOG.md` — this run's summary at top.
- `node scripts/check-register.mjs` → register OK (95 ACTIVE rows, 95 detail sections).

## Post-deploy live-verify owed to a desktop run
None owed by this run — no PWA asset or `?v` changed (docs + registers only), so there is no
new deploy to live-verify. All owner/live items are the pre-existing per-row "still owed" notes
above (real-CloudConvert PDF, 6-file loader eyeball, real-model kernel tier, roller-hardware
Back button), plus the Band B/C app.js fixes still queued for a desktop/owner run.

## For the owner
- **Row 12 AI-NOTICE-LEFT-CLOUDCONVERT-001** is functionally resolved and is only held ACTIVE by
  an unrelated docx-baseline remainder — a one-line call to move it to CLOSED (and re-file the 3
  baseline gaps) would clean the index.
- Band B/C fixes (rows 40/41/42/43/44) are ready to be worked but want a desktop/owner session:
  app.js surgery via PR + live verification.
