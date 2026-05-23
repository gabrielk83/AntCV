AntCV v1.40.300 — deployment increment
========================================

Overlays onto your existing deployment folder. One NEW sidecar
(antcv-wizard-startup-clear-300.js), one patched sidecar
(antcv-wizard-escape-hatch-285.js bumped to 1.40.300), and the
bundle's internal version stamp bumped. All earlier increments
carried forward.

──────────────────────────────────────────────────────────────────

Three issues from Gabriel's v299 test → three fixes
─────────────────────────────────────────────────────

ISSUE A — "If I am in the wizard and move from step 3 by pressing
          next, AI notice MUST appear, even if it was checked
          before."

What was happening: the canonical onboarding tick (tickAiGate in
antcv-onboarding.js line 1115) mounts the AI notice when the
visible wizard step >= 4, regardless of aiAccepted. But its
slideShownInThisRun flag could be sticky from earlier in the run,
suppressing the mount on the step 3 → step 4 transition. Result:
nothing appears.

Fix in v300 (antcv-wizard-escape-hatch-285.js):
The tick() loop in the escape hatch (every 1 second) now does
two extra things BEFORE the legacy aiAccepted early-return:
  (i)  enhances handlers on any visible .antcv-ai-wizard-slide
       (so the v299 enhancement isn't skipped just because AI
       was accepted previously)
  (ii) reads the current wizard step via getCurrentWizardStep
       (mirrors antcv-onboarding's findVisibleStepNumberElement
       regex /^(?:STEP|Step|step)\s+(\d+)(?:\s+of\s+\d+)?$/) and,
       if step >= 4 with no visible AI slide, force-mounts one.
       Uses AntcvOnboarding.mountInWizard first, falls back to
       the directInnerHTMLRebuild path from v298.

The slide arrives pre-ticked (via the v299 enhanceAiSlideHandlers
pre-tick branch that reads aiAccepted), so a returning user who
already accepted just clicks Continue once and proceeds.

──────────────────────────────────────────────────────────────────

ISSUE B — "If I press Continue in the AI notice I still get blue
          screen instead of either step 4 of the wizard or set
          menu."

What was happening: my v299 Continue routing called
findNextLikeButtonGlobal to click the wizard's Next button after
removing the AI notice. The regex matched 'save' too. The
bundle's "Add LLM API keys" step (f=3 in the bundle, labeled
"Step 4 of N") renders multiple per-provider "Save key" buttons
ABOVE the wizard's actual "Next →" button. DOM order put a Save
button first → my function clicked Save → wizard didn't advance
→ user saw the (now removed) AI notice's host area, which on
"Add LLM API keys" still has the dark navy backdrop → looked
like a blue screen.

Fix in v300 (antcv-wizard-escape-hatch-285.js):
findNextLikeButtonGlobal is now two-pass:
  Pass 1: arrow-bearing wizard nav buttons only. Regex
          /^(next|continue|done|get\s+started)\b.*[→>]/. The
          bundle always renders its wizard nav with the arrow,
          so this is a clean signal.
  Pass 2 (fallback): plain "next"/"continue"/"done"/"finish"/
          "get started" without "save", "skip", or "back" in the
          label. Catches any wizard step where the arrow style
          differs.

The "Save key" buttons no longer match either pass. The wizard
advances on the right click.

(If the blue screen persists after this fix, the issue is
upstream in the bundle's step rendering — please send a console
log + screenshot and we'll trace from there.)

──────────────────────────────────────────────────────────────────

ISSUE C — "Wizard does not appear when user who did not complete
          the wizard signs in."

Gabriel's own diagnosis: "the approval that user completed a
wizard is not properly defined." Correct — and the root cause is
in the BUNDLE, not the sidecars.

What was happening: the bundle's Skip-wizard handler (app.js
around byte 535400) does:
  u.set("wizardCompleted", true);  // local
  try { Qn({ wizardCompleted: true }); } catch (e) {}  // cloud
  yn(false);  // close wizard
  xn(0);
So a user who clicks Skip — even without entering anything —
persists wizardCompleted=true locally AND in the cloud. On the
next sign-in, the bundle's gates at byte 210050 (initial useEffect)
and byte 217359 (post-cloud-restore useEffect) both honour
localStorage.wizardCompleted and keep the wizard closed. The
wizard is gone forever, even though the user never actually
filled in anything.

Fix in v300: NEW sidecar antcv-wizard-startup-clear-300.js,
loaded SYNCHRONOUSLY (no defer) in <head> immediately after the
React UMD scripts, so it runs before the bundle's React.useEffect
gates fire. The sidecar applies the same "no content == not
completed" criterion that the v298 cloud-restore filter applies
to the cloud payload, but applies it to LOCAL storage at boot:

  IF localStorage.wizardCompleted === truthy AND
     personalInfo has none of the content arrays populated
     (workHistory, experience, education, publications,
     publicationsStructured, certifications, skills) AND
     no antcv:wizard-real-completion marker is set
  THEN remove localStorage.wizardCompleted
       AND remove localStorage['antcv:wizardCompleted']

Combined with the v298 cloud-restore filter, this gives:
  - User skipped before with no content → both local AND cloud
    flags are cleared/filtered → bundle re-evaluates and opens
    wizard. ✓
  - User truly completed (has content) → local AND cloud
    wizardCompleted preserved → bundle keeps wizard closed. ✓
  - User mid-wizard with partial content → cloud might not have
    wizardCompleted yet; local is whatever it was; nothing
    inappropriate happens.

Escape hatch:
  localStorage['antcv:disable-wizard-startup-clear'] = '1'
reverts to bundle-only behaviour.

──────────────────────────────────────────────────────────────────

What ABOUT a user who really intends to skip permanently?
─────────────────────────────────────────────────────────
The "no content == reopen wizard" rule means a user who skips
and never adds content will see the wizard again on every
sign-in. That's the right default: skipping was probably a
"let me dismiss this for now" gesture, not a "never show this
again" commitment. The user can always dismiss it again.

A future patch could add a "Don't show this again" checkbox to
the wizard's welcome slide that sets
antcv:wizard-real-completion = timestamp. Until then, real
completion (going through the wizard's content steps and
clicking Finish on the last step) is the signal the system
relies on, AND there is no way to mark "real completion" without
real content.

──────────────────────────────────────────────────────────────────

Test coverage (v300)
────────────────────
25 NEW assertions, all passing:

  A1-A5  — findNextLikeButtonGlobal (new narrowed matcher)
    A1: API-keys step with Save + Next → returns Next →
    A2: only Save buttons → returns null
    A3: Continue → wins over Skip →
    A4: plain "Next" without arrow still matches via fallback
    A5: disabled "Next →" is skipped

  B      — getCurrentWizardStep
    reads "Step 4" → returns 4
    reads "STEP 3 of 10" → returns 3
    returns null when no step label visible

  C1-C6  — antcv-wizard-startup-clear-300.js
    C1: wizardCompleted=true + no content → cleared
    C2: wizardCompleted=true + has content → preserved
    C3: wizardCompleted=false → no-op
    C4: real-completion marker → preserved
    C5: escape hatch disables behaviour
    C6: antcv:wizardCompleted alias also cleared

Plus all 30 v299 behavioural assertions still pass (the only
v299 assertion that "fails" is the version-stamp check, which
now correctly reports 1.40.300).

──────────────────────────────────────────────────────────────────

What's in this zip
──────────────────

  index.html                              (PATCHED — startup-clear
                                           wired into <head> + cache
                                           keys bumped)
  app.js                                  (PATCHED — version stamp
                                           1.40.300)
  antcv-wizard-startup-clear-300.js       (NEW)
  antcv-wizard-escape-hatch-285.js        (PATCHED — v1.40.300)
  antcv-cloud-restore-filter-298.js       (from v298 — unchanged)
  antcv-wizard-fix.js                     (from v297 — unchanged)
  antcv-personality.js                    (from v296 — unchanged)
  antcv-cloud-delete-296.js               (unchanged)
  antcv-privacy-led.js                    (from v295 — unchanged)
  antcv-language-ui-fixes-292.js          (unchanged)
  antcv-app-history-zfix-291.js           (unchanged)
  antcv-kernel-completeness-290.js        (unchanged)
  antcv-cloud-put-shrink-guard-289.js     (unchanged)
  README-v1.40.300.txt                    (this file)

Deploy steps
────────────

  1. Back up your current Cloudflare Pages folder.
  2. Copy all 13 files into that folder, overwriting same-named
     files. NEW file this round is
     antcv-wizard-startup-clear-300.js. PATCHED files are
     index.html, app.js, and antcv-wizard-escape-hatch-285.js.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh on device: Settings → Hard Refresh.

──────────────────────────────────────────────────────────────────

How to verify each fix
──────────────────────

(A) AI notice on step 3 → Next:
    Open a clean wizard run. Reach step 3 (Paste your Worker URL),
    fill it in, click Next →. The AI notice appears immediately.
    Console: [wizard-escape-hatch-1.40.300] force-mounted AI
             notice at wizard step 4
    (May come from canonical onboarding first, in which case our
    force-mount is a no-op — fine either way.)

(B) Continue → step 4 / settings:
    On AI notice with checkbox ticked, click Continue. If you
    weren't previously skipped: wizard advances to step 5 "Test
    the connection" (or step 4 "Add LLM API keys" if coming from
    further back). If you were previously skipped: page reloads
    and lands on the main app.
    Console (not-skipped): [wizard-escape-hatch-1.40.300] AI
                           notice accepted; clicking wizard Next
                           to advance to step 4
    Console (skipped):     [wizard-escape-hatch-1.40.300] AI
                           notice accepted after skip; closing
                           wizard and returning to main app

(C) Wizard reappears for non-completing user:
    Sign in, skip wizard at step 1 (or anywhere), accept AI
    notice. App settles. Now sign out and sign back in. Wizard
    should auto-open.
    Console:  [antcv-wizard-startup-clear-1.40.300] cleared
              local wizardCompleted (no content, no real-
              completion marker) so the bundle's gates re-open
              the wizard for fresh-start

If a verification step fails, send the exact console output and
the precise step you were on — much easier to trace than the
symptom alone.

──────────────────────────────────────────────────────────────────

Version
───────

AntCV v1.40.300 (May 22, 2026)
