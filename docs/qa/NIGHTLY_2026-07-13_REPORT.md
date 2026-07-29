# AntCV nightly — 2026-07-13 report (autonomous, unattended)

Baseline at open **and** close: PWA **1.51.379-gen-width** (main, in sync with origin —
`git pull --rebase` = "Already up to date"). HEAD `3dee026`. docx-worker **1.14.150**.
Suite **1239/1239** green. Boot-smoke OK.

**No code shipped this run.** Every Band A–D register item is already shipped or gated on
something this environment cannot provide (a second physical device, a live LLM generation,
an owner eyeball, or a live-network CLI pipeline the sandbox shell blocks with 403). The
highest-value OPEN work — the GOLD-TARGET density per-application sweep — is **blocked here**
(reasons below), not skipped. This run is therefore a **verify-first + full register
staleness sweep + report**, which per the standing plan is the correct outcome when no SOLID
verified fix is available. Every open row gets a status word for 2026-07-13 below.

## Environment constraint discovered this run (shapes everything below)

- **Shell/Python outbound network is 403-gated.** `urllib`/`curl` to `antcv.pages.dev`,
  `antcv-access-relay…workers.dev`, and `cv-proxy…workers.dev` all return **HTTP 403**
  (Cloudflare/egress gate) — even a read-only GET with the `~/.antcv/token` Bearer.
- **The Browser pane CAN reach the live app** (in-page `fetch` from the real browser gets
  200s). Live-verify below was done through the Browser pane; anything that needs the
  **Python CLI pipeline** (density sweep, `measure_density.py` → docx-worker, `density_fit.py`
  → cv-proxy, relay PUTs) **cannot run from the sandbox shell**.

## Live-verify (via Browser pane, antcv.pages.dev)

- `window.ANTCV_VERSION = 1.51.379-gen-width` — **no version regression** (= local TARGET).
- Loaded `app.js?v=1.51.374-zh-name-photo` — **correct**: `pwa/app.js` was last changed at
  1.51.374; commits 375–379 are sidecar-only density work, so app.js's `?v` correctly stays
  at .374 while `antcv-version-override.js?v` is bumped to .379. **No stale-SW mask.**
- **Density architecture is DEPLOYED + live**: `antcv-bullet-targets.js?v=1.51.379-gen-width`
  and `antcv-auto-pagebreak-block-001.js?v=1.51.377-balance-lastpage` both confirmed loaded
  live at their bumped `?v`. This confirms GOLD-TARGET-LAYOUT-DENSITY-001 (1.51.375-377)
  shipped and reached production.

## Standing probes (Band E)

- **Suite**: `node scripts/run-tests.mjs pwa` → **1239/1239 pass, 0 fail** (17.0s).
- **boot-smoke**: `glDemo=function, errors=0` → **BOOT-SMOKE OK**.
- **Personal-panel stability** (`diag-personal-panel-probe.mjs`): **0 mutations / 8s, 0 page
  errors → DIAG PASS**. No regression of the settings sweep-army fix (row 17). The probe is
  hardcoded to the WRITING-STYLE (Personal) panel; row 17 already closed Account/Layout too.
- **Panel button-audit pass 2** (`diag-panel-button-audit.mjs`): **clean after two transient
  headless-Chromium crashes** (first two attempts hit a resource "Target crashed"
  mid-audit — environmental, not a product `THROWS`; the third ran to completion).
  **206 buttons | 0 THROWS | 0 page errors | 1 DEAD candidate.** The lone DEAD is the "100%"
  **zoom-level indicator** (a display element, no store-write expected on click) — benign, not
  a defect. 56 not-visible-or-disabled (up from 51 on 07-11, consistent with +10 new buttons),
  11 unclickable (2 auto-recovered via label-locator retry). **No regression** vs 07-11
  (196/0/0). Row 23 → VERIFIED.
- **`__balanceGate` (density last-page rule, row 61)**: code-verified — the gold LAST-PAGE
  calibration is present in `antcv-auto-pagebreak-block-001.js:340-345` (last page targets the
  MAIN column's own bottom, not the page cap), exported as `_balanceGate`, and covered by
  `pwa/test/unit/sidebar-balance-gate.test.mjs` (in the green suite). Logic-VERIFIED; the
  PREVIEW-render live-verify still needs a signed-in Browser-pane pass (next session).

## Band status

- **Band A (mobile & tab isolation, P0)** — A1 GEN-BACKGROUND-001 approach-A shipped
  1.51.133/134 (default OFF); the flip-default proposal and the server-decompose follow-on
  stay **owner-gated** (need a real mobile A/B gen — impossible headlessly, and the shell
  can't drive a live gen). A2 legs 1+2 (AUTOSAVE-NO-DOWNGRADE-001 relay, PTR-STALE-GUARD-001
  PWA 1.51.135) source-verified present & last live-verified 07-11; a **live downgrade-PUT
  test was NOT run** (it is a *write* to the owner's real relay data and needs auth — out of
  scope for an unattended run). Leg 3 (two real devices) **owner-gated**.
- **Band B (data-loss/crash)** — SO-003 SHIPPED 1.51.138; SO-004 waiting on a live Android
  crash to populate the 1.51.160 capture probe (no headless repro exists).
- **Band C (content)** — GEN-LANGFAB-001 SHIPPED 1.51.136; CA-006 SHIPPED 1.51.139;
  JD-ANALYSIS-PRINT-001 SHIPPED 1.51.137. All three carry an **owner-verify-on-a-fresh-gen**
  tail that this env can't drive.
- **Band D (perf/design)** — PERF-001 partial (cloud-sync setTimeout leg still needs live
  app.js profiling); GEN-MODELROLE-001 VERIFIED-LIVE 2026-07-06 (no change).
- **Band E (standing)** — done above (suite/boot/probes/live-verify + this sweep).

## Register staleness sweep — status word per open row (2026-07-13)

Convention: **VERIFIED** = re-confirmed against current code/live this run; **REFRESHED** =
status carried, no change and no new evidence obtainable in this env; the bracket names the gate.

| Row | Item | 2026-07-13 status |
|---|---|---|
| 1 | Page/CV convergence, export pagination parity | REFRESHED — render/owner-gated; density loop (375-377) is the live mechanism, per-app sweep pending |
| 2 | SW-projects line-end overflow | REFRESHED — content+bullets closed; table-fidelity → row 25 |
| 3 | Floating spine flag-on vs reference | REFRESHED — default-OFF confirmed; owner visual re-export still required |
| 6 | Wizard/Settings UX merged banned-words | REFRESHED — code-complete; owner eyeball gate |
| 8 | Kernel v2 bullets-path / es-zh / §6 | REFRESHED — needs real models + owner-gated docx pass |
| 9 | Cluster demand — worker refresh cron | REFRESHED — genuine gap; no `source='research'` writer / no cron (confirmed still absent) |
| 16 | Sidebar justify↔left flap | REFRESHED — no flap in repro; owner live-verify open |
| 17 | Settings sweep-army (Personal/Account/Layout) | **VERIFIED** — Personal probe 0 mut / DIAG PASS, no regression |
| 19 | JD-scope two-real-device test | REFRESHED — owner-gated (2nd physical device) |
| 20 | Owner verify list (6 sub-items) | REFRESHED — owner-gated |
| 22 | CL slogan rich phase 2 | REFRESHED — not started; content/owner |
| 23 | Preview button-audit pass 2 | **VERIFIED** — 206 buttons / 0 throw / 0 errors / 1 benign DEAD ("100%" zoom indicator); no regression; live dangerous-button audit owner-gated |
| 24 | Analytics buttons click-through | REFRESHED — owner click-through |
| 25 | Table geometry parity | REFRESHED — needs real CloudConvert PDF measure (renderer) |
| 26 | Tools sidebar compress gold-text | REFRESHED — owner gold-string, not started |
| 27 | Orphan sweep v3 | REFRESHED — folds into density loop (375-377); real-PDF verify gated |
| 28 | NIL gen ~1.5pp target | REFRESHED — live-gen gated |
| 29 | NIL state-stick leg C | REFRESHED — owner-gated row-repair |
| 31 | Poisoned NIL row repair | REFRESHED — leg a+b shipped; row-repair owner-gated |
| 38 | GEN-BACKGROUND-001 decompose | REFRESHED — engine shipped; decompose + flip-default owner-gated |
| 39a | Tab/device isolation residuals | REFRESHED — 2/3 legs shipped (source-verified); leg 3 two-device owner-gated |
| 41 | SO-004 React #185 | REFRESHED — capture probe shipped 1.51.160; waiting on a live crash |
| 45 | PERF-001 | REFRESHED — export-click leg shipped; cloud-sync leg needs live profiling |
| 49 | Sidebar group page-break (CONT.) | REFRESHED — docx-worker core-algo, dedicated session |
| 53 | Cross-app export contamination | REFRESHED — diagnostic-first; KOMBIT hand-delivered; ties row 39a |
| 54/56 | JD tailor kernel-recall / relevance-trim | REFRESHED — content-quality, live-gen gated; hand-applied on KOMBIT |
| 55/57 | Targeted furniture / polish rules | REFRESHED — generator-baseline; captured to checklist + memory |
| 58 | MOBILE-BUGS-2026-07 (MOB-001..009) | REFRESHED — MOB-006 candidate 1.51.197 needs owner live-verify; MOB-008/009 owner-priority, need real device |
| 59 | Generator-baseline (pagination/orphan + docx integrity) | REFRESHED — (A) generator-owned, ties density loop; (B) fixed; (C) needs a renderer |
| 60 | (verify-first queue item) | REFRESHED — no change |
| 61 | Float-spine / column-balance fill | **PARTIAL-VERIFIED** — `__balanceGate` last-page gold rule present (sidecar :340-345) + unit-tested (green suite); PREVIEW-render live-verify still pending (next-session) |
| 62 | Header-banner design rules | REFRESHED — docx-worker Track C deployed 1.14.133; validated on Trackman 07-08; follow-ups (CL double-subtitle, p2 balance→row 61) |
| 63 | Analysis stale-on-app-load | REFRESHED — SHIPPED 1.51.196; owner live-verify pending |
| 64 | Analysis export drops filled answers | REFRESHED — SHIPPED 1.51.196 + HARDENED 1.51.198 |
| 65 | Analysis+sync batch (A–E) | REFRESHED — E fixed 1.51.201; A modal hardened; B/C/D diagnosed, need device info |
| 66 | Trackman deliverable-review gaps | REFRESHED — generator-baseline, re-deliver-from-kernel |
| 67 | Desktop-run open queue (A–E) | REFRESHED — owner/desktop-LLM/regen-gated |
| 68 | Register-escape sweep | REFRESHED — (A) brandfit WIP preserved to `origin/brandfit-per-app-scope`; ALTER TABLE not run (owner fresh-confirm) |
| 74 | Live-app drive (estimator/stale-JD/bg-stall) | REFRESHED — (A)+(B) done+deployed; (B) awaits owner 1-gen; (C) background-stall OPEN, diagnostic-first |
| — | **GOLD-TARGET-LAYOUT-DENSITY-001** | **VERIFIED shipped+live** (1.51.375-377, sidecars served); **per-app SWEEP blocked this env** (needs the Python→relay/proxy pipeline the shell 403s on) |

Rows already CLOSED/DONE (4,5,7,10-15,18,21,30,32,33,34,39,40,42,43,44,46,47,48,52,69,70,71,72,73):
no change; carried closed.

## Blocked-this-environment (why nothing shipped)

1. **Density per-app sweep** (top OPEN, `DENSITY_SWEEP_SONNET5_HANDOFF.md`) — the pipeline is
   `density_fit.py`/`measure_density.py` calling cv-proxy + docx-worker + relay PUTs. The
   sandbox shell 403s on all three hosts, so it cannot run here. It also **mutates the owner's
   real saved-application data** and the handoff forbids running while a PWA session is open —
   this belongs to a **networked desktop session or the cloud Routine**, run at night, one
   session at a time. Not started here by design.
2. **Live-gen-gated content rows** (28, 54, 56, 8-c) — need a real LLM generation; the shell
   can't drive one and the Browser pane can't feed a 3-6 min SSE gen unattended.
3. **Owner-gated** (6, 16, 19, 20, 23-live, 24, 31, 38-flip, 39a-leg3, 58-live, 63, 74-B) —
   need an owner eyeball / a second physical device / a live mobile A/B.
4. **Renderer-gated** (25, 27-verify, 59-C, 61-verify) — need real LibreOffice/CloudConvert
   PDF measurement not available in this box.

## Owner-verify list (unchanged, carried)

MOB-006 language-tap (1.51.197); MOB-008/009 (mobile scroll + PDF split); rows 63/74-B one
foreground gen; row 20's six items; GEN-BACKGROUND flip-default A/B.

## Owner-decision list

- **Density sweep**: run it from the desktop (networked) or the cloud Routine at night, not
  from an unattended sandbox — confirm you want it kicked off and that no PWA session is open
  on the account.
- **GEN-BACKGROUND flip-default**: still needs the real-mobile A/B before proposing the
  one-line default flip.

## Next session (priority order)

1. **Live-browser verify of `__balanceGate`** (row 61, flagged "PREVIEW-side, needs a
   live-browser verify pass" in ACTIVE_BUGS) — drive the preview on a multi-page app in the
   Browser pane and confirm the last-page-main-bottom rule behaves as gold-calibrated. This is
   a *verify* (no data mutation) and IS doable through the Browser pane in a session that can
   sign in.
2. **Density per-app sweep** on a networked/cloud session (the runbook).
3. Re-run the button-audit in a less resource-constrained env (row 23).

## Method notes for the next runner

- The sandbox **shell** has no usable egress to the CF workers (403); the **Browser pane**
  does. Any live-verify must go through the Browser pane's in-page `fetch`/console.
- `pwa/app.js?v` correctly lags the version seed when a bump is sidecar-only — do not "fix"
  it to match the seed; check `git log -- pwa/app.js` before assuming a stale-SW mask.
