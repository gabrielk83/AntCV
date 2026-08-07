# AntCV nightly — 2026-08-07 (DESKTOP, unattended, Opus 4.8)

Substrate: desktop clone with wrangler OAuth (d1 write) + live worker reachability — the two
things CI cannot do (CI is 403-network-gated + CF-token-expired). **SYNC FIRST clean:** preflight
WORKSPACE CLEAN, `git fetch && pull --rebase origin main` → fast-forward `151b920 → 9a56328` (picked
up the 08-07 CI report + OPEN_REGISTER edits + today's panel-button-audit). Tree clean throughout.
No force-push. Docs-only run → no shift claim (SYNC-FIRST satisfied).

## Headline

**A CI run already verified this exact base green ~hours ago (1893/1893, zero drift). The desktop's
only additive value is the live/telemetry-gated work CI is blocked from — so I spent the run there,
not re-running CI's suite.** Independent live attest of all 5 surfaces (desktop reached the workers),
D1 `llm_calls` telemetry read, and source+test confirmation of the Band-A/D guards. **No code shipped:
the base is byte-identical to a verified-green commit, there is no fresh traffic to measure a content
fix against (spec rule 38), and every remaining open item is owner / physical-device / live-signed-in
gated.** One real new finding surfaced (8-day traffic gap). Pushes: this report + OPEN_REGISTER edits.

## New finding this run — LLM-TRAFFIC-GAP-2026-08 (corroborates RELAY-TUNE-COVERAGE-GAP-001)

D1 `ant_memory.llm_calls` (read-only, `--remote`): **the most recent LLM call of ANY task is
2026-07-30 22:49 — no traffic for 8 days.** Aggregated by task/provider the whole recent surface is
consensus/parse_jd/compress/long_context/analyze_fit, all `success` = count (0 failures). This is
empirical confirmation of **RELAY-TUNE-COVERAGE-GAP-001** (row 38): the weekly cost-quality tune is
"blind to real traffic" because there is essentially **no real traffic** to see — not merely a
plumbing gap. It also means the two live-only verifies below genuinely cannot run tonight:
GEN-MODELROLE role-split observation and any FRESH-generation content check (GEN-LANGFAB, SO-003/004)
have no new gen to inspect.

## GEN-MODELROLE-001 (D2, "verify-live") — code+config+lock VERIFIED; live D1 role-split NOT observable (by design + no traffic)

- **Code**: `workers/proxy/src/multi-llm.js` `parseModelRoles` / `roleHeadOrder` / `ROLE_KEYS =
  ['writer','supervisor','coherence','analysis','kernel']` intact — the map REORDERS the cascade head,
  never removes; absent/malformed map ⇒ base order untouched (fail-soft).
- **Config**: `MODEL_ROLES = '{"writer":"anthropic","supervisor":"mistral","coherence":"openai"}'`
  present **identically in both** `workers/proxy/wrangler.toml:50` and
  `workers/demo-proxy/wrangler.toml:50`. Both proxies attest to source version `3.8.4-brand-ink-match`
  live (below) → the deploy that shipped that version carried this `[vars]` entry.
- **Lock**: `node --test workers/proxy/test/model-roles.test.mjs` → **12/12 pass**, incl.
  "dual-sync: multi-llm.js + supervisor.js byte-identical across proxies" and the raw-passthrough
  404-regression guard.
- **Live D1 role-split**: **NOT freshly observable, and this is expected** — `llm_calls` logs `task`
  (compress / parse_jd / consensus_poll …), NOT the internal cascade ROLE (writer/supervisor/coherence),
  so a head-reorder is not directly telemetered; and there has been no traffic since 07-30 regardless.
  Verdict: **code + config + deploy + test all confirmed; the "D1 shows the role split" clause is
  un-observable through this schema and needs either a role column in the log or a live instrumented gen.**

## Band-A guards (mobile & tab isolation, P0) — all PRESENT + LOADED + SUBSTANTIVE (live-A/B carried)

- **GEN-BACKGROUND-001 (A1)**: `antcv-gen-memo.js?v=1.51.134` + `antcv-gen-job-client.js?v=1.51.132`
  both loaded in `pwa/index.html` (1038/1040). Code shipped end-to-end. **Real-mobile A/B + the
  default-OFF→ON flip proposal are NOT done tonight** — they need a real mobile device (headless can't
  fake background/lock/foreground), and there is no fresh real-mobile A/B to justify flipping the
  default, so per "verify-first, don't propose on no evidence" the flip is **carried, not proposed**.
- **AUTOSAVE-NO-DOWNGRADE-001 (A2 leg 1)**: guard block intact at `access-relay/src/index.js:3660-3697`
  — blocks a `jd_company`/`jd_role` downgrade to blank/Unsolicited over a REAL company AND a blank
  `cv_sections`/`cl_sections` `[]` over populated content; explicit null wipe still honoured. Deployed
  (relay attests `auth-37-cap-disposable-only` live). **Live downgrade-PUT curl NOT fired**: it needs a
  real Bearer identity, which I will not mint/replay headlessly against the owner's real account →
  code-verified instead of live-fired.
- **PTR-STALE-GUARD-001 (A2 leg 2)**: `antcv-pointer-stale-guard.js?v=1.51.334-unsol-pillar` loaded in
  `pwa/index.html:64`. Two-tab same-device stale-pointer A/B needs a signed-in session that mutates the
  real account → carried.
- **Two-real-device test (A2 leg 3)** — needs a 2nd physical device; carried (owner-gated).

## Independent live attest — 5 surfaces READ from desktop, every version = in-repo source (no drift)

| Surface | Live `/health` (or CACHE) | In-repo source | Match |
|---|---|---|---|
| PWA (`antcv.pages.dev` `sw.js` CACHE) | `antcv-1.51.4086-demand-seed-refresh` | `sw.js` CACHE `1.51.4086-demand-seed-refresh` | ✅ |
| cv-proxy | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |
| docx-worker | `1.14.174-appline-edit` | `src/index.js` `VERSION` `1.14.174-appline-edit` | ✅ |
| access-relay | `auth-37-cap-disposable-only` | `RELAY_VERSION` | ✅ |
| demo-proxy | `3.8.4-brand-ink-match` | `VERSION` `3.8.4-brand-ink-match` | ✅ |

Carried cosmetic (unchanged): `antcv-demo-proxy` `/health` still self-labels `"service":"cv-proxy"`
(shared code; version string authoritative) — needs a worker deploy, carried.

## Standing probes (E) — my own fresh green on this base

- **PWA suite** `node scripts/run-tests.mjs pwa` → **1570/1570 pass**, 0 fail (my run, matches CI).
- **model-roles lock** → **12/12**. (Full-repo 1893/1893 + render V&V 50/50 + render-gated Playwright
  diags were run green by the 08-07 CI run hours ago on this byte-identical base — not re-burned here.)

## Register coverage this run (every open lane gets a status word)

- **GEN-MODELROLE-001 (D2)** — code+config+deploy+lock VERIFIED 2026-08-07; live role-split un-observable
  (schema + no traffic). Date-bumped.
- **RELAY-TUNE-COVERAGE-GAP-001 (row 38)** — corroborated empirically (8-day traffic gap); no weekly
  tune due (last 08-06 NO FLIP, next ~08-13). Refreshed.
- **AUTOSAVE-NO-DOWNGRADE-001 / PTR-STALE-GUARD-001 / GEN-BACKGROUND-001 (Band A)** — all code-present +
  loaded + deployed VERIFIED 2026-08-07; live A/B legs carried (real device / signed-in / 2nd device).
- **Live attest + PWA suite** — fresh green, no drift.
- **CI-CF-TOKEN-EXPIRED-001** — carried OPEN (owner: rotate GitHub-Actions `CLOUDFLARE_API_TOKEN`).
  Not a desktop blocker (desktop wrangler OAuth works), but CI worker-deploys stay dead until rotated.
- **SO-003 / SO-004 / PERF-001 / GEN-LANGFAB-001 / salmon render rows** — all need a live signed-in
  generated-content session; with zero fresh traffic + no interactive account tonight, none actionable.
  Carried.
- **All owner/render/2nd-device rows** — none newly actionable from an unattended desktop run.

## Owed (cannot be done unattended tonight)
- Real-mobile GEN-BACKGROUND A/B + default flip proposal (owner-gated, needs device).
- Live relay downgrade-PUT + two-tab stale-pointer A/B (needs real auth / signed-in session).
- SO-003/SO-004 crash capture, PERF-001 profiling, GEN-LANGFAB fresh-gen check (needs signed-in gen).
- CF token rotation for CI worker deploys (owner).

No `app.js` / `app.src.js` / worker / workflow change reached `main` this run. Pushes: this report +
the OPEN_REGISTER row date-bumps.
