# Batch triage — 2026-06-04 (owner feature + bug dump)

Single working list for the owner's 2026-06-04 batch. Each item has an ID, a
one-line statement, the **layer** it lives in, and a **verdict**:

- **SIDECAR** — fixable with a readable `pwa/*.js` sidecar or CSS. Low-hanging.
- **APP.JS** — lives in minified `app.js` (or the React islands + app.js mount).
  Needs a built/tested change, not a blind sidecar. Goes to the register.
- **WORKER** — needs a Cloudflare Worker / LLM-contract change.

Discipline (CLAUDE.md): per-field bridges into `app.js` state are the wrong
shape. Where an item is APP.JS, it is registered for a tested pass, not patched
blind.

Landed this batch: **JD-TEXTAREA-001**, plus the high-priority
**PRIVACY-FAB-FLICKER-001** (background bleep) — see ACTIVE_BUGS.md.

---

## NEW FEATURE — confidence visualization

### FEATURE-CONF-001 — per-sentence confidence overlay (Application tab toggle)
**Owner ask:** in the Application tab, add a button (default OFF) that shows the
app's confidence in the document content. When ON, colour sentence-level text:
low confidence = reddish, medium = yellowish; hovering a coloured sentence shows
the issue / confidence level. Only active while the toggle is ON.

**Locked-source check:** NOT covered. The two locked docs
(`Unified_Visual_Package_System.docx`, `Writing_System_Engine_Specification.docx`)
use "confidence" only in the *tone* sense ("controlled professional confidence",
"exaggerated confidence" — Measured Professional / restraint registers). There is
no output-confidence / uncertainty-surfacing concept in either. This is a net-new
capability and needs its own design entry before build — raise with the owner
whether it belongs in the Writing System spec as a new "Verification / confidence"
section.

**Layers:** WORKER + APP.JS + UI (sidecar can only render, not source the data).

**Why it is not low-hanging:** the colour is only meaningful if the *model*
returns a per-sentence confidence + reason. That requires:
1. **WORKER / LLM contract:** the generation (and/or a follow-up "self-check"
   pass) returns, per sentence/bullet, `{ text, confidence: 0..1, issue: string }`.
   Cheapest path: a second low-cost pass over the generated CV/CL that scores each
   sentence against the candidate's source facts (grounding check) and flags
   unsupported claims. Store on the doc payload.
2. **APP.JS:** persist the confidence map alongside the generated sections so it
   survives edits/re-renders, and expose the Application-tab toggle (default off)
   in app state.
3. **UI (sidecar-friendly once data exists):** when the toggle is on, wrap each
   preview sentence in a span tinted by band (red < ~0.4, yellow ~0.4–0.7, none
   above), `title`/tooltip = `issue` + numeric confidence. Re-apply on re-render.
   Toggle off → strip the tinting.

**Bands (proposed):** low `rgba(200,40,40,.14)` text/underline reddish; medium
`rgba(217,160,20,.16)` yellowish; high = untinted. Keep ATS/export output
unaffected — tinting is preview-only, never serialised into DOCX/PDF.

**Recommendation:** scope as FEATURE-CONF-001 (worker self-check pass + app.js
toggle + preview renderer). The renderer is a small sidecar; the data source is
the real work.

---

## PRIORITY BUG — DOCX export regression

### DOCX-EXPORT-REGRESSION-001 — export from print-setup view doesn't fire DOCX
**Owner:** the DOCX export bug is back. Reason: the original DOCX button was wired
to work only in the **preview panel**, but export is now driven from the **print
setup** view, which doesn't invoke the same handler. "Find all bug fixes that
worked and apply them to the last version and merge branches."
- **Map:** `pwa/antcv-docx-client.js` exposes `exportDocxViaWorker(payload)`
  (module, index.html ~250). The *gating* — which view's export button calls it —
  is in minified `app.js`. No print-setup DOCX path is visible in the sidecars.
- **Layer:** APP.JS (button wiring) — plus a **branch-archaeology** task: locate
  the commit/branch where the preview-panel DOCX export was fixed, confirm the
  fix, and re-apply it to the print-setup export trigger on the current version.
- **Action (registered, needs the owner / a tested pass):** (1) `git log`/branch
  search for the prior DOCX-export fix; (2) identify the print-setup export
  button's handler in app.js; (3) route it through `exportDocxViaWorker` with the
  same payload the preview-panel button builds; (4) merge the relevant branch
  forward. A sidecar *could* intercept the print-setup export click and call
  `window.exportDocxViaWorker` if the button has a stable selector — to be
  confirmed against the live print-setup DOM.

---

## PAGE-BREAK CLUSTER

Sidecars in play (readable): `antcv-page-breaks-everywhere-284.js` (draws
`▼ PAGE N ▼`), `antcv-sidebar-subsection-pagebreaks-329.js`,
`antcv-page-button-polish-327.js` (button colours).

| ID | Statement | Layer | Verdict |
|----|-----------|-------|---------|
| PAGEBREAK-001 | Page break missing in the **document EXPORT preview** | APP.JS + sidecar | export preview is a different render path; the everywhere-284 sidecar keys off the editor preview DOM. Register: confirm export-preview DOM, extend marker injection. |
| PAGEBREAK-002 | Page break should show **on entry** to preview and on **natural A4 overflow**, not only after pressing the page button | SIDECAR (284) | 284 shows the marker on entry only when `antcv:itemPages` has a stored page ≥2. It does not measure real A4 overflow. Register: add an overflow probe (measure content vs A4 height) to auto-insert. |
| PAGEBREAK-003 | Continuation header "📄 PAGE 2 — EXPERIENCE (CONT.) header appears here ▼" above the new-page section | SIDECAR (284/329) | extend the continuation-header rendering to all sections. Register with 005. |
| PAGEBREAK-004 | Pressed page button changes colour | — | reported working; confirm only. |
| PAGEBREAK-005 | **Cascade** colour: ALL page buttons after the pressed one recolour — across **all CV sections AND the cover letter** (today only Professional Experience) | SIDECAR (327/329) | extend the cascade in `page-button-polish-327` beyond Professional Experience to every section + CL. Plausible sidecar work; needs the live button DOM for CL to confirm selectors. Register with a precise plan. |

---

## VISUAL / STYLE PACKAGE

| ID | Statement | Layer | Verdict |
|----|-----------|-------|---------|
| VISUAL-PKG-001 | Rename the app.js panel label **"STYLE PACKAGE" → "Visual package"** | APP.JS | the React island already renders "VISUAL PACKAGE"; the legacy app.js panel label still says "STYLE PACKAGE". Sidecar could relabel the text node, but it is one of several duplicate-merge items (MERGE-DUP) — fold into that pass. |
| VISUAL-PKG-002 | Each package button shows **icons + the functionality the package enables** (palette, font, shape, photo size) — as the package-card detail does | REACT/APP.JS | PackagePicker island work. |
| VISUAL-PKG-003 | Layout-subtab **Alt** buttons keep the Personal-tab head/sidebar-pair functionality; show swatches; **move** the "Segoe UI · circle · 120px" descriptor out of the package card to sit next to the Alt circles; add caption "Within **the selected visual style**. Two ready-made head/sidebar pairs are part of the package — picking one does not switch to Custom." | REACT (PackagePicker/LayoutPicker) | island work. |

---

## SETTINGS PANEL — duplicates, layout, headings

| ID | Statement | Layer | Verdict |
|----|-----------|-------|---------|
| MERGE-DUP-001 | Merge the two **Writing style** selects (legacy "WRITING STYLE" + new "Writing style — was X") into one, keep the new copy's id→"was X" mapping & description | REACT + sidecar | **Finding 2026-06-04:** the "new copy" is the React island `src/islands/WritingStylePicker/WritingStylePicker.tsx`, which owns the REAL engine (`setWritingStyleWithCascade`, `saveCurrentAsSlot`, banned-list, tone-chip catalogue via `src/lib/writing-prefs`). The "Original" is the legacy **app.js** UI. `antcv-personal-tab-dedup-341.js` (loaded) already hides the island copy + bridges the *style-select value* both ways — but not the richer functions, and on the latest capture the island nodes are unmarked (the hide isn't firing). Needs a live probe + an owner decision on which engine wins (see below). |
| MERGE-DUP-002 | Merge duplicate **Preferred tone / "Tone chips"** sections; the first active tone chip is a broken run-on string ("calm and direct… explicit.") that should be split/normalised; move the 6 tone chips into the original section | REACT + sidecar | dedup-341 §4 already splits the run-on chip on sentence boundaries; same root as 001. |
| MERGE-DUP-003 | Merge "save tones" into "save customs" ("+ Save current as new slot" duplicate vs the Custom-slot save/load/clear) | REACT + sidecar | the save-slot engine is `saveCurrentAsSlot`/`loadSlot`/`deleteSlot` in `writing-prefs`; same root as 001. |
| SETTINGS-HEAD-001 | Unify ALL settings headlines to the collapsible **"▸ …"** font/style; place "Languages in the top bar" immediately **after** the WRITING STYLE label | REACT/APP.JS | |
| SECTION-LAYOUT-001 | Move **Section layout** from Personal tab to **below Writing styles**; collapsible, **collapsed by default**; update when writing style changes; out-of-definition edits save to a **custom** writing style | REACT (LayoutPicker) + APP.JS | |
| LOCATION-001 | Personal panel: **remove** the combined Location input; add **two** alternatives (Location, City) that **load from and write to** user data; relabel city→"Location", keep country | APP.JS | extends the earlier queued Location decision. |
| DEMO-WARN-001 | Demo user should NOT see "⚠ Setup needed" when the demo config is valid | APP.JS | badge gated in app.js; sidecar could hide it but needs a demo-valid signal — register. |
| PRIVACY-SETTINGS-001 | Privacy 🛡 FAB should be **hidden in the Settings view** | SIDECAR? | privacy-led/topbar-tools own it; needs a stable "settings open" signal to gate on — register, confirm signal live. |

---

## WIZARD + IMPORT

| ID | Statement | Layer | Verdict |
|----|-----------|-------|---------|
| WIZARD-001 | Step 6b must be **scrollable** — the Next button is unreachable | APP.JS | wizard card in app.js (`_wiz_file_input`, "Step 6b — walk-through"). Sidecar could add `max-height/overflow:auto` to the card, but there is no stable selector — register, confirm a hook live. |
| WIZARD-002 | Add a missing **Step 6d**: default-languages selection + inform the user about the Personal / Layout / Advanced-Style settings panels where they keep control | APP.JS | new wizard step. |
| PHOTO-PLACEMENT-001 | Only the **sidebar** photo positions render in the preview; header-left/right, main-left/right, and sidebar-bridge do nothing | APP.JS | `antcv-format-prefs.js` only writes the placement pref + asks React to re-render; the actual photo-at-position render lives in app.js, which honours sidebar positions only. Register: implement the non-sidebar placements in the preview render. |
| IMPORT-COUNT-001 | Upload extract count wrong: shows "0 work · 0 education · N certs · 0 publications" — should reflect the real 6 work / 3 education / 2 publications etc. | APP.JS | `antcv-upload-recount-339.js` recomputes from `personalInfo.workHistory/education/publications`; if those arrays are empty the importer wrote the data elsewhere. Root is the **importer→personalInfo mapping** in app.js, not the recount sidecar. |

---

## Landed this batch (SIDECAR)

- **JD-TEXTAREA-001** — `antcv-analysis-panel-jd-block-356.js`: JD textarea
  `min-height` 96→48px (stops hiding the rows below); host panels
  (`.antcv-editor-side-panel`, `.antcv-mobile-bottom-panel`) set
  `overflow-y:auto` so the Analyse button/results stay reachable incl. mobile.
  `?v=1.50.74-jd-compact`.
- **PRIVACY-FAB-FLICKER-001** — see ACTIVE_BUGS.md (background bleep killed).
