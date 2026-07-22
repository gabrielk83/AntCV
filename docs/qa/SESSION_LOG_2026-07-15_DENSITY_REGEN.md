# Session log — density frontier + clean regeneration batch (2026-07-15)

Owner-driven session (desktop Opus). Started as the "advance the density frontier
toward 97.5%" task, expanded live into a full clean-regeneration + deliverables
pipeline for the queued (alarm-clock) applications. This log records what SHIPPED
(closed) and the OPEN issues carried forward.

## SHIPPED / CLOSED (all on main)

### DENSITY-GROW-VETO-SHRINK-001 — new frontier lever (commit 3e31232)
`scripts/job-tracker/density_fit.py`: after the cross-family auditor vetoes a
*grow* candidate as a NEW claim (fabrication), the retry now suppresses the grow
window and forces the honest shrink-to-one-line window (when one exists) instead
of re-inviting the same fabrication. Non-regressive by construction (best-state +
PUT-on-improvement gating; all gates intact). Default-on; kill-switch
`ANTCV_DENSITY_NO_SHRINK_RETRY=1`; `ANTCV_DENSITY_LEVER_DEBUG` traces fires.
Clean A/B on 810 CV = wash on net quality (74.3% either way) — honest-by-design,
not a silver bullet on the hardest apps. Report:
`docs/qa/DENSITY_SWEEP_REPORT_2026-07-15.md`.

### CL-RENDER-HARNESS-STDOUT-001 — measurement infra regression (commit 3e31232)
`scripts/job-tracker/render_payload.mjs`: the docx-client's
`CL-HYDRATE-EXPORT-GATE-001` belt emits `console.log("[docx-client] …hydrated N
placeholder CL section(s)…")` to **stdout**, which corrupted the harness's
JSON-only stdout (`JSONDecodeError: line 1 column 2`) and had been **silently
blocking 810/849/1006 CLs** from being measured or fitted (only hydrated CLs
trigger it → older CLs built clean → invisible in the 2026-07-13 sweep). Fix:
redirect the module's `console.log/info/debug/warn` to stderr so stdout is
JSON-only. Dev-harness only; no production behaviour. Unlocked 849 CL +5.6 and
1006 CL +28.5. Durable hazard: ANY future docx-client `console.log` re-breaks the
harness unless this guard is present.

### Density sweep (data-only, persisted to relay)
16 of 46 (app × doc) jobs improved, no regressions (PUT gated on a measured
defect drop). Biggest: 914 CL 55→85, 1006 CL 28.6→57.1, 1006 CV 54.9→72.3,
800 CL 85→95, 849 CV 57.4→63.9. 97.5% still unreached = content-density frontier
(un-growable + un-shrinkable runts, verbatim sections, personality lines). Full
table + residue in the density report.

### GEN-RUNNER-FORCE-001 — clean re-gen flag (commit 303daaa)
`gen-runner.py`: `--force` bypasses the `has_art` (no-artifact) gate so an app
that already has a generated artifact can be regenerated clean. The active-pointer
guard in `cmd_run` still protects the working app.

### DELIVERY-TOOLING-001 — DOCX + analysis (commit 9209bae)
- `export_docx.py`: byte-exact payload → docx-worker `/generate` (.docx) +
  `/generate-pdf` (.pdf) with page/notice/banned-dash verification.
- `analysis_report.py`: one LLM pass per app over JD + tailored CV + full kernel
  → structured fit report with EXPANDED gaps (requirement / why it matters /
  status / how-to-cover), grounded only in real background — a genuinely missing
  requirement is named honestly with a mitigation, never fabricated. Renders
  Markdown + JSON.

### 1007 → nordic-minimal|en kernel + 14-app clean regeneration
- App **1007** (unsolicited Nordic Minimal repro) re-compressed 4→2 pages, owner
  labels preserved ("audits", "machine vision tests"), then **set as the default
  `nordic minimal|en` kernel** via `PUT /api/kernel-showcase?style=nordic minimal|en`
  (verified: 15 CV + 8 CL sections stored).
- **All 14 queued (alarm-clock = `queue:true`) apps regenerated clean** with
  today's fixes + the 1007 kernel (gen-runner `--force --persist`, opus-4-8, density
  fit to a 2-page budget). New app ids: **1016, 1017, 1018, 1019, 1021, 1025,
  1026, 1027, 1028, 1031, 1075, 1120, 1173, 1222** (gen-runner creates a fresh id
  per regen and repoints the tracker artifact).
- Deliverables in **`Downloads/AntCV_regen_2026-07-15/`**: 28 DOCX (14 CV @ 2p +
  14 CL) all verified OK (no blank pages, AI notice present, zero banned dashes),
  28 verification PDFs, 14 detailed analysis reports (`_ANALYSIS.md` + `.json`),
  `MANIFEST.md`. Fit distribution: 5 good / 5 moderate / 4 stretch (honest).

## OPEN ISSUES (documented, not shipped)

### AUTOSAVE-STALE-CLOBBER-001 — data-loss regression (HIGH)
The owner opened app 1007 in the browser **without editing it**, and its saves
**reverted my server-side density compression** (regulatory items returned to the
uncompressed `{l,v}` shape; `updated_at` moved to after my PUT). Root cause: the
app's auto-save (or cloud-restore-on-open) pushed the browser's **stale
localStorage `sections` over the newer cloud PUT** — a save-on-open clobber, not a
manual edit. **Prevention:** a **server-rev guard on auto-save** — never overwrite
a newer cloud rev with an older local one (compare `updated_at`/rev before PUT;
3-way merge or skip). Until that ships, density/cloud writes MUST NOT run while the
app is open on the account (confirmed: writes stick once the tab is closed).
Relates to memories `live-verify-mutates-real-account`, `same-tree-commit-race`,
`cloud-persist-and-account-isolation`.

### LINE-DRIFT-MAIN-001 — preview↔export pagination drift
On a real Gabriel unsolicited CV the PREVIEW paginates to 3 pages but the EXPORT
renders 4 (experience span). Root cause (diagnosed on 1006): the autoPages
coordinator (`pwa/antcv-auto-pagebreak-block-001.js`) paginates the MAIN column
with per-block `inflate = 1` — it relies only on the global `WORD_INFLATE = 1.14`
budget, while the SIDEBAR gets an additional per-block `SIDEBAR_PREVIEW_INFLATE =
1.10`. A dense experience section (denser after the density pass) accumulates a
sub-line under-count that 1.14 misses, so the auto-break lands one role late.
**Fix:** per-block export line prediction for the main coordinator (reuse the
width calibration in `antcv-bullet-targets.js` SHIP 3), OR a calibrated,
live-tunable main inflation. **Needs one live-preview calibration** (autoPages is
preview-side; the headless fixture is empty, so it can't be validated from the
shell). Distinct from the other session's LINE-DISTRIBUTION-001 (per-row Fit-it) —
this is the pagination measurer, not the row-fill control.

### SIDEBAR-GROUP-PACK-001 — sidebar page-fill via group reorder
Owner ask: reorder the groups inside TOOLS & METHODS (and pack the sidebar) so a
page fills long+short instead of orphaning a later section with wasted space.
**KEY FINDING (empirically proven):** the docx-worker renders sidebar
groups/sections **in payload order** (reordering the tools `grp` runs in the
payload changed the export) — so the fix is a **CLIENT-SIDE data reorder** applied
identically in `buildPayload` (`pwa/antcv-docx-client.js` ~L1907 tools branch) +
the preview render (same deterministic helper → parity), **NO docx-worker change,
no worker deploy** (contradicts the earlier "worker re-derives internally"
assumption). Note: an intra-tools group reorder is a **no-op when TOOLS fits one
page** (1007's 3 tool groups all fit page 2; the gap there was the *next*
keep-whole section not fitting the remainder). Compression fixed 1007 better than
a reorder could (deleted the wasted page). So the reorder is a situational feature
for genuine tools-overflow cases; parked for such a repro + live-preview verify +
cache-bust + shift.

### JD-MENU-QUEUED-TAB-001 — no "Queued" category in the JD list
Owner: "why don't I see queued jobs as a category / tab in the JD menu?" The
`queue:true` (alarm-clock) flag is stored in the tracker doc but the JD-list UI
has no category/tab/filter surfacing it. Feature-add (pwa island + cache-bust).

### KERNEL-COMPRESS-SIDEBAR-GAP-001 — over-compression balance gap
Re-compressing 1007 to 2 pages (max-pages 2) left a **218pt sidebar balance gap on
page 2** (sidebar bottoms out short of the main column). 2 pages is a big win over
4/6, but the gap is real and worth review. The `nordic minimal|en` kernel was set
from this 2-page version. `gen-runner` default `--max-pages 2` may similarly
over-compress some of the 14 regenerated apps — worth a balance eyeball of the
`AntCV_regen_2026-07-15` PDFs. Candidate for SIDEBAR-GROUP-PACK-001 / a
looser page budget on content-heavy unsolicited CVs.

### Deferred within-density
- Line-drift + tools-group reorder (above) are the two owner-routed pagination
  features, both diagnosed and de-risked, parked on live-preview calibration.
- Content-quality flag (out of density scope): app 849 / Aimpoint siblings led the
  profile with "IT professional…" for an optical role — a gen-tailoring mismatch,
  not contamination; the clean regeneration (1018 etc.) should have corrected it —
  worth confirming in the new analysis reports.
