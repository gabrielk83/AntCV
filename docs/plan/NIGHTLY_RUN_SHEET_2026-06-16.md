# AntCV Nightly Plan — capable-session run sheet (2026-06-16)

Successor to `NIGHT_RUN_2026-06-16.md`. Execution plan for a capable autonomous session — what to
build, optimize, test, and deploy, in order, with the verification gate for each. Assumes relay
deploy permission (confirmed), worker `wrangler deploy`, vite island builds, and the
`app.src.js`→`app.js` mirror are all available.

> **PRIORITY CORRECTION (added after review):** the first cut of this sheet was built from the
> reconciled OLD-OPEN backlog and under-weighted the authoritative active queue. Per discipline the
> **`ACTIVE_BUGS.md` top block WINS**, and the owner set the ordering 2026-06-15/16:
> **CONTENT & EXPORT → SETTINGS MODIFICATION → NEW FEATURES.** **Lane 0 below carries that queue and
> runs FIRST.** Lanes 1–4 (old-open clusters + infra/test) follow. Where they overlap (e.g.
> `AI-WATERMARK-EXPORT-LOCATION-001` is both Lane 0 and old-open Watermark) do the work once, in
> Lane 0 order.

## Standing discipline (every task)
- `pwa/app.src.js` edit → mirror minified `pwa/app.js` (names DIFFER — anchor on string literals,
  copy minified blocks verbatim; [[minified-mirror-shadow-hazard]]) → bump `app.js?v=`. Commit both.
- Worker edit → `workers/docx-worker/src/index.js` (inlined, no build) → manual `wrangler deploy`,
  one deployer. proxy/demo-proxy parity: any `workers/proxy/src` change mirrored to
  `workers/demo-proxy/src`; separate CI deploys.
- Island edit → `src/islands/**` → vite `npm run build` → bump `antcv-react-islands.js?v=`. Bundle
  >50KB: built, never hand-written. Any file >~50KB (incl. ACTIVE_BUGS) → desktop git only.
- Every wrangler.toml: `[observability.logs] enabled=true, invocation_logs=true` after
  `compatibility_date`.
- Verify PAST the sign-in gate headlessly (boot-smoke is NOT enough). A fix counts only if it holds
  in Preview + DOCX/PDF, desktop + mobile, after a hard refresh + cache-bust trio. Never
  Preview-only, never wrong-item, never only-after-hard-refresh. Many active items are prompt-side
  and can ONLY be judged on an owner REGEN — those are owner-verify, not autonomous-closeable.

---

## LANE 0 — ACTIVE QUEUE (authoritative; owner-ordered; runs FIRST)

Source: `ACTIVE_BUGS.md` top block (sha 3e457aa), owner review 2026-06-15/16. Split by what a
capable session can actually close vs. what needs the owner (regen / PDF eyeball / live device).

### 0.A CONTENT & EXPORT — autonomous-viable (do these first)

- **RESULTS-DOCX-MISSING-001** [worker] — per-role Results not exported to DOCX (present in PDF, not
  all positions). Root: a render-branch/condition in `renderExperience` (`workers/docx-worker/src/
  index.js`) gating whether `role.results` is emitted. **Gate:** export a multi-role CV DOCX,
  assert every active role's Results run is present in the XML; overlaps RESULTS-TIGHTENING-STRIP-001
  (the "not all positions" half). HIGH VALUE.
- **RESULTS-PDF-INK-BLACK-001** [worker] — exported Results line renders BLACK; per
  MAIN-HEADINGS-GREEN-001 the "Results:" label/line should be teal `#00746E`. The experience
  Results run likely uses a hardcoded colour instead of `mainHeadColor`/`mainSubHeadColor`. **Gate:**
  XML run colour == mainHeadColor; one CloudConvert PDF to confirm. Pairs with RESULTS-DOCX-MISSING.
- **AI-WATERMARK-EXPORT-LOCATION-001** [worker] — = old-open Watermark Lane 1.1. Spec
  `WM_AI_NOTICE_ANCHOR_SPEC_2026-06-16.md`. Do it HERE (Lane 0), once.
- **SECTION-TYPE-NORMALIZE-INLINE-001** [code, import path] — normalize `work_style`/`who_i_am`/
  `why_company`/`why_role` to `text_inline` on import (`antcv-data-importer.js` and/or the me()
  kernel) so the bold inline label renders for IMPORTED data (generation already emits text_inline
  post-1.50.497). **Gate:** import the owner's corrected JSON fixture, assert types normalized +
  inline label renders headless. mirror app.js if app.src.js touched.
- **INTERESTS-CONTENT-001 + ADDITIONAL-INFO-HIDE-WHEN-INTERESTS-001 + ADDITIONAL-INFO-SPLIT-001
  (item 8)** [code] — make INTERESTS a typed list (Rugby ops/asst-coach @ Copenhagen Wolves;
  Hiking; Tai-chi; Reading; "supervision of three feline napping experts"); hide ADDITIONAL INFO
  when INTERESTS shows; split Languages+Interests out of the merged `additional` section (prefer the
  restore-proof splitter in `antcv-sections-normalize-415.js`, option B). **Gate:** headless render
  of the owner's data shows the split + no duplicate hobbies. NOTE banned-word constraints apply.
- **CL-WIDTH-CAP-001 (+ CL-PREVIEW-TABLE-WIDTH-001 / CL-LAYOUT-002 old-open)** [worker + preview] —
  CL body/WHAT-I-BRING table doesn't fill usable width. Raise worker CL table fraction (0.8→higher)
  + preview `72%`/`maxWidth:540` cap (`app.src.js` ~5078), coordinate with the 0.14" margins.
  **Gate:** table fills body width Preview + DOCX + owner PDF. Folds the old-open CL-LAYOUT-002.
- **PDF-ASK-WHERE-TO-SAVE-001** [code] — route the PDF save through `showSaveFilePicker` when the
  "Ask where to save" checkbox is set (DOCX already does). **Gate:** needs a live click to confirm
  the picker fires — semi-autonomous; ship + owner one-click verify.

### 0.A CONTENT & EXPORT — owner-verify / regen-gated (prep, don't claim closed)

These are prompt-side or visual; a session can HARDEN the prompt / adjust a token but cannot judge
the result without an owner regen or PDF eyeball. Prepare the change, leave on the punch-list:
- **RESULTS-TIGHTENING-STRIP-001** — last "tighten to length" pass drops results on tail roles +
  Security Guard missing; needs a live before/after probe of `role.results` around the tightening
  pass + a regen. Investigate with RESULTS-METRIC-SHARPNESS-001.
- **RESULTS-METRIC-SHARPNESS-001 (9)**, **HIWC-ORPHAN-TIGHTEN-001 (10)**,
  **PROFILE-UNSOLICITED-GENERIC-001 (23)**, **DOC-SUPERVISION-001 (13)**,
  **EXP-TENSE-NOT-APPLYING-001 (12)** — prompt/generation-time; owner regen to judge.
- **BAND-HEADER-BG-SEAM-001 (24)** — regenerate fresh CV+CL then pixel-sample; likely pre-dates the
  1.50.486/1.14.68 band fixes. Owner eyeball.
- **SIDEBAR-NARROW-FIGURE-OVERLAP-001 (26)** — preview + worker float-wrap; visual, owner-present.
- **PREVIEW-EXPORT-PAGEBREAK-PARITY-001 (7)** — two-map measurer alignment; needs real multi-page
  doc + PDF (= old-open pagination, owner-present).
- **EXPORT-FALLBACK-ON-FIRST-001 (1) / CL-TABLE-DIMS-FALLBACK-001 (2)** — needs a LIVE console probe
  of why the first server-PDF throws after reset; do NOT speculatively edit the fetch chain
  (protocol). Owner-present probe.
- Already SHIPPED, owner-verify only: PROFILE-END-COMMUNICATION-001 (1.50.509), ROLE-DECOMP-001
  (1.50.508 — also needs DATA: Copenhagen Wolves ops role + Tel-Aviv guard into the D1 kernel),
  CV-CRITICAL-FIELDS/SIRIN-SEMANTICS/GEN-PROFILE-ENFORCE (1.50.497), the colour/lamination set.

### 0.B SETTINGS MODIFICATION

- **LANGUAGES-CARD-PERSONAL-001 (14)** [code + island] — Languages card fell below "Done" + its
  spelling/tense controls vanished. Root: Personal subtab (`yl` ~21217) has no flex-column wrapper,
  so the LanguageCard island anchor (`findSettingsFlexColumn`) fails. Fix: wrap Personal sections in
  `display:flex;flex-direction:column` (island anchors at order 20) + render Experience-Tense (+
  spelling) inside `yl` at order 22. **Gate:** card mounts in place, controls present, after hard
  refresh. UNBLOCKS the Personal half of EXP-TENSE-NOT-APPLYING-001. (Overlaps old-open Settings
  Lane 1.2 — coordinate; this is the higher-priority active item.)
- **DISCLOSURE-TRIANGLE-CONSISTENCY-001 (16)** [island/code] — add the ▸/▾ disclosure triangle
  (shipped for ADVANCED VISUAL STYLES 1.50.480) to the other Advanced collapsibles. Deterministic.
- **SETTINGS-SCROLL-RESET-001 (15)** — settings modal jumps to top on scroll (a re-render resets
  scrollTop). Needs a live probe of which state churn / island remount resets it. Owner-present.

### 0.C NEW FEATURES (last, per owner)
Islands, deterministic builds, lower priority: SECTION-LAYOUT-GRAPHIC-001 (17) +
OUTCOMES-FORMAT-RESULTS-OPTION-001 (18) [LayoutPicker island, format-shape preview + 'results'
option], CL-FORMAT-CONTROL-001 (19), SUBSECTION-RENAME-REORDER-001 (20), EXPORT-PREVIEW-ZOOM-001
(21, `antcv-pdf-preview-gate.js` `--antcv-fit`). Do only after 0.A/0.B and Lanes 1–2.

---

## LANE 1 — Old-open autonomous-viable (after Lane 0)

### 1.1 Watermark — see Lane 0.A `AI-WATERMARK-EXPORT-LOCATION-001` (same work; do once).

### 1.2 Settings — Visual-package relabel + writing-style merges  [code + islands]
Spec `SETTINGS_VISUAL_PKG_SPEC_2026-06-16.md`. VISUAL-PKG-001 (relabel + island regex widen, same
release or the card orphans), MERGE-DUP-001 (hide legacy select, keep+bridge buttons; probe the
node first), MERGE-DUP-003 (tones→customs copy). Coordinate with Lane 0.B
LANGUAGES-CARD-PERSONAL-001 (same Settings surface). VISUAL-PKG-002/003 already shipped — close
after a live look.

### 1.3 Cover letter — capture table data in CL generation  [proxy]  ← absorbs GEN-002b
CL-006: `generate_cl` doesn't emit WHAT-I-BRING table rows (+ WHY-THIS-POSITION bullets); the
docx-worker already renders them. Proxy prompt/schema change, mirror proxy→demo-proxy. **Gate:**
generate unsolicited + JD-grounded CL, assert populated table rows in the payload (headless).

---

## LANE 2 — Relay-pending verification + deploy (early, relay perm required)
FIX SHIPPED but stranded on a relay deploy — deploy via `deploy.yml`, then verify; schedule EARLY so
owner can eyeball:
- **KERNEL-CLOUD-PERSIST-001** (1.50.221) — generate showcase → save → reload → kernel persists.
- **APPHISTORY-SAME-LINE-001** (1.50.223) — same deploy; app-history line renders correctly.
- **KERNEL-STUCK-LAST-CMD-001** (1.50.220) — retagged client-side React state, NOT relay-dependent;
  confirm the retag holds once the bundle is live.
Do NOT blind-edit — app-shell/kernel-persist paths with prior incident history.

---

## LANE 3 — Optimization (headless-measurable, low blast radius)
Performance cluster mostly closed (PERF-003/004 shipped, RERENDER-STORM + HIWC-RERENDER-LOOP
resolved + regression-locked). Safe autonomous work: **sidecar consolidation continuation** (the
G-series single-observer merge pattern; ~90 sidecars still loaded — merge pairs that share a surface
+ observer, behaviour verbatim, originals kept on disk unreferenced; **gate:** behaviour-identity on
a boot smoke). PERF-001 only if a headless measurement shows a concrete hotspot. PERF-002/005 +
live-rendered perf are owner-present.

---

## LANE 4 — Testing / regression hardening (always-on, no deploy risk)
- WM unit test (spec §7); RESULTS-DOCX XML-presence test; CL-006 payload test.
- **app.src.js↔app.js mirror guard** CI — key string literals match between source + minified
  bundle. Cheap, high value (the mirror is a recurring failure mode).
- import-normalize drift guard — extend the existing 18 tests with new fixtures.
- **TC-028 Publications-stress fixture** — author now to unblock the (owner-present) list-row session.
- New fixes register invariants in `antcv-regression-sweep-341.js`.

---

## LANE 5 — Wizard + Settings/Personal UX (this session, owner screenshots 1.50.521)

Full spec: `docs/qa/WIZARD_SETTINGS_UX_2026-06-16.md`. Seven issues, roots VERIFIED in source. Two
wizard surfaces: app.js stepped wizard (STEP 2/6A/6C) vs the `antcv-wizard-language-slide-339.js`
sidecar modal ("Set your languages"). #1/#2/#3 are a kernel-import + data-importer sidecar pileup,
NOT app.src.js.

### 5.1 Kernel-button dedup + scope  [antcv-kernel-import.js]  — covers #1 and #3
`injectEntry()` inserts a kernel button after EVERY matched anchor (data-importer replacement + the
pdf+docx file input + a broad text regex) → duplicated in Personal (#1) and sprayed across wizard
steps via the documentElement observer (#3). FIX: panel-level dedup (one button per host container);
drop the broad text-match anchor source #2; scope injection to Settings→Personal + the single 6A
ingest step. **Gate:** exactly one kernel button in Personal; pill absent on STEP 2 / 6C / language
slide; present on 6A + Personal. Sidecar-only, `?v` bump.

### 5.2 ONE type-routed SUPERSET ingest button (A)  [antcv-kernel-import.js + antcv-data-importer.js]  — #2
**OWNER DECISION: (A), AND OWNER-AUTHORISED to proceed on the direction the code-check dictates
(see CODE-CHECK below).** One primary "Build / update kernel from CV" button, file input accepting
the UNION `.docx,.pdf,.txt,.json,.png,.jpg,.jpeg,.webp`, routing by file type so NO capability
regresses. The two engines are NOT interchangeable — only the data-importer does photo / VIA→workStyle
/ banned-words→stylePrefs / AntcvBackup restore; only kernel-import does structured roles + conflict/
gap review + save-to-account. Route: image→handleImage, VIA pdf→handleVIA, banned-words docx→
words-docx, AntcvBackup json→restore, kernel json / plain CV→kernel runImport (keep its review
governance). data-importer stops injecting its own visible button (keeps its modal+handlers as the
library the router calls). **Gate:** one ingest button; one file of EACH of the 6 source types still
reaches its correct handler; kernel conflict/gap review still appears. Do AFTER 5.1.

  CODE-CHECK (at implementation time) + OWNER AUTHORISATION (granted 2026-06-16):
  - Check whether `window.AntcvDataImporter` already exposes `classify()` + the per-type handlers
    (`handleImage`, `handleVIA`, the words-docx + AntcvBackup-json routes).
  - IF EXPOSED → the router in `antcv-kernel-import.js` calls them directly; this is the light path.
  - IF NOT EXPOSED → add a minimal public API on `antcv-data-importer.js`
    (e.g. `window.AntcvDataImporter = { classify, route(file) }`) that runs the existing internal
    handlers, then have the kernel-import router call it. Keep the data-importer's modal/summary/
    confirm + non-destructive write scheme intact; expose, do not duplicate, the logic.
  - The owner authorises proceeding on EITHER path per the check result without a further sign-off,
    PROVIDED the no-capability-regression gate above passes (test all 6 source types) and the change
    stays inside these two sidecars (no app.src.js, no worker). If the check reveals the only safe
    way needs an app.src.js or worker change, STOP and surface it (out of the authorised scope).

### 5.3 Personality-quiz button → 6C  [antcv-wizard-language-slide-339.js + app.js]  — #6
Remove `pqBtn` from the language sidecar's handoff block (`?v` bump); add the same button to the
app.js STEP 6C tone slide (opens `window.AntcvPersonalityQuiz.open()` / `antcv:open-personality-quiz`
— launcher already loaded, relocation only) + mirror app.js. **Gate:** absent on language slide,
present + functional on 6C.

### 5.4 Spellchecker + tense on the languages slide  [antcv-wizard-language-slide-339.js]  — #7
Add a compact tense (Present/Past, via `window._antcvSetExpTense`) + spellchecker control (the
`antcv-spell-annotator-384.js` toggle) under the language picker, writing the SAME stores the
Personal controls use. `?v` bump. **Gate:** both present, persist, reflect in Settings→Personal +
generation. Overlaps Lane 0.B LANGUAGES-CARD-PERSONAL-001 (one store, two surfaces).

### 5.5 Section-format showcase: collapsible + Layout visuals + mount fix  [island + sidecar]  — #4
`WizardSectionShowcase.tsx` is a static always-expanded tile grid and isn't mounting in the sidecar
modal on mobile. Wrap in a collapsed-by-default `<details>`; reuse the Layout tab's
`SectionFormatPicker` previews (read-only) so the surfaces match (also satisfies old-open
SECTION-LAYOUT-GRAPHIC-001 / Lane 0.C item 17); fix the mount so the island attaches inside the
`z-index:2147483647` backdrop. Vite build + `?v`. **Gate:** collapsed by default, expands on tap,
Layout-style previews, on mobile.

### 5.6 6A second CV upload  [sequence-dependent on 5.1]  — #5
Likely the kernel pill landing on 6A; 5.1 should remove it. After 5.1, re-check 6A; if a NATIVE
second upload remains, locate STEP 6A in app.src.js ("Drop a CV or LinkedIn export here") and remove
the redundant control + mirror app.js. **Gate:** one upload control on 6A.

Lane 5 autonomy: 5.1, 5.2 (authorised both paths), 5.3, 5.4, 5.5 are autonomous-viable
(sidecar/island, build-verifiable). 5.6 is sequence-dependent (after 5.1).

---

## LANE 6 — Language expansion (LANG-EXPAND-001 + 002 second wave)

Full spec: `docs/plan/LANG-EXPAND-001.md` (first wave §1–§8 + second wave §9). Generation-pipeline
only (the UI string layer is separate). This is a STAGED build behind a hard prerequisite — NOT a
single autonomous sweep. Target set after both waves: 24 base languages + 1 variant (ar-EG).

Standing rule for the whole lane: every language touches `workers/proxy/src/writing-style-engine.js`
AND its byte-identical twin `workers/demo-proxy/src/writing-style-engine.js` (proxy first, separate
CI deploys) + `writingSystems/registry.json` + `skills/antcv-writer/references/language-output.md`.
Tier-2/3 also touch docx-worker + Preview CSS. registry-sync.test.mjs must stay green in BOTH workers.

### 6.0 PREREQUISITE GATE — LANG-EXPAND-001-A (BCP-47 migration)  [BLOCKS everything below]
One-time breaking-internal change (spec §2): `LangCode`→BCP-47 in `src/lib/writing-systems.ts`;
`normaliseLangCode` accepts BCP-47 + maps legacy aliases (en→en-GB, pt→pt-BR, zh-CN/cn→zh,
ar-*→ar, unknown→en-GB); registry.json + registry.schema.json key-pattern (^[a-z]{2}$ → BCP-47);
engine SUPPORTED_LANGUAGES (both workers); language-output.md code refs; lang-bar-filter regex
^[a-z]{2}$ → accept xx-XX. No data migration (normaliser is the read-side compat layer).
**Gate:** registry-sync.test.mjs green in both workers; en/da/es/zh generations behaviour-identical
(en resolves to en-GB). NOTHING in 6.1–6.5 starts until this lands. Autonomous-viable but
high-blast-radius — land it alone, verify, then proceed.

### 6.1 Tier 1 — registry-only, no fonts/layout  [autonomous-viable]
Languages: it, pt-BR, en-US (first wave) + fr, de, id, sw, kl, fo, qu, and ru (Tier 1.5) (second
wave). Per language: registry entry + sharedBannedBases + a language-output.md section (register,
salutation/sign-off, banned items, density). en-US is a variant of en-GB (spelling transform table).
ru "Tier 1.5" adds ONE extra check: Cyrillic glyph coverage in the DOCX heading font (Sans Serif
Collection) — if absent, map heading→Noto Sans (Tier-2 remap pattern), else pure registry-only.
**Per-language gate:** generate CV+CL headless in the language; banned-list enforced; salutation/
sign-off correct; no engine error. **Owner/native-review gate:** sw, kl, fo, qu need native review
before ACTIVATION (build + stage, do not flip live); fr/de/id/ru in-house-reviewable.
Variant decisions to honour: qu → Southern Quechua default (tag `qu` vs `qu-PE` still open, §9.5.7).

### 6.2 Tier 2 — fonts + complex/non-Latin script, LTR  [autonomous build, native-review gate]
Languages: hi, am (first wave) + ko (Noto Sans KR), bn (Noto Sans Bengali), ja (Noto Sans JP)
(second wave). Adds on top of Tier 1: on-demand Preview font load (only when active lang needs the
script, never for Latin sessions); docx-worker complex-script run props (w:rFonts cs= + w:szCs
mirroring w:sz); heading-font remap to the Noto face (Sans Serif Collection lacks these scripts);
CloudConvert PDF font-embedding verification on first conversion. DENSITY: ja + zh are char-count
not word-count; ko + kl need a density recalibration pass after first real generations. **Gate:**
Preview/DOCX/PDF/desktop+mobile parity, NO tofu glyphs in any export. Native review before activating
hi, am, ko, bn.

### 6.3 Tier 3 — RTL  [partly owner-present]
Languages: he, ar, ps (first wave) + ur (second wave). Full RTL mirroring (spec §5): Preview
dir="rtl" + logical text-align (audit physical left/right CSS) + grid/column flip; docx-worker
w:bidi + w:rtl + reversed table column order + sidebar/main cell swap + photo-placement mirror; PDF
follows each path; Western numerals enforced; mixed-direction Latin tokens via Unicode bidi (QA must
include bullets mixing RTL text with Latin acronyms + numbers). Implementation order he → ar → ps →
ur. FONT CAVEATS: ps needs extended-glyph coverage (Noto Naskh/Sans Arabic — verify ټ ډ ړ ږ ښ ګ ڼ ۀ);
**ur is NASTALIQ not Naskh → Noto Nastaliq Urdu, do NOT reuse the ar/ps Naskh face; verify Nastaliq
vertical metrics don't break DOCX/PDF line height.** RTL layout mirroring is high-blast-radius +
visual → **owner-present for first-language (he) bring-up**; ar/ps/ur follow the validated he path.
ATS-Legacy stays LTR+warning until the §8.3 parser test. Native review before activating ar, ps, ur
(he in-house).

### 6.4 Variant — ar-EG (Egyptian Arabic) as a variant of ar  [autonomous-viable, after 6.3 ar]
NOT a separate language (spec §9.2a) — the en-GB→en-US pattern. Inherits ar wholesale (script, RTL,
fonts, numerals, all §5 machinery); differs ONLY as a spelling/register package (Egyptian vocabulary
+ phrasing where register allows, kept CV-appropriate). normaliseLangCode: ar→MSA, ar-EG (+ aliases
"egyptian","masri")→variant, unknown ar-*→ar. registry: ar variant entry sharing ar's
sharedBannedBases + a small delta; language-output.md ar-EG sub-section under ar. **Gate:** ar-EG
generates with Egyptian register, inherits ar's RTL/font/numerals with zero new layout work; ar
unaffected. Needs Egyptian-Arabic native review (lighter than a full language). Depends on 6.3 ar.

### 6.5 Lang bar — selected-subset model  [code + island; MANDATORY at this scale]
Spec §6 + §9.4. With ~25 entries the 6-button cluster cap is unworkable. Implement the
selected-subset model: user picks default languages in the onboarding wizard AND Settings → Personal;
the bar shows only the selected subset. `pwa/antcv-lang-bar-filter.js`: extend LABEL_TO_CODE for all
new labels (italiano, português, français, deutsch, bahasa, kiswahili, kalaallisut, føroyskt, runa
simi, русский, 한국어, বাংলা, اردو, 日本語, العربية (مصري)/egyptian→ar-EG, english (us), עברית, العربية,
हिन्दी, پښتو, አማርኛ); raise/remove the cluster cap once the subset guarantees small visible counts.
SHARES SURFACE with Lane 0.B LANGUAGES-CARD-PERSONAL-001 + Lane 5.4 (languages slide) — coordinate:
the onboarding/Settings language picker is the same store the subset model reads. **Gate:** subset
selection persists, bar renders only selected, after hard refresh, desktop + mobile.

### 6.6 Dictionaries + language selectors EVERYWHERE  [cross-cutting; spans all surfaces]
Per owner 2026-06-16: adding generation languages is only half the job — the **spellcheck/proofing
dictionaries** and the **language selector UI** must roll out to EVERY surface that touches language,
or the experience fractures (a language you can generate in but can't proof, or can pick in one place
but not another, is worse than not having it). Two parallel coverage requirements:

**A. Dictionaries (proofing/spellcheck) per language.**
- The spell layer (`antcv-spell-annotator-384.js` + the spellchecker control surfaced in Lane 5.4 /
  Lane 0.B) must have a dictionary for EACH activated language, or degrade GRACEFULLY (clearly
  "no proofing for <lang> yet" — never silently mark every word wrong, never block the field).
- Per language: confirm a dictionary source exists (browser-native `spellcheck`/`lang` attribute
  coverage where the engine relies on it; or the bundled/host dictionary the annotator uses). RTL
  (he/ar/ar-EG/ps/ur) + complex-script (hi/am/bn/ko/ja) + Cyrillic (ru) need explicit verification —
  do NOT assume the Latin path covers them. Where no dictionary exists, ship the language with
  proofing DISABLED for it + a one-line notice, rather than a broken red-underline-everything state.
- ar-EG inherits ar's dictionary (variant, like en-US↔en-GB); qu/kl/fo likely have thin or no
  dictionary support — flag, ship proofing-disabled if so.
- **Gate:** for each activated language, the spell control either proofs correctly OR is cleanly
  disabled with a notice; never a false-positive storm; verify on desktop + mobile.

**B. Language selector parity across surfaces.**
The selector must be present, consistent, and driven by ONE shared store on every surface:
onboarding wizard language slide (Lane 5.4), Settings → Personal Languages card (Lane 0.B
LANGUAGES-CARD-PERSONAL-001), the lang bar (6.5 selected-subset), AND any per-section / per-document
language control. Same label set (6.5 LABEL_TO_CODE), same selected-subset, same persistence.
- Single source of truth: the onboarding/Settings picker, the lang bar, and the spell/tense controls
  all READ AND WRITE the same store (the one Lane 5.4 + 0.B already converge on) — a change in one
  surface reflects in all others without a reload.
- No surface may offer a language the others can't (selector parity) and no surface may offer a
  language whose dictionary/font isn't ready (gate against half-rolled languages appearing pickable).
- **Gate:** pick a language in the wizard → it shows selected in Settings + lang bar; toggle the
  subset in Settings → lang bar updates live; spell/tense controls reflect the active language; all
  after hard refresh, desktop + mobile. No surface shows a language the others don't.

Autonomy: B (selector parity) is autonomous-viable and rides on 6.5 + Lane 0.B/5.4 — do it in the
SAME Settings/lang pass so the shared store is wired once. A (dictionaries) is autonomous to wire the
graceful-degrade + per-language check, but actual dictionary CONTENT for non-Latin/RTL/thin-support
languages may need sourcing decisions — flag those, ship proofing-disabled-with-notice as the safe
default. This sub-lane is the "rollable everywhere" guarantee: NO language is considered DONE (its
6.1/6.2/6.3 close) until its selector appears on every surface AND its dictionary either works or is
cleanly disabled.

### Lane 6 autonomy summary
- **Autonomous-viable:** 6.0 (alone, verify), 6.1 (build+stage; native-review gate before activating
  sw/kl/fo/qu), 6.2 (build; native-review gate before activating), 6.4 (after 6.3 ar), 6.5,
  6.6-B (selector parity, rides 6.5 + Lane 0.B/5.4). 6.6-A dictionaries: wire graceful-degrade
  autonomously; non-Latin/RTL dictionary CONTENT may need a sourcing decision (flag).
- **Owner-present:** 6.3 he bring-up (RTL layout, high blast radius); ar/ps/ur follow the he path.
- **Open decisions (spec §9.5):** qu tag (`qu` vs `qu-PE`); density recalibration for ja/ko/kl after
  first real generations; ATS-Legacy RTL parser test (§8.3).
- **Sequence:** 6.0 → (6.1 ∥ 6.2 builds) → 6.3 (he first, owner-present) → 6.4 (ar-EG, after 6.3 ar)
  → 6.5 (lang bar; can build in parallel but only ships value once languages exist)
  → 6.6 runs ACROSS all of the above: a language isn't DONE until its selector is on every
  surface (6.6-B) AND its dictionary works or is cleanly disabled (6.6-A). Wire 6.6-B in the
  same Settings/lang pass as 6.5 + Lane 0.B/5.4.

---

## Do NOT attempt autonomously (owner-present, probe-first)
List-row controls (PP/SO/TB/move, 7 prior failed iterations, TC-028-gated); pagination remainder
(PB-*, PAGEBREAK, PB-SIDEBAR, PDF-LAYOUT, + active item 7); Mobile (all 7); Candidate/application
(CA-001..005); CL body/overlay controls (CL-001/003/004/005/CL-BODY-CONTROLS-001); LOGIN-GATE-001 +
VAL-001 (app-shell, blue-screen history); EXPORT-FALLBACK-ON-FIRST/CL-TABLE-DIMS-FALLBACK
(live probe); SETTINGS-SCROLL-RESET-001; SIDEBAR-NARROW-FIGURE-OVERLAP-001; all prompt-side/regen
items in Lane 0.A's owner-verify list.

Lane 5: SETTINGS-SCROLL-RESET-001 stays owner-present (live probe). Lane 5.6 only escalates to app.src.js if a NATIVE second upload remains after 5.1. Lane 5.2 escalation beyond the two sidecars (to app.src.js/worker) is OUT of the granted authorisation — STOP + surface.

Lane 6: the BCP-47 migration (6.0) is a hard prerequisite gate — nothing in 6.1–6.5 starts until it lands + verifies. RTL bring-up (6.3 he) is owner-present (layout-mirroring blast radius); ar/ps/ur follow the validated he path. Languages needing native review (sw/kl/fo/qu/hi/am/ko/bn/ar/ps/ur + ar-EG) are BUILD-then-STAGE — do not flip live without review. A language is NOT done until its selector appears on EVERY surface (wizard, Settings, lang bar, per-section) reading one shared store AND its dictionary either proofs or is cleanly disabled with a notice — never a false-positive storm (6.6).

## Dissolved / already shipped (disposition only)
Generation/content (11 gates + 2 shipped + 2 relocated → GEN_DISPOSITION_2026-06-16.md);
Generation UI (live dedup); Planned features (DELETE-SAVE shipped; FEATURE-CONF-001 PARTIALLY
shipped — confidence overlay `antcv-confidence-overlay-386.js` @1.50.386); Photo (427 consolidation);
Preview-shell/nav-z (SETTINGS-NAV-Z family @1.50.355); much of Layout/export/responsive (EXPORT-001
worker 1.14.66); Performance (above). IMPORT-COUNT-001 + WIZARD-002 + CL-HEADER-001 +
APP-SENTENCE-STYLE-001 + the 2026-06-15 colour/lamination/JD-cloud set all FIXED.

---

## Suggested session order
1. **LANE 2** relay deploy + verify (early, owner eyeball).
2. **LANE 0.A worker batch**: RESULTS-DOCX-MISSING + RESULTS-PDF-INK-BLACK + AI-WATERMARK (one
   worker deploy) → headless XML/unit gates → one CloudConvert PDF.
3. **LANE 0.A code batch**: SECTION-TYPE-NORMALIZE-INLINE + INTERESTS/ADDITIONAL-INFO split (+ mirror).
4. **LANE 1.3 / CL-006** (proxy) + **CL-WIDTH-CAP** (worker+preview) → deploy.
5. **LANE 0.B / LANE 1.2** Settings: LANGUAGES-CARD-PERSONAL + VISUAL-PKG-001 + MERGE-DUP-001/003 +
   DISCLOSURE-TRIANGLE (one island build + app.js mirror).
6. **LANE 5 wizard/Settings UX** (this session): 5.1 kernel-button dedup+scope (covers #1/#3) →
   re-check 5.6 (6A) → 5.2 ONE superset ingest button (owner-authorised: follow the code-check
   result across both sidecars; STOP only if it would need app.src.js/worker) → 5.3 quiz→6C →
   5.4 spell/tense on languages slide → 5.5 showcase collapsible+Layout previews+mount fix.
   Note 5.2/5.4 share surfaces with Lane 0.B LANGUAGES-CARD-PERSONAL + Lane 1.2 — do the Settings
   work in one pass so islands rebuild once.
7. **LANE 4** tests landed alongside each; author TC-028 + mirror-guard CI; add Lane 5 gates
   (one-button + 6-source-type routing for 5.2; quiz-relocation; showcase mount).
8. **LANE 3** sidecar-merge only if time remains.
9. **LANE 6 language expansion** (LANG-EXPAND-001/002): land 6.0 BCP-47 migration ALONE + verify
   (registry-sync green both workers, en/da/es/zh behaviour-identical) → then Tier 1 (6.1) +
   Tier 2 (6.2) builds (native-review gate before activating) → 6.3 RTL he bring-up OWNER-PRESENT,
   ar/ps/ur follow → 6.4 ar-EG variant (after ar) → 6.5 selected-subset lang bar. Coordinate 6.5 +
   Lane 0.B LANGUAGES-CARD-PERSONAL + Lane 5.4 (same language-picker store). 6.6 rides this:
   selector parity on every surface + per-language dictionary (works or cleanly disabled).
   A long multi-session effort — 6.0 is the only thing that must precede the rest.
10. **LANE 0.C** new features only if everything above is clean.
Each task: spec → implement → headless gate → deploy → record. Leave regen/PDF/live-device eyeballs
as a short owner punch-list (most of Lane 0.A's second list + 0.B SETTINGS-SCROLL + 0.C).
