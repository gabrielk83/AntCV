# AntCV nightly — 2026-09-10 (GitHub Actions CI, unattended, Opus 4.8)

Repo `gabrielk83/AntCV`, fresh isolated CI clone. Owner: Gabriel. Style: direct, compressed.

## Entry state
- SYNC FIRST clean: `git fetch && git pull --rebase origin main` → already up to date, HEAD `6f9ff8ee`.
- `ALLOW_DEPLOY=false` → no worker deploys this run.
- Baseline `node scripts/run-tests.mjs pwa` = **1714/1714, 0 fail**. Main is GREEN.

## What ran — Band E standing coverage (E1 register staleness sweep)

Band A/B/C were all blocked on capabilities this CI environment lacks: no live signed-in
Browser pane (antcv.pages.dev), no real LLM models, no real CloudConvert render, and
`ALLOW_DEPLOY=false`. Per the owner hard rule ("an end result, not a brickable mid-product")
no speculative app.js/worker surgery was attempted. The run did the E1 standing slot:
verify-first the 4 genuinely-stalest `verified:` rows against current code (HEAD `6f9ff8ee`).

The stalest rows after the 2026-09-09 run bumped the 07-04 batch are the **2026-08-27 batch**:
rows 38, 76, 82, 94.

| row | ID | verify result | disposition |
|---|---|---|---|
| 38 | GEN-BACKGROUND-001 | `antcv-gen-memo.js?v=1.51.134` + `antcv-gen-job-client.js?v=1.51.132` still loaded in `index.html`; `window.AntcvGenJob` still exposed; suite green. Engine INTACT. | kept ACTIVE (owner-gated: A/B on real mobile gen + per-section decompose decision) |
| 76 | JOBTRACKER-LLM-REFIT-BUTTON-001 | Unchanged deferred OPTIONAL enhancement — deterministic Top-5 tier is by design; no code owed, nothing regressed. | kept ACTIVE (optional, low priority) |
| 82 | ROLE-CANON-AUDIT-LEG-001 | **Code leg re-confirmed DONE.** `scripts/job-tracker/gold_audit.py role_canon_issues` wired into `run()`; `test_gold_residue.py` = **18/18 pass** on HEAD. | kept ACTIVE (only owner-gated es/zh wording eyeball remains) |
| 94 | CONTENT-LANG-STAMP-001 | `content_language` field present in `pwa/app.js` (4 refs); `1.51.4446-content-lang-stamp` leg INTACT; suite green. | kept ACTIVE (model-gated: live translate-persist regen) |

Index dates 38/76/82/94 advanced → 2026-09-10. Detail sections in `REGISTER_ACTIVE_DETAIL.md`
carry the per-row evidence. `node scripts/check-register.mjs` → OK (95 ACTIVE / 95 detail).

## Shipped
- None (docs/registers only). No `pwa/` loaded-asset changed → no cache-bust quintet needed;
  the pre-push `check-cache-bust` gate is a no-op for this run.

## Verified in CI
- Full pwa suite 1714/1714 green (entry + unchanged at exit — no code touched).
- Row 82 python negative-control `test_gold_residue.py` 18/18 pass.
- Register integrity via `check-register.mjs`.

## Could NOT verify in CI (owed to a desktop/owner run)
- Row 38: A/B a real mobile gen (start → background → foreground → resume) + owner decision on
  the per-section decompose approach — needs a live signed-in mobile gen.
- Row 82: owner eyeball of the es/zh role-canon wordings.
- Row 94: a live generate/translate-persist regen confirming the content-language stamp is
  authoritative — needs real models.
- Band B/C app.js surgery (rows 40 SO-003, 41 SO-004, 42 GEN-LANGFAB, 43 CA-006, 44
  JD-ANALYSIS-PRINT) still want a PR under CI SAFETY OVERRIDE rule 3.
- Post-deploy live-verify: N/A this run (no PWA change shipped).

## Skipped + why
- No worker changes (`ALLOW_DEPLOY=false`, and none were in scope).
- No app.js/app.src.js edits (all candidate fixes are live/model/owner-gated; the hard rule
  forbids speculative surgery in an environment that can't verify it).

## For the owner's morning pass
- Row 38 mobile-gen A/B + decompose approach decision.
- Row 82 es/zh role-canon wording eyeball.
- Row 94 translate-persist regen.

---
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
