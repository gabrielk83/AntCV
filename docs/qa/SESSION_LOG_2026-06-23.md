# Session status + nightly handoff — 2026-06-23 (1.50.789 → 806, +2 workers)

Long session, owner present, iterative. Everything below is **on `main`** and live (PWA auto-deploys;
workers deployed via `deploy.yml`). Read the **REGRESSION GUARD** section before changing anything.

---

## SHIPPED (all live on antcv.pages.dev unless noted)

### Systemic
- **789** STALE-SW de-mask + guaranteed-fresh hard refresh (`antcv-hardrefresh-force-349.js`): bounded-await
  SW unregister+caches.delete before reload; boot `no-store` probe of index.html compares deployed vs
  loaded release → honest Update banner + auto-recover once (loop-guarded). Compares per-release
  ANTCV_VERSION seed, NOT TARGET vs app.js?v. Diag `pwa/test/diag-freshness-guard.mjs`. Live-verified.
- **790** FRESH-START-DELETE-001 (`antcv-fresh-delete.js`): delete keeps API secrets, clears relay URL,
  arms `antcv-just-deleted` cookie → floor suppressed, wizard forced, relay re-default suppressed; cleared
  on wizard completion/skip. Diag `pwa/test/diag-fresh-delete.mjs`.
- **792** Relay nullify (routing menu + wizard ✕ Clear; sticks via `antcv:relay-cleared` gate in
  fetchRelayConfig) + WIZARD-AUTOLOAD-001 (returning-user check no longer counts a floor skeleton).
- **794** Relay card emoji fix (raw `\U` escapes → 🔗/📋, also pre-existing LinkedIn/JD ones) + working ✕ Clear
  (input remount key) + sticky nullify.

### Table editor (merged from `feat/universal-table-type`)
- **793** Universal `table` editor `antcv-table-editor.js` (window.AntcvTableEditor); app.js `case "table"`
  delegates. Diag `pwa/test/diag-table-editor.mjs`.
- **795** Header row editable + default-centered + Header-CJLR honored (preview render reads `e.headerAlign`).
- **802** Header "dancing" fixed (`row-controls-234` sweep now reads the same `section.headerAlign`).

### Content / lamination (run at render — NO regen needed)
- **796** Native languages read "native / fluent" (`antcv-languages-concise.js`).
- **797** me() sources RECOMMENDATIONS from `personalInfo.recommendations` (+ v9 JSON delivered to owner).
- **800** `antcv-rich-block-shape-fix.js`: reshape raw `{l,v}`/`{group}` items in rich_block (TOOLS &
  METHODS, REGULATORY) → `{b,t}`/`{grp,t}`; fill WORK STYLE from kernel.
- **801-803** CL `content`→items bridge (who/why surfaced), PROFILE filled from kernel `background`,
  "Working style" lead-in, AI-assisted label dedup.
- **805** RESULTS-KERNEL-ROLE-MATCH-001 (`antcv-docx-client.js`): doc roles adopt their KERNEL role's real
  numeric outcomes by title|company (tier 3b); tier-5 derive is NUMERIC-ONLY. Diag
  `pwa/test/diag-results-kernel-match.mjs`. Live-verified.
- **799** Results "…"→clean clause cut; preview Results/table spacing. **docx-worker 1.14.80**: PDF Results
  + table-row spacing.

### Generation prompt (REGEN-GATED — affects new gens only)
- **804** Require FOUNDATION (hands_on/professionally) + "follow each section's template instruction, never
  echo a [placeholder]".
- **806** Decouple the two tables at the source: enumerate 7-8 distinct signals → split 3-4/3-4, zero overlap.

### Workers (deployed via deploy.yml)
- **access-relay** GEN-CONTAMINATION-001: `POST /api/prefs/wipe-generated` — a FULL regen wipes prior D1
  generated output (application cv/cl_sections=NULL, language_view, kernel_showcase) as stage 1; quick gen
  unaffected. Client calls it best-effort before a full gen.
- **docx-worker 1.14.80** export spacing (above).

### Tests / docs
- Stale unit tests refreshed (CI green: 295/295 unit + 17/17 docx-worker). v9 personalInfo JSON delivered.

---

## REGRESSION GUARD — do NOT undo this work

**Before any change, in order:**
1. `git fetch origin && git pull --rebase origin main` (sync first; NEVER force main).
2. Edit `pwa/app.src.js` AND mirror to minified `pwa/app.js` (different minified identifiers —
   match by site, not by var name). NEVER run `npm run build:app`.
3. **Cache-bust QUINTET** on every loaded-file change: bump the file's `?v` in index.html, `sw.js` CACHE,
   `antcv-version-override.js` TARGET_VERSION (+ add the PREVIOUS version to STALE_VERSIONS, NEVER the
   current), the version-override `?v`, AND the `window.ANTCV_VERSION` seed (~index.html:329).
4. Run `node scripts/check-cache-bust.mjs --range origin/main..HEAD` (pre-push hook also enforces).

**Regression test set (run ALL before pushing; all currently GREEN):**
- `node pwa/test/boot-smoke.mjs` (the #1 blue-screen guard — after ANY app.js/sidecar change)
- `node --test pwa/test/unit/*.test.mjs` (295/295)
- `node pwa/test/diag-freshness-guard.mjs` · `diag-fresh-delete.mjs` · `diag-table-editor.mjs` ·
  `diag-results-kernel-match.mjs` · `node --test pwa/test/applyOutcomesMode.test.mjs`
- docx-worker: `node --test workers/docx-worker/test/palette.test.mjs workers/docx-worker/test/diag-bundle-palette-sync.mjs workers/docx-worker/test/diag-banded-rows.mjs`

**Invariants not to break:**
- STALE_VERSIONS must never contain the current TARGET_VERSION (rewrite-loop). Add the PREVIOUS one.
- Owner bans em-dashes (—/–) in any displayed/prompt string — use "-".
- docx-worker is a hand-maintained inlined bundle: edit `workers/docx-worker/src/index.js` (= main), not
  the src/*.js modules, or the deploy ships stale code.
- `proofPointsByRole` is an OBJECT keyed by role; the per-role real outcomes are in
  `workHistory[].outcomes`. Don't "fix" tier 3b away.
- Lamination (Results), shape-fix, and the bridges run at RENDER — they fix the current doc without a regen.

---

## OPEN (need a real full regen to verify — content the gen must produce)
- WHAT I BRING table rows when the gen emits no `bring_rows` (806 now forces distinct rows — verify).
- FOUNDATION hands_on/professionally (804 now requires them — verify).
- Numeric Results coverage for roles WITHOUT kernel outcomes (Meprolight/Tel-Aviv/IDF/rugby) — data gap,
  not a code bug.

## OPEN (deferred, larger)
- Big-document boot pagination FREEZE ([[boot-storm-gate-freeze]]) — the renderer locks on a large doc
  (kept timing out live this session). Partially damped in 772; pagination bulk still open. Highest
  remaining systemic perf issue.
- Fuse CL→CV + "I cover this" gap-closure — wired; need a live end-to-end run to confirm.
- `hydrateContract()` generation refactor to retire ~15 patch sidecars (GENERATION_OPTIMIZATION doc).

---

# Nightly autonomous run (continuation) - head 1.50.807, NO ship

Fresh unattended session against the 2026-06-23 run sheet (LANE A/B/C). Prime directive honoured:
ship verified bugfixes with ZERO regressions; when in doubt, do NOT ship. **Outcome: nothing shipped
to main code** - no autonomous-safe item could be verified green end-to-end tonight (signed-in browser
unavailable; Chrome-MCP opens anonymous). Baseline confirmed fully green; 2 false-opens verified
already-correct; 1 new latent finding surfaced; 4 items precisely root-caused with the exact blocker.

## Baseline confirmed GREEN (no regressions present)
- `node pwa/test/boot-smoke.mjs` -> OK. `app.js` startsWith `(()=>{`, no `"use strict"`.
- `node --test pwa/test/unit/*.test.mjs` -> **297/297** (run sheet said 295; grown to 297).
- diag-freshness-guard, diag-fresh-delete, diag-table-editor, diag-results-kernel-match, applyOutcomesMode.test -> all OK.
- docx-worker gated set: palette.test, diag-bundle-palette-sync, diag-banded-rows -> all OK.

## VERIFIED already-correct (no code change needed)
- **B2 GEN-SCE-FLAG-001 follow-through** - CONFIRMED correct. `workers/proxy/test/diag-sce-telemetry-await.mjs`
  passes (5/5): `sce-eval` put is `await`ed (engine line 848 -> KV put 961), skip-path awaited (782).
  `Access-Control-Expose-Headers` lists all `X-AntCV-*` SCE headers in BOTH proxy (index.js:248) and
  demo-proxy (index.js:273); the two engine files are byte-identical. No drift, no deploy. -> can close.
- **VAL-001 / VF-016** (warning vs error colour) - CODE-VERIFIED already correct. Set-menu validation
  routes critical->red `#ff8888` and warning->yellow `#ffd166` in source (`app.src.js` 41193-41209),
  mirrored in minified `app.js`, AND a token sidecar (`antcv-validation-severity-341.js`: error `#dc2626`
  / warning `#d97706`). Severity is already in the data (markers built at `app.src.js` 25175/25183).
  Needs only a 30s owner live glance to formally close (no headless validation-state injection done).

## NEW FINDING (not gated, surface to owner)
- **diag-ai-notice-anchor.mjs has been RED since docx-worker 1.14.75.** One assertion fails:
  "CV: anchored to page-margin bottom". The notice shape emits
  `mso-position-vertical-relative:page` (`src/index.js:23812`) but the diag asserts `:margin`. Both the
  code and the test were introduced in the SAME commit (`1c3cc31`) - this is an internal inconsistency
  from the original commit, NOT a later regression. The harness only verifies the XML attribute, not the
  visual Word position, and `page` (paper edge) vs `margin` (bottom text margin) is a real visual choice.
  Changing the deployed worker blind would move the AI notice on EVERY export with no way to verify the
  render headlessly. **Owner decision needed:** is the bottom-corner AI notice meant to sit at the page
  edge (`page`, current) or at the bottom margin (`margin`, like the big diagonal watermark at 23877)?
  Then EITHER fix the worker (page->margin) OR correct the over-strict test. This diag is NOT in the
  gated regression set, so it blocked nothing - but the AI-notice diag can't be trusted until resolved.

## ROOT-CAUSED, DEFERRED (each needs the owner / a signed-in browser)
- **PRV-004 / VF-015** (loading-status dismissible while job in flight) - ROOT CAUSE FOUND:
  `antcv-stale-status.js` `isBusy()` (lines 82-91) reads four window flags
  (`_antcvKernelBusy`, `_antcvConsensusBusy`, `AntcvKernel.busy`, `_antcvGenerating`) that **nothing
  assigns anywhere** (confirmed: zero `= ` assignments in source/sidecars; `app.src.js` only READS the
  first two at 25197-25198). So `isBusy()` is permanently false -> the click always dismisses, even
  mid-job. The clean fix needs a REAL in-flight boolean. CAUTION: the pill is rendered whenever the live
  status string `po` is truthy, which covers BOTH genuinely-running AND the stale-stuck case the sidecar
  exists to dismiss - so mirroring `po` (one earlier suggestion) would block dismissing a stale pill, a
  regression of the Bug-8 feature. Correct fix = wire a true generation/op in-flight flag (set at op
  start, cleared in `finally`) through the gated `app.js` mirror, then verify against a real multi-minute
  generation signed-in. Not safe to ship/verify unattended. WIP.
- **JD-ANALYSIS-PRINT-001** (analysis print produces the CV) - sidecar-confined fix designed
  (intent flag on analysis export controls + tighten the `analysisViewIsForeground` gate in
  `antcv-print-iframe-preview.js`), BUT: the dedicated analysis buttons already call `exportPdf`
  directly (bypassing the wrapped `window.print`), and the real failing flow (generic print / Ctrl+P
  while the Analysis tab is foreground) relies on the geometry gate, which cannot be reproduced
  headlessly (`window.print` is a no-op under Playwright). The proposed intent flag is likely inert for
  the actual complaint. Needs a signed-in repro of exactly which control the owner pressed. WIP.
- **PDF-LAYOUT-001** (stray "Selected Outcomes" heading on PDF page 2) - DEFERRED per the run sheet's
  own rule. The heading text is data-driven (not a literal in the worker; only comments at 26228/26475);
  there is no failing fixture, and reproducing it requires the owner's exact section/pagination doc.
  Cannot reproduce deterministically -> do not guess against live PDF.
- **WM-006** (AI notice should land in the emptier column on the last page) - DEFERRED. Needs a per-column
  residual-whitespace pagination model on the last page plus a visual verify; the current notice is a
  page-corner anchor driven by `ai_wm_side`, not a per-column placement. Larger than a nightly fix.

## Parallelised vs serial
- PARALLEL: 4 diagnosis subagents (VAL-001/VF-016, PRV-004/VF-015, JD-ANALYSIS-PRINT-001, B2 SCE) in one
  batch - disjoint files, read-only.
- SERIAL (would have been): integrate/verify/deploy - never reached, nothing passed the verify gate.

---

# Nightly autonomous run #2 (continuation, head 1.50.811) - 1 SAFE fix shipped

Fresh unattended session. Synced (`git pull --rebase`: 36bb80f -> 1d8b9ee). Baseline green
(boot-smoke OK; worker gated 17/17). Bucket A worked.

## SHIPPED - AI-NOTICE-ANCHOR-DIAG-001 (test + comment only, NO worker deploy, NO version bump)
`diag-ai-notice-anchor.mjs` had been RED. Earlier handoff called it a "born-inconsistent typo" -
WRONG. Git history: worker **1.14.75** (`1c3cc31`) anchored the AI notice to `relative:margin`
(test passed); worker **1.14.78** (`aae5597`, titled "page anchor, fixes 3-copies flow")
deliberately switched both axes to `relative:page`. So page-edge is the INTENTIONAL shipped
behavior; the test (asserted margin) + the worker comment (said margin) were left stale and the
diag went RED at 1.14.78, looking like a typo.
- Fix: aligned the stale test assertion (`:page`) + the stale `aiNoticeVmlRun` comment to the
  intentional page-edge anchor. `workers/docx-worker/test/diag-ai-notice-anchor.mjs` +
  `workers/docx-worker/src/index.js` (comment only).
- **No production change**: comment-only edit in src; the deployed worker is byte-identical in
  behavior. No deploy, no VERSION bump, no cache-bust. Diag now GREEN; gated worker set 17/17.
- Owner decision pushed (non-blocking): keep page-edge (intentional) vs move to bottom-margin. If
  he wants margin, change `src/index.js:23812` page->margin (+ horiz 23811) and redeploy worker.

## NOT shipped tonight - JD-specific CV compression (bucket A, owner's "app build is next")
Owner-approved spec: `docs/qa/JD-SPECIFIC-CV-COMPRESSION-SPEC.md`. Deliberately NOT force-built
unattended. Reasons: (1) the spec itself says "likely a generation-prompt change + a client trim
sidecar; needs an owner regen to verify" - a prompt change cannot be verified tonight (no signed-in
regen; Chrome-MCP opens anonymous). (2) The owner's gold-standard examples (SiPh, COMSOL, nanotech.,
JD-echo renames) are all from ONE NVIDIA CV; a deterministic general transform engine derived from a
single example risks over-reach (the [[dont-hide-controls-as-duplicates]] lesson). Half-building it
would violate "an end result, not a brickable mid product."
Ready-to-build decomposition (for the next attended/regen run):
- DETERMINISTIC + headless-verifiable (client sidecar, JD-gated on `antcv:lastJdText` >= 30):
  rule 8 (certs: strip trailing "/CODE", drop exact dups - objective, narrow), rule 9 (accessibility
  one-line - needs the exact target text), rule 6 (flatten sub-headers only on very-short lists).
- HIGHER-RISK / better as a PROMPT change (regen-gated, verify with owner): rule 1 (force-keep
  JD-named tools - the flagship; intersect JD tokens with real data, hook the compress/hide path),
  rule 2 (ruthless abbreviation - subjective, needs a curated map or the LLM), rule 4 (JD-echo rename +
  within-group order). Rule 5 = layout (autoPages/sidebar-fill, NOT a content rule). Rule 3 = not a rule.
  Rule 7 = already done (RESULTS-CUT-003).
Pushed the owner a decision: build the deterministic slice as a JD-gated sidecar autonomously next
run, or do the prompt path together with a live regen?

---

# BUG REPORT — UNSOLICITED-SHOWS-NVIDIA-001 (owner, 2026-06-23, NOT fixed)

**Symptom (owner-observed live):** generated an **UNSOLICITED** application (general CV, no posted
role) and the output **still shows NVIDIA** — the company from this session's prior JD-targeted NVIDIA
batches ([[nvidia-batch-1.50.809]]). The unsolicited gen is bleeding the stale targeted company / JD /
generated content instead of producing a clean general CV.

**Status (updated):** ROOT CAUSE CONFIRMED via signed-in live repro (Claude-in-Chrome attached to the
owner's profile, antcv.pages.dev, app.js?v=1.50.809). NOT yet fixed.

## ROOT CAUSE — CONFIRMED (2026-06-23, live)

The unsolicited gen regenerates the **prose** but never resets the **company/role identity**. Live state
on the owner's machine:
- Topbar/header renders **"Test Engineer - Photonic @ NVIDIA"** (NVIDIA from the prior targeted batch).
- `localStorage.meta` = `{company:"NVIDIA", role:"Test Engineer - Photonic", subtitle:"Processes •
  Products • People", greeting:"Dear Hiring Manager,", opening:"...interest in future opportunities at
  your organisation."}` — note the **opening/greeting are the UNSOLICITED cold-outreach texts**, proving
  an unsolicited gen ran, yet `company`/`role` stayed NVIDIA.
- `localStorage['antcv:activeAppCompany']` = `"NVIDIA"`.
- `localStorage.rationale` still holds the NVIDIA analysis ("...aligns well with NVIDIA's needs").
- `localStorage['antcv:lastJdText']` = **empty** (so the JD-gated readers correctly see "unsolicited",
  but the company identity is driven by `meta`/`activeAppCompany`, which were NOT cleared).

So the original suspects were WRONG for this state: the loaded app.js **does** contain the
`/wipe-generated` call, the relay URL **is** set and resolves (`__rb` non-empty), and `lastJdText` is
already cleared. The miss is purely that **`meta.company`/`meta.role` + `antcv:activeAppCompany` +
`rationale` survive an unsolicited generation.** Worse, the gen payload SENDS the stale meta + rationale
as context (`app.src.js:15636-15641`, second site ~25732), so the LLM is actively told the target is
NVIDIA and echoes it back; the response `meta` is written back over the unsolicited identity.

## DEEPER ROOT CAUSE (found while implementing) — cloud-persisted, self-clobbering
The contamination is SERVER-SIDE: the **kernel showcase cloud slot** (`/api/kernel-showcase`) stores
`meta.company="NVIDIA"`. The kernel-restore on boot (`app.src.js:15760-15859`, "KERNEL-CLOUD-PERSIST-001")
bails ONLY when the LOCAL `meta.company` is already a real company (15777-15783); for a genuinely-
unsolicited load (local company "Unsolicited") it proceeds and re-applies the slot's NVIDIA meta
(15842-15844). Proven live: setting local `meta` to Unsolicited + reload → restore put NVIDIA back
(`antcv:activeAppCompany` "Unsolicited" survived because it's outside the restored `meta` blob). So a
pure local reset can't stick — the cloud slot re-injects every boot.

## FIX SHIPPED — sidecar guard `antcv-unsolicited-identity-guard.js` (1.50.816)
Chosen over editing the buried gen-gate (`app.src.js:23893-23920`) because that path can't be verified
without a real signed-in regen (the project's own "don't guess on the gen path" discipline), and the
sidecar both reaches the owner immediately and **self-heals the cloud slot**:
- When the context is unsolicited (`antcv:lastJdText` < 30 chars) but `meta.company` is a real company,
  force `meta.company → "Unsolicited"`, `meta.role → "Open Application"`, scrub
  `antcv:activeAppCompany → "Unsolicited"`, drop `rationale`. Keep `subtitle` + greeting/opening.
- It writes `meta` and dispatches the same `StorageEvent('storage', {key:'meta'})` the candidate editor
  uses, so the app pulls the cleaned identity into React state `io`; the existing kernel autosave
  (`app.src.js:15623-15648`, gated to `io.company==="Unsolicited"`) then RE-PERSISTS the cleaned slot to
  the cloud. After one load with the guard the slot is clean and stops re-injecting NVIDIA.
- Loop-safe (same-meta bail), edit-safe (skips while a field is focused), disable via
  `antcv:disable-unsolicited-identity-guard`. Unit-tested: `pwa/test/unit/unsolicited-identity-guard.test.mjs`
  (7/7). Registered in `index.html`; cache-bust quintet bumped 815 → **816**.

NOT done (deliberately, owner-gated): the source-of-truth gen/restore fix in `app.src.js` (sanitize the
kernel slot's meta on restore at 15842, and on persist at 25730/15636 so the slot can never store a
targeted company). That is the proper redundancy but needs a live regen to verify the gen branch; held
for an attended regen session. The sidecar fully covers the symptom in the meantime.

## Original FIX DIRECTION (recommended, pre-discovery — superseded by the sidecar above)
On the unsolicited entry/gen path, force the identity to unsolicited BEFORE building the gen payload and
on commit: `meta.company → "Unsolicited"`, `meta.role → "General CV"`, drop/blank `rationale`, and stamp
`antcv:activeAppCompany → "Unsolicited"`. Do NOT send the prior targeted meta/rationale as context for an
unsolicited gen. (The `meta.subtitle` is the candidate's own specialisation line — keep it.)

## Original candidate root causes (kept for history — none held in the confirmed state)

1. **GEN-CONTAMINATION-001 wipe likely never fired.** A full gen is supposed to call
   `POST /api/prefs/wipe-generated` as stage 1 to drop the prior generated D1 output
   (`app.src.js:23470-23489`). BUT that call is gated on `__rb` (the relay/proxy URL) being non-empty.
   **This session shipped relay nullify** (790/792/794: delete/✕ Clear set `antcv:relay-cleared` and
   blank the relay URL). If the relay URL was cleared, `__rb` is empty → the wipe is skipped → the stale
   NVIDIA `application` row (cv/cl_sections, kernel_showcase, language_view) survives and seeds the
   "fresh" unsolicited gen. **First thing to check.** The wipe also runs through the relay only; if the
   owner uses a direct `proxyUrl` that still resolves, confirm it actually hit `/wipe-generated`.

2. **Unsolicited not categorised as unsolicited.** `__isUnsolicited` is true only when
   `category==="unsolicited"` OR `jd_company==="unsolicited"` (`app.src.js:15221-15225`, mirror at 20001),
   and the save path sets `category: r ? "unsolicited" : "targeted"` where
   `r = (jd_text===stub) || company==="Unsolicited"` (`app.src.js:14580-14596`). If the unsolicited gen
   was started while the NVIDIA active application was still loaded (company="NVIDIA"), `r` is false →
   the row is categorised "targeted", `antcv:lastJdText` keeps the NVIDIA JD (15266), and every JD-gated
   reader (WHY-heading flip [[recs-list-and-why-context]], cluster, per-role outcome visibility) treats
   it as the NVIDIA application. Verify the unsolicited entry point actually clears company→"Unsolicited"
   / writes the stub JD BEFORE the gen, and clears `antcv:lastJdText`.

3. **Targeted-app auto-commit clamp** ([[targeted-app-persistence]], 1.50.728-732) was built to STOP a
   targeted gen reverting to the unsolicited kernel. This bug is the inverse — confirm that guard isn't
   now pinning the NVIDIA targeted app as "active" so an unsolicited gen can't displace it.

## Where to look
- `pwa/app.src.js` (+ mirror `pwa/app.js`): 14572-14596 (categorise on attach), 15218-15280 &
  19990-20074 (cloud-restore active_application + lastJdText mirror), 23470-23489 (wipe-generated gate).
- `workers/access-relay` `POST /api/prefs/wipe-generated` (GEN-CONTAMINATION-001 handler) — does it wipe
  the `application` row's company/role too, or only the section blobs? If company survives, NVIDIA labels
  persist even after a wipe.
- Sidecars that surface the company in output: `antcv-why-context-title.js`, `antcv-docx-client.js`
  (CL who/why), `antcv-cluster-demand.js`.

## Repro plan (signed in)
1. With the NVIDIA targeted application active, start an **unsolicited** gen.
2. In console BEFORE gen: `localStorage['antcv:lastJdText']` (should it be NVIDIA JD?),
   `localStorage['antcv:relay-cleared']`, the resolved `__rb`.
3. Watch the network tab for `POST /api/prefs/wipe-generated` — did it fire and 200?
4. After gen: inspect the active `application` row (jd_company / jd_role / category) and the CL who/why
   + WHY heading for "NVIDIA".

## Secondary observation (same console dump, separate issue)
After the 6-page gen the console shows a long **`requestAnimationFrame` handler** storm plus
`antcv-splitter-flip.js setInterval took 4798ms`, `antcv-sidebar-position.js 255ms`. This is the
big-document boot/render pagination FREEZE already tracked as [[boot-storm-gate-freeze]] (open,
deferred). The splitter-flip + sidebar-position polling intervals are the worst offenders here — worth
folding into that perf work, but it is NOT the NVIDIA contamination bug. Do not conflate the two.
