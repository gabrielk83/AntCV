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

## STALE_VERSIONS invariant (do not violate)

`pwa/antcv-version-override.js` rewrites old version strings in the DOM and console to the current `TARGET_VERSION`. Two rules:

- **Never put the current `TARGET_VERSION` in `STALE_VERSIONS`.** That list is for versions OLDER than the current one. Adding the current version causes the regex to match its own output and append the suffix on every `MutationObserver` cycle (text grows to `1.40.X-suffix-suffix-suffix-…` until the script stops being re-triggered, which can take minutes on a busy page).
- When bumping `TARGET_VERSION`, add the PREVIOUS `TARGET_VERSION`'s number to `STALE_VERSIONS`, not the new one.

There is an idempotency guard in `rewriteTextNodes` that skips nodes already containing `TARGET_VERSION` — this is defence in depth, but it is not a substitute for the invariant above. Keep both.

## Test data

`docs/personas/anita/` contains a complete synthetic candidate. Use it for any end-to-end test that needs a full personalInfo object, photo, certificate PDFs, etc. Do not commit real candidate data.

## Deployment

`docs/deployment/cloudflare-setup.md` is the source of truth for how PWA and workers reach production. Read it before suggesting any deployment-related change.
