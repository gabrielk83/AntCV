AntCV v1.40.302 — deployment increment
========================================

Overlays onto v1.40.301. Three patched sidecars + bundle version
stamp bumped.

──────────────────────────────────────────────────────────────────

The fix: post-deletion sign-in goes to wizard, not settings
──────────────────────────────────────────────────────────────

Gabriel's report: after logging in with Google (immediately
after deleting the user), the login menu appears for ~30 ms
then goes straight to the settings menu instead of opening the
wizard.

Root cause
──────────
The worker-side DELETE /api/prefs handler hasn't shipped yet
(deferred). So when the user deletes:

  1. antcv-cloud-delete-296 fires DELETE /api/prefs → worker
     returns 404/no-op. Cloud copy unchanged.
  2. Local fallback runs: localStorage.clear() +
     sessionStorage.clear() + reload.
  3. User signs in with Google.
  4. Bundle's cloud-restore fetches /api/prefs → server returns
     the OLD payload with wizardCompleted=true AND a fully
     populated personalInfo (workHistory, education, etc.).
  5. The v298 cloud-restore-filter sees content arrays are NOT
     empty → does NOT strip wizardCompleted.
  6. Bundle's post-cloud-restore gate at app.js byte ~217359
     reads wizardCompleted=true → closes wizard → settings menu.

The v300 startup-clear also doesn't help here because its
content check also sees the restored content from cloud.

The fix
───────
The signal "user just deleted" needs to survive:
  - localStorage.clear()
  - sessionStorage.clear()
  - a hard page reload
  - the Google OAuth same-tab redirect

The only thing that survives all four is a cookie. v302 wires
one in:

  • antcv-cloud-delete-296 (v1.40.302): sets cookie
      antcv-just-deleted=<timestamp>; max-age=86400; path=/;
        samesite=lax
    in setPostDeleteMarker() BEFORE the localStorage.clear()
    fallback. 24 h max-age covers the normal delete → re-login
    window comfortably.

  • antcv-cloud-restore-filter-298 (v1.40.302): new override.
    When the cookie is set, strip wizardCompleted from the GET
    /api/prefs response REGARDLESS of whether content is
    present. The filter also wipes any local wizardCompleted
    that may have been written before it could intercept (belt
    and braces), then deletes the cookie (one-shot signal).

  • antcv-wizard-startup-clear-300 (v1.40.302): new override
    branch in maybeClear(). On synchronous page-load (which
    runs BEFORE the bundle's React useEffect reads wizard
    state), if the cookie is set, clear all wizardCompleted
    aliases (including wizard_completed, wizardComplete,
    onboardingCompleted, onboarding_completed) regardless of
    content or real-completion marker. Cookie cleared after
    acting.

Result: after deletion + sign-in, both sidecars cooperate to
make sure localStorage has no wizardCompleted by the time the
bundle's gate at byte 217359 reads it → wizard opens.

──────────────────────────────────────────────────────────────────

Three lines of defence (any one of which is sufficient)
───────────────────────────────────────────────────────

  1. Sync page-load path (startup-clear):
     Cookie set + wizardCompleted set in LS → cleared at script
     load, BEFORE the bundle reads it.

  2. Async cloud-restore path (restore-filter):
     /api/prefs GET fires after sign-in → response body
     stripped, local wizardCompleted aliases also cleared.

  3. Cookie auto-expiry:
     If the user does nothing for 24 h, the browser drops the
     cookie. No state pollution beyond a day.

──────────────────────────────────────────────────────────────────

Test coverage
─────────────
v302: 28 assertions, 8 groups, all passing:

  A. cloud-delete writes the antcv-just-deleted cookie with
     path=/ and max-age, and is now v1.40.302.
  B. cloud-restore-filter has the cookie-override branch,
     wipes local wizardCompleted after strip, and clears the
     cookie one-shot.
  C. startup-clear has the cookie-override branch and the
     justDeletedRecent helper.
  D. Runtime: cookie present + wizardCompleted=true + content
     populated → maybeClear() returns true and clears
     wizardCompleted (proving the override bypasses content
     check). Cookie cleared after.
  E. WITHOUT cookie + content present → does NOT clear
     (v300 behaviour preserved).
  F. WITHOUT cookie + no content → still clears (v300 fresh-
     start path preserved).
  G. Cookie with timestamp >24 h old → justDeletedRecent()
     returns false (handles clock skew / leftover cookies).
  H. All five wizardCompleted aliases cleared on deletion
     override.

Earlier suites still pass:
  v299: 31/31 (AI notice slide behaviour)
  v300: 25/25 (force-mount, narrow Next-button, startup-clear)
  v301: 25/25 (clear-on-uncheck)
  v302: 28/28 (this release)
  Total: 109 / 109

──────────────────────────────────────────────────────────────────

What's in this zip
──────────────────

  index.html                              (cache keys for app.js,
                                           cloud-delete-296,
                                           cloud-restore-filter-298,
                                           wizard-startup-clear-300
                                           all bumped to 1.40.302)
  app.js                                  (PATCHED — version
                                           string 1.40.302)
  antcv-cloud-delete-296.js               (PATCHED — v1.40.302)
  antcv-cloud-restore-filter-298.js       (PATCHED — v1.40.302)
  antcv-wizard-startup-clear-300.js       (PATCHED — v1.40.302)
  antcv-wizard-escape-hatch-285.js        (from v301 — unchanged)
  antcv-wizard-fix.js                     (from v297 — unchanged)
  antcv-personality.js                    (from v296 — unchanged)
  antcv-privacy-led.js                    (from v295 — unchanged)
  antcv-language-ui-fixes-292.js          (unchanged)
  antcv-app-history-zfix-291.js           (unchanged)
  antcv-kernel-completeness-290.js        (unchanged)
  antcv-cloud-put-shrink-guard-289.js     (unchanged)
  README-v1.40.302.txt                    (this file)

Deploy
──────
  1. Back up your current Cloudflare Pages folder.
  2. Copy all 14 files into the folder, overwriting same-names.
  3. Push the deployment.
  4. Settings → Hard Refresh.

How to verify
─────────────

  1. Open the app. Sign in if not already.
  2. Trigger the AI notice (e.g., Settings → re-run wizard).
  3. Click "Disagree & Delete user". Page should reload.
  4. Check DevTools → Application → Cookies → look for
       antcv-just-deleted=<timestamp>
     This should be set with path=/ and a max-age of 86400.
  5. Sign in with Google again.
  6. Wizard should open at step 1 (NOT settings menu).
  7. DevTools console should show ONE of:
       [antcv-wizard-startup-clear-1.40.302] cleared local
         wizardCompleted (antcv-just-deleted cookie set
         (post-deletion sign-in)) ...
     OR
       [antcv-cloud-restore-filter-1.40.302] stripped
         wizardCompleted from cloud-restore response
         (antcv-just-deleted cookie set)
  8. Cookie should be auto-cleared after the strip
     (one-shot signal).

Escape hatches
──────────────
If anything misbehaves, these localStorage flags disable the
sidecars individually:
  antcv:disable-wizard-startup-clear     = '1'
  antcv:disable-cloud-restore-filter     = '1'
  antcv:disable-cloud-delete             = '1'
You can manually clear the cookie too:
  document.cookie = 'antcv-just-deleted=; max-age=0; path=/'

Pending server-side
───────────────────
Worker-side DELETE /api/prefs handler is still the canonical
fix. Once shipped, the cookie-based workaround becomes
redundant but stays in place as defence-in-depth.

Version
───────
AntCV v1.40.302 (May 22, 2026)
