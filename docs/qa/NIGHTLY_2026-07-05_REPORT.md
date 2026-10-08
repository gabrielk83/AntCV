# AntCV nightly — 2026-07-05 REPORT

Run: local antcv-nightly (desktop clone). Model: Opus 4.8 (1M) orchestrator; four
Sonnet-class subagents ran the parallel DIAGNOSIS fan-out (SO-003, SO-004,
GEN-LANGFAB, CA-006/JD-ANALYSIS). All INTEGRATION + DEPLOY were serial on the
orchestrator. Sync-first honoured; never force-pushed; suite green before every push.

Start: PWA 1.51.135 / relay auth-26 / proxy+demo-proxy 3.7.2 / suite 968.
End:   **PWA 1.51.139** / suite **992/992** / 4 fixes shipped to main, pushed.

## SHIPPED THIS RUN (4, all sidecar-only, no app.js edit, each fully gated + pushed)

| ID | Row | Version | What | Tests |
|----|-----|---------|------|-------|
| GEN-LANGFAB-001 | 42 | 1.51.136 | Deterministic language-fact belt: drops fabricated languages (German) + corrects levels (Danish→B1) vs kernel `personalInfo.languages`, name-neutral | lang-fabrication-guard 9/9 |
| JD-ANALYSIS-PRINT-001 | 44 | 1.51.137 | Analysis PDF printed the CV — root cause was the print SURFACE (visibility:hidden/0x0 iframe → Chrome prints the parent), not a wrong doc-type; render-present offscreen iframe | analysis-print-surface 3/3 |
| SO-003 | 40 | 1.51.138 | DATA LOSS: core-comp resize wipes Selected Outcomes — loss-guard belt (local-only snapshot survives the cloud round-trip, heals empty/placeholder-only) | outcomes-loss-guard 8/8 |
| CA-006 | 43 | 1.51.139 | Application label bleeds into first role title — preview-only Path-C bleed; strictly-additive header-whitelist guard | ca006-pathc-header-guard 4/4 + Playwright regression green |

Bands B (data loss/crash) and C (content correctness) content items are now fully
shipped except SO-004 (see below). Every fix corrected the register's own root-cause
guess via verify-first (JD-ANALYSIS was a print-surface bug not a doc-type; CA-006 is
preview-sidecar not app.js/roles[0]; SO-003 has no single writer).

## BAND-BY-BAND

### Band A — MOBILE & TAB ISOLATION (verify-first; device-gated legs flagged)
- **A1 GEN-BACKGROUND-001 (rows 38/38a):** VERIFIED SHIPPED end-to-end (approach A memo + auto-resume + input-sig, default OFF). Did NOT re-implement. The real-mobile A/B (start→background→foreground auto-resume; mid-run reload resume; output parity) and the flip-default proposal are **OWNER-GATED — need a real phone**; cannot be done headlessly. No code change this run.
- **A2 leg 1 AUTOSAVE-NO-DOWNGRADE-001 (relay):** VERIFIED LIVE at the strongest level — the DEPLOYED relay bundle was fetched from Cloudflare (Workers MCP) and contains the guard verbatim (`__blockDowngrade`/`__blockCvBlank`/`__newDowngrade` at lines 2656-2696) at `RELAY_VERSION=auth-26-per-style-kernels`. This is byte-level confirmation the guard is in the RUNNING code, not just a version-string match. Deliberately did NOT forge an authenticated downgrade PUT against a real production row (would mutate real data + needs the relay session/secret I don't hold); deployed-code + the 5/5 unit test are sufficient.
- **A2 leg 2 PTR-STALE-GUARD-001 (client):** VERIFIED at the code level — loaded (`antcv-pointer-stale-guard.js?v=1.51.135`, index.html:40), and the unit + both-bundle mirror-lock suite is **22/22**, including "both meta/sections adoption sites call AntcvPointerStaleGuard in BOTH bundles" (the guard is OR-ed into `__draftDrift`/`__draftDrift2` in both app.src.js AND app.js) plus 12 pure-function scenarios (same-device-stale flagged; foreign-device not-this-guard; newer-pointer still adopts; clock-skew margin; kill switch; no-false-evidence). The wiring + logic are deterministically proven; the remaining live two-tab A/B is inherently a browser/owner check (a headless two-tab race is unreliable).
- **A2 leg 3 (row 19 two-real-device test):** OWNER-GATED — needs a physical second device; cannot be faked with a second tab. Staged for owner.

### Band B — DATA LOSS / CRASH
- **B1 SO-003 (row 40):** SHIPPED 1.51.138 (see table).
- **B2 SO-004 (row 41):** DIAGNOSED, NOT FIXED — deliberately. React #185 in this React-18 bundle = "Maximum update depth exceeded" (setState loop), confirmed by the owner's own probe `antcv-diag-probes-370.js:347`. The two known #185 measure→setState loops (salmon repaint 16447; photo autosizer 18922) are ALREADY guarded and mirrored. Every remaining measuring effect traced has a stable fixed point or dep-array guard, and both existing repro harnesses NO-REPRO. SO-004 is a third instance never captured with a stack; static analysis cannot isolate the exact site, and CLAUDE.md forbids a speculative render patch. **Next action = live capture, not a patch:** fix the harness's side-panel-open gap + add a render-count-with-caller-stack instrument (spec in the SO-004 diagnosis). Row stays TO DO with a precise probe plan.

### Band C — CONTENT CORRECTNESS
- **C1 GEN-LANGFAB-001 (row 42):** SHIPPED 1.51.136.
- **C2 CA-006 (row 43):** SHIPPED 1.51.139.
- **C3 JD-ANALYSIS-PRINT-001 (row 44):** SHIPPED 1.51.137.

### Band D — PERF / DESIGN
- **D1 PERF-001 (row 45):** NOT STARTED this run — a Chrome CPU-profile task needing a live browser profile; lower priority than the shipped data-loss/content fixes. Carried. Method unchanged (profile export + preview toggle → find the sync long task).
- **D2 GEN-MODELROLE-001 (row 39):** VERIFIED LIVE (2026-07-05 follow-up, "fix D2" request) — MORE complete than the first pass stated; a self-correction is recorded below. `MODEL_ROLES={"writer":"anthropic","supervisor":"mistral","coherence":"anthropic"}` is set in both wrangler.toml [vars]; proxy+demo-proxy `/health` = `3.7.2-billing-cascade` (newer than the 3.7.1 var-commit snapshot → var applied on deploy). Code consumes it (`multi-llm.js roleHeadOrder`; supervisor.js `role:'supervisor'`; gen-coherence.js `role:'coherence'`; writer = default head, confirmed `compress`→claude-opus-4-7). **LIVE PROOF:** a direct curl to `/api/supervisor/check` ran a REAL grounding LLM (`grounding_skipped_reason:null`, duration ~2.9s) and caught GEN-LANGFAB-class fabrication (invented German/Klingon/NASA, grounding score 0) — the supervisor works live and routes to mistral by construction (role tag + deployed var + head-reorder). **SELF-CORRECTION of the first-pass caveat:** the first pass claimed "0 supervisor `llm_calls` → not exercised live." That was WRONG — the supervisor grounding path does NOT log to llm_calls, so absence there is not evidence. The supervisor IS wired into live generation: `pwa/antcv-overlay.js` (loaded; `CFG.enabled.supervisor=true`) wraps fetch and, on a cv-proxy response carrying `X-AntCV-Task` (proxy sets it at index.js:1078), calls runSupervisor → `/api/supervisor/check`. It is ADVISORY (panel + auto-fix / "Accept anyway"), not a hard block, and per-section supervision is keyed to specific tasks (cv_profile/cv_outcomes/cl_who_i_am/cl_how_i_would_contribute) — the LANGUAGES section is not one, which is why fabricated languages still slip through and the deterministic GEN-LANGFAB belt remains the right fix. COHERENCE, separately, is NOT live (it lives in the default-off /job engine, row 38). No redeploy needed; D2 is closed as verified-live.

### Band E — STANDING COVERAGE
- **E1 register staleness sweep:** advanced 4 rows to SHIPPED with evidence (40, 42, 43, 44). Oldest verified:no rows (1, 3, 9, 14, 16, 20, 35-37) are deep/owner-gated or need live models/a real regen — carried with their existing plans; none silently skipped (statuses below).
- **E2 settings-panel stability (row 17):** VERIFIED — `diag-personal-panel-probe.mjs` = **0 mutations / 8s, 0 page errors** (the 1.51.128 lock holds; my sidecar changes did not regress it). REMAINING: re-point the probe at Layout/Account/Advanced (the probe currently targets Personal) — carried.
- **E3 button-audit pass 2 (row 23):** not re-run this run (heavy Playwright; first-run report is current). Carried.
- **E4 export/preview parity (row 34):** ROLE-MERGE stored-sections parity still TO DO (owner-escalated top item). Carried.

## FULL-COVERAGE REGISTER STATUS (every open row has a status word this run)

- Row 1 (quick-gen/CV page convergence): carried — render-gated, owner/live.
- Row 2 (SW-projects line-end overflow leg): carried — verify against current export.
- Row 3 (floating spine byte-diff): carried — owner re-export gate.
- Row 6 (wizard/settings owner eyeball): carried — owner gate.
- Row 8 (kernel v2 remainder): carried — es/zh needs real models; §6 owner-gated.
- Row 9 (cluster demand worker pipeline): carried — worker build.
- Row 14 (JD-scan hallucination reorder): carried — needs real models + owner.
- Row 16 (sidebar justify↔left flap): carried — owner live re-check after hard refresh.
- Row 17 (settings sweep): VERIFIED Personal panel still at rest; Layout/Account/Advanced remaining.
- Row 19 (two-real-device test): OWNER-GATED (physical second device).
- Row 20 (owner verify list, 6 items): carried — owner hard-refresh + regen + re-export.
- Row 22 (CL slogan rich_block ph2): carried — spec-first, owner-gated (double-render hazard).
- Row 23 (button-audit pass 2): carried — harness + run-1 current.
- Row 24 (analytics buttons): carried — owner click-through confirm.
- Row 25 (table geometry parity): carried — real CloudConvert PDF diagnose, owner.
- Row 26 (tools sidebar gold-text rule): carried — owner gold strings as deterministic rule.
- Row 27 (orphan sweep v3 real-PDF verify): carried — owner export gate.
- Row 28 (NIL gen ~1.5pp target): carried — rides row 27; fresh-gen owner gate.
- Row 29 (NIL state-stick leg C role-structure): carried — clean repair = regen; belts protect export.
- Row 30 (LLM image routing): carried — ee() image-aware filter (worker).
- Row 31 (poisoned NIL row repair leg b): carried — auto-save downgrade belt (app.js auto-commit).
- Row 32 (CL platform-signals): carried — gen-prompt rule, app.js mirror.
- Row 33 (export-align parity family): carried — docx-client + worker legs.
- Row 34 (export/preview role-merge parity): carried — owner-escalated top item.
- Rows 35-37 (regen-confirm): carried — need a real owner regen (cannot confirm headlessly).
- Row 38/38a (GEN-BACKGROUND): VERIFIED shipped; owner A/B + flip-default gated on a real phone.
- Row 39 (GEN-MODELROLE): VERIFIED LIVE + CLOSED — var applied, code consumes, supervisor grounding runs live (curl proof, ~2.9s, catches fabrication, routes mistral) and IS wired into gen via antcv-overlay; first-pass "not live" caveat corrected (grounding doesn't log to llm_calls). Coherence remains /job-gated (row 38).
- Row 39a (tab/device isolation): 2 of 3 legs VERIFIED — leg 1 relay guard confirmed in the DEPLOYED bundle (byte-level), leg 2 client guard 22/22 incl. both-bundle mirror-lock; leg 3 (two-real-device) owner-gated.
- **Row 40 (SO-003): SHIPPED 1.51.138.**
- Row 41 (SO-004): DIAGNOSED, not isolable statically — live-capture probe plan filed.
- **Row 42 (GEN-LANGFAB): SHIPPED 1.51.136.**
- **Row 43 (CA-006): SHIPPED 1.51.139.**
- **Row 44 (JD-ANALYSIS-PRINT): SHIPPED 1.51.137.**
- Row 45 (PERF-001): carried — needs a live CPU profile.
- Row 46 (MOBILE-PANEL-ZOOM-001): carried — needs a mobile-viewport repro (Band A mobile P0; next-run candidate, headless resize is feasible).

## OWNER-VERIFY LIST (this run's shipped fixes)
1. GEN-LANGFAB: run a fresh generation — languages must show EN/HE fluent, ES professional, DA B1, and NO German.
2. JD-ANALYSIS-PRINT: click "Download analysis (PDF)" — you should get the branded analysis report, not the CV.
3. SO-003: change the Core Competencies row count — Selected Outcomes must survive (no wipe).
4. CA-006: on a targeted gen where a role shares the meta role/company, the first role title must NOT be prefixed with "Application: …".

## OWNER-DECISION / DEVICE-GATED (cannot be done headlessly)
- A1 real-mobile A/B of gen-resume + the flip-default proposal (needs a phone).
- A2 two-real-device isolation test (row 19) + live two-tab stale-pointer A/B on your tab.
- Rows 35-37 regen-confirm (one real regen closes all three).
- Row 46 mobile panel-zoom clip (a headless 380px repro is feasible next run; owner has the screenshots).

## NOTES
- No app.js / app.src.js edits this run — all four fixes are self-contained sidecars, so no minified-mirror risk, no boot-smoke needed. main was never regressed; sync-first + rebase before every push.
- The parallel worktrees under `.claude/worktrees/*` are other sessions' — untouched.

---

# SESSION 2 — 2026-07-05 late (desktop antcv-nightly, Opus 4.8 1M)

**Preceding state:** SESSION 1 (above) shipped 1.51.136-139; the tree then advanced further (parallel
sessions) to **PWA 1.51.163** — the state at this session's start. Sync: `pull --rebase` → already up to
date. This was an **implementation-exhausted verification night**: every Band A–D register item is
already SHIPPED or owner/device-gated. One real defect found + fixed; live-deploy state re-confirmed;
register staleness swept. This session **confirms** SESSION 1's verifications (D2/A2) and extends the
standing coverage — no contradictions.

## SHIPPED (session 2)

### NATIVE-PRINT-CLIP-TEST-EOL-FRAGILE-001 — test-only, no version bump, no cache-bust
- **Symptom:** the nightly baseline suite failed **on this Windows desktop** with
  `native-print-clip.test.mjs` → "must contain an @media print block" (`printBlockMatch` null); the Linux
  cloud Routine reported the same suite green (that is why every "992/992" claim held there).
- **Root cause (measured, not guessed):** the test finds the `@media print` block by a fixed
  character-offset slice `css.slice(printFixIndex, printFixIndex + 1200)`. Git stores
  `antcv-mobile-controls.css` as **LF** (blob 1337 LF / 0 CRLF); a Windows `autocrlf` checkout
  materialises it **CRLF** (1337 CRLF pairs). The ~12 extra `\r` bytes in the NATIVE-PRINT-CLIP-001
  comment shift the block's closing brace from offset **1180 (LF)** to **1203 (CRLF)** — 3 bytes past the
  1200 window — so the regex finds no terminating `\n}`. The **production fix is correct and present**
  (the `@media print` un-clip in 18ad1fb); only the test's offset math was checkout-dependent, and it was
  red-on-Windows from the moment it landed.
- **Fix:** `.replace(/\r\n/g,'\n')` on read (canonical-LF offsets) + windows 1200→1600.
- **Verified:** 5/5 assertions pass on this CRLF checkout; full pwa suite **1065/1065** (was 1064/1065 —
  this was the sole failure). File: `pwa/test/unit/native-print-clip.test.mjs`.

## VERIFICATION (session 2 — extends/confirms session 1)

- **D2 GEN-MODELROLE (row 39) — DEPLOY-VERIFIED, consistent with session 1.** `MODEL_ROLES` present in
  BOTH wrangler.toml; cv-proxy /health `3.7.2-billing-cascade` **== tree VERSION**, relay auth-26 == tree
  ⇒ `[vars]` applied live. **D1 `llm_calls` cross-check (new this session):** queried the live `ant_memory`
  DB — the generation pipeline logs by `task` (compress / consensus_poll / parse_jd / analyze_fit / …),
  **0** rows tagged supervisor/coherence/writer. This **corroborates SESSION 1's self-correction**: the
  supervisor grounding path does not log to `llm_calls`, so telemetry-absence is not evidence of absence
  — SESSION 1 already proved the supervisor runs live via an authed `/api/supervisor/check` curl. All four
  providers healthy live. Nothing to redeploy.
- **A2 tab/device isolation (row 39a) — DEPLOYED-CODE re-confirmed.** Leg 1 relay guard at index.js:2519
  in the live PUT/POST handler, RELAY_VERSION == /health. **New observation:** the `meta` blob write
  (line 2544) is not downgrade-guarded server-side (jd_company/jd_role are) — client guards backstop it;
  logged as an owner-decision follow-up. Leg 2 PTR-STALE-GUARD present + wired both bundles. Legs' live
  A/B + leg 3 remain owner/device-gated.
- **E2 settings-panel stability (row 17) — extended past session 1.** SESSION 1 probed only the Personal
  panel; this session ran `diag-settings-panels-probe` across **Personal + Account + Layout** on 1.51.163
  → all **0 mutations/6s, 0 page errors, DIAG PASS**. Row 17 DONE holds and is now verified on all three
  standard panels.
- **E1 register staleness sweep.** Rows dated 2026-07-05 with code-presence evidence: **35** (`__antcvGenCost`
  heartbeat present), **36** (`CORECOMP-BROAD` present), **37** (FOCUS-AREA canon rules present) — the
  1.51.41-43 fixes survived 120+ version bumps un-regressed; regen-confirm still owner-gated. Row **9**
  confirmed a genuine gap (client half + `cluster_top_qualifications` D1 table exist; worker pipeline +
  cron unbuilt). Row **17** re-verified.
- **E3 button-audit (row 23):** re-ran `diag-panel-button-audit` on 1.51.163 (PANEL_BUTTON_AUDIT_2026-07-05.json):
  197 buttons — 118 active, 12 dangerous-skipped, 10 ui-only, 55 not-visible, **unclickable 23→2** (the
  pass-2 retry leg is holding), **0 page errors, 0 DEAD controls**. not-visible steady at 55 = the
  root-caused CJLR/dblclick family (not a bug). The 8 "preview-only" keys flagged are legitimate UI state
  (settingsTab/subTab/topbarOrder/analytics counts/probes), not export-parity gaps. Live dangerous-button
  audit + CJLR pass-3 remain owner-gated.

## SESSION-2 OWNER-DECISION additions
- **D2 role-tagged logging (optional):** `llm_calls` logs by task only, so supervisor→mistral is invisible
  in telemetry (the live proof is the authed curl, not the DB). If you want D2 permanently self-verifiable
  from D1, add a role tag on the generation calls (small change, both proxies, needs deploy). Not done —
  D2 is verify-only.
- **A2 server meta-guard (minor):** relay downgrade guard covers `jd_company`/`jd_role` but not the `meta`
  blob; client guards backstop it. Close the server-side symmetry too?

## SESSION-2 NOTES
- Only edits: `pwa/test/unit/native-print-clip.test.mjs` (test robustness) + doc updates
  (`OPEN_REGISTER.md` rows 9/17/35/36/37/39/39a, `ACTIVE_BUGS.md`, this report). No production asset, no
  app.js, no cache-bust, no worker deploy. main never regressed; rebased-clean before push.

---

## CI NIGHTLY 2026-10-08 (GitHub Actions, unattended, Opus 4.8)

Run: `antcv-nightly` on GitHub Actions (gabrielk83/AntCV), unattended. No in-app Browser
pane, no signed-in session, no real-LLM gen, no Playwright browser, `ALLOW_DEPLOY=false`.
Scope was therefore the one band CI can fully execute: **Band E / E1 register staleness
sweep.** Docs + registers only, pushed direct to main per the CI SAFETY OVERRIDE.

**Baseline:** SYNC FIRST up to date at `54415990`. `node scripts/run-tests.mjs pwa` =
**1813/1813 green**. `check-register.mjs` OK.

### E1 — staleness sweep (5 rows re-verified, 0 closable in CI, 0 shipped)

After the 2026-10-06/07 sweeps `check-register.mjs --stalest 5` put the oldest rows at
**98/99/100/101/19, all 2026-09-25** (the four 2026-07-05 register-escape fixes + the
JD-scope code leg). All 5 re-verified against HEAD `54415990`, cited markers intact AND
cited tests re-run green, `verified:` refreshed to 2026-10-08 in the index + detail:

| Row | ID | Marker + test re-verified | Why not closable in CI |
|----|----|----|----|
| 98 | BYOK-COST-AUDIT-001 | `total_cost_usd_est` in both `byok-qualify.js` bundles + xAI grok rate rows in `demo-enforcement.js`; byok-cost-audit.test.mjs (+demo mirror) **14/14** | shipped+unreverted; grok rates still flagged for docs.x.ai re-verify |
| 99 | REG-GROUP-FOLD-NAMED-001 | `NAMED_FOLD` 2× in `pwa/antcv-dup-group-merge.js`; dup-group-merge.test.mjs green | owner sidebar-dancing investigation thread resolution unconfirmed |
| 100 | GRAB-ZONE-DISMISS-THRESHOLD-001 | both legs in `app.src.js` (`.antcv-panel-grab-zone`, `n - t > 80`, `scroller.scrollTop -= n - ly`); grab-zone test green | live-device confirm owner-gated |
| 101 | ZOOM-FLOOR-001 | `Math.max(0.1, Math.min(5.2,…))` pinch floor (~21024) + button floor (~52656); zoom-floor.test.mjs green | shipped+unreverted; no residual |
| 19 | JD-SCOPE-OCC2-GUARD-001 | `shouldAdoptCloudPointer` 2× (`antcv-jd-scope.js` + `app.src.js`); jd-scope-isolation.test.mjs green | two-real-device leg owner-gated |

The four row 98-101 are shipped register-escape fixes (verify-only maintenance); row 19's
code leg is already closed with a residual owner-gated device leg. None closable in CI —
every remaining leg is owner/live-device/owner-investigation-gated.

### Bands A-D — not advanced (same CI blocks as 2026-10-06/07)

A1/A2 need a real mobile/signed-in A/B; B1/B2 (SO-003/SO-004) need headless-browser
repro; C1-C3 + D1 need a real-LLM gen / CPU profile; D2 (GEN-MODELROLE live) needs
`gh`/relay telemetry access.

### Owner / Live-verify

Nothing new owed by this run; prior owner lists stand (PR-gate required check, row 39a
scratch app id, row 89 worker deploys ×3, row 115 meter-by-model). No PWA/worker asset
shipped, so no post-deploy live-verify is owed.

---

## CI NIGHTLY 2026-10-07 (GitHub Actions, unattended, Opus 4.8)

Run: `antcv-nightly` on GitHub Actions (gabrielk83/AntCV), unattended. No in-app Browser
pane, no signed-in session, no real-LLM gen, no Playwright browser, `ALLOW_DEPLOY=false`.
Scope was therefore the one band CI can fully execute: **Band E / E1 register staleness
sweep.** Docs + registers only, pushed direct to main per the CI SAFETY OVERRIDE.

**Baseline:** SYNC FIRST up to date at `dbcaf31c`. `node scripts/run-tests.mjs pwa` =
**1813/1813 green**. `check-register.mjs` OK (90 ACTIVE).

### E1 — staleness sweep (5 rows re-verified, 0 closable in CI, 0 shipped)

`check-register.mjs --stalest` put the oldest rows at **83/88/87/86 (2026-09-24)** and
**31 (2026-09-25)**. All 5 re-verified against HEAD `dbcaf31c`, cited markers intact,
`verified:` refreshed to 2026-10-07 in the index + detail:

| Row | ID | Marker re-verified | Why not closable in CI |
|----|----|----|----|
| 83 | JD-REMOVE-OWNER-VERIFY-001 | `JD-REMOVE-STICKY`/tombstone in `pwa/app.src.js` (6 refs) + `jd-remove-tombstone.test.mjs` green | owner live 4-step pass owed (remove/refresh/reopen/read-cloud) |
| 88 | OWNER-ROUND-3-BACKLOG | docx-worker `1.14.174-appline-edit` + `ROLE-SPLIT-CONT-001` + `fit_page_flow` in `gen-runner.py`/`density_fit.py` | 6 owner-deferred legs (19-app rollout, page-flow y-align, table geometry, render-gated) |
| 87 | OWNER-ROUND-2-RESIDUE-001 | `brandfit-per-app-scope` still `fc2477c` unmerged (`git ls-remote`) + `ROLE-SPLIT-CONT-001` | 5 legs need regen/brand-persist/signature-upload/deploy |
| 86 | GOLD-SESSION-FOLLOWUPS-001 | `role_canon` in `scripts/job-tracker/gold_audit.py` (3 refs) | content/regen/owner-gated residue legs |
| 31 | META-STATE-CORRUPTION-002 | `META-DRIFT-GUARD-002` + `META-DOWNGRADE-GUARD-003` in app.src.js (2× each) + app.js mirror; both guard tests green | remaining leg needs a live poisoned server row |

A sweep that correctly refreshes the stalest rows with current-HEAD evidence is a good
CI run (NIGHTLY_2026-07-05_PROMPT E1). Nothing closed because every remaining leg is
owner/regen/deploy/live-gated — CI has none of those.

### Bands A-D — not advanced (same CI blocks as 2026-10-06)

A1/A2 need a real mobile/signed-in A/B; B1/B2 (SO-003/SO-004) need headless-browser
repro; C1-C3 + D1 need a real-LLM gen / CPU profile; D2 (GEN-MODELROLE live) needs
`gh`/relay telemetry access.

### Owner / Live-verify

Nothing new owed by this run; prior owner lists stand. No PWA/worker asset shipped, so no
post-deploy live-verify is owed.

---

## CI NIGHTLY 2026-10-06 (GitHub Actions, unattended, Opus 4.8)

Run: `antcv-nightly` on GitHub Actions (gabrielk83/AntCV), unattended. No in-app Browser
pane, no signed-in session, no real-LLM gen, no Playwright browser, `ALLOW_DEPLOY=false`.
Scope was therefore the one band CI can fully execute: **Band E / E1 register staleness
sweep.** Docs + registers only, pushed direct to main per the CI SAFETY OVERRIDE.

**Baseline:** SYNC FIRST up to date at `de7fec6e`. `node scripts/run-tests.mjs pwa` =
**1794/1794 green**. `check-register.mjs` OK (90 ACTIVE).

### E1 — staleness sweep (8 rows re-verified, 0 closable in CI, 0 shipped)

The desktop + job-tracker nightlies ran earlier today and closed rows 70-73, so the
stalest set (`check-register.mjs --stalest`) was rows **65-69 (2026-09-23)** and
**75/77/81 (2026-09-24)**. All 8 re-verified against HEAD `de7fec6e`, markers intact,
`verified:` refreshed to 2026-10-06 in the index + detail:

| Row | ID | Marker re-verified | Why not closable in CI |
|----|----|----|----|
| 69 | — (CL POLISH v2) | `AI-assisted - author` hyphen footer in docx-worker/src/index.js | standing CL-rule anchor (kept ACTIVE by design) |
| 67 | CV-CORECOMP-BLANK-001 | `antcv-cl-slogan-control.js` loaded by index.html | convergence verify needs a signed-in 2nd-gen regen |
| 66 | LINKEDIN-CLICK-001 | `DELIVERABLE_PREFLIGHT_CHECKLIST.md` present | regen/deliverable-gated (re-deliver from kernel) |
| 65 | PTR-STALE-GUARD-001 | CROSS-DEVICE-GEN-LEAK ×4 app.src.js + `__fahA`/`__fahB` ×2 app.js + diag on disk | legs A-D need live-mobile / live-repro |
| 68 | JD-SYNC-001 | `origin/brandfit-per-app-scope` @ `fc2477c` (git ls-remote) | owner/desktop/regen-gated |
| 75 | JOBTRACKER-AUTOFILL-ADDFLOW-VERIFY-001 | **marker-location CORRECTED** (see below) | owner-gated live add-test |
| 77 | JOBTRACKER-TOP5-PERIODIC-RESCORE-001 | `jobtracker-top5-rescore.test.mjs` present + green | owner-decision gate (periodic re-score not built) |
| 81 | PHOTO-FUSE-OWNER-VERIFY-001 | `＋ Add photos…` + PW-CJLR guard + diag | owner-gated on-device visual pass |

**Row 75 marker-location correction (filed):** the 2026-09-24 note claimed the
autofill/enrich flow was "in `pwa/antcv-react-islands.js` (AUTOFILL-TOP5/tier/enrich/refine,
7 refs)". Those readable tokens are NOT in the built bundle — it was last rebuilt
2026-09-06 (`ce05d602`) and strips the comment markers. The flow lives in the island
SOURCE: `src/islands/JobTracker/{JobTracker.tsx,api.ts,rank.ts}` (all match
`autofill|enrich`). Feature is present + unit-covered; the note's file attribution was
imprecise, now corrected in the detail row.

### Bands A-D — not advanced (all blocked in this environment)

- **A1 GEN-BACKGROUND-001 / A2 TAB-DEVICE-ISOLATION:** need a real mobile gen A/B and a
  signed-in two-tab race — no browser/session here.
- **B1 SO-003 / B2 SO-004:** need headless-browser repro; no Playwright browser in CI.
- **C1 GEN-LANGFAB / C2 CA-006 / C3 JD-ANALYSIS-PRINT:** shipped already (see this
  report's earlier section); residual verify is real-LLM-gen-gated.
- **D1 PERF-001:** needs a CPU profile around export/preview in a real browser.
- **D2 GEN-MODELROLE-001 live verify:** needs `gh`/relay telemetry access.

### Owner

Nothing new owed by this run. The desktop nightly 2026-10-06 owner list stands:
(1) make "AntCV PR gate" a required branch-protection check; (2) row 39a scratch
application id; (3) row 89 worker deploys ×3 still owed; (4) row 115 meter-by-model
decision.

### Live-verify owed

None — this run shipped no PWA/worker asset, so no post-deploy live-verify is owed.
