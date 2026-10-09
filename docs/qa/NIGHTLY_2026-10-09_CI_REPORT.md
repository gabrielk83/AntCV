# AntCV CI Nightly — 2026-10-09 (GitHub Actions, unattended, Opus 4.8)

Second run of the day (the desktop antcv-nightly + job-tracker nightly already ran 2026-10-09).
This is the cloud/CI leg: no in-app Browser pane, `ALLOW_DEPLOY=false`, code changes to
`app.js`/`app.src.js`/`workers/**` go via PR only. Docs + registers push direct to main.

## Entry state
- SYNC FIRST clean: `git fetch && git pull --rebase origin main` → already up to date, HEAD `d5bda7eb`.
- Baseline: `node scripts/run-tests.mjs pwa` → **1821/1821 pass, 0 fail**.
- `check-register.mjs` → OK, 88 ACTIVE on entry.
- Capability note: `ALLOW_DEPLOY=false`; owner token present; **chromium-headless-shell installed
  this run**, and network egress to `antcv.pages.dev` works — so this run had real headless + live
  (unauthenticated) prod capability. It does NOT have the desktop's signed-in Browser pane, so
  signed-in / real-LLM-gen / real-device verifies remain owed to a desktop/owner run.

## Work this run (Band E first, per the live plan; no priority-band row had un-shipped CI-verifiable code)

### Live attestation (corroborates the desktop 2026-10-09 run)
`node pwa/test/diag-live-guard-sidecars.mjs` → **PASS 9/9** against prod `1.51.4873-linear-enriched`:
all guard sidecars for rows 34, 38, 39a, 40, 41, 42, 43, 44 **served, executed (global on window),
byte-identical to the repo file** (3 boot 401s expected with no auth session). Same evidence the
desktop nightly produces; no row date changed (desktop already dated them 2026-10-09).

### E1 — register staleness sweep (5 stalest, all 2026-09-27/28) → all refreshed to 2026-10-09, kept ACTIVE
| Row | ID | Verify this run | Residual (why still ACTIVE) |
|---|---|---|---|
| 6 | BANNED-WORDS-MERGE-001 | both kill-switches `antcv:keep-native-banned`+`antcv:no-kernel-chain` in `antcv-data-importer.js`, island `banned_*` writer present; suite green | owner eyeball of merged UI + 6-loader-type run (owner-gated) |
| 8 | KERNEL-V2-READER-001 | `kernel-v2-reader.test.mjs` 5/5; `antcv:ingestedKernel` reader intact both bundles | bullets-path v2 migration, es/zh tier (real models), §6 docx parity (owner) |
| 12 | AI-NOTICE-LEFT-CLOUDCONVERT-001 | `ai-notice-position.test.mjs` 3/3; page-relative margin encoding unchanged in docx-worker | lingers only on 3 SEPARATE docx-baseline tests — recommend CLOSE + re-file those |
| 21 | SETTINGS-ROLLER-RESET-001 | `diag-settings-history-guard.mjs` RE-RUN GREEN **headless** (guarded no-reload + kill-switch control reproduces the reset) | owner live-verify on real roller-side hardware Back button |
| 22 | CL-SLOGAN-RICHCONTENT-001 | sidecar `antcv-cl-slogan-element.js` loaded + kill-switch present; suite green | phase 2 (real `sections.cl` rich_block) genuine open work, spec-before-splice, owner-gated |

### NEW row 123 — PKG-ID-PERSIST-MIGRATE-001 (register-escape + status reconcile)
`node scripts/browser-qa.mjs --only palette-mix` FAILS live on prod `1.51.4873` (stable, run twice):
`localStorage.stylePackage` stays orphan `"scandinavian"` after a local-seed reload.

- **Render is FIXED** — render-time `__pkgNorm` (app.src.js def 16228, read at 19313 etc.) resolves
  the orphan: `body[data-package]=copenhagen-modern`, tone `nordic-minimal`. No user-facing "black mix".
- **Persisted-id self-migration is INCOMPLETE** — the only `set("stylePackage", __pkgNorm())`
  write-backs are on the cloud-restore path (17609) and a restore-like path (23451); there is NO
  boot/init write-back, so a locally-persisted orphan never cloud-round-tripped stays orphan. This is
  exactly the case the `palette-mix` check seeds.
- **Register state was contradictory and the ticket was untracked:** PACKAGE-PALETTE-MIX-001 had no
  row in any of the four register files, while FEATURES_REGISTRY carried it both "still OPEN" and
  "CLOSED ... closes the root" (APPJS-ID-SCHEME-UNIFY), and ACTIVE_BUGS marked it "FIXED✓". All three
  reconciled this run to point at row 123.
- **Severity LOW** (render always correct while every read path normalizes — they do).
  **REMAINING, owner-gated (app.js init → surgical mirror, not done unattended):** add an init-time
  `set("stylePackage", __pkgNorm(get))` write-back so the stored id self-cleans on first boot, then
  re-green the `palette-mix` gate.

### Not filed as a bug (verified non-finding)
`browser-qa` `mobile-panel-zoom` FAIL → `{found:false, note:"Brand fit control not found — selector
or app state changed"}`. This is the check's own anticipated ambiguity: a persona-only seed does not
reach the generate-options cluster on prod unauthenticated, so the "Brand fit" text is absent. Not a
confirmed product regression — MOBILE-PANEL-ZOOM-001 itself is CLOSED (1.51.140, live-verified S24
Ultra). No row filed; noted here so the next run does not re-chase it.

## Gates before push
- Suite 1821/1821; `check-register.mjs` OK → **89 ACTIVE / 89 detail** (was 88, +row 123).
- Docs + registers only: no `pwa/` asset changed → no cache-bust quintet, no version number
  consumed, no shift claim needed (SYNC FIRST still done).
- No app.js / app.src.js / worker edit → no PR owed, no boot-smoke needed, no worker deploy.

## Owed to a desktop / owner run
1. Rows 6/8/12/21/22 owner-gated residuals: merged banned-words UI eyeball + 6-loader run (6);
   es/zh real-model tier + §6 docx parity (8); 3 docx-baseline tests — or CLOSE row 12 and re-file
   them (12); real roller-side hardware Back-button live-verify (21); CL slogan phase-2 spec (22).
2. Row 123 PKG-ID-PERSIST-MIGRATE-001: owner decision on the init-time write-back + re-green the
   `palette-mix` gate (low priority).
3. Standing: the live/regen/real-device verifies the desktop 2026-10-09 run already lists for rows
   38/39a/40/41/42/43/44/34/39 and the Band-A A1 default-flip proposal — all need a signed-in session.

## Post-deploy live-verify owed
None owed from this run — **no PWA change was shipped** (docs/registers only).

---
_Run by the CI nightly under the CI SAFETY OVERRIDE: synced first, never force-pushed, shipped no
app.js/worker code, left no worker deploy. Outcome recorded in the registers + this report and pushed._
