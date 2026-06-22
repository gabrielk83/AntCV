# AntCV - Nightly Autonomous Bugfix Run Sheet (2026-06-23 PM -> overnight)

Self-contained boot prompt for a FRESH autonomous AntCV session (no memory of prior chats -
everything is in the repo). Repo: `gabrielk83/AntCV` (React PWA + Cloudflare Workers, owner Gabriel).
This run is UNATTENDED. The owner is asleep. The prime directive is **ship verified bugfixes with
ZERO regressions**. When in doubt, do NOT ship - leave a WIP note and move on.

Owner style for any written report: direct, factual, compressed, no corporate filler. No em-dashes
in any displayed or prompt string (use "-").

---

## 0 - Current head (verified 2026-06-23 from the repo, not memory)

- PWA `main`: **1.50.806** shipped; `antcv-version-override.js` TARGET_VERSION = **1.50.807**.
  -> the NEXT ship is **1.50.808** (bump from 807, never reuse 806).
- docx-worker: **1.14.80** (export Results + table-row spacing).
- proxy / demo-proxy: **3.6.0**; access-relay carries GEN-CONTAMINATION-001 (`POST
  /api/prefs/wipe-generated`).
- Active feature branch (NOT merged, do not touch unattended): `feat/publications-main-rich`
  (Rich sections build, Phase 1 done). Leave it alone tonight - rich-section work needs the owner.

If `git fetch` shows main ahead of 806, a cloud Routine pushed while this was being written. Re-read
`docs/qa/SESSION_LOG_2026-06-23.md` head and the version-override TARGET before doing anything.

---

## 1 - Hard rules (the no-regression contract)

These are not negotiable. A single violated rule can brick the PWA for every user.

1. **SYNC FIRST.** `git fetch origin && git pull --rebase origin main` before any edit. NEVER
   force-push or reset main. On non-ff rejection: `pull --rebase` then push. The pre-push hook
   blocks a push when local main is behind origin - that is a feature, obey it.
2. **app.js is GATED.** Edit `pwa/app.src.js` (source), then MIRROR into minified `pwa/app.js`.
   Minified identifiers DIFFER from source (the shadow hazard: section var is `e` in source, `t`
   in minified). Anchor on string literals, copy minified blocks verbatim, guard every mirror edit
   with an exact occurrence count. After editing assert `app.js` still `startsWith("(()=>{")` and
   contains no `"use strict"`. NEVER run `npm run build:app`.
3. **boot-smoke after EVERY app.js / sidecar change.** `node pwa/test/boot-smoke.mjs` is the #1
   blue-screen guard. Red boot-smoke = do not push, revert.
4. **Cache-bust QUINTET on every changed loaded file** (per the 06-23 regression guard):
   (a) bump the file's `?v=` in `index.html`; (b) `sw.js` CACHE name; (c)
   `antcv-version-override.js` TARGET_VERSION; (d) add the PREVIOUS version to STALE_VERSIONS
   (NEVER the new one - rewrite-loop invariant); (e) the `window.ANTCV_VERSION` seed (~index.html
   :329) and the version-override `?v`. Then `node scripts/check-cache-bust.mjs --range
   origin/main..HEAD`. The pre-push hook enforces this.
5. **Full regression set green before EVERY push** (all currently green):
   - `node pwa/test/boot-smoke.mjs`
   - `node --test pwa/test/unit/*.test.mjs` (295/295)
   - `node pwa/test/diag-freshness-guard.mjs` , `diag-fresh-delete.mjs` , `diag-table-editor.mjs`
     , `diag-results-kernel-match.mjs` , `node --test pwa/test/applyOutcomesMode.test.mjs`
   - docx-worker (only if the worker changed): `node --test
     workers/docx-worker/test/palette.test.mjs workers/docx-worker/test/diag-bundle-palette-sync.mjs
     workers/docx-worker/test/diag-banded-rows.mjs`
   - Add a NEW unit/diag test for every fix. A fix with no test does not ship.
6. **One deployer at a time.** PWA auto-deploys on push. Workers deploy via `gh workflow run
   deploy.yml -f target=<w> -f mode=deploy -f confirm=<w>` then `gh run watch <id> --exit-status`.
   Never run two deploy.yml in parallel.
7. **Dual-sync workers.** Any change to a `workers/proxy/src` file that has a byte-identical twin in
   `workers/demo-proxy/src` must be applied to BOTH, then deployed separately (proxy, then
   demo-proxy). docx-worker is a hand-maintained inlined bundle: edit
   `workers/docx-worker/src/index.js` (the real main), not the `src/*.js` modules, or the deploy
   ships stale code.
8. **Acceptance gate** (a fix is NOT accepted - revert it - if any holds):
   - works in Preview but not DOCX/PDF (unless export is explicitly out of scope)
   - right control, wrong item; drag-drop lands somewhere other than the indicator
   - watermark attaches to text flow instead of the page box
   - control hidden / clipped / needs horizontal scroll
   - only works after a hard refresh
   - you could not verify it green PAST the sign-in gate (boot-smoke alone is not enough -
     see `headless-pwa-testing`); if you cannot verify, mark WIP and skip, do not ship.
9. **Invariants not to break** (from the 06-23 guard): STALE_VERSIONS must never contain the
   current TARGET; `proofPointsByRole` stays an object keyed by role with per-role outcomes in
   `workHistory[].outcomes` (don't "fix" tier 3b away); Results lamination / shape-fix / CL bridges
   run at RENDER and fix the current doc with no regen - don't move them into the generation path.

---

## 2 - Tonight's eligible work (autonomous-safe only)

Picked for: deterministic, headless-verifiable, low blast radius, no owner decision needed, no
regen-gated content (regen needs a signed-in browser the owner must drive). Work TOP-DOWN; ship each
independently; stop the moment a fix can't be verified.

### LANE A - deterministic code fixes (highest leverage, safest)

**A1. JD-ANALYSIS-PRINT-001** _(High, sidecar)_ - Exporting the JD analysis prints the CV instead of
the analysis report. Confirm the export handler in `antcv-analysis-report-pdf-360.js` targets the
analysis-report DOM node, not the active CV preview iframe; gate on the Analysis view being active.
Add `pwa/test/diag-analysis-print-target.mjs` asserting the captured node id is the report, not the
CV paper. Sidecar-only -> one-session shippable.

**A2. WM-006** _(Medium, sidecar)_ - AI-assisted notice lands in the denser column on the last page.
Place it in the column with MORE residual whitespace on the final page (compare residual height of
sidebar vs main; tie -> main). Placement rule only, no wording change. Extend an existing watermark
/ notice diag to assert column choice on a sidebar-heavy vs main-heavy last page.

**A3. VAL-001 / VF-016** _(Medium)_ - Set-menu validation: warnings render red like errors. Warnings
must be yellow and visually distinct from red errors. Find the validation severity styling; map
`warn` -> yellow, `err` -> red. Pure CSS/class change if the severity is already in the data; add a
diag asserting the two severities resolve to different colour tokens.

**A4. PRV-004 / VF-015** _(Medium)_ - Clicking the loading-status area hides it while work may still
be running. Make the status non-dismissive while a job is in flight (only allow hide on terminal
state). Headless-checkable by simulating an in-flight state and asserting the click is a no-op.

### LANE B - export/worker fixes (deploy gated, dual-sync aware)

**B1. PDF-LAYOUT-001** _(High, docx-worker)_ - PDF shows a stray "Selected Outcomes" heading on
page 2. This is the docx-worker PDF path. Reproduce via the worker test harness, fix the
heading-orphan emission, re-run `workers/docx-worker/test/*` + a new diag. docx-worker is the inlined
`src/index.js`. Deploy docx-worker via deploy.yml only after worker tests are green. If it cannot be
reproduced deterministically in the harness, defer (do NOT guess against live PDF).

**B2. GEN-SCE-FLAG-001 follow-through** _(High, proxy + demo-proxy)_ - The await-fix + flag toast
shipped (1.50.399 + proxy/demo). Tonight's safe slice: verify the SCE telemetry put is awaited in
BOTH proxy and demo-proxy `executeSceWithRetry`, and that `Access-Control-Expose-Headers` lists the
`X-AntCV-*` SCE headers in both. If demo-proxy drifted from proxy, re-sync the twin and deploy both.
Do NOT attempt the model-role routing (GEN-MODELROLE-001) tonight - design task, owner-gated.

### LANE C - verification-only (no code, just confirm-or-file)

These shipped but were "needs owner live re-check". Tonight, do the HEADLESS half only and FILE the
result; leave the signed-in half for the owner.

- **EXPORT-PREVIEW-HUG-001 (1.50.755)** - boot-smoke + headless open of the export modal; confirm no
  console error and the hug formula runs. Signed-in visual check stays owner-side.
- **PHOTO-003** - confirm the docx-worker strokes `a:ln` over the pentagon `prstGeom` in a generated
  DOCX from the worker harness (no live preview needed).

### EXPLICITLY OUT OF SCOPE TONIGHT (need the owner / a signed-in browser / a regen)

- Anything on `feat/publications-main-rich` (Rich sections Phase 2/3, HWIC restructure).
- Regen-gated content: twin-tables-distinct-seeds verify, FOUNDATION/WHAT-I-BRING gen verify,
  certs-trim, accessibility terse rewrite, profile opener by application type. All need a live regen.
- JD-SYNC-001 live verify, Fuse CL->CV end-to-end - need a signed-in session.
- Big-document boot pagination FREEZE ([[boot-storm-gate-freeze]]) - large, not a nightly fix.
- SO-003 (advanced-style wipe) / SO-004 (React #185) - data-loss/crash class; reproduce only in a
  dev build with the owner, do not patch blind overnight.

---

## 3 - Per-fix loop (repeat for each item, serially)

```
1. git fetch origin && git pull --rebase origin main      # sync first
2. Reproduce the bug (harness / headless / worker test). If you cannot reproduce -> file + skip.
3. Edit app.src.js -> mirror to app.js (occurrence-count guarded), OR sidecar, OR worker src/index.js.
4. boot-smoke (PWA changes) ; add a new diag/unit test for THIS fix.
5. Run the FULL regression set (section 1.5). All green or revert.
6. Cache-bust QUINTET (PWA loaded-file changes) ; check-cache-bust --range.
7. Commit (clear message: <ID> - <what> - v1.50.NNN). Push. (workers: deploy.yml + gh run watch).
8. Verify the deployed artifact (PWA: freshness probe ; worker: live endpoint smoke).
9. Log to docs/qa/SESSION_LOG_2026-06-23.md (append) AND the register
   docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-20.md.
```

Version discipline: each PWA ship bumps the patch (807 -> 808 -> 809 ...). Never reuse a number.
docx-worker bumps its own (1.14.80 -> 1.14.81).

---

## 4 - If something goes wrong (autonomous failure handling)

- **boot-smoke red after a mirror edit:** the app.js mirror is malformed. `git checkout -- pwa/app.js
  pwa/app.src.js` and re-do the edit more carefully, or skip the item. Never push a red boot-smoke.
- **A push is rejected non-ff:** `git pull --rebase origin main`, re-run boot-smoke + regression set
  (the cloud Routine may have changed the same files), then push.
- **A worker deploy fails:** `gh run watch` will show non-zero. Do NOT retry blindly more than once;
  if it fails twice, revert the worker commit on main and file the failure. A half-deployed worker
  pair (proxy updated, demo-proxy not) is a regression - finish both or revert both.
- **Cannot verify a fix past the sign-in gate:** mark it WIP in the log, leave the code on a local
  branch or revert from main, do not ship to main.
- **Uncertain whether a change is safe:** default to NOT shipping. The cost of a skipped fix is one
  night; the cost of a bricked PWA is every user until the owner wakes up.

---

## 5 - Morning report (write this before ending the session)

Append to `docs/qa/SESSION_LOG_2026-06-23.md` (or a new `_2026-06-24` log if the date rolled):

- SHIPPED: per item -> ID, version, what changed, how verified (which diag/test), live-confirmed?
- SKIPPED / WIP: per item -> why (couldn't reproduce / needs signed-in / needs owner decision).
- REGRESSIONS caught + reverted: any fix that failed the acceptance gate and was backed out.
- NEEDS OWNER: the signed-in verifies (JD-SYNC-001, export-hug visual, any regen-gated item).
- Final state: ending PWA version, any worker deploys, test suite count, all-green confirmation.
- Update memories with any durable lesson (new shadow-hazard site, a fragile sidecar, etc.).

Keep it scannable. The owner reads this first thing and decides the next focused pass from it.
