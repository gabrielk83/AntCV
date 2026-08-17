# AntCV Nightly — 2026-08-17 (desktop scheduled task, Opus 4.8, worktree-isolated)

**Outcome: verify + attest. NO code shipped, no PR, no deploy. Live-verification broadly BLOCKED (expired app token + invalidated Cloudflare connector + no physical device). One new test-infra finding filed.**

## Preflight / sync
- `routine-preflight.mjs start` → **WORKSPACE DIRTY (exit 3)** in the main clone (owner/other-session WIP: `docs/qa/PANEL_BUTTON_AUDIT_2026-07-31.*` + `…08-02.*`, plus a fresh `…08-17.json` from tonight's audit run). Did NOT edit/rebase the main clone.
- Worked in the isolated worktree `vigilant-hopper-c2abaa` (branch `claude/pensive-hypatia-506564`), which was already clean and at `origin/main` HEAD.
- `git fetch origin` clean. HEAD `866bc92` == `origin/main` (release 1.51.4226–1.51.4245). Current version **1.51.4226-globalise-v3**.

## Live-access status (the gating constraint tonight)
- **App token DEAD** — `~/.antcv/token` mtime 2026-08-07 (7-day JWT, expired 2026-08-14). Same `ANTCV-TOKEN-EXPIRED-2026-08-14-001` as the last several routines. Blocks every relay/gen/job-tracker AUTH call.
- **Cloudflare D1 MCP connector auth INVALIDATED** — `d1_databases_list` → "connection to this connector was invalidated." Blocks the D2 GEN-MODELROLE live D1 routing check.
- **No physical second device** — blocks the two-real-device leg.
- Net: anything needing live models, live relay, live D1, or a real device could not be verified tonight. Everything below is browser-independent / headless against the current bundle.

## BAND A — Mobile & Tab isolation (P0): VERIFY-FIRST, no re-implement
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** sidecars present + wired + tested on current HEAD. `pwa/antcv-gen-memo.js` (1 `<script>` in index.html), `pwa/antcv-gen-job-client.js` present; default confirmed **OFF / opt-in** (`localStorage.getItem('antcv:gen-resume') === '1'`). `pwa/test/unit/gen-memo.test.mjs` green in the 1570 suite. **Live mobile A/B + flip-default proposal = BLOCKED** (needs a real mobile gen; gen needs live models = dead token). Not proposing the default flip tonight — the required mobile A/B evidence can't be gathered, and proposing a flip without it is premature.
- **A2 leg 2 PTR-STALE-GUARD-001 (row 39a):** `pwa/antcv-pointer-stale-guard.js` present + wired (1 `<script>`) + `pwa/test/unit/pointer-stale-guard.test.mjs` green. **Live same-device stale-pointer A/B = BLOCKED** (dead token; would also mutate a real account with owner absent).
- **A2 leg 1 AUTOSAVE-NO-DOWNGRADE-001:** relay-side, DEPLOYED per prior runs. **Live downgrade-PUT curl = DECLINED/BLOCKED** — dead token, and a downgrade PUT mutates a real account without the owner present.
- **A2 leg 3 (row 19):** two-real-device test — **BLOCKED, owner-gated** (needs a physical second device).

## BAND B — Data loss / crash
- **B1 SO-003 (row 40, core-comp resize wipes Selected Outcomes) / B2 SO-004 (row 41):** compress logic green — `pwa/test/unit/core-comp-compress-{coord,eo}.test.mjs` pass in the 1570 suite. Live interactive repro of the resize→wipe path = BLOCKED (needs live editing session).
- **NEW FINDING — DIAG-CORE-COMP-COMPRESS-STALE-001 (test-infra only):** `pwa/test/diag-core-comp-compress.mjs` **throws** on the current bundle — `TypeError: Cannot read properties of undefined (reading '1')` at its post-load read `cc.rows[1][0]`. The diag seeds `core_comp` as `type:'table'` with `rows`, but the current normalize/migration transforms `core_comp` away from that shape (rich_block-family migration since the diag was last touched at **1.50.783**, current 1.51.4226). Product logic is unaffected (unit tests green, boot clean). Filed OPEN, test-infra. Fix = reseed the diag against the current core_comp model, or retire it in favour of the two unit tests. Not fixed tonight (off critical path, not in `run-tests.mjs`).

## BAND C — Content
- **C1 GEN-LANGFAB-001 (row 42) / C2 CA-006 (row 43) / C3 JD-ANALYSIS-PRINT-001 (row 44):** all require a fresh generation to observe → **BLOCKED** (live models, dead token). Spec rule 38 (measure content fixes on FRESH generations) cannot be satisfied tonight. Carried unchanged.

## BAND D — Perf / design
- **D1 PERF-001 (row 45):** not advanced this run.
- **D2 GEN-MODELROLE-001 (row 39):** code shipped + `MODEL_ROLES` set in both `wrangler.toml` per prior runs. **Live D1 `llm_calls` routing check = BLOCKED** (Cloudflare D1 MCP connector invalidated). Carried, VERIFY-LIVE still owed.

## BAND E — Standing (every run): ALL GREEN
- **PWA suite:** `node scripts/run-tests.mjs pwa` → **1570 / 1570 pass**, 0 fail.
- **Personal-panel stability (`diag-personal-panel-probe.mjs`):** DIAG PASS — 0 mutations over 8s, 0 page errors (Layout/Account/Advanced at rest).
- **Panel button audit (`diag-panel-button-audit.mjs`):** 213 buttons — 136 active, 12 ui-only, 50 not-visible/disabled, **0 THROWS, 0 page errors, 1 DEAD candidate** ("Undo last change" — expected no-op on empty history in a fresh headless seed, not a defect). New raw output `PANEL_BUTTON_AUDIT_2026-08-17.json`.
- **Export/preview parity (`diag-results-preview-export-parity.mjs`):** all HARD guarantees PASS — export applyOutcomesMode exposed, preview computes a result for every role the export does, per-role result == export (single source of truth), tier-1 explicit result verbatim, 0 page errors. The one soft check `preview renders Results blocks in the DOM: dom=0` is the **known editor-step seeding artifact** (seed uses `step:'editor'`, not the Preview tab; `data-antcv-role-results` attribute confirmed still present 1× in `pwa/app.js`) — not a regression.
- **Storm/residue probe (`diag-residue-dedup-loop.mjs`):** DIAG PASS — 0 post-boot sections writes in 15s, residue row stable, 0 page errors.

## Code-delta attestation (31ecc2c → 866bc92, since the 08-16 desktop nightly base)
Real delta landed since the last nightly: gen-content rule work (v3-critique globalise, evidence-qa, targeted-profile, profile-dedup) + doc-chatbot expansion, touching `pwa/app.js`+`app.src.js`, several sidecars, `gold-rules.json`, `index.html`, `sw.js`, and workers (`access-relay`, `demo-proxy`/`proxy` prompt-augment).
- **Boot / render surface ATTESTED clean:** `app.js` head `(()=>{window`, **0** `"use strict"`; cache-bust quintet coherent (`sw.js` CACHE `antcv-1.51.4226-globalise-v3` == `app.js?v=1.51.4226-globalise-v3` == TARGET_VERSION == ANTCV_VERSION seed); **boot-smoke OK** (glDemo=function, 0 errors) — current HEAD boots past sign-in.
- **Gen-content behaviour of that delta = owed a FRESH-generation content check** (BLOCKED, live models). No content regression could be either confirmed or cleared tonight.

## Owner actions needed
1. **Re-save `~/.antcv/token`** — PWA console on `antcv.pages.dev`: `copy(localStorage.getItem('antcv:auth:token'))` → paste into `C:\Users\karpg\.antcv\token` (no trailing newline). Unblocks position-discovery, job-tracker, and all live gen/relay verification.
2. **Reconnect the Cloudflare D1 MCP connector** (invalidated) so D1 `llm_calls` routing checks (D2) can run.
3. Carried owner-side, unchanged: `CI-CF-TOKEN-EXPIRED-001` (rotate GitHub-Actions `CLOUDFLARE_API_TOKEN`; worker deploys desktop-only); two-real-device test (row 19).

## Owner verify list (from this run)
- Nothing shipped tonight → nothing owed live-verify FROM this run. The gen-content delta already on `main` (1.51.4166→4226) is owed a fresh-generation content spot-check whenever the token is restored.

_Model: Opus 4.8. Suite green (1570/1570) confirmed before writing. No push of code; only register/report docs committed._
