# AntCV nightly — 2026-07-11 report

Baseline: PWA **1.51.324-babel-invariant** (main, in sync with origin — `main...origin/main` = 0/0).
Suite **1217/1217** green. Boot-smoke **OK** (glDemo=function, 0 errors).
Model: this run executed by claude-opus-4-8 (single serial session; no versioned-asset edits, so no shift claim and no parallel worktrees needed).
Posture: **verify + report** — no un-blocked code fix exists tonight. Every open register row is owner-gated,
needs a second physical device, needs live models, needs an owner real-export eyeball, or is content-gen
work larger than one safe nightly. Nothing shipped; nothing left half-pushed. The newest work landed by the
cloud/mobile Routine since 07-09 (babel-fish language stack 1.51.259→1.51.324) was verified live + wired, not
re-implemented.

## Live-verify — all three tiers carry the latest deploys (no version regression)

- **PWA** live `ANTCV_VERSION = 1.51.324-babel-invariant` (antcv.pages.dev) **= repo TARGET exactly** — no
  245/246-class regression (the class the version ledger exists to catch). Live `app.js?v=1.51.322-wizard-new-user`
  matches repo (app.js itself was not re-bumped for the sidecar-only babel-invariant change; consistent).
- **access-relay** live `auth-30-langrenders` — carries the babel-fish `langRenders` cloud-cache sync (memory
  `babel-fish-language`).
- **demo-proxy** live `3.7.2-billing-cascade` — carries the KV-quota-masked-as-503 cascade fix (memory
  `kv-free-quota-masks-as-503`).
- **Sidecars wired + live-served** (guards against the dead-served-script class that bit tab-doc-isolation):
  `antcv-babel-relang.js` (1 `<script>` ref, ?v=1.51.324), `antcv-lang-fabrication-guard.js` (?v=1.51.136,
  live-served, exposes `window.AntcvLangFabricationGuard`), `antcv-pointer-stale-guard.js` (?v=1.51.135,
  live-served). version-override's own `?v=1.51.324-babel-invariant` — cache-bust quintet correct.

## Band A — mobile & tab isolation (P0)

- **A1 GEN-BACKGROUND-001 (rows 38/38a)** — Approach A (gen-memo checkpoint) shipped end-to-end (prior).
  No regression. The one open action is the **flip-default proposal**, still gated on a clean real-mobile A/B
  (needs the owner's phone). Not runnable headlessly. **Status: shipped; owner-gated (real-mobile A/B).**
- **A2 tab/device isolation (row 39a)** — VERIFY-FIRST, not re-implemented:
  - Leg 1 **AUTOSAVE-NO-DOWNGRADE-001**: guard source present `workers/access-relay/src/index.js:2917-2923`
    (never downgrade a row carrying a real meta / blank cv|cl), relay deployed at **auth-30** (≥ the auth-26 the
    07-06 run verified). Did **not** run a live downgrade-PUT (would mutate a real production row; no upside over
    source+deploy verification). **Status: verified live by source + deploy version.**
  - Leg 2 **PTR-STALE-GUARD-001**: sidecar wired (?v=1.51.135) + live-served. **Status: verified live-served.**
  - Per-device pointer model (**PARALLEL-GEN-POINTER-002**): relay uses `readActivePointer`/`writeActivePointer`
    (7 call sites) and carries **no** forbidden raw `INSERT INTO active_application … ON CONFLICT(user_hash)` —
    the ACTIVE_BUGS rule holds. **Status: verified.**
  - Leg 3 (row 19) two-real-device test — **owner-gated** (needs an actual second physical device; cannot be
    faked headlessly).

## Band B — data loss / crash

- **Row 40 SO-003** (core-comp resize wipes Selected Outcomes) — SHIPPED prior; no regression.
- **Row 41 SO-004** (React #185 on field commits) — instrumented; **owner-gated** (waiting on a live Android
  crash capture).

## Band C — content

- **Row 42 GEN-LANGFAB-001** — sidecar `antcv-lang-fabrication-guard.js` wired + live-served + exposes its global.
  **Status: SHIPPED, confirmed live.**
- **Rows 43 (CA-006) / 44 (JD-ANALYSIS-PRINT-001)** — SHIPPED prior; no regression.

## Band D — perf / design

- **Row 39 GEN-MODELROLE-001** — VERIFIED-LIVE (07-06): `MODEL_ROLES` in both wrangler `[vars]`, both proxy
  sources parse it, proxy deployed. No regression.
- **Row 45 PERF-001** — PARTIAL (1.51.158); the remaining cloud-sync `setTimeout` leg needs live DevTools
  profiling. **Status: owner/live-gated.**

## Band E — standing coverage (every run)

- **E1 register staleness sweep** — full survey; every open row has a status word (table below). No row found
  implemented-but-still-open. Babel-fish (07-10/11) is shipped + live; it is tracked in ACTIVE_BUGS + memory,
  not a register row, and introduced no register regression.
- **E2 settings-panel stability (row 17)** — `diag-personal-panel-probe` on 1.51.324: **0 mutations/8s, 0 page
  errors, DIAG PASS**. Panel at rest; no regression from the 07-09 baseline.
- **E3 button-audit (row 23)** — `diag-panel-button-audit` on 1.51.324: **196 buttons, 0 THROWS, 0 DEAD
  candidates**; active 119, not-visible-or-disabled **51**, ui-only 14, skipped-dangerous 12. Within the
  07-06/07/09 range (51–55 not-visible); no regression. Preview-only suspects unchanged (UI-state keys:
  settingsTab/settingsSubTab/topbarOrder/analytics counts/pagination probe — none are export-payload data).
  Artifact: `docs/qa/PANEL_BUTTON_AUDIT_2026-07-10.md` + `.json`.
- **E4 export/preview parity (row 34)** — DONE prior (1.51.154 role-merge stored-sections + 1.51.194
  group-empty-hide). No parity-affecting change on main since 07-09 (babel-fish is language rendering, not
  role-merge/section geometry) — nothing to re-verify.
- **Extra headless verify-results this run** (cheap coverage on the current bundle):
  - **Row 16** (sidebar TOOLS/REGULATORY justify↔left flap) — `diag-align-flap-probe`: alignment stable
    `center → center` on both tracked heads (238/234); **no flap**. Matches the 07-05 finding. Owner live-verify
    still the only open leg.
  - **Residue / write-storm** (row 26 family) — `diag-residue-dedup-loop`: **DIAG PASS** — write storm dead
    (2 sections writes / 15s), residue row stable (1), tools rows 3, 0 page errors.

## Every open register row — status word this run

| Row | Status this run |
|---|---|
| 1 | open — no convergence code (render/owner-gated; legs in 25/27) |
| 2 | diagnosed+locked (prior) |
| 3 | refreshed — float-spine flag default-OFF (unchanged) |
| 6, 8 | carry (owner-eyeball / kernel-v2) — untouched |
| 9 | PARTIAL — write pipeline exists; nightly research-refresh + `source='research'` writer still open (infra/owner-gated) |
| 14, 17, 30, 32, 33, 34 | DONE (prior) |
| 16 | re-verified this run — no flap (align stable center→center); owner live-verify open |
| 19 | owner-gated (second physical device) |
| 20, 25, 27, 28 | owner real-export eyeball (blocked) |
| 22 | owner-gated (spec first) |
| 23 | button-audit re-run — 196 buttons / 0 throw / 0 dead / 51 not-visible (no regression) |
| 24 | owner click-through (blocked) |
| 26 | residue/write-storm re-verified DIAG PASS; tools-compress gold-text still owner-gated |
| 29, 31 | partial / owner-gated |
| 35, 36, 37 | CLOSE-WITH-EVIDENCE (prior E1) |
| 38/38a | A1 shipped; real-mobile A/B owner-gated |
| 39 | VERIFIED-LIVE (prior) |
| 39a | A2 legs 1+2 re-verified live/source this run; leg 3 (two devices) owner-gated |
| 40, 42, 43, 44 | SHIPPED (42 confirmed live this run) |
| 41 | instrumented; owner-gated (live Android crash) |
| 45 | PARTIAL — cloud-sync setTimeout leg needs live profiling |
| 46, 47, 48, 52 | CLOSED / SHIPPED (prior) |
| 49 | not started (docx page-distribution core; dedicated session) |
| 53 | not started — P0 cross-app contamination; diagnostic-first, owner morning |
| 54, 55, 56, 57 | not started — content-gen family (JD kernel-recall / targeted furniture / relevance-trim / polish-rules); larger than one safe nightly, owner-gated |
| 58 | MOB-008 SHIPPED prior; residuals fold to 51/53/54/55/56/59A |
| 59 | (A) generator-owned (ties 27/49/57); (B) FIXED in hand-edit tooling; (C) renderer/generator |
| 60, 61 | diagnosed / guidelines crystallized — feed generator orphan-measure pass (59A) |
| 62 | header-banner rules DEPLOYED (docx-worker 1.14.133); 2 follow-ups open |
| 63, 64 | SHIPPED prior; owner live-verify pending |
| 65 | (A) modal / **E FIXED prior**; B/C/D diagnosed, need focused work + device info |
| 66, 67 | content-gen / owner-desktop-LLM (owner-gated) |
| 68 | (A) PRESERVED (backup branch `brandfit-per-app-scope`); B–F feed baseline / owner-gated |
| 69, 70, 71, 72, 73 | DONE (docx-worker 1.14.134-136 / CV rebuild); awaiting owner review |
| 74 | (A) DONE; (B) FIXED+deployed awaiting 1 owner gen; **(C) OPEN — background-stall, diagnostic-first with a real device (sensitive SSE stream code)** |

No open register row was left without a status word this run.

## Owner-decision list
- **A1 flip-default** (`antcv:gen-resume` → default-on): still gated on a clean real-mobile A/B (needs your phone).
- **Row 68(A) merge**: rebase `brandfit-per-app-scope` onto main + run the D1 `ALTER TABLE application ADD COLUMN
  style_config TEXT;` (fresh confirm) + merge — unpressured, your call on timing.

## Owner-verify list (carried, need your eyes/phone)
- Rows 63/64: load a saved app → its own JD analysis loads; analysis-PDF keeps filled gap detail + recruiter answers.
- Row 65E: generating a targeted app on desktop no longer flips the unsolicited app under review on mobile.
- Row 74B: one foreground generation confirms the JD-swap no longer targets the previous JD's company.
- Rows 35–37: one live 3–6 min unsolicited regen to formally close the regen-confirm trio.
- Rows 42 (fabricated languages) / 43 ("Application:" bleed) / 44 (analysis-PDF print): one live targeted gen each.
- Babel-fish: on your phone/desktop, switch the ribbon language and confirm the cached render restores instantly
  and a fresh gen honours the ribbon language (all verified live 07-11 on karp.gabriel.a@antcv.net, but a
  second real-device confirm is worth one glance).

## Owner-gated / blocked (prep only, cannot close headlessly)
Rows 19 + 39a leg-3 (second physical device); row 41 (live Android #185); row 45 cloud-sync leg (live DevTools
profiling); rows 53–57/59/66/67 (content-gen family — larger than a safe one-nightly close, and a fresh
production gen is model-gated); rows 20/25/27/28 (real PDF export eyeball); row 49 (docx page-distribution core);
row 74C (background stream-throttle — sensitive SSE code, diagnostic-first with a real device).

## Durable lessons → auto-memory
No new durable lesson this run — the verify-first posture and the babel-fish/relay/proxy live-verify are already
captured in memories `babel-fish-language`, `live-verify-browser-pane`, `kv-free-quota-masks-as-503`, and
`jd-scope-isolation`. This run confirmed those memories still hold against live production.
