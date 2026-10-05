# Session Log — 2026-10-05 (CLUSTER-QUAL-001 weekly demand-seed)

Scope: the weekly demand-seed routine (spec §7.6). CLOUD routine run, fired 06:19 UTC.
Branch `claude/weekly-demand-tuning` off `origin/main` `735f6d8f`. Docs-only: no `pwa/`
asset, no worker code, no version consumed, no shift claim.

**Outcome: no material demand shift this week. Zero D1 writes, no seed change.**

## Cadence — why there was nothing to find

The previous run completed **13 hours earlier** (2026-10-04, desktop Gabo-PC, seed
`1.51.4792`), and it was a full pass: all 9 clusters re-researched, 2 reordered, 7
re-confirmed, D1 push `{"ok":true,"clusters_updated":9,"total_inserted":226}`. A demand
window cannot move in 13 hours, so this run's job was verification, not curation.

Primary sources were re-queried anyway rather than assumed:

- **IT-Branchen / Jobindex quantitative analysis** — same figures the 10-04 run cited:
  security ~19% of all IT postings, cloud 14.5%, AI/ML 12.3%; AI/ML postings 387 -> 1,326
  YoY (+242.6%); ten tracked competencies 3,821 -> 8,768 (+129.5%).
- **LinkedIn Skills on the Rise 2026** — same themes already encoded in the seed: AI
  engineering, operational efficiency, AI business strategy, cross-functional
  collaboration, team management, mentorship, go-to-market strategy, process optimisation.

Nothing was published in the interval. No rank moved, so spec §6 applied: no D1 write, no
seed edit, no cache-bust.

## Gates

**Gate 1, SEARCH leg: PASS — the first time this routine has ever reached site-scoped
Danish search.** `GET /api/cse-search?q=software engineer&siteSearch=jobindex.dk&dateRestrict=m3`
-> **200** `{"ok":true,"source":"brave"}`, 10 real Jobindex hits. This closes the search
half of register row 102, open since 2026-08-26 and the stated blocker for four skipped
runs (09-14, 09-21, 09-28, 09-29).

Negative controls were run before claiming it:

| probe | result |
| --- | --- |
| correct token | 200, real items |
| deliberately wrong token | 401 |
| no token | 401 |
| unknown path | 401 `unauthenticated` (the *different* body) |

So the guard is still fail-closed, and `workers/access-relay/src/index.js:5027-5030` is
unchanged strict equality (`!env.CSE_PROXY_TOKEN || tok !== env.CSE_PROXY_TOKEN`). The 200
means the Worker secret now EQUALS the routine's env value. **Not** code drift, **not** an
auth bypass.

**But the fix was applied the wrong way round.** The routine's `CSE_PROXY_TOKEN` is still
the 39-char `AIza`-prefixed **Google API key** root-caused on 2026-09-21. It authenticates
only because that same billable Google credential was copied into the relay secret, rather
than both sides being moved to `openssl rand -hex 32` as `docs/deployment/google-cse-setup.md`
§4 requires. The 09-21 warning stands in full: a billable Google key is now serving as a
bearer token *and* sitting in a scheduled-trigger env. Owner-owed: rotate the `AIza…` key,
generate a 64-hex token, set it on the relay and in the routine env. The value was never
printed, logged or committed — only its length and prefix were read.

**Gate 2, WRITE leg: STILL BLOCKED, and now isolated to the cloud env.**
`POST /api/cluster-demand-research` with `{"clusters":{}}` (writes nothing, isolates auth)
-> **401 `unauthorized`** on the cloud's 51-char `CLUSTER_RESEARCH_TOKEN` — 13 hours after
the same route accepted the DESKTOP value (`total_inserted:226`). The two envs hold
different write tokens.

Consequence: **a cloud run that finds a real demand shift cannot persist it.** No impact
this week, because nothing shifted and nothing was owed. The next cloud run that does find
one stops at step 4b. Fix: set the cloud routine's `CLUSTER_RESEARCH_TOKEN` to the value the
relay holds, then re-probe for **400** `no_known_clusters`.

## Verification

**D1 (read-only, D1 MCP).** 9 clusters x 20 rows, ranks 1..20 contiguous, `rows_written: 0`,
every `updated_at` from the 10-04 push. Nothing mid-edit. The hand-rolled-SQL fallback was
not used — it is authorised only when the relay is DOWN, and the relay is UP.

**Client SEED.** `pwa/antcv-cluster-demand.js` v`1.51.4792` is **180/180** rows identical to
`docs/analysis/cluster_top20_research_2026-10-04.json` — `r`, `q` and `share` all equal for
every item in every cluster. `activeClusters()` = 9 when unsolicited, `["executive"]` on an
executive JD. **`classifyJD` 9/9 correct** on one synthetic JD per cluster. `score()` 21.0 on
a commercial-growth line, 0 on nonsense.

> **Harness note for future runs:** `classifyJD()` takes **no argument** — it reads
> `localStorage['antcv:lastJdText']` (`pwa/antcv-cluster-demand.js:320-321`). A sandbox check
> that passes the JD as a parameter gets `null` for all 9 clusters and looks like a seed
> defect. Stub `localStorage.getItem` first.

## Method finding — proxy evidentiary limit re-probed, partly refined

The 2026-08-18 "corroboration only, never moves a rank" rule **STANDS**. Snippet quality is
still mixed: the Danish requirement-phrased query returned genuine requirement lines, while
English and tool-name queries returned browser-upgrade notices and company-profile chrome.

| query | jobindex.dk | it-jobbank.dk |
| --- | --- | --- |
| `projektleder krav erfaring` | 200, 10 items, real requirement text | 200, **2 items, real requirement text** |
| `data analyst Power BI SQL` | 200, 7 items, mostly chrome | 200, **0 items** |
| `photonics optical engineer` | 200, 6 items, company-profile chrome | 200, **0 items** |

One refinement to the 10-04 note: **it-jobbank.dk is not uniformly empty** — it answers
Danish-language requirement-phrased queries and returns nothing for English tool-name
queries. A future run wanting Danish requirement evidence should query in Danish, in
requirement phrasing. No rank was moved on proxy evidence this run.

## Register

- **Row 102 advanced** — search leg CLOSED from the cloud; write leg and credential-hygiene
  leg remain OPEN, both owner-owed, both now precisely isolated.
- **Row 117** (`CLUSTER-GLOBAL-SINGLE-JD-DOMINANCE-001`) untouched — still owed an owner
  design decision on how JD signal blends into `__global_market__`.

## Owner actions

1. **Rotate the `AIza…` Google key** and replace `CSE_PROXY_TOKEN` on BOTH the relay and the
   routine env with `openssl rand -hex 32`. The search leg works today, but on the wrong kind
   of credential.
2. **Set the cloud routine's `CLUSTER_RESEARCH_TOKEN`** to the relay's value (the one the
   desktop uses). Until then the cloud routine is read-only and cannot persist a shift.
3. **Row 117** design decision.
