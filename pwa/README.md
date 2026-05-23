# `pwa/` — the AntCV PWA

Static site for Cloudflare Pages. No build step; the source files at this directory ship as-is.

## Current build

**v1.40.337-ai-notice-fix.** Fixes a wizard freeze on the worker URL step (own path). Pressing Next on vn=2 always routes through the AI notice on the way to vn=3. The notice's guard `if (document.querySelector('.antcv-ai-notice-host')) return;` was silently bailing whenever a stale host node was left in the DOM from a previous interaction, locking the wizard.

Three changes:

- `app.js`: replace the orphan-bail with orphan-removal — any stale `.antcv-ai-notice-host` nodes are removed and a fresh notice is injected.
- `app.js`: AI notice z-index bumped from `2147482999` to `2147483300` (above the stability-core Settings ramp at `2147483200`).
- `antcv-stability-core-334.js`: `.antcv-ai-notice-host` added to the `nonSettingsModalOpen()` selector so a visible AI notice suppresses the Settings z-index ramp.

Carries forward: the version-grow-fix from v1.40.336 (STALE_VERSIONS hygiene + idempotency guard) and the four mechanical patches from v1.40.335-hotfix-b (language card collapsed default, `raiseSettings` modal guard, `forceRoute` TTL, importer modal z-index). See `README-v1.40.337-ai-notice-fix.txt` for the diagnosis trail and post-deploy verification.

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
