# Session Log — 2026-07-10 (CLUSTER-QUAL-001 weekly demand-seed tuning)

Scope this run: the **weekly demand-tuning routine** (spec §7.6), not general app
maintenance. Touched only `pwa/antcv-cluster-demand.js`, `docs/analysis/*`,
`docs/deployment/google-cse-setup.md`, `docs/qa/MASTER_BACKLOG.md`, and D1
(`application_qualification` / `cluster_top_qualifications`). No `app.js`,
sidecar, or Worker-code changes.

## CLOSED this run

- **CLUSTER-QUAL-001 §7.6 weekly refresh — all 9 clusters.** Researched current
  market demand (WebSearch only — see OPEN below) for pm_process, photonics_eng,
  research_phd, engineering_software, data_analytics, consulting, executive,
  finance, people_soft. D1 was completely empty pre-run; wrote `source='research'`
  rows to `application_qualification` and recomputed `cluster_top_qualifications`
  live for all 9 clusters under the `__global_market__` sentinel — **verified via
  direct D1 query** (20 ranked rows each, no gaps). This is the first real
  population of the global rollup.
- **Client SEED updated (8/9 clusters).** `pwa/antcv-cluster-demand.js`:
  pm_process left unchanged (research found no genuine shift); photonics_eng +
  research_phd got 3 leaked personal-CV specifics genericized (real patent
  number, a specific university's course count, a specific country
  research-stay reference) — also mirrored into
  `docs/analysis/cluster_top20_seed_2026-06.json` (the SEED's own source doc,
  which had the same leaked text); the other 6 clusters reordered/updated on
  AI/GenAI-fluency moving up sharply across the board, sourced and documented in
  the new `docs/analysis/cluster_top20_research_2026-07-10.json`.
- **Verified:** `node -e` load check (9 clusters × 20 items, all 9 classify
  correctly, unsolicited returns all 9); `node scripts/run-tests.mjs` full suite
  — 1385 tests, 1377 pass, **8 pre-existing failures confirmed unrelated** (see
  OPEN below, verified via clean `origin/main` re-run with this session's
  changes stashed out); `node scripts/check-cache-bust.mjs --range origin/main..HEAD`
  — OK, both changed assets bumped.
- **Cache-bust quartet** → `1.51.246-demand-seed-refresh` (index.html `?v=` ×3,
  `sw.js` CACHE, `antcv-version-override.js` TARGET_VERSION + STALE_VERSIONS).
- **Draft PR opened** (branch `claude/weekly-demand-tuning`) for the code/doc
  trail — the D1 writes above already took effect live and are not part of the
  diff, per the routine's own design (spec §7.6: "D1 writes apply directly").

## OPEN (carry forward)

- **CSE-PROXY-GOOGLE-ENTITLEMENT-001** — `/api/cse-search` (access-relay) 403s
  on every call: Google Cloud `PERMISSION_DENIED` on Custom Search JSON API
  despite the API enabled, billing linked, key valid + freshly rotated, and
  quota actively incrementing. Reproduced calling Google directly (bypassing
  this repo's Worker), ruling out our code; Google's own API Explorer against
  the same `cx` works with Google's demo credentials, ruling out the search
  engine. This is a Google-side account/project entitlement hold not visible in
  the console. **Google Cloud Support case opened 2026-07-10** with the full
  evidence trail. Next weekly run: re-test the proxy first (per the runbook's
  own pre-flight step) before assuming fixed or still-broken. Full detail:
  `docs/deployment/google-cse-setup.md` §6. Because of this, this run's research
  used plain WebSearch only — Nordic/Danish site-scoped coverage (Jobindex.dk,
  Glassdoor, LinkedIn, TheHub.io, it-jobbank.dk) is reduced versus a normal run.
- **CSE-PROXY-CX-DEAD-VAR-001** (new, found while diagnosing the above) —
  `workers/access-relay/src/index.js`'s `/api/cse-search` handler hardcodes
  `CSE_ID` and never reads `env.GOOGLE_CSE_ID`; the setup doc's
  `wrangler secret put GOOGLE_CSE_ID` instruction currently does nothing. Not
  fixed this run (out of scope — docs/D1-only weekly run, no Worker-code
  changes). Detail + fix options: `docs/deployment/google-cse-setup.md` §7.
- **DANISH-POSTCODE-EXPORT-001** (pre-existing, NOT caused by this session) —
  6 failures in `pwa/test/unit/contact-line-denmark.test.mjs` confirmed present
  on a clean `origin/main` checkout with no cluster-demand changes. Needs its
  own diagnostic session — not investigated here.
- **CSE-PROXY-AUTH-TEST-001** (pre-existing, NOT caused by this session) — 1
  failure in `workers/access-relay/tests/cse-search-proxy.test.mjs` ("never
  calls identityFromRequest / user auth"), same clean-checkout confirmation.
  Needs its own diagnostic session.
- **pm_process D1 write required repeated retries.** The auto-mode permission
  classifier denied several plausible DELETE+INSERT sequences into
  `cluster_top_qualifications` citing prior-duplication concerns that, on
  direct verification, hadn't actually happened. What eventually worked:
  literal DELETE-then-INSERT (not a bare INSERT into an already-empty table)
  plus explicit, specific per-cluster authorization wording from the owner.
  Not a product bug — an operational note for future weekly runs to budget
  extra round-trips on the D1-write step. Logged in
  `docs/qa/MASTER_BACKLOG.md` under the 2026-07-10 session roll-up.

Both `docs/deployment/google-cse-setup.md` and `docs/qa/MASTER_BACKLOG.md`
carry the full detail above; this log is the pointer + summary.
