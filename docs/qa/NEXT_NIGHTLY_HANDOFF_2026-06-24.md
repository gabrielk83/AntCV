# Next-nightly handoff — 2026-06-24 (AUTHORITATIVE current state)

> Read this FIRST, then `CLAUDE.md`, then the per-batch detail at the top of `ACTIVE_BUGS.md`.
> Current shipped: **PWA 1.50.870** (origin/main `36fe94a`) + **docx-worker 1.14.81-trailing-blank-trim** (deployed, /health confirms).
> Suite **467/467**. PWA auto-deploys on push to `main`; the docx-worker is a manual deploy.

## ⭐ TOP PRIORITY for the next run — the owner is providing a FRESH unsolicited CV export
The owner will supply a **fresh, most-up-to-date unsolicited CV/CL export** (desktop). Use it to:
1. **Verify the regen-gated fixes below actually took** (they only take effect on a generation produced AFTER 1.50.847/848 — the PDFs reviewed on 06-24 predated them).
2. **Drive the deep CV-SIDEBAR-SPILL fix** (see "Deep / owner-gated" — this is the headline open item; it needs a real export to verify the PDF render).

---

## Shipped this session (843 → 869 + docx-worker 1.14.81)
Full per-item detail is in `ACTIVE_BUGS.md` (dated blocks at the top). Summary:

**Pagination / page-overflow (the owner's repeated ask)**
- `PB-WORKER-TRAILING-BLANK-001` [worker 1.14.81] — trims trailing blank export pages (a column ending on a page-break no longer emits an empty trailing sheet).
- `DUP-GROUP-MERGE-001` [1.50.869] — new sidecar `antcv-dup-group-merge.js`: his REGULATORY had 7 group headers but only 4 real groups (case/&-variant duplicates, e.g. "Electrical and EMC" + "Electrical & EMC"). Merges same-canonical groups + dedups exact rows. Verified on his real data (28→25 items, 7→4 headers). Auto-runs on load.

**Boot-freeze sidecar-swarm reduction** (profiled via `pwa/test/diag-boot-profile.mjs`; the freeze is a SIDECAR SWARM doing full-DOM `querySelectorAll`+text-clean per tick, NOT the app.js measurer — only ~52ms)
- `BOOT-CJLR-PERF-002` [845] — `antcv-profile-workstyle-cjlr-238.js` `lowText` per-run memo (was the #1 offender, 696ms→~0).
- `BOOT-WM-PERF-001` [866] — `antcv-watermark-page-anchor-341.js` `chooseCorner` memo (O(N) corner scan → memoised by content sig).
- `BOOT-WIB-PERF-001` [868] — `antcv-what-i-bring-header-cjlr-249.js` `cleanText` memo.

**Content / generation (REGEN-GATED — verify on the fresh export)**
- `CV-UNSOLICITED-ALL-ROLES-001` [846, prompt] — unsolicited keeps EVERY role on:true (was hiding 4).
- `WORKSTYLE-DISTINCT-001` [847, prompt] — work_style must not duplicate the profile's close.
- `CL-CONTRIBUTE-INTRO-CLOSING-002` [847, LOGIC] — widened the unsolicited `p` flag (`app.src.js ~24585`, NORMALISED `antcv:activeAppCompany==='unsolicited'`) so the contribute neutral bullets fire (the 4 blank "(click to add)" HWIC rows). NOT the reverted 838 prompt change.
- `GEN-STATUS-ENDS-EARLY-001` [848] — `window.__antcvGenRunning` keeps the purple overlay up THROUGH tightening, dropping only when Analysis appears.

**UI / fixes**
- `EXPORT-PREVIEW-PRINT-SETUP-REFRESH-001` [844, LIVE-confirmed] — export-preview iframe inlines same-origin sheet CSS (was a render-blocking `<link>` → blank "print setup" until refresh).
- `CONTRIBUTE-EDIT-JUMPS-WIB-TABLE-001` [843] — 180ms debounce on the HWIC re-dispatch (WIB table stopped jumping).
- `TOOLS-GROUP-FOLD-001` [847] — folds headerless leading tool rows under a Tools group.
- `WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001` [849] — per-alt CSS so Alt 1/Alt 2 actually recolour band + table headers + sidebar.
- `ALT-BTN-MINIMISE-001` [868] — WITHIN-PACKAGE quick-alt swatches now circular + compact (`PackagePicker.tsx` + rebuilt `antcv-react-islands.js`).
- `RELOAD-LOOP-001` [850] — settings-slider "ruler" reset: the `AntcvAuth.subscribe` reload now compares NORMALISED emails (a cloud-write re-emit no longer trips the in-session-switch reload).
- `EVERY-WORD-VERSION-INJECTION-001` [867, URGENT, LIVE-confirmed] — `antcv-version-override.js` now FILTERS blank/non-string STALE entries before building `STALE_RE` (a `null` made `\b(…||…)\b` match every word boundary → "1.50.866Word1.50.866" around every word; root was a stale SW-cached copy with a null).

---

## OPEN — verify on the owner's FRESH export (regen-gated; can't be checked headlessly)
- CV-UNSOLICITED-ALL-ROLES (every role visible), WORKSTYLE-DISTINCT (work_style ≠ profile close), CONTRIBUTE bullets (no 4 blanks), GEN-STATUS overlay (stays through tightening). If any still wrong on the fresh export, the fix didn't take or needs another pass.

## OPEN — visual / in-use confirm (deployed; owner eyeball)
- DUP-GROUP-MERGE (regulatory now 4 groups), ALT-BTN circular swatches, ALT-RECOLOR (alts change colour), RELOAD-LOOP (ruler no longer resets).

## OPEN — DEEP / owner-gated (the headline)
- **CV-SIDEBAR-SPILL-9-PAGES** — the real cause of the 9-page CV: the SIDEBAR (regulatory ~21 + tools 14 + certs 9 + education/langs/interests/access ≈ 7 sections) is far taller than the MAIN (12 roles), so `numPages = max(sidebarPages, mainPages)` (`workers/docx-worker/src/index.js ~24664`) leaves pages 5-8 with sidebar content + an EMPTY main cell. The trailing-trim + dup-group-merge only trim the edges. **THE FIX** (spec in `ACTIVE_BUGS.md`): once the main ends, re-flow the overflow sidebar FULL-WIDTH (single column → ~2× density → ~half the overflow pages); move the AI-watermark anchor to the true last page; **ship behind a payload kill switch and verify on a REAL export** (high blast radius — all CV exports; the LibreOffice/CloudConvert PDF render can't be verified headlessly, so DO NOT blind-ship). The owner's fresh export + a flag-gated test is the path.
- **Boot-freeze remaining swarm** — `antcv-language-ui-429.js` DONE (BOOT-LANGUI-GATE-001, 1.50.870): `apply()` now gates on STANDARD/ADVANCED button presence before the O(all-divs) `settingsRoot()` scan; needs a signed-in desktop browser confirm that the Language panel still shows on Personal tab (diag-language-ui-merge Playwright, not runnable in cloud). Next profiled offenders: `antcv-core-wib-strict-row-layout-274.js`, `antcv-selected-outcomes-row-controls-237.js`, `antcv-embedded-controls-248.js`. Bigger lever = a SHARED swarm coalescer — higher value, higher blast radius. Re-profile with `diag-boot-profile.mjs` after each.
- **SETTINGS-SCROLL-RESET-001** — needs a live repro (not headless-reproducible).
- `TABLE-CELL-EDIT-REVERT` residual, `EXPORT-PREVIEW-PRINT-SETUP` (shipped 844 — confirm), per the earlier 0624 batch.

## FEATURES queued
- Merge the **Application Analysis** panel + the **JD-analysis** block into one rollable menu (island/UI).
- The preview's small **quick-alt CIRCLES** sync with the island (the island swatches are now circular [868] + the recolor works [849]; the preview-circle ↔ island two-way sync wasn't separately done — confirm if still wanted).

---

## Discipline / gotchas (carry forward)
- **Parallel session is ACTIVE.** A second session (claude.ai cloud Personal/Layout refactor, PERSONAL_REVIEW_EDIT_MERGE) was pushing to `main` throughout 06-24 (reached 1.50.865). It rebuilds `antcv-react-islands.js`. For ANY `app.src.js`/`app.js`/island change, work in an isolated `git worktree add --detach <path> origin/main`, commit SELECTIVELY (don't capture the other session's uncommitted files), `push origin HEAD:main`; re-fetch before push. CSS-only / sidecar-only fixes avoid the islands-bundle contention entirely (prefer them).
- **Stale-SW version-mask** ([[stale-sw-version-mask-hazard]]) — a stale SW serves OLD sidecars while the version chip shows the new number; "fixes look broken" = not loaded. The owner's fix is Hard Refresh (SW unregister + caches.delete). The 867 version-override guard now prevents a stale malformed STALE array from injecting the version into every word.
- **STALE_VERSIONS add** — when bumping TARGET, add the PREVIOUS version to the ARRAY literal (a node `replace(/\n  \];/…)` regex earlier misfired into a comment — harmless, but add explicitly). NEVER add the current TARGET (rewrite loop). The 867 filter is defence-in-depth, not a licence to skip the invariant.
- **Cache-bust quintet** on every loaded-file change (file `?v=` in index.html, `sw.js` CACHE, `antcv-version-override.js` TARGET + add previous to STALE, `window.ANTCV_VERSION` seed). app.js changes also bump `app.js?v=`.
- **docx-worker** is a hand-inlined bundle (`src/index.js`); edit the inlined code there (it's what deploys) + bump `var VERSION` + CHANGELOG; deploy `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker` then `gh run watch`.
- **No PDF renderer locally** (pdftoppm absent; PDFs are FlateDecode + CID fonts). Verify export STRUCTURE via the docx-worker diags (unzip word/document.xml); the final PDF render is the owner's check.
