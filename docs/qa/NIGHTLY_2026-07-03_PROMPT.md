# AntCV nightly run — 2026-07-03 01:40 (local, dispatched via the antcv-nightly scheduled task)

Autonomous LOCAL maintenance run on `C:\Users\karpg\GitHub\AntCV` (full auto-memory + gh available;
Chrome MCP only if the owner's Chrome is running — at 01:40 assume headless-first, live-browser
opportunistic). Owner: Gabriel. Style: direct, compressed, no filler.
Shipped at dispatch: PWA **1.51.52** · docx-worker **1.14.119** · access-relay **1.3.2** (D1 retry deployed) ·
proxy/demo-proxy **3.6.x** (claude-sonnet-5 wired; flagship CV/CL gen deliberately on claude-opus-4-7).

## Hard rules (violating any = failed run)
1. **SYNC FIRST**: `git fetch origin && git pull --rebase origin main` before any edit. NEVER force-push,
   never reset away remote commits. Non-ff push → pull --rebase → push.
2. **Verify-first**: every backlog row gets a repro/test BEFORE a fix. Many "open" rows are already shipped
   (registry is stale). No speculative surgery; diagnostic-first per CLAUDE.md.
3. **Cache-bust quintet** on every pwa asset change: `?v=` in index.html (incl. version-override's OWN ?v
   line ~375) + sw.js CACHE + TARGET_VERSION + STALE_VERSIONS (+prev, NEVER current) + ANTCV_VERSION seed.
4. `pwa/app.js` is minified-sacred: surgical in-place edits only, mirrored to app.src.js; no rebuild
   (`npm run build:app` is known-unsafe). CRLF in app.js mirrors. `__antcvSalmon` is PERMANENT.
5. One solid VERIFIED fix beats several half-fixes. Suite green via the CANONICAL runner
   `node scripts/run-tests.mjs pwa` (raw `node --test` HANGS on PRV-004's watchdog timer — the runner
   adds `--test-force-exit`) + `node pwa/test/boot-smoke.mjs` before every push. Workers deploy via `gh workflow run deploy.yml` only
   (if gh unavailable in cloud: push code + say so in the report).
6. **Do NOT flip the flagship gen model off claude-opus-4-7.** Optimize everything else; a flagship change
   is proposed with evidence in the report, owner decides.

## Task 1 — LLM quality-cost optimization
Ground truth = D1 `llm_calls` telemetry (per task: model, tokens, cost, duration, adequacy failures,
provider demotions) — query via the access-relay admin surface if reachable; else reason from the code.
Surfaces: client `ee()` router (app.src.js), `workers/proxy/src/multi-llm.js` + demo-proxy byte-identical
(PROVIDER_MODELS, callAnthropic), `demo-enforcement.js` RATES (`claude-sonnet-5: [3.00,15.00]` — intro
pricing is $2/$10 until 2026-08-31; decide list-vs-intro for cost accounting and document the choice).
Actions: per-task cascade ordering by measured quality/cost; cheapest adequate model for mechanical tasks
(orphan-L3, chatbot, importer are already sonnet-5); verify `thinking:{type:'disabled'}` stays sonnet-5-only.
Tests: extend `workers/proxy/test/sonnet5-dropin.test.mjs`. Mirror proxy↔demo-proxy byte-identical.

## Task 2 — generation-flow speed (6–10 min today; target: faster, same-or-better quality)
Profile FIRST: `__antcvGenCost` heartbeat spans + llm_calls durations — find the serial chain (main gen →
showcase → analysis → convergence passes). Levers are RE-TUNE not rebuild (all 5 levers shipped
1.50.819-829): parallelize independent secondary calls, trim the giant instruction block (app.src.js
~24301) of redundant rules, skip no-op convergence passes, cache cluster-demand reads. Regression guard:
one full headless generation with the anita persona (docs/personas/anita) before/after; compare section
completeness + suite green. Report per-stage timings old vs new.

## Task 3 — EMPTY-ROLE-SOURCE-001 (answer "why does the belt sidecar exist")
The me() skeleton creates placeholder roles CORRECTLY hidden (`on:!1`, app.src.js ~3335-3355). But live
data (2026-07-02) had r8/r9/r10 **on:true with BLANK title/company and empty bullets** — some pass flips
them on and strips the placeholder text. Suspects: the generation output merge after a regen (the gen
prompt orders "NEVER emit an on:false role as an empty or placeholder slot" — the model may return extras
on:true), a placeholder-drop normalizer, or restore. Repro headlessly (inject a gen-shaped response with
empty extra roles), find the writer, fix at source (empty roles stay on:false / are not merged).
`antcv-empty-role-hide.js` (1.51.52) stays as the belt; the source fix removes the need for it to fire.

## Task 4 — backlog closure (verify-first, close what's still real)
Triage table from 2026-07-02 (ACTIVE_BUGS.md top block). Already VERIFIED-CLOSED in export 16 — skip:
contact-fullwidth, publications keep-whole, results pins, section routing, TOOLS≠core-comp dedup.
Work in this order:
1. **Orphans v2** — `docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md` §7–9: EXPORT-METRIC-MEASURE-001 (offscreen
   measurer with EXPORT font + column width) + EXPORT-PREFLIGHT-ORPHANS-001 (batched, awaited L3 inside
   exportDocxViaWorker, 12s timeout, re-measure gate, RUNT_FRAC 0.40). ORPHAN-WRITE-VERIFY-001 (1.51.52)
   already makes writes text-verified — build on it, never index-trust a preview path.
2. **PAN-IDRAET-BULLET-NEARDUP-001** — within-role near-dup bullets ("about 25 players" vs "25 players");
   `_dedupNear` (antcv-docx-client ~2118) runs only on Results joins — apply its anchor-clause match to a
   role's bullets, export + preview parity, KEEP_MIN respected.
3. **CL-SECTION-PANEL-BLIP-001 (medium, owner screenshot 2026-07-02)** — CL sections panel rows show
   INCONSISTENT control clusters: Opening + "WHY YOUR COMPA…" rows carry an extra cluster (a "1" chip,
   ⏮/⏭ arrows, extra ✨) vs Greeting / WHO I AM (✨ → ON ✕ only), plus a stray hamburger chip overlapping
   the panel's left edge near Greeting. Diagnose which injector adds the per-row controls
   (antcv-row-controls-dedupe-388 exists — dedupe raced or a second injector). RULE: never hide a control
   assuming it's a dup without proving it dead — prefer FUSING (memory: de-dup hide once destroyed
   banned-words UI, reverted).
4. **HWIC-vanishes-after-edit** — headless repro: edit the HWIC rich_block → dispatch sections-updated →
   reload → assert persistence. Fix the writer that drops it.
5. **Candidate-header spread-left** + **floating-spine sidebar fill** — docx-worker pair; sidebar fill is
   PDF-BLANK-PAGE-risky (bit twice): touch only with diag-twocol-ownerlike pins 12600/15538 green.
6. **EMDASH separator half** — writer↔reader groups move atomically with a round-trip test (see
   ACTIVE_BUGS EMDASH block for the exact line pairs). Skip if time-boxed out; it's old.
7. RELOAD-LOOP-001 / SIGNIN-GATE-HARDREFRESH-001 — attempt headless repro; if no repro, document and leave.

## Task 5 — NIL Technology application feature verification
Owner application: **Nanooptics Prototyping Engineer — NIL Technology** (JD PDF has no text layer; the
saved application lives in the owner's browser localStorage / cloud KV). If Chrome MCP is connected,
verify LIVE on antcv.pages.dev (same-origin localStorage — read the saved application, its QnA page and
brand_fit output directly). Otherwise verify the FEATURE paths headlessly and flag the rest for owner-eye:
- **QnA page (APPLICATION-QA-001)**: P1 scaffold = `antcv-application-qa-section.js` (v1.50.778, loaded);
  plan `docs/plan/CL_APPLICATION_QA_2026-06-22.md`. Check P2 (JD-question detection) and P3 (answer
  generation) shipped state. Headless: inject a JD containing explicit application questions → run the
  detection/generation path → assert `antcv:applicationQuestions` populates and the CL gains the
  `application_qa` rich_block page ("<Name> - <role>. Responses to your application questions:").
  If P2/P3 are missing, BUILD them per the plan doc (that is the desired output the owner asked about).
- **🎨 Brand fit**: opt-in `window.__antcvBrandFit` → `__brandFitRule` (app.src.js ~24168) → `T.brand_fit`
  applied (~24453). Verify: where the 🎨 toggle surfaces in the UI; navy dark-enough guard; fonts from the
  allowed list only; brand_fit reaches BOTH preview tokens and the export payload (preview/export parity).
  Headless: stub a gen response carrying brand_fit and assert header/sidebar colours + fonts in preview
  AND in the docx-worker payload. NIL Technology branding (nilt.com) as the reference case in the report.

## Task 6 — morning report
Write `docs/qa/NIGHTLY_2026-07-03_REPORT.md`: shipped (with versions) / verified-closed / needs-owner-eye
(NIL QnA + Brand fit on the real application, CL panel visual, any palette change) / blocked+why.
Update ACTIVE_BUGS.md top block. Every claim backed by a test or a repro artifact.
