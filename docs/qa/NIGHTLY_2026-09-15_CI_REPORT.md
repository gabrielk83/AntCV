# AntCV CI Nightly — 2026-09-15 (GitHub Actions, unattended, Opus 4.8)

Repo `gabrielk83/AntCV`, fresh isolated clone. `ALLOW_DEPLOY=false`. No signed-in browser,
no real LLM gen, no real device, no CloudConvert render, no worker deploy. Docs/registers only.

## Entry state
- `git fetch origin && git pull --rebase origin main` — already up to date, HEAD `29636155`.
- Suite `node scripts/run-tests.mjs pwa` = **1715/1715** pass, 0 fail.
- Main GREEN.

## Plan followed
Authoritative live plan per `docs/qa/CLOUD_ROUTINE_PROMPT.md` → newest dated prompt
`docs/qa/NIGHTLY_2026-07-05_PROMPT.md` (Band E1 register staleness sweep) + `OPEN_REGISTER.md`.
Bands A–D each require a capability CI lacks (live-verify, real LLM gen, real device, real
CloudConvert PDF render, deploy) → per owner hard rule "an end result, not a brickable
mid-product", no speculative app.js/worker surgery. Worked **Band E1** — the now-stalest cohort
(the 2026-07-17→29 desktop-session batch, ~48-60 days stale, oldest after the 09-14 run bumped
the 07-13 batch).

## CONFIRMED against current code + advanced to 2026-09-15 (6 rows)
Each has a present code marker AND a green test — no register-vs-code lag.

| Row | ID | Evidence on HEAD |
|---|---|---|
| 98 | BYOK-COST-AUDIT-001 | `total_cost_usd_est` in both `workers/proxy/src/byok-qualify.js` + `workers/demo-proxy` mirror; the two src copies byte-identical (`diff -q`); `byok-cost-audit.test.mjs` present both worker test dirs, green. |
| 99 | REG-GROUP-FOLD-NAMED-001 | `NAMED_FOLD` in `pwa/antcv-dup-group-merge.js`; `dup-group-merge.test.mjs` green. Owner "sidebar dancing" thread resolution still unconfirmed (owner-check, not a code regression). |
| 100 | GRAB-ZONE-DISMISS-THRESHOLD-001 | Both legs test-locked green (`grab-zone-dismiss-threshold.test.mjs`: old-28px-no-dismiss + 40-60px-graze-no-dismiss); `antcv-panel-grab-zone` in both bundles; SCROLL-FORWARD comment expectedly stripped from minified `app.js`. Live-device owner-owed. |
| 101 | ZOOM-FLOOR-001 | `0.1` floor present in both `app.src.js` + `app.js` mirror (button + pinch); `zoom-floor.test.mjs` 6 assertions green. |
| 31 | META-STATE-CORRUPTION-002 | `META-DRIFT-GUARD-002` ×2 + `META-DOWNGRADE-GUARD-003` ×2 (both bundles); both meta-guard tests green. Live-poisoned-row repair owner-gated. |
| 19 | JD-SCOPE-OCC2-GUARD-001 | `shouldAdoptCloudPointer` ×4 across pwa sidecars; `jd-scope-isolation.test.mjs` green. Two-real-device leg owner-gated. |

## Verify-result recorded, NOT advanced (5 rows — no CI capability to confirm against code)
Honest: these need a capability CI lacks, so their `verified:` date is left unchanged.

| Row | ID | Why blocked in CI |
|---|---|---|
| 96 | CV-HEADER-BOX-001 | Worker header-box composition + preview parity — needs live regen + worker deploy. |
| 97 | DELIVERABLES-3CO-001 | 3-company CV+CL regen — needs live LLM gen. |
| 95 | CV-POLISH-BATCH-001 | 5 render-gated legs — each needs a live regen to verify. |
| 92 | EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001 | Dormant; needs the ORIGINAL overflowing content reloaded. Worker `index.js` last touched 2026-08-04 (SIGNOFF-BRAND-COLOR-001, unrelated to the split logic) — no regression signal. |
| 93 | AUTO-ANALYSE-ON-JD-LOAD-ERROR-001 | Transient, never captured — needs owner repro. |

## Verification
- No code changed → no cache-bust quintet, no version consumed, no shift claim needed.
- `node scripts/check-register.mjs` OK after the edits.
- Full suite RE-RUN after register edits = **1715/1715** (09-08 lesson: never push register
  edits on a stale baseline).
- No PWA change shipped → **no post-deploy live-verify owed** this run.

## OWED to a desktop / owner run
- Rows 95/96/97: live LLM regen + worker header composition/deploy.
- Row 92: reload the original overflowing content (full REGULATORY CONTEXT) to reproduce.
- Row 93: owner reproduces the auto-analyse-on-JD-load error with the re-armed trap.
- Rows 19/31/100: owner live-device / live-poisoned-row legs (not fakeable headlessly).
- Row 99: owner check whether the "sidebar dancing" symptom recurred.

## Owner-decision / owner-gated
None newly raised. All owner-gated legs above are pre-existing.
