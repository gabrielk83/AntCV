AntCV v1.40.299 — deployment increment
========================================

Overlays onto your existing deployment folder. One patched file
(antcv-wizard-escape-hatch-285.js) and the bundle's internal
version stamp bumped. Carries all earlier increments forward.

This release locks in five explicit behaviours on the AI notice
slide, all wired through a single new function
enhanceAiSlideHandlers(slide) that runs idempotently on every
.antcv-ai-wizard-slide it encounters (canonical OR rebuilt via
the v298 directInnerHTMLRebuild path).

──────────────────────────────────────────────────────────────────

The five behaviours
───────────────────

  1. Click the checkbox → Continue enables.
     enhanceAiSlideHandlers attaches change, input, click, and a
     label-click handler (with setTimeout(0) re-sync so label-
     click ordering across browsers / Samsung Internet doesn't
     leave Continue in a stale state). Each handler re-queries
     the slide for the Continue button rather than closing over
     a stale reference, so the post-clone button stays in sync.

  2. Untick the checkbox → Continue re-disables.
     Same handlers cover both directions. The sync function reads
     the checkbox state at call time, not at attach time, so
     toggling either way produces the matching button state.

  3. Checkbox arrives pre-ticked when a previous session already
     accepted. If localStorage 'aiDisclosureAccepted' (or its
     alias 'antcv:ai-disclosure-accepted', or
     personalInfo.aiDisclosureAccepted) is set, the checkbox is
     pre-ticked at attach time AND Continue is pre-enabled. The
     user doesn't have to re-acknowledge anything; one click on
     Continue advances them.

  4. Click Continue when wizardSkipped flag is NOT set → advance
     wizard to step 4. enhanceAiSlideHandlers replaces the
     canonical buildSlide Continue handler (via cloneNode strip)
     and substitutes its own routing: markAcceptedEverywhere →
     remove slide → setTimeout 80 ms → find any visible
     Next/Continue/Done/Save button OUTSIDE the AI slide → click
     it. That advances the wizard's own state past the relay
     step into step 4.

  5. Click Continue when wizardSkipped flag IS set → exit wizard
     to settings / main app. The skipped flag is checked across
     four legacy keys ('antcv:wizardSkipped', 'wizardSkipped',
     'antcv:onboarding:skipped', 'antcv:wizard:skipped') in both
     localStorage and sessionStorage — same logic as
     antcv-onboarding.js's own wizardWasExplicitlySkipped at
     line 292-299. When the flag is set: markWizardCompleted →
     dispatch synthetic storage event for wizardCompleted (so
     React's useEffect can react to it without a full reload) →
     setTimeout 250 ms → location.reload as a robust fallback.

──────────────────────────────────────────────────────────────────

Why a sidecar at all
────────────────────
The canonical buildSlide handler in antcv-onboarding.js (line
619) already does (1) and (3) but not (2) reliably on mobile
touch, and it has no awareness of the wizardSkipped flag — it
always tries to advance the wizard (which is wrong for case 5).
Doing this in a sidecar means no edits to the upstream
onboarding script, and the same enhancement layer applies to
both canonical slides AND the rebuilt slide produced by the
v298 directInnerHTMLRebuild fallback.

The clone-and-replace pattern for the Continue button strips
the canonical capture-phase click handler, so only the new
routing logic runs. The checkbox handlers are additive — the
canonical change handler (if it ever attaches) and the new
handlers both fire, but they do the same work so duplication
is harmless.

──────────────────────────────────────────────────────────────────

Test coverage
─────────────
31 assertions across 9 test groups, all passing:

  Test 1   — checkbox tick enables Continue
  Test 1b  — checkbox untick disables Continue (NEW for req. 2)
  Test 1c  — label click toggles correctly
  Test 1d  — previous-session aiAccepted pre-ticks checkbox AND
             pre-enables Continue (NEW for req. 3)
  Test 2   — idempotency: second enhance call returns false,
             no double-clone
  Test 3   — Continue click WITHOUT prior skip → clicks Next
             button in wizard (req. 4)
  Test 4   — Continue click WITH prior skip → marks completed +
             reloads (req. 5)
  Test 5   — sessionStorage-only skip marker also counts
  Test 6   — three legacy keys (wizardSkipped, antcv:onboarding:
             skipped, antcv:wizard:skipped) all honoured
  Test 7   — Continue click with unchecked box is a no-op
  Test 8   — data-antcv-handlers-enhanced marker present after
             enhance
  Test 9   — enhancement works on directInnerHTMLRebuild output
             (the rebuild path from v298)

──────────────────────────────────────────────────────────────────

What's in this zip
──────────────────

  index.html                              (cache keys updated)
  app.js                                  (PATCHED — version
                                           string 1.40.299)
  antcv-wizard-escape-hatch-285.js        (PATCHED — v1.40.299)
  antcv-cloud-restore-filter-298.js       (from v298 — unchanged)
  antcv-wizard-fix.js                     (from v297 — unchanged)
  antcv-personality.js                    (from v296 — unchanged)
  antcv-cloud-delete-296.js               (unchanged)
  antcv-privacy-led.js                    (from v295 — unchanged)
  antcv-language-ui-fixes-292.js          (unchanged)
  antcv-app-history-zfix-291.js           (unchanged)
  antcv-kernel-completeness-290.js        (unchanged)
  antcv-cloud-put-shrink-guard-289.js     (unchanged)
  README-v1.40.299.txt                    (this file)

Deploy steps
────────────

  1. Back up your current Cloudflare Pages folder.
  2. Copy all 12 files (13 with README) into that folder,
     overwriting same-named files. PATCHED files this round are
     app.js and antcv-wizard-escape-hatch-285.js.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh: Settings → Hard Refresh.

How to verify each behaviour
────────────────────────────

  (1) Checkbox tick enables Continue:
      Open wizard fresh (no prior accept). Reach AI notice.
      Tap the checkbox. Continue button transitions from grey
      to teal. DevTools: cont.disabled === false.

  (2) Checkbox untick disables Continue:
      With Continue enabled, untap the checkbox. Continue
      transitions back to grey.

  (3) Pre-ticked from previous session:
      Accept once. Reload the page. Trigger the AI notice via
      Settings → re-run wizard. The checkbox arrives ticked and
      Continue is teal immediately. No second click on the
      checkbox needed.

  (4) Continue without prior skip → step 4:
      Run wizard from step 1, click Next each step. At AI
      notice, tick + Continue. Wizard advances. Console:
        [wizard-escape-hatch-1.40.299] AI notice accepted;
          clicking wizard Next to advance to step 4

  (5) Continue with prior skip → exit:
      Open wizard, click Skip. AI notice appears (it's required).
      Tick + Continue. Console:
        [wizard-escape-hatch-1.40.299] AI notice accepted after
          skip; closing wizard and returning to main app
      Page reloads ~250 ms later. Wizard does NOT reopen
      (wizardCompleted now set).

Version
───────

AntCV v1.40.299 (May 22, 2026)
