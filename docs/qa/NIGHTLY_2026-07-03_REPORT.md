# AntCV nightly report — 2026-07-03

> **Four runs this date.** Newest first: the 02:26 RE-DISPATCH run (repo at 1.51.102, shipped a
> regression test) is immediately below. Then the LATE-NIGHT run (report-only), the 01:40 run
> (1.51.70), and the original 1.51.53 run. All retained.

---

## RE-DISPATCH RUN 02:26 — shipped e2d99b6 (HWIC regression lock; test-only)

Run: local desktop, autonomous. A **parallel session was live** on the JD/NIL doc thread throughout
(pushed 1.51.102 `JD-VISION-PROVIDER-001`, then `9474e1d` NIL round-3, then `9474e1d`→ my rebase base;
tree stayed clean between its pushes). Sync-first at start (HEAD `18a82d3`), suite 804/804 baseline.

### TL;DR
- **Shipped one thing, zero brick risk:** a headless regression test that LOCKS the fix for the
  owner's #1 inline-edit persistence bug (HWIC / HOW I WOULD CONTRIBUTE vanishing after an edit).
  Test-only — no `app.js`/`index.html`/`sw.js`, no cache-bust, no version bump, **no collision** with
  the parallel session's asset edits. Commit `e2d99b6`, pushed to `main`.
- **Verify-first on the three remaining headless-attemptable items** (fanned to 3 read-only agents):
  HWIC-vanishes = **already fixed** (1.51.7) but **untested** → now tested; EMDASH separator = **clean**
  (no defect); CL-SECTION-PANEL-BLIP = **live-DOM-gated** (extra-control source not locatable in loaded
  scripts; blind fix would violate the prove-dead-or-FUSE rule) → correctly owner-eye.

### Shipped — CL-PROSE-LOSS-GUARD-002 regression lock (`e2d99b6`)
- `pwa/test/unit/cl-prose-loss-guard-reinsert.test.mjs` (4 tests, loads the real sidecar in a vm
  sandbox — same harness as `cl-prose-loss-guard-empty-body.test.mjs`).
- The fix (`antcv-cl-prose-loss-guard-985.js` lines 167–183) re-inserts a guarded CL prose section
  that a stale cloud/me()-enforce restore DELETED outright, at its canonical Nordic position. It
  shipped 1.51.7 but **every existing guard test only exercised the map() placeholder-heal path** —
  the absent-section re-insertion (the actual owner bug) had no lock. Now locked:
  - **D** — a deleted `contribute` is re-inserted from a real snapshot (content preserved).
  - **E** — re-insertion lands between `bring` and `closure` (canonical order), not appended.
  - **F** — no real snapshot → an absent section is never fabricated.
  - **G** — unsolicited application → a targeted-company HWIC is never re-injected (poison-safe).
- Test D genuinely exercises the LOSS-GUARD-002 loop: `contribute` is absent, so the `map()` heal
  never touches it — only lines 167–183 restore it. Remove that loop and D fails.
- Suite **804 → 808**, boot-smoke green, `app.js` head `(()=>{`, zero `use strict`.

### Verify-first verdicts (this run's diagnosis, 3 read-only agents)
- **HWIC-vanishes-after-edit** — REAL historically, **fixed 1.51.7** (LOSS-GUARD-002 re-insertion,
  owner-confirmed in EXPORT_REVIEW_2026-07). Gap was test coverage → closed this run. **Verified-closed.**
- **EMDASH separator half** (ACTIVE_BUGS `[OPEN — interconnected]` tail) — **CLEAN, no defect.** All
  writer↔reader pairs already atomic: CL spec_block reader (7338) is dash-tolerant (`/\s+—\s+|\s+-\s+/`),
  writers emit ` - `; education deg—sch writer (19122) ↔ reader (19428) matched on ` - `; the style-label
  `da` dropdown em-dashes are in-code constants, one-way read, never stored. Three-layer defense
  (sidecar normalize / DASH-HYPHEN-001 prompt rule / render literals) shipped + round-trip-tested
  1.50.636–666. **Recommend closing the register tail.**
- **CL-SECTION-PANEL-BLIP-001** (row 23-adjacent) — **live-DOM-gated, NOT headless-fixable.** The
  extra cluster (a "1" chip + ⏮/⏭ + extra ✨ on Opening / WHY-YOUR-COMPANY rows) has **no source in any
  loaded script** (rich-block editor renders no chips/arrows; `antcv-cl-body-move-button-341.js` owns the
  ☰ hamburger with the left-edge overlap). It is either a correct rich_block-vs-text discriminator or a
  React-rendered control that needs a live DOM to trace. Owner rule (dont-hide-controls-as-duplicates)
  forbids a blind hide. **Needs a live-browser session with the owner.**

### Not shipped, unchanged from prior runs (evidence stands)
Task 1 (cascade retune) + Task 2 (gen-flow speed) need D1 `llm_calls` telemetry (no GET route headless).
Orphans v2 / table geometry / float spine are render-gated (PDF-BLANK-PAGE/overlap brick history). NIL
rows 28/29 are the parallel session's active thread. JD-scan (row 14) needs real models/owner.

### Needs owner-eye (unchanged + one closed)
CL-SECTION-PANEL-BLIP (live DOM), NIL live verification (QnA + brand-fit on the real app), Task 1/2
telemetry. HWIC no longer needs an eye — it is test-locked.

---

## LATE-NIGHT RUN — no ship (parallel session live; report-only)

Run: local desktop, autonomous. Owner active at keyboard; Chrome MCP connected (owner's live origin,
karp.gabriel.a@gmail.com). Synced clean at start (HEAD 1.51.101).

### TL;DR
- **No code shipped — by design.** (1) A **parallel session was actively committing to this same clone**
  during my run: 1.51.102 `JD-VISION-PROVIDER-001` landed <15 min in, tree clean = they finished a
  commit. Editing the shared tree would collide (worktree-contention memory + CLAUDE.md sync discipline).
  (2) Every ship candidate was already-shipped, not-reproducible on current data, config-clean, or
  gen/restore-dependent + brick-history. Verify-first + "not a brickable mid product" → verified diagnosis,
  no speculative fix.
- **Verified live:** row 24 analytics endpoints 200; 1.51.101 boot-purge ran (poisoned buckets gone);
  Task 1 sonnet-5 cascade config correct.
- **New precise NIL diagnosis (rows 28/29):** targeted gen wrote `meta` (header prose — good NIL) but CL
  **body** rich_blocks came back **empty**; company/role reverted to Unsolicited. Section map below.

### Parallel-session note
Start: HEAD `5492941` (1.51.101), `pull --rebase` up-to-date. Mid-run: HEAD `cd93bc5` (1.51.102), tree
clean, 1.51.102 files touched <15 min. Local==origin. Another session owns the JD-extraction/NIL thread
in this clone right now (1.51.99→1.51.102 all JD-extraction). I did not edit shared code. This report and
any ACTIVE_BUGS edit were done after a fresh `pull --rebase` to avoid regressing their work.

### Verified this run
- **Row 24 (ANALYTICS-BUTTONS):** from the owner's authed tab — `GET /analytics/summary` **200**,
  `GET /api/analytics/export?format=json` **200** (28 sessions). Root 401→wipe cause gone at the endpoint.
  Client scope-fix (1.51.92) in the loaded bundle. **Recommend closing pending one owner button-click.**
- **Task 1 config clean:** `workers/proxy/src/multi-llm.js` line 205 gates `thinking:{type:'disabled'}`
  to `/claude-sonnet-5/` only; flagship stays `claude-opus-4-7` (rule #6). No change. (I run on
  `opus-4-8[1m]` — a newer flagship candidate, but I have **no measured evidence** it beats 4-7 for gen,
  so **no proposal**; awareness only.)
- **1.51.101 boot-purge live:** `antcv:clProseGuard` now absent on the owner's origin (poisoned NIL/`"|"`
  buckets cleared by `purgeSkeletonSnapshots()`). Caveat: owner's tab serves `app.js?v=1.51.100`
  (masked to 1.51.101; consistent with 1.51.101 sidecar-only). **1.51.102 app.js not yet on device —
  owner must hard-refresh.**

### NIL diagnosis (rows 28/29) — from live localStorage
Two stores disagree:
- **`meta`** (CL header): `company="Unsolicited"`/`role="Open Application"` (**reverted**), but
  `subtitle="Nanofabrication • Process Optimization • Cleanroom Coordination"`, `greeting="Dear Vladimir
  Miljkovic,"` (real NIL contact), `opening=` full NIL-targeted paragraph (NIL Technology, nanoscale
  optics, Nanooptics Prototyping Engineer, DTU Nanolab). Header prose is good NIL.
- **`sections.cl`** (CL body): Greeting=`"Dear [Hiring Team / Name],"` (skeleton); Opening=`""`;
  WHY YOUR COMPANY=stale Terma `"your organisation's aerospace and defence…"` (1.51.98-scrubbed);
  WHO I AM=generic prose; FOUNDATION=`""`; **WHAT I BRING=`""`**; HOW I WOULD CONTRIBUTE=`""`;
  Closure=skeleton.

Proves:
1. **Row 29(ii) — empty CL body leg, now mapped section-by-section.** Only `meta` got prose; body
   rich_blocks (Opening/Foundation/What-I-Bring/How-I-Contribute) returned empty. Generation-layer
   failure, distinct from the 1.51.101 capture-guard fix (which stops *snapshotting* skeletons — correct,
   but doesn't make the gen write prose).
2. **Row 29(i) — state didn't stick.** No NIL app row (`antcv:app:*` = only kernel + app:435, both
   jdText empty; `lastJdText` empty). Company/role had nowhere to persist; boot restore re-pinned
   Unsolicited while the meta prose survived.
3. **WHAT-I-BRING "not visible / truncated" (Task4 #9/#10)** is downstream of #1 — the body is literally
   `""`. Fix the empty-body leg first, re-check truncation after a good regen.

Next fix (for the NIL-thread owner / parallel session), diagnostic-first, no blind patch:
- Instrument the CL-section gen return: empty targeted rich_block → E4 retry must fire, and must NOT
  overwrite the live section with empty/skeleton. Check D1 `llm_calls` for the CL leg provider/adequacy
  (no GET route this session — proxy POST-only).
- Targeted gen must create/stamp the app row so company/role + filename survive boot restore.
- Owner path stands: **hard-refresh to 1.51.102, re-run NIL gen**, then re-verify rows 28/13(Q&A)/brand-fit.

### Telemetry (Task 1/2 signal, live `/analytics/summary`, as-of 2026-07-02T23:59Z)
`llm_call 7002 / llm_error 480` (6.9%); `generation_start 568 / generation_complete 428` (**~25%
non-completion**); `hallucination_flagged 297` (JD detector active). Can't attribute to task/provider
without D1 `llm_calls` (no GET route). **Recommend a read-only relay `llm_calls` aggregate** so future
nightlies can do Task 1 from data, not code.

### Not shipped, and why
- **Row 26 (TOOLS-SIDEBAR-COMPRESS):** gold targets ("Instruments"/"Lab & fabrication" with "confocal
  microscopy"/"electrical probe stations"/trailing "fabrication") **do not exist in current
  `sections.cv.tools`** — regenerated to a tighter structure. Symptom not reproducible; strings are
  LLM-generated (not kernel-pinned), so a real fix is a gen-prompt/compress-rule change needing a live
  regen to verify. Re-scope with owner against a fresh export.
- **Rows 27/25/3 (orphan sweep / table geometry / float spine):** need real CloudConvert PDF measurement
  + PDF-BLANK-PAGE/overlap brick history — not safe blind on a contended tree.
- **Row 23 / CL-panel-blip:** live-DOM diagnosable but fiddly UI with "prove-dead-or-FUSE" constraint;
  not rushed at this hour.

### Needs owner-eye
1. Hard-refresh to pick up 1.51.102 (you're on 1.51.100 app.js).
2. Re-run NIL gen; watch: NIL app row created? CL body sections fill with NIL prose? Q&A page (row 13)?
   brand-fit applies?
3. If CL body still empty after a clean regen → that's the empty-CL-leg gen bug (evidence above).
4. Row 24: click the 3 analytics buttons once — expect download/summary, no restart.

---

## LATER RUN — PWA 1.51.70 (PAN-IDRAET-BULLET-NEARDUP-001)

Start state on sync: PWA **1.51.69** (dispatch assumed 1.51.52 — Task 3 empty-role,
orphans v2, figure-contact-ref and the batch 4–10 work all shipped since). Verify-first
reconcile, then one solid fix. End state: **PWA 1.51.70** (pushed `main`, commit `c4a3d54`;
auto-deploys). Workers untouched.

### Shipped — PAN-IDRAET-BULLET-NEARDUP-001 (export half), 1.51.70

- Within-role near-duplicate bullets collapse on export. Real case: Pan Idræt carried
  "Manage logistics for about 25 players and coaches…" AND "…for 25 players…" — same fact,
  printed twice in the PDF (owner export-16).
- `antcv-docx-client.js` `sanitizeForExport` (single source; runs in BOTH results-mode
  [after applyOutcomesMode] and section-mode). New `_dedupNearBullets` reuses `_dedupNear`'s
  owner-tuned predicate (≥3 shared stems AND (≥0.6 overlap OR same verb+object headline)) on
  a role's own bullets; string or `{b,t}`; winner = higher `_metricScore` → fewer approximation
  words → shorter, so the cleaner "25 players" line wins with its original object + slot.
  `_keepMinBullets` enforces KEEP_MIN=2.
- EXPORT-SIDE ONLY (same non-destructive class as `hideSubsumed`): stored sections and the
  index-based preview edit path (`roles.t.bullets.n`) never mutated → no ORPHAN-WRITE risk.
- Proof: `unit/pan-idraet-bullet-neardup.test.mjs` (7). Suite **695/695** (was 688), boot-smoke
  green, `app.js` untouched. Quintet → 1.51.70, STALE invariant intact.

### Verified-closed this run (no code)

- EMPTY-ROLE-SOURCE-001 source fix present (`app.src.js` 25485+) + belt loaded — Task 3 stays closed.
- Orphans v2 (1.51.57), ORPHAN-WRITE-VERIFY (1.51.52), FIGURE-CONTACT-REF (wk 1.14.120) all in tree.
- Task 1 invariants: `thinking:disabled` gated `/claude-sonnet-5/`-only (`proxy` + `demo-proxy`
  byte-identical, line 205); flagship gen model still `claude-opus-4-7` (line 98) — NOT flipped.

### Live verification (Chrome MCP, owner's browser)

- **1.51.70 deployed** — origin serves `index.html` @ `antcv-docx-client.js?v=1.51.70` + seed
  `ANTCV_VERSION='1.51.70'`; the deployed `antcv-docx-client.js` contains `_dedupNearBullets`.
- **Fix correct on REAL owner data** — ran the exact 1.51.70 collapse logic against the live
  `sections` (Gabriel's loaded Unsolicited CV, 12 experience roles): **0 false collapses** across
  all roles (the key safety property — no distinct bullet wrongly merged). Current stored data
  already carries the clean "Managed logistics for 25 players…" (a prior regen fixed the export-16
  "about 25" pair), so 1.51.70 is the recurrence safety-net; injecting a duplicate into the real
  Pan Idræt role collapses it correctly (3→ kept, dup removed).
- **Task 5 QnA paths live** — both sidecars loaded on prod: `antcv-application-qa-section.js`
  (P1, 1.50.778) + `antcv-application-qa-detect.js` (P2/P3, 1.51.55). `antcv:applicationQuestions`
  absent (active app = Unsolicited, no JD) — expected.
- **Task 5 Brand-fit toggle located** — the 🎨 checkbox "Brand fit (match colours & fonts to the
  target company)" surfaces on the home/wizard screen below Generate; opt-in `window.__antcvBrandFit`
  (undefined until checked). Confirmed it flips the flag when toggled.
- The saved **NIL Technology** application is in cloud KV (not the loaded local state). Deep-verifying
  its detected questions / QnA CL page / brand_fit colours needs LOADING that app, which mutates the
  owner's live session and re-runs the known-broken JD extraction (JD-SCAN-HALLUCINATION-001) at LLM
  cost — NOT done unilaterally; owner should load it (or say go). A stray click during cloud-restore
  settling briefly toggled brand-fit + a JD-extraction spinner; both are non-persisted form state and
  a reload fully restored the clean state (activeApp=Unsolicited, lastJdText empty, flag cleared).

### Needs owner-eye

- **PAN-IDRAET preview parity** — preview still shows the source bullet (editable), matching the
  existing export-only `hideSubsumed` behavior. Full parity needs a live browser + an index-safe
  render (hide-without-reindex) so the `roles.t.bullets.n` edit path can't corrupt. Deferred.
- **NIL Technology live verification** — load the saved NIL app and confirm its QnA page +
  brand_fit output; owner-gated (session mutation + hallucination-prone JD re-extraction).
- **Task 1 deep** (cascade retuning) — needs the D1 `llm_calls` admin surface, not reachable
  headless. Invariants hold; measured per-task reordering awaits the telemetry read.
- **Task 2** (gen-flow speed) — needs live `__antcvGenCost` + D1 durations; no blind re-tune
  (all 5 levers already shipped 1.50.819-829).
- **Task 5** (NIL live) — Chrome MCP not connected; saved app lives in owner's browser/KV.
- **JD-SCAN-HALLUCINATION-001** — ingest reorder needs real models; owner-present item.

### Not reached (one solid fix > several half-fixes)

CL-SECTION-PANEL-BLIP-001, HWIC-vanishes-after-edit, EMDASH separator half.

---

## EARLIER RUN (1.51.53)

Run: autonomous local maintenance on `C:\Users\karpg\GitHub\AntCV`.
Start state: PWA 1.51.52 · docx-worker 1.14.119 · access-relay 1.3.2 · proxy/demo-proxy 3.6.x.
End state: **PWA 1.51.53** (pushed to `main`, commit `d127b6a`; PWA auto-deploys). Workers untouched.

Method: diagnosis fanned out to 3 parallel subagents; integration + deploy serial. Every claim below is backed by a test or a repro.

---

## SHIPPED

### EMPTY-ROLE-SOURCE-001 — PWA 1.51.53 (Task 3)
**Symptom (owner data 2026-07-02):** experience roles r8/r9/r10 were `on:true` with blank title/company and empty bullets, rendering as empty rows. The belt `antcv-empty-role-hide.js` (1.51.52) hid them at boot but the source kept producing them.

**Root cause (two collaborating mechanisms):**
1. **Writer** — the generation-output→sections experience merge (`pwa/app.src.js` ~25319) appended *every* LLM-returned role whose id wasn't already in the editor list, verbatim, with no `on` normalization. The gen prompt orders "5+ on:true" slots (kernel-completeness-290 addendum), so the model returns extra ids (r8/r9/r10) `on:true`.
2. **Text-blanker** — `scrubPlaceholders` in `pwa/antcv-kernel-completeness-290.js` (~415, run on every accepted gen response) empties any `"[...]"` bracketed string in place (`node[i]=''`) but leaves the sibling `on:true` untouched. So a model extra `{title:"[Role title]",company:"[Company name]",on:true}` reaches the writer already blanked → pushed as a blank active role.

**Fix (at source, `app.src.js` ~25319):** in the extra-role append loop — skip a role with no title AND no company (drop the empty skeleton leftovers); push any *populated* extra as `on:false` (hidden, recoverable — matches the `on:!1` backfill immediately below and the hide-over-delete rule). Editor roles and id-matched LLM roles unchanged.

**Mirror:** byte-verified surgical edit to minified `app.js` (1 occurrence of the anchor; head still `(()=>{`, zero `use strict`; +116 bytes). Applied via Node substring replace (line 8 is too large to Read into context).

**Verification:**
- `pwa/test/unit/empty-role-source.test.mjs` — behavioral repro of the fixed loop (blank extras dropped, populated extra forced `on:false` with content preserved, whitespace-only counts as empty, id-dedup) + src↔app.js mirror-parity anchor + IIFE/no-use-strict guard.
- Full suite **590/590** (`node scripts/run-tests.mjs pwa`).
- `node pwa/test/boot-smoke.mjs` → BOOT-SMOKE OK, errors=0.
- `node pwa/test/diag-gate-probe.mjs` → editor renders past the sign-in gate (previewPaper, topbar, gear, Personal tab, launcher, review button all present; only expected offline-relay CORS errors).
- Cache-bust quintet → 1.51.53 (index.html app.js?v + version-override ?v + ANTCV_VERSION seed; sw.js CACHE; TARGET_VERSION; STALE_VERSIONS += 1.51.52).

The belt sidecar stays in place as defence-in-depth but no longer needs to fire for the gen path.

---

## DIAGNOSED — not shipped (deliberate: owner rule "an end result, not a brickable mid-product")

### PAN-IDRAET-BULLET-NEARDUP-001 (Task 4.2)
Within the Pan-Idræt role, b1 "…about 25 players…" and b3 "…25 players…" are near-dups; one should survive.

- `_dedupNear` (`pwa/antcv-docx-client.js` 2118-2139) already **would** catch this pair: `_ndStem` drops digits + 1-2-char words and light-stems; b1/b3 share 6 stems → `overlap=1.0` and `sameHead=true` (manage/logistic). No filler-word normalization needed for the match.
- **Why it's not a one-liner (parity + shape):**
  - It runs only on Results joins (2357/2491), never on a role's bullets.
  - Correct export site: `applyOutcomesMode` role-map (2688-2719), where `hideSubsumed`/`hideMetricReused` already filter bullets — add the collapse once at the top of the `.map(r=>…)` body, wrapped in `keepMin(bullets, …)` (`KEEP_MIN=2` at 2634). But that path runs **only in `mode==='results'`**; if the dup shows in section mode too, also add to `sanitizeForExport`'s experience case (1432).
  - **Preview parity gap:** the preview memo (`app.src.js` 6209-6217) pulls back only `r2.results`, never `r2.bullets`, so export-side bullet hides are invisible to preview today. Cleanest fix = extend that memo to also capture `r2.bullets` and render from it (6115). Otherwise the collapse would desync preview↔export.
  - Bullets can be strings or `{b,t}` objects — `_dedupNear` takes strings only, so map→text→dedup→map surviving texts back to original objects to preserve shape/alignment.
  - **Tiebreak:** on a metric-score tie `_dedupNear` keeps the *longer* text → would keep "about 25 players" (the less clean one). Prefer the shorter/approximation-stripped bullet for the bullet path, or rely on `_compressResult` (only runs on Results, not bullets).
- Test plan: `pwa/test/unit/pan-idraet-bullet-neardup.test.mjs` modeled on `results-lamination.test.mjs` (core collapse, KEEP_MIN floor, no-false-positive, object-shape preserved, determinism).

### JD-SCAN-HALLUCINATION-001 (Task 11a — blocks Task 5 live)
Commit `db97619` ("docs(nightly): …") is **docs-only** — no ingest code changed. Building blocks exist but are mis-configured for the failing case:
- Garble detector `f()` (`app.src.js` 772) IS run pre-LLM (line 831) and sets `warning="pdfjs_garbled"` — but the code then **deliberately hands the garbled text to the LLM anyway** with "decode it from the visual rendering" (line 869). That is the forbidden "ask the LLM to clean noise → it invents" path. The NIL mojibake produced dictionary-clean fabricated prose ("NIT Calicut — Temporary Faculty") that passed `f()`, returned at 880-885 as `method="llm-after-pdfjs"`, and never reached OCR.
- An inline PDF→vision OCR fallback exists (899-956) but only runs *after* the doc-LLM fails/returns garbage — wrong order. It also does NOT use `antcv-jd-image-ocr.js` (that sidecar is image-file-only).
- Filename↔company cross-check: **not implemented** (filename is captured at 18531/18537, never compared).
- "JD text unreadable — used OCR" notice: **not implemented** (status line at ~40327 shows `method` verbatim only).

Remaining work: strengthen `f()` (replacement-char ratio, mean word length, charset sanity); reorder `h()` (847-898) to bypass the doc-LLM and go straight to vision on garble-detect; add filename↔company mismatch flag; surface the OCR notice; mirror to app.js. **Verification requires real LLM/vision calls + the actual PDF (`C:\Users\karpg\Downloads\Nanooptics Prototyping Engineer - NIL Technology.pdf`)** — not solidly headless-verifiable in a single nightly, so left for a session that can drive the models. This blocks Task 5's live verification.

---

## NOT ATTEMPTED this run (time-boxed to one solid ship)
- Task 1 (LLM cascade cost-quality) / Task 2 (gen-flow speed): need D1 `llm_calls` telemetry via the access-relay admin surface (not reachable headless offline) — deferred.
- Task 4.1 Orphans v2 (export-metric measurer + preflight): the priority backlog item but a large, render-gated change; not landable solidly in the same run as the shipped fix without risking the "brickable mid-product" rule.
- Task 4 items 3-7 (CL-SECTION-PANEL-BLIP, HWIC-vanishes, candidate-header spread, floating-spine, emdash, reload-loop): unchanged.
- Task 4 owner additions 8-10 (FIGURE-CONTACT-REF, CL-BRING-LEADIN, WHAT-I-BRING-TRUNCATED): docx-worker + CL-path work, not touched.
- Task 5 (NIL QnA P2/P3 + Brand fit live): blocked by 11a; no Chrome MCP session confirmed connected at run time.

## NEEDS OWNER EYE
- Nothing shipped tonight needs a live eyeball (all headless-verified). The NIL application (QnA + Brand fit) and CL panel visual remain owner-eye items but are blocked/unchanged.

## Suite / gate status
- `node scripts/run-tests.mjs pwa`: 590/590 pass, 0 fail.
- `node pwa/test/boot-smoke.mjs`: OK.
- `node pwa/test/diag-gate-probe.mjs`: editor renders.
- `node scripts/check-cache-bust.mjs`: report-only drift for app.js/version-override resolves with this commit; other drifts pre-existing/out of scope.

---

## Re-dispatch verification (second run, 2026-07-03)

Nightly was dispatched again after the ship above. No new code shipped — verified the 1.51.53 ship holds and made an evidence-based call not to force a second, parity-risky ship.

- Re-ran full gates on clean `main` @ `7c2bf51`: suite **590/590**, `boot-smoke` OK (errors=0), `diag-gate-probe` renders past the sign-in gate. `app.js` head `(()=>{`, zero `use strict`. Version quintet consistent at 1.51.53 (ANTCV_VERSION seed / app.js?v / TARGET_VERSION).
- **PAN-IDRAET-BULLET-NEARDUP-001 parity gap CONFIRMED at code (strengthens the deferral):** the preview Results memo (`pwa/app.src.js` 6208-6217) runs `AntcvApplyOutcomesMode` on a deep copy but reads back **only** `r2.results` into its per-role map (`m["id:"+r2.id]=r2.results`, line 6216) — it never captures `r2.bullets`. The preview renders bullets from raw `root` localStorage sections, not from the export-computed sections. So any bullet-collapse added inside `applyOutcomesMode` (2688-2719) drops the dup bullet in the **PDF only** while the **preview still shows both** → preview↔export desync (the class of bug owner flags, cf. gabriel-results-pin-parity). A correct fix must also extend the preview memo to capture `bullets` AND swap the preview bullet-render source — a render-gated change not solidly verifiable headless (no live browser to confirm PDF parity). Deferred to a session that can drive the preview/PDF live. Diagnosis + test plan from the first run stand.
- All other items unchanged from the first run: orphans v2 (render-gated), JD-scan / NIL QnA (blocked on real LLM/vision), cascade + gen-flow (need D1 `llm_calls` telemetry, not reachable headless offline).
