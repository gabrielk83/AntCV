# Session Log — 2026-08-01 (CLUSTER-QUAL-001 weekly demand-seed tuning)

Scope this run: the **weekly demand-tuning routine** (spec §7.6), not general app
maintenance. Touched only `pwa/antcv-cluster-demand.js`, cache-bust sidecars
(`pwa/index.html`, `pwa/sw.js`, `pwa/antcv-version-override.js`), `docs/analysis/*`,
`docs/qa/OPEN_REGISTER.md`, and D1 (`application_qualification` /
`cluster_top_qualifications` via the production writer). No `app.js`, `app.src.js`,
or other Worker-code changes.

## CLOSED this run

- **CLUSTER-QUAL-001 §7.6 weekly refresh — all 9 clusters, on-cadence (8 days
  since the 2026-07-24 run, no missed-fire catch-up needed).** Dispatched 9
  parallel background research agents (one per cluster), each given the
  currently-shipped top-20 as baseline and instructed to propose only
  evidence-backed keep/reorder/merge/add/drop changes via WebSearch/WebFetch
  (no Google CSE attempt — the routine's own standing instruction, per the
  persistent 403 documented in `docs/deployment/google-cse-setup.md` §6).
  Output merged into `docs/analysis/cluster_top20_research_2026-08-01.json`
  (validated: 9 clusters × exactly 20 ranked items each).
- **Client SEED updated (`pwa/antcv-cluster-demand.js`, all 9 clusters,
  VERSION 1.51.4086).** Regenerated the embedded `SEED` object from the
  research JSON via a small Node script (avoids hand-transcription errors),
  preserving the stage-4 doc comment ahead of `engineering_software`.
  Notable evidence-backed shifts: "evaluating & reviewing AI-generated code /
  agent output" promoted from r16→r4 in `engineering_software` (Anthropic
  2026 Agentic Coding Trends Report + Pragmatic Engineer: engineers shifting
  time toward directing/reviewing agents, not just using them); a parallel
  NEW item added to `consulting` at r17 ("AI output verification & critical
  judgement") for the same reason, distinct from AI-tool fluency (r2); Excel
  re-promoted on fresh posting-frequency evidence in `finance` (r5→r1,
  Research.com 2026 posting analysis) and `data_analytics` (r9→r2, AccioJob
  328-JD analysis: Excel in 81% of postings, ahead of SQL/Power BI/Python);
  `consulting`'s ESG/CSRD item demoted (r15→r19) — EU Omnibus package cut
  mandatory CSRD reporting scope ~85% in early 2026.
- **D1 research write** — `node scripts/cluster-demand-research-push.mjs
  --url https://antcv-access-relay.karp-gabriel-a.workers.dev`: `--dry-run`
  previewed the 180-qualification payload first, then live push returned
  `{"ok":true,"clusters_updated":9,"total_inserted":207,"unknown":[]}` — all
  9 clusters recomputed under `__global_market__`.
- **Verified:** Node syntax-check + a standalone smoke test of the rebuilt
  `antcv-cluster-demand.js` (9 clusters load, 20 items each, `score()` /
  `activeClusters()` work); `node scripts/run-tests.mjs pwa` — 1570 tests,
  1563 pass, 0 fail, 7 skipped (one real regression caught and fixed
  mid-run — see OPEN below); `node scripts/check-cache-bust.mjs --range
  origin/main..HEAD` — OK, both changed assets bumped, after rebasing onto
  a same-morning `origin/main` advance (job-tracker nightly landed while
  this run was in flight; rebase was clean, tests re-confirmed green
  post-rebase).
- **Cache-bust quintet** → `1.51.4086-demand-seed-refresh` (index.html `?v=`
  on `antcv-cluster-demand.js` + `antcv-version-override.js`, `sw.js`
  CACHE, `antcv-version-override.js` TARGET_VERSION, STALE_VERSIONS +=
  `1.51.4046-company-retry` (the previous target, appended not replaced)).
- **Draft PR opened**: https://github.com/gabrielk83/AntCV/pull/358 — the
  code/doc trail; the D1 writes already took effect live and are not part
  of the diff, per the routine's own design.

## OPEN (carry forward)

- **ANTCV_VERSION-seed self-correction (found + fixed this run, not a
  regression left behind).** First pass bumped `window.ANTCV_VERSION` in
  `index.html` to the new sidecar version, which broke
  `hdr-type-controls.test.mjs`'s "the boot seed matches app.js" assertion —
  that seed is pinned to **app.js's own** `?v=` (unchanged this run, since
  this routine never touches app.js/app.src.js), not to whatever asset a
  given routine happens to bump. Reverted to `1.51.4046-company-retry`
  (app.js's actual current pin) before commit; suite green after the fix.
  Noting this explicitly for future routines that only touch a sidecar:
  **do not bump `ANTCV_VERSION` unless app.js's own `?v=` is also bumped in
  the same change** — TARGET_VERSION (version-override.js) is the one that
  always tracks the newest shipped version; ANTCV_VERSION tracks app.js
  specifically.
- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — still open per
  `docs/deployment/google-cse-setup.md` §6 (not re-tested this run, per the
  routine's own instruction not to burn time on it; plain WebSearch used
  throughout, same as every run since 2026-07-10).
- **Owner-owed: post-deploy live-verify** once PR #358 merges — confirm
  `antcv.pages.dev` serves `antcv-cluster-demand.js?v=1.51.4086-...` and a
  quick JD-classify smoke test still returns a sane cluster.
