# AntCV Nightly Brief — 2026-06-21 (updated end of 2026-06-20 session)

You are the AntCV nightly run. Work autonomously: diagnose → fix → boot-smoke → commit → push → deploy workers via `deploy.yml` if needed. Report at the end. Do NOT pause for approval (owner has granted full autonomy).

## Read first
1. `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md` — full open/closed inventory + the **DO-NOT-REGRESS** checklist (now 728–743). Run its probes after your changes.
2. `CLAUDE.md` — app.js is gated/dangerous; surgical in-place edits only, mirror `app.src.js` → `app.js`, run `node pwa/test/boot-smoke.mjs` after ANY app.js/sidecar change, cache-bust quartet on every change.
3. Memory: `[[export-sanitize-and-preview-parity]]`, `[[targeted-app-persistence]]`, `[[stale-sw-version-mask-hazard]]`.

## What shipped 2026-06-20 (do NOT redo or regress)
- Targeting persistence (728–732): a targeted gen is a first-class active app (AUTO-COMMIT).
- Export sanitize/merge (733–736): strip Snowflake/DBT from tools + table cells; hide
  irrelevant roles; merge same-company roles; TABLE-DIRECTION-001 prompt.
- Tense (737/738): preview bullets + Results match the export tense; `_tenseLead` verb-map +
  hyphen fix (align/co-organised). `window.AntcvTenseClause`.
- **Preview parity (740–743): the editable preview now matches the PDF** — hidden roles
  (`AntcvExportHiddenRole`, null-in-place), hidden sections (`AntcvExportHiddenSection`, Di/zi
  filter), Snowflake stripped, present tense, and **same-company MERGES via a DATA-level merge**
  (`AntcvMergeExperienceRoles` + a once-only `React.useEffect [ro,io]` guarded by
  `__antcvMerged`). So the old "read-only export-preview mode" idea is NO LONGER NEEDED —
  content parity is achieved in the editable preview. Don't rebuild it.
- Publications hide made drift-proof (743): `_isTargetedExport` also honours `activeAppCompany`
  and the stable `__antcvMerged` flag, and the export DROPS hidden sections (not just on:false).

## Priority order (highest leverage first)

### P1 — SIGNIN-GATE-HARDREFRESH-001 (fix FIRST — it blocks every other fix reaching the owner)
Most of 2026-06-20 was wasted because the owner's tab ran **stale `app.js?v=1.50.724`** while
the network served the latest, and `antcv-version-override.js` rewrote the chip to the latest
number — masking it. The in-app Hard Refresh + `antcv-hardrefresh-force-349.js` did NOT pull
the new version (had to clear the SW manually from the tab).
- Diagnose live (owner signed in): why does the SW serve a stale `app.js`/sidecar? Old `sw.js`
  cache-first for `index.html`? skipWaiting/clients.claim not firing? controlling SW not
  updating on navigation?
- Fix Hard Refresh to GUARANTEE a fresh document (unregister SW + clear caches + `location.replace`
  cache-bust, or `registration.update()` + skipWaiting + reload). Verify a NORMAL reload (no
  manual clear) lands on a freshly-shipped no-op bump.
- Stop the masking: `antcv-version-override.js` must NOT make a stale build look current — show
  the REAL loaded `app.js?v` (read the script tag), or only rewrite when it equals the loaded
  version. A stale tab must be visibly stale.
- ALSO fix the cache-bust hygiene: the docx-client `?v` in index.html silently drifted (stuck
  at 740 for several versions) because sed bumps assumed the wrong "from" version. Consider a
  build check that asserts every changed file's `?v` actually advanced.

### P2 — Targeting-state drift to EMPTY (the recurring gremlin behind several bugs)
Mid-session BOTH `meta.company` AND `antcv:activeAppCompany` drifted to "" on the live Nordea
app (and `antcv:lastJdText` was empty too), silently switching OFF every display-time targeted
check. 743 patched the symptom for Publications (stable `__antcvMerged` fallback), but the ROOT
— a targeted application losing its company/JD identity while active — is unfixed and likely
underlies the whole persistence saga.
- Trace WHEN/WHY meta.company + activeAppCompany get wiped on an ACTIVE targeted app (cloud
  restore? showcase? a reload landing on the kernel?). The auto-commit (732) set them; find who
  clears them.
- Persist the JD text WITH the targeted application (it was empty), so the cluster gates
  (keep sysadmin for IT JDs, keep Publications for research JDs) actually have a JD to read.

### P3 — Twin tables still share (re-verify, then backstop)
TABLE-DIRECTION-001 (prompt, 737) shipped but was only ever tested on stale 724. Regenerate a
targeted app at ≥743 and inspect CV CORE COMPETENCIES vs CL WHAT I BRING.
- If they STILL share focus areas / overlap expertise: they're likely SEEDED from a shared
  source at generation — fix the seed so each table gets a distinct seed/direction.
- Fallback: a deterministic "no shared Focus-Area LABEL" pass (rename/vary the CL bring label
  when it equals a CV core label). Deterministic can't write distinct expertise, only labels.

### P4 — Salmon sidebar pagination (preview ≠ PDF page boundary) — FRAGILE
Content parity is done, but the two-column CV pagination still differs:
- `antcv:autoPages` (export) = `{experience}` only — the WORKER flows the sidebar itself.
- `antcv:autoPagesPreview` = `{experience, interests}` — the PREVIEW breaks the sidebar at
  INTERESTS (after Languages), so Languages stays on preview page 1; the PDF breaks BEFORE
  Languages (page-1 sidebar = Education only).
- ROOT: the preview's per-section A4-boundary measurement for the SIDEBAR underestimates the
  rendered height vs the worker (font/line-height/spacing differ) → break lands ~1 section late.
- FIX: tighten the preview sidebar measurement to the worker's metrics (or a conservative
  sidebar-height factor) so the preview salmon breaks the sidebar where the PDF does. Measurer
  is app.src.js ~17752–17925 (CV two-column page-box). THE MOST FRAGILE AREA in the repo
  (blue-screen risk) — boot-smoke + a real two-page CV before/after; do NOT regress the
  main-column break (it is correct). `__antcvSalmon` is PERMANENT — never remove it.

### P5 — Carry-over open items (see PROJECT_ISSUES doc OPEN section)
JD-FETCH-CHIP-LABEL-001, cluster-demand worker pipeline + nightly recruitment refresh,
analysis-panel-merge, analyse-JD-URL-on-upload, EXPORT-PDF first-export race, page-break before
System Architect, AI-notice overlap.

## DO-NOT-REGRESS probes (728–743)
- Generate Nordea → it's a Nordea APPLICATION (label/subtitle), holds within session.
- Export PDF → NO Snowflake/DBT anywhere; NO Students Council / Security Guard / sysadmin /
  foreningsarbejde roles; NO Publications & Patent section; Innoviz/Meprolight/TAU each ONE
  merged role; present-tense Results (align/co-organised present).
- Preview == that PDF for content (the merged roles + hides show on screen).
- Switch to the unsolicited kernel → FULL breadth returns (kernel never merged/hidden).
- `AntcvTenseClause('Specify x; aligned y; co-organised z')` → all present.

## Guardrails
- `node pwa/test/boot-smoke.mjs` after every app.js/sidecar change (0 errors + glDemo=function).
- `node scripts/run-tests.mjs` (339 pass / 0 fail) before every push.
- Cache-bust quartet on every change: bump the CHANGED file's `?v` in `index.html` (verify it
  actually changed — grep it), `sw.js` CACHE, `antcv-version-override.js` TARGET_VERSION (+ add
  the PREVIOUS target to STALE_VERSIONS, never the current).
- Mirror `app.src.js` edits into `app.js` (minified); `node --check` both.
