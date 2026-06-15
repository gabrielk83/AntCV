# AntCV — Fresh Session Kickoff — 2026-06-15

**Start here.** This boots a fresh-context session to continue the AntCV backlog autonomously after the long 2026-06-14/15 session. Current shipped version: **1.50.483** (PWA) + **docx-worker 1.14.67**.

Owner directive: work the prioritised backlog below **in order**, verify each PAST the sign-in gate (not boot-smoke), ship, deploy; review later. Owner communication style: direct, factual, compressed, no filler/corporate-speak — same standard in code, commits, and replies.

---

## 0. Orient (read first, ~3 min)
- `CLAUDE.md` — app.js source-of-truth + hotfix/patch protocol + STALE_VERSIONS invariant.
- `docs/qa/ACTIVE_BUGS.md` — the **`## OPEN ISSUES — owner review 2026-06-15`** block at the top IS this backlog (with verified root causes + fix file:lines). Below it, the SESSION REGISTRY blocks show what shipped 1.50.468→483.
- Auto-memory `MEMORY.md` index, ESPECIALLY:
  - `minified-mirror-shadow-hazard` — **the de-minified app.src.js names do NOT match minified app.js** (Ce→it, er→fr, kr→jr, zn→no, ro→xo, ao→Eo, mMain→y, oMain→p, zi→Qi, bi→n…). Anchor on STRING LITERALS, print minified context, COPY the block verbatim, guard each mirror edit with an exact count. This bit repeatedly.
  - `headless-pwa-testing` — how to render PAST the sign-in gate (inject `antcv:auth:token`/`:email`/`:expires_at` + a fake unsigned JWT + `step`/`doc`/`sections`/`personalInfo`); the Adv-Styles nav recipe; serve `pwa/` with `python -m http.server` and drive Playwright. boot-smoke PASSES on the sign-in screen — it does NOT prove a component rendered.
  - `gabriel-cv-facts` — ground-truth (Kanzen Konsulenter ApS, no "i nord", end 2026; DA B1, ES Professional, NO German; broad PdM/BA identity; patent only in publications).
  - `docx-worker-bundle-no-build`, `powershell-git-commit-quoting`, `deploy-model`, `pagination-two-map-and-worker-test`, `settings-subtab-placement`, `salmon-splitter-permanent`.

## 1. Ship discipline (non-negotiable)
1. Edit `pwa/app.src.js` (SOURCE) → **mirror into minified `pwa/app.js`** with a node `.mjs` that asserts each replacement's exact count, then asserts `app.js` still `startsWith("(()=>{")` and contains NO `"use strict"`. NEVER `npm run build:app` (known-unsafe). React-island (`src/**.tsx`) changes rebuild via `npm run build` (vite — reproducible).
2. **Verify by rendering the REAL component headlessly, past the sign-in gate** — boot-smoke is not enough. Use the `headless-pwa-testing` recipe; clean up the server + temp scripts + `git checkout -- docs/qa/screenshots` after.
3. Cache-bust trio for any changed pwa file: bump that file's `?v=` in `index.html`, `sw.js` `CACHE`, `antcv-version-override.js` `TARGET_VERSION` (+ add the PREVIOUS version to `STALE_VERSIONS`, NEVER the new one). Only bump the `?v=` of files you changed.
4. `node scripts/run-tests.mjs` must stay all-green (currently **284/284**). Add a unit/diag test where feasible.
5. Commit `git commit -F <file>` (PS 5.1 mangles `-m` quotes); end message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Push to `main` ONLY (mirror branches retired). PWA auto-deploys on push.
6. Worker change → bump `VERSION` + changelog, `gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`, then `gh run watch <id> --exit-status`.
7. QA core rule: a fix counts only if it holds in **Preview + DOCX/PDF, desktop + mobile** — never preview-only or only-after-hard-refresh.
8. Safety valve: never ship a change you can't verify green; revert or leave a labelled WIP and report.

## 2. PRIORITISED BACKLOG (owner order — do in sequence)

Full root-cause detail + fix file:lines are in the `ACTIVE_BUGS.md` OPEN ISSUES block. Summary:

1. **(b) LANGUAGES-CARD-PERSONAL-001** — the Personal-subtab Languages card fell under "Done" and its spelling/tense controls vanished. Wrap the Personal sections (`app.src.js` `yl` ~21217-22180) in a `flex-column` so the `LanguageCard` island (`src/islands/LanguageCard/mount.tsx`) anchors at order 20; render the Experience-Tense (+ spelling) control inside `yl` at order 22; label it "Languages".
2. **(a) SETTINGS-SCROLL-RESET-001** — settings modal hard-resets scroll on scroll-down; find the scroll container + a re-render that resets scrollTop (islands remount / settingsTab churn).
3. **(c) DISCLOSURE-TRIANGLE-CONSISTENCY-001** — add the shipped ▸/▾ left triangle to the other Advanced collapsibles (SPACING & INDENTS, etc.).
4. **(g) ADDITIONAL-INFO-SPLIT-001** — split ADDITIONAL INFORMATION into LANGUAGES + INTERESTS sidebar subsections (me() skeleton split OR a restore-proof splitter in `antcv-sections-normalize-415.js`).
5. **(j) PREVIEW-EXPORT-PAGEBREAK-PARITY-001** — a role on preview page 1 lands on export page 2; align the measurer's per-role height with the worker's role spacing (two-map pagination).
6. **(section-layout) SECTION-LAYOUT-GRAPHIC-001** — Section Layout (LayoutPicker island) is missing the "how each looks" per-format thumbnail AND the SELECTED OUTCOMES "selected bullets vs distributed results" explanation/option. Add format-shape previews + a 'results' outcomes option + explainer (island rebuild).

**High-value export pair (owner repeated 2026-06-15 — promote near the top):**
- **EXPORT-FALLBACK-ON-FIRST-001 + CL-TABLE-DIMS-FALLBACK-001** — these are ONE root cause. The dims-forwarding chain (drag→`clTableRatio`/`stylePrefs.tableWidthPct['bring']`→`buildPayload`→deployed worker 1.14.67) is VERIFIED CORRECT for both `exportDocxViaWorker` and `exportPdfViaWorker`. The owner's "CL export ignores table dimensions" is the PDF button's server export (`exportPdfViaWorker`, `app.src.js` ~46290) throwing on the FIRST attempt after a hard reset and silently degrading to `kl()`→`Na()`/`buildHTMLDoc` (~25119) — a from-scratch MSO-HTML print builder that does NOT read the dims (and can render the wrong panel). Fix path: (1) **live console probe** of why the first `exportPdfViaWorker` throws after reset (worker URL not yet on `window.ANTCV_DOCX_WORKER`? relay token unseeded? cold-start timeout?) — do NOT speculatively edit the fetch/export chain; add a single retry + a degraded-mode notice. (2) OR/AND teach `buildHTMLDoc` (`Na`) to honor `clTableRatio` + `stylePrefs.tableWidthPct['bring']` for the WHAT-I-BRING table (rendering-only, surgical, inside the `b` section-renderer's table build). See ACTIVE_BUGS OPEN ISSUES for both IDs.

Then the **generation/polish cluster** (verify on a FRESH generation first — 1.50.478/480/483 may already have improved them): RESULTS-METRIC-SHARPNESS-001, OUTCOMES-FORMAT-RESULTS-OPTION-001, CL-FORMAT-CONTROL-001, SUBSECTION-RENAME-REORDER-001, CL-PREVIEW-TABLE-WIDTH-001, HIWC-ORPHAN-TIGHTEN-001, DOC-SUPERVISION-001 (a stronger quality-enforcement "supervisor" pass over the finished doc). Note 1.50.483 raised the SELECTED OUTCOMES clamp 7→12 for the owner's ~11-role CV — re-judge per-role Results coverage on a fresh deep-CV generation.

## 3. Useful harnesses
- `pwa/test/unit/*.test.mjs` (run via `node scripts/run-tests.mjs`); `pwa/test/diag-*.mjs` (headless renders).
- `workers/docx-worker/test/diag-*.mjs` — drive the live worker, unzip `word/document.xml` (see `diag-photo-bridge-export.mjs` / `diag-cv-table-width.mjs`).
- `node scripts/browser-qa.mjs --url http://localhost:8799 --only boot` — boot against a LOCAL serve of `pwa/`.

## 4. Definition of done per item
Shipped to `main`, version bumped, headless test green (the REAL component rendered), worker deployed if touched, and the `OPEN ISSUES` / `SESSION REGISTRY` blocks in `docs/qa/ACTIVE_BUGS.md` updated with the ID + `[SHIPPED x.y.z]`. Re-verify export items in a real DOCX/PDF before marking closed.

## 5. The nightly (now PARALLELISED)
A persistent scheduled task `antcv-nightly` (~02:46 local daily) runs this backlog autonomously with the same discipline. The owner can "Run now" from the Scheduled sidebar to pre-approve its tools.

**Parallelisation (owner 2026-06-15: "allow more task parallelization, especially for daily automated work").** The nightly now fans out **independent, non-overlapping** backlog items to concurrent `Agent` subagents in ONE message, then integrates serially:
- Dispatch a separate Explore/general-purpose subagent per item whose files do NOT overlap (e.g. (a) SETTINGS-SCROLL-RESET-001, (j) PREVIEW-EXPORT-PAGEBREAK-PARITY-001, the buildHTMLDoc-dims half of CL-TABLE-DIMS, a worker-only diag) — each returns a unit-tested patch + the exact mirror block.
- Keep items that touch the SAME file SERIAL on the main thread (e.g. anything editing `app.src.js`'s Personal `yl` region, or the shared `antcv-sections-normalize-415.js`) — concurrent edits to one minified file would corrupt the mirror.
- **Only ONE deployer at a time** (CLAUDE.md): integrate subagent patches one-by-one on `main`, run the FULL test suite + headless verify after EACH integration, single cache-bust per version, never parallel `deploy.yml` runs.
- A good shape: parallel READ/DIAGNOSE + isolated-file patches → serial INTEGRATE+VERIFY+SHIP. Use a `worktree`-isolated subagent only when a patch needs to build/test against a mutated tree in isolation.
