# Rich editable sections — Publications & Patents + How I Would Contribute (owner 2026-06-22)

Two new richly-edited sections requested by the owner, built on ONE shared row-editor +
controls engine. Built on branch `feat/publications-main-rich`, merged to main only when each is
coherent (no production regression). Reuse near-zero gated app.js render surgery where possible
(structured fields in a side-store, composed display string into the section `items[]`).

## Shared control vocabulary (build once, reuse on both)

- **Per-row controls** (right side of each row): ▲▼ reorder · visibility (show/hide) · marker
  show/hide (marker look + spacing identical to the document's other bullet markers) · CJLR ·
  Page (page-break / page assignment) · ✨ Enhance · Fit-it · ✕ Delete. **+ Add** button after the
  last row.
- **Paragraph / section-level controls**: CJLR · Enhance · Fit-it · Page-break (Publications also:
  ◹ move main↔sidebar via the existing section-move control).
- CJLR = the existing alignment cycle control (see `antcv-experience-role-cjlr-230.js`).
- Enhance / Fit-it = the existing AI text actions (see `antcv-section-control-bar.js` capabilities).
- Page = per-item page assignment (`antcv:itemPages[sid][i]`, see `antcv-sidebar-item-page-controls-359.js`).
- Marker = render the bullet marker like the `bullets` type (`BM(n)` / bulletIndent / bulletMarkerGap),
  toggleable per row + section-wide.

## Feature 1 — PUBLICATIONS & PATENTS (CV, main, movable to sidebar)

- New section `id:"pubs"`, `type:"list_italic"`, `richPub:true`, MAIN, between Professional
  Experience and Recommendations. Old sidebar `publications` (list_italic) section RETIRED + its
  two sidecars (273, 278) unloaded; items migrated. **[Phase 1 SHIPPED to branch.]**
- Display reuses `list_italic` (name **bold-italic**, rest plain); the preview skips the legacy
  year-only strip for `richPub`. **[Phase 1 SHIPPED.]**
- **5 fields per row (all optional):** Name · Authors · Journal/Publisher · Year/Date · Pages.
  Display: "**_Name_** — Authors, Journal/Publisher, Year, pp. Pages" (empty fields dropped). Patent
  fits the same shape (Name = patent title, Journal = "US Patent No. …"). **[Phase 2 — editor.]**
- Per-row + section controls per the shared vocabulary above. **[Phase 3.]**
- Status: Phase 1 (foundation: new section + migrate/retire + full-citation render + native
  Name/Details editing) done & verified on branch (`diag-publications-main-migrate.mjs`). Native
  list_italic editor (`Te`, app.src.js:8489) already gives visibility/name/details/delete/reorder/add;
  Phase 2 splits the single Details field into the 4 detail fields (extend `Te`, gated `richPub`, +
  `antcv:pubFields` side-store for a lossless 5-field round-trip). Phase 3 adds marker + per-row
  CJLR/Page/Enhance/Fit + section-bar.

## Feature 2 — HOW I WOULD CONTRIBUTE (CL) — composite "text · bullet-list · text"

Restructure the existing CL HOW-I-WOULD-CONTRIBUTE section (currently intro + flat bullets +
closure) into a fully-controlled composite:

1. **Intro paragraph** — one textarea, with paragraph controls: CJLR · Enhance · Fit-it · Page-break.
2. **Bullet list** — each row has **2 fields: Verb · Content** (display: "<marker> **Verb** content"),
   plus per-row controls: ▲▼ reorder · visibility · marker show/hide · CJLR · Enhance · Fit-it ·
   Page-break · ✕ Delete. **+ Add** after the last row. (The verb/content split lets the tense engine
   target the leading verb — same idea as the Results tense lamination.)
3. **Closure paragraph** — one textarea, with paragraph controls: CJLR · Enhance · Fit-it · Page-break.

- Existing pieces to build on: `antcv-how-contribute-controls-245.js` (per-row controls precedent),
  the CL section render + `__antcvBreaks` salmon paginator, the section-control-bar (enhance/fit/page).
- Storage: keep the bullet `items[]` as composed strings ("Verb content") for all existing readers;
  store the structured `{verb, content}` per row in a side-store (`antcv:contribFields[sid][i]`);
  intro/closure are their own text fields on the section.
- Build phased + verified like Publications, on the same branch, merged when coherent.

## Discipline

Gated `app.js`: edit `app.src.js`, mirror to minified `app.js` (section var differs — the
minified-shadow hazard; anchor on string literals, guard occurrence counts, assert `(()=>{` +
no "use strict"); boot-smoke after every change; cache-bust quartet on every changed loaded file at
merge time. Headless verification past the sign-in gate for each phase before merge.
