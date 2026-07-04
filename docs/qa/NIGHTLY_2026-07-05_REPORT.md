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
