AntCV v1.40.295 — deployment increment
========================================

Overlays onto your existing deployment folder.

What changed since v294
-----------------------

Two things this round:

  A. Universities translate (Patch H).
     v294 had university names in the "KEEP VERBATIM" category along
     with company / org names. You pointed out these have established
     target-language forms and should translate. The prompt now
     instructs:
        Tel Aviv University  → ES "Universidad de Tel Aviv"  / ZH 特拉维夫大学
        Tsinghua University  → ES "Universidad de Tsinghua"  / ZH 清华大学
        Technion             → ZH 以色列理工学院 (kept "Technion" in ES,
                                              no canonical form)
        MIT                  → ZH 麻省理工学院 (kept "MIT" in ES)
        Other universities   → translate if a canonical target-language
                               name exists; otherwise keep original
     Companies / brands / products / technology codes / standards
     still stay verbatim — only academic institutions moved.

  B. Privacy LED popup auto-close fixed (antcv-privacy-led.js bumped
     to v1.40.295).
     Two contributing causes, both addressed:
       i. Race between the opening click and the outside-mousedown
          handler: a synthesised mousedown event firing within the
          same event-loop tick as the click that opened the popover
          was triggering the outside-handler immediately. Added a
          250 ms grace window after open during which outside-clicks
          are ignored. The window is long enough to absorb every
          observed mobile-touch coalesced event but short enough that
          deliberate outside-clicks still feel responsive.
      ii. Stale fabEl reference after overlay re-render: the cached
          fabEl pointed to the detached old button after the overlay
          remounted (this happens during the translation forceRebuild
          storm). When the user then clicked the NEW button, the
          handler's `fabEl.contains(ev.target)` returned false and
          the click was misclassified as "outside". Now the handler
          does a fresh `document.querySelector('.antcv-fab[
          data-antcv-privacy-led-fab="1"]')` on each event and uses
          that, also refreshing the cached fabEl for downstream code.

What is in this zip
-------------------

  index.html               (app.js?v=1.40.295, privacy-led?v=1.40.295)
  app.js                   (patched, 5 surgical edits since unpatched)
  antcv-privacy-led.js     (patched, v1.40.295)
  antcv-language-ui-fixes-292.js   (unchanged from v292)
  antcv-app-history-zfix-291.js    (from earlier turn)
  antcv-kernel-completeness-290.js (from earlier turn)
  antcv-cloud-put-shrink-guard-289.js (from earlier turn)
  antcv-wizard-escape-hatch-285.js (you uploaded — included for
                                    reference resolution)
  README-v1.40.295.txt     (this file)

Deploy steps
------------

  1. Back up your current Cloudflare Pages folder.
  2. Copy the 8 files (9 with README) from this zip into that folder,
     overwriting same-named files.
  3. Push the Cloudflare Pages deployment.
  4. Hard-refresh the SW cache via Settings → Hard Refresh.

Tests run before shipping
-------------------------

  v295 privacy LED tests (5 tests, 7 assertions):
    - Sidecar installs as v1.40.295, FAB created in overlay container.
    - Grace window: spurious mousedown within 250ms of open is
      ignored, popover stays.
    - After grace expires, genuine outside mousedown closes.
    - Click on the FAB itself never closes (FAB-contains check still
      works alongside the new fresh-query).
    - After simulated overlay re-render (old FAB detached, new FAB
      with same marker mounted), a click on the NEW FAB does NOT
      close — the fresh-query path finds it.
    - Genuine outside click after re-render still closes.

  v294 bundle patches (re-verified): patch_app.py applies cleanly to
  the new unpatched app.js you uploaded (779,764 bytes), produces a
  778,765-byte patched bundle, node --check passes.

  All earlier extractor + publications-sentinel tests still pass
  (carried over from v292-294 rounds).

Per-language translation policy now in effect (v295)
----------------------------------------------------

  KEEP VERBATIM (organisations only):
    Companies (Innoviz, Sirin Labs, Pan Idræt, Copenhagen Wolves RFC)
    Products (Power BI, Codebeamer)
    Technology names (LiDAR)
    File formats
    Standards codes (ISO 26262, ASPICE, BABOK)

  TRANSLATE (with target-language equivalents):
    Universities — Tel Aviv U, Tsinghua U, Technion (ZH only), MIT
                   (ZH only) — when a canonical form exists.
    Job titles and role names — even adjacent to organisation names.
    Cities and countries.
    Civic / status terms (EU Citizen → EU-borger / Ciudadano UE /
    欧盟公民).
    Section titles.

  PER-LANGUAGE OVERRIDES:
    Spanish target: keep person names in Latin script unchanged.
    Chinese target: transliterate candidate person name to Chinese
                    characters (e.g. Gabriel Alexander Karp-Gershon
                    → 加布里埃尔·亚历山大·卡普-格申).

Still unresolved (one item)
---------------------------

  - 9× forceRebuild storage:personalInfo loop during translation.
    Your message said you uploaded antcv-personality.js but it didn't
    actually land — only antcv-privacy-led.js is in /mnt/user-data/
    uploads. Re-upload antcv-personality.js and I'll trace the
    trigger chain.

Note on app.js source
---------------------

The new app.js you uploaded (779,764 bytes) is the upstream/unpatched
version (24 bytes larger than the original you uploaded earlier; the
extractor and skip-list patterns I patch against are still present
intact). My patch_app.py applies cleanly. If you've made local edits
to app.js outside this conversation that aren't reflected in the
uploaded copy, let me know — I'd want to verify they don't collide
with Patches A-H.

Version
-------

AntCV v1.40.295 (May 21, 2026)
