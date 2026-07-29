# Nightly prompt — unsolicited CV/CL backlog, to completion

> **NIGHT SHIFT (parallel-session safety):** before editing, `git pull --rebase origin main` then `node scripts/shift.mjs claim --task "<what>"` and work in the printed `git worktree`; use version numbers only inside your claimed range; `node scripts/shift.mjs release` when done. See `docs/qa/NIGHT_SHIFT.md`.

Dispatch this whole block to the cloud Routine / nightly. It is self-contained and covers the FULL open
backlog from the 2026-06-23/24 owner QA on the unsolicited Product/Project Expert application. Work the
items in priority order, verify EACH before moving on, and update `docs/qa/ACTIVE_BUGS.md` as you close them.

---

AntCV — finish the unsolicited CV/CL QA backlog (owner 2026-06-24).

SYNC FIRST: `git fetch origin && git pull --rebase origin main` (NEVER force main). Read CLAUDE.md
(app.js is source-of-truth via app.src.js; `npm run build:app` is UNSAFE — make SURGICAL edits mirrored
app.src.js↔app.js by site, byte-level for app.js; cache-bust QUINTET on every loaded-file change;
diagnose-first). Repo is past 1.50.840. Read `docs/qa/ACTIVE_BUGS.md` entries named below before touching
each. Do NOT regress the already-fixed items: a/b (results), d/e (unsolicited full breadth + no merge,
UNSOLICITED-NOT-TARGETED-001), the contribute MARKERS fix (CONTRIBUTE-MARKERS-MID-BULLETS-001).

CONTEXT (gathered live, owner signed in on antcv.pages.dev): this is an UNSOLICITED application
(meta.company === "Unsolicited", no JD). Use `docs/personas/anita` for a full personalInfo when you need a
headless fixture. The owner's real doc WILL freeze a live tab — develop against the headless diags and
confirm on a real export/regen only at the END.

DEVELOP-AND-VERIFY DISCIPLINE for every item: reproduce headless first (a diag), fix, prove with
`node --test --test-force-exit pwa/test/unit/*.test.mjs` (keep ALL green) + `node pwa/test/boot-smoke.mjs`
+ the relevant diags, THEN cache-bust + commit + push (sync before push) + deploy workers if touched
(`gh workflow run deploy.yml`, owner-approved). After deploy, VERIFY the real loaded `app.js?v` /
sidecar `?v` in the browser before trusting "it works" — a stale SW masked fixes ALL of this week
([[stale-sw-version-mask-hazard]]).

PRIORITY 1 — UNSOLICITED-DETECTION ROOT CAUSE (`p` flag). Likely the single root of several bugs.
The unsolicited DISPLAY/GENERATION flag `p` in app.src.js (~25051 `const n = p ? {...neutral...} : {}`;
also used ~25161 `title: p ? "WHY YOUR COMPANY" : e.title`, ~25176 `e.items && e.items.length && !p`) is
FALSE for this unsolicited app even though meta.company === "Unsolicited" and antcv:activeAppCompany ===
"Unsolicited". Consequences observed live: the HOW I WOULD CONTRIBUTE section maps to the EMPTY skeleton
items (`e.items && !p` branch) and gets `n = {}` (no neutral contribute_intro/items/closing), so it shows
4 empty "(click to add)" rows. FIND `p`'s binding in the showcase/render function (search backward from
~24698 `E = e.cv.map`) and align it with the explicit unsolicited marker (meta.company /
antcv:activeAppCompany === "Unsolicited", same authority as `_isTargetedExport` in antcv-docx-client.js,
UNSOLICITED-NOT-TARGETED-001). When `p` is correctly TRUE, the neutral fallbacks fire — the contribute
intro = "If a role fits, my first priorities would typically be:", 3 neutral bullets, and the neutral
closing — with NO prompt change. VERIFY headless by injecting an unsolicited state and asserting the
contribute section resolves to non-empty intro/items/closing; then a live regen. This is CL-CONTRIBUTE-
INTRO-CLOSING-002. (NOTE: the 1.50.838 prompt insertion that tried to force this was REVERTED in 1.50.840
because it regressed contribute generation to EMPTY — do NOT reintroduce a prompt-side fix without
per-regen verification; prefer the `p`-flag fix which is deterministic.)

PRIORITY 2 — GENERATED CONTENT PERSISTENCE (reverts to kernel on reload). Live: after a regen the CV
experience had 15 roles and the CL was populated, but on a fresh load `localStorage.sections` reverted to
the UNSOLICITED KERNEL SKELETON (experience 0 roles, contribute = empty skeleton) — the generated CL/CV
lives only in React state and is not committed to the active unsolicited row, so a refresh loses it. The
AUTO-COMMIT path ([[targeted-app-persistence]] 1.50.732) covers TARGETED apps; the unsolicited kernel row
does not persist a regen. Make a regen on the unsolicited row PERSIST to `sections` (commit the generated
sections to the active row the same way targeted does), so a refresh keeps the generated content. Verify:
regen headless/live → reload → sections still hold the generated roles + contribute.

PRIORITY 3 — CV 9-PAGE SIDEBAR SPILL (CV-SIDEBAR-SPILL-9-PAGES-001). Full-breadth unsolicited CV exports
to 9 pages (should be ~3-4). PRE-EXISTING (the 0623 merged CV was also 9 pages) — do NOT revert the
un-merge. Per-page non-blank density of the export: 43/72/7/58/1/4/1/0 — pages 3,5,6,7,8 near-empty, p8
blank. The SIDEBAR (tools 13 + certs 9 + education 4 + regulatory[many] + publications + languages +
interests + accessibility + recommendations) is FAR longer than the MAIN column (experience), so after the
main ends (~p4) the sidebar continues ALONE down pages 5-8. Live `antcv:autoPages` breaks each sidebar
section onto its own page (`education/regulatory/languages →p2, accessibility →p3`). This is a docx-worker
per-page two-column BALANCING failure (SIDEBAR_NPAGE/SIDEBAR_UNIFIED in antcv-auto-pagebreak-block-001.js +
`buildTwoColumnDocument` in workers/docx-worker/src/index.js — hand-maintained bundle, no build step,
[[docx-worker-bundle-no-build]]). Reproduce headless with the measurer diag + `workers/docx-worker/test/
diag-twocol-paged.mjs` (long-sidebar + 11-role CV); KILL the trailing blank page + the AI-watermark-on-its-
own-page first ([[design-rules-watermark-table]]); then balance/reflow so the sidebar overflow uses the
full sheet width once the main ends, OR balance the two columns. Keep the salmon permanent
([[salmon-splitter-permanent]]) and EXPORT==PREVIEW page structure. Keep the salmon diags green
(diag-sidebar-preview-break, diag-salmon-empty-region, diag-cl-salmon, diag-cl-double-salmon,
diag-sidebar-salmon-push). Deliverable: 9 pages → ~3-4, zero near-empty/blank pages.

PRIORITY 4 — GHOST PLACEHOLDER ROLES IN PREVIEW (CV-GHOST-PLACEHOLDER-ROLES-PREVIEW-001). The generator's
`on:false` "unused slot" roles (`[Role title], [Company]` with bullets `<unused slot>`) render as ghost
rows in the PREVIEW (the export correctly skips them). Add a preview-render filter in app.js so a role that
is a pure placeholder (title matching `^\s*\[.*\]\s*$` OR bullets that are `<unused slot>` / bracketed
placeholders) is not rendered in the preview, matching the export. Surgical app.js edit mirrored to
app.src.js; verify the editable preview still lets the owner toggle REAL on:false roles back on.

PRIORITY 5 — smaller items (fix if cheap, else log a precise repro):
- RESULT CUT MID-SENTENCE: a role's `Results:` reads incomplete (e.g. "Benchmark imprinted against
  non-imprinted devices"). The GENERATED outcome itself is short (under the 260-char lamination cap), so
  this is generation — tighten the outcomes prompt to require a complete clause (subject+verb+measurable
  result) and never emit a truncated/dangling outcome. Regen-verify.
- STUDENTS-COUNCIL-NO-RESULTS-001: that role shows no Results line. This is the numeric-only derive rule
  (RESULTS-DERIVE-NUMERIC-ONLY-001) — correct unless generation emits a quantified outcome for it. Either
  leave as WAD (document) or have generation emit a council-scale metric. Owner decides.
- CONTRIBUTE-EDIT-JUMPS-WIB-TABLE-001: editing HOW I WOULD CONTRIBUTE re-runs the measurer and the WHAT I
  BRING table visibly jumps. Debounce/coalesce the contribute sidecars' `antcv:sections-updated` /
  `antcv:item-pages-changed` re-dispatch (antcv-how-contribute-controls-245.js + hwic-to-rich-block-760.js)
  so an edit does not trigger a full re-pagination churn; or stabilise the WIB table height during
  re-measure. Reproduce with a headless edit + measure loop.
- EXPORT-PREVIEW-PRINT-SETUP-REFRESH-001: the export preview first paints a "print setup" state and needs a
  manual refresh to show the page view (first-paint-before-ready staleness, [[results-firstpaint-stale-laminator]]
  family). Capture which render path paints the print-setup state before the page view is ready and gate it.

CONSTRAINTS (all items): diagnose-first; no `build:app`; surgical app.js edits mirrored to app.src.js;
cache-bust quintet per loaded-file change; keep units + boot-smoke + salmon diags green; worker deploy is
manual + owner-approved; sync before every push; confirm the real loaded `?v` after deploy; live-confirm on
the big doc only at the end (it freezes a live tab). Ship tight, named, per-bug commits (the owner prefers
small named bundles over sweeping rewrites). When an item is genuinely generation-only (regen-gated),
implement the prompt/flag fix and leave a clear note that the owner must regenerate to confirm.

DELIVERABLE: each priority closed or precisely re-scoped in ACTIVE_BUGS with measured before/after, the CV
down to ~3-4 pages with no empty pages, the unsolicited contribute showing a real opening + bullets +
closing that SURVIVE a refresh, and no regression to a/b/d/e or the marker fix.
