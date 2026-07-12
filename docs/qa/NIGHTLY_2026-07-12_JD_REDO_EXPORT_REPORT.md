# AntCV — JD-list REDO + export run — 2026-07-12 (deferred one-time, ~04:12)

Deferred 2h from a live owner request ("the previous list had issues — redo it, then export
the good CVs"). Fresh session. Repo synced to `origin/main` at start (already up to date).

## TL;DR

- **Root cause of the "bad list" found and fixed:** `gen-runner.py` emitted category ids
  (`project_management`, `quality_regulatory`, `business_analysis`, `research_science`, …)
  that **do not exist** in the access-relay's `CATEGORIES` set. The relay's `normalizeCategory()`
  silently rewrites any unknown id to **`unsolicited`** — and an `unsolicited` category on a real
  JD **blanks the JD on open** (documented in the job-tracker SKILL). That is why 6 of the
  persisted apps carried `unsolicited`. Fixed the 6 live apps' categories (cheap PUT, no LLM) and
  fixed the gen-runner code so it can only ever emit the 11 valid ids.
- **New generation is BILLING-BLOCKED tonight.** Both flagship providers are out:
  Anthropic `400 credit balance too low`, OpenAI `429 exceeded your current quota`. The only
  provider with credit is Google/Gemini — but **gemini-2.5-flash produces broken content**
  (markdown tables dumped into the PROFILE/OUTCOMES prose fields). So the 7 ungenerated queue
  rows **cannot be regenerated to quality tonight**; owner must top up billing.
- **Exported 9 existing good-model apps** (Demant PM etc.) as **docx + pdf** for both CV and CL —
  **36 files** in `C:\Users\karpg\Downloads\AntCV_JD_exports_2026-07-12\`. All PDFs verified:
  0 em/en-dash, 0 mojibake, English-consistent header, photo present.
- **Data cleanup (non-LLM):** en-dash→hyphen in 2 role labels; deduped the duplicate `teledyne`
  row (23→22 rows); fixed 6 wrong categories.

## Provider state (the hard blocker)

| tier   | model hint        | provider  | result tonight |
|--------|-------------------|-----------|----------------|
| high   | claude-opus-4-8   | anthropic | `400 credit balance too low` |
| quick  | gpt-5-mini        | openai    | `429 exceeded your current quota` |
| (fallback) | gemini-2.5-flash | google | responds, but **content broken** (markdown tables in prose) |

Tonight's recurring `antcv-job-tracker-nightly` (~03:18) hit the same wall — its last commit
(`90c44de`, 03:31) added the batch fast-abort on provider exhaustion. This is an **owner-billing
condition, not a code fault**. Nothing I can regenerate to standard until billing is topped up.

## Diagnosis of the previous list (verify-first, per row)

Doc had 23 rows; 12 had persisted app artifacts. Findings:

| app | row | company / role | defect found | fix |
|----|-----|----------------|--------------|-----|
| 670 | demant_pm | Demant / Senior PM | none — gold (opus/high) | exported |
| 672 | danfoss | Danfoss / PM | none | exported |
| 673 | demant_se | Demant / Service Excellence PM | minor: PROFILE has a "Processes & Products \| People" pipe headline | exported (caveat) |
| 674 | scarlet | Scarlet / MD Quality Auditor | **category=unsolicited** (blanks JD) | → `operations`; exported |
| 675 | ncc | NCC / Head of Project Steering | **category=unsolicited** | → `program_management`; exported |
| 676 | techmah | Tech Mahindra / Senior BA | none (already `product_management`) | exported |
| 677 | siemens | Siemens / Business Excellence | **category=unsolicited** + **third-person PROFILE** ("Gabriel … brings …") | → `operations`; exported (voice caveat) |
| 678 | hays | Hays / Senior BA Reinsurance | **category=unsolicited** + en-dash in role | → `consulting`; role→hyphen; exported |
| 679 | nordea | Nordea / Analytics Engineer | **category=unsolicited** | → `data_analytics`; exported |
| 724 | nvidia_ose | NVIDIA / Optical System Engineer | **EMPTY (0 CV/0 CL)** + old artifact 590 deleted | category→`engineering_hardware`; **needs regen (billing-blocked)** |
| 591 | ibsen | Ibsen / PM | app **404 (deleted)** | can't export |
| 621 | aimpoint | Aimpoint / Optical Eng | app **404 (deleted)** | can't export |

**No stored mojibake in CV/CL content.** What the Windows console rendered as `�` was benign:
U+2022 bullets, U+00D7 (×), U+00F8 (ø in "Ingeniør"), and U+2013 en-dashes in two role LABELS —
none in the rendered CVs. The two en-dash role labels (`lightera`, `hays`) were corrected to
hyphens in the doc + the `hays` app metadata.

## Exported deliverables — `Downloads\AntCV_JD_exports_2026-07-12\`

9 apps × {CV, CL} × {.docx, .pdf} = **36 files**. Each verified in the rendered PDF (PyMuPDF):
English header ("Copenhagen S, Denmark ★ EU Citizen"), photo medallion present, **0 banned dashes,
0 mojibake, no Danish identity leak**, hyphen (not em-dash) AI-notice.

| app | files (base name `<Company>_<Role>_<id>_{CV,CL}.{docx,pdf}`) | CV pages | quality note |
|----|--------------------------------------------------------------|----------|--------------|
| 670 | Demant_Senior_PM_Hearing_Solution_Quality_670 | 4 | gold (opus) |
| 672 | Danfoss_Product_Manager_Pressure_Sensors_672 | 5 | clean |
| 673 | Demant_Service_Excellence_PM_Global_Service_673 | ~4 | pipe headline in PROFILE |
| 674 | Scarlet_MD_Quality_Engineer_Auditor_674 | ~4 | clean |
| 675 | NCC_Head_of_Project_Steering_Green_Industry_675 | 5 | clean |
| 676 | Tech_Mahindra_Senior_Technical_BA_Proxy_PO_676 | ~4 | clean |
| 677 | Siemens_GBS_CEE_Business_Excellence_Professional_677 | ~4 | third-person PROFILE voice |
| 678 | Hays_client_Senior_BA_Reinsurance_678 | 4 | clean |
| 679 | Nordea_Analytics_Engineer_PeB_Denmark_679 | 4 | clean |

**Export path** (headless, reusable): each app's native `cv_sections`/`cl_sections` are already
in the docx-worker `/generate` schema — wrap with `personal_info` (from the live kernel identity,
overridden to English for `en` CVs: `Copenhagen S, Denmark` / `EU Citizen`), `meta`, `sidebar_ratio`
0.33, DARK sidebar; POST `/generate` → `.docx`, POST `/generate-pdf` → `.pdf` (CloudConvert/
LibreOffice). Script: `%TEMP%\export_app.py`. **No worker secret needed in prod.**

### Export caveats (raw-payload path bypasses the app's belts)
- **CVs run 4–5 pages** — the raw `/generate` payload does NOT run the app's orphan-compression /
  sidebar-balance belts (preflight §0b). Content is complete and clean; the owner can tighten in-app.
- **CL has no signature image** (typed "Gabriel" sign-off only) and runs 2 pages. The app export
  adds the recolored signature medallion; a raw payload does not. For a final polished send, export
  through the app UI. These are "sufficient-quality drafts," not gold hand-builds.

## NOT exported / NOT regenerated (and why)

- **724 nvidia_ose** — empty app, needs regeneration; **billing-blocked**. Category corrected so it
  won't blank on open once regenerated.
- **7 queue rows** (`nkt_spe`, `nkt_oe2`, `kk_bionic`, `lightera`, `cmc`, `teledyne-*`) — never
  generated; **billing-blocked**. Gemini attempt produced broken content (see below).
- **591 ibsen, 621 aimpoint** — underlying apps are 404 (deleted); nothing to export.

## Broken Gemini drafts — FOR OWNER DELETION

While testing whether Gemini could stand in for the dead flagships, the batch persisted **3 broken
draft apps before I killed it**: **735 (NKT Optical Engineer II), 736 (NKT Senior Process Engineer),
737 (KK Group)**. Their PROFILE/OUTCOMES contain markdown-table garbage (`| Focus Area | Strategic
Expertise |`). They are **not referenced by the doc** (doc rev unchanged, 23→24 only from my data
fixes) and are **not exported**. Per the deletion safety rule I did not hard-delete them — **please
delete apps 735/736/737 from the app's applications list.**

## Code fix shipped (gen-runner)

`scripts/job-tracker/gen-runner.py`:
- `REAL_CATEGORIES` now lists the **11 ids the relay actually accepts**
  (`engineering_hardware, engineering_software, product_management, program_management, operations,
  data_analytics, research_phd, consulting, executive, finance, people_soft`).
- `guess_category()` returns only those ids; fallback is `consulting` (a valid generic id), never
  `other`/`unsolicited`. Also reordered so **engineering checks precede `data_analytics`** (an
  optical/process-engineer JD that mentions "data" no longer mis-routes to data_analytics — the
  exact mistake the gemini batch made routing NKT optical/process rows to `data_analytics`).

This means the NEXT batch (once billing is restored) persists with correct categories and won't
recreate the blank-on-open defect.

## Doc data fixes (rev 23 → 24)
- `lightera` + `hays` role labels: U+2013 en-dash → hyphen.
- Dropped duplicate `teledyne-manufacturing-m-3232` (identical to `-8492`); rows 23 → 22.
- 6 app categories corrected (674/675/677/678/679 live via PUT; 724 set for its regen).

## Owner actions
1. **Top up billing** (Anthropic credit + OpenAI quota) — unblocks regenerating 724 + the 7 queue
   rows to standard. Gemini is not a usable substitute (broken prose).
2. **Delete broken drafts 735 / 736 / 737.**
3. Optional: for a polished send of any exported app, re-export through the app UI to get the
   orphan-compression belt + CL signature medallion.

## Standard nightly
Not advanced this run — the JD-redo + export + the billing-blocker diagnosis consumed the window.
Baseline untouched (no pwa/app.js or worker change; only `gen-runner.py` + docs). Suite unaffected.
