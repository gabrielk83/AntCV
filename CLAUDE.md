# Context for AI assistant sessions on this repo

This file orients an AI assistant working on AntCV. Read it once at session start.

## What this project is

AntCV is a React PWA that helps a job seeker draft a CV and cover letter, tailored to a specific job description, using their own LLM keys or a shared demo provider. Deployment is Cloudflare Pages (PWA) + Cloudflare Workers (proxy, DOCX renderer, C2PA signer, access relay).

## Where to look first

1. `README.md` — repo layout and current build state.
2. `docs/plan/AntCV_Plan_v2_LockedSources.md` — the current correction + implementation + testing plan. Read this end-to-end before suggesting architectural changes.
3. `docs/design/Unified_Visual_Package_System.docx` and `docs/design/Writing_System_Engine_Specification.docx` — the two locked source documents. When code and a document disagree, the document wins; raise an issue.

## Owner's communication style

- Direct, factual, compression-oriented. Short sentences.
- No filler, no banned-list corporate language. Banned-words list is enforced in the writing-engine layer; the same standard applies to your replies and to any prose you produce in the repo (READMEs, comments, commit messages).
- Iterative; expect rapid back-and-forth and follow-up patches. Ship tight, named hotfix bundles rather than sweeping rewrites.

## app.js source of truth (do not lose it again)

`pwa/app.src.js` is the **de-minified, human-editable SOURCE** for `pwa/app.js`. EDIT `app.src.js` — do **NOT** re-de-minify `pwa/app.js` into a throwaway `/tmp` file again; that source already exists and is committed.

**Rebuilding is gated — read `docs/deployment/app-js-source-and-rebuild.md` first.** `npm run build:app` (esbuild `--minify`) is **known-unsafe today**: it prepends `"use strict"` and is not behaviour-preserving for this sloppy-mode bundle — it blue-screened the app on 2026-06-06 (`APPJS-BLUESCREEN-001`, reverted at 1.50.166). A rebuilt `app.js` may NOT be deployed until a minifier/config passes the **identity round-trip gate** (rebuild an UNEDITED source → confirm it boots identically in a real browser). Until then, make small fixes as **surgical in-place edits to the minified `app.js`**, mirrored into `app.src.js` for traceability. After any change, follow the cache-bust protocol (bump `app.js?v=` in `index.html`, `sw.js` CACHE, `antcv-version-override.js` TARGET_VERSION). Deploy via deploy.yml only — one deployer at a time, never in parallel.

## Hotfix discipline

Anything that touches `pwa/app.js` or any of the fetch-wrapper sidecars goes through diagnostic-first protocol: reproduce → console probe → targeted patch. Don't guess. There was a prior incident (v1.40.335 first attempt) where speculative changes to the `fetch` wrap chain and to an `app.js` z-index caused a downstream blue screen. The lessons:

- The PWA loads multiple fetch-wrappers in document order (`antcv-cloud-restore-filter-298.js` at index.html line 842, `antcv-cloud-put-shrink-guard-289.js` at 1118, `antcv-kernel-completeness-290.js` at 1140). Changing when one of them wraps `window.fetch` can reorder the chain and cause double-wrap with rethrow risk in the Response reconstruction path.
- Several scripts present in `pwa/` (notably `antcv-onboarding.js` and `antcv-ai-notice-stability.js`) are present on disk but **not loaded by index.html** — they were retired in v1.40.303. Always grep `index.html` for `<script src="..."` before touching any of these files; an edit to a dead file is a no-op.

## Patch protocol

When applying a patch:

1. Identify the file is actually loaded (grep `pwa/index.html` for the src).
2. View the surrounding 20–40 lines, including the immediate ancestor function.
3. Make the change a unique string replacement (count occurrences before applying).
4. Re-grep after applying to confirm exactly one site changed.
5. Bump the `?v=` query string on the changed file in `index.html` so the service worker invalidates.
6. Bump `sw.js` `CACHE` constant.
7. Update `pwa/antcv-version-override.js` `TARGET_VERSION` and extend `STALE_VERSIONS`.
8. Bump the `window.ANTCV_VERSION = '1.50.x'` seed in `index.html` (the deferred module ~line 326) to the new version — the login gate reads it BEFORE version-override pins TARGET; a stale seed flashes the wrong version on boot (the "1.50.9-babel-fish" bug, fixed 1.50.775).

## STALE_VERSIONS invariant (do not violate)

`pwa/antcv-version-override.js` rewrites old version strings in the DOM and console to the current `TARGET_VERSION`. Two rules:

- **Never put the current `TARGET_VERSION` in `STALE_VERSIONS`.** That list is for versions OLDER than the current one. Adding the current version causes the regex to match its own output and append the suffix on every `MutationObserver` cycle (text grows to `1.40.X-suffix-suffix-suffix-…` until the script stops being re-triggered, which can take minutes on a busy page).
- When bumping `TARGET_VERSION`, add the PREVIOUS `TARGET_VERSION`'s number to `STALE_VERSIONS`, not the new one.

There is an idempotency guard in `rewriteTextNodes` that skips nodes already containing `TARGET_VERSION` — this is defence in depth, but it is not a substitute for the invariant above. Keep both.

## Test data

`docs/personas/anita/` contains a complete synthetic candidate. Use it for any end-to-end test that needs a full personalInfo object, photo, certificate PDFs, etc. Do not commit real candidate data.

## Deployment

`docs/deployment/cloudflare-setup.md` is the source of truth for how PWA and workers reach production. Read it before suggesting any deployment-related change.

## Sync discipline — never regress `main` (desktop ⇄ cloud/mobile)

AntCV is now worked from MANY places that all push to `origin/main`: this **desktop** clone, a **claude.ai cloud Routine** (dispatchable from mobile — see `docs/qa/CLOUD_ROUTINE_PROMPT.md`), spawned worktree sessions, and **every scheduled/recurring routine** (position-discovery, the job-tracker + antcv nightlies, the weekly demand-seed + relay cost-quality tune, etc. — see `docs/qa/NIGHT_SHIFT.md`). To guarantee none overwrites another (owner: "after the mobile session the desktop must not regress from it"):

1. **SYNC FIRST.** At the START of every session/run, before any edit, run `git fetch origin && git pull --rebase origin main`. The cloud may have pushed since you last synced; rebasing onto it means your work BUILDS ON it, never reverts it.
2. **CLAIM A LANE (NIGHT SHIFT).** Before editing anything that consumes a version number (any `pwa/` asset needing a cache-bust) or that a parallel session might touch, run `node scripts/shift.mjs claim --task "<what>"`. It reserves a version-number RANGE in `docs/qa/NIGHT_SHIFT.md` (computed from the true git high-water mark, so a regressed `TARGET_VERSION` can't hand out used numbers) and prints a `git worktree add` line. **Work in that worktree**, use version numbers only inside your range, `node scripts/shift.mjs release` when done. This is what stops the cross-session version collisions + shared-tree WIP bleed (the 245/246 regression class). `shift.mjs status` reads origin, so it is correct even when your tree is dirty. Docs-only edits may skip the claim but should still SYNC FIRST.
3. **NEVER force.** Never `git push --force`/`--force-with-lease` to `main`, never `git reset --hard origin/main` to discard remote commits, never `git push` after a non-fast-forward without a `pull --rebase` first. If a push is rejected non-ff, `git pull --rebase origin main` then push — do NOT force.
4. **Enforcement:** `scripts/git-hooks/pre-push` (install once: `cp scripts/git-hooks/pre-push .git/hooks/pre-push`) best-effort fetches origin/main and BLOCKS the push if local `main` is behind/diverged — telling you to `pull --rebase` first; it also runs the cache-bust `?v` gate and warns if you push a versioned change with no active shift claim. Bypass only when certain: `git push --no-verify`.
5. The cloud Routine AND every scheduled routine follow the same rules (their prompts say sync + claim before push). PWA auto-deploys from `main`, so a regression there is also a production regression — this discipline protects both.
