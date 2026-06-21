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
