# Editing `app.js` safely — the de-minified source + the rebuild gate

`pwa/app.js` is the deployed application bundle: a single minified global-React
IIFE. The working bundle begins:

```
(()=>{const{useState:e,useRef:t,useCallback:n, …
```

`pwa/app.src.js` is its **de-minified, human-editable source**, committed alongside
it. Edit the source, never paste a throwaway beautified copy into `/tmp` again — that
source already exists and is committed.

## The hard rule (why this file exists)

> **A rebuilt `app.js` may NOT be deployed until it passes the identity round-trip
> gate below.**

This is not theoretical. On 2026-06-06, `npm run build:app` (esbuild `--minify`) was
used to ship a page-split engine change and it blue-screened the whole app on load
(bug `APPJS-BLUESCREEN-001`). The cause:

- The working bundle is **sloppy-mode**. esbuild's output begins
  `"use strict";(()=>{…` — it prepends a strict-mode directive. The original bundle
  relies on sloppy-mode semantics (implicit globals / `this` / non-strict assignment
  somewhere in the dependency closure), so under `"use strict"` it throws at boot.
- More generally: **the esbuild round-trip is not behaviour-preserving for this
  bundle.** It was not minified with esbuild originally, and we do not yet have the
  original toolchain/config.

So `npm run build:app` exists in `package.json`, but it is **known-unsafe today**.
Treat it as a candidate to be validated through the gate, not as a build step.

## The identity round-trip gate

Before any minifier/config is trusted to produce a deployable bundle, prove it is
behaviour-preserving on an **unedited** source:

1. Start from the committed, working `pwa/app.js` and `pwa/app.src.js` (same commit).
2. Rebuild the bundle from the **unchanged** `app.src.js` with the candidate config.
3. Compare the rebuilt bundle to the committed `app.js`. They will not be byte-equal;
   what must hold is **functional identity**:
   - load the rebuilt bundle in a real browser (Claude Chrome) — no blue screen,
     no console exception at boot;
   - `window.ANTCV_VERSION` resolves; the editor renders;
   - smoke the core flows: open CV + CL preview, type in a section, toggle a page
     break, run an export preview.
4. Only a config that passes step 3 on a clean source may be used to ship a real
   `app.src.js` edit. Re-run the gate after the real edit too.

A config that prepends `"use strict"` will fail step 3 here. Candidates worth testing
through the gate: **terser** (semantics-preserving defaults), or esbuild with the
strict directive suppressed / sloppy mode retained.

## Until a config passes the gate

For small, surgical fixes, prefer an **in-place edit of the minified `app.js`**
(unique string replacement, per the CLAUDE.md patch protocol), and mirror the same
change into `app.src.js` so the source stays a faithful de-minification. This avoids
the round-trip entirely. Reserve the full source→rebuild path for changes too large to
do by hand (e.g. ENGINE-PAGESPLIT-001), and gate it first.

## After any `app.js` change (cache-bust protocol)

1. Bump `app.js?v=` in `pwa/index.html`.
2. Bump `sw.js` `CACHE`.
3. Update `pwa/antcv-version-override.js` `TARGET_VERSION`; add the PREVIOUS version to
   `STALE_VERSIONS` (never the current one — see the STALE_VERSIONS invariant in
   `CLAUDE.md`).
4. Deploy PWA only via the controlled path (deploy.yml → deploy-pwa). One deployer at a
   time; no parallel deploys.

## Related

- `APPJS-REBUILD-001`, `APPJS-BLUESCREEN-001`, `ENGINE-PAGESPLIT-001` in
  `docs/qa/ACTIVE_BUGS.md`.
- `docs/plan/PB-007-two-column-pagination.md` — the engine design that this rebuild
  path unblocks.
