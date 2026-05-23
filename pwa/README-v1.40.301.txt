AntCV v1.40.301 — deployment increment
========================================

Overlays onto v1.40.300. Two files change:
  • app.js                              (bundle version stamp → 1.40.301)
  • antcv-wizard-escape-hatch-285.js    (clear-on-uncheck added)

──────────────────────────────────────────────────────────────────

The fix
───────

When the user explicitly unticks the AI consent checkbox, the escape
hatch now clears all aiDisclosureAccepted writes:

  localStorage.aiDisclosureAccepted        → removed
  localStorage['antcv:aiDisclosureAccepted'] → removed
  localStorage.aiDisclosureAcceptedMeta    → removed
  personalInfo.aiDisclosureAccepted        → removed
  personalInfo.aiDisclosure                → removed
  personalInfo.disclosureAccepted          → removed
  personalInfo.<other fields>              → preserved
  dispatches antcv:ai-disclosure-withdrawn CustomEvent

Why this fix:
─────────────
Gabriel's report after v300: "I try to check off the AI agreement.
it blinks for a second and stays on." The checkbox would visibly
uncheck for a moment, then snap back to checked.

Root cause: as long as localStorage.aiDisclosureAccepted is set
(from a prior session), aiAccepted() returns true. The escape
hatch's enhanceAiSlideHandlers pre-ticks the checkbox at attach
time when aiAccepted is true (requirement 3 from v299). So whenever
ANYTHING re-renders the slide — React state churn, escape hatch
force-mount in tick() catching a momentarily-blank slide, the
canonical onboarding tickAiGate re-mounting — the new instance
gets pre-ticked. The user sees the visible uncheck (their click
took effect), then a re-render and pre-tick brings it back checked.

The fix breaks the cycle at its source: an explicit uncheck IS
withdrawal of consent. We clear the persistent record, so the
next pre-tick attempt sees aiAccepted()=false and leaves the box
empty. No more snap-back.

Programmatic vs user-initiated:
───────────────────────────────
The clear is wired to the checkbox's `change` event with the
resulting checked state === false. The `change` event does NOT
fire when JavaScript programmatically sets check.checked = true
(or false) — only on genuine user interaction. So:

  • Pre-tick at attach time (check.checked = true)
    → NO change event → NO clear → aiAccepted preserved
  • User unticks (click on checkbox or label)
    → change event fires with checked=false → clearAcceptedEverywhere
  • User re-ticks (click again)
    → change event with checked=true → no clear (only Continue
      click re-writes acceptance)

Semantic alignment:
───────────────────
This matches EU AI Act consent model: unticking the
acknowledgement IS withdrawal of consent. The next time the slide
appears, the user must re-tick + click Continue to record fresh
acceptance — which is the correct flow for a consent UI.

──────────────────────────────────────────────────────────────────

Test coverage
─────────────
25 assertions, 7 groups, all passing:

  A. clearAcceptedEverywhere covers all the keys that
     markAcceptedEverywhere writes (LS_KEY, LS_KEY_ALT,
     LS_META_KEY, three personalInfo flags), while preserving
     unrelated personalInfo fields like name.
  B. User-initiated uncheck via change event triggers the clear.
  C. Programmatic pre-tick at attach time does NOT trigger clear
     (the change event isn't fired for programmatic .checked sets).
  D. User re-ticks after unticking — no auto-reinstate of
     acceptance (only the Continue button click writes it).
  E. The snap-back scenario: after uncheck, simulate React
     destroying + force-mount rebuilding the slide. The new slide
     does NOT pre-tick (aiAccepted cleared), Continue starts
     disabled. Snap-back impossible.
  F. Re-tick + Continue click after withdrawal records fresh
     acceptance normally.
  G. Reversibility for fresh-session users (no prior accept)
     preserved — checkbox can be ticked and unticked freely with
     Continue tracking the state in both directions.

Earlier test suites still pass:
  • v299: 31/31 (checkbox+Continue robustness, skip-aware routing,
    pre-tick from prior acceptance)
  • v300: 25/25 (force-mount, narrow Next-button finder,
    startup-clear sidecar)
  • v301: 25/25 (clear-on-uncheck)

──────────────────────────────────────────────────────────────────

What's in this zip
──────────────────

  index.html                              (cache keys: app.js
                                           and wizard-escape-hatch
                                           bumped to 1.40.301)
  app.js                                  (PATCHED — version
                                           string 1.40.301)
  antcv-wizard-escape-hatch-285.js        (PATCHED — v1.40.301)
  antcv-wizard-startup-clear-300.js       (from v300 — unchanged)
  antcv-cloud-restore-filter-298.js       (from v298 — unchanged)
  antcv-wizard-fix.js                     (from v297 — unchanged)
  antcv-personality.js                    (from v296 — unchanged)
  antcv-cloud-delete-296.js               (unchanged)
  antcv-privacy-led.js                    (from v295 — unchanged)
  antcv-language-ui-fixes-292.js          (unchanged)
  antcv-app-history-zfix-291.js           (unchanged)
  antcv-kernel-completeness-290.js        (unchanged)
  antcv-cloud-put-shrink-guard-289.js     (unchanged)
  README-v1.40.301.txt                    (this file)

Deploy steps
────────────
  1. Back up your current Cloudflare Pages folder.
  2. Copy all 14 files (13 + README) into that folder.
  3. Push the Cloudflare Pages deployment.
  4. Settings → Hard Refresh.

How to verify the fix
─────────────────────
  1. Open the wizard (re-run from Settings if needed).
  2. Navigate to the AI notice. If you accepted previously, the
     checkbox should be pre-ticked.
  3. Tap the checkbox to uncheck. The check should disappear and
     STAY GONE (no blink-and-snap-back).
  4. Continue button should be disabled.
  5. Check DevTools console — you should see:
       [wizard-escape-hatch-1.40.301] AI consent cleared (user-untick)
  6. DevTools → Application → Local Storage — confirm
     aiDisclosureAccepted is absent.
  7. Re-tick → Continue → wizard advances normally; LS gets
     fresh aiDisclosureAccepted timestamp.

If the snap-back persists after deploying v301
──────────────────────────────────────────────
That would indicate the source of the re-tick is NOT the
pre-tick path in enhanceAiSlideHandlers. In that case capture:
  • DevTools console after unchecking (look for force-mount
    logs and any unexpected acceptance writes)
  • document.querySelectorAll('input[type="checkbox"]').length
    (if > 1, another component is rendering a duplicate)
  • localStorage.getItem('aiDisclosureAccepted') AFTER unchecking
    (if still set, something else is writing it back — likely a
    cloud-sync sidecar restoring from /api/prefs)

Version
───────
AntCV v1.40.301 (May 22, 2026)
