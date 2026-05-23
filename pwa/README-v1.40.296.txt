AntCV v1.40.296 (round 2) — deployment increment
==================================================

Overlays onto your existing deployment folder. Carries forward the
v296 wizard-fix patch from the previous round and adds two new
items:

  1. DELETE /api/prefs on user-delete (new sidecar
     antcv-cloud-delete-296.js).
  2. The 9× forceRebuild storage:personalInfo loop traced + fixed
     (antcv-personality.js bumped from v1.40.7 to v1.40.296).

──────────────────────────────────────────────────────────────────

1. Cloud DELETE on user-delete
   ─────────────────────────────

The existing deletion flow (deleteUserFully in antcv-onboarding.js
line 555) called window.AntcvFullErase or fell back to
AntcvAuth.signOut, but NEITHER step wiped the cloud copy at
/api/prefs. The cloud-put-shrink-guard-289 (correctly!) refused to
forward empty-personalInfo PUTs to prevent accidental wipes, so
once the local was clear the cloud copy survived. Next sign-in's
cloud-restore brought back the old data with wizardCompleted=true
and the user appeared un-deleted.

The new sidecar (antcv-cloud-delete-296.js, ~7 KB) installs three
layered wraps at boot, polling for up to 30 seconds for each entry
point to appear:

  - window.AntcvFullErase  → DELETE first, then call original.
  - window.AntcvAuth.signOut → DELETE first IF
    sessionStorage.antcv:ai-disclosure-declined-delete was set
    within the last 5 seconds (set synchronously by
    deleteUserFully before signOut). Normal sign-out is unaffected.
  - window.AntcvOnboarding.deleteUser → DELETE first, then original.

Each wrap sets sessionStorage.antcv:just-erased before firing so
the v296 wizard-fix G4 guard and the onboarding's post-delete UX
both react correctly to the same-session deletion state.

The relay base URL is discovered the same way other sidecars do:
read localStorage.proxyUrl or .relayUrl, fall back to
window.ANTCV_RELAY_URL. No hardcoding.

DELETE is fired with credentials:'include', method:'DELETE'. The
fetch chain is unchanged (cloud-put-shrink-guard only guards PUTs;
DELETE passes through; antcv-auth adds the bearer token via its
existing fetch wrap).

Eight-second AbortController timeout protects against a stuck
worker — if DELETE doesn't return in 8s, the local erase + reload
proceeds anyway.

   *** WORKER-SIDE REQUIREMENT ***
   The relay worker must implement DELETE /api/prefs to actually
   wipe the cloud record. If it returns 404 or 405, the sidecar
   logs a warning and the local erase still runs, but the cloud
   copy persists. This is the same end state as v295 — no worse.
   To make deletion end-to-end, add to the worker:

     DELETE /api/prefs
       Auth: bearer token (same as PUT /api/prefs)
       Action: delete the authenticated user's full prefs record
       Response: 200 OK or 204 No Content

   The wrap is forward-compatible: once the worker supports DELETE,
   the existing deployment "just works" — no further client changes.

Escape hatch: localStorage['antcv:disable-cloud-delete'] = '1'
restores v1.40.295 behaviour (no DELETE; local-only).

──────────────────────────────────────────────────────────────────

2. 9× forceRebuild storage:personalInfo loop — traced and fixed
   ─────────────────────────────────────────────────────────────

Trace
─────
The loop originates in antcv-personality.js's own self-dispatch
pattern (line 66 of the v1.40.7 file you had deployed):

   Store.set(key, value) calls localStorage.setItem and then
   dispatches a synthetic StorageEvent with the same key.

The same file then listens (line 657) for storage events with
key='personalInfo' and calls forceRebuild('storage:personalInfo')
on every hit. This wires up a self-feedback path:
   external write → setItem → setItem wrapper (e.g. shape-guard
   re-emits) → listener fires → forceRebuild.

During a translation the bundle writes personalInfo repeatedly to
update meta (name, role, subtitle, company — my v292-294 extractor
expansion added several of these for ES/ZH targets). Each write
triggers ONE forceRebuild call. Nine successive translation chunks
⇒ nine rebuilds — even though none of those writes touched the
workStyle sub-object the Personal panel actually renders.

Other sidecars that dispatch synthetic StorageEvents
(antcv-ai-disclosure-cloud.js, antcv-ai-notice-stability.js,
antcv-wizard-escape-hatch-285.js, antcv-onboarding.js line 1563)
were ALL ruled out by reading their source — they fire with
key='aiDisclosureAccepted' or other keys, not personalInfo, so
they never reach this listener. The sole personalInfo-keyed source
of self-dispatch is personality.js's own Store.set.

Fix
───
Two surgical changes in the storage and sections-updated listeners
(lines 651-733 of the patched file):

  a. Hash the workStyle sub-object (keywords, strengths, notes,
     summary) on every event. If the hash matches the previous
     value, skip the rebuild entirely. Translation writes change
     name/role/subtitle/company but NEVER touch workStyle, so the
     hash stays stable across the whole translation pass and no
     rebuild runs.

  b. Coalesce multiple workStyle-changing writes within the same
     animation frame into a single rebuild via requestAnimationFrame.
     Previously the sections-updated path forced TWO rebuilds per
     event (the listener call + a hardcoded rAF retry). Now it's at
     most one rebuild per tick regardless of how many events fire.

The sections-updated path (which legitimately implies a workStyle
write via applyToCV) bypasses the hash gate, because by the time
the rAF fires the workStyle is already current and the hash gate
would otherwise skip. The bypass updates the hash and proceeds.

Test results
────────────
23 assertions across 12 tests, all passing:

  Personality:
    Test 1 — 9 storage events that DON'T change workStyle → 0
             rebuilds. (This is the exact loop pattern.)
    Test 2 — 1 storage event with a workStyle change → 1 rebuild.
    Test 3 — 5 rapid workStyle changes in the same tick → 1
             coalesced rebuild (not 5).
    Test 4 — storage event with a different key → 0 rebuilds.
    Test 5 — Realistic translation pattern (9 meta writes to name,
             role, subtitle, company, firstName, lastName, email,
             phone, location) → 0 rebuilds.
             THE ORIGINAL 9× IS NOW 0×.

  Cloud delete:
    Test 6 — sidecar installs at v1.40.296, relay base discovered,
             all three wraps applied.
    Test 7 — AntcvFullErase wrap fires DELETE then calls original.
             post-delete marker set.
    Test 8 — Plain signOut (no delete intent) does NOT fire DELETE.
    Test 9 — signOut WITH delete intent (marker recent) DOES fire DELETE.
    Test 10 — AntcvOnboarding.deleteUser wrap fires DELETE.
    Test 11 — Escape hatch (antcv:disable-cloud-delete=1) skips DELETE.
    Test 12 — Wraps are idempotent (calling _wrapFullErase twice
             doesn't double-wrap).

──────────────────────────────────────────────────────────────────

What is in this zip
-------------------

  index.html                       (app.js?v=1.40.296,
                                    antcv-personality.js?v=1.40.296,
                                    antcv-cloud-delete-296.js?v=1.40.296,
                                    antcv-wizard-fix.js?v=1.40.296)
  app.js                           (unchanged from earlier v296)
  antcv-personality.js             (PATCHED — v1.40.296)
  antcv-cloud-delete-296.js        (NEW — v1.40.296)
  antcv-wizard-fix.js              (from earlier v296 round)
  antcv-privacy-led.js             (from v295)
  antcv-language-ui-fixes-292.js   (unchanged)
  antcv-app-history-zfix-291.js    (unchanged)
  antcv-kernel-completeness-290.js (unchanged)
  antcv-cloud-put-shrink-guard-289.js (unchanged)
  antcv-wizard-escape-hatch-285.js (unchanged)
  README-v1.40.296.txt             (this file)

Deploy steps
------------

  1. Back up your current Cloudflare Pages folder.
  2. Copy all 11 files (12 with README) into that folder, overwriting
     same-named files. The NEW file is antcv-cloud-delete-296.js;
     the PATCHED files are antcv-personality.js and (from the prior
     round in this session) antcv-wizard-fix.js.
  3. Push the Cloudflare Pages deployment.
  4. If the relay worker doesn't yet implement DELETE /api/prefs,
     add it server-side. Without that, deletion behaviour is the
     same as v295 — local-only — but the wizard-fix guards make
     it safe (deleted-user sign-in still triggers the wizard
     correctly because of G2: personalInfoHasContent()).
  5. Hard-refresh: Settings → Hard Refresh.

How to verify each fix
----------------------

  9× loop:
    Open DevTools console BEFORE switching language. Switch to ZH
    or ES. The old behaviour produced one
    "[antcv-personality] forceRebuild storage:personalInfo {...}"
    line PER translation chunk (typically 9). New behaviour:
    ZERO such lines during the translation pass. The next time
    you'd see it is if you actually edit a workStyle field in
    Settings → Personal.

  DELETE on delete:
    Open DevTools Network tab. Click "Disagree & Delete user".
    Expected new request:
      DELETE https://<relay>/api/prefs
    Old behaviour: no such request. If the worker doesn't have a
    DELETE handler yet, you'll see the request fire but get a
    404/405. That's still progress — the client side is now
    correct, just waiting on the worker.

Version
-------

AntCV v1.40.296 (May 22, 2026)
