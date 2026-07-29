# FULL-LIST-REGEN-EXPORT-001 — 2026-07-23 night run report

> **2026-07-24 addendum (owner follow-ups "fix CL to one page" + "name width =
> contact width" + "font sizes changeable"): ALL DONE.**
> (1) **CL-PAGE-BUDGET-ORPHAN-001 CLOSED** — two real causes: the post-signature
> spacer paragraph spawned a BLANK trailing page whenever the sign-off landed low
> (CL-BLANK-TRAIL-001, dropped in wk `1.14.167` — descender protection stays via
> the CLIP-005 line box + the sig cell's bottom margin), and the v5 CL body was
> genuinely ~6-9 lines too long under the copenhagen band. NEW
> `scripts/job-tracker/cl_fit.py` (measured one-page fitter: relevance-tail item
> drops + line-aware gated shrinks + closing lever; page count is the only
> acceptance) is wired into gen-runner's persist path, and the 19 regenerated
> apps were backfilled: **19/19 CLs now render 1 page**, cl_sections PUT with
> base_rev guard.
> (2) **CPH-NAME-WIDTH-001 SHIPPED** (`1.51.3683`→`1.51.3686` + wk
> `1.14.166`): the band NAME auto-scales so its width equals the CONTACT line's
> rendered width — preview via a Range-measured feedback fit (converges ratio
> 1.014; scrollWidth-vs-grid-cell and photo-clear-vs-contact-floor stalls fixed
> in 001b/001d), worker via a calibrated width model (DOCX ratio 0.982). The
> **Font sizes (pt) panel is now honored on copenhagen** in preview AND worker
> (name/spec/contact were pinned 17.5/13.5/9.5pt) — an explicit panel value wins
> over the auto-fit everywhere.
> (3) All deliverables re-exported uniformly on wk `1.14.167` →
> `Downloads\antcv-full-regen-2026-07-23\deliverables-v2\`.

Owner order (2026-07-23 night): re-run all JD-list analysis + application generation,
export CV/CL DOCX + PDFs + analysis PDFs. Lane `1.51.3642-3661` (sh_mrwtj4ig_1vg9,
released unused — data-only run, no pwa asset changed). Worker 1.14.164. Outputs:
`C:\Users\karpg\Downloads\antcv-full-regen-2026-07-23\` (deliverables/, analysis/,
deliverables-baseline/, genrun/, logs/).

## Result: 19 of 26 rows regenerated, 5/5 deliverables each. 7 rows STOPPED by the 50-app cap.

Every regenerated app has: CV DOCX, CL DOCX, CV PDF, CL PDF (CloudConvert), branded
JD-Analysis PDF (the real report sidecar run headless; rationale PUT onto the app row,
so the Analysis panel shows it on load). All analyses = jd-analysis panel machinery
(recruiter/questions/salary/confidence) + kernel-grounded fit leg (claude-sonnet-5).
Gen = gen-runner per-row `--force --persist`, owner tier map honored (high=opus-4-8).

## Pre-run census finding: 3Shape JD contamination is 9 apps wide

sha1 of normalized `jd_text` across all 29 saved apps: **nine** rows carry the identical
3Shape JD (hash `580f1e8d`, 6941c): 2656 (zh unsolicited!), 2696 Teledyne, 2704 Nordea AM,
2709 DTU Wind, 2712 Novo, 2714 + 2721 Therma, 2725 Terma, 2728 3Shape (legit holder).
The 2026-07-23 desktop fix decontaminated 2728's cl_sections; the row-level `jd_text`
of the other eight was still wrong. Row-based regen heals them because gen-runner reads
the TRUE JD from the tracker doc.

## Per-app table

| old app | company / role | row | new app | gen | analysis (fit, gaps) | 5 deliv. | CV/CL pages | defects |
|---|---|---|---|---|---|---|---|---|
| 1018 | Aimpoint / Optical Engineer | aimpoint | **2729** | OK 327s | good, 3 | 5/5 | 2/2 | CL p2 orphan |
| 1025 | NKT / Senior Process Engineer | nkt_spe | **2730** | OK 281s | stretch, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1021 | NKT / Optical Engineer II | nkt_oe2 | **2731** | OK 216s | moderate, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1019 | Demant / Senior PM Hearing | demant_pm | **2732** | OK 265s | moderate, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1026 | NVIDIA / Test Engineer Photonic | nvidia_test | **2733** | OK 256s | moderate, 5 | 5/5 | **3**/2 | CV OVER BUDGET (3p) + CL p2 orphan |
| 792 | KK Group / Bionic Solutions | kk_bionic | **2734** | OK 162s | stretch, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1027 | Lightera / Optical Fibers | lightera | **2735** | OK 253s | stretch, 4 | 5/5 | 2/2 | CL p2 orphan |
| 795 | Danfoss / PM Pressure Sensors | danfoss | **2736** | OK 156s | stretch, 4 | 5/5 | 2/2 | CL p2 orphan |
| 1028 | Demant / Service Excellence PM | demant_se | **2737** | OK 249s | stretch, 5 | 5/5 | 2/2 | CL p2 orphan |
| 799 | CMC / Senior Optical Design | cmc | **2738** | OK 136s | stretch, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1031 | Tech Mahindra / Sr BA / Proxy PO | techmah | **2739** | OK 238s | stretch, 5 | 5/5 | 2/2 | CL p2 orphan |
| 1075 | Siemens GBS / Business Excellence | siemens | **2740** | OK 280s | good, 4 | 5/5 | 2/2 | CL p2 orphan |
| 1120 | Hays / Senior BA Reinsurance | hays | **2741** | OK 246s | stretch, 7 | 5/5 | 2/2 | CL p2 orphan |
| 1173 | Napatech / PM (Technical) | napatech | **2742** | OK 334s | good, 4 | 5/5 | 2/2 | CL p2 orphan |
| 812 | NVIDIA / Sr Silicon Photonics | nvidia_siph | **2743** | OK 297s | stretch, 6 | 5/5 | 2/2 | CL p2 orphan |
| 2696 ☣ | Teledyne / Manufacturing Manager | teledyne-…8492 | **2744** | OK 157s | moderate, 5 | 5/5 | 2/2 | JD healed; CL p2 orphan |
| 2658 | FDPARTS / Produktchef (Lysteam) | fdparts_a_s | **2745** | OK 132s | moderate, 5 | 5/5 | 2/2 | CL p2 orphan |
| 2728 | 3Shape / Senior PM R&D MedDev | 3shape-…9328 | **2747** | OK 315s | good, 5 | 5/5 | 2/2 | CL p2 orphan + **1 banned dash in CL PDF** |
| 2725 ☣ (+2721 dup) | Terma / Assoc PM Program Excellence (1244) | career-…7765 | **2748** | OK 234s | good, 4 | 5/5 | 2/2 | JD healed; CL p2 orphan |

☣ = old row carried the 3Shape JD; the new app is generated from the TRUE JD.

**NOT regenerated (50-app cap, see below):** terma-…0782 (would heal ☣2714),
nordea_asset_managem (would heal ☣2704), dtu-wind-…3440 (would heal ☣2709),
aimpoint-ab-engineering-…6849 (1022), templafy (2655), foss-…4831 (2700),
everllence-…0189 (2727).

**Not regenerable at all:** **2712 Novo Nordisk** — no tracker row, its `jd_text` is the
3Shape JD, the true Novo JD is unknown → owner must re-paste the JD (or delete).
**2656 zh unsolicited** — carries a JD it should never have; unsolicited regen is
kernel-based, out of this run's scope. Both exported AS-IS to `deliverables-baseline/`
(2656 zh CV renders 4 pages; 2712 CV 2p/CL 1p).

## Defect classes (rendered-PDF verified)

1. **CL-PAGE-BUDGET-ORPHAN-001 (systemic, all 19 new CLs):** page 2 contains ONLY the
   sign-off ("At your service, / Gabriel" + AI notice, 81 chars). The v5 CL structure
   (role_view + who-to-end) runs a few lines past one page and `fit_to_pages` tightens
   the CV ONLY — there is no CL page-budget leg. Old CLs (2712 baseline) fit 1 page.
   Fix direction: CL leg in `fit_to_pages` (tighten longest rich_block paragraphs) or
   keep-with-previous on the closing block. Registered in ACTIVE_BUGS.
2. **2733 CV = 3 pages** — only app over the 2-page budget (fit loop hit its 4-iter cap).
3. **2747 CL: 1 banned dash glyph** in the rendered PDF (all other 37 PDFs are 0).
4. **Banned dashes elsewhere: zero.** AI notice + spine checks passed via export verifier.
5. **Stage-4 header parity shipped MID-RUN** — worker was 1.14.164-copenhagen-ground at
   run start (03:25) and is 1.14.165-copenhagen-stage4 now (the parallel Stage-4 session,
   eb19892). This run's exports therefore straddle the two renderings; late apps
   (roughly 2747/2748 + the analysis PDFs rendered after the flip) may carry Stage-4
   output while early ones carry 1.14.164. Treat per-app renders as a MIXED baseline;
   re-render any app you compare header-parity against.

## STOPPED at 49/50: the relay's newest-50 sweep would have DELETED owner originals

The relay PUT path sweeps to the **newest 50 company-named applications**
(APP-HISTORY-CAP-50). The account hit **49** after row 19. Running the remaining 7 rows
would have silently deleted the oldest originals (792, 795, 799, 812, 1018, 1019 —
the owner's submitted records). Bulk-delete authority is the owner's, so the run stopped.
**To finish: delete the 9 contaminated + superseded old apps (2656 keep? owner call:
2696, 2704, 2709, 2712, 2714, 2721, 2725 + stub 2746), then run the 7 remaining rows**
— the driver is resumable: `python <scratchpad>/regen_driver.py` state is in the run
folder; or just gen-runner per row.

## Incident: parallel foreign writer at 04:37-04:42 (NOT the owner tab, NOT this run)

While row 19 ran, something else on the account: created **app 2746** (empty stub,
"NVIDIA / Optical System Engineer" = tracker row nvidia_ose which this run had excluded),
moved the GLOBAL active pointer to it, and wiped the then-active 2728's sections
(restored seconds later by the relay's WIPE-NONDESTRUCTIVE-RESTORE on GET — content
verified intact, cv 15 / cl 9 / rationale kept). Writer used the global pointer with
no device id → headless automation (a scheduled/cloud routine misfiring or abandoning
mid-flow), it stopped after 04:42:44. My churn guard caught it and aborted cleanly.
Active pointer restored to **2728**. Stub **2746** left in place (not mine to delete;
it occupies a cap slot — delete it first when freeing slots). Worth identifying which
scheduled routine fired at ~04:37 before the next bulk night run.

## State after the run

- Saved list: 49 apps = 29 originals (untouched, incl. 9 contaminated) + 19 regenerated + stub 2746.
- Tracker doc artifact pointers moved to the new app ids for the 19 rows (by gen-runner).
- Active pointer: 2728 (pre-run value). No writes to any original app's content by this run.
- Rationales live on the 19 new rows (panel-ready); `analysis_extra` untouched.
- Headless analysis-PDF harness (real sidecar in Node) + regen driver + wave follower
  are in the session scratchpad; copies not committed (generic tooling candidates for
  scripts/job-tracker if wanted).
