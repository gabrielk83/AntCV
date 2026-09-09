# AntCV nightly — CI run report, 2026-09-09

**Environment:** GitHub Actions (gabrielk83/AntCV), unattended, Opus 4.8. `ALLOW_DEPLOY=false`.
No in-app Browser pane, no live models, no real CloudConvert render.
**Entry HEAD:** `39f2a1f8`. SYNC FIRST clean (`git fetch` + `pull --rebase` → already up to date).

## Bottom line

Main was **GREEN on entry** (`node scripts/run-tests.mjs pwa` = **1714/1714, 0 fail**) — the
2026-09-08 REGISTER-HYGIENE-FIXTURE-DRIFT-001 fix held. **No code shipped this run.** Every Band A/B/C
candidate is blocked on a capability this CI environment does not have (signed-in live verify, real
models, real render, worker deploy). Per the owner hard rule "an end result, not a brickable
mid-product," I did not push speculative app.js/worker surgery. The run's deliverable is the **Band-E
E1 register staleness sweep** — verify-first against current code + refreshed dates + evidence.

## What ran

| Step | Result |
|---|---|
| SYNC FIRST | clean, HEAD `39f2a1f8`, already up to date |
| Baseline suite `run-tests.mjs pwa` | **1714/1714, 0 fail** (main green) |
| `check-register.mjs` | OK — 95 ACTIVE / 95 detail |

## E1 — register staleness sweep (the 4 stalest `verified:` rows, the 2026-07-04 batch)

Ranked on the `OPEN_REGISTER.md` `verified` column (non-STANDING). The stalest were the four
2026-07-04 rows (~67 days). Each verified against current code (HEAD `39f2a1f8`); all four are
"shipped code + a remaining leg blocked on live/regen/owner." Refreshed to 2026-09-09 with evidence,
kept ACTIVE.

- **Row 34 — ROLE-MERGE-STORED-001.** Shipped code INTACT: `antcv-role-merge-stored.js` loaded in
  `index.html` (`?v=1.51.3482-sections-storm`); `window.AntcvMergeSameCompanyRoles` exposed by
  `antcv-docx-client.js` and consumed by the sidecar; `role-merge-stored.test.mjs` +
  `merged-results-union.test.mjs` GREEN in the 1714 suite. **Owed:** live preview==export byte-for-byte
  eyeball on a targeted regen (no signed-in render in CI).
- **Row 27 — MAIN-RUNT-ORPHAN-SWEEP-001.** ORPHAN-PREFLIGHT-V3 sidecars all loaded by `index.html`:
  `antcv-orphan-export-preflight.js`, `antcv-orphan-measure-bind.js`, `antcv-package-orphan-apply.js`,
  `antcv-orphan-cloud-persist-385.js`. Suite GREEN. **Open:** work-style tail truncation, page-3 ghost,
  ~1.5-page real-PDF verify on a FRESH NIL-targeted export — all need a real render CI can't do.
- **Row 28 — NIL-GEN-ADAPTATION-001.** Belts INTACT + loaded: `antcv-profile-access-scrub.js`,
  `antcv-sidebar-relevance-cut.js`. Suite GREEN. **Open:** CV ~1.5pp GEN-LEVEL target (rides row 27) is
  regen-gated — needs a fresh live NIL-targeted generation + export.
- **Row 29 — NIL-TARGETED-STATE-STICK-001.** Closed legs confirmed in `app.js`:
  `277-SEQUENCE-GUARD-001`, `META-DRIFT-GUARD-002`, `CL-HYDRATE-EXPORT-GATE-001`. Suite GREEN.
  **Open:** leg C (live setItem writer-hunt during one row selection + auto-save downgrade belt) needs a
  signed-in session.

All four sidecars confirmed LOADED by `index.html` (not dead files — CLAUDE.md's dead-file caveat
checked). Index dates 34/27/28/29 → 2026-09-09; `REGISTER_ACTIVE_DETAIL.md` sections carry the note.

## Not shipped, and why

- **Band A** (GEN-BACKGROUND / TAB-ISOLATION): shipped legs need a live mobile A/B or a second physical
  device — cannot fake headlessly.
- **Band B/C** (SO-003 data loss, SO-004 crash, GEN-LANGFAB, CA-006, JD-ANALYSIS-PRINT): all require
  app.js surgery, which under this run's CI SAFETY OVERRIDE must go through a PR for owner review, and
  each needs a headless/live repro to be diagnostic-first. None reached a safe, verified end state this
  run — deferred rather than half-pushed.
- **Worker changes:** `ALLOW_DEPLOY=false` — no `deploy.yml` this run.

## Owed to a desktop / owner run

- Owner live/regen/owner-device verifies that gate rows **34, 27, 28, 29** to CLOSED.
- Band B/C app.js surgery (rows **40, 41, 42, 43, 44**) still wants a diagnostic-first PR.
- No PWA asset changed this run, so there is **no post-deploy live-verify owed** from tonight.

## Pushed to main (docs/registers only, allowed under the CI override)

`docs/qa/OPEN_REGISTER.md` (4 dates), `docs/qa/REGISTER_ACTIVE_DETAIL.md` (4 sweep notes),
`docs/qa/REGISTER_RUNLOG.md` (this run, top), `docs/qa/NIGHTLY_2026-09-09_CI_REPORT.md` (this file).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
