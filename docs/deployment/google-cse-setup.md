# Google Custom Search (CSE) — setup for the CLUSTER-QUAL-001 weekly demand-seed tuning

> **⚠ SUPERSEDED — USE BRAVE, NOT CSE (2026-07-10).** Google CSE never worked on the
> `antcv-access` project (403 / JSON-API entitlement not provisioned — the weekly
> demand-tuning routine's own findings confirm this, and pursuing the org/DNS route is a
> dead end). The relay's search backend is now **Brave Search**: `POST /api/research`
> (body `{q, num, dateRestrict, siteSearch}`, auth = the owner JWT + browser UA) returns
> `{ok, source:"brave", items:[{title, link, snippet}]}`. `env.BRAVE_API_KEY` is set on the
> relay; a caller may also pass its own key via the `x-brave-key` header (BYOK-BRAVE-001).
> **The weekly demand-seeding job should call `/api/research` (Brave), not CSE.** A working
> distil pattern to copy: `src/islands/JobTracker` `webCompanyBrief()` — research() → askAI
> distils a compact structured brief. The `POST /api/cluster-demand-research` writer
> (`source='research'`, §7.6) is unchanged; only swap the *search* leg CSE→Brave. The rest of
> this doc is retained for historical reference only.


The client demand seed (`pwa/antcv-cluster-demand.js`, 9 clusters, spec 7.6) is
kept current by a **weekly tuning** pass that re-researches each cluster's most
demanded qualifications from live job postings. That research reads current
postings from the open web plus **Jobindex.dk** (Danish market), **Glassdoor**,
and **Google Careers**. To query those programmatically it uses Google's
**Programmable Search Engine** (a.k.a. Custom Search / CSE) + the **Custom Search
JSON API**.

This doc is the step-by-step to obtain the two credentials the tuning job needs:

- `GOOGLE_CSE_ID` — the Search-engine ID (`cx`)
- `GOOGLE_CSE_KEY` — the Custom Search JSON API key

Until both are set the weekly job falls back to plain web search (lower volume,
no Jobindex/Glassdoor site-scoping), so this is an upgrade, not a hard blocker.

---

## 1. Create the Programmable Search Engine (gets you the `cx`)

1. Go to **https://programmablesearchengine.google.com/** and sign in with the
   Google account you want to own this (a normal Gmail is fine; free).
2. Click **Add** / **Create a search engine**.
3. **Name** it e.g. `AntCV job-demand research`.
4. **Sites to search.** Google's current flow forces you to add at least one
   site here — the "Search the entire web" option is no longer on the create
   screen (it moves to Setup → Basics *after* creation). We don't need entire
   web anyway: site-scoped is exactly what the tuning job wants. Add each of
   these (type it, click **Add**, repeat) — these are the accepted patterns
   (bare public suffixes like `*.dk` / `*.com` are rejected; a specific
   registered domain is fine):
   ```
   *.jobindex.dk
   *.glassdoor.com
   www.linkedin.com/jobs/*
   *.thehub.io
   *.it-jobbank.dk
   www.google.com/about/careers/*
   ```
   (`jobindex.dk`, `thehub.io`, `it-jobbank.dk` are strong Danish/Nordic boards;
   Glassdoor + LinkedIn jobs are the broad market; the last is Google's own
   postings. You can add/remove sites any time later.)
5. Create it. Open the engine's **Overview / Basics** page and copy the
   **Search engine ID** — a string like `a1b2c3d4e5f6g7h8i`. **That is your
   `GOOGLE_CSE_ID` (`cx`).**
6. (Optional) In Setup → Basics you *can* flip **"Search the entire web"** on if
   you ever want unscoped results — not needed for the tuning job. Leave
   **SafeSearch** default; turn **Image search** off (irrelevant to us).

## 2. Enable the Custom Search JSON API + create the API key (gets you the key)

1. Go to **https://console.cloud.google.com/** and select or create a project
   (e.g. `antcv-research`).
2. **APIs & Services → Library →** search **"Custom Search API"** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key.**
4. Copy the key (`AIza…`). **That is your `GOOGLE_CSE_KEY`.**
5. **Restrict the key** (Credentials → click the key → *API restrictions* →
   restrict to *Custom Search API*). This makes the key safe to store as a
   Worker secret — it can only call Custom Search.

## 3. Free quota

- The Custom Search JSON API free tier is **100 queries/day**. The weekly tuning
  job needs roughly **2–4 queries per cluster × 9 clusters ≈ 20–40 queries per
  run**, so once a week is comfortably inside the free tier.
- Paid tier (if you ever want more) is **$5 per 1,000 queries**, capped at
  10k/day — not needed for weekly tuning.

## 4. CSE-PROXY-001 — the weekly job never touches the raw key

The weekly demand-tuning job (CLUSTER-QUAL-001 §7.6) is a **scheduled Claude
Code session**, not this repo's Cloudflare Worker — it cannot read a Worker
secret directly. So the raw, billable `GOOGLE_CSE_KEY` lives ONLY as a
Cloudflare secret on **access-relay**, and the weekly job instead calls a
small proxy endpoint the Worker exposes:

```
GET https://<access-relay-domain>/api/cse-search
      ?q=<query>
      &siteSearch=jobindex.dk     # optional, per-source scoping
      &dateRestrict=m3            # optional, defaults to m3 (last 3 months)
      &num=10                     # optional, defaults to 10, clamped 1..10
Header: x-antcv-cse-token: <CSE_PROXY_TOKEN>
```

The Worker holds the real `GOOGLE_CSE_KEY` + the `cx` and constructs the
actual Google request server-side; the caller only ever needs
`CSE_PROXY_TOKEN` — a **separate, self-issued, narrow-scope, trivially
rotatable** secret whose only capability is calling this one proxy endpoint.
This is the SAME pattern this repo already uses for
`/api/security-alert` + `SECURITY_ALERT_TOKEN` (see `SECURITY-WEEKLY-001` in
`workers/access-relay/src/index.js`).

Set both secrets on access-relay (once the endpoint is deployed):
```
npx wrangler secret put GOOGLE_CSE_KEY      # the real AIza... key — Worker-only, never leaves Cloudflare
npx wrangler secret put CSE_PROXY_TOKEN     # a fresh random token, e.g.: openssl rand -hex 32
```
The weekly job's scheduled-trigger config is given only `CSE_PROXY_TOKEN` (not
`GOOGLE_CSE_KEY`) — losing that token only exposes our own scoped search
proxy, never the billable Google credential.

> Never paste `GOOGLE_CSE_KEY` into a commit, PR body, screenshot, or a
> scheduled-trigger prompt — it goes directly into a Cloudflare secret only.

## 5. Query shape the Worker uses internally (reference)

```
GET https://www.googleapis.com/customsearch/v1
      ?key=GOOGLE_CSE_KEY
      &cx=<cx>
      &q=<cluster search terms>
      &siteSearch=jobindex.dk        # per-source scoping (optional)
      &siteSearchFilter=i            # i = include only that site
      &num=10                        # up to 10 results per call
      &dateRestrict=m3               # last 3 months, keeps postings current
```

The job runs one such query per (cluster × source), collects the result
snippets/titles, extracts the recurring required/preferred qualifications, and
proposes an updated top-20 per cluster — opened as a **draft PR** for review, so
nothing changes production without a human merge.

---

## 6. KNOWN ISSUE (opened 2026-07-10, still OPEN) — persistent 403 despite fully-correct setup

The weekly run on 2026-07-10 hit `/api/cse-search` returning `502` with a wrapped
Google `403 PERMISSION_DENIED: "This project does not have the access to Custom
Search JSON API."` on every single call — before AND after this session and the
owner jointly verified, in order:

1. Custom Search API shows **Status: Enabled** on the exact GCP project (`antcv-access`).
2. A billing account (`01FF2F-F60222-E7BD65`) is **linked** to that project.
3. The API key (`AntCV_Seeker`, then rotated to `AntCV_Seeker_2`) is **present in
   that exact project**, restricted to allow only Custom Search API, Application
   restrictions: None.
4. The Quotas page shows "Custom Search API — Queries per day" **actively
   incrementing** (so requests do reach Google and get routed correctly).
5. Calling `https://www.googleapis.com/customsearch/v1` **directly** (bypassing
   this repo's Worker entirely) with the real key + real `cx` reproduces the
   *identical* 403 — ruling out anything in this repo's code/proxy.
6. Google's own **API Explorer** ("Try this API") against the SAME `cx` with
   Google's own demo credentials returns a working `200` with real results —
   ruling out the search engine (`cx`) itself or a Custom-Search-wide outage.

So: right project, right billing, right key, right `cx`, requests reaching
Google and being quota-counted — and still denied. This is a Google-side
account/project **entitlement hold** that isn't visible anywhere in the console
UI checked so far. **A Google Cloud Support case was opened 2026-07-10** citing
this exact evidence trail; resolution is pending on their side, not ours.

**For the next weekly run:** re-test the proxy first (per the runbook's own
"one simple test query before the full pass" step) — do NOT assume this is
fixed just because time has passed, and do NOT assume it's still broken either.
If it's still 403ing and the Support case is still open, the documented
fallback is: proceed with plain WebSearch research only (reduced Nordic/Danish
site-scoped coverage), same as the 2026-07-10 run did, and note it in that
week's PR.

**Update 2026-07-13 — Brave-first workaround shipped in code (relay
`auth-33-cse-brave` / 1.3.12).** `/api/cse-search` now mirrors
`/api/research`'s backend order: **Brave Search first** whenever
`BRAVE_API_KEY` is set on access-relay (it already is — it powers
`/api/research`), Google CSE only as the fallback when no Brave key exists.
Same query mapping as `/api/research`: `siteSearch` becomes a `site:` prefix,
`dateRestrict` (`y*/m*/w*`) maps to Brave `freshness` (`py/pm/pw`), items come
back as `{title, link, snippet}`. The `CSE_PROXY_TOKEN` gate is unchanged.
**Not live until a manual Worker deploy**: `.github/workflows/deploy.yml` →
workflow_dispatch, mode=deploy, confirm=access-relay. Until that deploy runs,
production still serves the Google-only handler and still 403s. The Google
Support case stays open — it now only affects the fallback path.

## 7. FIXED BUG (found 2026-07-10, fixed 2026-07-13) — `GOOGLE_CSE_ID` secret was dead code

`workers/access-relay/src/index.js`'s `/api/cse-search` handler does **not**
read `env.GOOGLE_CSE_ID` at all — the `cx` value is a **hardcoded constant**:

```js
// CSE ID is not sensitive (it's embedded in the public cse.js widget
// snippet Google itself generates) — safe as a plain constant.
const CSE_ID = '67ce5387bc18f4028';
```

So step 4 above ("Set both secrets on access-relay") is misleading for
`GOOGLE_CSE_ID` today: setting it via `wrangler secret put GOOGLE_CSE_ID` has
**zero effect** — the Worker ignores it and always uses the hardcoded value.
This happened to be harmless during the 2026-07-10 investigation (the hardcoded
`cx` matched the intended Programmable Search Engine), but it means:

- If the search engine (`cx`) is ever regenerated/replaced, this hardcoded
  constant must be updated **in code** (a deploy), not by rotating a secret.
- The `wrangler secret put GOOGLE_CSE_ID` instructions in §4 above should either
  be removed (if the constant approach is intentional/permanent — it *is*
  low-sensitivity, per the comment) or the code should be fixed to read
  `env.GOOGLE_CSE_ID || CSE_ID` so the secret actually does something.

Not fixed in this doc-only session (weekly demand-tuning runs don't touch
Worker code) — flagged here + in `docs/qa/MASTER_BACKLOG.md` for a proper code
session to pick up.

**FIXED 2026-07-13 (same PR as the §6 Brave-first change, relay
`auth-33-cse-brave`):** both Google CSE call sites (`/api/cse-search` and the
`/api/research` fallback) now read

```js
const CSE_ID = env.GOOGLE_CSE_ID || '67ce5387bc18f4028';
```

so `wrangler secret put GOOGLE_CSE_ID` works as §4 documents, and a rotated
search engine is a secret update, not a deploy. The literal stays as the
fallback for installs without the secret. Regression-locked in
`workers/access-relay/tests/cse-search-proxy.test.mjs`. Same deploy gate as
§6: not live until the manual access-relay deploy. Note the Google path only
runs at all when `BRAVE_API_KEY` is unset (see §6).

## 8. The research WRITER — `POST /api/cluster-demand-research` (built 2026-07-13)

The weekly job does two things: (a) RESEARCH the demand (this doc's §1–7), and
(b) WRITE the result into the global demand model so the live D1 path
(`cluster_top_qualifications`, read by `GET /api/cluster-top20`) tracks the
market. Leg (b) — the production `source='research'` writer — was unbuilt until
2026-07-13 (before that, the 2026-07-10 run wrote D1 by hand). It now exists:

**Endpoint (access-relay):** `POST /api/cluster-demand-research`, token-gated by
a **dedicated** `CLUSTER_RESEARCH_TOKEN` (least privilege — this WRITES the
demand model, so it is deliberately NOT the read-only `CSE_PROXY_TOKEN` and NOT
a signed-in user JWT). Body is the research JSON's own `clusters` map:

```
POST /api/cluster-demand-research
Header: x-antcv-cluster-research-token: <CLUSTER_RESEARCH_TOKEN>
{ "date": "2026-07-13", "clusters": { "pm_process": { "top20": [ {"q": "...", "r": 1}, ... ] }, ... } }
```

It writes each cluster's top-20 into `application_qualification` under the
`__global_market__` sentinel with `source='research'`, `application_id` NULL
(so research never inflates the "based on N jobs" `jd_count`), and a
**rank-scaled** weight `RESEARCH_WEIGHT * (21 - rank) / 20` (rank 1 → 0.4 …
rank 20 → 0.02) so `recomputeClusterTop20`'s `SUM(weight)` ordering preserves
the researched order deterministically — a flat weight would tie every research
qual and lose the order the generation prompt reads back. Every research weight
stays ≤ `RESEARCH_WEIGHT` (0.4) < a single real required-JD qual (1.0), so real
user-JD signal still overtakes research as it accumulates. Idempotent per
cluster (DELETE this cluster's `source='research'` rows, then INSERT — real
`jd` rows untouched); inserts all clusters, then recomputes each.

**Push script (the routine's one-command write step):**
```
ANTCV_RELAY_URL=https://<relay> CLUSTER_RESEARCH_TOKEN=<tok> \
  node scripts/cluster-demand-research-push.mjs           # newest docs/analysis/cluster_top20_research_*.json
  node scripts/cluster-demand-research-push.mjs --dry-run # print the body, do not POST
  node scripts/cluster-demand-research-push.mjs --file docs/analysis/cluster_top20_research_2026-07-13.json
```
It forwards the newest research JSON's `clusters` (only `{q, r}` per item,
stamped with the file's `generated` date). This replaces the hand-written D1
step. Tests: `workers/access-relay/tests/cluster-demand-research-writer.test.mjs`
(12) + `scripts/tests/cluster-demand-research-push.test.mjs` (6).

**Provisioning (owner, one-time) + deploy gate:**
```
openssl rand -hex 32 | npx wrangler secret put CLUSTER_RESEARCH_TOKEN   # on access-relay
# then deploy access-relay: .github/workflows/deploy.yml -> workflow_dispatch, mode=deploy, confirm=access-relay
```
The same token must be given to the `antcv-demand-seed-weekly` scheduled task
(as `CLUSTER_RESEARCH_TOKEN`, alongside `ANTCV_RELAY_URL`) so its write step can
run. **Not live until that access-relay deploy runs** (worker deploys are
owner-gated); until then the routine keeps refreshing the client SEED
(`pwa/antcv-cluster-demand.js`, the cold-start read path) as before, and the D1
rollup stays at its last hand-populated state.

---

_Owner: 2026-07-05. Part of CLUSTER-QUAL-001 stage 4 (spec §7.6, weekly refresh)._
_Updated 2026-07-10: logged the persistent entitlement 403 (Support case open) and the `GOOGLE_CSE_ID` dead-secret bug found while diagnosing it._
_Updated 2026-07-13: built the production `source='research'` writer (§8) — `POST /api/cluster-demand-research` + `scripts/cluster-demand-research-push.mjs`, closing OPEN_REGISTER row 9's writer gap; deploy owner-gated._
