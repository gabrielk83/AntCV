# Session log — 2026-07-11 (desktop) — babel-fish language architecture + brand-fit + hard-reset

Full architecture spec: `docs/qa/BABEL_FISH_LANGUAGE_ARCHITECTURE.md`. Memory: `babel-fish-language`,
`live-verify-browser-pane`. All shipped to `main` (PWA auto-deploys) + relay deployed.

## Owner model (the frame for all of it)

The canonical source of truth is language-neutral **MEANING** (structured facts), **not English** —
"could be binary or Klingon." Every displayed language, English included, is a **rendering**. Invariants
(numbers, proper nouns, tool/standard names, enum levels like `native`) pass through every rendering
unchanged; only renderable prose is translated. A babel fish carries meaning without altering it, and the
display language is never the same thing as the user's known languages.

## CLOSED this run (verified)

- **BABEL-FISH-LANG-NAME-001 (Phase 1a) — 1.51.262.** Root cause of "unsolicited zh generates English": the
  prominent gen-prompt `LANGUAGE:` line was hardcoded `"UK English"` for every non-Danish language
  (app.src.js ~24899), so only the weak trailing `__langGenLock` requested zh and the model believed the
  prominent line. Fix: `__langPromptName(code)` names the true target. Verified: marker in the deployed
  bundle; live signed-in zh render.
- **BABEL-FISH-RELANG-001 (Phase 1b) — 1.51.320.** Exposed `window.__antcvRelang=(e,f)=>Pr(e,f)` (`__force`
  bypasses the `e===je` guard) + sidecar `antcv-babel-relang.js`: non-Latin ribbon (zh/he/am/ar) with
  wrong-script content → re-render via the translate pass. Detection on the sections DATA model, not the DOM.
  Verified: bundle markers + the relang decision path exercised live.
- **BABEL-FISH-CACHE-001 (Phase 2) — 1.51.321.** Lazy per-language cache with the `antcv:genSpeed` mode
  split: fast/balanced restore the cached rendering instantly (`AntcvApplyStyleKernel`); thorough skips the
  cache (fresh); never auto-fires a multi-minute generation from a passive switch. Verified live: 4 decision
  scenarios (balanced+cache→restore, thorough+cache→re-render, no-cache→translate, already-zh→snapshot).
- **BABEL-FISH-CLOUD-CACHE-001 (Phase 2b) — 1.51.323 + relay 1.3.10/auth-30.** Single `langRenders` key
  (hard-capped ~40KB), `settings-sync-extra` KEYS + relay `KERNEL_PREFS_OBJ_FIELDS` allowlist → cross-device.
  Verified live: POST `/api/prefs {langRenders}` → 200 → GET returns it CJK-intact → cleaned up.
- **BABEL-FISH-INVARIANT-001 (Phase 2c Part A) — 1.51.324.** Fact-preservation: after a relang, every
  number/metric + ALL-CAPS acronym must survive; drift → warn + `AntcvBabelRelang.lastDrift`; severe (≥2
  missing) → the lossy rendering is NOT cached. Verified live: faithful zh render → 0 missing; lossy render
  (dropped 250/10/26262/ISO/CCB/FMEA) → all 6 flagged.
- **COMPANY-BRAND-FIT-SCOPE-001 — 1.51.247.** Brand-fit recolors ONLY the CV/CL band+sidebar (routes navy to
  styleConfig `headerBg`/`sidebarBg` via `wa()`), no longer the app window (dropped `_t(navy)`/navyColor).
  Verified: markers in the deployed app.js.
- **HARD-RESET-LANG-RESTORE-001 — 1.51.247.** `signOut()` `localStorage.clear()` then the boot re-seeds bare
  `['en','da']` before the 2.5s cloud restore, so restore's "present locally → skip" stripped extra
  languages. `settings-sync-extra` now treats a bare EN-DA `enabledLanguages` as absent so the cloud list
  wins. Verified: sidecar loaded live at the correct `?v`.
- **Live-verify infra used:** persisted signed-in session `~/.antcv/browser-session.json` restored into the
  Browser pane → drove a real zh render + cloud round-trip. Post-deploy live-verify is now a hard rule in
  both NIGHTLY_MULTIRUN work orders (`docs/qa/LIVE_VERIFY_BROWSER_PANE.md`).

## OPEN (carry forward)

- **Phase 2c-B / 2d — pre-warm all enabled languages.** Needs a HEADLESS translate: the current
  `__antcvRelang`/`Pr` mutates the LIVE view (switches language + translates in place), so background
  pre-warm would disrupt the user's screen. Next step: a background translate that writes a rendering into
  the `langRenders` cache without touching the live sections. Low priority — the lazy cache + 2b cloud sync
  already fill each enabled language incrementally as the user visits it.
- **Owner acceptance on a POPULATED CV.** The live zh render was verified on the karp.gabriel.a@antcv.net
  account, whose CV is an unpopulated skeleton, so the translated *content* was placeholder text (correctly
  rendered). The mechanism is proven; owner should eyeball a zh render of a fully-populated CV.
- **R1 registry** (`__ANTCV_LANG_REGISTRY` 23-language sidecar), **R2 filename-suffix + ar/zh visual gate**,
  **R3 full per-style section orders** — see `docs/qa/NIGHTLY_MULTIRUN_LANG_STYLES.md` STATUS.
