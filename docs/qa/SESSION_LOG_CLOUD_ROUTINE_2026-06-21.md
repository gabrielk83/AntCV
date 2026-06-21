# Cloud Routine — NVIDIA CV/CL Backlog Audit (2026-06-21)

Scheduled cloud routine run on branch `claude/clever-edison-gmx30i` (= `origin/main` at 1.50.799).
Task: audit + ship NVIDIA CV/CL backlog (targeting-persistence → Results tense → salmon sidebar break
→ CL render cluster → content).

## Sync

`git pull --rebase origin main` — already up to date. HEAD = `origin/main` = `461b86b` (1.50.799).
Note: `main` (local) is stale at `bfb0ff4` (1.50.745) due to a prior force-update on origin.

## Test suite baseline

366/366 — confirmed at start and end of run.

## Findings — ALL BACKLOG ITEMS ALREADY SHIPPED

The CLOUD_ROUTINE_PROMPT was written against 1.50.745. Main is now at 1.50.799 (54 commits
further). Every P0–P5 item from the NVIDIA CV/CL backlog is in main:

| ID | Item | Shipped | Code location |
|---|---|---|---|
| P1 | Targeting-persistence (JD-SYNC-001) | 1.50.752 | `app.src.js:14564–14578` — `jd_text` on every auto-sync tick |
| P2 | Results tense (COPENHAGEN-TENSE-DEFAULT-001) | 1.50.748 | `antcv-docx-client.js:2027` — always 'present' for Copenhagen/Scandinavian/default |
| P3 | Salmon force-break (SALMON-SIDEBAR-BREAK-EARLY-001) | 1.50.749 | `antcv-auto-pagebreak-block-001.js` — SIDEBAR_PREVIEW_INFLATE=1.20, force variant, ?v=1.50.751-salmon-npage |
| P0 | Salmon empty-region (SALMON-EMPTY-REGION-001 Option A) | 1.50.753 | `antcv-page-fit.js` + `antcv-sidebar-fill-equalize-227.js` — coordinated NON-LAST collapse with !important; idempotent guard prevents oscillation; ?v=1.50.753 on both |
| P4 | CL render cluster (#10/#11/#14) | 1.50.747 | `app.src.js:4871` — text_inline label suppressed for non-work_style; `app.src.js:5317` — bring-table margin 12px auto 4px |
| P5-#7 | Uruguayan variant strip | 1.50.746 | `antcv-docx-client.js` `_stripUruguayan()` + `antcv-languages-concise.js` first-comma trim |

### P0 salmon note

CLOUD_ROUTINE_PROMPT specified "branch + PR only on salmon-fixes". The coordinated fix instead
landed in main directly (the files carry SALMON-EMPTY-REGION-001 (1.50.753) comment blocks).
Key points verified in the live code:

- `antcv-page-fit.js` (line 90): non-last rows use setProperty('min-height', '0px', 'important')
  — beats the 329 sidecar's stylesheet !important rule. Last row keeps A4 height.
- `antcv-sidebar-fill-equalize-227.js` (line 38): mainContentH() measures max-bottom-of-children
  minus column-top (~931px), NOT getBoundingClientRect() (the circular-lock 1123px). Non-last rows
  target = Math.max(mc, sc). Idempotent guard uses 'n'+target prefix to prevent oscillation.
- Both ?v=1.50.753 in index.html (confirmed: lines 755 + 888).
- salmon-fixes branch is stale (diverged at ~1.50.749; main is at 1.50.799).

Visual no-oscillation verify (Playwright) NOT available in cloud — still owed on desktop before
closing. No regressions reported since 1.50.753 shipped. TOOLS-duplication fix (1.50.780) also
reduced sidebar height, improving the salmon position further.

## NOT verified (no Playwright)

- boot-smoke.mjs — requires Playwright, not installed.
- diag-pagebox-structure.mjs — requires Playwright.
- Live JD-SYNC-001 verify: load NVIDIA targeted app signed-in, confirm
  localStorage.getItem('antcv:lastJdText') >= 30 chars + WHY heading flips.

## Still open (requires owner action)

| ID | Item | Gate |
|---|---|---|
| #5 | Trim certs to JD context | Owner regen |
| #6 | Add laser-safety standard | Owner regen + prompt |
| #8 | Accessibility trim 30-40% | Owner regen |
| #9 | Twin tables distinct seeds | Owner regen (after targeting live-verify) |
| #12 | CL Strategic-Expertise terser cells | Owner regen |
| P1-live | JD-SYNC-001 live verify | Signed-in browser on antcv.pages.dev |
| REVIEW-DATA-DEAD-001 | "Review my data" button does nothing | Live browser repro first |
| SETTINGS-WRITINGSTYLE-STICKY-001 | WritingStylePicker bleeds onto other tabs | React island fix |
| #3 salmon | Undo stack for sidebar-width | Feature, not in scope |
| #4 salmon | Re-estimate salmons on sidebar-resize | Feature, not in scope |

## Conclusion

All backlog items were already shipped before this run. 366/366 tests green. No code changes needed.
