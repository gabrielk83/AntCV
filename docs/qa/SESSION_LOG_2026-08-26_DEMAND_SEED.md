# Session Log — 2026-08-26 (CLUSTER-QUAL-001 weekly demand-seed tuning)

Scope this run: the **weekly demand-tuning routine** (spec §7.6), not general app
maintenance. Touched only `pwa/antcv-cluster-demand.js`, the cache-bust sidecars
(`pwa/index.html`, `pwa/sw.js`, `pwa/antcv-version-override.js`), `docs/analysis/*`,
`docs/qa/*`, and D1 (`application_qualification` / `cluster_top_qualifications` via
the production writer). No `app.js`, `app.src.js`, or Worker-code changes.

**Cadence.** 8 days after the 2026-08-18 refresh — normal weekly interval, so
genuine week-over-week market movement is in scope, and that is what most of this
run records (unlike 08-18, which was an ad-hoc 4-day dispatch and could only
gap-fill). Preflight found the desktop clone DIRTY (owner's uncommitted
`PANEL_BUTTON_AUDIT_*` edits on `claude/demand-seed-modern-write-path`), so per
STANDING RULE 0 all work happened in an isolated worktree off `origin/main`,
never in the shared clone.

## CLOSED this run

- **CLUSTER-QUAL-001 §7.6 weekly refresh — all 9 clusters re-researched.** Nine
  cluster passes run **inline** with the built-in WebSearch/WebFetch (11
  searches), each given the currently-shipped top-20 as baseline and constrained
  to evidence-backed keep/reorder/merge/add/drop. Output compiled into
  `docs/analysis/cluster_top20_research_2026-08-26.json` by a Node script (avoids
  hand-transcription errors), validated: 9 clusters × exactly 20 ranked items,
  contiguous ranks, no duplicates, valid share tiers.
- **7 of 9 clusters changed; 2 re-confirmed unchanged** (`research_phd`,
  `data_analytics`) after a fresh-evidence recheck — no forced churn. Per-cluster
  reasoning is stored in each cluster's `changes_summary`.

  - **Theme — the DELIVERY and PLATFORM layers were under-weighted.** Where 2026
    posting data is measurable it keeps pointing at two things: the layer that
    makes a technology *land*, and the enterprise platform stack.
    - `photonics_eng`: photonic packaging & assembly **15 → 9**. 2026 is the
      first year of large-scale silicon-photonics commercialisation — 800G and
      1.6T module shipments more than double this year and SiPh penetration is
      projected at 50–70% of that market. Current CPO / optical-packaging
      postings make **fiber attach and optical coupling hard requirements**
      alongside assembly materials, connectors and interface reliability, paired
      with DVT coverage for 800G / 1.6T / 3.2T parts. Packaging belongs with the
      test block (r6–r7), not below the patent and multivariate-analysis items.
      r4 additionally now names the instrument classes postings ask for
      (DCA / OSA / BERT).
    - `consulting`: change management **15 → 11**, renamed to name **value
      realisation**. BCG booked ~3.6bn USD — 25% of its 14.4bn USD 2025 revenue —
      directly from AI work; the hiring that follows favours AI transformation,
      MLOps, data strategy and human-in-the-loop change management, with firms
      reporting rising demand specifically for change-management and
      value-realisation leaders while generalist analyst tracks are squeezed.
    - `finance`: business partnering **8 → 4**. The Datarails study of 5,000+ US
      CFO / FP&A / controller / accountant postings (Jan 2025 – Jan 2026) puts
      business partnering in **57% of FP&A postings** (+12pp YoY) and 35% of CFO
      postings (up from 26%) — **above** the AI requirement in the same dataset
      (FP&A 43%, up from 33%; accounting 30%, up from 18%).
    - `engineering_software`: **new r16** "Enterprise platform & SaaS ecosystem
      engineering (SAP / Oracle / Salesforce / Workday)". Robert Half's 2026
      technology-job-market posting counts put Oracle (109,718), Workday
      (100,213), SAP (62,972) and Salesforce (61,982) among the **seven**
      most-posted technology skills — behind only Python (137,176), ahead of
      React (48,477). Four of the top seven, and the seed carried no item for
      that layer at all. Dropped "Performance optimisation & profiling", the
      weakest remaining posting keyword.
  - **Wording broadenings** (5): `pm_process` r1 names **hybrid** delivery (>70%
    of 2026 PM postings require Agile *or hybrid*, not waterfall-only) and r10
    names the Jira / Asana / MS Project / Smartsheet stack; `executive` r10 names
    **continuous succession management** and r13 leads with **AI-governance
    oversight** (76% of large organisations now have a Chief AI Officer, up from
    26% in 2025; 60% of Fortune 100 expect to hire a dedicated head of AI
    governance in 2026) while scoping ESG/CSRD rather than dropping it;
    `people_soft` r8 adds **Oracle + Visier** to the HRIS item.

- **Discipline held in both directions.** No AI item was demoted anywhere this
  run — the growth evidence stays strong. But `executive` AI was explicitly
  **NOT** promoted over r1 strategic vision, because its supporting evidence
  (digital/emerging tech rising seven places to the #1 perceived development gap;
  49% of executives naming AI a top development priority) is a skills-**gap**
  survey, not posting share, and this model ranks on demand evidence. That is the
  same rule the 2026-08-18 run set, applied to a case where it *blocks* a change
  rather than causing one. Likewise `data_analytics` was left alone deliberately:
  the fresh posting data contradicts itself on the top two (one 328-JD analysis
  puts Excel at 81% ahead of SQL at 60%; others put SQL at 70–78% for analyst
  roles with Excel ~41%), which does not support a flip.
- **Danish evidence re-confirmed.** IT-Branchen's Jobindex analysis still runs
  security ~19% of Danish IT postings > cloud 14.5% > AI/ML 12.3%, on a base that
  grew **23.6%** (16,268 → 20,114) from 2024 to 2025 — so `engineering_software`
  r5 secure coding was re-confirmed in place rather than moved. Noted and
  deliberately **not** acted on: the Danish support / operations / infrastructure
  share fell 43% → 16%. That is classic IT-drift roles, not platform engineering,
  so r13 (containers) and r15 (IaC/platform engineering) stand.
- **Client SEED updated (`pwa/antcv-cluster-demand.js`, VERSION 1.51.4386).**
  Regenerated from the JSON by script, then verified **row-for-row equal
  (180/180)** in a sandbox load (9 clusters, `activeClusters()` / `score()` work,
  CRLF preserved).
- **D1 research write** — `node scripts/cluster-demand-research-push.mjs --url
  https://antcv-access-relay.karp-gabriel-a.workers.dev`: `--dry-run` previewed
  the 180-qualification payload first, then the live push returned
  `{"ok":true,"clusters_updated":9,"total_inserted":226,"unknown":[]}` — all 9
  clusters recomputed under `__global_market__`, `source='research'`,
  `application_id` NULL, rank-scaled weight ≤ 0.4 so real user-JD signal still
  overtakes it. 226 > 180 because the writer UNIONs: the 46 extra rows are
  prior-top-20 quals retained at floor weight, so nothing is lost.
- **Verified:** `node scripts/run-tests.mjs pwa` — **1621 tests, 1614 pass, 0
  fail, 7 skipped** (the 08-18 baseline was 1574/1567/0/7; the extra tests came
  from other work landed since, no regression). `node scripts/check-cache-bust.mjs
  --range origin/main..HEAD` — OK, both changed assets bumped.
- **Cache-bust quintet** → `1.51.4386-demand-seed-refresh` (index.html `?v=` on
  `antcv-cluster-demand.js` **and** `antcv-version-override.js`, `sw.js` CACHE,
  `antcv-version-override.js` TARGET_VERSION, STALE_VERSIONS +=
  `1.51.4346-cost-rates` — the previous target, appended not replaced; the
  invariant "never add the CURRENT target" was asserted by the patch script).
  `ANTCV_VERSION` seed left at `1.51.4346-cost-rates` — it tracks `app.js`'s own
  `?v=`, and this routine never touches `app.js` (same call as 2026-08-18).
- **PR opened and squash-merged**: https://github.com/gabrielk83/AntCV/pull/363
  (`3179f67`) — the code/doc trail; the D1 writes already took effect live and
  are not part of the diff, per the routine's design.
- **Shift claim** — `1.51.4386-1.51.4405` (only 1.51.4386 used), released at end
  of run.
- `docs/FEATURES_REGISTRY.md` deliberately **not** touched: this run is a data
  refresh of an already-CLOSED feature (OPEN_REGISTER row 9), not a feature
  increment — same call as every prior run of this routine.

## NEW this run

- **DEMAND-SEED-SEARCH-TOKEN-MISSING-001 (OPEN, environment not code — register
  row 102).** This is the first run to actually **probe** the routine's
  prescribed search backend instead of assuming it. Both relay search routes were
  called live and both refused an unattended caller:
  - `POST /api/research` → **401 `{"error":"unauthenticated"}`**. It gates on
    `identityFromRequest`, i.e. an owner **session JWT**, which a headless
    routine does not have and cannot obtain.
  - `GET /api/cse-search` → **401 `{"error":"unauthorized"}`**. This one *does*
    have a headless-friendly design — a machine token `CSE_PROXY_TOKEN` in the
    `x-antcv-cse-token` header — but that token is **not provisioned on this
    machine**. Only `CLUSTER_RESEARCH_TOKEN` is set as a Windows User env var,
    and that is the WRITE token; it does not open the search leg.

  Net effect: the Brave-backed **site-scoped** search (`siteSearch=jobindex.dk`,
  Glassdoor) has been silently unavailable to every run of this routine since the
  Brave switch. That is why Danish evidence keeps arriving second-hand through
  plain WebSearch — this run reached the IT-Branchen/Jobindex *analysis* rather
  than Jobindex *postings*. It also corrects the framing in
  `docs/deployment/google-cse-setup.md` §6 ("UNBLOCKED 2026-08-18 via Brave"):
  the **backend** is unblocked; the **routine's access to it** is not.

  **Owner-owed one-line fix:** set `CSE_PROXY_TOKEN` as a Windows User env var on
  the desktop (same value as the relay secret), exactly as `CLUSTER_RESEARCH_TOKEN`
  already is. No code change needed — the route already works by design.

## OPEN (carry forward)

- **Post-deploy live-verify — DONE this run, not owed.** After the merge,
  `antcv.pages.dev` serves `sw.js` CACHE `antcv-1.51.4386-demand-seed-refresh`,
  `index.html` references `antcv-cluster-demand.js?v=1.51.4386-demand-seed-refresh`,
  and the deployed asset carries `var VERSION = '1.51.4386'` plus the new
  `Enterprise platform & SaaS ecosystem engineering` item. Sidecar behaviour was
  proved pre-merge in the sandbox load. **Not** exercised: an in-app JD classify
  against a real posting — that needs a signed-in browser session.
- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — Google CSE itself stays dead; not
  re-tested this run, per the routine's own instruction. Superseded in practice by
  the Brave backend, which is live — see the new row 102 for why the routine still
  cannot reach it.
- **Shift-claim rebase tangle (recurring, not new).** `scripts/shift.mjs claim`
  again left a dangling interactive rebase in the worktree (`rebase-merge` present,
  "1 command done, no commands remaining"), which blocked the first `git push`.
  Resolved with `git rebase --continue` then `git pull --rebase origin main` — no
  force, nothing lost, and origin/main had meanwhile advanced by an unrelated
  job-tracker commit which rebased cleanly. Worth folding into the next
  reliability sweep; the same tangle is recorded in memory
  `shift-claim-autopush-rebase-tangle`.
