# AntCV CI Nightly — 2026-10-10 (GitHub Actions, unattended, Opus 4.8)

CI/cloud leg: no in-app Browser pane, `ALLOW_DEPLOY=false`. Code changes to
`app.js`/`app.src.js`/`workers/**` go via PR only; docs + registers push direct to main.

## Entry state
- SYNC FIRST clean: `git fetch && git pull --rebase origin main` → already up to date, HEAD `25b90ffc`.
- Baseline: `node scripts/run-tests.mjs pwa` → **1821/1821 pass, 0 fail**.
- `check-register.mjs` → OK, **89 ACTIVE** on entry.
- Capability: `ALLOW_DEPLOY=false`; `gh` present as `github-actions[bot]`; **chromium-headless-shell
  installed this run** and egress to `antcv.pages.dev` works → real headless + live (unauthenticated)
  prod capability. No signed-in Browser pane → signed-in / real-LLM-gen / real-device verifies remain
  owed to a desktop/owner run.

## Work this run — Band E (E1 register staleness sweep)

No priority-band row had un-shipped CI-verifiable code (same as the 2026-10-09 CI run), so the
productive slot was the backlog-reconcile staleness sweep — the 8 stalest ACTIVE rows, each VERIFIED
against the CURRENT code + its targeted test, then refreshed. No row was closeable (every residual is
owner visual / real-model / real-device, which CI cannot do) — so all were kept ACTIVE with today's
date and a fresh E1 note.

### Live attestation (corroborates the desktop + CI 2026-10-09 runs)
`node pwa/test/diag-live-guard-sidecars.mjs` → **PASS 9/9** against prod `1.51.4873-linear-enriched`:
all guard sidecars for rows 34/38/39a/40/41/42/43/44 **served, executed (global on window),
byte-identical to the repo file** (3 boot 401s expected with no auth session).

### E1 — stalest 5 (rows 33/24/26/30/32, all 2026-09-28) → refreshed to 2026-10-10, kept ACTIVE
| Row | ID | Verify this run | Residual (why still ACTIVE) |
|---|---|---|---|
| 33 | WHY-RULE-EXPORT-PARITY-001 | `antcv:nameLineAlign` (4) + `headline_align`/`headlineAlign` intact in `antcv-docx-client.js`; `export-align-parity.test.mjs` 6/6 | signed-in export eyeball only — **re-recommended to owner for CLOSED** |
| 24 | ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 | scoped-wipe markers (`/auth/`,`api/prefs`, 7 hits) intact in `antcv-auth.js`; `auth-401-wipe-scope.test.mjs` 5/5 | owner three-button click-through after Hard Refresh (cloud can't sign in) |
| 26 | TOOLS-SIDEBAR-COMPRESS-001 | belt sidecar `antcv-sidebar-compact-001.js` present + `sidebar_compact` in `gold-rules.json`; `sidebar-compact.test.mjs` 8/8 | owner visual eyeball of the unsolicited export sidebar |
| 30 | LLM-IMAGE-ROUTING-001 | `VISION_BLIND`/`messagesHaveImages`/`filterVisionBlind` in BOTH `workers/proxy/src/multi-llm.js` + `workers/demo-proxy/src/multi-llm.js`; `image-routing-ee.test.mjs` 3/3 | adequacy-gate extension to vision calls = nice-to-have |
| 32 | CL-PLATFORM-SIGNALS-001 | `__platformRule` detector + injection (3 hits) in `app.src.js`; `cl-platform-signals.test.mjs` 10/10 | regen-gated — needs a signed-in platform-class JD gen to eyeball CL tone |

### E1 — next tier (rows 27/28/29, all 2026-09-29) → refreshed to 2026-10-10, kept ACTIVE
| Row | ID | Verify this run | Residual |
|---|---|---|---|
| 27 | MAIN-RUNT-ORPHAN-SWEEP-001 | all four ORPHAN-PREFLIGHT-V3 sidecars loaded in `index.html` (1 ref each) | (a) work-style tail truncation, (b) page-3 ghost, (c) ~1.5pp real-PDF verify — need a real render/regen |
| 28 | NIL-GEN-ADAPTATION-001 | `antcv-profile-access-scrub.js` + `antcv-sidebar-relevance-cut.js` loaded (1 ref each) | CV ~1.5pp gen-level target — regen-gated (fresh live NIL gen + export) |
| 29 | NIL-TARGETED-STATE-STICK-001 | `META-DRIFT-GUARD-002` (2) / `277-SEQUENCE-GUARD-001` sidecar (5) / `CL-HYDRATE-EXPORT-GATE-001` docx-client (3) | leg C live setItem writer-hunt + auto-save downgrade belt — needs a signed-in session |

## Gates before push
- Suite 1821/1821; `check-register.mjs` OK → **89 ACTIVE / 89 detail** (unchanged — no rows added/closed).
- Docs + registers only: no `pwa/` asset changed → no cache-bust quintet, no version consumed, no
  shift claim needed (SYNC FIRST still done).
- No app.js / app.src.js / worker edit → no PR owed, no boot-smoke needed, no worker deploy.

## Owed to a desktop / owner run
1. Rows 33/24/26/30/32 owner-gated residuals: signed-in export eyeball (33 — recommend CLOSE),
   three analytics buttons after Hard Refresh (24), unsolicited export sidebar eyeball (26), vision
   adequacy-gate nice-to-have (30), platform-class JD gen eyeball (32).
2. Rows 27/28/29: a real NIL-targeted generation + PDF export (CI has no models / signed-in render).
3. Standing: the live/regen/real-device verifies the desktop 2026-10-09 run lists for rows
   38/39a/40/41/42/43/44/34/39 and row 123's init write-back decision — all need a signed-in session.

## Post-deploy live-verify owed
None owed from this run — **no PWA change was shipped** (docs/registers only).

---
_Run by the CI nightly under the CI SAFETY OVERRIDE: synced first, never force-pushed, shipped no
app.js/worker code, left no worker deploy. Outcome recorded in the registers + this report and pushed._
