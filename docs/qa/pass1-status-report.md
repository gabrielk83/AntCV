# Pass 1 — UI stability + React refactor — status report

**Plan citation:** AntCV_Plan_v2_LockedSources.md §6 (open P0 corrections) and §7 Pass 1.
**Branch:** `feat/v1.50.0-writing-engine-and-packages`
**Build version:** `1.50.0-pass1`

## Scope shipped

| # | Plan item | Where it landed |
|---|---|---|
| 1 | `<LanguageCard />` mounts inside Personal tab; default collapsed; no `MutationObserver` on `document.documentElement` | [`src/islands/LanguageCard/LanguageCard.tsx`](../../src/islands/LanguageCard/LanguageCard.tsx), [mount](../../src/islands/LanguageCard/mount.tsx). Mount scope: scoped MutationObserver on `document.body`. |
| 2 | `<PreviewToolbar />` mounted once; no post-render injection; no duplicates | [`src/islands/PreviewToolbar/PreviewToolbarController.tsx`](../../src/islands/PreviewToolbar/PreviewToolbarController.tsx). Headless React controller owns the resize listener + a scoped MO on `document.body`. |
| 3 | `useModalNav()` hook + `<SettingsRouter />` owns `{openModal, activeTab, targetSubTab}`; replaces `routeSettings`/`forceRoute` | [`src/islands/SettingsRouter/useModalNav.tsx`](../../src/islands/SettingsRouter/useModalNav.tsx), [SettingsRouter](../../src/islands/SettingsRouter/SettingsRouter.tsx). Exposes `window._antcvOpenSettingsRoute` and `window.AntcvReactSettingsRouter`. Does **not** ramp `z-index` (per Pass 1 exit criterion). |
| 4 | `wizardState` triple-state ('new' / 'skipped' / 'completed'), persisted; post-delete TTL blocks `wizardCompleted` writes | [`src/lib/wizard-state.ts`](../../src/lib/wizard-state.ts). `wizardState` is **derived**, not a new persisted key — avoids touching `antcv-cloud-restore-filter-298.js`'s strip list. `installWizardStateGuard()` monkey-patches `Storage.prototype.setItem` to block `wizardCompleted` writes while the `antcv-just-deleted` cookie is fresh. **Proper fix for hotfix §5 item 5** (which was reverted in v1.40.335-hotfix-b). |
| 5 | Fix `topbarOrder` ReferenceError at ~line 2001 of `app.js` | Not reproducible in v1.40.337 build. See [pass1-topbarorder-investigation.md](pass1-topbarorder-investigation.md). |
| 6 | Delete `antcv-stability-core-334.js` from `index.html` once 1–3 verified | **Not done in this PR** — see "Deferred" below. |

## Infrastructure introduced

- Vite + React 18 + TypeScript build at repo root: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/`.
- React and ReactDOM are externalised — both already loaded via UMD in [`pwa/index.html:17-18`](../../pwa/index.html). The Vite output is a single IIFE that consumes `window.React` / `window.ReactDOM`.
- Build output: [`pwa/antcv-react-islands.js`](../../pwa/antcv-react-islands.js) (~16 KB / 5.7 KB gzip) + sourcemap. Committed alongside source so `wrangler pages deploy pwa/` works without a Cloudflare build step.
- Build commands: `npm run build`, `npm run dev`, `npm run typecheck` — all green.

## Deferred — `antcv-stability-core-334.js` deletion

Plan §7 Pass 1 step 6 reads "Once 1–3 are verified working, delete `antcv-stability-core-334.js` from `index.html` entirely." I have not done this in this PR for three reasons:

1. **Verification gap.** The React islands compile and typecheck clean, but I cannot run them in a browser from this environment. Deleting the legacy implementation before browser smoke-testing the replacement risks shipping a regression.
2. **Out-of-scope behaviour bundled in stability-core.** Beyond the three named features (LanguageCard, PreviewToolbar route, SettingsRouter), stability-core also owns:
   - `raiseSettings` z-index ramping — explicitly removed by Pass 1 exit, no replacement needed.
   - Click delegation for "Open in Settings → " inside Application history. `antcv-settings-front-327.js` has an equivalent `openAppHistory()`, but the **trigger** wiring lives in stability-core's global click handler. Deletion may strand this button.
   - Button rename "User" → "Personal" in the settings tabs. Cosmetic but visible.
3. **Defensive design of the islands.** The React `<LanguageCard />` deliberately stands down when it detects the legacy card (`document.getElementById('antcv-stability-personal-languages')`). PreviewToolbar and SettingsRouter are idempotent with stability-core's equivalents. So **leaving stability-core loaded for this PR is safe** — the legacy behaviour is what users see; the React islands are dormant until you opt in.

## How to verify the React islands in a browser

A localStorage opt-in toggle has been added at the top of [`pwa/antcv-stability-core-334.js`](../../pwa/antcv-stability-core-334.js) (after the IIFE preamble): stability-core now stands down when the flag is set.

```js
// In DevTools console, on the deployed page:
localStorage.setItem('antcv:disable-stability-core-334', '1');
location.reload();
// To revert:
localStorage.removeItem('antcv:disable-stability-core-334');
location.reload();
```

With the flag on, the React islands take over. Smoke test:

1. **LanguageCard.** Settings → Personal — the Languages card renders, default collapsed (§5 hotfix item 1). Toggle a checkbox; verify the top-bar language buttons update.
2. **PreviewToolbar.** Resize the window across the 760 px breakpoint; verify the preview core actions appear/disappear and no duplicate FABs render.
3. **SettingsRouter.** From Application history, click an entry that calls `_antcvOpenSettingsRoute({subtab:'application-history'})` — Settings opens on the right subtab. No z-index ramping is applied (open DevTools, inspect the modal — no `z-index: 2147483200`).
4. **wizardState.** Sign in → delete user → sign in again. Wizard does not flash-and-close. Confirm in DevTools that `document.cookie` contains `antcv-just-deleted=…` and that `localStorage.getItem('wizardCompleted')` stays `null` for the post-delete TTL.

After all four pass: turn the flag back off, hard-refresh, confirm the legacy behaviour also still works (regression check).

## Pass 1 exit-criteria results

| Criterion | Result | Notes |
|---|---|---|
| All four P0 acceptance tests pass | Code complete — **browser verification pending** | Use opt-in toggle above. |
| `antcv-stability-core-*.js` removed from `index.html` | **Not met** | Deferred per "Deferred" section. |
| `grep MutationObserver \\(.*\\)\\.observe\\s*\\(\\s*document\\.documentElement` returns 0 across PWA | **Not met (4 files)** | `antcv-settings-front-327.js`, `antcv-stability-core-334.js`, `antcv-wizard-section-format-step10.js`, `antcv-language-prefs.js`. Three of the four are outside Pass 1 scope (wizard-step10 goes React in Pass 4; settings-front-327 + language-prefs survive into v1.51). Stability-core deletion removes one. |
| `grep z-index: 21474` returns 0 | **Not met (3 files)** | `app.js`, `antcv-mobile-controls.css`, `antcv-data-importer.js`. The first two are unmodified PWA infrastructure; data-importer's `2147483300` came from hotfix item 4. Stability-core ramping (line 225) is removed only after deletion. |
| `grep z-index: !important` over `--z-overlay-max` returns 0 | **Not met (5 sites across 4 files)** | Same files as above plus `antcv-wizard-language-slide-339.js`. These need follow-up audits beyond Pass 1's named scope. |
| Modal stacking test (§8.7) passes for all six modals on mobile + desktop | Pending browser test | Run after stability-core deletion. |

## Follow-up work

| Item | Owner | Where |
|---|---|---|
| Browser smoke test of React islands via opt-in toggle | User | Live deploy |
| Delete `antcv-stability-core-334.js` once smoke test green | Follow-up PR | `pwa/index.html` line ~595 |
| Worker-side DELETE `/api/prefs` handler in `antcv-access-relay` (referenced by `pwa/antcv-cloud-delete-296.js` line 138-139) | Follow-up PR | [`workers/access-relay/`](../../workers/access-relay/) |
| Replace `MutationObserver(document.documentElement)` in `antcv-settings-front-327.js` and `antcv-language-prefs.js` | v1.51 (Pass 4) | Out of Pass 1 scope. |
| Replace wizard-step10 `MutationObserver(document.documentElement)` | v1.51 (Pass 4 — `<SectionFormatPicker />` promotion) | Per plan §7 Pass 4 step 21. |
