# Wizard + Settings/Personal UX fixes — owner screenshots 2026-06-16 (build 1.50.521-salmon-scope)

Seven issues raised by the owner from the live mobile build, ROOTS NOW VERIFIED in the deployed
source. Two wizard SURFACES are in play and the distinction drives the fixes: (a) the **app.js
stepped wizard** (numbered STEP 2 / 6A / 6C, progress-dot bar — Images 3/4/5) and (b) the
**`antcv-wizard-language-slide-339.js` sidecar modal** ("Set your languages" — Image 2), which wraps
`AntcvShowAiNotice` and fires at wizard-finish. The personality-quiz button, the section-format
showcase, and the settings-handoff all live in surface (b).

KEY FINDING: issues #1/#2/#3 are NOT app.src.js bugs. They are a **three-sidecar pileup** on the
Settings → Personal ingest spot:
1. `app.src.js` line 21647 renders the native button `📄 Import profile from Word or PDF` (file
   input `accept=".pdf,.doc,.docx"`).
2. `antcv-data-importer.js` (`hookSettingsButton`, ~line 925) HIDES that native button and injects a
   replacement `📥 Import profile from Word, PDF, JSON, or image` (stamped
   `data-antcv-import-replacement`), which already handles JSON/images/DOCX/PDF.
3. `antcv-kernel-import.js` (`injectEntry`, ~line 206) then inserts a `🧬 Build / update kernel from
   CV` button after EVERY anchor it matches — and it matches BOTH the data-importer replacement
   (anchor source #1) AND the pdf+docx file input wrapper (anchor source #3). Two matches in the
   same panel → the kernel button is injected TWICE (#1). Its `MutationObserver(documentElement)`
   re-fires on every wizard step and the broad `import/upload cv` text regex matches upload
   affordances on other slides → the sticky pill (#3).

Deploy discipline: sidecar edits (`antcv-kernel-import.js`, `antcv-data-importer.js`,
`antcv-wizard-language-slide-339.js`) → edit + `?v` bump in index.html, no app.js mirror. Island
(WizardSectionShowcase / SectionFormatPicker) → vite build + `?v`. app.src.js edits (only #5 if it
turns out app.js-side) → mirror app.js + `?v`. A fix counts only Preview + after hard refresh,
desktop + mobile.

---

## 1. Personal settings — duplicate "Build / update kernel from CV" button  [antcv-kernel-import.js]

ROOT CONFIRMED: `injectEntry()` builds an `anchors[]` list from three sources (data-importer
replacement; any import/upload button/label by text; any pdf+docx file input) and inserts a kernel
button after each. In Settings → Personal the replacement button AND the file-input wrapper both
match → two kernel buttons. The idempotency guard only checks "is THIS anchor's nextSibling already
a kernel button", so two DIFFERENT anchors each get their own button.

FIX (sidecar-only, `antcv-kernel-import.js` `injectEntry`):
- De-duplicate at the PANEL level, not the anchor level: after collecting anchors, if any anchor
  already resolves to the same container that holds the data-importer replacement, keep ONLY the
  replacement anchor (it is the canonical ingest button) and drop the file-input anchor in the same
  container. Simplest robust form: track a `Set` of host containers and inject at most ONE kernel
  button per container.
- Tighten anchor source #3: skip the raw pdf+docx file input when a `[data-antcv-import-replacement]`
  exists in the same `closest('div')` (the data-importer already owns that input's visible button).
**Gate:** exactly one `🧬 Build / update kernel from CV` button in Settings → Personal, after a hard
refresh; still present once (not zero).

## 2. Personal settings — consolidate to ONE ingest button (A), superset of both engines  [antcv-kernel-import.js + antcv-data-importer.js]

OWNER DECISION: **(A) — ONE primary button, BUT it must be a TRUE SUPERSET; the lessons/capabilities
of BOTH engines integrate into the new button, none dropped.**

CRITICAL — the two engines are NOT interchangeable. Capability audit (verified in source):

| | kernel-import (antcv-kernel-import.js) | data-importer (antcv-data-importer.js) |
|---|---|---|
| Formats | .docx .pdf .txt .json | .json .pdf .docx .png .jpg .jpeg .webp (SUPERSET) |
| Plain CV (pdf/docx) | structured roles + conflict/gap review + save-to-account | fills personalInfo fields |
| Kernel .json | yes (structured kernel) | — |
| AntcvBackup .json | — | full restore (DIRECT-JSON-IMPORT-001) |
| VIA assessment PDF | — | workStyle + stylePrefs |
| Banned-words DOCX | — | wordsDoc + stylePrefs.banned_words/phrases/patterns |
| Image (png/jpg/webp) | — | profile photo (resized) |
| Conflict/gap review | yes (metrics never auto-overwritten; gaps never invented) | — |
| Save to account | yes (relay /api/profile/kernel-v2) | — |

A naive "kernel button only" would SILENTLY LOSE photo import, VIA->workStyle, banned-words->
stylePrefs, and AntcvBackup restore — the data-importer is the ONLY path for those four. That is the
regression to avoid (the owner's explicit "integrate lessons from both").

REQUIRED DESIGN — one entry point, type-routed, preserves every capability:
- ONE primary button "Build / update kernel from CV" whose file input accepts the UNION:
  .docx,.pdf,.txt,.json,.png,.jpg,.jpeg,.webp
- On file pick, ROUTE by type/content BEFORE picking an engine — reuse the data-importer's existing
  classify() (it already detects via-pdf / words-docx / image / AntcvBackup-json / plain-cv):
  - image -> data-importer handleImage (photo)
  - VIA pdf -> data-importer handleVIA (workStyle + stylePrefs)
  - banned-words docx -> data-importer words-docx route (stylePrefs.banned_*)
  - AntcvBackup json -> data-importer backup restore
  - kernel json OR plain CV (pdf/docx/txt) -> kernel-import runImport (structured roles + the
    conflict/gap review modal + Apply / Apply+save-to-account)
- KEEP the kernel review modal governance (conflicts: existing kept by default, metrics never
  auto-overwritten; gaps never invented; language-to-generate-in picker) — the kernel engine's
  lessons, must survive.
- KEEP the data-importer's non-destructive write scheme + per-route summary/confirm (empty fields
  keep current values; photo resize; banned-words parsing) — its lessons, must survive.
- No second visible button, but NO route lost — the single button dispatches to the right engine.
  Add small helper text: "CV, kernel JSON, LinkedIn export, VIA report, banned-words doc, or a photo".

IMPLEMENTATION: cleanest seam is antcv-kernel-import.js — after the #1 dedup leaves ONE button,
change its click handler from openPicker() (kernel-only) to a router that opens one input with the
union accept, classifies the file (call into window.AntcvDataImporter classify + per-type handlers;
expose them if not already public), and dispatches. Then antcv-data-importer.js STOPS injecting its
own visible replacement button (keeps its modal + handlers as the library the router calls) so only
the single kernel-labelled button remains. Verify AntcvDataImporter exposes classify + handlers; if
not, that small public-API wiring is the main work here.

Gate: ONE ingest button in Settings -> Personal. Each of the 6 source types still reaches its
correct handler (test one file of each: plain CV, kernel json, AntcvBackup json, VIA pdf,
banned-words docx, image) — NO capability lost vs today. Conflict/gap review still appears for
CVs/kernels. Implement AFTER #1 (dedup).

## 3. Wizard — "Build / update kernel from CV" pill sticky across every stage  [antcv-kernel-import.js]

ROOT CONFIRMED: same `injectEntry()` — its `MutationObserver(document.documentElement,{subtree})`
re-runs `scheduleInject` on every wizard re-render, and anchor source #2's regex
`/import profile from word|upload (your )?cv|import (your )?cv/i` matches upload-like affordances
that appear on multiple wizard steps, so the pill gets injected on each. The screenshots show it on
STEP 2, 6A, 6C, and the language slide.

FIX (sidecar-only):
- Scope the injection to the intended surfaces only: Settings → Personal AND the single wizard
  CV-ingest step (6A). Gate `injectEntry` so it does nothing when the visible wizard step is NOT the
  upload step — e.g. require the anchor to be a real profile/CV FILE INPUT (source #3) or the
  data-importer replacement, and DROP the broad text-match source #2 (it is what catches unrelated
  steps). Anchor source #2 is the over-reach; sources #1 and #3 are precise.
- Confirm with the same panel-level dedup from #1 so 6A doesn't get two either.
**Gate:** the pill appears on at most ONE wizard step (6A) + Settings → Personal; absent on STEP 2 /
6C / language slide. This is now code-located (not PROBE-FIRST) — the observer + regex are the cause.

## 4. Wizard — "How each section can look" expandable + match Layout-tab visuals  [island + sidecar]

Image 2: the "HOW EACH SECTION CAN LOOK" block is a static, always-expanded read-only tile grid
(`src/islands/WizardSectionShowcase/WizardSectionShowcase.tsx`) — and on mobile only the heading +
intro render (the island grid isn't mounting in the sidecar modal). Owner wants it (a) EXPANDABLE
(collapsed by default, like the Layout tab) and (b) showing the SAME visuals as the Layout tab's
`src/islands/LayoutPicker/SectionFormatPicker.tsx`. FIX:
- Wrap the showcase in a collapsible (`<details>`, collapsed by default).
- Replace the bespoke 7-tile grid with the Layout-tab format-shape previews (reuse
  SectionFormatPicker's preview rendering, read-only) so the surfaces match — also satisfies the
  old-open SECTION-LAYOUT-GRAPHIC-001 direction.
- Fix the mount: the sidecar appends the anchor `[data-antcv-wizard-section-showcase]` to `panel`
  then dispatches `antcv:mount-wizard-showcase` + calls `mountAll()`; verify the island's mount
  observer/listener actually attaches inside the `z-index:2147483647` backdrop (the screenshot shows
  it not rendering). Same island-anchor-in-a-high-z-modal class as PackagePicker/LanguageCard.
**Gate:** collapsed by default, expands on tap, renders Layout-style previews, on mobile.

## 5. Wizard "Tell AntCV about you" (STEP 6A) — two CV-upload affordances  [app.js wizard + likely #3]

Image 4: a dashed dropzone "Drop a CV or LinkedIn export here / click to browse" PLUS (per owner) a
second upload control. PARTLY EXPLAINED BY #3: the kernel-import pill is being injected onto 6A too,
so one of the "two uploads" is that injected pill sitting next to the native dropzone. Fixing #3
(scope the pill to one place) likely removes the duplicate here. RESIDUAL: confirm whether the
app.js 6A render ALSO has its own second upload button independent of the pill. **Implementation:**
first ship #3, re-check 6A; if a native second upload remains, locate STEP 6A in app.src.js
(the dropzone copy "Drop a CV or LinkedIn export here") and remove the redundant control + mirror
app.js. **Gate:** one upload control on 6A; drop + click-to-browse work.

## 6. Personality-kernel quiz button on the WRONG slide  [sidecar + app.js wizard]

CONFIRMED: `pqBtn` (`✨ Build your personality kernel (8-question quiz)`) is appended to the LANGUAGE
slide in `antcv-wizard-language-slide-339.js` (in the `handoff` block). Owner wants it on **6C "What
tone fits you"** (app.js tone step) — tone + personality belong together. FIX:
- Remove `pqBtn` (creation + `handoff.appendChild(pqBtn)`) from
  `antcv-wizard-language-slide-339.js`; bump `?v`.
- Add the same button to the app.js STEP 6C render; it opens via
  `window.AntcvPersonalityQuiz.open()` / `antcv:open-personality-quiz` (launcher
  `antcv-personality-quiz-439.js` already loaded — relocation, not new wiring). Mirror app.js.
**Gate:** quiz button absent from the language slide, present + functional on 6C.

## 7. "Set your languages" slide should include spellchecker + tense selectors  [sidecar]

Image 2: the language slide has only the language picker + showcase + handoff. Owner wants the
spellchecker selection + experience-tense selector here too. Existing controls to reuse:
- tense → `window._antcvSetExpTense` / `antcv-tense-control-422.js` (`data-antcv-tense`); prompt
  reads `styleConfig.expTense`.
- spell → `antcv-spell-annotator-384.js`.
FIX: in `antcv-wizard-language-slide-339.js`, add a compact tense control (Present/Past) + a
spellchecker toggle/lang control under the language picker (above the showcase), writing the SAME
stores the Personal controls use so wizard + Settings stay in sync. Bump `?v`. **Gate:** both
present, persist, reflect in Settings → Personal + generation. Overlaps LANGUAGES-CARD-PERSONAL-001
(Personal card must host the same controls; both surfaces drive one store).

---

## Autonomy classification (updated after source-locate)
- **Autonomous-viable, code-located:** #1 (kernel-import panel-level dedup), #3 (scope the
  injection / drop the broad text anchor), #6 (quiz relocation), #7 (add tense/spell to slide), #4
  (collapsible + SectionFormatPicker reuse + mount fix). All sidecar/island, build-verifiable.
- **Owner-decided (A), code-located:** #2 — one type-routed superset button; integrate BOTH engines'
  capabilities (kernel review governance + data-importer photo/VIA/banned-words/backup routes). No
  capability may regress.
- **Sequence-dependent:** #5 — ship #3 first, then re-check 6A for a residual native second upload.

## Suggested implementation order
1. #1 + #3 together (same `injectEntry` in `antcv-kernel-import.js` — panel-level dedup + scope to
   Personal/6A + drop the broad text anchor). Re-check #5 after.
2. #6 (quiz: remove from language sidecar, add to app.js 6C).
3. #7 (tense + spell on the language slide).
4. #4 (showcase collapsible + Layout-style previews + mount fix).
5. #2 (A): after #1 dedup, route the single button by file type across both engines; verify all 6
   source types still work + the kernel conflict/gap review survives.
