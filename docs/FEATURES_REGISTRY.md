# AntCV — Feature Registry

A living registry of **features** (distinct from the bug tracker at
`docs/qa/ACTIVE_BUGS.md`). Each feature is **CLOSED** (shipped + live), **OPEN**
(planned or in progress), or **PARKED** (descoped / blocked).

Last updated: **2026-06-06** (triage round 2) — PWA `1.50.166`, docx-worker `1.14.17`.

Status legend: ✅ CLOSED (shipped) · 🟡 OPEN (active/planned) · ⚪ PARKED.

---

## CLOSED — shipped & live

| ID | Feature | Where | Notes |
|----|---------|-------|-------|
| FT-DATA-EXPORT | Download all stored data + analytics to a file (optional WebCrypto AES passphrase) | `antcv-data-export-360.js` | Button in the PRIVACY zone; "Save my data locally first" checkbox in the erase card. PR #176/#181/#185. |
| FT-DELETE-SAVE | Back up before account erase | same sidecar wraps `AntcvFullErase` | PR #176. |
| FT-CONSOLE-QUIET | Central console quieter (suppress ~70 boot/status banners; `localStorage.antcvVerboseConsole=1` to restore) | `antcv-console-quiet.js` | PR #188. |
| FT-SIDEBAR-COLOR | Preview sidebar follows the visual style (`var(--package-base)`, matches DOCX) | `antcv-sidebar-bg-token.js` | PR #210. |
| FT-LOADING-GATE | "Loading…" cover on login for returning users (masks the wizard flash + palette/tone settle) + orphan tone migration | `antcv-login-loading-gate.js` | PR #220. |
| FT-PHOTO-POS | Photo placements in preview (sidebar-top/bottom, header L/R, main L/R, band-overlap) | `antcv-photo-position.js` + app.js | Finders repaired for the single-table renderer (PR #196). Alt-position *persistence* still OPEN — see bug tracker. |
| FT-DOCX-PHOTO | DOCX photo placement incl. `band-overlap` → top-of-sidebar | docx-worker `generate.js` | PR #200 (worker 1.14.17). |
| FT-VISUAL-PACKAGES | 7 visual style packages (Copenhagen Modern, Navy Executive, Warm Terracotta, Nordic Frost, Pampas Contemporary, Tokyo Precision, Delhi Technical) | registry + islands + app.js | Palette re-derives render colours on load (PR #226), but the default-palette "black mix" bug **PACKAGE-PALETTE-MIX-001 is still OPEN** — persisted id stays orphan `scandinavian`. Close-out = APPJS-ID-SCHEME-UNIFY. |
| FT-WRITING-STYLES | 12 writing systems (nordic-minimal … hybrid-balanced) + banned lists + tone chips | `writingSystems/registry.json`, proxy worker | Pre-existing; tone orphan default migrated this session. |
| FT-EXPORT | DOCX + PDF export (cv-proxy / docx-worker / CloudConvert) | workers | Pre-existing. |
| FT-ANALYSIS-REPORT | Branded AI-watermarked JD-analysis PDF | `antcv-analysis-report-pdf-360.js` | Landed in parallel work (#219 family). |
| FT-DEBUG-LOGGER | Crash-proof in-app error logger + on-device viewer (for mobile-only blue screens with no devtools). Captures uncaught errors + breadcrumbs to localStorage synchronously (survives crash+reload); plain-DOM overlay opens via `#antcv-debug`, a 4-tap top-right gesture, a Settings button, or `window.AntcvDebug.open()`. Copy/Share/Download/Clear. | `antcv-debug-logger.js` (v1.50.167) | Loads first; does NOT touch `window.fetch`. Regression-guarded by the `debug-logger` browser-QA check. Built to diagnose PERSONAL-DATA-CRASH-001. |

## OPEN — planned / in progress

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| FEATURE-CONF-001 | Per-sentence **confidence overlay** (Application-tab toggle; red=low/yellow=medium; hover shows the issue) | 🟡 not started | NOT in the locked docs — needs a worker self-check pass returning `{text,confidence,issue}` + app.js toggle/store + a preview renderer. Spec in `docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. |
| PHOTO-SIDEBAR-BRIDGE-001 | True **sidebar-bridge** photo: split the candidate-header cell so the disc hovers on the header/sidebar seam (preview + DOCX) | 🟡 design build | Owner spec 2026-06-06. Bigger than the current top-of-sidebar approximation. |
| APPJS-ID-SCHEME-UNIFY | Unify app.js's package id scheme with the registry (`scandinavian→copenhagen-modern`, `copenhagen_executive→navy-executive`, …) + persist the selection through cloud-restore | 🟡 source work | Removes the need for the orphan-apply / loading-gate workarounds. Do in `pwa/app.src.js` (source of truth) → re-minify. |
| DATA-IMPORT-001 | **Restore** a downloaded backup file (counterpart to FT-DATA-EXPORT) | 🟡 not started | Export shipped; import is the natural follow-up. |
| PROCESSING-QUEUE-INDICATOR-001 | Per-subsection live work-state badge: pink **"processing"** while being worked (language change, new JD/kernel, compress, enhance), yellow **"queue"** when scheduled later in the same command (enhance-over-subsection → first pink, rest yellow). Plus: CJLR (Center/Justify/Left/Right) buttons working in **every** sub-subsection. | 🟡 not started | Owner spec 2026-06-06. No per-subsection lifecycle state exists today. Bug tracker: PROCESSING-QUEUE-INDICATOR-001. |
| AUTO-PAGEBREAK-BLOCK-001 | Automated page breaks: **always** show the salmon splitter when content exceeds one A4 page in preview; sliding is **block-level** — a whole sub-subsection moves to the next page (never partial, never the whole parent subsection). | 🟡 MVP shipped 1.50.262 | Owner spec 2026-06-06. MVP `antcv-auto-pagebreak-block-001.js` v1.50.262 splits at top-level section boundary (`data-sid`) AND intra-section between EXPERIENCE role blocks. Salmon splitter rendered between page-rows, hidden in print. Idempotent (undo previous splits before re-splitting), debounced MutationObserver, 6-split safety cap per primary. Synthetic probe verified: 1 overflowing row → 2 capped rows + 1 splitter, EXPERIENCE 6 roles → 3+3 split. **Follow-up:** (a) intra-section split for CORE COMPETENCIES table rows + OUTCOMES bullet list, (b) optional "(continued)" header on continuation pages, (c) carry sidebar photo / contact strip on page 2+ as a slim header, (d) reconcile with manual page=2,3,4 markers + PB-001..006 + EXPORT-PAGE2-001. |
| WIZARD-002 | Step 6d (default languages + settings hand-off) | 🟡 registered | Step 6b scrollable is **DONE**; only 6d remains. |
| PREVIEW-CHATBOT-001 | **In-preview chatbot for selection-driven edits.** Select any text/element in the preview → long-press (mobile) or right-click (desktop) opens a small contextual chatbot. User says what they want changed: wording, compression, location/move, color, tone, formatting. The bot edits the selected element accordingly, **respecting the application's specific restrictions** (banned words/phrases, length budget, language, ATS mode, style package, section-specific rules — PROFILE vs OUTCOMES vs CORE COMPETENCIES, etc.). After the edit, the bot **explains why it did what it did** (anchored to the source rules — e.g. "shortened to fit the ORPHAN rule (≥4 words on the final line)" or "swapped 'spearhead' → 'led' (banned-word list)"). Per-element, per-app, with undo. | 🟡 not started | Owner spec 2026-06-07. Heavier feature: needs (a) preview-element selection capture (text node range or section-cell ref), (b) a context-aware LLM call that includes the current rules/budgets + the selected snippet, (c) a diff/preview-before-apply UI, (d) a "why" panel surfacing the rule cited. Touches the writing-engine + section-format-prefs layers. Bug tracker: PREVIEW-CHATBOT-001. |
| WIZARD-LANG-SELECTOR-001 | **Wizard language step — two-table language selector.** (1) The wizard "language set" step must actually SHOW the languages selector (currently missing / not rendered on that step). (2) Build it as **two tables side by side**: left = **all available languages** (full supported set: en, da, sv, de, fr, es, …); right = **selected languages** (user's chosen subset). Move languages left↔right to add/remove. (3) The right table is **reorderable**, and its **order sets the default language — the first entry in the selected list is the default** (drives the generation/`meta` default language). Persist the ordered selected-language list + derived default. | 🟡 not started | Owner spec 2026-06-07. Relates to WIZARD-002 (default languages) and the Settings → Personal LanguageCard. Supported set lives in `writingSystems/registry.json` language partition. Bug tracker: WIZARD-LANG-SELECTOR-001. |
| SPELL-ANNOTATOR-001 | **Basic spelling annotator** for editable text fields. (1) Detects the current text language (from the per-section / global language setting; not from the user's locale). (2) Loads a dictionary for that language. (3) Underlines misspelled words in red while the user types or after a short pause. (4) Click / long-press the underlined word → small popover with **alternative suggestions** (pick one to replace inline). (5) "Add to my dictionary" option for proper nouns the user wants to keep. Per-language toggle in Settings. **Owner clarification: "not necessarily related to the application"** — works on any editable field independent of JD context. | 🟡 specced, not started | Owner spec 2026-06-07. **Decisions locked 2026-06-07:** (a) **Languages** — if the user has selected EN and/or DA in their language settings, load only those; otherwise load the full AntCV supported set (currently EN, DA, ES, ZH). Dictionary fetched on demand per active language, cached in IndexedDB. (b) **Scope** — CV + CL editable text only (bullets, role/company/subtitle, greeting/opening, all section content). NOT topbar (name/contact), NOT JD textarea, NOT Signals textarea, NOT the rendered preview. (c) **Implementation** — `nspell` + Hunspell-compatible dictionaries (`dictionary-en`, `dictionary-da`, `dictionary-es`, `dictionary-zh-cn` or equivalent). Custom red-underline overlay + click-for-alternatives popover + "Add to my dictionary" (persisted to localStorage `antcv:userDict:{lang}`). Bug tracker: SPELL-ANNOTATOR-001. |
| DATA-PORTABILITY-CLOUD | Persist corrected defaults (package/tone) to the cloud/database so per-load migration isn't needed | 🟡 needs relay prefs PUT | Owner's "do the corrections in the database" idea — riskier cloud-write path, deferred. |

## PARKED / descoped

| ID | Feature | Reason |
|----|---------|--------|
| FT-LOOP-DAMPER | Global MutationObserver coalescer | ⚪ reverted 1.50.89 (broke per-row control self-cleanup). |

---

### How to keep this current

- When a feature ships: move its row to **CLOSED**, add the PR + version.
- When the app.js source cleanups (APPJS-ID-SCHEME-UNIFY) land, retire the
  orphan-apply / loading-gate workarounds and note it here + in the bug tracker.
- Bugs (regressions, defects) go in `docs/qa/ACTIVE_BUGS.md`; net-new capability
  goes here.
