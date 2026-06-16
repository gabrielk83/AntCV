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

## 2. Personal settings — kernel-build vs import button overlap  [antcv-kernel-import.js + antcv-data-importer.js]

Image 1 shows BOTH `📥 Import profile from Word, PDF, JSON, or image` (data-importer replacement)
AND `🧬 Build / update kernel from CV` (kernel-import). Owner: a separate import button "makes no
sense" — both ingest a CV. They are genuinely different engines though: import → fills personalInfo
fields; kernel-build → extracts a structured kernel (roles/conflicts/gaps) for generation. So this
is a CONSOLIDATION decision, not a pure delete.

OWNER DECISION NEEDED (two viable shapes):
- (A) ONE primary button "🧬 Build / update kernel from CV" (accepts .docx/.pdf/.txt/.json/image —
  the kernel picker already accepts `.docx,.pdf,.txt,.json`, add image), and demote the field-import
  to a small secondary link under it ("just fill the basic fields instead").
- (B) Keep both but make the hierarchy explicit: kernel-build primary, import secondary, never two
  peer buttons + never duplicated.
RECOMMEND (A): the kernel is the richer path and already feeds generation; field-only import becomes
the fallback. Implement after #1 (dedup) since both touch the same inject path.
**Gate:** one clear primary ingest path; the secondary still works (Word/PDF/JSON/image); no peers,
no duplicates. CONFIRM A vs B with the owner before editing.

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
- **Owner-decision then code:** #2 (consolidation shape A vs B — recommend A).
- **Sequence-dependent:** #5 — ship #3 first, then re-check 6A for a residual native second upload.

## Suggested implementation order
1. #1 + #3 together (same `injectEntry` in `antcv-kernel-import.js` — panel-level dedup + scope to
   Personal/6A + drop the broad text anchor). Re-check #5 after.
2. #6 (quiz: remove from language sidecar, add to app.js 6C).
3. #7 (tense + spell on the language slide).
4. #4 (showcase collapsible + Layout-style previews + mount fix).
5. #2 once the owner confirms A vs B.
