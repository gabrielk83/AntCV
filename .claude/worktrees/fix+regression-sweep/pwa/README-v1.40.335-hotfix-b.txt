AntCV PWA v1.40.335-hotfix-b (safe revert)
============================================
Base: v1.40.334-fixed
Date: 2026-05-23
Supersedes: v1.40.335-hotfix-mobile-wizard-importer (caused blue screen after AI notice)

What changed vs the first hotfix attempt
========================================
The first hotfix (v1.40.335) shipped eight patches; two of them caused
a regression where the wizard blue-screens after the AI notice instead
of advancing to the LLM model selector / import personal data step.

This safer rebuild reverts those two and keeps the four mechanical
fixes that have no risk of touching wizard rendering.

Patches kept
============
P1  antcv-stability-core-334.js:111   Languages card defaults to
                                       COLLAPSED on first entry to
                                       Settings -> Personal.
P2  antcv-stability-core-334.js:211   raiseSettings() exits early
                                       when a non-settings modal is
                                       open (importer, AI disclosure,
                                       portal modals). Prevents
                                       Settings burying child modals.
P3  antcv-stability-core-334.js:237   forceRoute() TTL shortened
                                       from 10s to 2s.
P4  antcv-data-importer.js:540        Import modal backdrop z-index
                                       bumped to 2147483300.

Patches reverted (compared to v1.40.335 first attempt)
======================================================
P5b  antcv-cloud-restore-filter-298.js   Was: eager fetch wrap.
                                          Reason for revert: the file
                                          loads at index.html line 842,
                                          BEFORE two other fetch-
                                          wrappers (cloud-put-shrink-
                                          guard at line 1118, kernel-
                                          completeness at line 1140).
                                          Wrapping eagerly puts cloud-
                                          restore-filter at the bottom
                                          of the chain. The DOMContent
                                          Loaded handler then wraps it
                                          again at the top. The filter
                                          ends up running TWICE over
                                          every /api/prefs response,
                                          and the second pass tries to
                                          reconstruct a Response from
                                          an immutable Headers object,
                                          which can throw. The throw
                                          poisons the wizard's cloud-
                                          restore step and React state
                                          ends up mid-transition ->
                                          blue screen on the next step.

P6b  app.js                               Was: AI notice host z-index
                                          2147482999 -> 2147483300.
                                          Reason for revert: the
                                          original 2147482999 is
                                          already higher than every
                                          other z-index in app.js
                                          (next is 99999) and the
                                          stability-core ramp only
                                          targets Settings, not the
                                          wizard. The bump was a fix
                                          for a non-issue. Reverting
                                          removes the change from the
                                          variable set during root-
                                          cause analysis.

Defensive patches retained (no effect; files not loaded)
========================================================
P5  antcv-onboarding.js                Defensive code added in case
                                       the file is re-enabled later.
                                       Currently no impact: file is
                                       not loaded by index.html in
                                       v1.40.334.
P6  antcv-ai-notice-stability.js       Defensive code added in case
                                       the file is re-enabled later.
                                       Currently no impact: file is
                                       not loaded by index.html in
                                       v1.40.334.

Known unresolved issues
=======================
1. AI notice on mobile may still not appear between steps in some
   cases. The defensive P6 patch addresses the now-disabled stability
   file. The actual live AI notice is inline in app.js and was
   already at z-index 2147482999, which is sufficient. If the notice
   still doesn't appear on mobile, the cause is elsewhere — paste
   the diagnostic from DIAGNOSE-blue-screen-and-ai-notice.txt into
   the DevTools console and send the output back.

2. Wizard re-flash on delete-and-re-login may still occur in some
   cases. The defensive P5 patch addresses the now-disabled
   onboarding file. The actual fix lives in cloud-restore-filter,
   which we deliberately left untouched in this rebuild to avoid
   the double-wrap bug. If the re-flash still occurs, the diagnostic
   text file in this zip captures the state needed to fix it
   correctly.

Smoke test (10 min)
===================
1. Sign in fresh (no cached service worker -> Application tab in
   DevTools -> Service Workers -> Unregister, then hard reload).
   Confirm version banner shows 1.40.335-hotfix-b.

2. Clear antcv:settings:languages-expanded in localStorage, reload,
   go Settings -> Personal.
   Expected: Languages section header visible, body collapsed.

3. Settings -> Import profile -> tap file input -> pick a JSON.
   Expected on mobile: native file picker opens, import proceeds,
   confirmation alert.

4. Open the wizard (Settings -> Restart onboarding wizard or
   equivalent). Walk through. The flow that previously blue-screened
   after the AI notice should now advance to the LLM model selector
   (or import personal data, per path).
   Expected: no blue screen.

5. Regression: top-bar languages, JD Analysis FAB on desktop,
   Application history -> Open in Settings, preview toolbar
   uniqueness.

If step 4 still blue-screens, paste DIAGNOSE-blue-screen-and-ai-
notice.txt into DevTools console and send the output back. That
output will identify the actual code path that crashes so the
next hotfix can target it precisely.

Deployment
==========
Cloudflare Pages: upload antcv-pwa-1_40_335-hotfix-b-safe-revert.zip.
Files at zip root, no nested folder.

Workers: untouched. No worker redeploy needed.

After deploy: hard refresh (Settings -> Hard Refresh, or DevTools
Application tab -> Clear site data) to evict the previous service
worker cache before testing.
