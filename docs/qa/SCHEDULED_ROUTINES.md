# Scheduled / recurring routines — register + NIGHT SHIFT framing

Every routine below runs autonomously and pushes to `origin/main` (or deploys a worker),
so every one is a parallel session that can collide with the desktop, the cloud Routine, or
another routine. **They are all bound by the same discipline** (`CLAUDE.md` § Sync discipline
+ `docs/qa/NIGHT_SHIFT.md`):

> **STANDING RULE for every scheduled routine.** At the start of each run: (1) `git fetch origin
> && git pull --rebase origin main`; (2) if the run will consume a version number (any `pwa/`
> cache-bust) or touch files a parallel session might, `node scripts/shift.mjs claim --task
> "<routine-name>"` and work in the printed `git worktree`; (3) use version numbers only inside
> the claimed range; (4) `node scripts/shift.mjs release` at the end. A routine that only reads,
> or only writes data/docs, may skip the claim but still SYNCs FIRST and never force-pushes.
> `node scripts/shift.mjs status` reads origin, so it is correct even from a dirty tree.
>
> **(5) END-OF-RUN REGISTER REPORTING (owner 2026-07-13, mandatory for every agent-driven
> routine).** Before the run ends, write its outcome into the repo registers and push:
> advance/refresh every touched row in the register (bugs + tasks — add a row for
> any NEW bug or task the run discovered). **Since the 2026-08-26 split the register is FOUR
> files:** `docs/qa/OPEN_REGISTER.md` is a slim INDEX (number, ticket ID, one `verified:` date,
> one line of scope, stalest first); `REGISTER_ACTIVE_DETAIL.md` holds the verbatim row text and
> history; `REGISTER_CLOSED.md` holds finished rows; `REGISTER_RUNLOG.md` holds the run
> summaries. So: **your run summary goes to the TOP of `REGISTER_RUNLOG.md`, never into the
> index** (the index is capped and a run blockquote there fails the check); advancing a row means
> editing its `## Row N` section in the detail file AND setting today's date in the index's
> `verified` column; a NEW row needs an index line, a matching detail section, a ticket ID, and
> the next number above the highest already used across all four files — parallel routines have
> collided on row numbers before. Run `node scripts/check-register.mjs` before pushing (it also
> runs in the PWA suite). Then log every code fix in `docs/qa/ACTIVE_BUGS.md` (top
> block); register any feature shipped or advanced in `docs/FEATURES_REGISTRY.md`; and update any
> other register the run touched (dated NIGHTLY/SESSION report, COST_QUALITY log, etc.). Commit +
> push the register edits with the work (docs-only edits need no shift claim, but SYNC FIRST). A
> run whose outcome lives only in chat is NOT complete. Non-agent routines (the GitHub weekly
> security audit, the relay 5-min health cron, the demo-proxy model-freshness cron) are scripts
> and cannot write registers — the next agent nightly's standing register sweep transcribes any
> finding they surface into OPEN_REGISTER/ACTIVE_BUGS.

Each routine's own prompt/config (in the scheduled-tasks store, outside the repo) should point
at this file so the rule travels with it. The authoritative live list of triggers is the
scheduled-tasks store + memory `scheduled-jobs-map`; this doc is the framing + the review-and-tune
routines' procedures.

## STANDING RULE 0 — PREFLIGHT + HEARTBEAT (owner 2026-07-21, mandatory for every agent routine)

**Why (reliability audit 2026-07-21).** These are desktop-app-local scheduled tasks: they run
only while the Claude app is open, and a task due when it is closed defers to the next launch
(multiple missed days coalesce into one catch-up). Two failure modes fell out of that:
- **Collision with the owner's interactive session.** A deferred run fires into the *shared main
  clone* while the owner is working there; the dirty tree blocks its `git pull --rebase`, the
  shift-claim auto-push tangles, version ranges collide — so the run silently aborts or half-runs
  (evidence: 2026-07-18 + 07-20 produced no run at all though the app was used; 07-14 the nightly
  left no report while job-tracker committed).
- **Silent no-op = invisible failure.** A run that fires and does nothing (demand-seed 2026-07-17
  fired at 20:02 but wrote no report and pushed nothing) is indistinguishable from never running.

**The rule.** Every agent-driven routine, as its FIRST and LAST action:

```
# FIRST (before SYNC FIRST): log liveness + get a workspace verdict
node scripts/routine-preflight.mjs start --routine <this-routine-name>
#   exit 0 "WORKSPACE CLEAN"  → SYNC FIRST + work in this clone as normal.
#   exit 3 "WORKSPACE DIRTY"  → do NOT rebase/edit here; run the printed `git worktree add
#            origin/main` line and do ALL work in that worktree (this is what stops the collision).

# LAST (always, even on a no-op or a blocker — this is what makes a silent failure visible):
node scripts/routine-preflight.mjs end   --routine <name> --status ok|no-op --summary "<one line>"
node scripts/routine-preflight.mjs error --routine <name> --summary "<why blocked>"   # on abort
```

The heartbeat ledger is local (`~/.claude/scheduled-tasks/ROUTINE_HEALTH.jsonl`) — no push, no new
pusher, no collision. `node scripts/routine-preflight.mjs report --days 14` prints the recent runs
and flags any that STARTED but never ended (crashed / killed / silent). Check it to answer "did the
routines actually run?" — a start with no matching end is the alarm the old setup lacked.

**Scheduling (owner 2026-07-21).** The two nightlies moved off 03:30/03:45 (app almost never open
then → always deferred) to a morning window the app is reliably open in and staggered wider:
antcv-nightly 08:00, antcv-job-tracker-nightly 08:45. The evening weeklies (Wed/Fri/Sun+Tue 22:00)
stay — the app is usually open then; worktree isolation (rule 0) handles their collision risk.

**Substrate note (structural, owner-gated).** Reliability is ultimately capped by the desktop app
being open. The only fixes that run independent of this machine: (a) pure-script routines belong on
GitHub Actions cron — the weekly security audit already proves this substrate; the one AntCV routine
whose CORE is scriptable is the cost-quality tune's *proposal+report* half (`relay-cost-quality-tune.mjs`),
apply+deploy still owner-gated. (b) The web-research + judgment routines (position-discovery,
demand-seed, the nightlies) cannot move to Actions — they need an agent; the true "runs even when my
machine is off" path for those is a **claude.ai cloud routine**, created from the claude.ai UI.

## Routine register

| Routine | Cadence | Pushes to main / deploys? | Claim required | Notes |
|---|---|---|---|---|
| `antcv-position-discovery` | bi-weekly (Sun + Tue 22:00) | data only (Excel/D1 PROPOSED rows) | no (data-only) — SYNC FIRST | Finds NEW openings vs the Dream Envelope, propose-only. `scripts/job-tracker/discover-positions.py`; memory position-discovery-task. ⚠ **Two of its five mandatory sources need `scripts/job-tracker/job_sources.py` — a hand-fetch of their search pages returns nothing. It should also run the obsolescence sweep. See "Position-discovery sources + the obsolescence sweep" below.** |
| antcv-job-tracker-nightly | nightly | yes (gen-runner may commit; may bump islands/app) | **yes** | Generates/persists tracked applications. `scripts/job-tracker/gen-runner.py`. |
| antcv-nightly | nightly | yes (PWA/worker fixes) | **yes** | Verify-first backlog work; ships cache-busted PWA changes → always claim. |
| weekly demand-seed (CLUSTER-QUAL) | weekly | yes (worker + D1 top-20 refresh) | **yes** (if it ships code) | Cluster demand model refresh. Partly unbuilt. LIVE TRIGGER since 2026-07-13: scheduled task `antcv-demand-seed-weekly` (Fri 22:00) — before that the routine existed only on paper (one manual run 2026-07-10). ⚠ **Its stored prompt's step 4 is WRONG — see "Demand-seed step 4" below before running it.** |
| **relay cost-quality tune** (RELAY-COST-QUALITY-TUNE-001) | **weekly** | **yes (proxy `MODEL_ROLES` + deploy)** | **yes** | See the procedure below. Reviews the week's router telemetry AND modifies the routing function so it improves over time. LIVE TRIGGER since 2026-07-13: scheduled task `antcv-relay-cost-quality-tune` (Wed 22:00); 'gen'-role flips stay owner-gated. |
| weekly security audit | weekly | report only | no | Read-only audit → report. |
| relay health probe | ~5-min | none (alert only) | no | Liveness. |
| model-freshness check | daily | none/report | no | Flags stale model ids. |

### Position-discovery sources + the obsolescence sweep (found + fixed 2026-08-26)

Two defects, both found by the 2026-08-26 discovery run. **This section is the authority; the
stored task prompt is not** — like the demand-seed case below, the prompt is an account-level
scheduled task that a run cannot edit.

**JOBSRC-FETCH-001 — two mandatory sources were unreadable, and failed SILENTLY.**

| Source | What the prompt implies | Reality | Use instead |
|---|---|---|---|
| `jobbank.dk` | a search endpoint | `/en/job-search?searchterm=` **404s** — that URL never existed | `https://www.jobbank.dk/job/?soegeord=<q>` |
| `jobindex.dk` | read `/jobsoegning` | the result page paints its ads **client-side**; a fetch returns nav chrome and **zero ads** | `https://www.jobindex.dk/jobsoegning.rss?q=<q>` (same result set, server-rendered) |

Both failure modes look identical to "the source was dry", which is why the weekly-target
shortfall read as market conditions rather than a broken fetch. Two further traps, both handled
in the shipped fetcher:

- **jobbank ads carry no `<a href>` at all.** Each ad is a `div.job-item` whose destination lives
  in an inline `onclick="document.location.href='/job/<id>/<company>/<title>/'"`. A link scrape
  returns nothing, which is exactly the empty result the run saw.
- **Both hosts mis-declare their charset.** jobindex is ISO-8859-1; jobbank sends a UTF-8
  `Content-Type` while serving cp1252. Trusting the header mojibakes every Danish letter and
  then breaks company-name matching downstream, so the fetcher sniffs.

```
python scripts/job-tracker/job_sources.py search --q "produktchef" --source all --json
```

Returns `{source,title,company,location,url,posted,deadline}` per ad and drops any ad whose
stated `Frist:` has already passed. Tests: `scripts/job-tracker/test_job_sources.py`.

**The other three mandatory sources were verified working on 2026-08-26** — LinkedIn guest
search (`/jobs/search?keywords=&location=&f_TPR=`) is the strongest of the five and returned
54/60/20/12 rows across four queries; TheHub returned 15. Google Jobs was not separately
exercised that run.

**POSTING-OBSOLETE-001 — obsolete postings were never detected, so dead roles never left the list.**

Run this on every discovery run and every job-tracker nightly, BEFORE proposing or generating:

```
python scripts/job-tracker/check-postings.py check --apply
```

It probes each row's posting URL and archives the obsolete ones by reusing the mechanism the
island already has — band → `D9D9D9` (Archive), tracked status → `Archive / closed`,
`queue[uk]=false`. `defaultJLFilters()` in `JobTracker.tsx` leaves Archive unchecked, so an
archived row disappears from the Job List on the next doc load and the owner can tick the
Archive swatch to see it again. **Nothing is deleted** (hide over delete), and **no PWA asset is
touched**, so this needs no cache-bust and no shift claim.

Evidence is **graded**, because archiving a live role is worse than carrying a dead one for two
days:

| Verdict | Meaning | Effect |
|---|---|---|
| `CLOSED` | the page says so in words ("no longer accepting applications", "stillingen er besat") | archives on **first sight** |
| `EXPIRED` | stated deadline has passed, or the board moved the ad to its own archive (jobindex 301s expired ads through `/arkiv/vis/` to `jobindexarkiv.dk`) | archives on **first sight** |
| `GONE` | HTTP 404/410 — absence, not a statement | **two strikes** on separate runs |
| `SUSPECT` | redirected off the posting onto a page with no job identity | **two strikes** |
| `WALLED` | 401/403/429/999/Cloudflare challenge | **never counts** |
| `ERROR` | timeout / DNS / TLS / 5xx | **never counts** |
| `LIVE` | reachable, nothing says otherwise | resets the strike count |

Strikes live per-row in `doc.postingcheck[uk]` — substructure-keyed, so two routines sweeping in
parallel cannot clobber each other's counts through one shared blob. Drop `--apply` for a dry run.

Belt on the generator: `gen-runner.eligible_rows` skips `is_closed_row(row)`. `queue=false` alone
was not enough — the `q is None and not has_art` clause would still elect a hand-archived row that
never carried an explicit queue flag, and that row has a stored JD, so the nightly would spend a
full generation on it.

**First live run 2026-08-26:** 73 rows probed → 52 LIVE, 17 archived (15 `CLOSED`, 2 `EXPIRED`),
4 `GONE` held at strike 1 (Scarlet 410, GEA 404, Trackman 404, spektr 404). Do not force those
four — they archive on the next run that agrees, which is the point.

**Known limit:** the sweep is script-side, so "hidden as soon as it goes obsolete" means "at the
next sweep", not live in the browser. An always-on client-side check was deliberately NOT added —
see the sidecar-global-observer and island-rAF-freeze precedents.

**Stored prompts: DONE 2026-08-26 (owner-approved).** Both scheduled tasks were updated in
`~/.claude/scheduled-tasks/`, so no run has to re-derive any of this:
`antcv-position-discovery` gained a step 1a (`check-postings.py check --apply`) and its source
step now routes jobindex + jobbank through `job_sources.py`; `antcv-job-tracker-nightly` gained a
step 1b running the same sweep before it selects rows, so a dead posting cannot consume a model
call. This section remains the authority if the prompts and the repo ever disagree.

### Demand-seed step 4 — the stored task prompt is WRONG (found 2026-08-18)

The `antcv-demand-seed-weekly` scheduled task's stored prompt tells the run to hand-write D1
rows with a **flat** `weight = 0.4` and a plain `DELETE` + `INSERT` + hand-rolled recompute.
**Do not follow it.** It is wrong on three counts, and the flat weight silently corrupts
production ranking rather than failing loudly:

1. **Flat weight destroys the researched order.** `recomputeClusterTop20` orders purely by
   `ORDER BY weight_sum DESC`, so 20 rows all at 0.4 tie, and the researched rank — which
   `__clusterRule` in `app.js` reads back as "most-demanded first" — collapses to whatever
   order the group-by happens to emit. The shipped writer rank-scales instead:
   `RESEARCH_WEIGHT * (21 - rank) / 20` (0.4 → 0.02). 0.4 is the CEILING, not the value.
2. **A plain delete+insert is lossy.** `insertResearchQualifications` re-inserts any prior
   research qual dropped from the new top-20 at `RETAINED_RESEARCH_WEIGHT` (0.01, below
   rank-20's 0.02), so a curated-out qual can resurface in a later week. A raw delete
   throws it away permanently.
3. **It bypasses a writer that already exists.** Hand-written SQL was the 2026-07-10 stopgap
   that OPEN_REGISTER row 9 tracked; the writer shipped 2026-07-13.

**Correct step 4** — write the dated research JSON first, then:

```
ANTCV_RELAY_URL=https://antcv-access-relay.karp-gabriel-a.workers.dev \
CLUSTER_RESEARCH_TOKEN=<token> \
  node scripts/cluster-demand-research-push.mjs --dry-run   # inspect payload
# then re-run without --dry-run to apply
```

It defaults to the newest `docs/analysis/cluster_top20_research_<date>.json`, forwards the
`clusters` map to `POST /api/cluster-demand-research`, and the relay does the rank-scaled
insert, the union retention, and the per-cluster recompute. It exits non-zero on failure, so
the run can detect a bad push. Direct D1 MCP writes are a fallback for when the relay is
down — and if used, they must replicate all three behaviours above.

**Owner action:** the stored prompt itself lives in the account-level scheduled task, which a
run cannot edit. Replace its step 4 with the block above so the next run does not have to
re-derive this. Until then, this section is the authority and the prompt is not.

### JD-list-updating routines — the ⏰ queue flag is now USER-VISIBLE (JD-MENU-QUEUED-TAB-001, 2026-07-22, PWA `1.51.3081-queued-filter`)

The routines that add rows to or set the queue on the job-tracker doc — **`antcv-position-discovery`**
(`discover-positions.py`, adds rows) and **`antcv-job-tracker-nightly`** (`gen-runner.py`, sets
`doc.queue[uk]=false` after it persists an application) — write the same `doc.queue` map that the
AntCV Job-Tracker **List** now exposes as a **"⏰ Queued" legend filter**. The owner can filter the
list to exactly the rows queued for tonight's generation. Implications for these runs:

- The filter reads `rowQueued(doc, uk)` = **explicit `doc.queue[uk]` wins, else default-ON until the
  row has `doc.artifacts[uk].application_id`** — byte-identical to the ⏰ row toggle. So a row with no
  `queue` entry and no artifact already shows as Queued; once the nightly persists an app it must keep
  writing `queue[uk]=false` (as gen-runner already does) or the row stays visibly Queued.
- This was a **read-only UI add** in the React island (`src/islands/JobTracker/JobTracker.tsx`, built
  into `pwa/antcv-react-islands.js`) — **no doc-schema change**, so nightly writers need no code change;
  they just now have a user-facing consumer of `doc.queue`, so keep that flag accurate.
- Guard test: `pwa/antcv-jobtracker-queued-filter.test.mjs` (in the `pwa` suite).

---

## RELAY-COST-QUALITY-TUNE-001 — weekly review + MODIFY the cost-quality router

**Goal (owner):** the relay cost-quality function must be *reviewed and modified on a weekly
basis so the function is always improving over time* — a closed loop, not just a scorer. Each
week it looks at how every provider actually performed per task, then adjusts which provider
LEADS each task so cost-per-acceptable-output trends down while quality holds.

### The lever
The router (`workers/proxy/src/multi-llm.js`) tries providers in a cascade; `roleHeadOrder(env,
role, baseOrder)` moves the provider named for a role in **`env.MODEL_ROLES`** (a JSON map
`role → providerId` in the proxy `[vars]`, mirrored in demo-proxy) to the HEAD of the cascade for
that role. So **tuning = editing `MODEL_ROLES`** (which provider leads each task); the full cascade
stays as the fallback tail. The adequacy gate + per-task demotion already run at request time —
this routine changes the *starting* choice based on the week's evidence.

### The data
- **`llm_provider_health`** — the rolling-window aggregate the access-relay cron builds from
  `llm_calls` (read this, never `llm_calls` directly). Per (role, provider): call count, ok rate,
  retries, latency, token cost.
- **`llm_quality_signals`** — adequacy-gate outcomes / quality signals per call.
- Ground-truth top-up when telemetry is thin for a role: re-run the benchmark harness
  `scratchpad/bench_{generate,judge,translate}.py` (method + rubric frozen in
  `docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md`) for the affected roles only.

### The weekly procedure
1. **SYNC + CLAIM** a shift range (this deploys a worker → coordinate), work in a worktree.
1a. **MODEL-TABLE FRESHNESS AUDIT (owner 2026-07-13 — do this BEFORE scoring; the tune is only
   as honest as its cost table).** The whole routine scores on `cost_per_call`, so a stale price
   table silently corrupts every decision. Confirm the models AntCV actually PINS are each present
   and correctly priced in BOTH `workers/proxy/src/demo-enforcement.js` and
   `workers/demo-proxy/src/demo-enforcement.js` `RATES`, and present in each `multi-llm.js`
   `PROVIDER_MODELS` cascade. `rateFor()` matches the LONGEST substring key, so a model with no
   explicit entry silently resolves to a shorter neighbour (the trap: `claude-opus-4-8` →
   legacy `claude-opus-4` [15,75] = 3x over; `gpt-5.5` → `gpt-5` [1.25,10] = ~24x under). The
   current pins to verify: flagship/thorough gen `claude-opus-4-8`; default openai gen
   `gpt-5.4-mini` + thorough-tier `gpt-5.5`; preferred cascade `claude-sonnet-5` (see the model-pins
   note in this routine's scheduled prompt + `docs/qa/LLM_ROUTER_PROPOSAL_2026-07-11.md`). Cross-check
   the new head you intend to flip TO is also priced. `node --test workers/proxy/test/model-table-freshness.test.mjs`
   (mirrored in demo-proxy) pins opus-4-8 + gpt-5.5 + gpt-5.4-mini + sonnet-5; if a pin changed and the
   test is red, FIX the table (add/correct the explicit key at the verified public rate, longest-key-wins)
   and extend the test in the SAME run — this is a required modification the routine executes, not
   an optional check. Prices carry an inline date comment; re-verify against the provider's public
   pricing page when you touch one. A wrong rate here is a silent, compounding tuning error.
1a-bis. **CORRECTIONS from the 2026-08-20 fix pass — read these before executing 1a.**
   (i) There are **THREE** `RATES` mirrors, not two: `workers/proxy/src/demo-enforcement.js`,
   `workers/demo-proxy/src/demo-enforcement.js`, and **`workers/access-relay/src/model-rates.js`**
   — the last is the copy the telemetry recompute actually calls (`rateForStrict`), and
   `pwa/test/relay-model-rates-mirror.test.mjs` fails the suite if they drift. Edit all three.
   (ii) "Present in the `PROVIDER_MODELS` cascade" does **NOT** apply to `gpt-5.5`. That object is
   the DEFAULT chain; heading it with a $30/$60 model makes it the default for every openai cascade
   call (~40x the pinned `gpt-5.4-mini`), and tailing it lets a cheap call land there on a fallback.
   `gpt-5.5` is reached only via an explicit `opts.models` override, which is correct, and is now
   pinned as an invariant in `model-table-freshness.test.mjs`. Do not "fix" it.
   (iii) **Verify prices against the vendor's own pricing page, not against the neighbouring table.**
   The 2026-08-20 pass found `mistral-large` at Large-2-era [2,6] (real Large 3: [0.5,1.5]) and
   `gemini-2.5-flash` carrying **Flash-LITE's** [0.1,0.4] (real Flash: [0.30,2.50], 6.25x on output)
   — both had survived every prior freshness pass because the test only checked the four pins.
   (iv) A wrong price here is not just a demo-cap error: RELAY-COST-TIEBREAK-001 and this tune both
   DEMOTE on price, so a stale rate silently steers the router.
1b. **COST-SOURCE AUDIT (added 2026-08-20 — COST-SOURCE-AUDIT-GAP-001).** Step 1a audits the
   `demo-enforcement.js` `RATES` tables, which govern the **demo budget cap**. They do NOT produce
   `llm_calls.estimated_cost_usd` — the number every score in step 3 divides by. That number comes
   from `workers/access-relay/src/telemetry.js` `estimateCostUsd()`, which looks up D1
   `llm_provider_costs` by **exact** `(provider, model)` and falls back to the PWA-reported
   `cost_usd` (the `C` map in `pwa/app.src.js`) on a miss. So the real cost pipeline is a DIFFERENT
   pair of tables. Each week, before scoring: (i) list `llm_provider_costs` and confirm every model
   id appearing in the week's `llm_calls` either has a matching row at the audited rate or has no
   row at all (a row at a WRONG rate silently wins over a corrected PWA map — this is what hid
   LLM-COST-GEMINI-RECONCILE-001 for a month, and note `mistral-large` never matches the live
   `mistral-large-latest`); (ii) confirm the `pwa/app.src.js` `C` map prices each provider at the
   same rate as the audited worker `RATES` (a mismatch here is LLM-COST-CLAUDE-RATE-001 /
   LLM-COST-MISTRAL-RATE-001); (iii) **recompute the week's cost from raw `prompt_tokens` /
   `completion_tokens` at the audited rates and score on THAT**, never on the stored
   `estimated_cost_usd`, unless (i) and (ii) both reconcile to the cent. A production D1 write to
   `llm_provider_costs` is owner-gated — surface a mismatch, do not silently correct it.
2. **Pull** the last 7 days from `llm_provider_health` + `llm_quality_signals` per role
   (extract / parse_jd / compress / gen / coherence / translate / analysis / supervisor).
3. **Score** each provider per role: `costQuality = adequacy_pass_rate / cost_per_call`
   (tie-break: fewer retries, lower latency). Require the adequacy pass rate ≥ the role's floor
   before a provider is eligible to LEAD.
4. **Decide** the new head per role = the eligible provider with the best `costQuality`. Apply
   **bounded** change: flip at most the head per role per week (no wholesale reshuffle); if the
   current head is within a small margin of the best, keep it (hysteresis — avoid flapping).
5. **Guardrails (never violate):** never remove a provider from the cascade tail (fallback must
   survive); never leave a role with no Anthropic fallback reachable; never raise a role's head to
   a provider below its adequacy floor; keep the PRIOR `MODEL_ROLES` value in the commit body for
   one-command rollback.
6. **Ship:** update `MODEL_ROLES` in `workers/proxy/wrangler.toml` + `workers/demo-proxy/wrangler.toml`,
   `gh workflow run deploy.yml -f target=proxy …` (+ demo-proxy), verify each `/health`.
7. **Report:** append a dated block to `docs/qa/COST_QUALITY_BENCHMARK_2026-07-11.md` (or a
   `COST_QUALITY_WEEKLY_<date>.md`) with the per-role before→after head, the scores that drove it,
   and the rollback value. Update the register (OPEN_REGISTER / FEATURES_REGISTRY / ACTIVE_BUGS).
8. **RELEASE** the shift claim.

### Why it improves over time
Each week the head of every role converges toward the best measured cost-quality provider on
*that week's real traffic*, with hysteresis so it doesn't chase noise and guardrails so a cheap-but-
inadequate provider can never win. The dated reports form an audit trail of the function's evolution;
a regression (quality dips after a flip) is visible next week and reverts via the logged rollback.

### Automation — `scripts/relay-cost-quality-tune.mjs`
The scoring + proposal is implemented as `scripts/relay-cost-quality-tune.mjs`. It reads the
current `MODEL_ROLES` from `workers/proxy/wrangler.toml`, pulls the week's health snapshot
(`GET /api/llm-health?window=all` via `ANTCV_RELAY_URL` + `ANTCV_ADMIN_TOKEN`, or `--data
<snapshot.json>` offline), applies the score + guardrails above, and **emits the proposed
`MODEL_ROLES` diff + per-role rationale** — it does NOT deploy. Weekly run:

```
ANTCV_RELAY_URL=… ANTCV_ADMIN_TOKEN=… node scripts/relay-cost-quality-tune.mjs      # dry-run diff
node scripts/relay-cost-quality-tune.mjs --data health.json --apply                 # write both wrangler.toml (still no deploy)
# then review the diff, deploy proxy + demo-proxy via deploy.yml, verify /health, log before→after + rollback
```

Flags: `--floor` (adequacy success-rate floor, default 0.90), `--margin` (cost-quality hysteresis,
default 0.10), `--min-calls` (sample floor, default 20), `--window`, `--apply`, `--json`. The
scoring core (`scoreRows` / `proposeRoles`) is pure + unit-tested (`scripts/tests/relay-cost-quality-tune.test.mjs`,
8 cases: cheaper-wins, hysteresis-holds, floor/min-sample/known-provider guardrails, no-data→keep).
The **apply + deploy stays agent/owner-gated** — a change to `MODEL_ROLES` affects every user's
generation, so the script never ships on its own.
