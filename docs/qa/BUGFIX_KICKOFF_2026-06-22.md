# Bugfix kickoff — 2026-06-22

Owner brain-dump for a fresh bugfix pass. Grouped by area, with status. Priority order set by owner:
**salmon first.**

## Fixed already this session (live, 1.50.768–779)
- Export-settled gate (first export waits for settle) · interests → rich_block · version-display unify
  (killed `1.50.9-babel-fish`) · languages keep CEFR ("intermediate (B1)") · **junior-rugby scrub**
  (regression from 776) · skeleton-instruction leak strip · publications repopulate + patent dedup ·
  boot-storm damper · tools-grouping prompt hardened · CL Application Q&A page P1 · Review-my-data
  verified working (196 fields).

## OPEN — priority order

### 1. SALMON page splitter (owner's #1)
- **Jumping**: the salmon ("▼ PAGE n ▼") oscillates between the CORRECT spot (just below the last
  subsection text) and an INCORRECT one (floating over empty space). Measurement instability in the
  two-map autoPages (`autoPages` vs `autoPagesPreview`).
- **Missing page-3**: the unsolicited CV is long (3+ pages) but only the page-2 salmon draws — no
  page-3 salmon. Page-count/break computation stops at 2.
- Salmon render: `app.src.js` `__antcvSalmon` (~106), overflow loop (~133), segment splitter
  (~5476/5509). See memory [[salmon-splitter-permanent]] (never delete it; only tune) +
  [[pagination-two-map-and-worker-test]].

### 2. Sidebar photo bridge spacing
- Uneven vertical gaps: photo-top↔page-top vs photo-bottom↔first sidebar headline (TOOLS & METHODS).
- Fix: COMPRESS the sidebar headline + content UPWARD (reduce the gap below the photo). See
  [[photo-bridge-non-float]].

### 3. CORE COMPETENCIES table
- **Table-header CJLR missing**: the Focus Area / Strategic Expertise header row has no CJLR control,
  and its alignment DRIFTS from default-centered to left/justified.
- **Focus Area labels compressed**: keep them short/abbreviated — e.g. "Documentation & traceability"
  → "Docs & traceability".
- **Strategic Expertise cells capped at 105 chars** (incl. spaces) per cell.

### 4. Unsolicited CL locked on Nordea (cross-contamination)
- On an UNSOLICITED application the CV is correct but the COVER LETTER is locked onto "Nordea"
  content — Nordea is a SAVED application, not the unsolicited target. The CL is pulling the wrong
  saved application. Ref PDFs in owner Downloads (Nordea Analytics Engineer 20260621). See
  [[targeted-app-persistence]].

### 5. Loading screen sign-in
- During the loading cover an unnecessary "sign in" element shows; it also appears outside the
  sign-in process. Remove it from the loading cover. (`antcv-login-loading-gate.js`.)

### 6. Review-my-data behind set-menu
- The modal loads but renders BEHIND the Settings set-menu (z-index). Raise it above the set-menu.
  (`antcv-data-export-360.js`.)

### 7. Certs missing from unsolicited
- Some certificates are dropped on unsolicited applications (owner screenshot: CERTIFICATES &
  COURSES shows 5 + placeholders; expected more). Investigate the unsolicited cert filter.

### 8. Deliverable — modernized Gabriel JSON
- Export a clean, modernized `personalInfo` JSON (rich_block-ready, concise languages w/ CEFR,
  no junior-rugby, grouped tools) for re-upload. Needs the live `personalInfo`.

## Deferred / larger
- CL Application Q&A **P2** (JD-question detection) + **P3** (grounded answers) — see
  `docs/plan/CL_APPLICATION_QA_2026-06-22.md`.
- `hydrateContract()` generation refactor — retires ~15 patch sidecars
  (`docs/plan/GENERATION_OPTIMIZATION_2026-06-22.md`).
- Big-document boot pagination perf (the ~15s freeze remainder) — see [[boot-storm-gate-freeze]].
