# AntCV nightly report — 2026-07-03

> **Two runs this date.** The block immediately below is the LATER run (re-dispatch at
> 01:40, repo already at 1.51.69). The original 1.51.53 run report follows under
> "EARLIER RUN (1.51.53)". Both retained.

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

### Needs owner-eye

- **PAN-IDRAET preview parity** — preview still shows the source bullet (editable), matching the
  existing export-only `hideSubsumed` behavior. Full parity needs a live browser + an index-safe
  render (hide-without-reindex) so the `roles.t.bullets.n` edit path can't corrupt. Deferred.
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
