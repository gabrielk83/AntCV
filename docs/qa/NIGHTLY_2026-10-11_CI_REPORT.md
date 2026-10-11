# AntCV CI nightly — 2026-10-11 (GitHub Actions, unattended, Opus 4.8)

**Outcome:** Band-E E1 register staleness sweep. The 6 stalest register rows (all last swept
2026-09-30) re-verified against current code and refreshed to 2026-10-11. No code shipped — every
open row is blocked on a live/device/owner/real-model gate this CI environment cannot clear.

## Environment / constraints

- `ALLOW_DEPLOY=false` — no worker deploys.
- No in-app Browser pane, no signed-in session, no real LLM → Bands A–D (mobile/tab isolation,
  data-loss/crash repro, content-correctness regen, perf profile) cannot be advanced here.
- SYNC FIRST clean: `git fetch && git pull --rebase origin main` already up to date, HEAD
  `bfc584d2`.

## Gates

- Suite: `node scripts/run-tests.mjs pwa` → **1821/1821 pass, 0 fail, 0 skipped**.
- `node scripts/check-register.mjs` → OK (89 ACTIVE / 89 detail).
- Docs/registers only → no cache-bust quintet, no version number consumed, no shift claim, no PR.

## Band E — E1 staleness sweep

`node scripts/check-register.mjs --stalest 8` returned a cohort of six rows all last swept
2026-09-30 by the prior CI nightly. Because `workers/docx-worker/src/index.js` has changed since
(EXPORT-PAGE-BUDGET-001, MAIN-LIST-PAGE-SEGMENTS-001, linear theme tables, shorter header band —
commits `e69e15c6` … `a4027217`), the two worker-anchored rows got a genuine re-check against the
new code, not a date bump.

| Row | ID | Re-verify finding (HEAD `bfc584d2`) | Status |
|---|---|---|---|
| 96 | CV-HEADER-BOX-001 | `<v:roundrect id="AntCVHeadBox">` survives at `index.js` ~23961; `headerBox: style._cph && !(cv&&linear)?{…}:null` wiring ~24770. Mechanism intact through the export rework. | ACTIVE — live/gold-docx export parity owed |
| 92 | EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001 | Two-map split `sidebarPages`/`mainPages` = `trimTrailingEmptyPages(splitChildrenByPage(…))` ~25111-25112, `numPages=Math.max(…)` ~25113, trailing-empty trim + last-content floor ~25117/25131-25132 all survive. | ACTIVE — needs owner's original overflowing app reloaded |
| 95 | CV-POLISH-BATCH-001 | Strategic-Expertise cell caps still enforced in the gen prompt (`app.src.js` ~3834, ~4086, "never let that cell wrap"). Legs b–e render/kernel/regen-gated. | ACTIVE — real-model regen owed |
| 93 | AUTO-ANALYSE-ON-JD-LOAD-ERROR-001 | Sidecar `antcv-analysis-panel-jd-block-356.js` still loaded (1 ref in index.html); AUTO-ANALYSE-ON-JD-LOAD-001 (~794) + OPEN-ANALYSIS-AUTORUN-001 fingerprint (~86) + slow-poll (~895) intact. No `__errTrap` in current code (transient never captured). | ACTIVE — owner-repro gated |
| 114 | TELEMETRY-BGJOB-GAP-001 | Gap CONFIRMED still open: only `insertLlmCall` (`access-relay/src/telemetry.js` ~197) writes `llm_calls`; `proxy/src` has no writer; `antcv-gen-job-client.js` still posts `/job/*` with no telemetry. | ACTIVE — owner design call owed |
| 97 | DELIVERABLES-3CO-001 | No code leg — pure live-regen + D1 JD check + owner deliverable, gated on row 95 + v5 CL. | ACTIVE — owner/live |

All six detail sections in `REGISTER_ACTIVE_DETAIL.md` carry a dated 2026-10-11 note; the index
dates in `OPEN_REGISTER.md` advanced 2026-09-30 → 2026-10-11.

## Bands A–D

Not advanced. Each open row is blocked on a capability absent in CI (real mobile device, signed-in
session, real LLM generation, owner decision, or a worker deploy with `ALLOW_DEPLOY=false`). No
speculative fixes pushed — owner hard rule "an end result, not a brickable mid-product".

## Owed to a desktop / owner run

- Row 96 — live export vs the gold `1017_Ibsen_Photonics_CV_FINAL_v4.docx`.
- Rows 97, 95 — a real-model targeted regen (CV+CL) to settle the render/quality legs.
- Row 92 — reload the owner's original overflowing (full REGULATORY CONTEXT) application to reproduce.
- Row 93 — re-arm the error trap on a signed-in device and have the owner reproduce.
- Row 114 — owner design call: proxy `gen-job.js` posts per-section telemetry, or the job client
  emits per-section events (the latter also covers `gen-runner.py`).

**Post-deploy live-verify owed:** none — no PWA or worker change shipped this run.

## Registers touched

- `docs/qa/OPEN_REGISTER.md` — index dates for rows 96/97/95/92/93/114 → 2026-10-11.
- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — dated re-verify note prepended to each of the six rows.
- `docs/qa/REGISTER_RUNLOG.md` — run summary at top.
- No `ACTIVE_BUGS.md` / `FEATURES_REGISTRY.md` entry — no code fix, no feature shipped.
