# TC-020 — regression-sweep checklist

The §10 gate phase. Runs after all P0/P1 PRs are on main. The harness (`pwa/antcv-regression-sweep-341.js`) automates most assertions; this checklist covers the visual + interactive items a human still has to verify.

## Setup

1. `git fetch && git checkout main && git pull`.
2. Deploy the latest worker (P0-B + P0-F):
   ```
   cd workers/docx-worker && npx wrangler deploy
   ```
3. Open the deployed PWA preview URL OR run locally:
   ```
   cd pwa && python -m http.server 8765
   ```
4. Load `docs/personas/anita/personalInfo.json` as the test candidate.
5. Open browser DevTools console.

## Automated harness

```
window.AntcvRegressionSweep.run()
```

Expected output: `passed=7 failed=0` with all checks PASS or INFO. Any `fail` finding is a regression — record the section + finding.message, then proceed manually.

The harness covers:
- GEN-004 banned wording ("Compress" → none in editor buttons)
- GEN-002 SectionControlBar contract (every bar has itemId)
- CA-003 / CL-005 Move buttons on movable rows
- PB-003 localised continuation suffix
- VAL-001 severity tokens at :root
- WM-001 single watermark on last page
- CA-002 unique application sentence

## Manual checks — per section

### Candidate (topbar)
- [ ] Name editable in Preview; blur persists.
- [ ] Application sentence renders as `<label>: <role> - <company>` exactly once.
- [ ] Edits to each part (label, role, company) round-trip to panel.
- [ ] No duplicate label visible.

### Greeting / Opening / Who I Am / Why This Position
- [ ] Editable in Preview (CL-002).
- [ ] Move button visible left of action cluster.
- [ ] Selecting text in any of them does NOT show a duplicate 8-button overlay (CL-001).

### What I Bring (table)
- [ ] CJLR cycles per row (TB-001).
- [ ] Set PB on row 0 → whole table moves to next page; no clone header.
- [ ] Set PB on row 3 → table splits at row 3; cloned header above row 3 on the new page; rows 0–2 stay on the previous page (TB-002 + PB-004).
- [ ] Help text uses "Fit" not "Compress" (TB-003 + GEN-004).

### Selected Outcomes
- [ ] Each row exposes `PB CJLR Enhance Fit Delete` from left to right (SO-001).
- [ ] `+ Outcome` button adds a new row identical in shape to existing rows (SO-002).
- [ ] No "Compress" wording.

### Foundation
- [ ] Two textboxes (hands_on + professionally) each have their OWN 4-button bar (CL-004).
- [ ] Aligning the first does not change the second.

### How I Would Contribute
- [ ] Each bullet has its own bar (CL-003).
- [ ] `+ Add` button appends a new bullet at the end.
- [ ] Closing line stays a paragraph; never becomes a bullet.
- [ ] Delete on a single bullet removes only that bullet.

### Professional Experience (PB-006 positive reference)
- [ ] Set PB on a later role's sub-subsection → "EXPERIENCE (CONT.)" appears on the next page at 18pt from top.
- [ ] Set PB on the FIRST sub-subsection → whole section moves; heading appears ONCE on the new page (no duplicate).
- [ ] Continuation suffix matches active language (EN: CONT., DA: FORTS., ES: CONT., ZH: 续).

### Publications & Patent (HIGH-RISK — TC-028 stress)
- [ ] All five buttons (`PB CJLR Enhance Fit Delete`) visible at default editor width (PP-001).
- [ ] At narrow editor width: controls wrap to a second line OR stay accessible without horizontal scroll (GEN-006).
- [ ] Long publication text (200+ chars) does NOT push the cluster off-row.
- [ ] Many rows (8+): every row has its own cluster, none drift to a sibling.
- [ ] Mid-generation: clusters stay row-bound (don't float to panel bottom).
- [ ] Route Set → Preview → Set: clusters persist correctly.
- [ ] Hard refresh in either route: clusters restore correctly.

### Preview shell (P0-E)
- [ ] PDF + DOCX buttons visible in top gray strip after fresh load.
- [ ] Set → Preview → Set → Preview: buttons remain visible.
- [ ] Hard refresh in Preview: buttons restore.
- [ ] Hard refresh in Set, then navigate to Preview: buttons restore (this is the regression PRV-003 guards against).
- [ ] Privacy + Fuse FABs visible in lower-right cluster on desktop ≥ 901 px.
- [ ] Loading status pill click during generation: nothing happens; cursor shows wait (PRV-004).
- [ ] After generation completes: click hides the pill normally.

### Application History (AH-001)
- [ ] Click "Application history" topbar button → dropdown opens, fully visible (no slider overlap — antcv-app-history-zfix-291 still active).
- [ ] Click "Open in Settings" → Settings opens with Application History panel foregrounded + focused.
- [ ] Press browser back → return to Preview (NOT to a deeper Settings page).

### CL table capture (P0-F — requires worker deploy)
- [ ] Upload a PDF JD with a requirements table (use `docs/personas/anita/` PDFs or create one).
- [ ] Open docx-worker dashboard logs — confirm `[cloudconvert] pdf-to-docx: creating job` line appears.
- [ ] Generate the Cover Letter.
- [ ] Verify generated CL references the table contents.
- [ ] If CloudConvert fails (force by uploading a corrupted PDF), an audit-panel warning appears: "PDF tables may not have been fully captured — re-upload as DOCX for best results."

### Validation severity (VAL-001)
- [ ] Open DevTools console; type `getComputedStyle(document.documentElement).getPropertyValue('--antcv-validation-error')` → returns `#dc2626`.
- [ ] Same for `--antcv-validation-warning` → returns `#d97706`.
- [ ] Trigger a banned-word hit (add a word to `personalInfo.stylePrefs.banned_words` then re-run generation) → `antcv:validation-severity` event fires with `severity: "warning"`.

### Drag-and-drop (CA-004 + CA-005 — partial)
- [ ] Begin a drag of any movable section in the editor; the teal insertion-point line appears between siblings.
- [ ] Release: section is marked `data-antcv-just-moved-to="<container>"` for 800 ms (visible flash).
- [ ] Underlying landing position: **flagged as deferred** — if app.js still appends to end, the indicator showed N but the section lands at end. Record the gap; fix requires app.js patch (workflow rule 6).

## Deferred items (do NOT flag as regressions)

These shipped with documented gaps in their phase checkpoints:

- **CL-001 root cause**: the duplicate Preview cluster is suppressed by a guard sidecar; the emitter (in app.js) is not yet eliminated at source.
- **CL-005 / CA-003 Move buttons**: visible everywhere, but the actual reorder behaviour wires through a `CustomEvent` that app.js needs to subscribe to. Visual ships now; full reorder is a follow-up.
- **CA-004 model-side gap**: visual indicator ships; underlying landing position may still be append-to-end depending on app.js's drop handler (see drag-and-drop bullet above).
- **CA-005 destination styling depth**: CSS custom-properties exist with `inherit` fallbacks; full theming depth requires a global theme pass.
- **AH-001 popstate listener in app.js**: my sidecar dispatches `antcv:navigate-to-preview`; for full effect app.js needs a corresponding listener.
- **GEN-010 validation severity full UI surface**: bundle's audit panel doesn't yet subscribe to `antcv:validation-severity` events.
- **P1-B SectionControlBar migration**: tables / outcomes / publications row-control sidecars are NOT yet migrated to `window.SectionControlBar.mount()`. Wording sweep ships; layout untouched. See `docs/plan/P1-B-followups.md` for the per-sidecar recipe.

## DoD aggregation

For each phase merged to main, the commit body contains its Definition-of-Done block per §9. To produce a single aggregated DoD for the v1.41.0 release:

```
git log main --grep="^\[P0-\|^\[P1-" --format='%B%n---' > docs/plan/v1.41.0-DoD.md
```

…then trim to the DoD block per requirement ID and paste into the release notes.

## Pass criteria for the gate

- Automated harness: `passed >= 6, failed == 0` (one INFO is acceptable; INFOs are typically the watermark / cont-suffix tests on a document that doesn't trigger them).
- Manual checklist: every box ticked except those explicitly listed in "Deferred items".
- TC-028 Publications stress: **must pass without exception** — this is the high-risk gate per PP-003 history.

If any box fails, file an issue with the section name + finding text. Triage between "blocker for v1.41.0" and "follow-up patch acceptable post-release".
