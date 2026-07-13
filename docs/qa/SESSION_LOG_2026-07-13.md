# Session Log — 2026-07-13 (CLUSTER-QUAL-001 weekly demand-seed tuning)

First run of the weekly demand-seed routine on its **LIVE trigger** (scheduled
task `antcv-demand-seed-weekly`, Fri 22:00) — before this the routine had run
once, manually, on 2026-07-10. Scope: spec §7.6 weekly demand-tuning only.
Touched `pwa/antcv-cluster-demand.js` (client SEED) + the cache-bust quintet,
`docs/analysis/cluster_top20_research_2026-07-13.json`, and the registers. No
`app.js`, sidecar, Worker-code, or D1 changes.

Shift lane **1.51.478-1.51.497** claimed; worked in worktree
`../AntCV-shift-1-51-478`; version consumed = **1.51.478-demand-seed-refresh**.

## CLOSED / DONE this run

- **§7.6 weekly refresh — all 9 clusters re-researched.** Current 2025-2026
  postings + skills/hiring reports across pm_process, photonics_eng,
  research_phd, engineering_software, data_analytics, consulting, executive,
  finance, people_soft. Ranked by recurrence as required/preferred, leaning
  European / Danish-Nordic. Output: `docs/analysis/cluster_top20_research_2026-07-13.json`
  (sources per cluster; supersedes the 2026-07-10 file).
- **Market read this week is STABLE — 5 bounded, evidence-backed shifts, 4
  clusters unchanged** (no fabricated churn):
  - `pm_process` — ADDED "AI/GenAI tool fluency in delivery & EU AI Act
    awareness" at r5 (share ABC); dropped the most-niche tail item
    "Obsolescence management & cost optimisation" to keep 20. Evidence: 61% of
    product/project-manager postings now require AI experience; EU AI Act
    fluency emerging. pm_process (from the hardware-heavy June-2026 16-JD
    sample) previously had NO AI item — headline change of the run.
  - `executive` — "AI & digital strategy fluency" r4 → r2 (AI is now the TOP
    leadership skill gap; 49% cite AI/emerging tech as #1 priority; AI
    governance now board-level).
  - `engineering_software` — "Secure coding & application security (NIS2)"
    r11 → r8 (cybersecurity hardest-to-fill in Denmark under NIS2; WEF/Eurostat
    Europe-wide rise).
  - `people_soft` — "AI literacy & AI-fluency in HR" r4 → r3 (LinkedIn #2
    fastest-growing HR skill; AI-fluency demand ~7x in two years).
  - `data_analytics` — "AI/agentic tools & prompt engineering" r6 → r5 (analyst
    AI-agent skills surging; SQL/Python/Power BI/Excel core order confirmed).
  - Unchanged (research matched shipped ranks): `consulting`, `finance`,
    `photonics_eng`, `research_phd`.
- **Verified:** `node -e` SEED load check — v1.51.478, 9 clusters × 20, all
  rank sequences 1..20 intact, unsolicited spans 9, demand scoring live;
  `node scripts/run-tests.mjs pwa` — **1257/1257 pass, 0 fail**;
  cache-bust quintet applied (index.html `?v` + `ANTCV_VERSION` seed, `sw.js`
  CACHE, `antcv-version-override.js` TARGET_VERSION + STALE_VERSIONS
  append-previous-`1.51.438-personal-dedup`).
- **Registers:** OPEN_REGISTER row 9 advanced; FEATURES_REGISTRY header
  increment (10); this log.

## OPEN (carry forward)

- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — Google CSE `/api/cse-search` still
  gated. This run had no `CSE_PROXY_TOKEN` in the scheduled session env, and per
  `docs/deployment/google-cse-setup.md` §6 the Google path still 403s
  (entitlement hold, support case open) while the **Brave-first fix (relay
  `auth-33-cse-brave` / 1.3.12) is committed but NOT yet deployed** to
  access-relay. Once that manual access-relay deploy runs (deploy.yml →
  workflow_dispatch, mode=deploy, confirm=access-relay), `/api/cse-search` gets
  Brave-backed site-scoped search (Jobindex.dk / it-jobbank.dk / Glassdoor) and
  the next weekly run can use it. Until then: WebSearch fallback (reduced
  Nordic/Danish site-scoping), as done here and on 2026-07-10.
- **Nightly D1 research WRITER still unbuilt** (OPEN_REGISTER row 9). No
  production `source='research'` writer / cron; `cluster_top_qualifications`
  global rollup was last populated by the 2026-07-10 manual D1 writes. The
  client SEED is the live read-path and IS refreshed this run; the D1 leg is
  the optional pipeline build task — not advanced this run (kept the run to the
  reliably-shippable client seed + research JSON + registers; not half-shipping
  a worker change). Next build increment when a session picks up §3.
