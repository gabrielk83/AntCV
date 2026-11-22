# Session Log — 2026-11-22 (CLUSTER-QUAL-001 weekly demand-seed, desktop)

Scope: desktop fire of `antcv-demand-seed-weekly` on Gabo-PC (Opus 5.5). Preflight `start` exit 3
(owner WIP in `package.json`, `workers/access-relay`, untracked DAMC doc) → worktree
`~/antcv-worktrees/routine-antcv-demand-seed-weekly-mws2osc7` on `origin/main` `e5602975`.
Token OK (expires 2026-11-26T21:16:51Z, 4.2 d). Dispatch gap: previous desktop start
2026-11-01 (21.2 d); the 11-08 and 11-15 desktop fires did not start here.
Touched: `docs/qa/*` only. No `pwa/` asset, no version consumed, no shift claim, no D1 write.

**Duplicate-run check: HIT.** Newest artefact `cluster_top20_research_2026-11-16.json` (cloud
routine, commit `462f0b16`), 6 days old, inside the 6-day window. No open demand-seed PR.
No second refresh. Gates 1-2 and steps 1-4 not run.

## CLOSED this run

- **Cross-check of the 2026-11-16 run: PASS.**
  - Push applied: `462f0b16` on `origin/main`; its log reports
    `{"ok":true,"clusters_updated":10,"total_inserted":247,"unknown":[]}`.
  - Seed live: antcv.pages.dev serves `antcv-cluster-demand.js?v=1.51.5139-demand-seed-refresh`,
    served file `VERSION = '1.51.5139'` (= repo; 11-16 changed no cluster, so no bump was due).
    `sw.js` CACHE `antcv-1.51.6585-askai-insight` = repo.
  - **D1 verify (the leg the cloud run skipped):** read-only wrangler SELECT on `ant_memory`,
    `__global_market__`: 10 clusters, 20 rows each, ranks 1..20, 200 rows read, 0 written.
    `updated_at` 2026-11-16T06:13:18Z..06:13:53Z = the 11-16 push.
- **Row 117 split re-measured (first time since 10-25).** Rows with `weight_sum ≥ 1` per cluster:
  `photonics_eng` 20/20 (max jd_count 11, was 8), `pm_process` 20/20 (max 7, was 2),
  `executive` 15/20 (max 1), `research_phd` 14/20 (max 2), **`consulting` 11/20 (max 1; was
  100% research on 10-25)**. data_analytics, engineering_software, finance, medical_secretary,
  people_soft: 0/20 (100% research). Single-JD dominance now reaches a fifth cluster.

## OPEN (carry forward)

- **Row 117** owner design decision (jd_count threshold or blend). Now five clusters where real
  JD rows outrank research; consulting and executive are each held by one JD.
- **Row 125** cloud egress allowlist (JobTech SE leg, Jobnet, sundhedsjobs.dk, seekerscore.com,
  antcv.pages.dev): not re-tested this run (no research pass). The desktop has full egress; the
  next desktop-owned week can run the SE Skåne leg.
- **Desktop dispatch gap.** This routine started here 11-01 and now 11-22; the 11-08 / 11-15
  desktop fires did not start. The cloud routine covered both weeks.
- **Cadence overlap.** Cloud fires Sunday/Monday early, desktop Friday/Sunday; the 6-day window
  makes whichever fires second a cross-check. Expected, not a fault.

## Live verify

Done as part of the cross-check above. No asset changed this run.
