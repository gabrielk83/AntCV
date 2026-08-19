# AntCV DESKTOP NIGHTLY — 2026-08-19 (Opus 5, worktree-isolated)

**Mode:** verify-first + one shipped fix. Shift lane **1.51.4326-1.51.4345** claimed; shipped
**`1.51.4326-claude-rate`**. Preflight reported **WORKSPACE DIRTY** (owner has uncommitted work in
`C:\Users\karpg\GitHub\AntCV`), so every edit ran in an isolated `origin/main` worktree per
STANDING RULE 0 — the owner's clone was never touched.

## Base
- SYNC clean. Base HEAD `024a5de` — the CI nightly of the same date, release `1.51.4306-demand-seed-refresh`.
- A CI nightly already ran today on this exact HEAD and was green across the board, so this run
  deliberately went after what CI structurally **cannot** do: live-authenticated checks, D1
  forensics, and the render diag that exceeds the CI 2-minute tool budget.

## SHIPPED — LLM-COST-CLAUDE-RATE-001 (PWA `1.51.4326-claude-rate`)

**The defect.** The client cost meter prices a call as `C[provider]` and falls back to a generic
`{ inputPer1M: 10, outputPer1M: 30 }` when the provider id is not in the map. Every task ladder and
every telemetry row spells Anthropic **`claude`** (`compress: ["mistral","gemini","claude"]`,
`llm_calls.provider = 'claude'`), but the rate map at `pwa/app.src.js:1207` was keyed only
`anthropic`. So `C['claude']` missed and **every real claude call priced at 10/30 — 3.04x the true
$3/$15.**

**How it was found — arithmetic, not code reading.** D1 `llm_calls`, 7 days to 2026-08-19,
`task=compress, model=claude-sonnet-5`:

| provider | prompt tok | completion tok | logged cost | reconciles against its own key? |
|---|---|---|---|---|
| openai (gpt-5.4-mini) | 309,042 | 13,021 | $0.2904 | **yes**, to the cent (0.75/4.5) |
| mistral (large) | 238,177 | 12,563 | $0.8276 | **yes**, to the cent (3/9) |
| claude (sonnet-5) | 411,230 | 22,964 | **$4.8012** | **no** — but exactly matches 10/30 |
| gemini (2.5-flash) | 42,408 | 17,884 | $0.0085 | **no** — predicts $0.0171 (see below) |

`411230*10/1e6 + 22964*30/1e6 = $4.8012`, to four decimals. Two providers reconciling exactly
against their own keys isolates the miss to `claude`. True cost of that call set at $3/$15 is
**$1.578**.

**Why it mattered beyond the invoice.** Claude was the single largest line in the week's logged LLM
spend ($4.80 of $6.47 = 74%), and roughly three quarters of that was phantom. More importantly,
**RELAY-COST-TIEBREAK-001's cost penalty and the weekly cost-quality tune both demote a provider on
price** — so anthropic has been sinking in the router on a number that was never real. This is also
the mechanism behind the "compress claude leg" outlier that has been carried as an unresolved owner
call since 2026-07-22: it was never an ensemble-design question, it was a missing map key.

**The fix.** Add the `claude` alias at the same $3/$15 as `anthropic`, in both bundles. Literal-only
change, no control flow. Gates run: exactly 1 occurrence in each bundle before the edit, alias not
already present, `app.js` still `startsWith("(()=>{")`, no `"use strict"`, exact expected byte
delta, `new vm.Script` parse gate on both. The 10/30 fallback stays for genuine BYOK unknowns.

**The guard.** New `pwa/test/llm-cost-provider-rates.test.mjs`, **17 checks over both bundles**:
every provider id a task ladder can dispatch to must carry its own rate entry; claude and anthropic
must price identically at the real rate; exactly one 10/30 fallback survives. The ladder assertion
is the part that matters going forward — it fails the next time a ladder gains a provider the rate
map does not know, which is exactly how this bug got in.

**Verification.** PWA suite **1591/1591** (0 fail, 0 skip; 1574 + 17 new). boot-smoke
`glDemo=function, errors=0`. Cache-bust quintet complete — `app.js?v`, version-override's own `?v`,
`sw.js` CACHE, `TARGET_VERSION`, `STALE_VERSIONS` (previous `1.51.4306-demand-seed-refresh`
appended, current NOT present), `ANTCV_VERSION` seed — plus the test-pinned sidecar quartet
(`antcv-copenhagen-v2-001.js`, `antcv-pdf-preview-gate.js`, `antcv-docx-client.js` including its
module-import `?v`), all at `1.51.4326-claude-rate`.

**Not fixed / owed.** Historical `estimated_cost_usd` rows stay overstated — no backfill attempted,
but the raw token counts are intact so any re-scoring can recompute. The weekly tune should be
re-read once post-fix traffic accumulates: claude's corrected price may legitimately move a head.

## Two carried entries CORRECTED

**ANTCV-TOKEN-EXPIRED-2026-08-14-001 — CLOSED.** The owner re-saved `~/.antcv/token` on 2026-08-18
(mtime 08-18 14:18). Decoded: `email=karp.gabriel.a@gmail.com`, `exp=2026-08-25T12:09:14Z`. Live-proved,
not merely decoded: `GET /api/applications` → **HTTP 200, 73 rows**. The companion 08-17 blocker is
gone too — the Cloudflare D1 MCP connector answers again, which is how tonight's evidence was
gathered. Every routine that stopped at this gate since 08-14 (position-discovery, job-tracker
nightly, all relay/gen live checks) is unblocked.

**LLM-TRAFFIC-GAP-2026-08 — no longer a gap.** Carried since 08-07 as "most recent LLM call
2026-07-30, an 8-day silence". Actual: **492 calls in 7d, latest 2026-08-18 16:04:35**. But read it
correctly — **465 of the 492 are one `compress` burst on 2026-08-18**, the gen-runner nightly batch,
across all four providers (claude 124 / openai 124 / gemini 126 / mistral 92) at 100% success with
**zero** malformed, banned, or placeholder-leak flags. So the tune is no longer data-starved for
`compress`, but the volume is machine-generated batch traffic and must not be read as evidence about
interactive quality. `request_id` is NULL across the whole compress set, so ensemble-vs-round-robin
could not be settled from telemetry; the prompt-token profiles differ sharply by provider (claude
3,316 avg vs gemini 337), which argues these are different compress workloads rather than one op
fanned out four ways.

## Row 23 — panel-button-audit pass 2 (the item owed to a desktop run)

Ran to completion (CI kills it at its 120s tool budget). `PANEL_BUTTON_AUDIT_2026-08-19.{md,json}`:

- **213 buttons, 0 page errors.**
- 133 active · 15 ui-only · 50 not-visible-or-disabled · 14 skipped-dangerous · **1 DEAD candidate**.
- The DEAD hit is **"Undo last change"** (no store write, no DOM delta). **Unverified and probably a
  true no-op**: the audit's seeded state has no prior edit, so undo correctly does nothing. It needs
  one manual click after a real edit before it is filed as a defect — reported here rather than
  filed, per the harness's own "verify each before filing" instruction.
- Not-visible dropped 65 → 50 against the pass-1 baseline.

## NEW — LLM-COST-GEMINI-RECONCILE-001 (OPEN, telemetry accounting)

With claude explained, gemini is the one provider whose logged compress cost still does not
reconcile against its own key: $0.0085 logged vs $0.0171 predicted at `{0.15, 0.6}` — a clean 2x.
Under a cent a week in money, but it is the same class of defect as the one fixed tonight (the
router deciding on a number that is not the truth). Next step: a per-row `llm_calls` query for
gemini compress (cost, prompt_tokens, completion_tokens, `tokens_real`) to see whether the shortfall
is a row subset or a uniform factor.

## Standing sweep

- **Settings-panel stability probe** (`diag-personal-panel-probe.mjs`): **DIAG PASS** — 0 mutations
  over 8s, 0 page errors, panel at rest.
- **Live attest, all green** (pre-push): `antcv.pages.dev/sw.js` CACHE = `1.51.4306-demand-seed-refresh`
  == the base HEAD; all four workers `/health` **200** — `antcv-access-relay`, `cv-proxy`,
  `antcv-demo-proxy`, `docx-worker`.
- **Suite** 1591/1591; `app.js` head `(()=>{`, 0 `"use strict"`, parse-gated.

## Per-row status this run

| Row / item | Status this run |
|---|---|
| 23 — panel-button-audit pass 2 | **RUN** (213 buttons, 0 errors, 1 unverified DEAD candidate) |
| 35 / 36 / 37 — regen-confirm | **BLOCKED by choice, no longer by auth.** The token is valid now, so a future run can do it; not attempted tonight because the shipped fix owned the run and a generation must be measured on its own (spec rule 38) |
| 38 — RELAY-TUNE-COVERAGE-GAP-001 | **ADVANCED** — the compress/claude cost outlier it has carried since 07-22 is now explained and fixed at the source (LLM-COST-CLAUDE-RATE-001); traffic-gap premise corrected |
| 19 — two-real-device test | **BLOCKED** — needs a physical second device (owner) |
| ANTCV-TOKEN-EXPIRED-2026-08-14-001 | **CLOSED** (verified live) |
| LLM-TRAFFIC-GAP-2026-08 | **CORRECTED** |
| CI-CF-TOKEN-EXPIRED-001 | **UNCHANGED** — rotate the Actions `CLOUDFLARE_API_TOKEN`; worker deploys stay desktop-only |
| CAP-AMPUTATED-ENUMERATION-002 | **UNTOUCHED** (gen-runner, non-PWA; the honest repair is generative) |
| Rows 1-34 remainder | Not individually re-verified tonight — carried from the CI run of the same date on this same HEAD, which was green across suite, boot-smoke, render diags and live attest |

## Owner decisions / verify list

1. **Nothing is owed to unblock the shipped fix** — it is self-contained and test-guarded.
2. **Re-read the weekly cost-quality tune after the next real traffic window.** Claude's price just
   dropped 3.04x in the router's eyes; a head that was demoted on the phantom number may now be the
   correct choice. Do not pre-empt it — let the loop see real volume first.
3. **One manual check owed:** click "Undo last change" *after* making a real edit, to settle whether
   the audit's DEAD candidate is a genuine dead control or an artifact of the seeded state.
4. **Rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN`** — unchanged from prior runs.

## Bottom line

One solid, verified fix shipped: a missing rate-map key that inflated every claude call 3.04x and
had been misread for four weeks as an ensemble-design question the owner had to decide. Two carried register entries were
false and are now corrected — the auth token has been valid since 08-18, and the "no LLM traffic"
premise is wrong by 492 calls. The one register row explicitly owed to a desktop run (button audit
pass 2) was executed. Suite 1591/1591, boot-smoke clean, cache-bust quintet + quartet complete.
