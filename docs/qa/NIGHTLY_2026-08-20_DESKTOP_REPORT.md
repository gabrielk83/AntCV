# AntCV DESKTOP NIGHTLY — 2026-08-20 (antcv-nightly scheduled task, Opus 5)

**Mode:** verify-first, fix, deploy, register. **2 fixes shipped + pushed, 1 worker deployed,
1 new bug filed, 1 diagnostic harness built.** Worktree-isolated.

## Base

- **Preflight:** `routine-preflight.mjs start` → **WORKSPACE DIRTY** (desktop clone on
  `claude/demand-seed-modern-write-path`) → all work in the clean worktree
  `vigilant-hopper-c2abaa` off `origin/main`, per STANDING RULE 0.
- SYNC: `git fetch && git pull --rebase origin main` at start; **rebased a second time mid-run**
  when the weekly cost-quality tune pushed `b8cadb0`. Never forced.
- Base `8d331f6` → pushed **`9c2c82a`** to `main`. Suite **1919/1919** before the push.
- **No PWA asset touched** → no shift claim, no cache-bust quintet, no version consumed.
  `pwa/test/**` are test files, not served assets.

## SHIP 1 — LLM-COST-D1-REFERENCE-STALE-001 (relay, DEPLOYED)

Closes **COST-SOURCE-AUDIT-GAP-001**, which the weekly cost-quality tune filed OPEN roughly an
hour earlier the same day. Two independent runs converged on the same root cause from different
directions; this run had the deploy lane, so it closed it.

**The defect.** `workers/access-relay/src/telemetry.js` recomputes `estimated_cost_usd`
server-side, documented as "so a stale client doesn't bias the dashboard". Measured against 30
days of real `llm_calls`, that recompute was **inert**. It priced only from D1
`llm_provider_costs`, and that table holds **no row for any model in production**:

| model in live traffic | row in `llm_provider_costs`? |
|---|---|
| `claude-sonnet-5` | no (table has `claude-sonnet-4-6`, `-opus-4-6`, `-haiku-4-5`) |
| `gpt-5.4-mini` | no (table has `gpt-5`, `gpt-5-mini`) |
| `mistral-large-latest` | no (table's key is `mistral-large`) |
| `gemini-2.5-flash` | **yes** — at `[0.075, 0.30]`, against the maintained `[0.10, 0.40]` |

So ~98% of calls fell through to `event.cost_usd` — the client's own number, which is exactly what
the recompute exists to distrust.

**Proof, arithmetic-exact.** 30d `task=compress, provider=claude` (1,050,465 prompt + 50,452
completion) logged **$12.0182**, which is precisely 10/30 pricing. The true $3/$15 cost is
**$3.9082**. The same miss explains LLM-COST-MISTRAL-RATE-001 (PWA `{3,9}` logged instead of the
audited `[2,6]`, 1.50x high) and LLM-COST-GEMINI-RECONCILE-001 (the stale D1 row wins, at half).

**Why it is not just accounting.** RELAY-COST-TIEBREAK-001 and the weekly tune both read these
rows as ground truth and demote a provider on price. Fixing the PWA map at 1.51.4326 left the
server still trusting the client, so the router kept steering on a phantom number.

**The fix.** Order is now **D1 row → the relay's own rate table → the client's value**. D1 becomes
an override (contract prices, discounts) rather than a prerequisite, and reaching the client's
value at all now `console.warn`s the provider and model instead of passing silently.
New `workers/access-relay/src/model-rates.js` mirrors the owner-maintained `RATES` block from
`demo-enforcement.js` — demo-proxy and proxy already carry byte-identical copies, this is the
third. Its relay-only `rateForStrict()` returns **null** for an unknown model rather than
`rateFor()`'s Sonnet guess: a guessed price recorded as measured cost is the whole defect.

**Guard.** `pwa/test/relay-model-rates-mirror.test.mjs`, 5 tests — the three copies must not drift
(EOL-normalised, per the known Windows/Linux trap), every model production actually calls must be
priced, `claude-opus-4-8` and `gpt-5.5` must keep their own entries against a substring
fall-through, and telemetry's order is string-locked (table before client, warn on fallback).

**Deploy + attest.** `npx wrangler deploy --env=""` from desktop (CI worker deploys remain broken
on the expired Actions token). Version **`47b04f8c`**. Dry-run first, bundle confirmed to carry the
new code. Deployed bundle read back live: `rateForStrict` ×3, the `claude-sonnet-5` key, the warn
line. `/health` **200** ×3 after deploy.

**Owed:** historical rows stay overstated — no backfill attempted, and none is needed to recover,
since the raw token counts are intact and any re-scoring can recompute. The PWA-map half of
LLM-COST-MISTRAL-RATE-001 is untouched (needs a bundle change + the cache-bust quintet).
Functional confirmation lands with the next real generation.

## SHIP 2 — CAP-AMPUTATED-ENUMERATION-002 (gen-runner, FIXED)

Filed 2026-08-18 and deliberately left unpatched then. The hard-cap cutter severed a comma-list
before its closing conjunction and closed the survivor with a period, so
`"drawing on inputs from investment, legal, tax, finance and ESG"` shipped as
`"drawing on inputs from investment, legal."` — grammatical, finished-looking, four items short.
Live in applications **3489** and **3487**. Unlike the amputated parenthetical of -001 nothing
flagged it, because the output reads complete.

**Reproduced before patching**, at the real shape: cap 90 → `"…investment, legal, tax."`,
cap 80 → `"…from investment."`.

**Fixed at the decision point, not the repair point.** `_severs_enumeration(s, p)` reads the
SOURCE past the candidate comma: if a coordinating conjunction closes the list (EN/DA/DE/ES/FR)
and its items are short (≤4 words), that comma is not a legal cut point. `_cap_line` walks back to
the previous non-severing boundary. The word-boundary fallback in both `_cap_line` and `_cap_para`
drops the open list entirely via `_drop_open_list` — which also drops the list's **first** item,
because cutting only to the first comma still asserts one input where the source named five — and
lets `_clean_cut` walk back the connector it exposes: `"…drawing on inputs."`

The rule the fix encodes: **a cut may lose a whole clause; it may never restate a shortened list
as the whole list.**

Scoped by item length, so an ordinary compound sentence (`"…, and the team moved on"`) stays a
legal cut point and a list that fits survives whole. `test_clean_cut.py` extended 4 → **48
checks**; **negative-controlled** — disabling the guard turns it red with 6 failures naming the
live strings. Job-tracker python tests 7/7.

## NEW — CAP-AMPUTATED-NOUNPHRASE-003 (OPEN, filed not fixed)

Third member of the cutter family, and the one that resists a deterministic fix. When no clause
boundary sits past the 0.55×cap floor, `_cap_line` falls back to a bare word boundary, which can
sever a noun phrase and still read as finished. **Reproduced at the production cap (148), not a
synthetic one:**

```
in : Led the qualification of a new optical subassembly supplier in Sweden and drove
     the transfer of the full metrology chain into volume production lines.   (150 ch)
out: …into volume production.                              ← "lines" silently dropped
```

Not patched, deliberately: unlike the enumeration case there is no structural marker in the source
to key on — a following lowercase noun is indistinguishable from a following clause without a
parser — so any deterministic rule either guesses or refuses far too many legal cuts. Fix
direction: prefer an earlier clause boundary at any position over a bare word cut, or hand the
passage to the existing `_llm_shrink` (cl_fit). The honest repair is generative and belongs with a
measured re-render — the same call the -002 filing made.

## Per-band status

### Band A — mobile & tab isolation (P0)

- **A1 GEN-BACKGROUND-001 (rows 38/38a) — BLOCKED, unchanged.** Approach A remains shipped and
  opt-in. The flip-default proposal needs a real mobile foreground gen A/B on a physical device;
  not fakeable headlessly, not attempted.
- **A2 leg 1 AUTOSAVE-NO-DOWNGRADE-001 (row 39a) — VERIFIED LIVE this run, read-only.** Previous
  runs declined the downgrade-PUT curl because it would write to a real application row. Verified
  instead by attesting the **deployed** relay bundle: `__blockDowngrade` ×3, `__newDowngrade` ×2,
  `__blockCvBlank` ×2, `__curReal` ×2 — occurrence-for-occurrence identical to source. The guard
  is live. No account mutated.
- **A2 leg 2 PTR-STALE-GUARD-001 — carried.** Sidecar present and unit-tested green in the suite;
  the same-device stale-pointer A/B would drive a real account, so not run.
- **A2 leg 3 / row 19 two-real-device — BLOCKED.** Needs a second physical device (owner).

### Band B — data loss / crash

- **B1 SO-003 (row 40)** — shipped 1.51.138, suite-covered, green this run.
- **B2 SO-004 (row 41)** — **BLOCKED.** Still no headless React #185 repro; the capture harness
  built 2026-07-05 does not trip it. Needs a real-device crash.

### Band C — content

- **C1 GEN-LANGFAB-001 (42)**, **C2 CA-006 (43)**, **C3 JD-ANALYSIS-PRINT-001 (44)** — all shipped
  (1.51.136/139/137), code green in the suite. All three still owe a **fresh-generation content
  check**, which per spec rule 38 must be measured on its own run; not attempted here, since two
  shipped fixes owned this one.

### Band D — perf / design

- **D1 PERF-001 (row 45) — ADVANCED, not closed.** New `pwa/test/diag-generate-click-profile.mjs`:
  owner-scale doc with a 180KB photo data URI, relay/LLM network blocked (CDN vendor bundles
  allowed, or the app never boots), a real Generate click, V8 CPU profile of that click alone.
  Result: `syncBothWays` **44ms** end-to-end, the sidecar **3ms** of sampled self time, the click's
  synchronous span **23ms**. **The register's named suspect is excluded by measurement, not
  inference.** Caveat stated plainly: with the network blocked the generate handler bails at its
  first fetch, so the owner's live seconds are not reproduced. What remains belongs to app.js's own
  generate path past that gate and needs a live-model run to profile.
- **D2 GEN-MODELROLE-001 (row 39) — deploy half CONFIRMED LIVE.** `wrangler versions view` on the
  deployed cv-proxy version (created 2026-08-16) shows
  `env.MODEL_ROLES = {"writer":"anthropic","supervisor":"mistral","coherence":"openai"}`. The
  "D1 shows the role split" half remains structurally impossible: `llm_calls.task` carries task
  names (`compress`, `parse_jd`, `consensus_poll`…), not the three router roles. That IS row 38
  RELAY-TUNE-COVERAGE-GAP-001, still open.

### Band E — standing sweeps (all green)

| check | result |
|---|---|
| PWA suite `run-tests.mjs pwa` | **1596/1596** (was 1591; +5 new guards) |
| full repo `run-tests.mjs` | **1919/1919** (was 1914), 0 fail 0 skip |
| `boot-smoke.mjs` | OK — `glDemo=function, errors=0` |
| `diag-personal-panel-probe` | **DIAG PASS** — 0 mutations/8s, 0 page errors |
| `diag-copenhagen-overflow-storm` | **DIAG PASS** — ON 2 writes/0px drift/0 err; OFF 1/0px/0 err |
| `diag-panel-button-audit` (row 23 pass 2) | **211 buttons, 0 THROWS, 0 DEAD, 0 page errors** |
| worker live-attest | all four `/health` **200** (antcv-access-relay, cv-proxy, antcv-demo-proxy, docx-worker) |
| PWA live-attest | `antcv.pages.dev/sw.js` CACHE `1.51.4326-claude-rate` == repo TARGET |

Row 23's pass 2 is the leg the 2026-08-20 CI nightly explicitly could not run (exceeds the 2-min CI
tool budget). Artifacts: `PANEL_BUTTON_AUDIT_2026-08-20.{json,md}`.

## Blocker closed

**ANTCV-TOKEN-EXPIRED-2026-08-14-001 stays closed.** `~/.antcv/token` re-saved 2026-08-20 08:48,
JWT `exp` 2026-08-27 — valid. The Cloudflare D1 MCP connector answers again. Both live-evidence
blockers from 2026-08-17 are gone, and that is how tonight's cost evidence was gathered at all.

## Owner actions

1. **Rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN`** (CI-CF-TOKEN-EXPIRED-001). Worker deploys
   remain desktop-only, which is how tonight's relay deploy went out.
2. **Decide the PWA-side mistral rate** (LLM-COST-MISTRAL-RATE-001). The server half is fixed;
   the client meter still shows `{3,9}` against the audited `[2,6]`. Needs a bundle change plus
   the cache-bust quintet and a shift lane.
3. **`gemini-2.5-flash` public rate** (LLM-COST-GEMINI-RECONCILE-001). Three tables still disagree
   ([0.10,0.40] audited / [0.075,0.30] D1 / [0.15,0.60] PWA). The D1 override still wins, so this
   is unchanged by tonight's fix — deliberately, since writing a guessed number into a production
   D1 row is the worse risk. Verify the rate, then align all three in one pass.
4. **Consider backfilling `llm_provider_costs`** with current model pins, or dropping the D1
   override so one table governs. A production D1 write is owner-gated; not done here.
5. Carried: the two-real-device test (row 19), the mobile foreground gen A/B (A1 flip-default),
   and application **3488** (superseded defective CIP generation, replaced by 3489) still awaiting
   deletion from App History.

## Bottom line

Two verified fixes shipped and pushed, one of them deployed and live-attested against the running
worker, plus a reusable CPU-profile harness that converted the last open PERF-001 suspect from
"plausible" to "excluded". The relay fix closes a gap another routine had filed OPEN the same
morning and had no lane to fix. One new defect filed with a production-cap repro rather than
patched blind. Every register row carries a status word for this run; the register edits ship with
the work. Nothing was half-pushed, and no live check that would have mutated a real account was
run — the two that mattered were satisfied read-only against deployed bundles instead.
