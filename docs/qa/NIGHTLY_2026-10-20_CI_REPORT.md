# AntCV CI nightly — 2026-10-20 (GitHub Actions, unattended)

Runner: GitHub Actions, unattended. Model: Opus 4.8. Fresh clone on `origin/main` `69824677`.
`ALLOW_DEPLOY=false`. No in-app Browser pane, no signed-in session, no real LLM gen, no second
physical device — the CLOUD/CI CAVEATS apply (see `docs/qa/CLOUD_ROUTINE_PROMPT.md`).

## Outcome in one line

Band E1 register-staleness sweep: the 5 stalest open rows (all `verified: 2026-10-10`) were
re-verified against current HEAD, confirmed code-complete-or-owner-gated, and date-refreshed to
2026-10-20. No code shipped — every residual leg is live / regen / owner-gated and unattended CI
cannot drive it. Suite 1837/1837 green; register OK before and after.

## Discipline

- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` → already up to date. No force-push.
- **Baseline:** `node scripts/run-tests.mjs pwa` → **1837 pass / 0 fail**. `node scripts/check-register.mjs` OK (92 ACTIVE rows) before and after the edits.
- No `pwa/app.js`, `pwa/app.src.js`, or `workers/**` edit → no boot-smoke, no cache-bust quintet, no shift claim owed, no `npm run build:app` (never run).
- `ALLOW_DEPLOY=false` → no worker deploy attempted.
- Docs/register-only change → pushed directly to `main` per the CI safety override (#2).

## Band E1 — staleness sweep (the work this run did)

Rows taken from `node scripts/check-register.mjs --stalest 5` (never from table position). All five
are code-anchored; each was confirmed intact in CURRENT code and its guard test re-run (the 5
targeted guard tests also ran clean standalone: 32/32). Each kept ACTIVE on its existing owner/live
gate; `verified:` set to 2026-10-20 in both the index and the detail section.

| Row | ID | Re-verified evidence | Why still OPEN (not closed) |
|---|---|---|---|
| 33 | `WHY-RULE-EXPORT-PARITY-001` | `antcv:nameLineAlign` + `headline_align`/`headlineAlign` markers in `antcv-docx-client.js` + `docx-worker/src/index.js`; `export-align-parity.test.mjs` GREEN | CODE-COMPLETE — only a signed-in export eyeball remains. **Recommended to owner for CLOSED.** |
| 24 | `ANALYTICS-BUTTONS-SESSION-TIMEOUT-001` | scoped-wipe markers (`/auth/`, `api/prefs`) in `antcv-auth.js`; `auth-401-wipe-scope.test.mjs` GREEN | Client + server both fixed & live-verified earlier; only the owner three-button click-through after Hard Refresh remains (cloud can't sign in). |
| 26 | `TOOLS-SIDEBAR-COMPRESS-001` | belt sidecar `antcv-sidebar-compact-001.js` present; `sidebar_compact` rule in `gold-rules.json`; `sidebar-compact.test.mjs` GREEN | Deterministic trim belt done; owner visual eyeball of the unsolicited export sidebar + the separate SIDEBAR-PACKING token-order belt remain. |
| 30 | `LLM-IMAGE-ROUTING-001` | `VISION_BLIND`/`messagesHaveImages`/`filterVisionBlind` in BOTH `workers/proxy` + `workers/demo-proxy` `multi-llm.js`; `image-routing-ee.test.mjs` GREEN | CODE-COMPLETE — only the explicitly-optional adequacy-gate extension to vision calls remains. **Recommended to owner for CLOSED.** |
| 32 | `CL-PLATFORM-SIGNALS-001` | `__platformRule` (src) / minified `__pr` (app.js) both-bundle mirror; `cl-platform-signals.test.mjs` GREEN | Rule wired both bundles; regen-gated — needs a signed-in platform-class JD gen to eyeball the CL tone (owner, non-code). |

No owner-gated row was force-closed: each residual is an owner-eyeball / live-gen / live-export
step, not a code gap, and the established precedent (CI nightlies 09-08 → 10-19) is to refresh +
recommend, not to close unattended.

## Bands A–D — not advanced (blocked in unattended CI)

- **A1 GEN-BACKGROUND / A2 TAB-DEVICE ISOLATION** — need a live mobile gen and a second physical device.
- **B1 SO-003 / B2 SO-004** — need a signed-in headless repro with real content.
- **C/D content + perf + model-role** — need live LLM routing, a worker deploy, or a real CloudConvert render.

None are available here (no sign-in, `ALLOW_DEPLOY=false`, no browser pane).

## New stalest after the sweep (hand-off to the next DESKTOP / live run)

Rows **27 `MAIN-RUNT-ORPHAN-SWEEP-001`**, **28 `NIL-GEN-ADAPTATION-001`**, **29
`NIL-TARGETED-STATE-STICK-001`** (all `2026-10-10`). Left untouched rather than date-refreshed
without a real check: their remaining legs are real-LLM-gen / second-device / Android-#185 live
repro, which only a desktop or live-capable run can honestly verify. The next sweep should take
these three.

## Owner items carried forward

- **Row 33 + Row 30:** code-complete, recommended for CLOSED — needs one owner confirmation (a signed-in export eyeball / accepting the optional adequacy-gate as out of scope).
- **Row 24:** press the three Settings → Analytics buttons after a Hard Refresh; expect a download / summary alert and NO app restart.
- **Row 26:** eyeball the unsolicited export TOOLS & METHODS sidebar for the gold Instruments/Lab strings.
- **Row 32:** regen a hardware-platform JD CL and eyeball the platform tone.
- **Rows 27/28/29:** next-stalest, need a desktop/live run (gen / device).

## Owed to a desktop run

Nothing shipped this run → **no post-deploy live-verify owed**. The owner-eyeball / live-gen /
second-device steps above carry forward unchanged.

---

_Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>_
