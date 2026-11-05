# ai-job-search review: merged into AntCV, gaps left, offers upstream (2026-11-05)

**Upstream:** https://github.com/ai-job-search-dev/ai-job-search. MIT licence, about 70k stars. It is a Claude Code framework built from slash commands, Bun job-board CLIs, Python tools and LaTeX output.

**How AntCV takes from it:** ideas and code are ported; nothing is git-merged. Ported files keep upstream's MIT notice ("Copyright (c) 2026 Mads Lorentzen").

## 1. Job sites (checked live 2026-11-05)

| Site | Upstream reads it via | Login/key | AntCV now |
|---|---|---|---|
| Jobindex | search page HTML, external ATS passthrough | none | RSS + follow the teaser (kept) |
| Jobnet | `/bff/FindJob/Search` with `x-csrf: 1` | none (the header is anti-forgery, not auth) | **re-added**; it had been dropped as "behind a login" |
| Jobbank | RSS `/job/rss/?key=` + JSON-LD | none | **RSS first**, onclick scrape as fallback |
| Jobdanmark | `POST /api/jobsearch/search/{page}` | none | **added** |
| LinkedIn | `jobs-guest` endpoints | none; robots `*` = `Disallow: /`, ToS bans automation | unchanged: agent WebFetch, low volume |
| freehire.me | public JSON API (about 50 ATS platforms) | none | **added**, `countries=dk`, 14 days |

AntCV covers sites upstream does not: The Hub, Career Hound (with written permission), Google Jobs, and JobTech (Sweden, demand research).

## 2. Merged into AntCV (branch `upstream-merge`)

| ID | What | Where |
|---|---|---|
| JOBSRC-UPSTREAM-001 | Jobnet, freehire and Jobdanmark sources; Jobbank RSS; retry with Retry-After; wildcard robots.txt gate | `scripts/job-tracker/job_sources.py` |
| JOBSRC-HEALTH-001 | per-source yield log + `health` sentinel probe (healthy / degraded / broken / inconclusive) | same |
| POSTING-JOBNET-001 | sweep probes Jobnet's BFF detail endpoint (the find-job page answers 404 even while live) | `check-postings.py` |
| LANGUAGE-GATE-001 | posting requires a language off the record → not proposed; Danish requirement → ⚠ | `discover-positions.py` |
| STALE-POSTING-001 / MASS-POSTING-001 | ⚠ when posted more than 30 days ago; one row per ad posted in several cities | same |
| TEXT-GUARDS-001 | fact guard, echo check (EN/DA/SV), run on every generated package | `fact_guard.py`, `echo_check.py`, `guard_rules.json`, `gen-runner.py` |
| ATS-TEXT-LAYER-001 | glyphs, contact as literal text, two columns not interleaving | `ats_text.py`, `export_pdfs.py` |
| FOLLOWUP-001 | submitted date, 10-day quiet list, at most 2 follow-ups, thank-you log | `followups.py` |
| COMPANY-FINANCIALS-001 | annual-report figures from Virk open data (the data Proff shows) in employer research | `company_financials.py`, `gen-runner.py` |
| JOBTRACKER-PYTEST-CI-001 | job-tracker Python tests run on every PR | `.github/workflows/pr-gate.yml` |
| (separate session) | posting integrity guard (hidden text, invisible and tag characters) | proxy + `job_sources._text` |

**Proff:** not read. Its robots.txt disallows the whole site for anthropic-ai, ClaudeBot and Claude-Web. The same figures come from Erhvervsstyrelsen's filings on Virk.

## 3. Gaps left (from upstream's non-portal commands vs AntCV's PWA)

PWA items need an islands rebuild, a `?v=` bump and a `sw.js` cache-bust (claim a shift lane).

| # | Gap | AntCV today | Value | Effort |
|---|---|---|---|---|
| G1 | Status changes carry no date; no interview stages; no no-response / withdrawn / declined / hired | `TRACKED_STATUSES` in `api.ts`; `followups.py` now holds a submitted date script-side | high (funnel, follow-ups, calibration) | S–M, PWA |
| G2 | **Account erase misses tables:** the full wipe deletes application, language_view, active pointers, user_kernel and llm_calls, but **not** `job_tracker`, `kernel_showcase(_styled)`, `application_qualification`, `cluster_top_qualifications` | `workers/access-relay/src/index.js` wipe batches | **high: GDPR erasure** | S, worker |
| G3 | No frozen copy of what was submitted (posting + CV + CL) | editable `cv_sections` with one `_bak` | high | M |
| G4 | Interview prep pack + mock interview | absent; the doc chatbot could host it | high | M–L |
| G5 | Eligibility / clearance gate (citizenship, PR, clearance → FAIL, quoted) | soft `red_flags` only | high for defence/photonics | S–M |
| G6 | "Call the employer" flow: recruiter phone, call block, call notes into the CL | questions exist; no phone field or notes | med-high | S |
| G7 | Pipeline dashboard (funnel, status, sector, channel) + joblog CSV | absent | med | M, PWA, after G1 |
| G8 | Gap heatmap + learning plan across all tracked JDs | data exists (`application_qualification`), no view | med-high | M |
| G9 | Fit framework calibrated from outcomes | only the owner's rejections feed the envelope | med | M, after G1 |
| G10 | LinkedIn people-search links (recruiters, peers) per high-fit row | absent | med | S |
| G11 | Portal form fields with character limits | JD questions only, as a CL page | med | S–M |
| G12 | E-mail status sync with approval | absent | med | M |
| G13 | Checklist / guard results shown in the PWA | local files only | low-med | S |

## 4. Offers to upstream (posted 2026-11-05, owner-approved text)

- 4a: https://github.com/ai-job-search-dev/ai-job-search/pull/783#issuecomment-6654905449
- 4b: https://github.com/ai-job-search-dev/ai-job-search/pull/807#issuecomment-6654905938
- 4c: https://github.com/ai-job-search-dev/ai-job-search/discussions/812
- 4d: https://github.com/ai-job-search-dev/ai-job-search/discussions/813
- 4e: https://github.com/ai-job-search-dev/ai-job-search/discussions/78#discussioncomment-19415750

These follow CONTRIBUTING.md:
- universal changes only, one concern per post;
- market-specific portals go to Discussion #78;
- new machinery starts as an Idea thread.

They would be posted from the owner's account. AntCV has no LICENSE file, so any code contributed upstream would go in under MIT; that is the owner's call.

### 4a. Review comment on PR #783 (fact guard)

> The guard counts the posting as a grounding source for numbers and credentials. That lets a requirement turn into a claim: posting "5+ years of Python", draft "5+ years of Python" → no flag, though the profile may say 3. Same for "PMP certified". Suggest: the posting grounds names only, and only as a "check it is the employer's own name" warning; numbers and credential words must come from the profile. In our fork of this idea (AntCV) the posting never grounds a figure. Two smaller points from running it on Danish/Swedish drafts: parse numbers in the draft's locale (1.200 is 1200 in Danish, 1.2 in English; Swedish writes 20 000), and accept hedged rounding only downward ("over 40" from 45, never "over 50").

### 4b. Review comment on PR #807 (echo check)

> Exact token 5-grams miss the most common lift: the posting's clause with one inflection changed. "drive new product introduction for our laser platforms from concept to volume" vs "driving new product introductions for laser platforms from concept to volume" shares no 5-gram. Two language-agnostic additions caught these in our tests: a light suffix stemmer before the n-gram match, and a per-sentence near-lift check (character 5-gram containment ≥ 0.7, or token LCS ≥ 0.6 against the closest posting sentence) as a warning rather than a failure. Hard keywords of 3 tokens or fewer stay allowed.

### 4c. Idea discussion: grade "is this posting dead" evidence

> `/rank` marks a job `unreachable` after one failed fetch and `expired` on one signal. In a nightly sweep over a few hundred tracked rows, we found three evidence classes need different handling:
> - CLOSED or EXPIRED: the page says so, or the board moved the ad to its archive. Act on first sight.
> - GONE or SUSPECT: a 404/410, or a redirect to a non-posting page. Act only after two strikes on different days, because links break while ads stay live.
> - WALLED or ERROR: 401/403/429, a bot challenge, a 5xx. Never counts.
>
> Rows the user is already working on are never retired automatically. Also worth knowing: some ATSes answer 200 for a removed req ("You can't view this job because it's not available at this time", SuccessFactors). That phrase is soft evidence. Happy to share the phrase lists (EN/DA/SV) if this fits `/rank`.

### 4d. Idea discussion: ATS-specific extraction when WebFetch gets a shell page

> Many corporate career pages render client-side, so `fetch_page.py` returns a shell even when the request succeeds. Two cheap wins we use:
> - Read the schema.org `JobPosting` JSON-LD that Workday, SuccessFactors and Phenom pages embed server-side.
> - Rewrite Eightfold URLs to Eightfold's own JSON position endpoint.
>
> Both are universal (the ATS vendors are global) and need no browser. I can attach failing URLs from the real path if this direction is wanted.

### 4e. Comment in Discussion #78 (community forks): Nordic sources

> For Danish/Swedish forks:
> - **TheHub.io** (Nordic startups): `/jobs?search=<q>&countryCode=DK`. Jobs live only in the `window.__NUXT__` IIFE, with hoisted string parameters. robots.txt allows `/jobs`.
> - **Arbetsförmedlingen JobTech** (Sweden): `jobsearch.api.jobtechdev.se/search`, open, no key, filterable by `workplace_address.region`.
> - **Company financials:** Danish annual reports as XBRL from `distribution.virk.dk/offentliggoerelser` (open, no key). Proff's robots.txt bars AI agents, so don't scrape it.
