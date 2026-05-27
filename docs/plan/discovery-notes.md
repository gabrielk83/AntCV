# Phase 0 — Discovery notes

Output of the Phase 0 discovery pass against `docs/plan/UI_UX_Bugfix_Implementation_and_QA.md` before any code work began. Companion to:

- `docs/plan/PB-006-reference.md` — the three primitives PB-006 wants reused (boundary + (CONT.) heading + heading-rewrite).
- `docs/plan/PP-003-regression-history.md` — seven prior iterations of the Publications row-control fix and concrete failure modes.

## §3 file map — verification status

39 unique files named across §3's v1 and v2 tables. Verification was: (a) file exists, (b) loaded by `pwa/index.html` (static `<script src>`, module import, or the dynamic bootAntCV chain), (c) file purpose matches the row's claim.

**All rows pass except one:**

- **VAL-001 row** previously listed `pwa/antcv-shape-guard.js` among the files to edit for "warning vs error colours". That file is state-shape integrity only — its only warnings are throttled `console.warn` lines about missing `bullets` fields. No DOM, no severity tokens, no validation-color surface. **§3 has been amended in this same Phase 0 commit** to drop shape-guard from the VAL-001 file list.

**Notes that do not require §3 amendment:**

- The "Shared control bar component" row in v1 names `pwa/antcv-section-control-bar.js` and prefixes it with `New:` — correctly identifying it as a P0-A deliverable that doesn't exist yet. No amendment needed.
- `pwa/app.js` is loaded via the dynamic bootAntCV chain at `index.html:265`, not via a static `<script src>`. Both forms count as loaded.
- `pwa/antcv-docx-client.js` is loaded via the ES-module import at `index.html:250`, not via `<script src>`. Counts as loaded.

## CLOUDCONVERT_API_KEY — committed status

**Not committed anywhere in the repo.** Confirmed by grep across all tracked content (`docs/`, `pwa/`, `workers/`, root):

- The key is referenced in code only via `env.CLOUDCONVERT_API_KEY` (the Worker secret access pattern):
  - `workers/docx-worker/src/cloudconvert.js:211`
  - `workers/docx-worker/src/index.js:397`
- No `.dev.vars`, `.env`, or wrangler.toml file in `workers/` contains the literal value. `workers/docx-worker/wrangler.toml` correctly notes that secrets are set via `wrangler secret put`.

## CloudConvert is already partially wired

The plan's P0-F CloudConvert work is **not greenfield**. The docx-worker already runs CloudConvert in the opposite direction (DOCX → PDF) for the PDF export pipeline:

- `workers/docx-worker/src/cloudconvert.js` — full CloudConvert client with `import/base64` → `convert` → `export/url` job chain, 60 s poll cap, error handling, `pdfProvider()` helper.
- `pwa/antcv-pdf-error-toast.js` — already user-aware: handles CloudConvert "Invalid scope" errors, timeout, missing-key 503.
- `workers/docx-worker/wrangler.toml` — already has `[observability.logs] enabled = true, invocation_logs = true` directly after `compatibility_date` (matches the hazard checklist).

Implication for P0-F: the new `POST /api/jd/pdf-to-docx` route should live in **the same `docx-worker`**, reusing the existing CloudConvert auth/poll/timeout primitives rather than duplicating them in a new worker. The existing secret `CLOUDCONVERT_API_KEY` already has the required scopes (it's the same flow direction, just reversed input/output formats).

When Gabriel sets `CLOUDCONVERT_API_KEY` on the worker before P0-F starts, no new key is needed — the existing one is sufficient if it already has `task.read`, `task.write`, `user.read` scopes (confirmed by the existing DOCX→PDF flow).

## Workflow clarification — `APP_VERSION` in `pwa/app.js`

The per-phase deliverable in the session prompt says:

> "Bump `APP_VERSION` in `pwa/app.js` (search for `APP_VERSION` constant) — semver-ish patch within v1.40.x per phase."

There is **no `APP_VERSION` constant** in `pwa/app.js`. The file is a minified IIFE bundle that starts with `(()=>{const{useState:e,...}=React,...}`. The codebase versions itself through four other surfaces:

1. `window.ANTCV_VERSION = '1.40.340-watermark';` in `pwa/index.html:252`.
2. `app.js?v=...` query string in `pwa/index.html:265` (used by the service worker to bust caches).
3. `antcv-version-override.js?v=...` query string in `pwa/index.html:268`.
4. `TARGET_VERSION` constant in `pwa/antcv-version-override.js` (per CLAUDE.md, the DOM-rewrite target).
5. `CACHE` constant in `pwa/sw.js` (per CLAUDE.md patch protocol).
6. `STALE_VERSIONS` list in `pwa/antcv-version-override.js` (must include the *previous* TARGET_VERSION, never the current one — STALE_VERSIONS invariant in CLAUDE.md).

**Proposed substitution.** Each phase's "bump APP_VERSION" step becomes: bump 1–6 above. Specifically: bump `ANTCV_VERSION` (semver-ish suffix per phase, e.g. `1.40.341-p0a`), update the `?v=` query strings for every file the phase touched, bump `TARGET_VERSION`, append the previous `TARGET_VERSION` to `STALE_VERSIONS` (not the new one), bump `sw.js` `CACHE`. The final-deploy phase (post-merge) bumps the minor to `1.41.0`.

This is the procedure CLAUDE.md already documents. The session prompt's "APP_VERSION" wording can be read as shorthand for this same procedure.

## Other in-flight local work — handed off, not abandoned

Before Phase 0 started, a `v1.40.341-zfix` patch was already in progress in the working tree (modified `antcv-settings-front-327.js`, `antcv-stability-core-334.js`, `antcv-version-override.js`, `index.html`, `sw.js` + a new `antcv-preview-fabs-sticky-341.js`). It tactically addresses two of the same defects P0-E covers (PRV-001..PRV-003 and the AH-001 z-index symptom).

**Disposition (decided with Gabriel):** the zfix has been stashed (`stash@{0}: On main: v1.40.341-zfix WIP from Gabriel — pre-P0-A handoff 2026-05-26T22:23Z`) and will be superseded by P0-E's proper PreviewShell-derived-state refactor per the plan's PRV-001..PRV-003 acceptance criteria. The zfix is recoverable if needed but won't ship.

## Phase 0 deliverables, summarised

| Deliverable | Status |
|---|---|
| Read plan end to end | done |
| `docs/plan/PB-006-reference.md` | new, this commit |
| `docs/plan/PP-003-regression-history.md` | new, this commit |
| §3 verification | done; 1 amendment applied (this commit) |
| `CLOUDCONVERT_API_KEY` committed scan | clean |
| `APP_VERSION` workflow clarification | documented above |
| zfix handoff | stashed (`stash@{0}`) |
