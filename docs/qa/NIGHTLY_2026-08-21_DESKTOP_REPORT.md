# AntCV Desktop Nightly — 2026-08-21 (antcv-nightly scheduled task, Opus 5, worktree-isolated)

**One fix shipped + deployed. One register row re-diagnosed and de-staled. One regression test added.
One long-carried "owed to desktop" item resolved into what it actually is.**

Model: Opus 5 ran every task except the SO-003 diagnosis, which ran in a parallel
general-purpose subagent (also Opus 5) per the multi-model dispatch rule.

## Preflight / sync

- `node scripts/routine-preflight.mjs start --routine antcv-nightly` → **WORKSPACE DIRTY** (exit 3):
  the owner's primary clone is on `claude/demand-seed-modern-write-path` with uncommitted work.
  All work done in the isolated session worktree, never in the owner's clone.
- SYNC FIRST: `git fetch origin && git pull --rebase origin main` → fast-forwarded to `9e055e8`
  (the 08-21 CI nightly's report + register edits). No force, no reset.
- `npm ci` in the worktree (fresh tree, no `node_modules`); chromium present → render-gated diags ran.

The 08-21 **CI** nightly had already verified + attested this exact HEAD earlier today. This run
deliberately took only the legs CI cannot reach: **production D1, a worker deploy, and the
render-gated diags**, plus the register work.

---

## SHIP — LLM-COST-EFFECTIVE-FROM-001 (access-relay, DEPLOYED)

`workers/access-relay/src/telemetry.js` prices every `llm_call` server-side from D1
`llm_provider_costs` before writing the row — that recompute is the whole point of
LLM-COST-D1-REFERENCE-STALE-001 (don't trust the client's number). The lookup was:

```sql
WHERE provider = ? AND model = ?
ORDER BY effective_from DESC LIMIT 1
```

**No cutoff on `effective_from`.** The newest row won unconditionally, so the column encoded
*insert order*, not *start date* — a row dated in the FUTURE would price today's traffic from the
instant it was inserted. That defeats the column's one purpose: pre-staging an announced vendor
price change.

**How it surfaced.** Live-verifying the 08-20 gemini/mistral correction against production D1.
Every logged gemini row priced at exactly `{0.075, 0.30}` (residual under 0.4 micro-USD across 129
calls) while the PWA client meter carried `{0.15, 0.6}` at the time — so the number in `llm_calls`
was never the client's. The source was the D1 `gemini-2.5-flash` row dated **2024-05-01**. Reading
the lookup that resolved it exposed the missing cutoff.

**Not a live mispricing.** The 08-20 correction was back-dated to 2026-08-20 and every
`effective_from` in the table has arrived. Verified directly against production D1 that the guarded
query returns the same four in-traffic rates as the unguarded one:

| model | rate |
|---|---|
| `gemini-2.5-flash` | `[0.30, 2.50]` |
| `mistral-large-latest` | `[0.50, 1.50]` |
| `claude-sonnet-5` | `[3.00, 15.00]` |
| `gpt-5.4-mini` | `[0.75, 4.50]` |

**Fix.** Newest ARRIVED row wins. A NULL `effective_from` stays always-in-effect (preserves
pre-guard behaviour for undated rows). When every candidate is future-dated the relay falls through
to its own `model-rates` table via `rateForStrict`, never to the client's `cost_usd`.

**Test.** `pwa/test/llm-cost-effective-from.test.mjs` — 5 tests driving the real `insertLlmCall()`
against a stub D1 that honours the WHERE clause the source actually wrote, so a dropped guard cannot
pass silently. **Negative control: with the guard removed, 3 of the 5 fail.**

**Deploy.** `npx wrangler deploy --env=""` from desktop (CI worker deploys stay token-blocked —
CI-CF-TOKEN-EXPIRED-001). Version **`d447d450-5c3b-4d50-a5b8-cbed2eff4068`**, `/health` **200**.
Commit `60d8b07`, pushed to `main`.

---

## RESOLVED — the "cost-meter live-verify owed to a desktop run" is blocked on TRAFFIC, not tooling

The 08-21 CI report carried this as owed to desktop. It is not a desktop-capability gap.

Production D1: the newest `llm_calls` row is **2026-08-19 11:26 UTC**. There has been **zero LLM
traffic since before the 08-20 fix deployed**, so there is no post-fix datapoint, and no desktop
session can manufacture one without a paid generation.

The pre-fix rows were re-derived exactly and confirm the original diagnosis:

| provider / model | tokens (in / out) | logged | implied rate |
|---|---|---|---|
| `claude-sonnet-5` | 411,230 / 22,964 | $4.80122 | exactly the `{10, 30}` fallback |
| `mistral-large-latest` | 322,302 / 19,276 | $1.14039 | exactly the old `{3, 9}` |
| `gemini-2.5-flash` | 44,904 / 18,022 | $0.008771 | exactly `{0.075, 0.30}` — the stale **D1** row |

**What the first post-fix generation must show:** gemini `[0.3, 2.5]`, mistral `[0.5, 1.5]`,
claude `[3, 15]`, openai `[0.75, 4.5]`. Re-registered as a TRAFFIC-gated check.

The byte-level half of the leg IS closed: the **served** production bundle
`antcv.pages.dev/app.js?v=1.51.4346-cost-rates` carries `mistral:{inputPer1M:.5,outputPer1M:1.5}`,
`gemini:{inputPer1M:.3,outputPer1M:2.5}`, `claude:{3,15}`, `openai:{.75,4.5}`.

---

## Row 40 (SO-003) — re-diagnosed; the row's WORDING was the defect

The row's bold prefix still opened with the original 2026-06-12 report, "root cause NOT fixed",
while its own tail said `SHIPPED 1.51.138`. Read top-down it scans as a live P0 data-loss. It has
now cost **three** diagnosis sessions (2026-08-01, 2026-08-04, 2026-08-21) that each re-derived
"no headless repro".

Re-verified this run by code reading plus a headless probe. Every writer a core_comp row-count
change actually reaches preserves `outcomes`:

| path | site | why it's safe |
|---|---|---|
| `+ Row` / remove-row controls | `pwa/app.src.js` ~9899-9950 | patch-merge scoped to the core_comp section |
| advanced style menu | `pwa/antcv-format-prefs.js:404-424` | id-scoped: `if (!s \|\| s.id !== sectionId) return s;` |
| `sections-updated` re-ingest | `pwa/app.src.js` ~18296-18353 | pipes outcomes through `Se(items, 12)` |
| `Se` normaliser | `pwa/app.src.js` ~5768-5858 | filters only bracket placeholders; never reads `core_comp`/`rows` |
| generation apply | `pwa/app.src.js` ~28519-28527 | explicit `"outcomes"===e.id` branch with `\|\| e.items \|\| []` |

Also recorded: `pwa/antcv-core-competencies-row-controls-234.js` has **no row-count control at all**,
so the original report's "row count 3→4 in the advanced style menu" does not map to a control that
exists there.

Row prefix rewritten so the status reads correctly; `verified:` advanced to 2026-08-21.

### New test — the TRIGGER-side invariant is now pinned

Existing coverage (`outcomes-loss-guard.test.mjs`, 8 tests) is the RECOVERY half only. Nothing
asserted that the core_comp writers never empty the sibling in the first place — a property of the
current code, not an invariant. A future refactor of `applySectionFormat` from an id-scoped map into
a whole-array rebuild would silently re-open SO-003 with the belt as the only thing between the owner
and the loss.

`pwa/test/unit/core-comp-format-preserves-outcomes.test.mjs` — 10 tests, real sidecar in a vm
sandbox: Selected Outcomes byte-identical across all 7 `setFormat('core_comp', …)` formats, plus
sibling-order and id-scoping checks. **Negative control: breaking the guard at
`antcv-format-prefs.js:413` fails 7 of the 10.**

> Note for future sabotage-testing: that guard line appears **twice** in the file (146 and 413).
> A first-match `String.replace` hits the wrong one and produces a **false-green** negative control —
> which is exactly what happened on the first attempt this run before it was caught.

---

## Band E standing sweep — GREEN

- `diag-panel-button-audit`: **211 buttons, 0 page errors, 0 throws** (134 active / 48
  not-visible-or-disabled / 15 ui-only / 14 dangerous-skipped). Matches the 08-20 desktop pass 2.
  Artefacts: `docs/qa/PANEL_BUTTON_AUDIT_2026-08-21.{json,md}`. **Row 23 refreshed.**
- `diag-personal-panel-probe`: **DIAG PASS** — 0 mutations / 8s, 0 page errors.
- `boot-smoke`: `glDemo=function, errors=0`.
- Full-repo suite: **1956 / 1956** (1941 baseline + 5 effective-from + 10 core-comp), 0 fail, 0 skip.
- PWA suite: **1606 / 1606** — matches the CI run on this HEAD.
- Live attest: `antcv.pages.dev/sw.js` CACHE `antcv-1.51.4346-cost-rates` == repo `TARGET_VERSION`;
  `app.js?v` 200; all four workers `/health` **200** before *and* after the relay deploy.
- Cache-bust gate: **no cache-bustable pwa assets changed** — `pwa/test/**` is not loaded by
  `index.html`, so no version consumed, no quintet, no shift claim needed.

---

## Per-band status

| band | status this run |
|---|---|
| **A1** GEN-BACKGROUND-001 (38/38a) | **BLOCKED** — flip-default still needs a real mobile foreground gen A/B. Unchanged. |
| **A2** tab/device isolation (39a) | legs 1+2 shipped; leg 3 (row 19) **BLOCKED** on a second physical device. The relay downgrade-guard was NOT curl-probed live: the only honest probe is an authenticated mutating PUT against the owner's real account. Instead verified `workers/access-relay/` has **zero commits** since the recorded deploy `c19a28d`, so the deployed code is the guarded code by construction — and tonight's own relay deploy re-uploaded that same tree. |
| **B1** SO-003 (row 40) | **RE-DIAGNOSED + PINNED** — see above. Not open. |
| **B2** SO-004 (row 41) | **BLOCKED** — still no headless React #185 repro. Untouched this run. |
| **C1/C2/C3** rows 42-44 | **CARRIED** — content rows; need live models on a fresh generation (spec rule 38), and there has been no traffic since 08-19. |
| **D1** PERF-001 (row 45) | **CARRIED** — untouched. |
| **D2** GEN-MODELROLE-001 (row 39) | **CARRIED GREEN** — `MODEL_ROLES` read back unchanged at the 08-20 deploy; no traffic since 08-19 to re-confirm the role split in `llm_calls`. |
| **E** standing sweep | **GREEN** — above. |

## Register-row coverage

Rows given an **evidence-backed status by this run**: 19, 23, 38, 38a, 39, 39a, 40, 41, 42, 43, 44,
45, plus the new CLOSED entry for LLM-COST-EFFECTIVE-FROM-001.

Rows **1, 3, 9, 16, 35, 36, 37** carry forward GREEN from the 08-21 CI E1 sweep on this same HEAD —
`pwa/` is byte-identical to what CI verified this morning (tonight's commit touched only
`workers/access-relay/src/telemetry.js` and two test files), so re-running those checks would
re-derive the same result against the same bytes.

Rows **46-101** are the owner-reported mobile/content/design backlog. They were **not** individually
re-verified this run and are not claimed as covered. Honest position: the register has outgrown a
per-row-per-night sweep at ~100 rows, and pretending otherwise is how row 40 stayed mis-stated for
seven weeks. Recommend the owner either prune the closed rows out of the numbered table or split the
register into ACTIVE / CLOSED files — see the owner-decision list.

## FEATURES_REGISTRY

No entry: this run shipped a defect fix and a test, no feature was shipped or advanced.

---

## Owner-verify list (unchanged from prior runs unless noted)

1. **Row 40 owner-verify** — change the Core Competencies row count and confirm Selected Outcomes
   survives. Still the only thing that closes the row from the owner's side.
2. **Cost meter, first post-fix generation** — the numbers to expect are in the table above.
3. Row 20's 6-item consolidated verify list, row 83, row 81 — unchanged.

## Owner decisions wanted

1. **A1 flip-default** (`antcv:gen-resume` on by default) — still needs a real mobile foreground gen
   A/B before it can be proposed. Not proposed tonight.
2. **Register hygiene** — split `OPEN_REGISTER.md` into ACTIVE and CLOSED files, or prune closed rows
   out of the numbered table? At ~100 rows the roll-up is now costing diagnosis sessions on rows that
   are already shipped. Row 40 cost three.
3. **CI-CF-TOKEN-EXPIRED-001** — rotate the Actions `CLOUDFLARE_API_TOKEN`. Worker deploys have been
   desktop-only since 2026-08-04.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
