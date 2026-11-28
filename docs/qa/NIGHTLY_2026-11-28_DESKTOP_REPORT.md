# Desktop nightly 2026-11-28 (Gabo-PC, Opus 5.5)

**Outcome:** no product change. Two red diags made green (stale assertions, row 152, 50 of 74 left), one more found green on re-run. One red diag is a real bug: the CV preview drops derived "Results:" lines that the export prints (new row 160, owner call). E1-E4 done. Live attest PASS.

## Preflight / sync

- `routine-preflight start` exit 3: owner WIP in the shared clone (`package.json`, `workers/access-relay/*`, untracked DAMC doc). Worked in `C:/Users/Karpg/antcv-worktrees/routine-antcv-nightly-mx02jh3v`.
- Base `5ac72dc1` (origin/main); claim commit `5a3bff17`.
- TOKEN OK, expires 2026-12-04T10:46Z (6.2 d left). No DISPATCH GAP warning; previous start 2026-11-27T10:41Z (0.9 d).
- Shift claim 1.51.6727-1.51.6746; no version used (no loaded `pwa/` asset changed).

## Duplicate / CI overlap

No CI report for today. The GitHub nightly (`nightly.yml`) failed in 29-37 s on 11-25, 11-26 and 11-27 (runs 45602955404, 45805458031, 45985578593); not read further, carried under row 136. No desktop entry for 11-28 in `REGISTER_RUNLOG.md`. Full run.

## Baseline → final

| Check | Baseline | Final |
|---|---|---|
| `run-tests.mjs pwa` | 2224 pass, 0 fail | 2224 pass, 0 fail |
| `boot-smoke.mjs` | glDemo=function, errors=0 | not re-run (no `app.js` change) |
| `check-register.mjs` | OK, 107 rows | OK, 108 rows |

## Bands A-D

| Row | Status |
|---|---|
| 152 `DIAG-FLEET-ROT-001` | **advanced**: 2 fixed (stale), 1 green on re-run, 1 real (row 160). 50 of 74 left. |
| 160 `PREVIEW-RESULTS-DERIVED-MISSING-001` | **new**, blocked: owner decision (preview Results policy). |
| 159, 151, 147, 153, 154, 157 | blocked: owner decision. Not re-checked. |
| 45, 41, 19, 35 | blocked: owner session / real device / real LLM gen. Not re-checked. |

## Row 152: diags triaged

| Diag | Verdict | Detail |
|---|---|---|
| `slogan-placeholder-language` | stale, fixed | SLOGAN-CASE-001 (owner 11-03): headline is sentence case. Regexes made case-insensitive; added a default-case check and a CAPS-mode check (`antcv:clSloganCase=caps`), which proves the test still tells the two apart. 10/10. |
| `section-loc-default` | stale, fixed | RICH-BLOCK-001 Phase C (759, owner 06-22) upgrades `work_style` text_inline → rich_block with lead "Work style". Now accepts either end state. 5/5. |
| `settings-front` | green on re-run | No edit. Was in the 11-23 failing set; passes today (editor + upload). |
| `outcomes-mode` | **real** → row 160 | See below. Diag left red on purpose. |
| `demo-toggle` | red, not read | TimeoutError. |
| `photo-positions` | red, not read | 5 of 5 positions fail (`ok:null` on header-left/right). |

## Row 160: preview drops derived Results lines

- Since the ROLES-AS-RICHBLOCK cutover (`3c776053`, 2026-07-14, flag default ON) the CV preview draws roles through `antcv-roles-richblock-adapter.js`. Its `adapt()` adds a "Results:" row only when `role.results` is stored.
- The export runs `applyOutcomesMode` (`antcv-docx-client.js:726`): in results mode (Copenhagen Modern default, and forced for the margin/academy CV) it fills `role.results` from role outcomes, proof points, the SELECTED OUTCOMES pool, or the role's own bullets.
- The old in-`app.js` Results block (single source = `applyOutcomesMode`) is still there, but it only runs on the legacy chimera render (`antcv:roles-richblock=0`).
- Repro (headless, `diag-outcomes-mode.mjs` fixture, 2 roles, no stored results): `applyOutcomesMode` returns Results for both roles; the preview paper has no Results text and `[data-antcv-role-results]` is never added (MutationObserver probe, 0 adds); `AntcvApplyOutcomesMode` is never called during render.
- Production D1 (read-only SELECT, 25 newest `application` rows): most roles have no stored `results`, e.g. #3538 and #3537 11 visible roles, 0 with `results`, outcomes section present; #3536 5 of 11.
- E4's `diag-results-preview-export-parity.mjs` stays green because it calls `applyOutcomesMode` twice and compares the outputs; it never reads the rendered DOM (it says dom=0 is "expected").
- Not fixed: a preview-only Results row would duplicate the bullet the export promotes and hides (RESULTS-LAMINATION-003), and the copycat / Gabriel-pin rules decide the text. Owner call on the policy (see Owner decisions).

## Band E

### E1 (stalest by `check-register --stalest`)

| Row | Status | Blocker for the rest |
|---|---|---|
| 21 `SETTINGS-ROLLER-RESET-001` | **verified**, `diag-settings-history-guard` OK (guarded alive, kill-switch control gone) | owner real-device Back |
| 22 `CL-SLOGAN-RICHCONTENT-001` | **verified**, sidecar loaded 1×, kill-switch 2 hits | owner-gated phase 2 |
| 3 `FLOAT-SPINE-001` | **verified**, worker gate ×6, client opt-in ×2 | owner visual re-export |
| 20 `CONTACT-TRACK-TIGHT-001` | **verified**, 4 worker anchors, live docx-worker 1.14.177 | owner regen + real PDF |
| 135 `JT-PUT-SLOW-UPLINK-001` | **verified**, `test_put_timeout.py` PASS 16 checks (Python 3.12) | none in code; slow-uplink live sweep |

### E2 Settings-panel churn

`--selftest` PASS; real run 4/4 panels at rest.

### E3 button audit pass 2

212 buttons (216 on 11-27), 0 regressions, 0 recoveries, 0 page errors (`PANEL_BUTTON_AUDIT_2026-11-28.md`). Label gone: "What I Bring row 0 alignment" (added 11-27); CJLR hidden 7 → 4; 10 active ↔ ui-only flips (settle timing). Verify-only.

### E4 export/preview parity

`RESULTS-PREVIEW-EXPORT-PARITY OK`. Caveat: the diag does not test the rendered preview (row 160).

## Live attest

- `sw.js` CACHE and `app.js?v` = `1.51.6706-letter-diagram` live and in the repo.
- `app.js` live sha1 `1254c955` = git blob.
- `diag-live-guard-sidecars` 9/9; `browser-qa --only version-live,sidecars-live` 2/2.
- `/health` 200 on all four: relay `auth-41-jt-doc-size`, cv-proxy and antcv-demo-proxy `3.8.4-brand-ink-match`, docx-worker `1.14.177-role-line-one` (repo 1.14.178, row 159 unchanged).

## Evidence index

- `pwa/test/diag-slogan-placeholder-language.mjs`, `pwa/test/diag-section-loc-default.mjs` (red before, green after).
- `pwa/test/diag-outcomes-mode.mjs` (red, real; row 160). Probe scripts were scratch-only, not committed.
- `docs/qa/PANEL_BUTTON_AUDIT_2026-11-28.md` / `.json`, `docs/qa/last-browser-qa.json`.
- D1 read: `SELECT ... FROM application ORDER BY id DESC LIMIT 25` (counts only; no row content copied).
- Register rows 3, 20, 21, 22, 135, 152, 160.

## Owner-verify

- None new from this run.

## Owner decisions

- Row 160: preview Results policy. Option A: the adapter asks `applyOutcomesMode` for the role's Results (preview only) and hides the bullet the export promoted, so preview = export. Option B: accept the gap and say so. A changes what every Copenhagen Modern / margin preview shows.
- Carried: row 159 docx-worker 1.14.178 deploy; 152 manual role order; 154 banned-list import; 153 `npm audit fix`; 151 tab-claim fix; 147 proxy deploy; 157 D1 rate INSERT; 136 CI key credit (CI nightly failing daily).

## Non-claims

- No signed-in click-through, no real generation, no real export.
- Row 160 was shown on a synthetic fixture and inferred for real rows from D1 counts; no real application was rendered or exported.
- 50 diags are still red (one of them, `outcomes-mode`, is the real row 160); none is claimed harmless. `demo-toggle` and `photo-positions` were run, not triaged.
- The two diag edits prove current behaviour matches the newer owner rules; they do not re-test the replaced behaviour.
