# AntCV session — 2026-07-10 (parallel generation + full-language + RTL work log)

Desktop session, runs alongside the same-day job-tracker session (`JOBTRACKER_SESSION_2026-07-10.md`) — different track, same `main`. All work committed + pushed (PWA auto-deploys; docx-worker + access-relay deployed via deploy.yml). This is the single source of what changed on the generation-isolation + language + export-RTL track; the per-nightly handoff at the bottom says what each recurring session should now know.

Current shipped at session end: PWA **1.51.259-parallel-gen-pointer**, docx-worker **1.14.144-rtl-layout-mirror**, access-relay **auth-29** (redeployed with PARALLEL-GEN-POINTER-002). Always re-check live (`pwa/sw.js` CACHE + `/health`) before quoting.

## HEADLINE — parallel generations across tabs/browsers/devices now safe

Owner brief: *"I need to be able to run generations in parallel considering the long generation times"* — and treated as higher priority than deferring. Three layers now protect a draft while another gen runs elsewhere:

- **PARALLEL-GEN-POINTER-002 (relay + client, 1.51.259) — the root fix.** The cloud stored ONE `active_application` row per account (PK `user_hash`), so a generation finishing on ANY device/tab flipped the shared pointer and a second device mid-draft was yanked onto the foreign app on its next cold-restore. Now there is a **per-device pointer**:
  - New D1 table `active_application_device (user_hash, device_id, application_id, updated_at)` PK`(user_hash, device_id)`. In `schema.sql` + idempotent runtime `CREATE` in `ensureActiveAppColumns` (so prod migrates with no manual schema run). **Table created live in prod 2026-07-10** (D1 `ant_memory` 499c3de9) so there is no first-request race.
  - `writeActivePointer()` writes BOTH the per-device row AND the legacy global row on every setActive (POST `/api/applications` create + PUT `/api/active`). Legacy row stays the durable authority + cross-device fallback; per-device write is best-effort.
  - `readActivePointer()` returns THIS device's own pointer when it has one, else falls back to the legacy global (fresh device → latest app anywhere). Wired into GET `/api/prefs` (the cold-restore feed) and GET `/api/active`; `device_id` read from `?device_id=`.
  - Client: `AntcvJdScope.devQ()` (in `antcv-jd-scope.js`) builds the `?device_id=` suffix from the per-install `antcv:deviceId`; appended to the two restore-feeding prefs GETs (cold-restore fetch + Read-from-Cloud URL builder) and `getActive()`.
  - **Fully backward-compatible both directions**: old client (no device_id) → legacy global; new client vs old relay → param ignored, legacy behavior. Both full-account wipe batches also clear the new table.
  - Tests: `scripts/tests/relay-per-device-pointer.test.mjs` (7, via a test-only `__test` export) — two devices independent, fresh→global fallback, old-client→legacy.
- **PARALLEL-GEN-ISO-001 (client, 1.51.256).** Keep-local guard at both cold-restore sites: when the cloud row's app-id differs from THIS tab's `AntcvJdScope.getCurrentAppId()`, treat as drift and keep the local draft (foreign app stays in the list to open explicitly). app.js drift chains `__draftDrift=__staleSamePtr||__fahA||…` (cold) and `__ddB=__staleSamePtrB||__fahB||…` (read).
- **Tab-doc-isolation sidecar (1.51.253).** `antcv-tab-doc-isolation.js` — per-tab sessionStorage doc snapshot; restores this tab's own `sections` if a parallel SAME-device tab overwrote shared localStorage. Kill via `localStorage['antcv:disable-tab-doc-iso']`.

Keep-local is always data-loss-safe. Memory: `jd-scope-isolation` (Stage 3 section).

## FEATURES SHIPPED — full-language + RTL export

- **Per-tab generation language (LANG-GEN-LOCK-001, 1.51.237/250/252).** `__langGenLock(code)` — data-driven strong output-language directive for zh/es/he/am/fr/de (generic fallback; empty for en/da). Wired into BOTH the targeted-gen and unsolicited prompts. Critically the unsolicited path reads the **per-tab** language `Be`, not `localStorage["language"]` (global, parallel-tab-contaminatable) — the 1.51.252 fix after the owner diagnosed parallel-tab contamination.
- **Translation render-source round-trip (LANG-TRANSLATE-RENDER-SOURCES-001, 1.51.248).** Translate now collects + translates the **subtitle/specialization** and **CL slogan** (previously untranslated), mirrors them back via `__antcvWriteSpec`/`__antcvWriteSlogan`, snapshots `{specialization, clSlogan}` into each per-language cache entry and restores on cache-switch. Batch loop retries 3× with backoff.
- **Hebrew / Amharic / Arabic selectable + rendered (1.51.238/249, worker 1.14.143/144).**
  - Client: `Me` language list + `antcv-language-ui-429.js` OPTIONS/LABEL_TO_CODE gained he(עב) / am(አማ) / ar(ع); `findLanguageButtons` cap 6→8.
  - docx-worker `SCRIPT_FONT` map (`{zh: Microsoft YaHei, he: Noto Sans Hebrew, ar: Noto Sans Arabic, am: Noto Sans Ethiopic}`) on every font slot; localized __RESULTS/__AINOTICE/CONT_SUFFIX for he/ar/am.
  - **RTL**: `style._rtl = lang==="he"||lang==="ar"` → `rightToLeft`(w:rtl) on default run + `bidirectional`(w:bidi) on default paragraph (buildStyles docDefaults).
  - **Full layout mirror**: `visuallyRightToLeft` on the page table (`makePageTable`) so the sidebar moves to the RIGHT for RTL (1.14.144).
- **Language dropdown self-heal (1.51.245).** `We` dropdown always shows the ACTIVE language (`c = _rawC`) + a self-heal effect that persists the active language into `enabledLanguages` (fixed: adding a language in Settings made the select do nothing).

## FEATURES SHIPPED — layout / dates

- **Fix-Orphans no longer over-lengthens (1.51.225).** The "fit-it" binder was producing lines ~30 chars too long; added a **width-guard** — it shrinks the bind count until the trailing cluster fits ONE line by the `Vi` line estimator (loc-aware column width via `Pi.find(id)`).
- **No "(present)" in dates (DATE-NO-PRESENT-001, 1.51.222 / worker 1.14.140).** `__antcvScrubYears` (client) + `__scrubYears` (worker) strip "(present)"/localized to the current year (2026) on role dates.
- **Per-writing-style page budget + section order (1.51.235).** New `antcv-style-page-budget.js` — on style-change seeds a per-style `pageBudget` (credential-forward/cold-outreach = 1, most = 1.5, structured/prestige/mediterranean/context = 2, research-formal/academic = 3) and the commercial-section order if absent. Seed-on-first-sight; advances LANG_STYLES R3.

## PARALLEL-SESSION TOOLING + LIVE-VERIFY (added later same night)

- **NIGHT SHIFT ledger + protocol (SHIPPED).** `docs/qa/NIGHT_SHIFT.md` (JSONL claims committed to main) + `scripts/shift.mjs` (`claim`/`status`/`next-version`/`beat`/`release`/`reap`). Each session reserves a version-number RANGE (from the true git high-water mark — robust to a regressed `TARGET_VERSION`) and works in its own `git worktree`, so parallel sessions never collide on version numbers or shared-tree WIP. SHIFT PROTOCOL wired into both NIGHTLY_MULTIRUN work orders + CLOUD_ROUTINE_PROMPT. Dogfooding fixed three `shift.mjs` bugs: stuck empty-id (release blanked the id file; now deleted, empty == absent), `--hours 0` swallowed by a falsy check, and the worktree IDFILE (`.git` is a FILE in a worktree → `join('.git',…)` invalid; now `git rev-parse --absolute-git-dir`).
- **Version regression corrected → 1.51.260.** The PR#336 weekly-demand merge (old-main base) resolved the cache-bust quintet DOWN to 1.51.245/246, below the deployed 1.51.259 (code intact, mis-labeled). Forward-corrected to 1.51.260-shift-versionfix — the exact class the ledger exists to prevent.
- **Live-verify (SHIPPED).** Manual in-app-Browser-pane procedure (`docs/qa/LIVE_VERIFY_BROWSER_PANE.md`) + AUTOMATED Playwright checks in `scripts/qa-checks.mjs`: `node scripts/browser-qa.mjs --only version-live` (live `ANTCV_VERSION` >= repo TARGET — catches the 245/246 class) and `--only sidecars-live` (feature globals present on the live bundle). Both write a screenshot + JSON report, exit non-zero for CI/pre-push.
- **Two bugs live-verify caught, both FIXED live under their own shift claims:**
  - **DEAD SIDECAR (1.51.300).** `sidecars-live`'s first run found `antcv-tab-doc-isolation.js` (1.51.253) was served but had NO `<script>` in index.html — dead since it shipped. Wired; `AntcvTabDocIso.tabId` now present live.
  - **WIZARD-NEW-USER (1.51.322).** Live-simulated the wizard gates: it never opened for a signed-in new user (Gate 1 skips when authenticated; Gate 2 could only close). Fixed so Gate 2's fresh-user branch opens the wizard when there's no flag and no REAL personalInfo, aligning its content heuristic with the WIZARD-AUTOLOAD-001 `__returning` fix.

## OPEN / NEXT

- **Cross-device is opt-in by design.** A fresh device inherits the global-latest; a device that has used the app keeps its OWN last app. To pull a phone-generated app onto desktop, open it explicitly from the app list (it is never lost — the legacy global row + the app row both persist).
- **RTL is main-column-aware but not visually eyeballed by the owner** on a real ar/he PDF — LANG_STYLES R2 wants an owner visual gate on ar + zh PDFs. am uses Ethiopic (LTR) so only font, not mirror.
- **antcv.dev / antcv.net canonical site** — owner said "next week night"; still deferred. Purchased domains, not yet wired.
- **Possible remaining unsolicited-zh furniture** (owner to re-test on 1.51.252+): the "Unsolicited" application-line label, CL slogan if the showcase doesn't emit `cl_slogan`, Latin signature name at CL sign-off.

## PER-NIGHTLY HANDOFF

- **antcv nightly** (antcv-nightly): the cloud sync model CHANGED — `active_application` is no longer the single source; there is a per-device `active_application_device` table (relay PARALLEL-GEN-POINTER-002). Any code that reads/writes the active pointer must go through `readActivePointer`/`writeActivePointer` (both tables) — do NOT add a raw `INSERT INTO active_application … ON CONFLICT(user_hash)` again. The docx-worker now has RTL + CJK + Ethiopic fonts (1.14.144); RTL flips the sidebar to the right via `visuallyRightToLeft`. Register PARALLEL-GEN-POINTER-002 + the RTL export in FEATURES_REGISTRY.
- **NIGHTLY_MULTIRUN_LANG_STYLES**: R2 (export RTL + CJK) is substantially shipped — CJK font (zh YaHei), RTL (he/ar w:rtl+w:bidi+layout mirror), Ethiopic (am) font. Still open in R2: the **filename-suffix registry** (still `_Dansk`-only) and the owner **visual gate** on ar/zh PDFs. R1 language directives partially shipped as `__langGenLock` (zh/es/he/am/fr/de) but NOT the full 23-language `__ANTCV_LANG_REGISTRY` sidecar the phase specifies — that registry is still the clean target. R3 got a first slice via `antcv-style-page-budget.js` (per-style page cap + commercial order).
- **NIGHTLY_MULTIRUN_MOBILE_APPS**: no phase closed, but the cross-device parallel-gen isolation (per-device pointer + tab-doc-isolation) is **infrastructure the installed-app story depends on** — a phone and a desktop can now run generations in parallel without clobbering each other's draft. Keep this in mind when testing the installed PWA on the owner's phone (R2/R5): a desktop gen no longer yanks the phone.
- **job list weekly / job tracker nightly** (CLOUD_ROUTINE_PROMPT / gen-runner): the runner already restores the account active pointer around a batch; with per-device pointers a runner that sends its OWN stable `device_id` on setActive would isolate its writes to a "runner" device and stop touching the owner's device pointer at all — a cleaner alternative to save/restore. Optional follow-up.
- **weekly demand seeding**: unaffected.
