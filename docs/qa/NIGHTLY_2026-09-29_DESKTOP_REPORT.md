# AntCV desktop nightly — 2026-09-29

Routine: `antcv-nightly` (scheduled, unattended). Model: Opus 5. Worktree:
`vigilant-hopper-c2abaa`. Base on entry `07f46d7e`, re-synced mid-run to `5a4d4066`.

**One-line outcome:** the eight "SHIPPED, owner-verify owed" guard rows were attested on the
LIVE deploy for the first time (served + executed + byte-identical), register row 109 CLOSED on
hard green-deploy evidence, row 17's last unmeasured Settings panel measured with a passing
negative control, and one diag's self-inflicted false-RED removed. No product code changed.

---

## Run summary (as filed to `REGISTER_RUNLOG.md`)

**DESKTOP NIGHTLY 2026-09-29 (unattended, Opus 5) — the "SHIPPED, verify owed" backlog attested on the LIVE deploy for the first time; row 109 CLOSED on green deploy evidence; row 17's last unmeasured panel measured; one diag's false-RED removed.** Preflight `routine-preflight.mjs start` → WORKSPACE CLEAN, worked in worktree `vigilant-hopper-c2abaa`. Synced twice (`origin/main` moved mid-run `07f46d7e` → `5a4d4066`; a parallel EXEC-LINEAR/CPH session was shipping and deploying throughout). Baseline and final suite `run-tests.mjs pwa` **1721/1721, 0 fail**; `boot-smoke` clean; `check-register` OK 93/93.

**What this run had that the recent CI runs did not:** a real desktop — chromium present, full network to all four workers (`/health` 200 ×4 on the `karp-gabriel-a` hosts), and the live PWA reachable. What it still lacked: an authed owner session (`~/.antcv/browser-session.json` expired 2026-07-17, `~/.antcv/token` 2026-09-02) and Cloudflare CLI credentials (`wrangler whoami` → `Failed to fetch auth token: 400`; desktop OAuth token expired 2026-08-27, no `CLOUDFLARE_API_TOKEN` set). So live-verify was possible unsigned-in; real LLM gen, D1 reads and local worker deploys were not.

**Band A/B/C/D — 8 rows advanced with LIVE evidence (new capability, not a re-statement).** Rows 38, 39a, 40, 41, 42, 43, 44, 34 had been re-verified repeatedly but always repo-side ("the file exists", "`index.html` has a `<script>`"), which cannot distinguish a live fix from a file on disk that never loads, or from a stale CDN/SW copy under an unbumped `?v`. New `pwa/test/diag-live-guard-sidecars.mjs` asserts, against `antcv.pages.dev`, that each guard was SERVED, that it EXECUTED (global on `window`), and that the served bytes are IDENTICAL to the repo file (EOL-normalized — a Windows checkout's CRLF makes a raw length comparison lie, and the CRLF counts accounted for every byte of difference). **All 9 sidecars PASS at live `1.51.4606-exec-linear-dash`.** Row 39a leg 1 (relay) attested separately: live `/health` `RELAY_VERSION auth-38-subtitle-guard-qual-put` is byte-equal to the in-repo constant whose source carries the 7 downgrade-guard sites. NOT done and unchanged in kind: every remaining leg on these rows needs either a real mobile device (38 A/B, 41 Android #185 repro), an authed live session (40/43/44 click-throughs, 39a downgrade-PUT, 34 preview==export eyeball) or a real LLM gen (42 fresh-gen language check).

**Row 109 DEPLOY-YML-CF-AUTH-BROKEN-001 CLOSED** — the owner rotated the Cloudflare secrets. Four green `deploy.yml` runs on 2026-09-29, and dispatch `36628929136`'s `deploy-worker` job ran wrangler to completion (`Uploaded docx-worker`, `Current Version ID: 08b107f5-2e18-4507-a7d1-4563007a824e`, bindings intact). The day's one red run `36628097053` failed on the DOCX diag `diag-header-navy-invisible.mjs`, not on credentials — it passes locally at HEAD and the next push run was green; recorded so a later sweep does not read it as a relapse. Filed inside the closed row rather than as a new row: the documented desktop `wrangler deploy` FALLBACK is itself dead (token expired 2026-08-27), which is exactly why rows 39 and 89 could not move.

**Row 17 SETTINGS-PERSONAL-STABILIZE-001 — the Advanced panel measured, and an earlier claim corrected.** `diag-settings-panels-probe.mjs` (Personal/Account/Layout) re-run: **0 mutations/6s each, 0 page errors.** ADVANCED had never been measured — that probe anchors on the standard-tier subtab strip and `diag-personal-panel-probe.mjs` clicks Personal only, so the 2026-08-17 desktop report's "Layout/Account/Advanced at rest" line was wrong. New `pwa/test/diag-settings-panel-churn.mjs` takes any subtab: **all four at 0 mutations/8s, 0 page errors**, four distinct panel fingerprints (4121/799/1595/923 chars) proving each really rendered. Two guards against a lying zero, because a wrongly-anchored probe reports a clean 0 exactly like a healthy panel: `--selftest` ticks synthetic churn into the anchored root and must see it (80/80 per tab, observed), and the run fails if the observed root is detached.

**Row 23 NIGHTLY-PREVIEW-BUTTON-AUDIT-001 pass-2 re-run:** 216 buttons — 138 active, 11 ui-only, 53 not-visible/disabled, 14 skipped-dangerous, **0 THROWS, 0 DEAD candidates, 0 page errors**; pass-2 recovery legs recovered 0, so the 53 are structurally not-visible in this seed rather than pass-2 misses. Artifacts `PANEL_BUTTON_AUDIT_2026-09-29.{json,md}`.

**PARITY-DIAG-SOFT-CHECK-HARD-GATE-001 fixed.** `diag-results-preview-export-parity.mjs` exited 1 on a check its own comment called "soft": `dom=0` is the expected artifact of its `step:'editor'` seed (never mounts the Preview tab), established 2026-08-17 and re-triaged from scratch tonight — two runs, two triage cycles. The DOM count is now INFO and the real risk (the `data-antcv-role-results` attribute leaving the bundle) is asserted statically, negative-controlled against a sabotaged copy. The four hard parity guarantees are unchanged and green, which is also row 34's parity evidence.

**Row 39 GEN-MODELROLE-001 — NOT advanced, evidence path unavailable** (honest status, not a refresh): the code and both `wrangler.toml` `MODEL_ROLES` are present and `parseModelRoles` is green in CI, but the owed leg is LIVE — and `/config` on `cv-proxy` does not expose the role map (it reports proxy_url / demo_mode / server_keys / KV bindings only), wrangler is unauthenticated, and the D1 `llm_calls` read needs the same expired credential. Owner action that unblocks it: one `wrangler login`, or expose the parsed role map as an unauthenticated `/config` field.

**Row 110 ANTCV-TOKEN-EXPIRED-2026-09-02-001 CORROBORATED and widened.** The position-discovery routine filed it the same day from the relay side; this run hit it from the verify side and found the expiry is wider than the relay token: `~/.antcv/token` (relay JWT) expired 2026-09-02 AND `~/.antcv/browser-session.json` (the persisted Browser-pane auth map) expired 2026-07-17. That single dead credential is the largest reason ~60 rows below are un-advanceable: every signed-in live-verify needs it. An agent cannot restore it — a password is prohibited and the email code is unreadable to it.

**Everything else: not advanced this run, by capability class, no silent skips.** Owner/live-session-gated (signed-in click-through, real content, real account writes): 6, 8, 12, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 45, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 81, 82, 83, 86, 87, 88, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101 — the expired session is the single blocker for the bulk of these, and re-capturing it needs an owner UI login (a password is prohibited to an agent). Real-second-device-gated: 19, and the remaining leg of 39a. Real-LLM-gen-gated: 2, 3, 14, 42's verify, 54, 56, 59. Worker-credential-gated: 39, 89, 103. Routine-owned (their own schedules): 102, 105, 106, 107, 108. Standing anchors re-run tonight and green: 1, 11, 16, 17, 23 (plus 18's diag set).

**Scope:** test/diag + register only. `pwa/test/**` is not loaded by `index.html` → **no cache-bust, no version consumed, no shift claim, no deploy**; `app.js`/`app.src.js`/workers/islands untouched. No product feature shipped → `FEATURES_REGISTRY.md` deliberately unedited. Commits: `f69e9cf0` (three diags) + the register commit. Report: `docs/qa/NIGHTLY_2026-09-29_DESKTOP_REPORT.md`.

---

## Owner-verify list (what only the owner can close)

1. **Restore the live session** (register row 110) — the single highest-leverage item. One UI login
   on `antcv.pages.dev`, then re-save the `localStorage` auth map to
   `~/.antcv/browser-session.json` and the relay JWT to `~/.antcv/token`. Wiring the
   self-renewing token would stop a 7-day TTL removing the capability every week. Unblocks the
   click-through legs on rows 40, 42, 43, 44, 34, 39a and roughly sixty others.
2. **Row 38 GEN-BACKGROUND-001** — the mobile A/B: set `antcv:gen-resume=1`, start a gen,
   background/lock the phone, return, confirm it auto-resumes fast; then a mid-run reload; then
   compare the output to a flag-off gen. The code is live-attested; only the behaviour on a real
   device is unverified. If clean, the default flip is a one-line sidecar change — but that is a
   separate owner decision and is NOT being proposed on attestation alone.
3. **Row 44 / 43 / 40 click-throughs** — "Download analysis (PDF)" returns the analysis and not the
   CV; a targeted-gen preview shows no "Application:" line bleeding into the first role title;
   changing the Core Competencies row count leaves Selected Outcomes intact.
4. **Row 42** — one fresh targeted generation, checking German is absent and Danish reads B1.
5. **Row 19 / 39a leg 3** — the two-real-device test. Needs a second physical device.

## Owner-decision list

- **`wrangler login` on the desktop** (or a `CLOUDFLARE_API_TOKEN` in the environment). Not
  urgent — `deploy.yml` works again — but there is currently no second deploy path, and rows 39
  (live `MODEL_ROLES` confirm) and 89 (D1 `llm_provider_costs` INSERTs) are blocked on it.
- **Row 39, cheaper alternative:** expose the parsed `MODEL_ROLES` map as a field on the
  unauthenticated `/config` response. It would make the role-routing check verifiable by any
  future run without credentials, instead of permanently owner-gated.

## Evidence index

| artifact | what it shows |
|---|---|
| `pwa/test/diag-live-guard-sidecars.mjs` | live attest, 9/9 served + executed + byte-identical at `1.51.4606` |
| `pwa/test/diag-settings-panel-churn.mjs` | 4/4 Settings subtabs at 0 mutations/8s; `--selftest` 80/80 |
| `docs/qa/PANEL_BUTTON_AUDIT_2026-09-29.{json,md}` | 216 buttons, 0 THROWS, 0 DEAD, 0 page errors |
| `docs/qa/last-browser-qa.json` | live `ANTCV_VERSION` 4606 == repo `TARGET_VERSION` 4606 |
| `gh run view 36628929136` | `deploy-worker` uploaded docx-worker, version `08b107f5` — row 109 closed |

## Explicit non-claims

- No live authed write was performed. The relay downgrade guard was attested by deployed-version
  identity, not by an actual rejected PUT.
- No generation was run, so no content-quality claim is made about any gen row.
- The button audit's `Bundle: 1.51.4246-era` line is derived from the first version string inside
  `app.js`, not the deploy version; it is not evidence of a stale bundle.
- `FEATURES_REGISTRY.md` is untouched on purpose: nothing product-facing shipped.

---

## Desktop cross-check (second antcv-nightly fire, 2026-09-29, Opus 5.5)

A second `antcv-nightly` fired on Gabo-PC after this report existed, so it ran cross-check only. Worktree `routine-antcv-nightly-mun7m6to`, base `df21668a` (live `1.51.4646-linear-length`). No code changed, no version consumed, no claim.

- **Live attest: PASS.** `diag-live-guard-sidecars.mjs`: all 9 sidecars served, executed, content-identical. `browser-qa --only version-live` PASS, `--only sidecars-live` PASS. Live `sw.js` CACHE `antcv-1.51.4646-linear-length` and `app.js?v=1.51.4646-linear-length` equal the repo. `/health` 200 on relay, demo-proxy, cv-proxy, docx-worker (`antcv-docx-worker` and `c2pa-worker` hosts return 404; not in the four-worker set).
- **Tooling defect found:** the routine prompt's `browser-qa.mjs --only version-live,sidecars-live` runs **0/0 checks and exits 0**. `runChecks` matches `only` as one exact id (`scripts/qa-checks.mjs:263`), so the comma list matches nothing. A false green on every nightly that used the prompt form. Fix is owed: accept a comma list, or fail when 0 checks are selected. Not fixed in a cross-check run.
- **E2 Settings churn: PASS.** 0 mutations/8s on Personal/Layout/Account/Advanced, 4 of 4 distinct fingerprints; `--selftest` 80/80 per tab.
- **E3 button audit:** 216 buttons, 0 THROWS, 0 DEAD, 0 page errors. Totals moved from 138 active / 11 ui-only to 134 / 15. The same 216 signatures, with 12 buttons flipping between active and ui-only **in both directions** (8 one way, 4 the other). That is classification timing noise, not a regression. A third run to confirm was not done. The morning artifact was kept; this run's copy was not committed.
- **E4 export/preview parity: OK** (4 hard checks green, `dom=0` INFO as designed).
- **E1 stalest rows:** 96 CV-HEADER-BOX-001 (07-17), 97 DELIVERABLES-3CO-001 (07-18), 95 CV-POLISH-BATCH-001 (07-19), 92 EXPORT-PREVIEW-PAGINATION-DIVERGENCE-001, 93 AUTO-ANALYSE-ON-JD-LOAD-ERROR-001 (07-21). All still owner/live-session gated. `~/.antcv/browser-session.json` is still the expired 07-17 one. Not advanced.
- **Row 110 ANTCV-TOKEN-EXPIRED-2026-09-02-001: owner leg DONE.** The owner re-saved `~/.antcv/token` (preflight `TOKEN OK`, expires 2026-10-06T19:40Z). An authed `GET /api/job-tracker` returns **200**. Relay-backed routines are unblocked. Leg (a), a long-lived routine token or longer TTL, remains open.
