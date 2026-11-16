# Session Log — 2026-11-16 (CLUSTER-QUAL-001 weekly demand-seed, cloud)

Scope: the weekly demand-seed routine (spec §7.6), claude.ai cloud routine
`trig_01C2FGAuWTQLEfFMk5gsKDwW`, fresh clone, branch `claude/weekly-demand-tuning-2026-11-16`.
Touched: `docs/analysis/cluster_top20_research_2026-11-16.json`, `docs/qa/*`, and D1 through the
relay writer. No `pwa/` asset, no version consumed, no shift claim.

**Duplicate-run check.** Newest artefact 2026-11-09 (7 days, outside the 6-day window). Last
`feat(demand-seed)` commit on `origin/main` 2026-11-09 06:18 UTC. No open demand-seed PR. The
desktop Friday 2026-11-13 run did not land. Full run.

## CLOSED this run

- **Gate 1, write token: PASS.** `CLUSTER_RESEARCH_TOKEN` (routine env, 51 chars). Empty-body
  probe → `400` = accepted.
- **Gate 2, search leg: PASS.** `CSE_PROXY_TOKEN` 64 chars, not AIza shape.
  `GET /api/cse-search?q=test` → `{"ok":true,"source":"brave"}`.
- **Research: 10 clusters. 0 changed, 10 re-confirmed. No adds, no drops.**
  - Nine non-medsec clusters: no new posting-share data. The sources this week's searches
    returned are already in the baseline: SeekerScore PM n=2,177 (PMP 29.5 / Agile 24.3 /
    stakeholder 15.3%), InterviewStack SWE n=48,207 (Python 34.8%), Qarera n=360,336
    (communication 23.1 / AI 19.8 / Python 18.6%). HN who-is-hiring mention shares are
    forum-only, not rank evidence. seekerscore.com blocked by egress.
  - `medical_secretary`, DK leg only. Jobindex RSS `q=lægesekretær` + `q=sundhedsadministrativ`,
    one page each, 1.2 s delay, named UA: 37 unique items, 19 secretary/SAK titles. 6 hosted ads
    followed to the full jobannonce body, 13 hospital ads (r* external) teaser-only. All 6 hosted
    are general practice / private clinic: Felsted, Viva Børne- og Ungdomspsykiatri, Lægerne
    Algade Roskilde (Region Sjælland), Padborg, Lægerne i Vallensbæk Strand (Region H), Støvring.
    DK n=6 counts: reception 6, team 6, service 6, independent 6, confidential 6, pressure 6,
    structure 6, admin 5, IT 5, experience 5, booking 5, clinic-assistant 4, education 3, EPR 3,
    flex 3, pathway 3, coding 3, journal 2, referral 2, language 1. Loose match on full page
    text, n=6, GP-only: no rank moves. Education r4 pin holds (the 13 hospital titles name
    lægesekretær / SAK). Clinic-assistant stays r20. SE n=0. Regional `.rss` returned 404.
- **Artefact** `docs/analysis/cluster_top20_research_2026-11-16.json`, compiled by script from
  the 11-09 file. Validated: 10 clusters, 20 items each, ranks 1..20, no duplicates, valid tiers,
  top-20s identical to 11-09, `generated` = 2026-11-16, `supersedes` = 11-09.
- **Client SEED: skipped** (no cluster changed). VERSION stays `1.51.5139`. Sandbox load:
  row-equal 200/200, `activeClusters()` = 10. Classification (DK lægesekretær, finance) covered
  by `cluster-demand-seed.test.mjs`, green. No cache-bust, no version consumed, no shift claim.
- **D1 write (relay writer):** dry run 10 clusters / 200 quals. Live:
  `{"ok":true,"clusters_updated":10,"total_inserted":247,"unknown":[]}`, every cluster
  `recomputed:true`.
- **Tests:** `run-tests.mjs pwa` 2162/2162 pass. `check-register.mjs` OK.

## OPEN (carry forward)

- **D1 verify skipped.** The Cloudflare-Developer-Platform connector is not authorized in the
  cloud session. Row 117 split not re-measured (third week).
- **Cloud egress allowlist (row 125).** Blocked with 403 CONNECT: `jobsearch.api.jobtechdev.se`
  (SE Skåne leg skipped, fourth week), Jobnet (leg d), `sundhedsjobs.dk`, `seekerscore.com`,
  `antcv.pages.dev`. Owner: add these hosts to the routine environment.
- **Row 117** owner decision still owed.
- **Desktop Friday run 2026-11-13** did not land on `origin/main`.

## Live verify

Not applicable: no `pwa/` asset changed. antcv.pages.dev is blocked by the cloud egress proxy.
