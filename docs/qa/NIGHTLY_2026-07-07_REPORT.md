# AntCV nightly — 2026-07-07 report

Baseline: PWA **1.51.193** → shipped **1.51.194**. Suite 1170 → **1199/1199** green.
Model: this run executed by claude-opus-4-8 (main loop); two diagnostic subagents (general-purpose)
mapped row 52 + ran the E1 sweep in parallel. No parallel worktrees needed (single serial ship).

## Headline ship

**GROUP-EMPTY-HIDE-001 (register row 52) — SHIPPED 1.51.194, PWA + docx-worker DEPLOYED.**
A `{grp}` labeled-list sub-heading (TOOLS & METHODS "Project & delivery management") with a heading
but zero child rows was left as a bare dangling label. Verify-first (two agents) confirmed BOTH
render sites emitted the grp heading on non-empty title text alone, never looking ahead at content
rows — and both already drop rows at render (hidden[], "Hidden -" residue, bracket placeholder,
both-sides-blank), so a group can look non-empty in stored `items` yet render empty. Fix = an
in-render `__grpHasChild(gi)` look-ahead at each site that mirrors that side's own drop rules; the
heading hides iff zero following rows (to the next `{grp}`) render, and returns the moment a real
child appears. Sites: `app.src.js` preview map + minified `app.js` mirror (`__gc`, node-patch +
`vm.Script` gate, occurrence=1 anchors, IIFE head asserted); `docx-worker/src/index.js`
renderRichBlock. Test `group-empty-hide.test.mjs` (29) brace-extracts BOTH real helpers and runs one
shared 9-case fixture table asserting preview↔export parity + a minified mirror-lock. Boot-smoke OK.
Quintet → 1.51.194. PWA auto-deploy run 28831984998 success; docx-worker deploy run 28832019410
success (palette/registry pre-flight green). **Owner-verify:** a TOOLS & METHODS group whose only
rows were trimmed/hidden now shows no dangling heading in preview AND export.

## Standing coverage (Band E)

- **E1 register staleness sweep** — 6 rows verified against current code:
  - **35, 36, 37 → CLOSE-WITH-EVIDENCE** (regen-confirm items validated by code + green tests:
    overlay-watchdog heartbeat gate; unsolicited-corecomp-broad 27/27; EO `_canon` label). One live
    owner regen would formally close; validated-implicitly meanwhile.
  - **3 → refreshed** — float-spine flag confirmed default-OFF (docx-worker:24415 + docx-client:947-949).
  - **9 → refreshed PARTIAL** — the "no worker writes the cluster table" note is now STALE: the WRITE
    pipeline shipped (recomputeClusterTop20, access-relay:2113, source='jd', CLUSTER-DEMAND-GLOBAL-001
    2026-07-05). STILL OPEN: the nightly research refresh — no production `source='research'` writer,
    no cluster-refresh cron (only the */5 LLM-health aggregate).
  - **1 → confirmed genuinely open** (no convergence code; render/owner-gated; legs live in 25+27).
- **E2 settings-panel stability (row 17)** — diag-personal-panel-probe on 1.51.194: **0 mutations/8s,
  0 page errors, DIAG PASS**.
- **E3 button-audit (row 23)** — diag-panel-button-audit on 1.51.194: **196 buttons, 0 page errors**,
  active 116, not-visible-or-disabled 52 (07-06 baseline was 55→51; same range, no regression).
- **E4 export/preview parity (row 34)** — DONE prior (1.51.154); tonight's row-52 ship is itself a
  preview↔export parity fix, parity-asserted by the new test.

## Bands A–D — verify-first status (most already shipped/verified before this run)

- **A1 GEN-BACKGROUND-001 (38/38a)** — engine SHIPPED 1.51.133/134, default OFF. Real-mobile A/B +
  flip-default proposal remain **OWNER-GATED** (needs the owner's phone; can't be faked headlessly).
- **A2 tab/device isolation (39a)** — legs 1+2 shipped (AUTOSAVE-NO-DOWNGRADE-001 relay @ auth-26,
  PTR-STALE-GUARD-001 @ 1.51.135), code+version verified in the 07-06 run. Live downgrade-PUT curl
  not run (needs auth + a real production row — owner-gated). Leg 3 (two real devices) **owner-gated**.
- **B1 SO-003 (40)** — SHIPPED 1.51.138 (loss-guard belt). **B2 SO-004 (41)** — no headless repro;
  crash-capture probe SHIPPED 1.51.160, **waiting on a live Android crash** (owner-gated).
- **C1 GEN-LANGFAB-001 (42)** — SHIPPED 1.51.136 (owner-verify on a fresh gen). **C2 CA-006 (43)** —
  SHIPPED 1.51.139. **C3 JD-ANALYSIS-PRINT-001 (44)** — SHIPPED 1.51.137.
- **D1 PERF-001 (45)** — PARTIAL 1.51.158 (cloud-sync setTimeout leg still open). **D2 GEN-MODELROLE
  (39)** — VERIFIED-LIVE 2026-07-06.

## Every open register row — status word this run

| Row | Status this run |
|---|---|
| 1 | open — E1-verified no convergence code (render/owner-gated) |
| 2 | diagnosed+locked (prior) |
| 3 | refreshed — flag default-OFF confirmed |
| 6, 8 | carry (owner-eyeball / kernel v2) — untouched |
| 9 | refreshed PARTIAL — write pipeline exists, research-refresh open |
| 14, 17, 30, 32, 33, 34 | DONE (prior) |
| 16 | prior re-run; owner live-verify open |
| 19 | owner-gated (second physical device) |
| 20, 25, 27, 28 | owner real-export eyeball (blocked) |
| 22 | owner-gated (spec first) |
| 23 | button-audit re-run this run — 196/0 err/52 not-visible |
| 24 | owner click-through (blocked) |
| 26 | open — untouched |
| 29, 31 | partial / owner-gated |
| 35, 36, 37 | CLOSE-WITH-EVIDENCE (E1) |
| 38/38a | A1 shipped; real-mobile A/B owner-gated |
| 39 | VERIFIED-LIVE (07-06) |
| 39a | PARTIAL 2/3 legs; leg 3 owner-gated |
| 40, 42, 43, 44 | SHIPPED (belts) |
| 41 | instrumented; waiting live crash (owner-gated) |
| 45 | PARTIAL 1.51.158 |
| 46, 47 | CLOSED |
| 48 | SHIPPED |
| 49 | not started (docx page-distribution core; dedicated session) |
| **52** | **SHIPPED 1.51.194 (this run) — deployed** |
| 53 | not started — P0 six-leg cross-app contamination; diagnostic-first, owner morning |
| 54 | not started — JD kernel-recall (content-quality) |
| 55 | not started — targeted-output furniture (hand-fixed) |
| 56 | not started — JD-relevance trim (hand-fixed) |

## Owner-decision list
- **A1 flip-default**: propose making `antcv:gen-resume` default-on ONLY after a clean real-mobile
  A/B (start→lock→foreground auto-resume; mid-run reload; output matches flag-off). Needs your phone.

## Owner-verify list
- Row 52: trim/hide all rows under a TOOLS & METHODS group → no dangling heading, preview + export.
- Row 42: a fresh gen no longer fabricates languages (kernel: EN/HE fluent, ES pro, DA B1, no German).
- Rows 43/44: "Application:" no longer bleeds into role 1; Download-analysis(PDF) prints the analysis.
- Rows 35–37: one live 3–6 min unsolicited regen to formally close the regen-confirm trio.

## Owner-gated / blocked (prep only)
- Rows 19 + 39a leg-3 (a second physical device); row 41 (a live Android #185 to populate the probe);
  rows 53–56 (content-gen family, KOMBIT — diagnostic-first, larger than a safe one-nightly close);
  rows 20/25/27/28 (a real PDF export to eyeball); row 49 (docx page-distribution core).

No open register row was left without a status word this run.
