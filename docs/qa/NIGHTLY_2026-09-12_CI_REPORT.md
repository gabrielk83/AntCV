# AntCV nightly — CI run 2026-09-12 (GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions, no signed-in browser, no real LLM, no real-device, `ALLOW_DEPLOY=false`.
Authoritative plan: `docs/qa/CLOUD_ROUTINE_PROMPT.md` → `docs/qa/NIGHTLY_2026-07-05_PROMPT.md`
(Band E1) + `docs/qa/OPEN_REGISTER.md`.

## Entry state
- `git fetch origin && git pull --rebase origin main` → already up to date (HEAD `ed97603e`); main GREEN.
- `node scripts/run-tests.mjs pwa` → **1715/1715** pass.
- `node scripts/check-register.mjs` → OK (93 ACTIVE / 93 detail).

## Band selection
Bands A–D each need a capability this CI environment lacks:
- **A1/A2** (gen-memo A/B, tab/device isolation) — real mobile gen + signed-in second device.
- **B1/B2** (SO-003 data-loss, SO-004 crash) — B1 needs a real editor drive; B2 has no headless repro.
- **C1–C3** (langfab, CA-006, analysis-print) — code shipped; owner-verify is a fresh real gen.
- **D1/D2** (perf profile, model-role live) — real render / `ALLOW_DEPLOY=false`.

→ Worked **Band E1 — register staleness sweep**. After the 09-11 run refreshed the twelve
`2026-07-05` rows, the next-stalest cohort is the **2026-07-06/07 KOMBIT live-session batch**:
row 39 (07-06) plus rows 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 64 (07-07). Swept all twelve
verify-first against current HEAD.

## Verify-first results — two genuine ADVANCES, ten evidence-backed refreshes

| Row | ID | Finding | Action |
|---|---|---|---|
| 53 | CROSS-APP-EXPORT-CONTAMINATION-001 | Register said "not started" but leg (a) P0 is SHIPPED — scope-guard sidecar `antcv-export-app-scope-guard.js` (1.51.639, `e8e77577`) → reworked into MIRROR-LOAD-001 (1.51.680, `42a1d853`; marker ×3 in `app.src.js`; scope-guard sidecar removed from `index.html`, now a retired dead file). Legs b–f still open. | **ADVANCE** + refresh |
| 61 | LINE-DISTRIBUTION-GUIDELINES-001 | Guidelines partly baked into code under `LINE-DISTRIBUTION-001`: gen fill-band via `antcv-bullet-targets.js goldDensity()`/`gold-rules.json` (1.51.2921, `210fdce3`) + bidirectional per-row Fit-it `window.__antcvRowFit` (1.51.2980, `dfa3fa55`). | **ADVANCE** + refresh |
| 39 | GEN-MODELROLE-001 | `MODEL_ROLES` still in both `wrangler.toml:50`; live map `{writer:anthropic, supervisor:mistral, coherence:openai}` — coherence moved `anthropic`→`openai` (deliberate, per `app.src.js:1384` fit-quality note). Sources still parse it. Role-split telemetry unconfirmable in CI. | refresh (note drift) |
| 54 | GEN-JD-TAILOR-KERNEL-RECALL-001 | No markers, no commits → still not started. | refresh |
| 55 | TARGETED-OUTPUT-FURNITURE-001 | No markers → still not started (all 6 furniture legs hand-fixed only). | refresh |
| 56 | GEN-JD-RELEVANCE-TRIM-001 | No markers → still not started. | refresh |
| 57 | TARGETED-CV-POLISH-RULES-001 | Hand-applied rules; line-fill points overlap row 61's shipped work; content/furniture rules still generator-baseline TODOs. | refresh |
| 58 | EXPORT-SETTLED-001 | MOB-008 CSS overflow rules + `diag-mob008-panel-overflow.mjs` intact; MOB-009 folded into row 59A; other MOB items open. | refresh |
| 59 | GENERATOR-BASELINE-001 | Leg A advanced by LINE-DISTRIBUTION-001 (row 61); leg B fixed in tooling; leg C renderer desktop-only. | refresh (note advance) |
| 60 | PANEL-CONTROLS-2026-07-07 | Both control sidecars (`antcv-header-rule-control.js`, `antcv-cl-slogan-control.js`) on disk; diagnosed; live-DOM patch pending. | refresh |
| 63 | ANALYSIS-STALE-ON-APP-LOAD-001 | 1.51.196 intact. FLAG: mount-hydrate at `app.src.js:18763` now carries an unsolicited-guard condition (later refinement over the "overwrite value-or-null" note). | refresh (flag for live-verify) |
| 64 | ANALYSIS-EXPORT-DROPS-FILLED-ANSWERS-001 | 1.51.196/198 helpers `gapStateKey`/`readGapState` (×6) + guard `diag-new2-gap-detail-export.mjs` intact. | refresh |

## Actions taken (docs/registers only — no code, no cache-bust, no version consumed, no shift claim)
- `OPEN_REGISTER.md` — index `verified` dates for rows 39, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 64 → **2026-09-12**; rows 39/53/61 scope lines annotated with the advance/drift.
- `REGISTER_ACTIVE_DETAIL.md` — each of the twelve rows carries a dated 2026-09-12 verify note with file:line / commit evidence.
- `REGISTER_RUNLOG.md` — run summary prepended (newest first).
- `check-register.mjs` → OK, **93 ACTIVE / 93 detail**. Full suite re-run **1715/1715**.

## OWED to a desktop / owner run (CI cannot do here)
- **Row 53 legs b–f** — content/gen fixes (CL target-lang lead-ins, `[placeholder]` scrub, DA diacritics in CL prose, CV partial-lang residue, brand-fit-per-app); a diagnostic-first session with a real gen.
- **Row 63** — desktop live-verify that a targeted→targeted app switch still clears stale rationale, given the mount-hydrate now carries an unsolicited-guard condition.
- **Row 64** — fill a gap detail live → confirm it exports.
- **Row 39** — role-split D1 telemetry needs role-tagged logging (owner-gated) or an authed supervisor-tagged curl; proxy/demo-proxy deploy verify (`ALLOW_DEPLOY=false`).
- **Rows 54/55/56/57/60** — gen-quality (recall/trim/furniture/polish) needs a real gen; row 60 needs live-DOM capture + patch (auto-deploy prod, live repro required before ship).
- No PWA change shipped this run → no post-deploy live-verify owed.

## No owner decision required this run.
Nothing was closed (every candidate remains gated on a live/regen/deploy/device verify CI cannot perform); two rows were correctly advanced to reflect shipped code the register had lagged.
