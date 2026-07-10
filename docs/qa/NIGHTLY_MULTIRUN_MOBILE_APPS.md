# NIGHTLY MULTI-RUN WORK ORDER — mobile fit as standalone iPhone/Android apps

Owner brief (2026-07-02): "adapt the app mobile so it fits iphone and android
independent apps." Interpretation (confirmed by code audit): make the PWA a
first-class INSTALLED app on both platforms (home-screen install today, store
packaging as the final phase), and close the mobile UX gaps that make the installed
app feel unfinished.

MULTI-RUN order. Each run: SYNC FIRST, read STATUS, do the next phase, verify,
update STATUS + run log, push.

## SHIFT PROTOCOL — claim before you work (parallel-session safety)

Multiple sessions push to `origin/main`. Before editing, reserve your lane (full detail:
`docs/qa/NIGHT_SHIFT.md`): (1) `git fetch origin && git pull --rebase origin main`;
(2) `node scripts/shift.mjs claim --task "<what>"` — reserves a version-number range + records
it in the ledger, prints your range + a `git worktree add` line; (3) run that
`git worktree add ../AntCV-<name> -b <name>` and work THERE, not the shared clone; (4) use only
numbers **inside your range**, `node scripts/shift.mjs beat` to heartbeat; (5)
`node scripts/shift.mjs release` when done (`status` lists claims, `reap` clears dead ones).

## STATUS (update every run)

- [ ] R1 Install polish: manifest screenshots, maskable icon set, iOS touch icons +
      splash metas, absolute id
- [ ] R2 Viewport correctness: 100dvh, top/left/right safe-area, input-zoom guard
- [ ] R3 Mobile bug closure: SO-004, GRAMMAR-MARKER-SCROLL-LAG-001,
      GEN-UI-cancel-button-mobile, DOC-WIDE-CHATBOT-001 (mobile entry)
- [ ] R4 Store packaging: Android TWA scaffold + assetlinks; iOS wrapper evaluation
      (owner decision gate)

Run log:
- 2026-07-10 (desktop, parallel-gen track — see SESSION_2026-07-10_PARALLEL_GEN_AND_LANG.md): no R1-R4
  phase closed, but shipped the cross-device parallel-generation isolation this mobile story depends on —
  per-device cloud pointer (relay PARALLEL-GEN-POINTER-002 / new `active_application_device` table, 1.51.259)
  + client keep-local guard (1.51.256) + same-device tab-doc-isolation sidecar (1.51.253). Net effect for
  mobile: a desktop generation no longer yanks the phone's in-progress draft (and vice-versa). When testing
  the installed PWA on the owner's phone (R2/R5), desktop⇄mobile parallel gens are now safe to run.

## Hard rules

1. SYNC FIRST; never force-push. Read the CURRENT version from pwa/index.html at run
   start.
2. Cache-bust quintet on every pwa asset change (incl. manifest.json ?v if referenced
   with one, sw.js CACHE, version-override TARGET/STALE, seed, version-override's own
   ?v line).
3. app.js minified-sacred; mobile work should live in manifest/index.html/CSS/
   sidecars - app.js edits only if a bug fix demands it, mirrored to app.src.js.
4. Suite + boot-smoke green before every push. Mobile-visual claims verified in a
   real mobile viewport (Playwright device emulation headless; owner's phone for the
   final eyeball).
5. The share-target flow (manifest share_target + antcv-share-target-jd-375.js) is
   LIVE - do not regress it when touching manifest.json.
6. **POST-DEPLOY LIVE VERIFY (desktop runs, owner 2026-07-10):** after push + the
   Pages auto-deploy, open the in-app Browser pane on `https://antcv.pages.dev/` and
   run `docs/qa/LIVE_VERIFY_BROWSER_PANE.md` — confirm the deployed version is live,
   each changed asset loaded at its NEW `?v=`, and each edit's marker is in the built
   bundle. Catches the stale-`?v` phantom-ship regression. NEVER navigate `?hardReset=1`.
   Use `resize_window({preset:'mobile'})` for the mobile-viewport structural checks
   (read_page/console/js; screenshots time out on this PWA). Cloud runs flag it "owed".

## Ground truth (verified 2026-07-02 by code audit)

- manifest.json: display standalone, start_url/scope/id "./" , orientation any,
  theme #283556, share_target GET (shared_url/text/title). GAPS: screenshots [],
  only icon-192/icon-512 marked maskable (7 other sizes lack purpose), no wide/narrow
  form-factor screenshots.
- index.html head: viewport-fit=cover, apple-mobile-web-app-capable/status-bar/title,
  ONE apple-touch-icon (192px). GAPS: no apple-touch-icon 180/167/152/120, no
  apple-mobile-web-app-startup-image splash set.
- CSS: antcv-mobile-controls.css uses env(safe-area-inset-bottom) for the bottom nav
  but panels use calc(100vh - Npx) (iOS address-bar jank; needs 100dvh with 100vh
  fallback); no top/left/right inset handling; no >=16px input font-size guard
  (iOS zoom-on-focus).
- Mobile sidecars: consolidated into antcv-mobile-ui-418.js (loaded, line ~899) +
  antcv-mobile-controls.css + share-target-375. Old 275/351/352/354 files are DEAD on
  disk (merged) - do not edit them.
- sw.js: production-grade (resilient precache, network-first sources, workers.dev
  bypass) - no installability blocker.
- Open mobile bugs: SO-004 (React #185 crash on text-field commit, Android Chrome,
  repro documented in AntCV_QA_backlog_index_v4.md), GRAMMAR-MARKER-SCROLL-LAG-001
  (ACTIVE_BUGS), GEN-UI-cancel-button-mobile (own doc), DOC-WIDE-CHATBOT-001 mobile
  entry (ACTIVE_BUGS).
- Store packaging: ZERO existing TWA/Capacitor/Bubblewrap work.

## R1 — Install polish (quick wins, one run)

1. Icons: regenerate the icon set from icons/antcv-icon.svg with a maskable-safe
   zone (80% content circle); mark ALL manifest icon sizes with purpose "any" and a
   separate maskable entry for 192/512 at minimum, ideally each size. Keep filenames
   (sw precache list) or update sw SHELL accordingly.
2. Screenshots: capture two portrait (540x1110 or 1080x2340 class) + one landscape/
   wide desktop screenshot from the REAL app (Playwright against the local pwa or
   antcv.pages.dev demo persona; no candidate data visible - use Anita demo). Add
   `screenshots` entries with form_factor narrow/wide + sizes + type.
3. iOS: add apple-touch-icon 180/167/152/120 (generated from the same SVG), and the
   startup-image meta set for current device classes (use the media-query splash
   pattern; generate PNGs into icons/splash/). Splash design: navy #283556 field +
   centered ant icon - match theme_color so the transition is seamless.
4. Manifest id: keep same-origin correctness; set `"id": "/?app=antcv"` or absolute
   "/" - verify Chrome does not treat it as a NEW app (installed-user continuity:
   changing id orphans existing installs - if risk, LEAVE id as-is and document).
5. Verify: Lighthouse PWA/installability pass (headless), manifest parses, sw
   precaches new assets, share-target still works. Cache-bust quintet.

## R2 — Viewport correctness (one run)

1. 100dvh: replace calc(100vh - Npx) in antcv-mobile-controls.css (and any other
   loaded mobile CSS) with `height: calc(100vh - Npx); height: calc(100dvh - Npx);`
   (fallback-first pattern).
2. Safe areas: topbar + left/right rails get env(safe-area-inset-top/left/right)
   padding (max() pattern like the existing bottom nav). Test in Playwright with
   device emulation for a notch device profile.
3. Input zoom: audit input/textarea font sizes in the editor (mobile media query);
   raise sub-16px inputs to 16px within the mobile breakpoint (visual re-check that
   layout holds; NEVER user-scalable=no).
4. Keyboard: with an installed-app viewport, verify the editor's focused field stays
   visible when the soft keyboard opens (scroll-into-view on focus if not).
5. Verify on the owner's phone (installed PWA) - report before/after screenshots.

## R3 — Mobile bug closure (verify-first, one bug at a time)

Order by user pain:
1. SO-004 (React #185 crash, HIGH): repro per AntCV_QA_backlog_index_v4.md (shared
   controlled-input commit path, Selected Outcomes row + Subheading). Diagnose the
   effect echo; fix at the shared component; regression test. This is an app.js /
   react-islands fix - check which bundle owns the editor first (islands are
   VITE-built from src/islands - edit .tsx + npm run build for islands; app.js only
   surgically).
2. GEN-UI-cancel-button-mobile: make cancel reachable during generation on narrow
   screens (fixed-position, safe-area aware). Sidecar/CSS.
3. GRAMMAR-MARKER-SCROLL-LAG-001: throttle/re-anchor the marker overlay on
   scroll/touch-move (rAF-batched re-sync); verify no battery/jank regression.
4. DOC-WIDE-CHATBOT-001 mobile entry: always-visible Ask-AI launcher on mobile (the
   desktop selection-pill flow collides with long-press) - respect the existing
   design note in ACTIVE_BUGS.
Each: repro -> fix -> test -> quintet -> push. Skip any already fixed (verify-first;
registry is often stale).

## R4 — Store packaging (final phase; owner decision gate)

Android (real deliverable):
1. Scaffold a TWA via Bubblewrap into `apps/android-twa/` (new dir, not in pwa/):
   manifest from antcv.pages.dev, package id dev.pages.antcv (or owner-chosen),
   generate `/.well-known/assetlinks.json` into pwa/ (needs the signing key
   fingerprint - Bubblewrap generates a keystore; STORE THE KEYSTORE OUTSIDE THE REPO,
   document the path + backup in the run report).
2. Build the APK/AAB locally if the toolchain is available (JDK + Android SDK via
   Bubblewrap doctor); if the toolchain is not installed, deliver the scaffold +
   exact build commands + assetlinks and STOP - flag for the owner.
3. Play Store listing needs a developer account (owner decision + $25) - do not
   assume; prepare the listing text from docs/marketing/PROBLEM_STATEMENTS.md.

iOS (evaluation, not build):
4. iOS has no TWA; options are (a) installed PWA via Safari (works today, improved by
   R1/R2 - this is the recommended near-term path), (b) Capacitor wrapper for App
   Store (needs Apple Developer account $99/yr, Mac build machine or CI, and App
   Store review risk for thin wrappers). Deliver a one-page comparison in
   docs/plan/MOBILE_STORE_PACKAGING.md with a recommendation; owner decides before
   any Capacitor scaffold.
5. Either way: the PWA remains the single source - wrappers must not fork UI code.

## Risks / do-not

- manifest.json edits can orphan existing installs (id change) or break share-target;
  test both after every manifest change.
- New icons/splash into sw.js SHELL: keep the resilient precache property (a missing
  splash must not block install).
- No keystore/secrets in the repo, ever.
- The demo persona (Anita) is the only data allowed in screenshots.
