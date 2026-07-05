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
4. **What to search:**
   - Choose **Search the entire web** (recommended — the tuning job scopes to
     specific sites per query with the `siteSearch` parameter), **or**
   - restrict it to the sites we care about by adding, under *Sites to search*:
     `jobindex.dk`, `glassdoor.com`, `careers.google.com`, `linkedin.com/jobs`.
     (Entire-web + per-query `siteSearch` is more flexible; pick that if unsure.)
5. Create it. Open the engine's **Overview / Basics** page and copy the
   **Search engine ID** — a string like `a1b2c3d4e5f6g7h8i`. **That is your
   `GOOGLE_CSE_ID` (`cx`).**
6. (Optional but recommended) In the engine settings turn **Image search** off
   and leave **SafeSearch** default; nothing else matters for us.

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

## 4. Hand the two values to AntCV

You do **not** paste keys into the repo. Provide them one of two ways:

- **Tell me the two values in chat** and I'll set them as Cloudflare Worker
  secrets on the tuning worker (`wrangler secret put GOOGLE_CSE_ID` /
  `GOOGLE_CSE_KEY`), **or**
- set them yourself:
  ```
  npx wrangler secret put GOOGLE_CSE_ID     # paste the cx
  npx wrangler secret put GOOGLE_CSE_KEY     # paste the API key
  ```
  on whichever worker runs the tuning (to be wired — see the weekly-tuning
  section of `docs/plan/CLUSTER-QUAL-001.md` §7.6).

> Treat both as secrets. The `cx` is low-risk but the API key is billable —
> keep it out of commits, screenshots, and PR bodies.

## 5. Query shape the tuning job uses (reference)

```
GET https://www.googleapis.com/customsearch/v1
      ?key=GOOGLE_CSE_KEY
      &cx=GOOGLE_CSE_ID
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
