# AntCV CI nightly — 2026-10-19 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `d23170cf`. SYNC FIRST clean (`git fetch` + `pull --rebase origin main`
already up to date). `ALLOW_DEPLOY=false` → no worker deploys attempted. No in-app Browser pane in CI
→ no live signed-in verification; but a headless Playwright browser WAS installable this run (see E1).

## Baseline

- `node scripts/run-tests.mjs pwa` → **1834 pass / 0 fail** (0 skipped).
- `node scripts/check-register.mjs` → OK, both before and after the sweep.
- No `pwa/app.js` / `pwa/app.src.js` / `workers/**` edit → no boot-smoke, no cache-bust quintet, no
  shift claim owed; docs-only push direct to `main` (permitted by the CI safety override).

## Band E1 — register staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

`check-register.mjs --stalest 6` → took the **5 oldest** rows (all 2026-10-09). All are code-anchored
and were re-verified against HEAD `d23170cf`; all markers INTACT; each kept ACTIVE on its existing gate
with `verified:` set to **2026-10-19** in both the index (`OPEN_REGISTER.md`) and the detail
(`REGISTER_ACTIVE_DETAIL.md`).

| Row | ID | was | Verify evidence (HEAD `d23170cf`) | Residual gate |
|---|---|---|---|---|
| 21 | SETTINGS-ROLLER-RESET-001 | 2026-10-09 | **Installed chromium-headless-shell v1223 (`npx playwright install` — succeeded despite the known egress allowlist) and RE-RAN `diag-settings-history-guard.mjs` GREEN**: guarded run → panel closed, NO reload, sentinel re-armed (`{marker:"alive", url:/index.html, open:false, sentinel:true}`); kill-switch control → navigated away to /manifest.json, marker GONE (reset reproduced). `antcv-settings-history-guard.js` loaded + kill-switch `antcv:no-settings-history-guard` present | OWNER live-verify on real roller-side hardware Back button still owed |
| 22 | CL-SLOGAN-RICHCONTENT-001 | 2026-10-09 | phase-1 sidecar `antcv-cl-slogan-element.js` loaded in `index.html` (1 ref) + kill-switch `antcv:disable-cl-slogan-element` present (2 hits) | Phase 2 (real `sections.cl` rich_block + dedupe at 3 render sites + worker) = genuine open work, spec-before-splice, owner-gated |
| 3 | FLOAT-SPINE-001 | 2026-10-09 | `floatSpine`/`float_spine` gate `workers/docx-worker/src/index.js` ×6 + `pwa/antcv-docx-client.js` ×2, default-OFF unchanged | Owner-visual re-export (flag-on CloudConvert PDF) — no reference docx in CI |
| 20 | CONTACT-TRACK-TIGHT-001 | 2026-10-09 | docx-worker anchors `headlineAlign` / `fix_orphans` / `SIRIN-SEMANTICS-001` / `CONTACT-TRACK-TIGHT-001` (4 refs, `workers/docx-worker/src/index.js`) | Acceptance needs one Hard Refresh + CL regen + CV re-export eyeballed in a real CloudConvert PDF — owner session |
| 123 | PKG-ID-PERSIST-MIGRATE-001 | 2026-10-09 | state UNCHANGED — `set("stylePackage", __pkgNorm(...))` write-backs only at restore paths (app.src.js 17624 / 23466); 40294 is the raw user-select write, 20857 the `__pkgMap[v]` path; NO boot/init-time normalising write-back. Render stays FIXED via `__pkgNorm` (6 refs) | Persisted-id self-clean on a non-restore boot — owner-gated app.js init edit (surgical mirror), not done unattended; severity LOW (render correct) |

New stalest after the sweep: row 33 `WHY-RULE-EXPORT-PARITY-001`, row 24
`ANALYTICS-BUTTONS-SESSION-TIMEOUT-001`, row 26 `TOOLS-SIDEBAR-COMPRESS-001` (all 2026-10-10) — next
cohort for the following nightly.

## Bands A–D — not advanced (all blocked in CI)

- **A1 GEN-BACKGROUND-001 / A2 tab-device isolation:** need a live mobile generation + a second
  physical device for the A/B legs; code shipped and verified in prior runs. Not reproducible here.
- **B1 SO-003 / B2 SO-004:** need a signed-in headless repro driving real content; no new finding this run.
- **C (GEN-LANGFAB / CA-006 / JD-ANALYSIS-PRINT) + D (PERF-001 / GEN-MODELROLE):** need live LLM
  routing, D1 telemetry, a worker deploy, or a real CloudConvert render — none available in unattended CI.

No owner-gated row was force-closed.

## Owner items

- **Row 21** now has a fresh headless GREEN; only the real roller-side hardware Back-button eyeball
  remains before it can move to CLOSED.
- All other residual legs (rows 22 / 3 / 20 / 123 and Bands A–D) carry the live / regen / real-device /
  CloudConvert / owner-gated verifies already tracked on their rows — they stand for the next desktop run.

## Owed to a desktop run

Nothing shipped → **no post-deploy live-verify owed** this run.

## Overlap check

Prior CI nightly `fe67552f` (2026-10-18) swept rows 105/25/6/8/12; this run swept 21/22/3/20/123 —
no re-touch collision. Register edits only; no version number consumed.
