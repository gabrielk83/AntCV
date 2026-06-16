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

## Do NOT attempt autonomously (owner-present, probe-first)
List-row controls (PP/SO/TB/move, 7 prior failed iterations, TC-028-gated); pagination remainder
(PB-*, PAGEBREAK, PB-SIDEBAR, PDF-LAYOUT, + active item 7); Mobile (all 7); Candidate/application
(CA-001..005); CL body/overlay controls (CL-001/003/004/005/CL-BODY-CONTROLS-001); LOGIN-GATE-001 +
VAL-001 (app-shell, blue-screen history); EXPORT-FALLBACK-ON-FIRST/CL-TABLE-DIMS-FALLBACK
(live probe); SETTINGS-SCROLL-RESET-001; SIDEBAR-NARROW-FIGURE-OVERLAP-001; all prompt-side/regen
items in Lane 0.A's owner-verify list.

Lane 5: SETTINGS-SCROLL-RESET-001 stays owner-present (live probe). Lane 5.6 only escalates to app.src.js if a NATIVE second upload remains after 5.1. Lane 5.2 escalation beyond the two sidecars (to app.src.js/worker) is OUT of the granted authorisation — STOP + surface.

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
9. **LANE 0.C** new features only if everything above is clean.
Each task: spec → implement → headless gate → deploy → record. Leave regen/PDF/live-device eyeballs
as a short owner punch-list (most of Lane 0.A's second list + 0.B SETTINGS-SCROLL + 0.C).
