# AntCV nightly — 2026-08-27 (CI / GitHub Actions, unattended, Opus 4.8)

Substrate: GitHub Actions on `gabrielk83/AntCV`, unattended. No signed-in browser, no live LLM
models, no worker deploy (`ALLOW_DEPLOY` not set). CI SAFETY OVERRIDE in force: docs + all registers
may push straight to `main`; any `pwa/app.js`, `pwa/app.src.js`, or `workers/**` change must go via a
PR. This run made no code change, so everything below is docs/registers pushed to `main`.

## What ran

- **SYNC FIRST:** `git fetch origin && git pull --rebase origin main` — already up to date.
- **Baseline suite:** `node scripts/run-tests.mjs pwa` — **1662 pass, 0 fail, 0 skipped**.
- **Band E1 — register staleness sweep** (the standing NIGHTLY_BACKLOG_RECONCILE slot). After the
  2026-08-26 register split, the stalest rows are the four carrying `verified: never` at the top of
  the `OPEN_REGISTER.md` index. Verify-first against current code; no speculative edits.

## Rows advanced (verify-first, was `never` → 2026-08-27)

| Row | ID | Outcome |
|---|---|---|
| 82 | `ROLE-CANON-AUDIT-LEG-001` | **Code leg CLOSED.** The PERSIST/EXPORT audit leg the row said was "NOT yet wired" has landed — `scripts/job-tracker/gold_audit.py role_canon_issues()` implements both rules (title == doc-language canon; no two visible roles share one canonical id, with the merged-title exemption), wired into `run()` as `checks["role_canon"]`, commit `70c6cd59`. Negative-controlled by `test_gold_residue.py` — **18/18** (en/da/es/zh clean, -N twin, merged-title exemption, dup-canonical flag, he skip). **Remaining: owner es/zh canon-wording eyeball only** (owner-gated). Kept ACTIVE for that. |
| 38 | `GEN-BACKGROUND-001` | Engine present + loaded + tested: `pwa/antcv-gen-memo.js` + `pwa/antcv-gen-job-client.js` (both referenced in `index.html`; `pwa/test/unit/gen-{memo,job-client}.test.mjs` green in-suite). Server `/job/*` dispatch present in BOTH proxies (`workers/{proxy,demo-proxy}/src/gen-job.js` + `index.js`). Remaining unchanged, not CI-verifiable: live `/job/*` curl, owner mobile A/B (`antcv:gen-resume=1`), owner decompose-approach decision (A vs B). Owner-gated / needs-live-env. |
| 94 | `CONTENT-LANG-STAMP-001` | **Still open, row confirmed accurate.** Load half fixed (both app-load sites in `app.src.js` derive the selector from `window.__antcvContentLang(...)`, APP-LOAD-NO-RETRANSLATE-001). Gap confirmed real: grep of `app.src.js` finds NO persisted `content_language`/`contentLang` field — every persist path stamps only `jd_language`, content language re-derived by script-sniff at three sites. Prevention leg = an app.js/app.src.js change → PR-gated in CI + needs a live translate-persist cycle. Carry forward. |
| 76 | `JOBTRACKER-LLM-REFIT-BUTTON-001` | Confirmed a DEFERRED OPTIONAL enhancement by design (Top-5 fit score deterministic for ranking stability; on-add async refine already upgrades tier once). No code owed unless the deterministic tier proves too coarse on real edge JDs — no such evidence. Keep deferred. |

## Checked but not advanced

- **Row 25 `TABLE-GEOMETRY-PARITY-001`** (verified 2026-07-02, next-stalest): needs a diagnosis of a
  REAL CloudConvert PDF vs the preview measurement — not doable in CI (no render pipeline, no browser).
  Date left unchanged; owed to a desktop run with the export path.

## Registers updated (this commit)

- `OPEN_REGISTER.md` — index `verified` dates for rows 38/76/82/94 `never` → 2026-08-27.
- `REGISTER_ACTIVE_DETAIL.md` — each of the four rows' `_verified:_` line + a dated verify-note.
- `REGISTER_RUNLOG.md` — run summary at the top.
- `docs/qa/check-register.mjs` gate: `register OK — 94 ACTIVE rows, 94 detail sections`.
- No `ACTIVE_BUGS.md` / `FEATURES_REGISTRY.md` edit — no code fix shipped and no feature advanced
  this run (row 82's code was shipped 2026-07-13 under commit `70c6cd59`, already logged then).

## Owner / desktop owed

- **Row 82:** owner eyeball pass over the es/zh role-canon wordings — the only thing left before it
  can move to CLOSED.
- **Row 38:** owner A/B on a real mobile gen + owner decompose-approach decision (A full per-section
  vs B resume-on-reload); plus a live `/job/*` curl against the deployed proxy.
- **Row 94:** app.js prevention leg (persist a content-language field) — a code change, so PR-gated;
  next desktop/PR run.
- **Row 25:** real-PDF table-geometry diagnosis (desktop export pipeline).
- No PWA change shipped this run → **no post-deploy live-verify owed.**
