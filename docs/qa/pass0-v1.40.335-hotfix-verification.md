# Pass 0 — v1.40.335 hotfix verification (§5.1 smoke test, re-run for v1.50.0 cut)

**Current shipped build:** v1.40.337-ai-notice-fix (carries the four mechanical patches from v1.40.335-hotfix-b + the v1.40.336 version-grow-fix + the v1.40.337 AI-notice orphan-removal). Branch `feat/v1.50.0-writing-engine-and-packages` is cut from this.

## Audit trail — where each §5 item actually landed

| # | Item | File:line in current build | Status |
|---|---|---|---|
| 1 | Language card defaults to collapsed | [`antcv-stability-core-334.js:112`](../../pwa/antcv-stability-core-334.js) — `langExpanded(){... v===null?false:...}` | Shipped |
| 2 | Skip `raiseSettings` when non-settings modal is open | [`antcv-stability-core-334.js:212-228`](../../pwa/antcv-stability-core-334.js) — `nonSettingsModalOpen()` + early-return in `raiseSettings`. Selector includes `.antcv-ai-notice-host` (added in v1.40.337). | Shipped |
| 3 | `forceRoute` TTL 10 s → 2 s | [`antcv-stability-core-334.js:238`](../../pwa/antcv-stability-core-334.js) — `Date.now()-Number(route.ts||0)>2000` | Shipped |
| 4 | Importer modal `z-index: 2147483300; position: fixed` | [`antcv-data-importer.js`](../../pwa/antcv-data-importer.js) — single `2147483300` occurrence in modal CSS | Shipped |
| 5 | Block `wizardCompleted` writes during post-delete TTL | **Deliberately reverted** in v1.40.335-hotfix-b. `antcv-onboarding.js` is no longer loaded by `index.html`. The real fix is Pass 1's `wizardState` triple-state with server-side reset on delete-user (§7 Pass 1 step 4). | Not patched — Pass 1 owns it |
| 6 | AI notice z-index `2147483300` on mobile + non-settings-modal guard | [`pwa/app.js`](../../pwa/app.js) (single `2147483300` for `.antcv-ai-notice-host`) and [`antcv-stability-core-334.js`](../../pwa/antcv-stability-core-334.js) (`nonSettingsModalOpen()` selector includes `.antcv-ai-notice-host`) | Shipped (in v1.40.337) |

## §5.1 smoke test — re-run against current live deploy before Pass 1 merge

Run each in DevTools (mobile + desktop). Hard-refresh first (Settings → Hard Refresh, or DevTools Application → Clear site data) so the previous SW does not mask a regression.

1. **Wizard does not flash and close after sign-out → delete-user → sign-in.**
   - Item 5 is *not* patched at the band-aid level. If this still flashes in v1.40.337, that is **expected** — Pass 1 fixes it properly. Mark observed behaviour and proceed; do not block Pass 1 on this step.
2. **Settings → Personal → Languages card collapsed by default.** Toggle holds across reload.
   - Verifies item 1. Set `localStorage` `antcv:settings:languages-expanded = '0'` if needed to reset.
3. **Wizard steps 1 → 2 → 3 — AI notice appears on mobile portrait and landscape.**
   - Tests items 2 + 6. If notice is buried, inspect `.antcv-ai-notice-host` computed `z-index` (should be 2147483300) and `nonSettingsModalOpen()` selector match.
4. **Settings → Import profile — JSON, PDF, DOCX, PNG import on iOS Safari and Android Chrome.**
   - Tests item 4. Backdrop must sit above Settings.
5. **Regression spot-check** — top-bar languages, JD Analysis FAB on desktop, "Open in Settings" from Application history, no duplicate preview toolbar.

## Pass / fail rule

Items 1, 2, 3, 4, 6 must pass before Pass 1 merge. Item 5 is permitted to fail at this gate — Pass 1's `wizardState` work supersedes it.
