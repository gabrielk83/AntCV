# NIGHTLY 2026-08-16 — DESKTOP (antcv-nightly scheduled task)

**Runner:** Opus 4.8, desktop scheduled-task dispatch, worktree-isolated.
**Outcome:** Quiet night. Verify + attest only. NO code shipped, no PR, no new bug.

## Preflight / sync
- `routine-preflight.mjs start` → **WORKSPACE DIRTY** (exit 3): the desktop clone had owner/other-session uncommitted WIP. Per STANDING RULE 0, did NOT edit/rebase the dirty clone — created an isolated worktree off `origin/main` and did all work there.
  - `git fetch origin` clean. Worktree HEAD `31ecc2c` == `origin/main` == the 08-15 CI report commit.
- **Code delta since the 08-15 CI report:** `git diff --stat ab79290..HEAD -- pwa/ workers/ .github/` = **EMPTY**. Nothing landed since 08-15 → no PR owed.

## Standing probes (browser-independent — re-run tonight, GREEN)
| Probe | Result |
|---|---|
| PWA suite (`run-tests.mjs pwa`) | **1570/1570** (0 fail, 7 skip) |
| docx-worker (`node --test test/*.test.mjs`) | **37/37** |
| docx render V&V (`run-docx-diags.mjs`) | **50/50** |
| `app.js` head / strict-mode | `(()=>{window` / **0** `"use strict"` |

## Render-gated Playwright diags — NOT re-run this dispatch (justified)
A fresh git worktree has no `node_modules` / chromium (not shared across worktrees). A full `npm ci` + chromium install is disproportionate on a **zero-delta** night. These probes — copenhagen-overflow-storm, settings-panels-probe, panel-button-audit, sidebar-stable, sidebar-promote-margin, boot-smoke — were run **GREEN by the 08-15 CI nightly on this exact byte-identical HEAD `31ecc2c`** (copenhagen-storm ON 2/0px + OFF 1/0px, settings-panels DIAG PASS, button-audit 213 buttons/0 errors/139 active, sidebar diags stable, boot-smoke OK) and carry forward unchanged. No code has changed since, so re-running them from the worktree would add no information.

## Live attest — all 5 surfaces READ from desktop shell = repo source (no drift)
| Surface | Live `/health` | Repo source | Match |
|---|---|---|---|
| PWA `sw.js` CACHE | `1.51.4126-demand-seed-refresh` | `1.51.4126-demand-seed-refresh` | ✓ |
| cv-proxy (`workers/proxy`) | `3.8.4-brand-ink-match` | `3.8.4-brand-ink-match` | ✓ |
| demo-proxy | `3.8.4-brand-ink-match` | `3.8.4-brand-ink-match` | ✓ |
| access-relay | `auth-37-cap-disposable-only` | `auth-37-cap-disposable-only` | ✓ |
| docx-worker | `1.14.174-appline-edit` | `1.14.174-appline-edit` | ✓ |

## Bands (from the 07-05 standing plan) — status this run
- **A (mobile / tab isolation):** guards all present + deployed + verified in code/attest (gen-memo, pointer-stale-guard, AUTOSAVE-NO-DOWNGRADE live in access-relay `auth-37`). Live A/B legs remain owner/real-device-gated (2nd physical device; GEN-BACKGROUND default-OFF→ON flip not proposed — no fresh real-mobile A/B to back it). No fresh evidence tonight; carried.
- **B / C / D:** no code delta since these last passed; nothing re-openable from a zero-delta worktree.
- **E (standing):** register staleness swept (row 1 date-prefixed; rows 3/11/17/19-code-leg/23/35/36/37 no new drift, code byte-identical to 08-15); settings-panel + button-audit carried green from 08-15 CI (byte-identical base); export/preview parity covered by docx V&V 50/50 + suite green.

## Register coverage (every open row has a status word)
- **Row 1:** re-verified browser-independent subset tonight; render leg carried from 08-15 CI on byte-identical HEAD. Date-prefixed 2026-08-16.
- **Rows 3/11/17/19-code-leg/23/35/36/37:** NO new drift — code surface byte-identical to 08-15 (when last verified green).
- **Row 19 two-real-device leg:** owner-gated (needs a 2nd physical device).

## Carried OPEN (all owner-side, unchanged)
- **CI-CF-TOKEN-EXPIRED-001** — rotate the GitHub-Actions `CLOUDFLARE_API_TOKEN` (CF `Authentication error [code: 10000]`); worker deploys stay desktop-only until then.
- **LLM-TRAFFIC-GAP-2026-08 / RELAY-TUNE-COVERAGE-GAP-001** — no LLM call since 2026-07-30 (17-day gap); no fresh-generation content check possible; the weekly relay tune is blind with ~no real traffic.
- **ANTCV-TOKEN-EXPIRED-2026-08-14-001** — re-save `~/.antcv/token` from the PWA console (`copy(localStorage.getItem('antcv:auth:token'))` on `antcv.pages.dev` → `C:\Users\karpg\.antcv\token`); blocks position-discovery + job-tracker AUTH gates.
- **G:-Drive mount absent in scheduled-task sessions** — job-tracker Excel refresh cannot run unattended until Drive is signed in for this dispatch's Windows context.

## No new bug or task discovered.
