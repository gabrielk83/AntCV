# AntCV Nightly Plan — capable-session run sheet (2026-06-16)

Successor to `NIGHT_RUN_2026-06-16.md`. That doc inspected/swept all 16 old-open clusters; this is
the **execution plan** for a capable autonomous session — what to build, optimize, test, and deploy,
in order, with the verification gate for each. Assumes relay deploy permission is available
(confirmed) and that the session can run worker `wrangler deploy`, vite island builds, and the
`app.src.js`→`app.js` mirror.

## Standing discipline (every task)
- `pwa/app.src.js` edit → mirror minified `pwa/app.js` (anchor on string literals; `npm run
  build:app` identity round-trip) → bump `app.js?v=` in `index.html`. Commit both.
- Worker edit → `workers/docx-worker/src/index.js` (inlined, no build) → manual `wrangler deploy`,
  one deployer. proxy/demo-proxy parity: any `workers/proxy/src` change mirrored to
  `workers/demo-proxy/src`; separate CI deploys.
- Island edit → `src/islands/**` → vite `npm run build` → bump `antcv-react-islands.js?v=`. Bundle
  >50KB: built, never hand-written. Same for any file >~50KB (incl. ACTIVE_BUGS) → desktop git only.
- Every wrangler.toml: `[observability.logs] enabled=true, invocation_logs=true` after
  `compatibility_date`.
- A fix counts only if it holds in Preview + DOCX/PDF, desktop + mobile, after a hard refresh.
  Never Preview-only, never only-after-hard-refresh, never wrong-item.

---

## LANE 1 — Feature / fix implementation (autonomous-viable, spec'd)

Ordered safest-first. Each has a committed spec or a one-task scope.

### 1.1 Watermark — AI-notice last-page anchor  [worker]
Spec: `docs/qa/WM_AI_NOTICE_ANCHOR_SPEC_2026-06-16.md`. Closes WM-001/002/004/005 +
`AI-WATERMARK-EXPORT-LOCATION-001`. One worker change: strip the flowed notice from both builders
(spec §4.1) + inject a last-page-anchored VML text frame in `postProcessDocx` (§4.2). Unit test per
§7 (no flowed `AI-assisted` run; exactly one anchored shape; in the last page's XML). **Gate:**
build a real CL + a 2-page CV, export DOCX, run the §7 assertions headless, THEN one CloudConvert
PDF to confirm VML survives. Owner does the final PDF eyeball.

### 1.2 Settings — Visual-package relabel + writing-style merges  [code + islands]
Spec: `docs/qa/SETTINGS_VISUAL_PKG_SPEC_2026-06-16.md`. Three items only (VISUAL-PKG-002/003 already
shipped — close after a live look):
- VISUAL-PKG-001: rename native "STYLE PACKAGE"→"Visual package" in app.src.js **AND** widen the
  island `STYLE_PACKAGE_RE` to accept both spellings, SAME release, or the card orphans.
- MERGE-DUP-001: hide the duplicate legacy writing-style `<select>` (LanguageCard stray-hide
  pattern), keep the two legacy buttons, bridge to WritingStylePicker. MEDIUM — probe the exact
  select node on live before shipping the selector.
- MERGE-DUP-003: tones→customs copy-only; storage key unchanged. LOW.
**Gate:** anchor-intact check (fresh + stale-cached app.js); legacy buttons still drive
generation; saved slots still load.

### 1.3 Cover letter — capture table data in CL generation  [proxy worker]  ← absorbs GEN-002b
CL-006. The docx-worker already RENDERS WHAT I BRING; the gap is `generate_cl` not emitting the
table rows (+ WHY THIS POSITION bullets). Proxy-side prompt/schema change: have generate_cl extract
and emit the WHAT-I-BRING table signals grounded in the CV/JD. Mirror proxy→demo-proxy.
**Gate:** generate an unsolicited CL and a JD-grounded CL; assert the returned payload contains
populated table rows (headless payload inspection — no live render needed). Fold GEN-002b closed.

### 1.4 Cover letter — constrain Application line to page width  [worker + preview token]
CL-LAYOUT-002 (High). DOCX/PDF side is deterministic worker width math (`MAIN_W`/`PAGE_W`); preview
side is a token. **Gate:** long "Application: [role] — [company]" string stays within usable width
in Preview + DOCX + a CloudConvert PDF. Owner PDF eyeball.

---

## LANE 2 — Relay-pending verification + deploy (capable session, relay perm required)

These are FIX SHIPPED but stranded on a relay deploy. A capable session can deploy the relay via
`deploy.yml`, then run the verify. Do these EARLY in the session so the owner can eyeball results.

- **KERNEL-CLOUD-PERSIST-001** (fix shipped 1.50.221) — relay deploy, then: generate showcase →
  save → reload → kernel persists (no re-generation on Edit).
- **APPHISTORY-SAME-LINE-001** (fix shipped 1.50.223) — same relay deploy; verify: generate → save
  → reload, the app-history line renders correctly (related to KERNEL-SPECIALIZATION-LINE-001).
- **KERNEL-STUCK-LAST-CMD-001** (fix shipped 1.50.220) — retagged client-side React state, NOT
  relay-dependent per prior session; verify after the bundle is live (Edit doesn't restart a stuck
  kernel generation). Confirm the retag holds.
**Gate:** one relay deploy covers the first two; capture the post-deploy live behaviour for owner
sign-off. Do NOT blind-edit — these are app-shell/kernel-persist paths with prior incident history.

---

## LANE 3 — Optimization (headless-measurable, low blast radius)

Performance cluster is mostly closed (PERF-003/004 shipped, RERENDER-STORM + HIWC-RERENDER-LOOP
resolved + regression-locked). Remaining optimization that a capable session CAN do safely:
- **Sidecar consolidation continuation** — index.html still loads ~90 sidecars. The G-series merges
  (G2/G5/G6/G10) already collapsed several into single-observer files. Next candidates: audit for
  any remaining pairs that share a surface + observer and merge behind one rAF scheduler, preserving
  behaviour verbatim (the established pattern). **Gate:** identity of behaviour — diff the merged
  file's effects against the originals on a boot smoke; keep originals on disk unreferenced.
- **PERF-001** (remaining) — only if a headless boot-time/observer-churn measurement shows a
  concrete hotspot; otherwise defer. PERF-002/005 are owner-present (live profiling).
Do NOT chase live-rendered perf (scroll jank, mobile paint) autonomously — that's owner-present.

---

## LANE 4 — Testing / regression hardening (always-on, no deploy risk)

The safest autonomous work — pure test/CI additions, no production behaviour change:
- **WM unit test** (spec §7) — land with 1.1.
- **CL-006 payload test** — assert generate_cl emits table rows (mock LLM or fixture).
- **import-normalize drift guard** — already 18 tests in `pwa/test/unit/import-normalize.test.mjs`;
  extend with any new fixture from this session.
- **app.src.js↔app.js mirror guard** — a CI check that the minified bundle's key string literals
  match the source (catches a forgotten mirror). Cheap, high-value given how often the mirror is the
  failure mode.
- **TC-028 Publications-stress fixture** — author it now (it's the gate the list-row cluster needs)
  even though list-row work itself is owner-present. Having the fixture ready unblocks that session.
- **Regression sweep** — `antcv-regression-sweep-341.js` is loaded; ensure new fixes register their
  invariants there.

---

## Do NOT attempt autonomously (owner-present, probe-first)

Recorded so the session doesn't drift into them:
- **List-row controls** (PP/SO/TB/move) — 7 prior failed iterations; SectionControlBar migration
  gated by TC-028; live-rendered acceptance.
- **Pagination** remainder (PB-001..006, PAGEBREAK, PB-SIDEBAR, PDF-LAYOUT) — live multi-page + PDF
  parity.
- **Mobile** (all 7) — device-specific live render.
- **Candidate/application controls** (CA-001..005) — live preview-editor surface.
- **CL body/overlay controls** (CL-001/003/004/005/CL-BODY-CONTROLS-001) — live row controls, same
  family as list-row.
- **LOGIN-GATE-001, VAL-001** — app-shell boot path, blue-screen incident history, diagnostic-first.
- **Import/lang/wizard** live items (ONBOARD-001 mobile scroll, WIZARD-BLIP-001) — live.

## Dissolved / already shipped (disposition only — see GEN_DISPOSITION + this run sheet)
Generation/content (11 gates + 2 shipped + 2 relocated), Generation UI (live dedup),
Planned features (DELETE-SAVE shipped; FEATURE-CONF partially shipped — confidence overlay
`antcv-confidence-overlay-386.js` loaded @1.50.386), Photo (427 consolidation), Preview-shell/nav-z
(SETTINGS-NAV-Z family shipped 1.50.355), much of Layout/export/responsive (EXPORT-001 worker
1.14.66), Performance (above). IMPORT-COUNT-001 + WIZARD-002 + CL-HEADER-001 + APP-SENTENCE-STYLE-001
all FIXED.

---

## Suggested session order
1. LANE 2 relay deploy + verify (early, for owner eyeball).
2. LANE 1.1 Watermark (worker, unit-tested) → deploy → PDF check.
3. LANE 1.3 CL-006 (proxy, payload-tested) → mirror demo-proxy → deploy.
4. LANE 1.2 Settings subset (code+islands) → build → deploy.
5. LANE 1.4 CL-LAYOUT-002 (worker+token).
6. LANE 4 tests landed alongside each; author TC-028 fixture + mirror-guard CI.
7. LANE 3 sidecar-merge audit only if time remains and a concrete pair is found.
Each task: spec → implement → headless gate → deploy → record result. Leave live/PDF eyeballs as a
short owner punch-list at the end.
