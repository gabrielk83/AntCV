# CI Nightly report — 2026-10-14 (GitHub Actions, unattended, Opus 4.8)

**Run type:** Band-E E1 register staleness sweep. No code shipped.
**HEAD:** `9bca15b8` (SYNC FIRST clean — `git fetch && git pull --rebase origin main` already up to date).
**Suite:** 1821/1821 green (`node scripts/run-tests.mjs pwa`, 0 fail); `check-register.mjs` OK.
**Environment:** `ALLOW_DEPLOY=false`, no in-app Browser pane, no signed-in session. Bands A–D stay
blocked on live/device/owner/real-model gates CI cannot clear.

## E1 — 5 stalest rows (all last swept 2026-10-04), re-verified against HEAD and refreshed to 2026-10-14

Three code commits landed since the last sweep (e69e15c6 linear enriched closing tables + "(Cont.)"
1.51.4873; b6175919 EDU-DETAIL-001 1.51.4832; ae90169c unwrapped-import sibling fix 1.51.4812). Each
was checked against the five rows' anchors — none touch them.

| # | ID | Verdict | Evidence |
|---|---|---|---|
| 76 | JOBTRACKER-LLM-REFIT-BUTTON-001 | deferred OPTIONAL (unchanged) | Still a design deferral, not a defect. Deterministic Top-5 fit ranking is intentional (ranking stability); an on-demand "re-judge fit" LLM button is only worth building if the deterministic tier proves too coarse on real edge JDs — no such evidence. No code owed; nothing regressed. |
| 82 | ROLE-CANON-AUDIT-LEG-001 | CODE LEG DONE | `python3 scripts/job-tracker/test_gold_residue.py` → **18/18 checks pass**; `role_canon_issues(cv, lang, gold)` defined at `gold_audit.py:22` and wired into `run()` as `checks["role_canon"]` (`:91-92`). Only the owner-gated es/zh canon-wording eyeball remains. |
| 60 | PANEL-CONTROLS-2026-07-07 | diagnosed; live-patch pending | Both control sidecars on disk + wired in `pwa/index.html` (`antcv-header-rule-control.js` leg a, `antcv-cl-slogan-control.js` legs c/d/e/f; **2 refs**). Leg (d) `clClosingHidden`/`clSignNameHidden` still the genuine gap. All six legs need live-DOM capture + patch and, being auto-deploy-to-prod app changes, a live repro before ship — not doable in CI. |
| 61 | LINE-DISTRIBUTION-GUIDELINES-001 | partly BAKED (standing anchor) | Guidelines partly baked under LINE-DISTRIBUTION-001: `antcv-bullet-targets.js goldDensity()` (**4 refs**) + `window.__antcvRowFit` (**8 refs** in `app.src.js`) both present; marker counts unchanged by the 3 commits. Remaining points (clean-cut floor pt 10, result-line one-line budget pt 5, multi-language render-measure) still feed the generator orphan-measure work (rows 27/49/59A). |
| 57 | TARGETED-CV-POLISH-RULES-001 | NOT started (hand-applied) | Still a set of universal polish rules applied by hand, not baked into the generator — except the line-fill/orphan points (4/14/19/22/28/29), which overlap row 61 and are partly served by LINE-DISTRIBUTION-001 (same `goldDensity()`/`__antcvRowFit` markers confirmed). The content/furniture rules remain generator-baseline TODOs. |

All five CODE-INTACT / NOT-STARTED-as-scoped; kept ACTIVE on their live/owner/real-model gates.

## Gates before push
- Suite 1821/1821; `check-register.mjs` OK.
- Docs/registers only → no cache-bust quintet, no version consumed, no shift claim, no PR owed.

## Owed to a desktop / owner run
- **Row 76:** none owed — owner call on whether to build the optional button at all.
- **Row 82:** es/zh canonical-role-title wording eyeball (owner).
- **Row 60:** live-DOM capture + patch + live repro per leg (auto-deploy prod); leg (d) is the next
  concrete codeable step but still needs the live repro before ship.
- **Rows 61 / 57:** the generator-baseline bake of the remaining line-fill/content/furniture rules,
  measured on a real LLM generation + render (Word-COM/CloudConvert), which CI lacks.

## Post-deploy live-verify owed
None — no PWA/worker change shipped this run.
