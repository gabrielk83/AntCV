# Autonomous remote session prompt — AntCV (2026-06-08, ~4h, full autonomy)

Paste the block below as the first message of a new Claude Code session on the
AntCV repo for unattended work. It is self-contained.

---

You are working on **AntCV** (React PWA on Cloudflare Pages + Workers) with FULL
AUTONOMY for ~4 hours. Fix the prioritized list independently: implement →
verify → commit → push → deploy workers → log. Do NOT wait for me between items.
Report a summary at the end.

## Read first
- `CLAUDE.md` (root) — build/deploy discipline. Obey it exactly.
- `docs/qa/ACTIVE_BUGS.md` → the **SESSION 2026-06-08** section (top) = current
  state. `docs/FEATURES_REGISTRY.md` for feature scope.
- Memory notes already capture the key gotchas: salmon-splitter-permanent,
  llm-cost-quality-router, kernel-recovery-and-floor, sections-hide-over-delete.

## Hard rules (non-negotiable)
- `pwa/app.src.js` is the SOURCE for `pwa/app.js`. Edit app.src.js, rebuild with
  **terser ONLY**: `npx --yes terser pwa/app.src.js -c -m -o pwa/app.js`. NEVER
  esbuild / `npm run build:app` (prepends "use strict" → blue screen).
  Verify every rebuild: `node --check pwa/app.js`, output starts `(()=>{`,
  `grep -c 'use strict'` == 0.
- After ANY change, bump the cache-bust trio: `index.html` `app.js?v=` (and the
  changed sidecar's `?v=`), `sw.js` `CACHE`, `antcv-version-override.js`
  `TARGET_VERSION` — and add the PREVIOUS version to `STALE_VERSIONS` (NEVER the
  current one). Current head: **1.50.292** → start at 1.50.293.
- docx-worker: edit `src/index.js` (deployed bundle) AND mirror to
  `src/generate.js`. You CANNOT see rendered PDF/Word — make export changes
  surgical and flag them for an owner export check.
- Deploy workers only via `gh workflow run deploy.yml -f target=<w> -f mode=deploy
  -f confirm=<w>` (targets: docx-worker, proxy, access-relay). One at a time.
  PWA auto-deploys on push to `main`.
- Keep 3 branches identical: `main`, `claude/antcv-roadmap-bugs-L9Sqa`,
  `plan/2026-06-06-analysis-followups`. Never force main backward.
- Every PWA change: in-browser boot-smoke (headless: serve `pwa/`, load, assert
  0 console errors + `typeof window.glDemo === 'function'`). It's the blue-screen
  guard — the project's #1 risk.
- Blue screens / React #185: diagnostic-first, NEVER speculative render-path
  patches (a speculative fetch/z-index change caused a prior blue screen). If you
  can't get a repro/trace, ship only additive/guarded changes and document.
- D1 (read-only diagnosis OK): database `ant_memory` id
  `499c3de9-8371-428a-9b9f-5d695d58e32b`. `llm_calls.completion_tokens` /
  `http_status` / `error_message` are the truth for provider issues. Do NOT
  delete or mutate user data.
- Run the unit suite freely in THIS session: `node --test pwa/test/unit/*.test.mjs`
  (38 tests). (The owner's "ping before tests" rule was for the interactive
  session; for unattended work, run them as a gate.)

## Work items (priority order)

1. **SALMON-CV-MAINROLE-BREAK-001 [HIGH]** — In the CV preview the page-box
   salmon breaks the SIDEBAR (e.g. ADDITIONAL INFORMATION → page 2) but the
   MAIN-column EXPERIENCE roles do NOT break at the same boundary, so the main
   column overflows past the salmon. Make experience roles auto-paginate: the
   measurer (`pwa/antcv-auto-pagebreak-block-001.js`, 1.50.287, has an
   experience role pass writing `autoPages[expId][roleIdx]`) + the CV render
   `d`/`g` role-page path (`app.src.js` ~37700) must move a role to page 2 so the
   main column splits WITH the sidebar. Verify the page-2 main column shows the
   role continuation and nothing overflows the salmon. Whole roles only — never
   split a role mid-way. Owner gave exact DOM 2026-06-08.

2. **SALMON-AUTO-EXPORT-001 [HIGH, export]** — Manual breaks export to PDF/Word;
   AUTO (measurer) breaks do NOT (docx-client 1.50.215 stand-down — forwarding
   the sidebar auto-break scrambled the 2-column PDF: isolated header, mid-role
   cut, wrong continuation header). Re-enable auto-break export so the exported
   PDF/Word matches the preview salmon, WITHOUT the 2-column scramble. Likely
   needs worker-side group/role-aware 2-column pagination rather than raw
   autoPages forwarding. Flag for owner export check.

3. **PREVIEW-PDF-PARITY-001 / AUTO-PAGEBREAK-CV-MIDGROUP-001 [HIGH]** — the
   measurer measures PREVIEW heights; the PDF has larger paragraph spacing, so a
   break that's right in the preview lands mid-group in the PDF. Make the
   measurer (or the export) reconcile so the same break is correct in both. See
   the 2026-06-07 section for the full analysis (Vi estimator at width 590/11pt
   targets a third geometry — re-point it to the real PDF column).

4. **LLM-QUALITY-PERSIST-001 [enhancement]** — quality-aware routing
   (`app.src.js` `__antcvTaskDemote`) is session-local. Seed it from the D1
   `llm_quality_signals` / `llm_provider_health` tables (via the relay) so a
   provider that's consistently bad for a task is deprioritized across sessions.
   Keep it a cheap/cached read off the hot path.

5. **PB-WORKER-CONT-HEADER-001 [export]** — exported EXPERIENCE page-2
   continuation heading renders "SELECTED OUTCOMES" instead of "EXPERIENCE
   (CONT.)". docx-worker generate.js heading pairing. Flag for owner export
   check.

6. **PB-WORKER-SIDEBAR-FILL-001 [export]** — navy sidebar doesn't fill to page
   bottom on a continuation page in the export (Word full-height cell technique).

7. If time remains: triage other `[OPEN]` items in ACTIVE_BUGS.md you can verify
   without owner input (skip anything marked "needs owner live-verify" or that
   needs a real device / rendered PDF you can't see).

## Do NOT do without owner input
- Anything requiring real-device visual confirmation as the ONLY verification
  (ship it, mark "owner verify", move on — don't block).
- The wizard two-table language UX redesign (owner to confirm direction first).
- Deleting any user data or D1 rows.

## End-of-session report
Append a dated subsection to `docs/qa/ACTIVE_BUGS.md` listing what you shipped
(versions), what you couldn't verify (and why), and anything that still needs
owner input.
