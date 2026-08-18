# Session Log — 2026-08-18 (CLUSTER-QUAL-001 weekly demand-seed tuning)

Scope this run: the **weekly demand-tuning routine** (spec §7.6), not general app
maintenance. Touched only `pwa/antcv-cluster-demand.js`, the cache-bust sidecars
(`pwa/index.html`, `pwa/sw.js`, `pwa/antcv-version-override.js`), `docs/analysis/*`,
`docs/qa/OPEN_REGISTER.md`, and D1 (`application_qualification` /
`cluster_top_qualifications` via the production writer). No `app.js`, `app.src.js`,
or Worker-code changes.

**Short-interval dispatch — stated up front.** This run fired 2026-08-18, only
**4 days** after the 2026-08-14 refresh, and not on the Fri 22:00 cron — an ad-hoc
dispatch. No week-over-week market movement is expected at that cadence and none is
claimed. Every change below is a **gap-fill from a source earlier runs had not
reached**, not a market shift; the artefact's `method` field says so explicitly so a
future reader does not mistake it for four days of market drift. Preflight found the
desktop clone DIRTY (owner's uncommitted `PANEL_BUTTON_AUDIT` edits), so per STANDING
RULE 0 all work happened in an isolated worktree off `origin/main`, never in the
shared clone.

## CLOSED this run

- **CLUSTER-QUAL-001 §7.6 weekly refresh — all 9 clusters re-researched.** Nine
  cluster passes run **inline** with the built-in WebSearch/WebFetch (13 searches +
  1 direct page fetch), each given the currently-shipped top-20 as baseline and
  constrained to evidence-backed keep/reorder/merge/add/drop. Google CSE not
  attempted (routine's own standing instruction; persistent 403 documented in
  `docs/deployment/google-cse-setup.md` §6). Output compiled into
  `docs/analysis/cluster_top20_research_2026-08-18.json` by a small Node script
  (avoids hand-transcription errors), validated: 9 clusters × exactly 20 ranked
  items, contiguous ranks, no duplicates, valid share tiers.
- **6 of 9 clusters changed; 3 re-confirmed unchanged** (`research_phd`,
  `data_analytics`, `executive`) after a fresh-evidence recheck — no forced churn.
  Per-cluster reasoning is stored in each cluster's `changes_summary`.
  - **Theme 1 — hard posting-share data beats AI-hype in rank order.**
    - `engineering_software`: secure coding 7→5, cloud 5→6, CI/CD 6→7. **The first
      quantitative DANISH posting data available to this model since the CSE proxy
      died** — IT-Branchen's analysis of Jobindex postings (Q1 2007–Q4 2025, 10 IT
      profile categories) puts **security at 18.8%** of all Danish IT postings (the
      largest single profile), ahead of cloud 14.5% and AI/ML 12.3%. This cluster
      carries "Danish an advantage", so the local mix is the right tiebreak.
    - `people_soft`: people analytics 6→3, AI literacy 3→4. Two independent 2026
      datasets put data ahead of AI in HR **posting** demand: data analysis 36% vs
      AI 31% among orgs posting new-skill roles, and only ~9% of HR postings mention
      AI at all (vs ~45% in data/analytics roles).
    - No AI item was demoted below the top 5 in any cluster — the growth evidence
      (LinkedIn Skills on the Rise 2026; Datarails finance 25%→31%) stays strong.
      This run stops the model drifting to AI-first ranking where posting data does
      not support it; it does not reverse the AI trend.
  - **Theme 2 — the EU regulatory calendar moved consulting.** Added r16 "AI
    governance, risk & EU AI Act conformity advisory" (the Act's high-risk
    obligations deadline landed **2026-08-02**, 16 days before this run, turning
    that advisory line operational); dropped "ESG & sustainability advisory" —
    Omnibus I is adopted, ESRS scope cut to >1000 employees / >€450M turnover,
    ~85% fewer companies in scope. That item had already been flagged as weakening
    by the 2026-08-01 run; this run finishes the demotion.
  - Wording broadenings: `pm_process` r3 names emotional intelligence (Ceipal 2026
    In-Demand Jobs Report: soft skills now outweigh technical expertise in PM
    shortlisting); `photonics_eng` r15 names photonic packaging & assembly (fiber
    attach, cleanroom, IPC/ISO); `finance` r17 adds MBA (FP&A MBA requirement
    +13pp to 39%).
- **Client SEED updated (`pwa/antcv-cluster-demand.js`, VERSION 1.51.4306).**
  Regenerated from the JSON by script, then **verified byte-equal to the JSON** in a
  sandbox load (9 clusters, 20 items each, `score()` / `activeClusters()` work,
  CRLF preserved).
- **D1 research write** — `node scripts/cluster-demand-research-push.mjs --url
  https://antcv-access-relay.karp-gabriel-a.workers.dev`: `--dry-run` previewed the
  180-qualification payload first, then the live push returned
  `{"ok":true,"clusters_updated":9,"total_inserted":218,"unknown":[]}` — all 9
  clusters recomputed under `__global_market__`, `source='research'`, rank-scaled
  weight ≤ 0.4 so real user-JD signal still overtakes it.
- **Verified:** `node scripts/run-tests.mjs pwa` — **1574 tests, 1567 pass, 0 fail,
  7 skipped** (the 08-14 baseline was 1570/1563/0/7; the 4 extra tests came from
  other work landed since, no regression). `node scripts/check-cache-bust.mjs
  --range origin/main..HEAD` — OK, both changed assets bumped.
- **Cache-bust quintet** → `1.51.4306-demand-seed-refresh` (index.html `?v=` on
  `antcv-cluster-demand.js` **and** `antcv-version-override.js`, `sw.js` CACHE,
  `antcv-version-override.js` TARGET_VERSION, STALE_VERSIONS +=
  `1.51.4286-years-guard` — the previous target, appended not replaced; the
  invariant "never add the CURRENT target" was asserted by the patch script).
  `ANTCV_VERSION` seed left at `1.51.4266-cl-greeting` — it tracks `app.js`'s own
  `?v=` (confirmed identical in `index.html:411`), and this routine never touches
  `app.js`.
- **PR opened and squash-merged**: https://github.com/gabrielk83/AntCV/pull/360
  (`1cbd082`) — the code/doc trail; the D1 writes already took effect live and are
  not part of the diff, per the routine's design.
- **Shift claim** — `1.51.4306-1.51.4325` (only 1.51.4306 used), released at end of
  run.
- `docs/FEATURES_REGISTRY.md` deliberately **not** touched: this run is a data
  refresh of an already-CLOSED feature (OPEN_REGISTER row 9), not a feature
  increment — same call as every prior run of this routine.

## OPEN (carry forward)

- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — still open per
  `docs/deployment/google-cse-setup.md` §6; not re-tested this run, per the
  routine's own instruction. Mitigating note: the IT-Branchen/Jobindex analysis used
  this run is a usable **substitute** source of Danish site-scoped posting shares,
  reachable by plain WebFetch. Worth wiring into the standing source list so the
  dead CSE leg stops costing Nordic coverage on every run.
- **Owner-owed: post-deploy live-verify** — confirm `antcv.pages.dev` serves
  `antcv-cluster-demand.js?v=1.51.4306-demand-seed-refresh` and that a JD classify
  still returns a sane cluster. PWA auto-deploys from `main`.
- **Cadence note (not a new bug).** Prior gaps were missed fires (07-17 silent
  no-op, 07-24 and 08-14 catch-ups); this run is the opposite failure mode — an
  **off-cadence extra fire** 4 days after the last one. Neither costs correctness
  (the artefact records its own interval and the writer unions rather than
  replaces), but a routine that can both skip a week and double-fire in one is
  worth one look in the next reliability sweep.
