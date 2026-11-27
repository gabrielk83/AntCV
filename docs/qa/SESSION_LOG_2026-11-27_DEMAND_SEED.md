# Session Log — 2026-11-27 (CLUSTER-QUAL-001 weekly demand-seed, desktop)

Scope: desktop Friday 22:00 fire of `antcv-demand-seed-weekly` on Gabo-PC (Opus 5.5). Preflight
`start` exit 3 (owner WIP in `package.json`, `workers/access-relay`, untracked DAMC doc) → worktree
`~/antcv-worktrees/routine-antcv-demand-seed-weekly-mwzh4d42` on `origin/main` `c1c20c14`.
Token OK (expires 2026-12-04T10:46:10Z, 6.6 d). Dispatch gap 5.2 d (previous desktop start 11-22).
Touched: `docs/qa/*` only. No `pwa/` asset, no version consumed, no shift claim, no D1 write.

**Duplicate-run check: HIT.** Newest artefact `cluster_top20_research_2026-11-23.json` (cloud
routine, commit `0b0c776d`), 4 days old, inside the 6-day window. No open demand-seed PR.
No second refresh. Gates 1-2 and steps 1-4 not run.

## CLOSED this run

- **Cross-check of the 2026-11-23 cloud run: PASS.**
  - Push applied: `0b0c776d` on `origin/main`; its log reports
    `{"ok":true,"clusters_updated":10,"total_inserted":247,"unknown":[]}`.
  - Seed live: antcv.pages.dev serves `antcv-cluster-demand.js?v=1.51.5139-demand-seed-refresh`,
    served file `VERSION = '1.51.5139'` (= repo; 11-23 changed no cluster, so no bump was due).
    `sw.js` CACHE `antcv-1.51.6706-letter-diagram` = repo.
  - **D1 verify (the leg the cloud run skipped):** read-only wrangler SELECT on `ant_memory`,
    `__global_market__`: 10 clusters, 20 rows each, ranks 1..20, 200 rows read, 0 written.
    `updated_at` 2026-11-23T06:24:06Z..06:24:39Z = the 11-23 push.
- **Row 117 split re-measured (cloud run skipped it).** Rows with `weight_sum ≥ 1`:
  `photonics_eng` 20/20 (max jd_count 11), `pm_process` 20/20 (max 7), `executive` 15/20 (max 1),
  `research_phd` 14/20 (max 2), `consulting` 11/20 (max 1). Other five clusters 0/20.
  Identical to 11-22.

## OPEN (carry forward)

- **Row 117** owner design decision (jd_count threshold or blend). Split stable for a week;
  consulting and executive still each held by one JD.
- **Row 125** cloud egress allowlist (JobTech SE leg, Jobnet, sundhedsjobs.dk): not re-tested
  (no research pass). SE Skåne sample still n=0 since the cloud took every full run.
- **Cadence overlap.** Cloud fires Sunday/Monday early, desktop Friday; the 6-day window makes
  the desktop fire a cross-check every week the cloud ran. The desktop SE leg (full egress)
  therefore never runs. Owner option: shift the desktop fire to before the cloud fire, or
  let the desktop run the SE leg only on a duplicate hit.

## Live verify

Done as part of the cross-check above. No asset changed this run.
