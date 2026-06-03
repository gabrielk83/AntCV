AntCV PWA v1.40.336-version-grow-fix
=====================================
Base: v1.40.335-hotfix-b
Date: 2026-05-23

Why this exists
===============
The previous build (v1.40.335-hotfix-b) shipped with a regression in
antcv-version-override.js. The displayed version on the landing page
grew with each MutationObserver tick:

  1.40.335-hotfix-b
  1.40.335-hotfix-b-hotfix-b
  1.40.335-hotfix-b-hotfix-b-hotfix-b
  ... (continued indefinitely)

Root cause: when I bumped TARGET_VERSION to '1.40.335-hotfix-b', I also
added '1.40.335' to STALE_VERSIONS. The script's regex matches stale
versions and replaces them with TARGET_VERSION. Once the DOM contained
'1.40.335-hotfix-b-language-topbar-accordion-fix', the regex matched
'1.40.335' again, replaced it with '1.40.335-hotfix-b', and the text
became '1.40.335-hotfix-b-hotfix-b-...'. The MutationObserver watched
characterData and re-fired the script on every text change, so the
loop ran every animation frame.

The script also had no idempotency check — it never asked "does this
node already contain TARGET_VERSION?".

Fix
===
Three changes in antcv-version-override.js:

1. STALE_VERSIONS no longer contains '1.40.335'. The invariant is now
   documented in a comment in the file: never add the current
   TARGET_VERSION to STALE_VERSIONS.

2. New idempotency guard in rewriteTextNodes:
     if (node.nodeValue.indexOf(TARGET_VERSION) !== -1) continue;
   This stops the loop even if the invariant above is violated by
   accident in a future bump.

3. TARGET_VERSION bumped to '1.40.336-version-grow-fix' so the
   service-worker cache invalidates and clients see the change took
   effect.

Carried forward from v1.40.335-hotfix-b
=======================================
All four mechanical patches from the previous safe-revert build are
still in place:

P1  antcv-stability-core-334.js:111   Languages card defaults collapsed
P2  antcv-stability-core-334.js:211   raiseSettings modal guard
P3  antcv-stability-core-334.js:237   forceRoute TTL 10s -> 2s
P4  antcv-data-importer.js:540        Import modal backdrop z-index

app.js and antcv-cloud-restore-filter-298.js remain byte-identical to
v1.40.334-fixed (P5b and P6b were reverted in hotfix-b and stay
reverted here).

Deployment
==========
Cloudflare Pages: upload antcv-pwa-1_40_336-version-grow-fix.zip.
Files at zip root, no nested folder.

After deploy:
1. Hard-refresh (or DevTools -> Application -> Clear site data) to
   evict the v1.40.335-hotfix-b service worker cache.
2. Confirm the landing page shows 'AntCV 1.40.336-version-grow-fix-
   language-topbar-accordion-fix' (one suffix, not many).
3. Wait 60 seconds with the page open. The version string should not
   grow. If it does, the cache wasn't evicted; force a fresh load.

Workers: untouched. No worker redeploy needed.

Known unresolved issues (carried)
=================================
- AI notice on mobile may still not appear between wizard steps. The
  defensive patch in v1.40.335-hotfix targeted a dead file; the live
  fix is still pending diagnosis. See
  DIAGNOSE-blue-screen-and-ai-notice.txt for the console probe.
- Wizard re-flash on delete-and-relogin may still occur in some cases.
  Same situation — the proper fix needs the cloud-restore-filter
  changes from the proposed v1.50 Pass 3.
