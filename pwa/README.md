# `pwa/` — the AntCV PWA

Static site for Cloudflare Pages. No build step; the source files at this directory ship as-is.

## Current build

**v1.40.336-version-grow-fix.** Fixes the version-string growth bug introduced by the previous build: `TARGET_VERSION` in `antcv-version-override.js` was being concatenated with `-hotfix-b` on every MutationObserver cycle because `1.40.335` was incorrectly added to `STALE_VERSIONS` (so the regex matched its own output). Now:

- `1.40.335` removed from `STALE_VERSIONS`.
- New idempotency guard in `rewriteTextNodes` skips nodes that already contain `TARGET_VERSION`.
- `TARGET_VERSION = '1.40.336-version-grow-fix'`.

Carries forward the four mechanical patches from v1.40.335-hotfix-b (language card collapsed default, `raiseSettings` modal guard, `forceRoute` TTL, importer modal z-index). See `README-v1.40.335-hotfix-b.txt` for the patch detail and the smoke-test checklist that still applies.

## Structure

```
pwa/
├── index.html              Entry. Long file with bootstrap shim, lazy-load
│                           wrappers, and the script-tag chain for all sidecars.
├── app.js                  Main React bundle. ~800 KB minified. Built externally.
├── app.js.bak              Removed before zip. Not committed.
├── manifest.json           PWA manifest.
├── sw.js                   Service worker. CACHE constant bumps per release.
├── icons/                  PWA icons + Anita placeholder.
├── antcv-*.js              The sidecar chain. Each handles one concern (top-bar,
│                           routing, validation, cloud sync, etc.). Loaded by
│                           index.html in document order; that order matters
│                           because some sidecars wrap window.fetch.
└── antcv-mobile-controls.css
```

## Deployment

See `docs/deployment/cloudflare-setup.md` (root of this repo).

```bash
cd pwa
wrangler pages deploy . --project-name=antcv --branch=main
```

## Editing rules

1. Always grep `index.html` for `<script src="..."` before touching any sidecar JS file. Several `antcv-*.js` files in this directory are present but **not loaded** (retired). Editing them is a no-op; you'll waste a hotfix slot.
2. After any change, bump the `?v=` query string on the changed file in `index.html` AND bump `sw.js` `CACHE`. Without both, browsers will serve the cached old copy.
3. `app.js` is the React bundle, built externally. Targeted string replacements inside it (e.g. CSS values, error messages) are allowed but high-risk. Diff against `app.js.bak` from the previous release before any non-trivial change.

## Versioning

`antcv-version-override.js` pins the displayed version. After bumping, also extend its `STALE_VERSIONS` array with every older version that should be silently rewritten in DOM text and console output.
