# Google Custom Search (CSE) — setup for the CLUSTER-QUAL-001 weekly demand-seed tuning

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

_Owner: 2026-07-05. Part of CLUSTER-QUAL-001 stage 4 (spec §7.6, weekly refresh)._
