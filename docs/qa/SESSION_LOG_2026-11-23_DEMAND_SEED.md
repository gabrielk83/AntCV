# Session Log — 2026-11-23 (CLUSTER-QUAL-001 weekly demand-seed, cloud)

Scope: the weekly demand-seed routine (spec §7.6), claude.ai cloud routine
`trig_01C2FGAuWTQLEfFMk5gsKDwW`, fresh clone, branch `claude/weekly-demand-tuning-2026-11-23`.
Touched: `docs/analysis/cluster_top20_research_2026-11-23.json`, `docs/qa/*`, and D1 through the
relay writer. No `pwa/` asset, no version consumed, no shift claim.

**Duplicate-run check.** Newest artefact 2026-11-16 (7 days, outside the 6-day window). Last
`feat(demand-seed)` commit on `origin/main` 2026-11-16 06:14 UTC (6 d 23 h before this run). The
desktop 2026-11-22 fire was a duplicate-run cross-check, not a refresh. No open demand-seed PR.
Full run. Followed the repo copy of the prompt (adds Jobnet leg d).

## CLOSED this run

- **Gate 1, write token: PASS.** `CLUSTER_RESEARCH_TOKEN` (routine env, 51 chars). Empty-body
  probe → `400` = accepted.
- **Gate 2, search leg: PASS.** `CSE_PROXY_TOKEN` 64 chars, not AIza shape.
  `GET /api/cse-search?q=test` → `{"ok":true,"source":"brave"}`.
- **Research: 10 clusters. 0 changed, 10 re-confirmed. No adds, no drops.**
  - `data_analytics`: new Scoutify live snapshot 2026-11-17 (newest 2,000 of 15,069 postings;
    search snippet only, scoutify.com blocked): Analytics 62 / SQL 57 / Power BI 43 / Python 35 /
    Data Quality 31%. Excel missing from its top 5, but 365 Data Science n=1,355 (Excel 41.3%) and
    itjobswatch UK (60.8%) disagree. Sources disagree → order kept.
  - `finance`: new Scoutify FP&A snapshot 2026-11-17 (n=18,386; snippet only): Finance 76 /
    Accounting 63 / Financial Planning 37 / Financial Analysis 35 / Variance Analysis 24%.
    Generic families, no Excel / AI / modelling shares visible → no reorder. Aleph 2027 index
    (AI 40% of FP&A) already in baseline.
  - `pm_process`, `engineering_software`, `photonics_eng`, `consulting`, `people_soft`,
    `executive`, `research_phd`: search returned baseline sources (SeekerScore n=2,177, Huntr
    n=23,229, InterviewStack n=33,399 / n=48,207), sector-level reports (PwC AI Jobs Barometer,
    SHRM, Dice) or job-board listings. No per-skill posting share that overturns an order.
  - `medical_secretary`, DK leg only. Jobindex RSS `q=lægesekretær` + `q=sundhedsadministrativ`,
    one page each, 1.2 s delay, named UA: 37 unique items, 24 secretary/SAK titles (10 hosted,
    14 hospital r* external). 8 hosted ads read in full via `/jobannonce/<id>`; 2 Aleris ads
    redirect to `candidate.hr-manager.net` (blocked). All 8 are general practice / private
    clinic: Plastikkirurgen.DK, Speciallæge Line Clausen Vesterbro (new), Lægehuset Felsted,
    Viva Børne- og Ungdomspsykiatri, Lægerne Algade Roskilde (Region Sjælland), Padborg, Lægerne
    i Vallensbæk Strand (Region H), Støvring. DK n=8 counts: reception 8, team 8, independent 8,
    confidential 8, pressure 8, structure 8, admin 7, experience 7, booking 7, education 5,
    EPR 5, pathway 5, clinic-assistant 5, service 4, flex 4, IT 4, referral 4, coding 4,
    journal 3, language 0. Loose match on page text, n=8, GP-only, 6 of 8 ads carried over from
    11-16: no rank moves. Education r4 pin holds (14 hospital titles name lægesekretær / SAK,
    8 in Region H / Sjælland). Clinic-assistant stays r20. SE n=0. Regional `.rss` returned 404.
- **Artefact** `docs/analysis/cluster_top20_research_2026-11-23.json`, compiled by script from
  the 11-16 file. Validated: 10 clusters, 20 items each, ranks 1..20, no duplicates, valid tiers,
  top-20s identical to 11-16, `generated` = 2026-11-23, `supersedes` = 11-16.
- **Client SEED: skipped** (no cluster changed). VERSION stays `1.51.5139`. Sandbox load:
  row-equal 200/200 (rank, text, share), `activeClusters()` = 10; `classifyJD()` routes a Danish
  lægesekretær ad and a Swedish medicinsk sekreterare ad to `medical_secretary`, an FP&A ad to
  `finance`; `score()` 30 on a promoted finance item, 0 on a nonsense line. No cache-bust.
- **D1 write (relay writer):** dry run 10 clusters / 200 quals. Live:
  `{"ok":true,"clusters_updated":10,"total_inserted":247,"unknown":[]}`, every cluster
  `recomputed:true`.
- **Tests:** `run-tests.mjs pwa` 2176/2176 pass. `cluster-demand-research-push.test.mjs` 6/6,
  `cluster-demand-research-writer.test.mjs` 14/14. `check-register.mjs` OK.

## OPEN (carry forward)

- **D1 verify skipped.** The Cloudflare-Developer-Platform connector refused its sign-in in the
  cloud session. Row 117 split not re-measured this run (desktop measured it 2026-11-22).
- **Cloud egress allowlist (row 125).** Blocked: `jobsearch.api.jobtechdev.se` (SE Skåne leg,
  fifth week), Jobnet (leg d), `candidate.hr-manager.net`, `scoutify.com`, `antcv.pages.dev`.
  Owner: add these hosts to the routine environment and re-authorize the Cloudflare connector.
- **Row 117** owner decision still owed.

## Live verify

Not applicable: no `pwa/` asset changed. antcv.pages.dev is blocked by the cloud egress proxy.
