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

### 1. SALMON page splitter (owner's #1) — ROOT CAUSE = two-column desync (PDF evidence)
The owner's unsolicited-CV export PDF (`CV_…_Nordea_…_20260621.pdf`) shows the real problem, of which
the salmon is only a symptom:
- **The export is 6 pages and badly desynced.** Page 1: header + sidebar(Tools&Methods…) + main
  (Profile→CoreComp→Experience Kanzen/Innoviz). Pages 2–4: SIDEBAR keeps going (Instruments, Methods,
  AI-assisted, Certificates, Education, Regulatory, Languages, Accessibility) while the **MAIN COLUMN
  IS EMPTY**. **Page 5 is BLANK.** Page 6: PROFESSIONAL EXPERIENCE (CONT.) (Sirin/Meprolight/TAU) +
  Recommendations. So the two columns are wildly out of balance.
- **Why the sidebar is 4 pages: DUPLICATED tool groups.** TOOLS & METHODS emits a concise top
  (Data&analytics / Project workflow / Methods / Documentation) AND THEN verbose groups that REPEAT it
  — a "Tools" group (Software = the same Jira/Confluence/SQL/Python… again) and a "Methods" group
  (Quality&process = the same Six Sigma/FMEA… again). That ~2× bloat is what pushes the sidebar across
  4 pages and strands the main column. Fixing the duplication ≈ halves the sidebar → the desync + the
  salmon resolve. (Generation-level; owner's "keep focus area compressed" + tools-grouping prompt
  relate.)
- **Jumping / over-sidebar / missing page-3 (preview)** are downstream of this: with the columns this
  mismatched, the preview salmon can't place a stable break.
- Salmon render: `app.src.js` `__antcvSalmon` (~106, CV draws nothing — page-box draws it), overflow
  loop (~133), segment splitter (~5476/5509). See [[salmon-splitter-permanent]] +
  [[pagination-two-map-and-worker-test]] + [[photo-bridge-non-float]].
- **DECISION NEEDED (owner):** for the duplicated TOOLS & METHODS — keep the CONCISE top list, or the
  DETAILED groups? (Can't auto-pick without losing content the owner may want.)

### 1b. Rugby content leaking into optics-role RESULTS (PDF p6)
Sirin Labs (smartphone optics) Results reads "…own camera, display, biometric optical stack.; **Manage
logistics for 25 players and coaches across Denmark and abroad**" — that's Copenhagen Wolves rugby-ops
content merged into the wrong role's results. Same class as junior-rugby; a proofPointsByRole / merge
contamination. Needs a role-scoped scrub or a generation fix.

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

## Account-delete + generation contamination (owner insight 2026-06-22)
The account-delete SECURITY fix is verified working on 1.50.782 (cloud `DELETE /api/prefs` wipes KV+D1;
local `localStorage.clear()`; result = blank me() skeleton + wizard). The earlier "data still there"
was the STALE SW serving old app.js — see [[stale-sw-version-mask-hazard]]. Remaining work:

- **GEN-CONTAMINATION (owner's root-cause insight):** "new generations are so many times contaminated
  by old ones — kernel generation must WIPE the D1 data for the panel/preview/export as STAGE 1 (full
  generation); NOT for quick generation (keep current)." I.e. a FULL regen must first clear the prior
  GENERATED output in D1 (`application` / `active_application` / `language_view` for this user) so the
  new application isn't merged with / seeded from the old one (this is why e.g. rugby-ops bled into the
  Sirin Labs results). A QUICK/incremental generation keeps the current data. Implementation: a
  pre-generation D1 wipe step in the generation worker (access-relay/gen pipeline), gated on
  full-vs-quick. Regen-gated — verify on a real regen. Ties to
  `docs/plan/GENERATION_OPTIMIZATION_2026-06-22.md` (the hydrateContract pass should run AFTER a clean
  slate).
- **CLEAN-DELETE → WIZARD (owner 2026-06-22, partially fixed):** after a delete the floor restores an
  empty me() skeleton and sidecars re-plant data, so a "deleted" account doesn't land on the wizard.
  Progress: OWNER-PRESENT-GATE-001 (1.50.786) stops 415 from re-planting Gabriel's interests +
  recommendations for a fresh user (gated on personalInfo carrying real owner data). STILL OPEN:
  (a) **wizard not starting** — the floor-restored skeleton sections read as "has data", so the
  wizard-detection routes to the editor instead of the wizard; the detection must treat a bare
  skeleton (or absent real personalInfo) as FRESH and show the wizard. (b) **relay/docx/proxy URLs
  persist** — these are DEPLOYMENT config the app needs (same for every user, not private data), but a
  fresh state shouldn't surface the previous setup; decide whether the wizard re-establishes them. (c)
  the me() skeleton may not define template placeholders for interests/recommendations/accessibility/
  languages — confirm + add so a fresh user sees a template, not blank.
- **WIZARD DELETE:** if the user chooses "start fresh" / clear-and-restart inside the WIZARD, it must
  trigger the SAME full delete flow (window.AntcvCloudDelete + localStorage/sessionStorage.clear) — not
  a partial local-only reset. Find/confirm the wizard's start-fresh control and wire it to the 782 flow.
- **MULTI-TAB delete gap:** localStorage is shared across tabs; another authed AntCV tab re-writes +
  re-syncs the data within ~5s, defeating a delete. A robust delete should sign out / invalidate ALL
  tabs (e.g. broadcast a `antcv:account-deleted` signal other tabs react to). Workaround: close other
  tabs before deleting.
- **LOADING "SIGN IN" flash (low priority, owner OK):** the "SIGN IN" heading was removed (1.50.784)
  but the app's own sign-in card still flashes ~2-5s during LOADING (not on refresh). Not critical.

## Deferred / larger
- CL Application Q&A **P2** (JD-question detection) + **P3** (grounded answers) — see
  `docs/plan/CL_APPLICATION_QA_2026-06-22.md`.
- `hydrateContract()` generation refactor — retires ~15 patch sidecars
  (`docs/plan/GENERATION_OPTIMIZATION_2026-06-22.md`).
- Big-document boot pagination perf (the ~15s freeze remainder) — see [[boot-storm-gate-freeze]].
