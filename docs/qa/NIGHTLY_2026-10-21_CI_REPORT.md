# AntCV CI Nightly — 2026-10-21 (GitHub Actions, unattended, Opus 4.8)

Fresh clone on `origin/main` `7af144bf`. `ALLOW_DEPLOY` not `true` → no worker deploys.
Cloud CI has no signed-in session, no live LLM gen, no real-PDF (CloudConvert) render, no second
physical device — so only code-anchored verification and docs/register work are possible here
(CLOUD CAVEATS, `docs/qa/CLOUD_ROUTINE_PROMPT.md`).

## Discipline
- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` → already up to date.
- **Baseline suite:** `node scripts/run-tests.mjs pwa` → **1843 pass / 0 fail / 0 cancelled / 7 todo-area skips not shown** (exit 0).
- **Register integrity:** `node scripts/check-register.mjs` OK before and after (93 ACTIVE rows, 93 detail sections).
- No `pwa/app.js` / `pwa/app.src.js` / `workers/**` edit → no boot-smoke, no cache-bust quintet, no shift claim owed. Docs-only, pushed direct to `main` per CI SAFETY OVERRIDE rule 2.
- NEVER ran `npm run build:app`.

## Band worked — E1 register-staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot)

`node scripts/check-register.mjs --stalest 8` → took the 5 oldest rows, verified each against
**current** code, refreshed `verified:` to 2026-10-21 in both the index and the detail file. Every
residual leg is live/regen/owner/render-gated — nothing shippable in unattended CI.

| row | ID | code re-verified at HEAD `7af144bf` | residual (why not closed) |
|---|---|---|---|
| 27 | `MAIN-RUNT-ORPHAN-SWEEP-001` | all 4 ORPHAN-PREFLIGHT-V3 sidecars loaded by `index.html` (`antcv-orphan-export-preflight.js`, `antcv-orphan-measure-bind.js`, `antcv-package-orphan-apply.js`, `antcv-orphan-cloud-persist-385.js`), 1 ref each | work-style tail truncation / page-3 ghost / ~1.5-page real-PDF verify — need a real render |
| 28 | `NIL-GEN-ADAPTATION-001` | `antcv-profile-access-scrub.js` + `antcv-sidebar-relevance-cut.js` loaded, 1 ref each | CV ~1.5pp gen-level target — regen-gated (rides row 27 orphan work) |
| 29 | `NIL-TARGETED-STATE-STICK-001` | `META-DRIFT-GUARD-002` app.src.js ×2; `277-SEQUENCE-GUARD-001` sidecar ×5; `CL-HYDRATE-EXPORT-GATE-001` docx-client ×3; 277 sidecar loaded | leg C writer-hunt (live setItem probe) + auto-save downgrade belt — needs a signed-in session |
| 96 | `CV-HEADER-BOX-001` | `AntCVHeadBox` roundRect ×1 + `headerBox:` wiring ×1 in `workers/docx-worker/src/index.js` | photo-in-header parity / CV AI-notice→footer / margins / preview parity vs gold docx — owner/live |
| 97 | `DELIVERABLES-3CO-001` | no code leg — pure live-regen + D1 JD-data + owner deliverable | output quality gated on row 95; Aimpoint/Demant JDs unverified in D1 — needs live gen |

No owner-gated row was force-closed; each residual is an owner/live/render step, not a code gap.

**New stalest after the sweep:** rows 95 `CV-POLISH-BATCH-001`, 92
`EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001`, 93 `AUTO-ANALYSE-ON-JD-LOAD-ERROR-001` (all 2026-10-11).
Left untouched rather than date-refreshed without a real check — a desktop/live run should take them next.

## Bands A–D — not advanced (blocked in unattended CI)
- **A1 GEN-BACKGROUND / A2 TAB-ISOLATION:** need a live mobile gen + a second physical device.
- **B1 SO-003 / B2 SO-004:** need a signed-in headless repro with real content.
- **C/D content + model-role:** need live LLM routing, a worker deploy, or a real CloudConvert render.

None available here (CLOUD CAVEATS).

## Owed to a desktop run
- Nothing shipped → **no post-deploy live-verify owed** this run.
- Carried forward: the owner-eyeball / live-gen / real-PDF / second-device steps on rows 27, 28, 29, 96, 97.

## Owner
- No decision required this run. Rows 27/28/29/96/97 all wait on a live/signed-in/second-device step only a desktop or owner run can perform.
