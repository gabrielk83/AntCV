# Wizard + Settings/Personal UX fixes — owner screenshots 2026-06-16 (build 1.50.521-salmon-scope)

Seven issues raised by the owner from the live mobile build, with roots verified against the
deployed source where reachable. Two wizard SURFACES are in play and the distinction drives the
fixes: (a) the **app.js stepped wizard** (numbered STEP 2 / 6A / 6C, progress-dot bar — Images 3/4/5)
and (b) the **`antcv-wizard-language-slide-339.js` sidecar modal** ("Set your languages" — Image 2),
which wraps `AntcvShowAiNotice` and fires at wizard-finish. The personality-quiz button, the
section-format showcase, and the settings-handoff all live in surface (b).

Deploy discipline: app.src.js → mirror app.js + `?v` bump; island (WizardSectionShowcase /
SectionFormatPicker) → vite build + `?v` bump; sidecar (`antcv-wizard-language-slide-339.js`) → edit
+ `?v` bump. A fix counts only Preview + after hard refresh, desktop + mobile.

---

## 1. Personal settings — duplicate "Build / update kernel from CV" button  [app.src.js]

Image 1: the SAME "🧬 Build / update kernel from CV" button renders TWICE in Settings → Personal
(once above "Import profile…", once below). Root: not yet located — the button strings live in the
minified bundle (code search doesn't index it). **Implementation step:** fetch `pwa/app.src.js`,
grep the literal `Build / update kernel from CV`, find the two emit sites in the Personal panel
render (likely one canonical + one stray duplicate from a refactor), remove the duplicate, mirror to
`app.js`. **Gate:** exactly one kernel-build button in Personal; both old positions checked.

## 2. Personal settings — "Import profile from Word, PDF, JSON, or image" as a separate button  [app.src.js]

Image 1: the import button sits as a distinct 3rd action. Owner: it "makes no sense to keep as a
separate button" — it overlaps the kernel-build flow (kernel build already ingests a CV). Decision
needed from owner on the exact consolidation; the sensible default: **fold import INTO the
kernel-build action** (one "Build / update kernel from CV" that accepts the same Word/PDF/JSON/image
drop), OR keep import but as a secondary affordance under the single kernel button, not a peer.
**Implementation:** same locate-in-app.src.js pass as #1; collapse the three buttons
(kernel-build ×2 + import) to one primary + at most one secondary. Mirror app.js. **Gate:** one
clear ingest path; import still works (Word/PDF/JSON/image). CONFIRM the consolidation shape with
the owner before editing.

## 3. Wizard — "Build / update kernel from CV" pill became sticky across every stage  [locate]

Images 2/3/4/5: the green "🧬 Build / update kernel from CV" pill is pinned at the top of EVERY
wizard step (STEP 2, 6A, 6C, and the language slide). It should appear only where relevant (the
CV-ingest step), not as a persistent header on all slides. Root: not yet located — likely an app.js
wizard header element rendered unconditionally, or a sidecar banner that stopped scoping to its
step. **Implementation:** locate the pill emit (grep `Build / update kernel from CV` in app.src.js +
check the wizard header render); scope it to the ingest step only (or remove if redundant with the
Step-6A dropzone). Mirror app.js. **Gate:** pill shows on at most one wizard step. PROBE-FIRST —
confirm which surface renders it before editing.

## 4. Wizard — "How each section can look" should be expandable + match the Layout-tab visuals  [island]

Image 2: the "HOW EACH SECTION CAN LOOK" block is a static, always-expanded read-only tile grid
(`src/islands/WizardSectionShowcase/WizardSectionShowcase.tsx`) — and on mobile only the heading +
intro paragraph render (the island grid appears not to mount inside the sidecar modal). Owner wants
it (a) EXPANDABLE (collapsed by default, like the Layout tab's collapsible groups) and (b) showing
the SAME section-format visuals as the Layout tab (`src/islands/LayoutPicker/SectionFormatPicker.tsx`),
not the simpler inline tiles. **Implementation:**
- Wrap the showcase in a `<details>`/collapsible (collapsed by default) so it doesn't dominate the
  slide.
- Replace the bespoke 7-tile grid with the Layout-tab's format-shape previews (reuse
  SectionFormatPicker's preview rendering in read-only mode) so the two surfaces match — this also
  satisfies the old-open SECTION-LAYOUT-GRAPHIC-001 direction.
- Fix the mount: confirm `antcv:mount-wizard-showcase` actually attaches inside the sidecar modal on
  mobile (the screenshot shows it not rendering). The sidecar dispatches the event + calls
  `mountAll()`; verify the island's mount observer sees the anchor inside the high-z backdrop.
**Gate:** collapsed by default, expands on tap, renders the Layout-style previews, on mobile.

## 5. Wizard "Tell AntCV about you" (STEP 6A) — two CV-upload affordances  [app.js wizard]

Image 4: the step has a dashed "Drop a CV or LinkedIn export here / click to browse" dropzone AND
(per the owner) a second CV-upload control. Owner: "makes no sense to have 2 buttons for CV upload."
**Implementation:** locate STEP 6A in the app.js wizard render; keep the single dropzone (it already
accepts PDF/DOCX/TXT/JSON/JS), remove the redundant second upload affordance. Mirror app.js.
**Gate:** one upload control on 6A; drop + click-to-browse both work.

## 6. Personality-kernel quiz button is on the WRONG slide  [sidecar + app.js wizard]

The "✨ Build your personality kernel (8-question quiz)" button is appended to the **language slide**
(surface b — confirmed in `antcv-wizard-language-slide-339.js`, in the `handoff` block: `pqBtn`).
Owner wants it on **6C "What tone fits you"** (Image 5, surface a — the app.js tone step), which is
the semantically correct home (tone + personality belong together). **Implementation:**
- Remove `pqBtn` from `antcv-wizard-language-slide-339.js` (delete the `pqBtn` creation + append in
  the `handoff` block; bump `?v`).
- Add the same button to the app.js STEP 6C tone slide render (it opens the quiz via
  `window.AntcvPersonalityQuiz.open()` / `antcv:open-personality-quiz` — same wiring). Mirror app.js.
- Cross-surface note: 6C is app.js, the quiz launcher is `antcv-personality-quiz-439.js` (loaded);
  the event/global already exist, so this is a relocation, not new wiring.
**Gate:** quiz button absent from the language slide, present + functional on 6C.

## 7. "Set your languages" slide should also include the spellchecker + tense selectors  [sidecar]

Image 2: the language slide currently has only the language picker + showcase + handoff. Owner wants
the **spellchecker selection** and the **experience-tense selector** on this slide too (they
currently live only in Settings → Personal). These map to existing controls:
- Experience tense → `window._antcvSetExpTense` / `antcv-tense-control-422.js`
  (`data-antcv-tense`); the prompt reads `styleConfig.expTense`.
- Spellchecker → `antcv-spell-annotator-384.js` (the spell toggle/selection).
**Implementation:** in `antcv-wizard-language-slide-339.js`, add a compact tense control (Present /
Past) + a spellchecker language/toggle control, writing to the SAME stores the Personal controls
use (so the wizard choice and Settings stay in sync — reuse `_antcvSetExpTense`; for spell, write
the same key the annotator reads). Place them under the language picker, above the showcase. Bump
`?v`. **Gate:** both controls present on the slide, persist, and reflect in Settings → Personal +
generation. NOTE this overlaps LANGUAGES-CARD-PERSONAL-001 (the Personal-side card must also host
these) — keep the two surfaces driving the same store.

---

## Cross-cutting note: the section-format showcase mount

#4's "renders as plain text on mobile" symptom suggests the WizardSectionShowcase island isn't
mounting inside the sidecar's `z-index:2147483647` backdrop. Before adding the collapsible, confirm
the island's mount path reaches an anchor inside a detached/high-z modal — the sidecar appends the
anchor to `panel` then dispatches `antcv:mount-wizard-showcase` + calls `mountAll()`, but if the
island's MutationObserver scopes to a different root the anchor is missed. This is the same
island-anchor-in-a-modal class of issue as the PackagePicker/LanguageCard anchors.

## Autonomy classification
- Autonomous-viable: #6 (quiz relocation), #7 (add tense/spell to slide), #4 (collapsible + island
  reuse + mount fix) — all sidecar/island, build-verifiable.
- Locate-then-fix (app.src.js, needs a source grep first, then mostly deterministic): #1, #2, #5.
- PROBE-FIRST: #3 (confirm which surface renders the sticky pill) + #2 (owner confirms the
  consolidation shape).
