# Batch 2026-06-06 — analysis-panel reorder + follow-ups

Owner spec captured 2026-06-06. Held until the parallel run's last cycles merge to
`main` (to avoid colliding with active privacy/analysis sidecar churn). Then taken
as one clean batch on updated `main`.

## ANALYSIS-PANEL-REORDER-001 [OPEN][feature]

Reorder the Analysis panel. Owners of the DOM:
- `arx-*` (Download + Assumptions/Confidence/Recommendations) → `antcv-analysis-report-pdf-360.js`
- `apjb-*` (the JD block: heading + Analyse-JD button) → `antcv-analysis-panel-jd-block-356.js`
- Gaps / Honest Assessment → app.js / analysis-merge renderer

**Definitive order (owner-confirmed 2026-06-06), top → bottom:**
1. **Application Analysis** — headline.
2. **Detected JD Language** — bullet/line.
3. **Recruiter** (`.antcv-rf-jdsec` `<h3>Recruiter</h3>`).
4. **Overall Fit** (existing fit summary).
5. **Strongest Fit Points** (existing).
6. **Assumptions** (`.arx-grp` "Assumptions").
7. **Red Flags** — the **red ⚑ inline** version only (blue `.antcv-rf-jdsec` copy removed).
8. **Gaps / Honest Assessment** (existing).
9. **Recommendations** (`.arx-grp` "Recommendations").
10. **Questions to Ask** (`.antcv-rf-jdsec` `<h3>Questions to ask</h3>`).
11. **Confidence review** (`.arx-grp` "Confidence review", `.arx-conf`) — PLUS a
    **button that appends the confidence overlay onto the CV + cover-letter preview
    text** (red=low / yellow=medium; ties to FEATURE-CONF-001).
12. **Recruiter Questions — Build response** — a button/action that builds answers to
    the recruiter's application questions and **adds them to the cover-letter body as
    more sub-subsections** (the previously-shipped "answers → CL page" feature, now
    given an explicit slot + build trigger). MUST keep working — see preserve note.
13. **Analyse against a job description** — heading (`.apjb-heading`).
14. **Analyse JD** button (`.apjb-run`) with **⬇ Download analysis (PDF)** (`.arx-dl`)
    **to its right** (same row). **Delete** the "Export & detail" heading (`.arx-heading`).

### Also move / merge (upper "recruiter fit" panel — `antcv-rf-*`)

Owners: `antcv-recheck-fit.js` + `antcv-analysis-panel-jd-block-356.js` render the
`antcv-rf-jdsec` blocks (blue `<h3>` style). `antcv-analysis-merge-344.js` / app.js
render the coloured inline versions. Red Flags is currently rendered in **5+ places**
(recheck-fit, 356, merge-344, report-pdf-360, app.js) — hence the duplicates.

- **Recruiter** (`.antcv-rf-jdsec` `<h3>Recruiter</h3>`) → slot **3** in the
  definitive order above.
- **Questions to ask** (`.antcv-rf-jdsec` `<h3>Questions to ask</h3>`) → slot **10**.
- **Merge the two Red Flags.** Keep the **RED inline-styled** "Red Flags" (⚑,
  `color:#c0392b`, from merge-344 / app.js). **Remove the BLUE** redundant copy
  (`.antcv-rf-jdsec` `<h3>Red flags (N)</h3>` + `.antcv-rf-jdlist-flags`, from
  recheck-fit / 356).

### ⚠️ PRESERVE — recruiter-questions → cover-letter answers page (already shipped)

"Questions to ask" can also produce **answers to the questions the recruiter asks in
the application**, which are appended as a **NEW PAGE in the cover letter**. This was
implemented before (in `antcv-analysis-merge-344.js` / `antcv-recheck-fit.js`). The
reorder/dedup must **NOT** break this path — verify the CL answers-page still renders
after any change to the Questions section.

### ANALYSIS-MOBILE-001 [OPEN][HIGH][mobile] — panel unusable on mobile

On mobile the Analysis panel shows **very limited information and is NOT scrollable**,
so most of the 14 sections above are unreachable. Make the panel **rich and clear on
mobile too**: full content parity with desktop, an internally **scrollable** container
(`overflow-y:auto` + a bounded max-height / `100dvh`-aware sizing; `-webkit-overflow-
scrolling:touch`), readable type, and no clipped/cut sections. Verify the reorder lands
legibly at ≤900px and ≤430px widths. Part of the same batch.

### Notes
- Cross-sidecar move: needs a coordinating reorder pass (or a small new sidecar) that
  runs after recheck-fit, 356, 344, and 360 have rendered. Idempotent; re-anchor on
  the classes above. The Red-Flags dedup is part of the win (kills 1 of the 5 copies).
- The confidence-overlay button is the bigger piece — it overlays per-statement
  confidence onto the preview (red=low / yellow=medium), the FEATURE-CONF-001 idea.
  Worker already returns `confidence_notes`; preview renderer + toggle is new.
- These are the SAME sidecars the parallel run is actively churning — hold until it
  merges, then do the reorder + dedup as one pass on a clean tree.

## PRIVACY-LED-MISSING-001 [OPEN][HIGH][regression]

The privacy button/LED is **gone on desktop AND mobile**. Regression from the
flicker fix `68ae23d` ("kill the blip at source — force visible via passive CSS,
**drop per-sweep JS visibility writes**"): dropping the per-sweep writes removed
what kept the LED painted, and the passive CSS rule isn't matching/winning, so it
never shows. PRIVACY-FAB-FLICKER-MOBILE-001 is solved but this replaced it.
Fix direction: restore a single idempotent "ensure-present" write (not a per-sweep
loop) OR correct the passive-CSS selector so the LED is always rendered, on both
breakpoints. Owner-confirm on device.

## LOGIN-GATE-001 [OPEN][HIGH] — still present

Boot sequence still wrong on load: **blue screen → wizard step → only then the
set-menu**. The login-loading-gate (1.50.165) did not fix the first-paint order.
Blue-screen-risk path — diagnostic-first: capture the boot sequence (the
diag-probes `LOGIN-GATE-001 boot sequence` log) and fix the order so the loader
shows first, then the app, with no blue flash and no premature wizard.

## PROCESSING-QUEUE-INDICATOR-001 — spec expanded

Per-subsection work-state badges apply to **language change, new JD / new kernel,
compress, Enhance, and Fix-It** operations (not only CJLR alignment):
- **pink "processing"** on the subsection actively being worked;
- **yellow "queue"** on subsections scheduled later in the same command (e.g.
  Enhance/Fix-It over a section → first pink, the rest yellow, flipping as each
  starts).
- Confirm CJLR (Center/Justify/Left/Right), **Enhance**, and **Fix-It** controls
  work in **every** sub-subsection.

## GEN-UNSOL-002 — likely already fixed (confirm)

Fixed at 1.50.169 (`6a78859` — generation prompt now requires `meta.company`/`role`
grounded in the JD). Needs one live confirm: generate from a real JD with a blank
Company field → header must NOT fall to "Open Application — Unsolicited".
