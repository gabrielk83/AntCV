# AntCV — Active Bug Tracker

Living list of open issues. Newest section at top. Mark items `[FIXED]`, `[VERIFYING]`, or `[OPEN]`.
This file now folds in the canonical `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx` backlog (see "QA SPEC BACKLOG" below) so there is a single working list. The .docx remains the source of full prose detail; a machine-retrievable ID index lives alongside this file at `docs/qa/AntCV_QA_backlog_index_v4.md`.

---

## IMPORT-COUNT-001 — upload extract count wrong — FIXED (v1.50.143; live verification owed)

**Symptom:** after a CV upload the wizard toast read "✓ Found 0 work · 0
education · N certifications · 0 publications" even though the data imported
fine (real 6 work / 3 education / 2 publications).

**Root cause (diagnosed in app.js, fixed in the existing sidecar):**
- The toast counts come from a separate import-**preview** object (`On`), not
  from `personalInfo`. In the `_direct` upload path app.js persists the full
  profile via `le(t)` but sets the preview to **identity + certifications only**
  → work/education/publications show 0. (The toast also reads `On.work_history`,
  snake_case, which nothing ever populates — the data is under
  `experience`/`workHistory`.) So the count line was structurally wrong while the
  data was correct in `personalInfo`.
- `antcv-upload-recount-339.js` already recomputes the right counts from
  `personalInfo` (workHistory||experience, education, certifications,
  publicationsStructured||publications) and normalises the dual keys — but its
  **DOM rewrite silently no-opped**: app.js emits the line as many sibling React
  text nodes (`"✓ Found ", count, " work entr", "ies", " · ", …`), so the
  container's `textContent` matched the regex but no SINGLE child text node did,
  and the TreeWalker found nothing to rewrite.

**Fix:** added a split-text branch to `recountUploadSummary` — when a matching
element's children are ALL text nodes (the React leaf holding the split line),
collapse it to the corrected string. The styled wrapper above it (element child)
is correctly skipped, and the idempotency guard (`textContent` already equals the
expected string) prevents re-writes. `?v=1.50.143-multinode`; cache trio →
1.50.143 (1.50.142 → STALE).

**Verified (Node harness, 5/5):** split-text toast "0/0/6/0" rewritten to real
"6/3/6/2"; wrapper reflects it; experience→workHistory and
publications→publicationsStructured normalised; second tick idempotent (single
text node, no growth).

**Live verification owed:** upload a real CV (Anita persona), confirm the toast
shows the true work/education/publication counts (not 0), on the `_direct` JSON
path and the worker `extract-kernel` path, desktop + mobile.

---

## DATA-EXPORT-001 + DELETE-SAVE-001 — v1.50.142 (built; live verification owed)

New readable sidecar `pwa/antcv-data-export-360.js` (loaded in index.html after
`cloud-delete-296` + app.js). No app.js / fetch-wrapper change — reads
localStorage only, wraps the documented `AntcvFullErase` hook additively.

### What it does
- **DATA-EXPORT-001** — `window.AntcvDataExport(opts)` serialises every
  localStorage key (personalInfo, sections / cv_pwa_sections, meta, antcv:prefs,
  `antcv:analytics:counts`, antcv:apply:*, writing prefs, ...) into a downloadable
  JSON backup. Credential-looking keys (token/secret/jwt/apikey/...) and transient
  erase markers are excluded from a plain file. "Protected" = optional passphrase
  → WebCrypto **AES-GCM** (PBKDF2-SHA256, 250k iters); falls back to a plain file
  with a console warning if WebCrypto is unavailable (non-secure context).
  Filenames: `antcv-backup-YYYY-MM-DD.json` / `…encrypted.json`.
- A **"⬇ Download my data"** button is injected into the red Delete-account card
  (anchored by the "Delete my account" button text); clicking it prompts for an
  optional passphrase.
- **DELETE-SAVE-001** — a **"Save my data locally first"** checkbox (default ON,
  protective) is injected into the same card; when checked, the `AntcvFullErase`
  wrapper takes a fast unencrypted backup BEFORE deferring to the original erase.
  Backup failure never blocks the erase.

### Verified (Node harness, 13/13)
collectData includes user data + analytics and parses JSON values; excludes
apiKey/authToken/transient markers from a plain backup; `includeSecrets` re-includes
them; AES-GCM encrypt→decrypt round-trips; tampered IV fails (authenticated
encryption); plain export emits a dated filename; UI injection adds both nodes and
is idempotent (no dupes on re-sweep).

### Live verification owed (desktop + mobile, after deploy)
- [ ] Delete-account card shows the Download button + checkbox; styling reads native.
- [ ] Download (plain) yields a JSON file containing personalInfo + analytics; no
      api keys/tokens in the plain file.
- [ ] Download with a passphrase yields `…encrypted.json` that decrypts back.
- [ ] With the box checked, clicking "Delete my account" downloads a backup, THEN
      the existing erase + cloud-delete + reload runs (compose with cloud-delete-296).
- [ ] Escape hatch `localStorage['antcv:disable-data-export']='1'` removes the UI
      and the erase wrap.

### Decisions / follow-ups
- Default-CHECKED on the save-first box (protect irreversible loss); change to OFF
  if the owner prefers opt-in.
- Download button is anchored to the delete card (a stable, co-located data/privacy
  spot). If the owner wants it elsewhere in the Personal menu, give the target
  container and I'll re-anchor.
- **Import/restore is NOT implemented** (owner asked for download only). Reading a
  backup back in is a natural follow-up (DATA-IMPORT-001).

---

## 2026-06-04 (session) — mobile UI + page-break + HIWC editability (v1.50.102 → v1.50.119)

Branch `claude/antcv-roadmap-bugs-L9Sqa`. All items below are shipped to that
branch (PRs merged into `main` through the session). Live verification on
desktop AND mobile still owed except where "owner-confirmed".

### Status

| ID | Item | Layer | Version | Status |
|----|------|-------|---------|--------|
| MOB-TOPBAR-001 | Hide Ant icon + leftover table control (`CL`/`30%` = `.antcv-top-sliders`) on mobile | sidecar CSS | 1.50.112 | FIXED (verify live) |
| MOB-TOPBAR-002 | Privacy pill clipped off-screen — crop filename, single-row topbar | sidecar CSS | 1.50.114→115 | FIXED (verify live) |
| MOB-ALT-001 | Alt-circles palette → tap-to-open dropdown (one circle, opens the rest) | new sidecar | 1.50.113 | FIXED (verify live) |
| MOB-ALT-002 | Dropdown must open DOWN and escape the topbar overflow clip | sidecar | 1.50.116 | FIXED (verify live) |
| MOB-BOTTOMNAV-001 | Bottom-nav buttons clipped — shrink text/padding on mobile | new sidecar | 1.50.108 | FIXED (verify live) |
| HIWC-EDIT-001 | "How I would contribute" bullets not editable (esp. mobile) — inputs injected into React tree were wiped by the re-render storm; switched edit surface to the native textarea | sidecar | 1.50.117 | **FIXED (owner-confirmed working)** |
| HIWC-EDIT-002 | Per-bullet control strip squeezed the textarea — moved strip to its own row below | sidecar | 1.50.118 | FIXED (owner-confirmed) |
| HIWC-EDIT-003 | Control strip buttons clipped on phone — wrap the row | sidecar | 1.50.119 | **FIXED (owner-confirmed working)** |
| PAGEBREAK-SIDEBAR-001 | Page breaks for ALL sidebar sub/subsections (was wrongly narrowed in a revert) → PB-001 | sidecar `329` | 1.50.115 | FIXED (verify live export) |
| SETTINGS-AHZ-001 / **AH-001 / VF-014 / APPHIST-ZIDX-001** | "Open in Settings" Application-history subtab opens BEHIND preview | sidecar `327` | 1.50.109 | **STILL BROKEN per owner — blind ancestor-lift did not beat the trap. Reproduce → run `antcv-apphist-zindex-probe.js` → targeted patch. RE-OPEN.** |
| VF-005 / CA-002 | Application "Role - Company" sentence editable + follows package style | sidecar `341` | (main) | FIXED (owner-confirmed) |
| CA-001 (spec line) | `[Specialisation — …]` editable in preview (meta.subtitle) | sidecar `341` | (main) | FIXED (owner-confirmed) |
| SETTINGS-HEAD-002 | WRITING STYLE + LANGUAGES headers match ADVANCED TONE font/size; tighten gap | sidecar | 1.50.110 | FIXED (verify live) |
| LAYOUT-NOTES-001 | "Within-package style" notes: shrink, drop package name, relocate (Quick-alt under packages, Custom onto the Custom button) | island source (vite) | 1.50.111 | FIXED (verify live) |

### Reverted / parked this session
- **TABLE-PAGEBREAK-001 (Core/WIB per-row `↧`) — REVERTED at 1.50.103.** The
  reliable per-row toggle wrote to the wrong section: the WIB control falls back
  to `sid:'core_competencies'`, and `pageBreakRows`/`itemPages` are keyed by
  section id only, so the CL "What I Bring" and the CV "Core Competencies"
  collide across documents — pressing WIB's ↧ corrupted Core. Restored to the
  known-good `📄` page system. **A correct per-row table break needs per-doc
  keying that also reaches the DOCX worker — a deliberate redesign, not a hotfix.**

### Canonical page-break family (PB-001..006) — reconciled with the v4 index
Owner: "page break in general" still not right. The locked requirements:
- **PB-001** — manual Page Break from BOTH main area and sidebar (sidebar partly via `329`/1.50.115; main-area + on-entry manual control unverified).
- **PB-002** — first sub-subsection moves the WHOLE subsection with its original heading (no dup).
- **PB-003** — continuation heading: duplicate heading + localized "Cont." 18pt from top.
- **PB-004** — table rules: first row moves the table; a later row splits it and repeats headers. (TABLE-PAGEBREAK-001 is the per-row toggle, parked — see above.)
- **PB-005** — replace the down-arrow icon + "Compress" text (semantic page glyph; "Fit"). (`page-break-icon-357` / `help-text-wording-357` — VERIFYING.)
- **PB-006** — preserve the Professional Experience pattern (reference, VF-018).
- **EXPORT-PAGE2-001** — export PREVIEW shows only page 1 / breaks not applied. Worker engine passes smoke tests; defect is the client `antcv-pdf-preview-gate.js` clone path. Read-only probe: `antcv-export-page2-probe.js`. RE-OPEN — drive with the probe.

### Still OPEN from earlier in the engagement (not addressed this session)
- **RERENDER-STORM-001 [OPEN]** — the `requestAnimationFrame` violation flood is
  still live (visible in the owner's mobile console). It is the root cause of the
  HIWC input churn (worked around, not cured) and a general perf drain. Needs the
  mutation-source probe to find the pump. HIGH value.
- **APP-SENTENCE-STYLE-001 [OPEN]** — the candidate "Application: Role - Company"
  sentence does not follow the chosen package style (e.g. Nordic = white). Code
  located: `antcv-candidate-preview-editor-341.js:334–350` copies the Name leaf's
  computed style onto the sentence host; falls back to default when that leaf
  isn't found.
- **SPECIALISATION-EDIT-001 [OPEN]** — the `[Specialisation — …]` line in the
  preview header is React-rendered and not yet wrapped as editable.
- **DOCX-EXPORT-REGRESSION-001 [OPEN]** — see batch triage below (export from the
  print-setup view doesn't call `exportDocxViaWorker`).

---

## VISUAL-SETTINGS PLACEMENT — v1.50.95 (built, NOT yet deployed; live verification owed)

Addresses the **placement** of visual settings across the STANDARD Personal / Layout subtabs — the placement aspects of `VISUAL-PKG-003`, `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001` (see the 2026-06-04 batch triage below). Some behavioural sub-items of those IDs remain (see Deferred). Source-only (React islands + protocol version bumps); `pwa/antcv-react-islands.js` rebuilt via `npm run build`. Not committed/deployed yet — deploy + live acceptance gate owed.

Context found this session: local `main` was **70 commits behind** `origin/main` (prod v1.50.93); synced via fast-forward to `160ccd2` before editing. The earlier "Visual-package Layout move" (`75911dc`) had been a hand-edit to the minified bundle only and was silently reverted when the bundle was later rebuilt from un-updated source.

### What changed (source)
- **VISUAL PACKAGE (PackagePicker) moved out of Personal → Layout.** Mount gates on `isLayoutSubtab`, anchored immediately after the native STYLE PACKAGE section. Rendered with `context="layout"`: the redundant 7-package grid is hidden (native STYLE PACKAGE buttons own selection); surfaces the **Quick-alternative** selector + explanation and the **Custom** explanation (auto-engages via the existing `window.AntcvCustomMode` tolerance evaluator). Personal carries no visual-package control. (VISUAL-PKG-001..003)
- **LANGUAGES (LanguageCard)** re-anchored into the Personal order-based flex column at `order:35` → after the writing-style/tone group, immediately before Banned Words.
- **SECTION LAYOUT (LayoutPicker)** re-anchored into the same column at `order:45` → after Banned Words. (SECTION-LAYOUT-001)
- **Styling:** the three injected cards' headers use the shared native register `NATIVE_SECTION_HEADER_STYLE` (Georgia 11px / 600 / .4px / rgba(255,255,255,.55)) so they read as native sections. (SETTINGS-HEAD-001)
- Helpers added to `src/lib/settings-dom.ts`: `findSettingsFlexColumn` (Personal order-column), `findSectionBlockBeforeNext` (Layout block-flow), `NATIVE_SECTION_HEADER_STYLE`.

### Verification (run on live, desktop AND mobile, after deploy)
- [ ] Personal: Languages after WRITING STYLE/Advanced Tone, immediately before Banned Words; Section layout immediately after Banned Words. No cramped bottom 3-column row.
- [ ] Personal: NO Visual-package control present (no duplicate/orphan).
- [ ] Layout: "Within-package style" card (Quick-alt + Custom) sits directly under the STYLE PACKAGE buttons, before SIDEBAR POSITION. Quick-alt Default/Alt 1/Alt 2 apply; Custom explanation shown.
- [ ] The three injected card headers match the native section register (font/size/colour).
- [ ] Native STYLE PACKAGE buttons and Quick-alt both apply to the preview; no Preview-only / after-hard-refresh-only behaviour.

### Anchoring mechanics (so a future session doesn't re-derive)
Personal subtab = `display:flex; flex-direction:column` ordered by CSS `order` (WRITING STYLE 25 / ADVANCED TONE 30 / BANNED WORDS 40). Layout subtab = block flow. Both placement helpers were prototyped against the live deployed DOM and confirmed to land in the correct slots before the source was finalised.

### Deferred follow-up (remaining sub-items of the same IDs)
- **VISUAL-PKG-001** — rename the native app.js panel label "STYLE PACKAGE" → "Visual package" (app.js; fold into the MERGE-DUP pass).
- **VISUAL-PKG-002** — enrich each native STYLE PACKAGE button with the package-card detail (palette / font / shape / photo-size icons).
- **VISUAL-PKG-003** — move the "Segoe UI · circle · 120px" descriptor out of the package card to sit next to the Alt circles (the caption wording is now aligned; descriptor relocation pending).
- **SECTION-LAYOUT-001** — make the whole Section-layout island collapsible + collapsed by default, refresh it when the writing style changes, and route out-of-definition edits into a custom writing style.
- Fold Quick-alt + Custom natively into the Layout STYLE PACKAGE section in `app.js` and delete the PackagePicker island (the "deprecated afterwards" end state). Wire the native Advanced → Style colour/font/image pickers to `window.AntcvCustomMode` so Custom auto-engages on out-of-tolerance edits.
- WritingStylePicker island renders empty (width 0) on production and sits inert in Personal — separate pre-existing issue, not addressed here.

---

## 2026-06-04 (batch) — owner feature + bug dump triaged

Full triage with per-item IDs, layer, and sidecar-vs-app.js verdict lives in
`docs/plan/Batch_2026-06-04_feature-and-bug-triage.md`. Summary:

- **Landed (sidecar):** `JD-TEXTAREA-001` (JD textarea halved + host panels
  scrollable, incl. mobile); `PRIVACY-FAB-FLICKER-001` (top-bar pill background
  bleep — see below).
- **New feature, NOT in locked docs:** `FEATURE-CONF-001` — per-sentence
  confidence overlay (Application-tab toggle, default off; red=low/yellow=medium;
  hover shows issue). Locked docs use "confidence" only in the tone sense. Needs
  a WORKER self-check pass + app.js toggle/store + preview renderer. Spec'd in the
  triage doc; raise as a new Writing-System "verification/confidence" section.
- **Priority regression:** `DOCX-EXPORT-REGRESSION-001` — DOCX export was wired to
  the preview-panel button only; export now runs from the print-setup view, which
  doesn't call `exportDocxViaWorker`. Needs branch-archaeology (find the prior
  fix) + re-wire the print-setup export handler in app.js.
- **Registered (app.js / React / worker):** `PAGEBREAK-001..005` (export-preview
  marker, on-entry + A4-overflow detection, continuation header, cascade colour
  across all sections + CL), `VISUAL-PKG-001..003`, `MERGE-DUP-001..003`,
  `SETTINGS-HEAD-001`, `SECTION-LAYOUT-001`, `LOCATION-001`, `DEMO-WARN-001`,
  `PRIVACY-SETTINGS-001`, `WIZARD-001..002`, `IMPORT-COUNT-001`,
  `PHOTO-PLACEMENT-001` (only sidebar photo positions render in the preview;
  header/main/bridge placements are no-ops — app.js render gap, format-prefs
  sidecar only stores the pref).

---

## 2026-06-04 (later) — section-layout help text trimmed + CL-HEADER-001 DOM captured

### Fixed — LAYOUT help-text overflow
- Owner: the Per-section-overrides help paragraph is too long. Replaced the §4.4 wall of text in `src/islands/LayoutPicker/LayoutPicker.tsx` with "Per-section overrides — pick a layout and set a length hint, or reset (↺) to use the style default." Rebuilt `pwa/antcv-react-islands.js` (Vite); bundle `?v=` → 1.50.70, `sw.js` → `antcv-1.50.70`, `version-override` TARGET → 1.50.70 (1.50.69 added to STALE).

### PUB-ROW-LAYOUT-001 — Publications & Patent per-item row layout (partial fix shipped)
- Owner: the per-item row has a blank gap that pushes the buttons aside; delete (✕) should sit right after the Journal/details input (not pushed away over the name input); the eye (👁) should be leftmost; the ▲▼ move buttons are completely hidden.
- **Root:** app.js renders the per-item row as a 4-col CSS grid (`30px minmax(120px,1.2fr) minmax(160px,2.8fr) 28px`). Sidecar **273** (strict-row-layout) owns the per-item row and lays it out as **flex** with `order`/fixed input widths; sidecar **278** (section-header row-fix) was *also* re-classifying the per-item eye/delete (walked up to a high ancestor) and stamping them `kind=on`/`del` at order 50/60 — fighting 273's order 40/50. The captured eye carried BOTH `data-antcv-pub273-eye` and `data-antcv-pubrow-kind-278="on"`. When 273 doesn't convert the container to flex in time, its flex-oriented children land in the app's grid → blank columns (inputs forced to 48/138px inside 1.2fr/2.8fr columns) and the move buttons (in a sibling `justify-content:flex-end` div) get clipped.
- **Shipped (safe, exclusion-only):** 278 v1.40.278-excl273 now SKIPS any button 273 owns (`data-antcv-pub273-*` / inside `[data-antcv-pub273-row]`), so it no longer fights 273 on per-item rows. `?v=1.40.278-excl273`, sw → `antcv-1.50.76`, TARGET → 1.50.76 (1.50.75 → STALE).
- **Still owed (needs live-tested 273 pass — registered):** (1) guarantee 273 converts the per-item row container from grid→flex so the blank gap can't appear; (2) re-order to the owner's spec — **👁 leftmost**, then name, then journal, then **✕ adjacent to journal**, with page/cjlr/compress/enhance + ▲▼ placed deliberately; (3) make the ▲▼ move buttons visible (their sibling flex div is clipped by the row width clamp). Diagnose live (the owner can't log into the branch preview — no relay configured there — so this needs prod or a relay-configured session).

### HIWC-BULLET-EDIT-001 — FIXED (1.50.86): debounce per-keystroke write + edit-safety
- After the loop damper (1.50.85) HIWC was still "not typable". Direct cause: every keystroke in a bullet input ran `inp.oninput → syncFromInputs → syncSectionField → pulse()` (`antcv:sections-updated`) → personality `forceRebuild` → React re-renders the HIWC section → the input being typed in is re-created → focus lost.
- **Fix (1.50.86, `how-contribute-controls-245`):** (a) the bullet input's section write is now **debounced 600ms** (and flushed on blur) instead of firing per keystroke, so typing no longer pulses a forceRebuild mid-word; (b) `run()` bails when `document.activeElement` is a HIWC bullet input (`isTypingInHiwc`), so the sidecar won't rebuild the row while the user is typing. Cache-bust `?v=1.50.86-typable`, sw → `antcv-1.50.86`, TARGET → 1.50.86 (1.50.85 → STALE).

### HIWC-EMPTY-PREVIEW-001 — empty bullet template must stay visible (verify on 1.50.86)
- Owner: the HIWC bullet template placeholder must remain visible in the preview as long as nothing has been typed into the bullet (or until deleted via ×). `syncPreviewBulletNodes` already returns early when there are no real values (`!vals.length`), so the sidecar does not inject/clobber the template; `preview-bullets-dedup-341` (prv-bullets3) is designed to keep a template-only list when there is no real-data sibling. The churn (now damped + the per-keystroke rebuild removed in 1.50.86) was a likely cause of the template flickering away. Re-check on 1.50.86: empty → template shown; typing → replaced; delete-× → template returns. If it still hides, the culprit is prv-bullets3's sibling check or `applyPreview` reconciling-down — fix there.

### HIWC-RERENDER-LOOP-001 — round 8 (1.50.85): CENTRAL DAMPER (whole class, one file)
- Owner directive: stop the per-round whack-a-mole, kill the loop decisively, ship. Privacy blip confirmed fixed (1.50.84); HIWC still hard to edit + preview→panel sync still broken (both downstream of the churn).
- **Fix:** new `pwa/antcv-loop-damper.js` (loaded FIRST, before all sidecars + app.js) wraps `MutationObserver` so callbacks for BROAD observers (target = body/documentElement + `subtree:true` — i.e. the ~60-sidecar herd) are coalesced + throttled to ~6.7/sec (150ms). Narrow/targeted observers pass through unchanged (contenteditable/focused widgets keep normal latency). A sidecar can still react, just not at frame rate, so it can't sustain a frame-rate feedback loop. React 18 doesn't use MutationObserver, so it's unaffected. Disable hatch: `localStorage['antcvDisableLoopDamper']='1'`. Risk acknowledged (global API wrap) per owner's "no matter the risk"; single-file revert if needed. `sw.js` → `antcv-1.50.85`, TARGET → 1.50.85 (1.50.84 → STALE).
- **Expected:** the mutation/rAF storm caps at ~6.7/sec regardless of how many writers exist → preview stops churning, HIWC inputs keep focus (editable), and prior per-screen pumps (align-cycler ping-pong, etc.) can no longer run hot. Re-run the rAF + mutation-source probes — totals should be a fraction of before. This is meant to END the loop sessions.

### PRIVACY-FAB-FLICKER-001 — FIXED at source (1.50.84) + loop round 8
- **mutation-source probe on 1.50.83 (Preview + panel):** round-7 worked (panel-action/label-206/207 dropped 296→39/sec). New top: `style on BUTTON.antcv-align-cycler` (156/sec) + `childList on DIV` (156) + `align-cycler-injected` (156) + `preview-cjlr-hidden` (78) + `align-sid` (78) … and `style on BUTTON.antcv-fab` (29/sec) = the privacy blip.
- **Privacy blip root + fix:** `topbar-tools-347.stylePrivacyForTopbar` re-asserted `display/visibility/opacity !important` on the FAB **every sweep** to fight the islands PreviewToolbar's periodic inline hide — a JS ping-pong that mutated the FAB style ~29/sec (the blip). Fix (1.50.84): force the relocated FAB visible with a **passive CSS `!important` rule** (`injectPrivacyVisibilityCss`) that beats the island's non-important inline hide, and **remove the per-sweep JS display/visibility/opacity writes**. CSS wins passively → no counter-write, no blip. `?v=1.50.84-fab-css`, sw → `antcv-1.50.84`, TARGET → 1.50.84 (1.50.83 → STALE).
- **Still pumping (registered, next round): ALIGN-CYCLER-PINGPONG** — `section-align` keeps creating per-section `antcv-align-cycler` buttons while `antcv-section-main-panel-fix.removePreviewCjlrGhosts` keeps removing them as "ghosts" (`preview-cjlr-hidden` + `btn.remove()`) → ~156/sec create/remove churn. Resolve by stopping section-align from injecting the preview cyclers that main-panel-fix immediately deletes (feature-level — confirm which cycler is canonical before disabling). `align-sid` (78/sec) is written by app.js on section rows (downstream of its re-render; not sidecar-fixable).

### PREVIEW-PANEL-EDIT-SYNC-001 (registered)
- Owner: after editing inputs in the preview, the section panel isn't editable / doesn't pick up the change (preview→panel reverse sync). Same family as CL-HEADER-001 (panel↔preview share a store via candidate-preview-editor); register for the candidate-editing pass once the loop is flat.

### HIWC-RERENDER-LOOP-001 — round 7 (1.50.83): section-panel-206/207/208 attribute storm (Preview + panel open)
- **mutation-source probe on 1.50.82, Preview with sections panel open:** the pump is `data-antcv-panel-action/label-207` (296/sec), `-206` (228/sec), `-208` (202/sec) on BUTTON — **~726/sec combined** — plus align-cycler style/childList (~167/sec, downstream). Earlier rounds didn't see these because that screen wasn't probed; the prior `forceRebuild`/HIWC writes were a different facet.
- **Root:** THREE section-panel sidecars (`antcv-section-panel-206/207/208.js` — iterative versions, all still loaded) each loop over the panel buttons every sweep and `setAttribute` `data-antcv-panel-action/label-NNN` + `style.order` **unconditionally** (208 also stamps 207's; 207 also stamps 206's). Each `setAttribute` to the same value emits a mutation record → wakes every body-observer → they re-run → re-stamp = the storm.
- **Fix (1.50.83):** idempotency guards in all three button loops — write `data-antcv-panel-action/label-*` and `style.order` only when the value differs. Stable state → zero panel mutations. Cache-bust: 3 tags → `?v=1.50.83-idem`, sw → `antcv-1.50.83`, TARGET → 1.50.83 (1.50.82 → STALE).
- **Note:** 206/207/208 are layered versions all active — a future cleanup should retire the superseded ones, but idempotency is the safe immediate fix. The ~167/sec align-cycler churn is downstream of these re-renders; re-probe after deploy — if it persists, guard section-align's `injectPanelCyclersInto`/cycler restyle next.

### HIWC-RERENDER-LOOP-001 — round 6 (1.50.82): the HIWC section-write loop (residual)
- **Progress confirmed (owner, 1.50.81):** privacy FAB gone from Settings ✅ (PRIVACY-SETTINGS-001 fixed by the sticky back-off); top-bar flicker "slower" (back-off working, residual driven by the loop below).
- **Residual loop named in console:** repeated `[antcv] sections refreshed from external write {source: 'how-contribute-controls'}` → `[antcv-personality] forceRebuild antcv:sections-updated how-contribute-controls` → `[shape-guard] eager-normalized`. `how-contribute-controls-245.syncSectionField` wrote sections + `pulse()` (dispatch `antcv:sections-updated`) on EVERY call → personality forceRebuild re-renders the section → the sidecar re-runs → writes again. This is also why HIWC was "very hard to type" and the preview bullets duplicated (`g,gr,g,gr` for 2 inputs — the loop re-injecting).
- **Fix (1.50.82):** `syncSectionField` is now idempotent — compares intro/closing/bullets against the stored values and only `writeJson`/`writeDocSpecificSections`/`pulse()` when something actually changed. No change → no write → no pulse → no forceRebuild → loop dies. Cache-bust `?v=1.50.82-idem`, sw → `antcv-1.50.82`, TARGET → 1.50.82 (1.50.81 → STALE).
- **Expected:** HIWC typable, preview bullets no longer duplicated, and the residual privacy flicker stops (the forceRebuilds that re-triggered the overlay toggle are gone). If the preview still shows duplicate bullets after this, that's a separate app-renders-bullets + sidecar-injects-bullets dedup (HIWC-EMPTY-PREVIEW-001) — re-check after deploy.

### HIWC-RERENDER-LOOP-001 — round 5 (1.50.81): overlay hide/show ping-pong (privacy flicker) + log noise
- **Post-1.50.80 console named the residual churners:** `preview-shell-sticky:128 unhid <div class="antcv-overlay antcv-overlay-bottom-right"> flex` spamming, + `lang-bar-filter:223 wanted=en,da shown=2 hidden=2` spamming. The align-attr storm (round 4) is gone.
- **Root (privacy flicker + "FAB visible on the side in Settings"):** `antcv-overlay.js:413` toggles `antcv-overlay-hidden` from `isContentReady()` (false in Settings / during cloud-sync). `preview-shell-sticky` strips that class via a MutationObserver. Both observe the overlay → they re-trigger each other at frame rate (the flicker + rAF churn). And sticky forcing the overlay visible in Settings is exactly why the FAB shows "on the side" there.
- **Fix (1.50.81):** `preview-shell-sticky` — (a) anti-ping-pong **back-off**: distinguish a single transient hide (correct once — its real job in preview) from a persistent hide (Settings / not-ready — yield 5s so antcv-overlay wins → no flicker + FAB stays hidden in Settings, satisfying PRIVACY-SETTINGS-001); (b) narrow its observer to class changes ON an overlay root (was every class mutation in the body). `lang-bar-filter` — log only on actual change (was idempotent but logged every woken run = console flood). Cache-bust: `?v=1.50.81-backoff` / `?v=1.50.81-quietlog`, sw → `antcv-1.50.81`, TARGET → 1.50.81 (1.50.80 → STALE).
- **Expected:** privacy flicker stops, FAB hidden in Settings, rAF flood drops further. Re-run the rAF + mutation-source probes; if residue remains (`style on BUTTON` ~21/sec), that's the next target.

### HIWC-RERENDER-LOOP-001 — round 4 (1.50.80): PUMP FOUND + fixed
- **mutation-source probe (1.50.79) named the pump:** `attr:data-antcv-profile-workstyle-align on SPAN` = **765/5s ≈ 153/sec** — by far the dominant mutation. Then `data-antcv-aligned on SPAN` ~33/sec (section-align), `data-antcv-core-row-preview-align on TR` ~25/sec + `data-antcv-core-row-align` (core-competencies-234), `style on BUTTON` ~21/sec, pub273 attrs, `style on BUTTON.antcv-fab` ~10/sec.
- **Root:** four sidecars wrote `style.textAlign` + their align ATTRIBUTE **unconditionally on every sweep** (~12 spans × ~13 sweeps/sec). `setAttribute` to the same value still emits a MutationObserver record, so this generated ~236 attribute-mutations/sec — the storm that woke every body-observer in the app (the ~13/sec herd + the island mount reactors = the re-render loop). NOT React; a sidecar attribute storm.
- **Fix (1.50.80) — idempotency guards (write only when the value differs):** `antcv-profile-workstyle-cjlr-238` (applyEditors + applyPreview, the 153/sec), `antcv-section-align` (applyAlignmentToSection, data-antcv-aligned), `antcv-core-competencies-row-controls-234` (applyEditor + table applyAlign). Stable state now produces ZERO align mutations. Cache-bust: 3 tags → `?v=1.50.80-idem`, sw → `antcv-1.50.80`, TARGET → 1.50.80 (1.50.79 → STALE).
- **Expected:** rafPerSec should drop sharply; HIWC editing, empty-preview, privacy flicker, and pub-multi-row should settle (all were downstream of this storm). Re-run the rAF + mutation-source probes to confirm; secondary residue (`style on BUTTON` 21/sec, pub273) addressed next if still present.

### Mobile + label batch (owner, 1.50.80-era) — registered
- **MOBILE-FUSE-001:** the Fuse (🔀) button is not visible in the mobile bottom panel — surface it there.
- **MOBILE-TABLEWIDTH-001:** the table-width controls from the top panel are only partly visible on mobile — hide them entirely on mobile (acceptable per owner).
- **MOBILE-EXTRACTION-001:** the document-Extraction button can hover in the grey area on mobile — re-anchor it.
- **LABEL-HISTORY-001:** rename the top-panel "Application history" button to "History" to save space. (app.js-rendered label; candidate for a sections-icon-style text rewrite or app.js.)

### HIWC-RERENDER-LOOP-001 — round 3 (need mutation-source probe for the pump)
- **Probe on 1.50.79:** round-2 confirmed — `section-align` GONE from the top. Remaining: `react-islands.js:1` ~42/sec (209/5s), then the ~13/sec herd (66/5s each).
- **Finding by source inspection:** the ~42/sec react-islands rAF is the island `mount.tsx` MutationObservers (PackagePicker/LayoutPicker/WritingStylePicker/LanguageCard/ExportOptions/etc.) each watching `document.body {childList,subtree}` and rAF→`applyOnce` on every mutation. `applyOnce` is idempotent (renders only if unmounted), so they're cheap REACTORS, not the pump. Every 13/sec herd entry (`data-importer:978`, `personality:597`, `candidate-preview-editor:408`, …) is likewise a body-observer→rAF→idempotent-sweep REACTOR. So a single source mutates the DOM ~13/sec and everything reacts; the rAF probe structurally can't show it (mutators don't rAF).
- **Next datum:** `docs/qa/probes/mutation-source-probe.js` records the top mutated targets (element/attr) — names WHAT changes 13/sec → the pump (a sidecar emitter to gate, or app.js-internal). Until then, do not throttle the 8 island mount observers blind (Vite rebuild, untestable here, and only reduces amplification not the root).

### SETTINGS-OVER-PREVIEW-001 — "Open in Settings →" / Application history must lay OVER the preview (after the loop)
- Owner: the `Open in Settings →` button (Applications) should open Settings → Application history ABOVE the preview, not behind it. `antcv-settings-front-327.js` already z-indexes settings roots to 2147483600 + clicks STANDARD → Application history; verify why the panel still lands behind preview (likely the preview/paper has its own stacking context or the settings root isn't matched). Do AFTER the loop is resolved (settings-front was just throttled; confirm interaction).
- **Round-1 confirmed working (probe on 1.50.78):** `settings-front`, `wizard-step10`, `row-controls` all dropped out of the top; the personality gate held (forceRebuild logged once, not looping). But ~798→ still flooding; new top: `react-islands.js:1` **39/sec** (React re-rendering), `section-align.js:1117` **24/sec** + `:1021` 12/sec, then the ~12/sec herd.
- **Round-2 fix (section-align, 1.50.79):** (1) the role-cycler `rAF` at line 1117 was UNGUARDED — fired on every `schedule()` (~24/sec) running a `querySelectorAll` reflow for an INERT feature (no `[data-role-id]` in app.js); now skipped when none exist + guarded. (2) throttled the main reapply pass to ≥300ms (was ~12/sec). Net ~33/sec of rAF + forced-reflow removed. `?v=1.50.79-throttle`, sw → `antcv-1.50.79`, TARGET → 1.50.79 (1.50.78 → STALE).
- **Remaining engine:** `react-islands.js` re-rendering ~39/sec — a React state loop inside the islands (src/islands), which churns the DOM and wakes the 12/sec herd. The rAF probe can't name the island (all map to bundle :1). Next: the new `docs/qa/probes/event-rate-probe.js` counts dispatched event types — if `antcv:sections-updated`/`input`/`storage` fires ~12-39/sec, that names the trigger the islands re-render on, and I gate the emitter. Do NOT blind-edit the islands bundle.

### Row-control batch (owner, 2026-06-04) — gated on the loop, registered
All three are in the contended row-control zone that HIWC-RERENDER-LOOP-001 is actively churning; implement after the loop is confirmed dead (otherwise unverifiable + risks worsening the oscillator).
- **PUB-ROW-MULTIROW-001:** in Publications & Patent the `273` controls attach only to the FIRST row; rows 2-3 show just input + delete (owner screenshot). `273.rows()` does pair name+detail for every row, so the most likely cause is the loop re-creating rows 2-3 before `273` re-wires them (row 1 stays wired). Re-check after the loop fix; if it persists, debug `273` per-row `wire()`/`host()` attachment.
- **MERGED-MOVE-CONTROL-001:** replace the big separate up/down buttons (23px, bordered, `data-antcv-pub273-move`) with the COMPACT STACKED control used elsewhere — `<div style="display:flex;flex-direction:column;gap:1px"><button 8px borderless>▲</button><button 8px borderless>▼</button></div>` — across ALL list subsubsections (HIWC bullets, pub rows, tables). Add drag-to-move (snap). The move result MUST reflect in the preview. Tables: do NOT move the table header row (it is duplicated only when the table spans a page break). Owners: `273` (pub), `how-contribute-controls-245` (bullets), `table-row-page-controls-328`/`table-page-splits-327` (tables).
- **CL-BODY-CONTROLS-001:** in the cover letter, Body subsections are missing the ▶ first button (before Enhance) that the CV main rows have; and the designated `data-antcv-cl-body-move-button="greeting"` (☰ "Move Greeting to the candidate area") does not work. Owner: `antcv-cl-body-move-button-341.js`. Verify the move handler wiring + add the ▶ control to parallel the CV rows.

### Loop still flooding after 1.50.77 (owner, with rAF flood) — gate everything on the probe
Owner reports the `requestAnimationFrame` violation flood persists, AND: HIWC bullets not editable in the section panel, HIWC empty-template bullets not visible in preview, privacy FAB still flickers.
- **All four are downstream of HIWC-RERENDER-LOOP-001, not separate bugs:**
  - **HIWC-BULLET-EDIT-001:** `how-contribute-controls-245.renderBulletList` IS guarded (binds the input once per textarea via `data-antcv-hiwc-bullets-bound`). The guard is defeated when the loop re-creates the textarea ELEMENT each cycle → fresh unbound textarea → input rebuilt → focus lost → typing doesn't stick. Fixing the loop fixes editability.
  - **HIWC-EMPTY-PREVIEW-001:** the empty template can't settle while the section re-renders ~12/sec (prv-bullets3 + the loop racing).
  - **PRIVACY-FAB still flickers:** the loop re-mounts the topbar → `topbar-tools-347` re-parents the FAB each cycle (the v1.50.74 transition/guard fix only addressed the FAB's own repaint, not topbar re-mounting under the loop).
- **Blocker / next step:** confirm the owner is actually on ≥1.50.77 (`window.ANTCV_VERSION`; stale SW would serve the old bundle) and re-run the rAF-attribution probe for the new top-of-table. Round-1 (1.50.77) hit settings-front/wizard-step10/personality/row-controls; if a 12/sec residue remains, gate the next pump (candidate-preview-editor emit or the React-islands 39/sec re-render). Do NOT blind-patch more sidecars without the fresh table — the ~50-sidecar coupled oscillator can worsen.

### DATA-EXPORT-001 + DELETE-SAVE-001 — owner feature requests (APP.JS, registered)
- **DATA-EXPORT-001:** in the Personal menu, let the user download their stored data + personal analytics to a protected file. Layer: APP.JS (the data lives in `localStorage.personalInfo` + analytics keys; the menu is app.js). Plan: serialize the relevant localStorage keys (personalInfo, writingPrefs, analytics) to a JSON blob, offer download; "protected" = at minimum a clear filename + optional passphrase-encrypted variant (AES via WebCrypto) — confirm with owner whether encryption is required or just a local file.
- **DELETE-SAVE-001:** in the "Are you sure?" erase sequence (the red confirm card), add a checkbox "Save my data locally first" that triggers the DATA-EXPORT-001 download before `AntcvFullErase`. Layer: APP.JS (the delete card + `window.AntcvFullErase`/`AntcvAuth.signOut`). Shares the export serializer with DATA-EXPORT-001.

### PREVIEW-ICON-001 + MOBILE-NAV-OVERLAP-001 (1.50.78)
- **Preview tab icon (done):** the bottom-nav Preview tab had no icon while Section (¶) and Analysis (🎯) did. Extended `antcv-sections-icon-346.js` (one self-healing decorator, no new observer) to also prefix Preview with 👁 — groups: `[¶ Section] [🎯 Analysis] [👁 Preview]`. EN verified; DA Preview label matched on common forms.
- **Mobile bottom-nav overlap (done):** the fixed bottom nav (`.antcv-react-bottom-nav`, `left/right:10px`) is a flex row of ~8 controls; on narrow viewports the right-most (CV/CL) clipped off-screen (owner screenshot). Added a mobile rule: `flex-wrap:wrap; justify-content:center; max-height:38vh; overflow-y:auto` so every control stays visible. `antcv-mobile-controls.css?v=1.50.78-navwrap`.
- **Top-bar overlap (REGISTERED, not blind-patched):** owner also reports top-panel buttons folding. The top header left cluster (ant, EN, "Application history", CV/SB toggles, ↵) is app.js-rendered + the right tools are `topbar-tools-347`/`mobile-fab-cleanup-351`. Needs the specific clipped elements identified live (which button disappears at which width) before a safe wrap/scroll fix — risk of disturbing the contended FAB relocation. Cache-bust this batch: sw → `antcv-1.50.78`, TARGET → 1.50.78 (1.50.77 → STALE).

### HIWC-RERENDER-LOOP-001 — diagnosed via rAF probe + first round of fixes (1.50.77)
- **Measured (rAF-attribution probe, owner's prod session):** 798 rAF/sec. Top schedulers: `settings-front-327:20` and `wizard-section-format-step10:92` at ~61/sec (every frame), then ~50 sidecars all at exactly 12.2/sec — a herd reacting to a shared ~12/sec re-render storm. `personality:597` (forceRebuild) and `candidate-preview-editor:408` both in the 12/sec herd.
- **Mechanism:** (a) the two 61/sec sidecars each run a `documentElement` MutationObserver watching `style`/`class` whose callback WRITES style — so they fire every frame off their own writes + the herd's style churn; (b) `personality.forceRebuild` removes+appends its block on every `antcv:sections-updated`, a DOM mutation that wakes all ~50 body-observing sidecars, one of which re-emits → the 12/sec loop; (c) `row-controls-wording` rewrote button title/text and re-triggered its own title/childList observer ("rewrote 1 button(s)" flood).
- **Round-1 fixes (all behaviour-preserving), shipped 1.50.77:**
  - `personality` v…-loopgate: forceRebuild skips the remove+append when the block data signature is unchanged AND a single connected block already exists (identical-DOM rebuild = visual no-op) → removes the per-cycle mutation pump.
  - `settings-front-327` + `wizard-section-format-step10`: throttle their observer-driven scheduler to ≤2/sec (was per-frame) → removes the two top amplifiers; reactivity preserved via the existing timers/click/hashchange paths.
  - `row-controls-wording` v…-p1b3: disconnect the observer during its own sweep + 500 ms throttle → stops the self-feed.
- **Next:** owner re-runs `docs/qa/probes/raf-attribution-probe.js` after deploy; expect rafPerSec to drop sharply. If a 12/sec residue remains, the next pump is in the herd (candidate-preview-editor emit or another section-panel sidecar) — gate that emit on a real diff. Systemic root: ~50 sidecars each running a body-wide MutationObserver that also mutates the DOM (coupled oscillator); long-term they need shared-scheduler/observer hygiene.

### BLEEP-MULTI-001 — name + location + privacy all bleep together (video 2026-06-04)
- Owner attached a video: the candidate **Name**, **Location**, and the **Privacy** pill all pulse/"bleep" in sync.
- **Read:** three unrelated elements bleeping in lock-step is one global driver, not three bugs — the preview/topbar **re-render loop (HIWC-RERENDER-LOOP-001)** repaints the header and re-mounts the topbar. Under that loop: (a) `topbar-tools-347` re-parents the privacy FAB each tick → flicker (my v1.50.74 transition/guard fix stops the FAB's *own* repaint but not re-parenting under a topbar re-mount); (b) Location is re-rendered by app.js; (c) the Name oscillated because `antcv-name-align-fix` re-applied `text-align` inline on every re-render, fighting app.js's `left`.
- **Action this round:** hardened `antcv-name-align-fix` v1.1.0 — removed the per-render inline writes; alignment is now a single injected `!important` **stylesheet rule** that wins passively, so the Name no longer races app.js (no oscillation). `?v=1.1.0-norace`, sw → `antcv-1.50.75`, TARGET → 1.50.75 (1.50.74 → STALE).
- **Still root:** the loop itself. Location + privacy bleep until HIWC-RERENDER-LOOP-001 is fixed. Probe `docs/qa/probes/rerender-loop-probe.js` measures the loop rate, the `antcv:sections-updated` emit rate, and whether the FAB/name nodes are being recreated — run it live, then patch the emit at source.

### PRIVACY-FAB-FLICKER-001 — FIXED (the "bleeping" background)
- Owner (high priority): the privacy 🛡 pill in the top bar pulses ("bleeps") its background.
- **Diagnosis:** `worst` (the privacy level) is read from a stable localStorage key, so it does not legitimately flap. The only periodic actor is `antcv-privacy-led.js`'s **2 s `setInterval` → `refreshFabAppearance`**, which every tick rewrote `textContent`, detached/re-appended the `.antcv-privacy-dot`, and re-asserted `background … !important`. The element carried `transition: background-color 0.15s`, so each re-assert cross-faded the fill — a periodic repaint seen as a pulse. (`topbar-tools-347` restyles size/visibility only — no background; `mobile-fab-cleanup-351` uses a translucent fill but only on the separate mobile FAB, which privacy-led's `FAB_MARKER` selector does not match — so no cross-sidecar background contention on the desktop pill.)
- **Fix (v1.50.74):** (1) dropped `background-color` from the FAB's `transition` so the fill can never animate; (2) added an idempotency guard in `refreshFabAppearance` — a `data-antcv-pl-sig` (worst|glyph|calls) short-circuits all DOM writes when the visible appearance is unchanged, so the 2 s tick stops repainting. Border/glyph colour still fade on a real level change. Cache-bust: `?v=1.50.74-nobleep`, `sw.js` → `antcv-1.50.74`, `version-override` TARGET → `1.50.74` (1.50.73 → STALE).

### NAME-ALIGN-001 — FIXED (sidecar)
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". Confirmed the editor's `wrapEditable` does NOT touch text-align — the `left` comes from app.js rendering the Name with `text-align: y("name")`, which is desynced from the CJLR control. Pure app.js-internal state desync (the control's displayed value and `y("name")` disagree).
- **Fix:** new sidecar `pwa/antcv-name-align-fix.js` (v1.0.0) keeps the Name line's text-align in lock-step with its CJLR control: reads the control's `current: <align>`, persists it to `localStorage:antcv:nameLineAlign` (so it survives the panel being closed / reloads), and applies it `!important` to `[data-antcv-candidate-edit="name"]`, re-applying on re-render + on a CJLR click + a 1.2s backstop. Disable hatch `antcvDisableNameAlignFix`. Cache-bust: new tag `?v=1.0.0`, `sw.js` → `antcv-1.50.73`, `version-override` TARGET → `1.50.73` (1.50.72 → STALE).

### Candidate panel ↔ preview sync — TRIAGE (2026-06-04)
Owner reported, after the role/company fix landed: preview→panel input doesn't refresh; the Name panel input isn't connected to the preview Name; contact/Location fields aren't connected; the preview Specialisation line isn't editable; and the panel has a redundant combined "Location line" alongside city + country.
- **Root:** the contact/name/specialisation panel, the line-alignment store, and the "Location line" field all live in **minified `app.js`** (not the readable React islands). Each candidate field writes its own in-app state object and `app.js` owns the rendering, so a per-field sidecar bridge is the wrong shape (high-risk, untestable here, will conflict). The role/company fix only worked because that store was a clean top-level localStorage key (`meta`).
- **Recommendation:** treat the candidate panel↔preview two-way sync + field cleanup as one app.js/React task (plan CA-001..005), done with live testing — not a growing stack of blind sidecars.
- **Owner decisions captured (queued):** drop the redundant combined "Location line" input and relabel the city field to "Location" (keep country) — implementable as a safe hide/relabel sidecar next.

### CL-HEADER-001 — panel↔preview store mismatch FIXED (p0d-fix7)
- **Found via the panel + screenshot:** the Set-panel "Application — Role/Company" inputs and the top-bar chip use the localStorage **`meta`** object (chip renders `` `${meta.role} @ ${meta.company}` ``, app.js `setItem("meta")`). The preview sentence read `personalInfo.role/company` — a DIFFERENT store — so panel edits (`Gt`/`dfdf`) updated the chip but the sentence kept showing the showcase fallback (`Ideal: [Role] - That Company`, where `That Company` = `pi.targetCompany`).
- **Fix (`p0d-fix7`):** `candidate-preview-editor-341` now reads role/company from `meta` first (falling back to the legacy personalInfo keys) and writes preview edits back to `meta`, so the panel, the chip, and the preview sentence share one source of truth. Added a `storage`-event listener for the `meta` key to re-sweep. Cache-bust: `?v=p0d-fix7`, `sw.js` → `antcv-1.50.72`, `version-override` TARGET → `1.50.72` (1.50.71 → STALE).
- **Still owed (app.js, out of sidecar scope):** the panel exposes only Role + Company inputs, not the "Application" label word (CA-002 wants applicationLabel in the panel too); the label IS editable in the preview. Reverse sync (preview edit → live panel-input value) updates `meta` + chip but the panel input reads app in-memory state, so it refreshes on the app's next render, not instantly.

### CL-HEADER-001 — edit-safety guard (p0d-fix6, shipped #107)
- On 1.50.70 the host DOES attach: `<div data-antcv-candidate-application-sentence="1">` with three `contenteditable` spans (`applicationLabel` "Application", `role` "[Role]", `company` "[Company]"). The fields read are correct — the editor reads `pi.role`/`pi.company`, which the probe confirmed the panel writes.
- **Real root cause:** `wrapApplicationSentence` ran `host.innerHTML = ''` and rebuilt the spans on EVERY sweep. With the preview re-rendering constantly (HIWC-RERENDER-LOOP-001), each sweep destroyed the span the user was typing into → focus lost, text reverted to placeholder. So the line was un-editable and never showed the entered role/company (only the app-name chip updated).
- **Fix (`p0d-fix6`):** edit-safety + idempotency guard — skip the teardown when focus is inside the host (user is editing) or when the existing spans already match label/role/company. Cache-bust: `?v=p0d-fix6`, `sw.js` → `antcv-1.50.71`, `version-override` TARGET → `1.50.71` (1.50.70 added to STALE). Verify on 1.50.71: typing in Application/Role/Company spans sticks; panel edits flow into the sentence.
- **Still open sub-items:** the `nowrap; overflow:hidden` on the header line is CL-LAYOUT-002 (clips to page width). NAME-ALIGN-001 (below).

### OPEN — NAME-ALIGN-001
- Owner: the candidate Name renders `text-align: left` while its CJLR control reads "current: center". The center alignment is not applied to the Name line. Captured: `<div data-antcv-candidate-edit="name" style="...text-align: left;...">` with a CJLR button titled "CJLR for Name line — current: center". Fix: apply the stored CJLR value to the name node. Needs to confirm whether the alignment writer is `candidate-preview-editor-341`, a CJLR sidecar, or app.js.

### PRIVACY-FAB update (2026-06-04, on 1.50.71-era capture)
- The button itself now renders visible in the panel-open state (the captured node no longer carries `display:none`/`visibility:hidden`). What remains is the inner `<span class="antcv-privacy-dot">` blinking — likely a CSS pulse "live" indicator and possibly intentional. The "invisible when section tabs are closed" state was not captured; still needs the closed-state DOM + the style-mutation watch (capture B) to decide if any patch is warranted.

### Still-not-fixed reports (need version confirm / further work)
- **HIWC template still hidden in CL (owner):** `prv-bullets3` keeps the template when no real-data sibling exists; if it is still blank, either 1.50.70 had not loaded yet, or the empty template is not emitted by the app render at all (not a dedup case). Confirm `ANTCV_VERSION` = 1.50.70 after hard refresh; if still blank, this is an app-render gap, not the dedup.
- **PRIVACY-FAB-FLICKER-001 worse:** now invisible when section tabs are closed, flickers when the section panel is open; should be a persistent topbar pill. Captured node still carries `display:none !important` + `opacity:1 !important` + `data-antcv-topbar-moved="1"` — `mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led` fighting. Needs a mutation-source probe before patching.

---

## 2026-06-04 — HIWC bullet-dedup console flood (fixed) + re-render loop (new, OPEN)

Owner report: in the cover-letter "How I Would Contribute" the second group of three bullets pops in and out continuously, and the console is flooded so a probe readout can't be taken.

### Fixed — console flood from `antcv-preview-bullets-dedup-341.js`
- **Root cause:** a re-render loop elsewhere keeps re-mounting the template `<ul data-antcv-hiwc-list="1">` as FRESH DOM nodes (without the `data-antcv-prv-bullets-hidden` marker), so the dedup re-hides each new node and logged a per-node `console.debug` every time — thousands of lines that drown the console.
- **Fix (v1.40.341-prv-bullets2):** collapse the per-node log into one debounced summary (`hid N template-only list(s) since last report`, ≤1 / 2s). Behaviour-preserving — hide/show logic unchanged. Cache-bust: `index.html ?v`, `sw.js CACHE` → `antcv-1.50.68`, `version-override` TARGET → `1.50.68` (+ 1.50.42..67 added to STALE). The reported count now doubles as a re-render-rate signal.

### Fixed — empty HIWC section rendered blank (`prv-bullets3`)
- **Symptom (owner):** after the flood fix, the HIWC bullets were fully hidden unless text was typed in the section panel; the empty template placeholders should stay visible.
- **Root cause:** `hideTemplateLists` hid EVERY template-only `<ul>`/`<ol>` unconditionally — including when no real-data render existed to fall back to — so an empty section went blank. The module header always intended a sibling check ("hide only when a sibling editable-text span shows the same text") that the code never implemented.
- **Fix (v1.40.341-prv-bullets3):** added `hasRealDataSibling(list)` — a bounded (≤4-ancestor) search for a `[data-antcv-editable-text="true"]` span with real, non-placeholder content outside the list. Hide the template only when such a sibling exists; otherwise keep the template visible. Worst case degrades to the prior duplicate render, never a blank section. Cache-bust: `?v=prv-bullets3`, `sw.js` → `antcv-1.50.69`, `version-override` TARGET → `1.50.69` (1.50.68 added to STALE; invariant preserved).

### OPEN — PRIVACY-FAB-FLICKER-001
- **Status:** OPEN — note only; not yet diagnosed.
- **Symptom (owner):** the Privacy 🛡 FAB "bleeps" (flickers). Captured node carries conflicting inline styles — `display:none !important; visibility:hidden !important; pointer-events:none !important` AND `opacity:1 !important` AND `data-antcv-topbar-moved="1"` — i.e. competing sidecars (`mobile-fab-cleanup-351` / `topbar-tools-347` / `privacy-led`) fighting over its visibility/placement (PRV-005). Needs a probe of which sidecar writes the style last on each tick before any patch.

### OPEN — HIWC-RERENDER-LOOP-001 (the actual flicker)
- **Status:** OPEN — needs a targeted probe before any patch (diagnostic-first; do not blind-patch a central sidecar).
- **Symptom:** the template HIWC bullet list re-mounts on a loop, so the dedup is in a perpetual race (visible flash → hidden → visible …).
- **Suspected driver:** `antcv-candidate-preview-editor-341` writes sections (`source: 'candidate-preview-editor-341'`) → `antcv-personality` `forceRebuild` on `antcv:sections-updated` → React re-mounts the section → editor's observer fires → writes again. Console shows this chain repeating.
- **Next step:** instrument which sidecar re-fires `antcv:sections-updated` without a real data change, then gate that emit on an actual diff. Candidate fix sits in `candidate-preview-editor-341` (and/or the personality forceRebuild trigger), both readable sidecars.
- **Related QA-spec IDs:** CL-003 (HIWC modelled as Intro + per-bullet rows + Closing), GEN-UI-003 (endless controls under generation), PRV.

---

## 2026-06-03 — test-infrastructure landing + roadmap status audit (branch `claude/antcv-roadmap-bugs-L9Sqa`)

Scope this entry covers: automated tests and status tracking only. No sidecar,
`app.js`, or React-island behaviour changed — the open UI/UX items below are
untouched and still owe live verification per the DoD gate.

### Landed
- **Proxy writing-engine unit tests (40, `node:test`).** `workers/proxy/test/writing-style-engine.test.mjs` (32) + `workers/proxy/test/registry-sync.test.mjs` (8). Pure logic, no Cloudflare bindings, no network — every LLM call is injected. `npm test` in `workers/proxy/` is now `node --test`. All 40 pass locally on Node 22.
- **Registry-drift guard.** `registry-sync.test.mjs` ties the worker's inline style + banned-list subset back to the canonical `writingSystems/registry.json` (style-id set, default, language partition, shared banned words + phrases exact, per-style active / allowed length / tone chips / glyph density, every legacy alias resolves, active-at-cut roster). The "keep in sync" comment in `writing-style-engine.js` is now enforced, not advisory.
- **CI gains a functional check.** `.github/workflows/deploy.yml` adds a `unit-tests` job (Node 22, `node --test`, no install step) and a `pull_request` trigger so `lint` + `unit-tests` run pre-merge. Deploy jobs stay gated on push-to-main / workflow_dispatch — a PR never deploys.
- **Docs updated:** `TESTING.md` (Unit row, new "Proxy worker" subsection, §8.4 row marked seeded, CI section), `README.md` Tests list.

### Roadmap status audit — confirmed implemented in code (live/visual verification per DoD is separate)
- **§4.7 writing-engine pipeline** — `workers/proxy/src/writing-style-engine.js`: request parse + normalisation, preamble enrichment, SCE banned-list filter, ≤2-retry loop with flagged third draft, ATS glyph conversion, telemetry. Now unit-covered.
- **§4.5 language-partitioned banned lists** — object keyed by ISO code in both registry and worker; a Danish output is never filtered against English bans. Now unit-covered (preamble + SCE partition tests).
- **§4.10 glyph rules** — `src/lib/glyph-rules.ts` (PWA) + worker copy; allowed bullets and ATS labels agree across both.
- **Registries present and driving output** — `packages/registry.json` (CSS bundle + DOCX palette), `writingSystems/registry.json` (12-style engine).
- **Pass-1 React islands** — present under `src/islands/` (LanguageCard, PreviewToolbar, SettingsRouter, PackagePicker, WritingStylePicker, ExportOptionsCard, LayoutPicker, Breadcrumbs, wizard pickers).
- **docx-worker per-package palette (v1.50.8)** — `workers/docx-worker/src/palette.js`, legacy-ATS Calibri fallback; baseline smoke (`test/smoke.js`) passes locally.

### Known environmental gap (not a product bug)
- `workers/access-relay/tests/*.mjs` hardcode the sql.js wasm at `/home/claude/work/sqljs/sql-wasm.{cjs,wasm}`, which is absent here, so both relay suites error on load (`MODULE_NOT_FOUND`) until that path is provisioned. They are not in CI for this reason. Candidate follow-up: make the wasm path overridable via env var and vendor or fetch sql.js so the relay suites can join the `unit-tests` job.

---

## SESSION LANDED — shipped to `main`, LIVE VERIFICATION OWED (highest priority)

Everything in this block is committed to `main` (code complete) but went straight to `main` **without passing the acceptance gate** (see DoD below). None of it has been confirmed on the live site. Treat live verification as the top open task — bias to short, careful checks, and do not mark any item FIXED until it passes in Preview + PDF + DOCX (where applicable) on **desktop and mobile**, with no Preview-only, wrong-item, or after-hard-refresh-only behaviour.

Deploy anchor: islands bundle rebuild + Export-options move landed at commit `c475c4b` on `main`. Verify Cloudflare Pages has built that commit, then `?hardReset=1` before testing (clears the service worker + caches).

### What landed this session
- **QA spec v4 ingest.** Memory pointer added; canonical index committed at `docs/qa/AntCV_QA_backlog_index_v4.md`; this `ACTIVE_BUGS.md` folds in the v4 backlog. (Documentation — no live behaviour to verify, but it is the source of the IDs referenced below.)
- **357 sidecars + loader.** `antcv-validation-severity-consumer-357.js` (VAL-001 / VF-016 — stamps Set-menu validation nodes by severity so warnings render yellow, errors red), `antcv-help-text-wording-357.js` (PB-005 / TB-003 — rewrites "Compress" to "Fit" on non-button help/legend/caption nodes), `antcv-page-break-icon-357.js` (PB-005 / GEN-003 — swaps the down-arrow glyph for the semantic next-page glyph U+2398 on identified page-break controls only), and `antcv-357-loader.js` (runtime registrar; index.html also carries direct tags — double-registration is a no-op via per-file version guards + the loader's already-present skip).
- **Analysis-panel JD block — clean v1.40.358.** `antcv-analysis-panel-jd-block-356.js` rewritten after the branch copy was found corrupted (two conflicting `findAnalysisPanel` definitions merged from parallel worktrees → syntax error that stopped the whole sidecar parsing). The clean version (a) attaches to the EMPTY-state panel — keyed on the "Generate a CV first to see the analysis" text, not just the "Application Analysis" heading that the empty state never renders — and (b) uses a TIGHTENED ancestor climb (stop at the app shell, stop when the candidate begins to contain shell controls / the Advanced-Style button, stop past ~2.2x the marker width) so the block lands in the panel column, not an oversized wrapper. Hides the native placeholder once attached.
- **Export-options → Layout subtab.** React-island source change (not a sidecar): `ExportOptionsCard` is now collapsible and **collapsed by default** (open state persists in `localStorage:antcv:exportOptionsOpen`; header shows an "N on" badge when collapsed). Its mount (`src/islands/ExportOptions/mount.tsx`) is gated on the new `isLayoutSubtab()` and anchored immediately ABOVE the "Open Advanced → Style" hand-off button via the new `findAdvancedStyleButton()` (both in `src/lib/settings-dom.ts`). Requires the rebuilt `antcv-react-islands.js` (shipped at `c475c4b`); source changes alone do nothing until that bundle is built + the bundle `?v=` is bumped.

### Verification checklist (run on live, desktop AND mobile)
- [ ] **Analysis panel (empty state):** shows the JD paste/upload + "Analyse JD" block instead of only "Generate a CV first to see the analysis." Block sits in the panel column (not an oversized wrapper). Console shows `[analysis-panel-jd-block-356] installed v1.40.358`. Run completes both /api/recheck-fit and /api/jd-analysis and renders in-panel.
- [ ] **Export-options in Layout subtab:** appears collapsed by default, immediately above the "Open Advanced → Style" button; caret expands/collapses; "N on" badge reflects active toggles. Both ATS-safe and Legacy-tier toggles work and PERSIST across Settings close/reopen (write to `personalInfo.exportPrefs`).
- [ ] **Export-options removed from Personal subtab** (no duplicate, no orphan).
- [ ] **VAL-001 / VF-016:** validation warnings render yellow, errors red, with distinct labels.
- [ ] **PB-005 / TB-003:** no user-facing "Compress" wording in help/legend/caption text; page-break control shows the semantic page glyph, never a down arrow.
- [ ] Confirm none of the above is Preview-only, wrong-item, or only-after-hard-refresh.

### Known follow-ups if verification fails
- `anchorForButton` (Export-options) climb is a heuristic (max 2 single-child wrappers). If the card lands in an odd spot, report the Advanced-Style button's parent structure and tighten.
- Empty-state panel selector: if the JD block attaches to an oversized container, report `window.AntcvAnalysisPanelJdBlock356._findPanel()` (className + width) and tighten `maxW`.
- **Relay CORS mismatch (unresolved):** access-relay returns `Access-Control-Allow-Origin: https://antcv.pages.dev`, but testing was done on `cv-generator-det.pages.dev`, which is CORS-blocked at `/config` ("no relay access"). Decide the canonical live domain first, then patch the allowed origin(s) in `workers/access-relay/src/index.js`. Do not patch before the domain is settled.
- `LayoutPicker/mount.tsx` comment is now stale (it still says "between WritingStylePicker and ExportOptionsCard"); its anchor falls back correctly so it is doc-drift only.

---

## OPEN (session-level, highest priority)

### CL-HEADER-001 — Cover-letter "Application: [Role] — [Company]" header not editable, wrong font/colour
- **Status:** OPEN — not yet touched.
- **Symptom:** The header line "Application: [Role] — [Company]" cannot be edited in the CL preview, and renders in the wrong font/colour versus the rest of the document.
- **Root cause (CONFIRMED 2026-06-04 via `antcv-cl-header-probe.js` watch):** Panel Role/Company edits DO reach storage — the probe logged `piRole` and `piCompany` changing on each panel keystroke, each firing `candidate-preview-editor-341` → `antcv-personality` forceRebuild. The break is the OTHER direction: the snapshot showed `visible sentence hosts (0)` and the `sentence` fingerprint never changed. So `personalInfo.role/company` update fine, but `candidate-preview-editor-341`'s `wrapApplicationSentence` never attaches an editable host (its anchor/block search returns nothing on the CL), so the visible "Application:" line is neither editable nor re-rendered from the updated personalInfo. The old "writes to a hidden anchor" theory is wrong — panel→storage works; storage→visible line is the gap.
- **Next:** capture the visible "Application:" line's DOM (why `findCandidateBlock`/anchor search misses it), then fix the attach in `candidate-preview-editor-341` so the sentence renders from `personalInfo.role/company` and is editable. Verify Preview + PDF + DOCX.
- **Fix direction:** Bridge panel Role/Company edits to the visible sentence spans (or make the visible sentence the single source of truth); correct font/colour to document tokens. Verify in Preview, PDF, and DOCX.
- **Diagnostic (next step):** `pwa/antcv-cl-header-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Paste it into the live console on the CL Preview; it snapshots which `personalInfo` key holds role/company, the visible-sentence host text + computed style vs the name leaf, the hidden anchor, and the Settings-panel Role/Company field values, then `__clHeaderProbe.watch()` attributes a panel edit to a storage write and/or a re-render. Run reproduce → probe → targeted patch per CLAUDE.md; do not patch before the probe output identifies the key/render path.
- **Related QA-spec IDs:** CA-002 (Application sentence sync), CL-LAYOUT-002 (Application line width).

### APPHIST-ZIDX-001 — "Open in Settings →" opens Settings behind the preview
- **Status:** OPEN — needs live DOM evidence on fresh code before fixing.
- **Symptom:** From Application History, clicking "Open in Settings →" opens the Settings panel BEHIND the preview (z-index / stacking-context issue); user can't see/reach it.
- **Context:** app.js handler (v1.40.326) sets settingsTab + `window._antcvOpenSettingsRoute({tier:"standard",subtab:"apps"})`. Related sidecars: `antcv-app-history-zfix-291`, `antcv-app-history-back-to-preview-341`, `antcv-preview-shell-sticky-341`.
- **Fix direction:** Capture the stacking order live on current deployed code, then raise the Settings route above the preview shell (or lower the preview while Settings is foregrounded). Do not fix blind.
- **Diagnostic (next step):** `pwa/antcv-apphist-zindex-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). After clicking "Open in Settings →" so the mis-stacked panel is on screen, paste it into the console. It reports the chosen Settings panel + its full stacking-context chain (every ancestor that establishes a stacking context, with z-index), the preview-shell candidates and their chains, and — the ground truth — `paintOrderAtPanelCentre`: what `document.elementFromPoint` actually paints on top where the panel should be, and whether that topmost node is inside the preview or the panel. Distinct from `app-history-zfix-291` (which only raises the history dropdown above the slider). Run reproduce → probe → targeted patch.
- **Related QA-spec IDs:** AH-001 (Open in Settings foregrounds Application History).

### EXPORT-PAGE2-001 — Document-export preview: page 2 missing / no page breaks
- **Status:** OPEN — re-verify on fresh code.
- **Symptom:** Export preview shows only page 1 / page breaks not applied; page 2 content missing from the rendered preview.
- **Context:** Gate collects all `.antcv-preview-paper`; `antcv-pdf-page-mismatch.js` chips on count mismatch. Page-break sidecars: `antcv-page-breaks-everywhere-284`, `antcv-table-page-splits-327`, `antcv-sidebar-subsection-pagebreaks-329`. Watermark: `antcv-watermark-page-anchor-341`.
- **Fix direction:** Re-test on fresh deployed code. If still broken, determine whether the break is dropped in the preview render path or only in PDF/DOCX export; confirm against PB-001..006 gates.
- **Narrowed (2026-06-04):** the docx-worker page-break engine is healthy — `test/smoke-pagebreak.js` and `test/smoke-jd-questions-page2.js` pass 10/10 each, so the `.docx` export emits page 2 for the covered cases. That points the remaining defect at the CLIENT export-preview path: `antcv-pdf-preview-gate.js` builds `#antcv-pdf-preview-modal-iframe` and clones every `.antcv-preview-paper` into it (a v1.50.31 bug carried only page 1; v1.50.32 claims the fix). Preview page count = `[data-antcv-page-break="1"]` markers + 1.
- **Diagnostic (next step):** `pwa/antcv-export-page2-probe.js` — read-only console probe (NOT loaded by index.html, never writes DOM/storage). Open the export/PDF preview, paste it in. It compares the source `.antcv-preview-paper` papers + page-break markers against what the gate iframe actually carries (`paperCountSourceVsIframe`, `markerCountSourceVsIframe`), reports whether `break-before` is computed on the iframe markers, and flags any paper that overflows one page with no marker. That isolates whether page 2 is dropped in the clone, in the marker injection, or in the break CSS.
- **Related QA-spec IDs:** PB-001..006, WM-005.

---

## QA SPEC BACKLOG (merged from AntCV_UI_UX_Spec_and_QA_Plan_v4.docx)

Status legend: `[ ]` open · `[~]` partially addressed · `[x]` believed fixed (verify). Update as work lands.
Full ID list with severities: `docs/qa/AntCV_QA_backlog_index_v4.md`.

### Core rules / Definition of Done (GEN)
- **GEN-001..011** — [~] Preview/DOCX/PDF parity; control locality (a button acts only on its own item); standard control order = Page Break, CJLR, Enhance, Fit, Delete; "Compress" renamed "Fit" everywhere; edit persistence; no clipped/hidden controls; drag-drop parity; a11y labels; preview-utility responsive parity; warning = yellow, error = red; CL generation must capture table data.
- **Acceptance gate (DoD):** no fix accepted if it works in Preview but not DOCX/PDF; affects the wrong item; lands a drag-drop at the end when the indicator showed elsewhere; attaches the watermark to text flow instead of the page box; hides/clips controls; or only works after a hard refresh. Every fix verified in Preview + PDF + DOCX, desktop and mobile where relevant. Page Break icon must be a semantic page-change glyph, never a down arrow.

### Cover Letter (CL)
- **CL-001** — [ ] Remove duplicate Preview action-button overlay.
- **CL-002** — [ ] Make Closure directly editable + persist.
- **CL-003** — [ ] Model "How I Would Contribute" as Intro + per-bullet rows + Closing (closing never a bullet; +Add at end).
- **CL-004** — [ ] Attach one control group per Foundation textbox.
- **CL-005** — [ ] Normalize CL body controls + add section-move button. (Partially via `cl-body-move-button-341` ☰ Move — VERIFYING.)
- **CL-006** — [ ] Capture table data in CL generation.
- **CL-LAYOUT-002** — [ ] (High) Constrain Application line to usable page width in Preview/PDF/DOCX.

### Page Break (PB)
- **PB-001** — [ ] Manual break from main + sidebar updates state, page model, numbering, all outputs.
- **PB-002** — [ ] Break on first sub-subsection moves whole subsection to next page with original heading, no dup.
- **PB-003** — [ ] Non-first sub-subsection duplicates heading + localized "Cont." label 18pt from top.
- **PB-004** — [ ] Table: first row moves whole table; later row splits and repeats headers.
- **PB-005** — [~] Replace down-arrow icon and "Compress" text. (Semantic page glyph via `page-break-icon-357`; "Fit" wording via `help-text-wording-357`/`row-controls-wording-341` — VERIFYING this session.)
- **PB-006** — [ ] Keep Professional Experience CONT pattern.

### Watermark + Candidate (WM / CA)
- **WM-001** — [ ] Anchor watermark to last-page corner, page-level not text flow.
- **WM-002** — [ ] Avoid collision; lower corner by clearance.
- **WM-003** — [ ] Text-only, no border/fill/shadow.
- **WM-004** — [ ] CL watermark page-anchored.
- **WM-005** — [ ] PDF watermark last page only.
- **CA-001..005** — [ ] Candidate Preview editing; Application sentence sync (panel Role/Company vs rendered sentence, no dup label) [see CL-HEADER-001]; section-move on movable rows; insertion-point drag-drop; destination styling and Restore.

### Tables / Outcomes / Publications (TB / SO / PP)
- **TB-001** — [ ] Per-line CJLR on Core Competencies.
- **TB-002** — [ ] Page Break per row per PB-004.
- **TB-003** — [~] Fix "What I Bring" help text; no "Compress" or down arrow. (Help-text wording via `help-text-wording-357` — VERIFYING this session.)
- **SO-001** — [ ] Add Page Break, CJLR, Enhance, Fit before Delete on each Selected Outcome row.
- **SO-002** — [ ] New rows identical.
- **PP-001** — [ ] Expose hidden Publications controls in row layout.
- **PP-002** — [ ] Single input acts on whole entry.
- **PP-003** — [~] HIGH-RISK; shared row-control model only; buttons row-anchored and stable in generation. (Stale injected Enhance/Fit buttons addressed by `pub-injected-reaper-352` — VERIFYING.)

### Preview shell + validation (PRV / AH / VAL)
- **PRV-001** — [ ] Restore 3 desktop lower-right Preview utility buttons.
- **PRV-002** — [ ] Restore Privacy and Fuse CL-CV desktop placement, no hidden dups.
- **PRV-003** — [ ] PDF and DOCX buttons persistent in top Preview area, route-independent.
- **PRV-004** — [ ] Loading status not click-dismissable while a job runs.
- **PRV-005** — [ ] Circular buttons viewport-specific; mobile bottom-right kept. (Mobile FAB cleanup via `mobile-fab-cleanup-351` — VERIFYING.)
- **AH-001** — [ ] "Open in Settings" foregrounds Application History [see APPHIST-ZIDX-001].
- **VAL-001** — [~] Errors red, warnings yellow, distinct labels. (Token sidecar `validation-severity-341` + consumer `validation-severity-consumer-357` that stamps the rendered Set-menu nodes — VERIFYING this session. Overlaps GEN-011 / VF-016.)

### Onboarding / generation / layout / export / responsive (third + fourth pass)
- **LANG-001** — [ ] (Med) Settings vs top-bar language mismatch (Chinese ticked, not in bar); fallback EN+DA, wizard is source of truth.
- **IMPORT-001** — [~] (High) Import reports 0 work entries despite valid JSON; map experience/education/certifications/publicationsStructured lengths. Shipped fixes: `antcv-upload-recount-339.js` (dual-key normalise + toast recount) and the importer's experience→sections.cv bridge. The contract is now codified + regression-covered in `pwa/lib/import-normalize.js` + `pwa/test/unit/import-normalize.test.mjs` (18 tests, incl. a static drift guard over both sidecars and the Anita persona as fixture). Live verification of the in-app import still owed; adopting the shared module inside the sidecars is a follow-up (touches loaded scripts → needs browser verification).
- **ONBOARD-001** — [ ] (High) Step 3B writing-register list not scrollable on mobile; Next unreachable (dvh, sticky footer).
- **GEN-001b** — [ ] (High, §14.2) Kernel generation leaves major CV sections empty/underfilled; add unsolicited fallback + warnings.
- **GEN-002b** — [ ] (High, §14.2) CL generation drops What I Bring table signals + Why This Position bullets.
- **GEN-UI-001** — [ ] (Med) Redundant Enhance/Fit buttons under generation Cancel action.
- **GEN-UI-002** — [ ] (Med) Generation time estimate too optimistic; almost-done shown too early (use ~4 min default).
- **GEN-UI-003** — [ ] (High) Repeated/endless Fit controls under "Cancel & return to editor"; hard rendering guard when generation view active.
- **LAYOUT-001** — [ ] (High) Sidebar background does not extend to page bottom in Preview/PDF/DOCX.
- **EXPORT-001** — [ ] (Med) Missing download-start indicator for PDF/DOCX export.
- **EXPORT-002** — [ ] (Critical) PDF export fails; needs visible recovery + retry, must not corrupt current doc.
- **RESPONSIVE-001** — [ ] (High) Mobile Preview loads desktop split-pane layout; Section/Analysis/Preview must be mobile bottom modes.
- **PDF-LAYOUT-001** — [ ] (High) PDF page 2 shows stray Selected Outcomes heading before Professional Experience continuation.

---

## VERIFYING (shipped, confirm on fresh code)

- **export-options → Layout subtab (islands `c475c4b`)** — moved from Personal; collapsible, collapsed by default, above the Advanced-Style button. See SESSION LANDED checklist. (Export-options relocation.)
- **analysis-panel-jd-block-356 → v1.40.358** — clean rewrite; attaches to the empty-state panel + tightened ancestor selection; index.html tag + loader registered. See SESSION LANDED checklist. (Analysis panel empty-state usability.)
- **validation-severity-consumer-357** — stamps Set-menu validation nodes by severity (VAL-001 / VF-016). See SESSION LANDED checklist.
- **help-text-wording-357** — "Compress" → "Fit" on non-button help/legend/caption nodes (PB-005 / TB-003).
- **page-break-icon-357** — down-arrow → semantic page glyph U+2398 on identified page-break controls (PB-005 / GEN-003).
- **357-loader** — runtime registrar for the four sidecars above; skips any already present via a direct index.html tag.
- **section-panel-211 v1.40.350** — endless Publications mini-button flicker / re-injection. Idempotent attribute writes + observer guard + attribute-first classification.
- **pub-injected-reaper-352** — removes the two stale `data-antcv-pub-injected` Enhance/Fit buttons wherever they appear. (PP-003)
- **mobile-fab-cleanup-351** — hides mobile JD/Fusion FABs; relocates mobile Privacy into the top bar as a compact higher-contrast pill. (PRV-005)
- **cl-body-move-button-341 v1.40.350** — ☰ Move button mounts on CL body rows (`data-antcv-align-sid` selector fix). (CL-005)
- **personal-info-anti-thinning-353 → v1.40.354** — blocks load-time near-total wipe of local personalInfo; narrowed so it never touches generation/editing writes.
- **cloud-put-shrink-guard-355** — compares a thin /api/prefs PUT against a fresh cloud GET; blocks a large shrink. (Committed; wiring/verification pending.)

---

## NOTES / DEPENDENCIES

- Deployed app.js does NOT yet render `recruiter` / `red_flags` from `rationale`. The 356 block renders those in-panel itself (Option A). Native panel render of those fields needs an app.js push (manual; minified bundle).
- React-island changes (e.g. the Export-options move) require a Vite rebuild of `pwa/antcv-react-islands.js` and a bundle `?v=` bump — source edits alone never reach the live site. Last islands rebuild: `c475c4b`.
- Housekeeping (raised to MEDIUM): prune stale `.claude/worktrees/*`. These caused repeated git trouble this session — `main` advancing under local work, a recurring merge conflict on `antcv-analysis-panel-jd-block-356.js`, and an accidental push of `fix/validation-severity` (283 unpushed commits) from inside a worktree. Remove the ones not actively used before the next work session; confirm none is running an automated agent that pushes to `main`.
- The QA-spec IDs above are summarized from `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`; consult that doc for full per-ID prose, screenshots, and acceptance detail. The retrievable ID index is `docs/qa/AntCV_QA_backlog_index_v4.md`.

### LOOP-DAMPER REVERTED + HIWC focus-restore (1.50.89)
- **Owner test result:** disabling the loop damper (`localStorage.antcvDisableLoopDamper=1`) STOPPED the WIB/Experience/Core-Competencies control multiplying → the global `MutationObserver` wrap (1.50.85) regressed those per-row injectors' self-cleanup. **Reverted:** removed the `antcv-loop-damper.js` script tag from index.html (file kept in repo, not loaded). Loop now handled only by the targeted per-sidecar idempotency fixes (rounds 1-7), which were safe + converging.
- **HIWC still hard to type (damper OFF too):** the app re-renders the HIWC section and re-creates the bullet input, dropping the caret. Added focus preservation to `how-contribute-controls-245`: track the last-focused bullet index + caret (`noteHiwcFocus` on focus/keyup/click/input), and after the editor is rebuilt restore focus + caret to the same input (`restoreHiwcFocus`, sync + setTimeout(0)). Combined with the 600ms debounce (1.50.86) + edit-safety guard (1.50.87), typing should be uninterrupted. `?v=1.50.89-focus`, sw → `antcv-1.50.89`, TARGET → 1.50.89 (1.50.88 → STALE).
- **Net for release:** privacy blip fixed at source (CSS), HIWC double-bullets gone (app owns bullets), empty template preserved, panel/align attribute storms idempotent, and the multiplying regression removed. Remaining loop rAF is back (damper gone) but is far lower than the original after rounds 1-7; the visible user bugs (blip, multiply, double bullets) are resolved.

### DOCX-EXPORT-REGRESSION-001 — hardened the preview-modal export (1.50.90)
- Root: the preview/print-setup modal's "Save as DOCX" only did `document.querySelector('button[title^="Export as .docx"]').click()` and, if that app button wasn't reachable in the current view, alerted "isn't ready" and nothing downloaded (commit 0eaee37 added it; it was the single export surface per 1.50.49).
- Fix (`antcv-pdf-preview-gate.js` 1.50.90): `triggerDocxExport()` now (1) finds the app DOCX button via several selectors (title prefix/contains + text/Word match) and clicks it; (2) if it truly can't be found, calls `window.exportDocxViaWorker` DIRECTLY with a payload rebuilt from localStorage (sections/meta/doc/personalInfo/photo/styleConfig/fontSizes/language/navyColor) — the same worker path the app uses; (3) logs which path it took (`[pdf-preview-gate] DOCX: …`) so the failure mode is visible if it still fails. `?v=1.50.90-docx`, sw → `antcv-1.50.90`, TARGET → 1.50.90 (1.50.89 → STALE).
- Verify: open preview → export → Save as DOCX → file downloads. If not, the console line says whether it delegated, called the worker, or the worker URL is missing (Settings → Account).

### Remaining QA-pass items (registered, post-DOCX)
- CORE-COMP / WIB tables: 2 redundant page-break buttons per row; textarea/cell sizes too small; pressing the page button only flickers it (doesn't advance the row to the next page). Owners: table-row-page-controls-328 / core/wib row-control sidecars + page-cascade store.
- HIWC still reported not-editable + no preview template on 1.50.89 for the owner — recheck after the table/loop work; if persistent, the app re-render rate is still high enough to defeat the focus-restore (needs the editor's own rebuild gated harder).
