# AntCV Nightly Brief — 2026-06-21

You are the AntCV nightly run. Work autonomously: diagnose → fix → boot-smoke → commit → push → deploy workers via `deploy.yml` if needed. Report at the end. Do NOT pause for approval (owner has granted full autonomy).

## Read first
1. `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` — full open/closed inventory + the **DO-NOT-REGRESS** checklist (728–739). Do not undo any of it; each item has a verification probe — run them after your changes.
2. `CLAUDE.md` — app.js is gated/dangerous; surgical in-place edits only, mirror `app.src.js` → `app.js`, run `node pwa/test/boot-smoke.mjs` after ANY app.js/sidecar change, cache-bust quartet on every change.
3. Memory: `[[export-sanitize-and-preview-parity]]`, `[[targeted-app-persistence]]`.

## Priority order (highest leverage first)

### P1 — SIGNIN-GATE-HARDREFRESH-001 (fix FIRST — it blocks everything else reaching the owner)
The whole 2026-06-20 session was wasted effort because the owner's tab ran a **stale `app.js?v=1.50.724`** while the network served the latest, and `antcv-version-override.js` rewrote the chip to show the latest number — masking it. The in-app **Hard Refresh** + `antcv-hardrefresh-force-349.js` did NOT pull the new version.
- **Diagnose live** (owner signed in): why does the SW serve a stale `app.js`? Check the SW lifecycle (is an old `sw.js` cache-first for `index.html`? is skipWaiting/clients.claim firing? is the controlling SW updating on navigation?).
- **Fix the Hard Refresh** so it guarantees a fresh document: unregister SW + clear caches + `location.replace` with a cache-bust, OR `registration.update()` + skipWaiting + reload. Confirm a real second-load lands on the new `?v`.
- **Stop the masking**: `antcv-version-override.js` must NOT make a stale build look current. Show the REAL loaded `app.js?v` (read it from the script tag) somewhere visible, or only rewrite when it matches the actual loaded version. A stale tab must be VISIBLE as stale.
- Probe: ship a no-op version bump, confirm a normal reload (not a manual SW clear) reaches it.

### P2 — Twin tables still share (re-verify, then backstop)
TABLE-DIRECTION-001 (prompt, 1.50.737) was shipped but the owner only tested it on stale 724. Regenerate a targeted app at ≥1.50.739 and inspect the CV CORE COMPETENCIES vs CL WHAT I BRING tables.
- If they STILL share focus areas / overlap expertise: the tables are likely **seeded from a shared source** at generation, not just prompt-driven — investigate the table seed in the generation path and give each table a distinct seed/direction there.
- Fallback: a deterministic "no shared Focus-Area LABEL" pass in `sanitizeForExport` (rename/vary the CL bring label when it equals a CV core label). Note: deterministic can't write distinct *expertise*, only labels.

### P3 — Read-only "export preview" mode (preview parity for merges/hides)
The editable preview CANNOT show role merges/hides — every field binds to an INDEX path (`roles[t]…`), so hiding/merging shifts indices and breaks editing (see `[[export-sanitize-and-preview-parity]]`). Build a SEPARATE read-only preview that renders `sanitizeForExport(applyOutcomesMode(...))` output, so the owner sees exactly what the PDF will be (merges, hides, Snowflake-strip, tense). Do NOT transform the editable render.

### P4 — Salmon-splitter pages 2/3
Preview page-break placement (the PERMANENT `__antcvSalmon` splitter — never remove it) must match the worker export pagination, including a section-scoped "from here down → next page" break. Use the two-map model (`autoPages` vs `autoPagesPreview`).

### P5 — JD text not persisted with the targeted app
`antcv:lastJdText` was EMPTY (jdLen=0) on the live targeted Nordea app, so the cluster gates in `sanitizeForExport` (keep sysadmin for IT JDs, keep Publications for research JDs) can't read the JD. Wire the JD text into the active application record so cluster-aware logic works.

### P6 — Carry-over open items (see PROJECT_ISSUES doc OPEN section)
JD-FETCH-CHIP-LABEL-001, cluster-demand worker pipeline + nightly recruitment refresh, analysis-panel-merge, analyse-JD-URL-on-upload, EXPORT-PDF first-export race, page-break before System Architect, AI-notice overlap.

## Guardrails
- Run `node pwa/test/boot-smoke.mjs` after every app.js/sidecar change (the blue-screen guard). 0 errors + `glDemo=function` required before commit.
- Run `node scripts/run-tests.mjs` (expect 339 pass / 0 fail) before every push.
- Cache-bust quartet on every change: bump the changed file's `?v` in `index.html`, `sw.js` CACHE, `antcv-version-override.js` TARGET_VERSION (+ add the PREVIOUS target to STALE_VERSIONS, never the current).
- Mirror `app.src.js` edits into `app.js` (minified); verify `node --check`.
- Verify the DO-NOT-REGRESS probes for 728–739 still pass before finishing.

---

## P4 UPDATE — salmon sidebar pagination (precise finding, 2026-06-20 PM)

Content parity is now DONE (merges/hides/tense/sections/Snowflake all match — 737–743). The
remaining gap is PAGINATION parity in the two-column CV:
- `antcv:autoPages` (export break map) = `{experience: ...}` only — the WORKER flows the sidebar
  itself; it does NOT record sidebar section breaks.
- `antcv:autoPagesPreview` = `{experience, interests}` — the PREVIEW measurer breaks the sidebar
  at INTERESTS (page 2), i.e. AFTER Languages, so Languages stays on preview page 1.
- The PDF breaks the sidebar BEFORE Languages (page-1 sidebar = Education only). So the preview
  measures the sidebar ~1 section SHORTER than the worker renders it → break lands one section
  too late.
ROOT: the preview's per-section A4-boundary measurement for the SIDEBAR column underestimates
the rendered height vs the worker (font metrics / line-height / section spacing differ). FIX
DIRECTION: tighten the preview sidebar measurement to the worker's metrics (or add a
conservative sidebar-height factor), so the preview salmon breaks the sidebar where the PDF
does. The measurer lives in app.src.js ~17752–17925 (CV two-column page-box). FRAGILE — verify
with boot-smoke + a real two-page CV; do not regress the main-column break which is correct.
NOTE: role on:false state is correct in the data (hidden roles show OFF in panels); merged-away
roles are dropped from the array. No work needed there.
