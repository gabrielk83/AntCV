AntCV v1.40.298 — deployment increment
========================================

Overlays onto your existing deployment folder. Addresses the
remaining items from your last test run:

  #1 "UI version not changing" — Bundle internal version string
     bumped from 1.40.173-scrubrole-fix (the upstream value the
     unpatched app.js carries) to 1.40.298-scrubrole-fix. You'll
     now see the right version in the wizard footer and in the
     [AntCV] boot console.log.

  #2 "Wizard does not appear for deleted user re-login" — Added
     a new sidecar antcv-cloud-restore-filter-298.js. It wraps
     fetch and strips wizardCompleted / wizard_completed /
     wizardComplete / onboardingCompleted from any GET /api/prefs
     response body whose personalInfo has NONE of the content
     arrays populated (workHistory, experience, education,
     publications, publicationsStructured, certifications,
     skills). When the cloud copy is "identity but no content",
     the bundle now sees no wizardCompleted flag and treats the
     user as fresh-start → wizard opens correctly.

     This is independent of the worker DELETE /api/prefs handler.
     If the worker DELETE eventually ships, the cloud copy will
     be empty on re-login and this filter becomes a harmless
     no-op. Until then, it's the client-side safety net.

  #3 "Re-run wizard no longer auto-skips" — your confirmation
     that G5 from v297 works. No change.

  #4 "Step 3 → 4 still blue screens" — Added a direct-innerHTML
     rebuild path in antcv-wizard-escape-hatch-285.js's
     tryRebuildBlankSlide. v297's rebuild only tried
     AntcvOnboarding.mountInWizard, which has a slideAlreadyMounted
     short-circuit that races with React renders. The new
     fallback writes the canonical buildSlide template directly
     to a fresh slide element when mountInWizard either isn't
     available or returns true without actually populating
     content. The rebuilt slide has its own click handlers wired
     (Continue → markAcceptedEverywhere + remove; Disagree →
     AntcvAuth.signOut; Disagree & Delete → AntcvOnboarding.
     deleteUser) so it works even if the canonical
     antcv-onboarding handlers never attach.

  #5 "Wizard appears stuck panel shows alongside a working AI
     notice" — Fixed in the escape hatch's hasReachableContinue.
     The original check required `!b.disabled` on the Continue
     button, but the AI notice slide deliberately disables
     Continue until the user ticks .antcv-ai-check. So every
     time the user landed on a perfectly-working AI notice and
     didn't tick the box within 4 seconds, the escape panel
     would pop up below — exactly what your Image 2 shows.
     hasReachableContinue now checks: if the overlay has BOTH
     a .antcv-ai-check checkbox AND a .antcv-ai-continue button
     that's laid out and visible (regardless of disabled state),
     the overlay is REACHABLE — the user just needs to tick the
     box. The 4-second stuck timer no longer starts, and the
     escape panel no longer appears alongside.

──────────────────────────────────────────────────────────────────

Files patched this round
------------------------

  app.js                              (PATCHED — Patch I:
                                       internal version string
                                       1.40.173 → 1.40.298)
  antcv-wizard-escape-hatch-285.js    (PATCHED — v1.40.298:
                                       hasReachableContinue
                                       checkbox-aware, direct-
                                       innerHTML rebuild fallback)
  antcv-cloud-restore-filter-298.js   (NEW — v1.40.298)
  index.html                          (cache keys bumped for
                                       app.js and the escape
                                       hatch, new script tag
                                       for the cloud-restore
                                       filter)

All other files unchanged from v297.

──────────────────────────────────────────────────────────────────

Test coverage
─────────────
34 assertions, all passing:

  A. Bundle version
     - bundle constant Ai="1.40.298-scrubrole-fix"
  B. hasReachableContinue checkbox case
     - escape hatch is v1.40.298
     - isBlankAiSlide false for populated slide
     - findStuckOverlay returns the populated slide
     - hasReachableContinue source contains the new AI check branch
     - check involves both .antcv-ai-check and .antcv-ai-continue
  C. Direct-innerHTML rebuild fallback
     - rebuild succeeds even with no AntcvOnboarding
     - new slide element present
     - canonical h2, continue button, check box all there
     - data-antcv-rebuilt-by marker set to escape-hatch-1.40.298
  D. mountInWizard short-circuit detected
     - rebuild falls through to direct-innerHTML when mountInWizard
       claims success but doesn't actually populate
     - final slide is the directly-rebuilt one with content
     - rebuild-by marker present
  E. Cloud-restore filter
     - filter installed at v1.40.298
     - empty personalInfo + wizardCompleted=true → stripped
     - personalInfo with workHistory → no strip
     - personalInfo.meta.wizardCompleted → stripped from meta
     - other meta fields preserved
     - isPrefsGet correctly recognises GET /api/prefs
     - PUT /api/prefs not a GET; other paths not prefs
     - hasContent narrow check across workHistory/empty/identity/null
     - antcv:disable-cloud-restore-filter escape hatch works

──────────────────────────────────────────────────────────────────

What is in this zip
-------------------

  index.html                              (cache keys updated)
  app.js                                  (PATCHED — version string)
  antcv-wizard-escape-hatch-285.js        (PATCHED — v1.40.298)
  antcv-cloud-restore-filter-298.js       (NEW — v1.40.298)
  antcv-wizard-fix.js                     (from v297 — unchanged)
  antcv-personality.js                    (from v296 — unchanged)
  antcv-cloud-delete-296.js               (unchanged)
  antcv-privacy-led.js                    (from v295 — unchanged)
  antcv-language-ui-fixes-292.js          (unchanged)
  antcv-app-history-zfix-291.js           (unchanged)
  antcv-kernel-completeness-290.js        (unchanged)
  antcv-cloud-put-shrink-guard-289.js     (unchanged)
  README-v1.40.298.txt                    (this file)

Deploy steps
------------

  1. Back up your current Cloudflare Pages folder.
  2. Copy all 12 files (13 with README) into that folder,
     overwriting same-named files. The NEW file is
     antcv-cloud-restore-filter-298.js. The PATCHED files this
     round are app.js and antcv-wizard-escape-hatch-285.js.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh: Settings → Hard Refresh.

How to verify each fix
----------------------

  Version (Image 1, footer):
    The wizard's welcome slide footer should now read
    "AntCV 1.40.298-scrubrole-fix" instead of 1.40.290. Console
    boot log should print "[AntCV] 1.40.298-scrubrole-fix".

  Deleted-user re-login:
    Click Disagree & Delete user → sign out → sign back in.
    DevTools console should print:
      [antcv-cloud-restore-filter-1.40.298] stripped wizardCompleted
        from cloud-restore response (no content; treating as fresh-start)
    Wizard should open at step 1.

  Blue screen at step 3 → 4:
    Re-run wizard, proceed past step 3. If the rebuild kicks in
    you'll see in console:
      [wizard-escape-hatch-1.40.298] rebuilt blank AI slide via
        direct innerHTML (fallback)
    The AI notice should appear with full content. Ticking the
    box and clicking Continue should advance the wizard. (If the
    AntcvOnboarding.mountInWizard route works first, you'll see
    its log message instead — either path is fine.)

  Escape panel + working AI notice:
    On the AI notice slide, wait 4+ seconds without ticking the
    box. The "AntCV wizard appears stuck" panel should NOT appear.
    Only when the slide is truly broken (no h2, no continue) does
    the escape panel fire.

Version
-------

AntCV v1.40.298 (May 22, 2026)
