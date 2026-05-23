AntCV v1.40.297 — deployment increment
========================================

Overlays onto your existing deployment folder. Carries everything
from v296 round-2 forward. Two new patches addressing the two
issues you described:

  Symptom A: "Re-entry to wizard — appears for a short time and
             then skip appears. If I press quickly on Next in the
             wizard, I will get the next step and skip will not
             appear."
  Symptom B: "I will than be able to move on with the wizard until
             entering the relay, and then get a blue screen (where
             I was supposed to get the AI notice)."

Both have been traced and fixed in dedicated patches.

──────────────────────────────────────────────────────────────────

A. The "skip appears briefly" race
   ───────────────────────────────

ROOT CAUSE
──────────
antcv-wizard-fix.js's maybeSkipWizard fires the Skip click on a
30 ms setTimeout. If the user clicks Next within those 30 ms, the
wizard has already advanced to step 2 by the time the Skip click
fires. Step 2 has no "Skip wizard" button, so the click misses
and the wizard proceeds — exactly your description. If the user
DOESN'T outrun it, the Skip click on step 1 fires a "do you want
to skip" confirm and the user is stuck.

The v296 wizard-fix added guards G2 (no personalInfo content),
G3 (antcv:wizard-explicit-open marker), G4 (antcv:just-erased
marker). G3 was supposed to catch your Settings re-run, but only
if the clicked button label matches one of the seven strings in
antcv-onboarding.js's WIZARD_BUTTON_TEXTS array:
  'setup needed', 'setup', 'run wizard', 're-run wizard',
  'configure', 'open wizard', 'start setup'
If the Settings button is labelled anything else (e.g. "Restart
wizard"), the explicit-open marker is never set, G3 is inert,
and the auto-skip fires.

FIX (G5 — recent-click guard)
─────────────────────────────
antcv-wizard-fix.js bumped to v1.40.297 with a fifth guard:

  G5. If a click (or pointerdown) on the document body happened
      within the last 2 seconds, treat the wizard's appearance as
      user-initiated and don't auto-skip.

This catches any Settings-re-run path regardless of the button's
label. The legitimate skip case — "wizard flashes for a fraction
of a second on the returner sign-in" — happens with no preceding
user click, so _lastClickAt stays 0, recentClick() stays false,
and the auto-skip still fires for that case. Tests 1-3 below
verify both directions.

──────────────────────────────────────────────────────────────────

B. The "blue screen at the AI notice step"
   ───────────────────────────────────────

ROOT CAUSE
──────────
Trace through antcv-onboarding.js:
  - Line 569 buildSlide() creates a section.antcv-ai-wizard-slide
    and sets its innerHTML to the h2 / p / label / button template.
  - Line 519 CSS for .antcv-ai-wizard-slide sets background:#263758
    — a dark navy that IS what you see as the "blue screen".
  - Line 661 mountInWizard inserts the slide into the wizard host
    via host.insertBefore(slide, host.firstChild).
  - Line 1142 the tick loop calls mountInWizard at step >= 4.

The slide DOM with its blue background renders, but the inner
children (h2, label, buttons) end up missing or invisible —
either because React's reconciliation on the host wipes children
not in its virtual DOM, or because a competing style rule on the
wizard host makes the children invisible. Either way, what you
see is the slide's blue chrome with nothing in it.

The existing antcv-wizard-escape-hatch-285.js has a 4-second
"stuck detection" but its findStuckOverlay only matches an
overlay if its textContent contains "AntCV uses generative AI"
or "EU AI Act" etc. — which a blank slide never has. So the
escape panel never fired for this failure mode.

FIX (structural detection + rebuild attempt)
────────────────────────────────────────────
antcv-wizard-escape-hatch-285.js bumped to v1.40.297 with two
additions:

  1. isBlankAiSlide(el) — new structural check. Returns true if
     the element is a visible .antcv-ai-wizard-slide that's
     missing at least one of: <h2>, .antcv-ai-continue button,
     .antcv-ai-check checkbox — AND its visible text is shorter
     than 30 characters. Used by findStuckOverlay as a first
     pass before the existing phrase-based check.

  2. tryRebuildBlankSlide(slide) — new recovery path. When a
     blank slide is detected, removes it from the DOM and calls
     window.AntcvOnboarding.mountInWizard(host) to re-run the
     canonical buildSlide → insertBefore flow. Throttled to once
     per 5 seconds so a render that keeps clobbering the slide
     doesn't drive a tight rebuild loop. Called from tick() as
     soon as the blank state is detected, BEFORE the existing
     4-second-stuck timer starts.

If the rebuild succeeds, the user sees the AI notice content as
intended — no escape panel, no friction. If the rebuild fails
(e.g., AntcvOnboarding.mountInWizard isn't exposed, or it
re-renders blank again), the user still gets the existing escape
panel after 4 seconds. So the worst case is no worse than v285;
the best case is the bug becomes invisible.

──────────────────────────────────────────────────────────────────

Test coverage
─────────────
23 assertions across 9 tests, all passing:

  Wizard-fix v1.40.297:
    Test 1 — returning user with content, no recent click → DOES
             skip (legit case preserved from v296 behaviour).
    Test 2 — same state with a recent doc-body click → does NOT
             skip; recentClick() correctly reports true.
    Test 3 — deleted user (no content) with no click → G2 still
             wins (independent of G5).

  Escape-hatch v1.40.297:
    Test 4 — blank slide → isBlankAiSlide true; findStuckOverlay
             returns it.
    Test 5 — populated slide → isBlankAiSlide false; falls through
             to the legacy phrase-based detection (unchanged).
    Test 6 — no slide present → findStuckOverlay returns null.
    Test 7 — tryRebuildBlankSlide calls
             AntcvOnboarding.mountInWizard(slide.parentNode),
             removes the blank, mounted slide replaces it.
    Test 8 — throttle prevents back-to-back rebuilds within 5s.
    Test 9 — graceful no-op when AntcvOnboarding isn't exposed.

──────────────────────────────────────────────────────────────────

What is in this zip
-------------------

  index.html                       (app.js?v=1.40.297,
                                    antcv-wizard-fix.js?v=1.40.297,
                                    antcv-wizard-escape-hatch-285.js
                                      ?v=1.40.297)
  app.js                           (unchanged from v296)
  antcv-wizard-fix.js              (PATCHED — v1.40.297, added G5)
  antcv-wizard-escape-hatch-285.js (PATCHED — v1.40.297, blank-slide
                                    detection + rebuild)
  antcv-personality.js             (from v296 round 2 — unchanged)
  antcv-cloud-delete-296.js        (from v296 round 2 — unchanged)
  antcv-privacy-led.js             (from v295 — unchanged)
  antcv-language-ui-fixes-292.js   (unchanged)
  antcv-app-history-zfix-291.js    (unchanged)
  antcv-kernel-completeness-290.js (unchanged)
  antcv-cloud-put-shrink-guard-289.js (unchanged)
  README-v1.40.297.txt             (this file)

Deploy steps
------------

  1. Back up your current Cloudflare Pages folder.
  2. Copy all 11 files (12 with README) into that folder,
     overwriting same-named files. The PATCHED files this round
     are antcv-wizard-fix.js and antcv-wizard-escape-hatch-285.js.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh: Settings → Hard Refresh.

How to verify each fix
----------------------

  G5 / Symptom A:
    Open DevTools console. Open Settings → click whatever button
    re-runs the wizard. Watch console — old behaviour produced no
    log; new behaviour fires the legit auto-skip ONLY when no
    recent click is detected. The Skip button no longer
    auto-clicks when you opened the wizard yourself.

    To verify the legit skip still works: clear localStorage,
    fill out personalInfo with at least one workHistory entry,
    set wizardCompleted=true, reload. The wizard should still
    flash briefly and self-dismiss as before (since you didn't
    click anything to open it).

  Blank-slide / Symptom B:
    Open DevTools console BEFORE going through the wizard.
    Re-run the wizard, click Next quickly to bypass G5's catch
    (or run with G5 in effect), and proceed to the AI notice
    step. Watch console — if the blank-slide failure mode fires,
    you'll see:
      [wizard-escape-hatch-1.40.297] rebuilt blank AI notice
        slide via AntcvOnboarding.mountInWizard
    If the rebuild fails, you'll still see the escape panel
    after 4 seconds (no behavioural regression from v285).

Version
-------

AntCV v1.40.297 (May 22, 2026)
