# AntCV CI NIGHTLY — 2026-09-08 (GitHub Actions, unattended, Opus 4.8)

Repo `gabrielk83/AntCV`. Fresh isolated clone, no local memory. ALLOW_DEPLOY=`false`.
SYNC FIRST clean — HEAD `93e2155e`, `git pull --rebase` already up to date. No force-push.
Release live: `1.51.4526-slogan-paper-contrast`.

## Headline

`main` was RED at session start. This run **restored the suite to green** by fixing a
test-fixture regression the 2026-09-07 CI run pushed, then ran the never-skip Band-E standing
coverage and the E1 register staleness sweep on the six genuinely-stalest rows. Everything shipped
is docs / registers / a test — pushed straight to main per the CI override (rule 2). No
`app.js` / `app.src.js` / `workers/**` change → no PR owed, no cache-bust, no deploy.

## PRIMARY FIX — REGISTER-HYGIENE-FIXTURE-DRIFT-001 (suite regression, CLOSED same run)

**Symptom.** Baseline `node scripts/run-tests.mjs pwa` → **1713/1714, 1 fail**. The failure was the
negative control `pwa/test/unit/register-hygiene.test.mjs:83` ("catches an unrankable verified cell
— the 'no' that hid 55 days of staleness"), erroring `fixture drift: row 25 verified cell not
found`.

**Root cause.** That one sabotage case hardcoded row 25's verified date:
`/^\| 25 \| \`TABLE-GEOMETRY-PARITY-001\` \| 2026-07-02 \|/m`, while every sibling sabotage
(lines 61 / 73 / 97 / 117) matches `^\| 25 \|` date-agnostically. The 2026-09-07 CI E1 sweep
legitimately re-dated row 25 to `2026-09-07`, so the `replace()` no longer matched, `f` was left
unchanged, and the case's own `assert.notEqual(...)` guard tripped. The 09-07 run edited the
register **after** its baseline suite run and pushed without a re-run, so the break reached main
while the report read "1714/1714 green" (that green was the pre-edit baseline).

**Fix.** Match the date with a captured ID prefix + `\d{4}-\d{2}-\d{2}`, dropping the date for the
unrankable `no` — drift-proof against any future re-date, matching the sibling style:

```js
f['OPEN_REGISTER.md'] = before.replace(
  /^(\| 25 \| `TABLE-GEOMETRY-PARITY-001` \|) [0-9]{4}-[0-9]{2}-[0-9]{2} \|/m,
  '$1 no |');
```

The negative control still genuinely trips the checker (`assert.equal(r.ok, false)` +
`assert.match(.../must be YYYY-MM-DD or \*\*never\*\*/)`) — the fix restores the fixture match, it
does not weaken the assertion.

**Verified.** `register-hygiene.test.mjs` 12/12; full suite **1714/1714, 0 fail, EXIT=0**;
`check-register.mjs --dir docs/qa` → `register OK — 95 ACTIVE, 95 detail, index 16.7 KB`.
Test-only change (`pwa/test/**` is not loaded by `index.html`) → no cache-bust, no app.js/worker
touch. Registered in `ACTIVE_BUGS.md` (top block) and `REGISTER_CLOSED.md`.

**Lesson (recorded for the sweep).** A negative-control fixture that pins a *mutable* register
value (a date, a status) rots the moment the sweep does its job. Pin the STRUCTURE, capture the
value — which is what the sibling sabotage cases already did.

## BAND E — STANDING COVERAGE

### E1 — register staleness sweep (verify-first, current code)

Ranked staleness on the index `verified:` column only. The six genuinely-stalest rows are the
**2026-07-03 batch** (~67 days stale — older than the 2026-08-27 rows that sit at the index top).
All verified against CURRENT bundles/workers; the four locking tests together **27/27**.

| Row | ID | Finding this run | Disposition |
|---|---|---|---|
| 32 | CL-PLATFORM-SIGNALS-001 | `__platformRule` (src) / min `__pr` (app.js) both-bundle mirror; `cl-platform-signals.test` GREEN | CODE-COMPLETE → **recommend owner CLOSE** (owner-gated live tone-check remains) |
| 30 | LLM-IMAGE-ROUTING-001 | `filterVisionBlind`/`VISION_BLIND` in BOTH proxies; PWA `ee()` mistral-drop mirror; `image-routing-ee.test` GREEN; both proxies deployed | CODE-COMPLETE → **recommend owner CLOSE** (only the optional adequacy-gate extension remains) |
| 33 | WHY-RULE-EXPORT-PARITY-001 | `nameLineAlign`+`headline_align` in docx-client, `headlineAlign` in docx-worker; `export-align-parity.test` GREEN; worker deployed | CODE-COMPLETE → **recommend owner CLOSE** (signed-in export eyeball only) |
| 26 | TOOLS-SIDEBAR-COMPRESS-001 | `antcv-sidebar-compact-001.js` loaded + `sidebar_compact` in `gold-rules.json`; `sidebar-compact.test` GREEN | kept ACTIVE — owner visual verify + token-order belt remain |
| 24 | ANALYTICS-BUTTONS-SESSION-TIMEOUT-001 | client 401-wipe scope guard + server secret-pair fix present | kept ACTIVE — owner three-button click-through remains |
| 22 | CL-SLOGAN-RICHCONTENT-001 | phase 1 (`antcv-cl-slogan-element.js`) loaded | kept ACTIVE — phase 2 (real `sections.cl` rich_block) is genuine open work |

Index dates 22/33/24/26/30/32 → `2026-09-08`; detail sections carry the per-row evidence.

### E2 — Row 17 SETTINGS-PERSONAL-STABILIZE-001 (STANDING)

`diag-settings-panels-probe` → Personal / Account / Layout all **0 mutations / 6s**, rootFound=true,
**0 page errors** → DIAG PASS.

### E3 — Row 23 NIGHTLY-PREVIEW-BUTTON-AUDIT-001 (STANDING)

`diag-panel-button-audit` → **209 buttons {dangerous:14, ui-only:16, active:133,
not-visible:46}, 0 THROWS, 0 page errors**. Vs 2026-09-07 (215 buttons, 0 THROWS): enumeration
varies with mount timing across the active/not-visible buckets, the invariant (0 throws, 0 page
errors) holds → **no regression**. Artifacts: `docs/qa/PANEL_BUTTON_AUDIT_2026-09-08.{json,md}`.

## Environment / caveats

- Playwright browsers absent on the runner; installed `chromium` headless so the E2/E3 diags could
  run. Module was present.
- No in-app Browser pane in CI → no signed-in live-verify. Nothing shipped this run touches a
  loaded PWA asset, so there is **no post-deploy live-verify owed** from tonight (test-only + docs).
- ALLOW_DEPLOY=false → no worker deploy attempted (none owed by tonight's work).

## Owed to a desktop / owner run

- **Owner CLOSE decision** on rows **30 / 32 / 33** — all verified CODE-COMPLETE this run; only
  non-code owner checks remain. Moving them to `REGISTER_CLOSED.md` is an owner call.
- Owner-gated verifies still open: row **24** (three analytics buttons click-through), row **26**
  (gold Instruments/Lab strings visual).
- Band B/C code fixes (rows **40 / 41 / 42 / 43 / 44**) still want app.js surgery via a PR — out of
  scope for an unattended CI run (rule 3).

## Files changed

- `pwa/test/unit/register-hygiene.test.mjs` — date-agnostic sabotage regex (the fix).
- `docs/qa/OPEN_REGISTER.md` — index dates for rows 22/33/24/26/30/32 → 2026-09-08.
- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — `_verified:` + evidence for the six swept rows.
- `docs/qa/REGISTER_CLOSED.md` — REGISTER-HYGIENE-FIXTURE-DRIFT-001 closed record.
- `docs/qa/ACTIVE_BUGS.md` — the fix (top block).
- `docs/qa/REGISTER_RUNLOG.md` — this run's summary (top).
- `docs/qa/PANEL_BUTTON_AUDIT_2026-09-08.{json,md}` — E3 artifacts.
- `docs/qa/NIGHTLY_2026-09-08_CI_REPORT.md` — this report.
