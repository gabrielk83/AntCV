# AntCV nightly — 2026-07-26 (desktop, unattended, Opus 4.8)

Third run of the day. A CI/Actions sweep (`NIGHTLY_2026-07-26_CI_REPORT.md`) left the standing
surface green and filed two render-capable owed items; this DESKTOP run picked those up.

**SYNC FIRST:** local branch head was a STALE shift release (`97d267d`, 1.51.2940, ~800 versions
behind, NIGHT_SHIFT.md rebase conflict confirmed it superseded) → reset to `origin/main`. Worked
the render-capable items. Preflight WORKSPACE CLEAN. No force, no version-consuming change → no
shift claim needed (test-file + docs only).

## Cross-session collision — DOCX-DIAG-STALE-OR-REGRESSED-001 (landed by a parallel session)

I fully triaged and fixed all 6 failing docx render diags (42/48 → 48/48). While preparing to
push, `git fetch` showed a PARALLEL session had already landed the identical work as `12488fb`
("test(docx): fix 6 stale render diags + wire render V&V into CI"). **Independent
cross-validation:** both runs reached the SAME verdict on all 6 (STALE, not regressions) with the
same root causes and effectively the same assertion fixes — and the parallel commit additionally
wired `run-docx-diags.mjs` into the CI docx step (I had not). I therefore **discarded my
now-redundant diag edits and my DOCX-DIAG register edits and fast-forwarded onto `12488fb`** (never
clobbered the landed work). The 6 verdicts, for the record, matched exactly:

| Diag | Root cause (superseding change, both runs agreed) |
|---|---|
| `diag-header-navy-invisible` | TOP-STRIP-MATCH-BAND-001 (owner 2026-07-13): band-matched shd + line=20, superseded 2026-07-07 no-shd/line=40 |
| `diag-ai-notice-anchor` | notice text = hyphen (banned-dash); CL notice → footer paragraph; CV VML page-relative via explicit margin-top, not the mso keyword |
| `diag-photo-bridge-export` | CONTACT-CONVERGE-001 (owner 2026-07-14, 3e6f1ef): bridge contact 8→8.5pt (sz 16→17) |
| `diag-spacing-linkedin-export` | PROFILE-TOPGAP-001 (owner 2026-06-26): first main heading before=0 → needed a 2nd main heading |
| `diag-pageflow-export` | PAGE_H 17538→16838 → hardcoded 15338 cont-row min stale (theirs: 14638; mine: the −900 relationship) |
| `diag-cjlr-table-export` | FOCUS-TABLE-LEFTCOL-JUSTIFY-001 (Copenhagen mockup lock, owner 2026-07-22): label col stays LEFT |

Net: no duplicate landed; `run-docx-diags.mjs` is 48/48 on main and now CI-gated. (Process note:
the two sessions started from the same OPEN_REGISTER row without a shift claim — test-file work is
claim-exempt, but this is a reminder that a claim on a named register item would have avoided the
duplicated effort.)

## Net unique contribution this run — DIAG-SALMON-EMPTY-REGION-STALE-001 (deeper diagnosis, still OPEN)

The other owed item. Took the CI recipe ("bump to 7–8 roles"). **It does NOT work** and the
register/ACTIVE_BUGS were updated with why: the headless harness does not paginate at all — the
preview MEASUREMENT pass that populates `antcv:autoPagesPreview` / sets the render's page count `u`
does not run to completion in the seeded `step:'editor'` context within the wait window, so even
~2× a page (measured 2015px main content) stays `pageRows=1` (`u=Math.max(1,...pages)` → 1). Two
further fixture bugs surfaced: (a) the fixture `profile` renders as an empty "(click to add)"
placeholder — the current build no longer reads its `text` field, so page 1 is near-empty;
(b) forcing the split via manual `role.page` (which DOES win over the measurer in the render
role→page map `d`) exposes the measurer partially running and reordering roles across 3 page-boxes.
A clean, stable, representative 2-page render is not reliably reproducible headlessly. **Reverted
the WIP** (a fragile half-working test would violate "an end result, not a brickable mid product").
Proper repair needs the in-app Browser pane driving the real Preview tab + awaiting the measurer,
or a fully deterministic seeded `autoPagesPreview` map + the profile-field fix. Gates nothing.

## Standing surface

Green from the 07-26 CI run (PWA suite 1482/1482, boot-smoke OK, app.js head intact, access-relay
128/128, demo-proxy 33/33, model pins 5+5, render diags rows 11/17/23 green, all five worker/PWA
surfaces attest live at `1.51.3803` / `1.14.171` / `auth-36` / `3.8.4`). This run made NO
pwa/app.js/worker change → surface unaffected, not re-run.

## Register coverage this run
- **DOCX-DIAG-STALE-OR-REGRESSED-001** — DONE on main via the parallel `12488fb` (48/48 + CI-wired);
  independently cross-validated here, no duplicate landed.
- **DIAG-SALMON-EMPTY-REGION-STALE-001** — still OPEN; CI recipe found insufficient, diagnosis
  deepened (headless harness can't paginate → needs the in-app Preview). OPEN_REGISTER + ACTIVE_BUGS
  updated.
- All other open rows — owner-gated / need a 2nd physical device / live models / a real foreground
  gen → none newly actionable from a test-infra desktop run; CI refreshed the stalest render rows
  (11/17/23) earlier today.

## Owed / carry-forward
- **DIAG-SALMON-EMPTY-REGION-STALE-001** — render-capable repair via the in-app Preview tab.
- **Post-deploy live-verify** — none owed (no PWA/worker change shipped). Optional carry-forward
  from CI: live-verify PREVIEW-SHEET-WORD-HEIGHT-001 + SALMON-BREAK-SITE-001 + WHY-JOINED-SENTENCE-001
  on the deployed `1.51.3803`.

## Commits
Docs/registers only (salmon deeper diagnosis + this report). No `app.js` / `app.src.js` / worker
source / test / workflow change from THIS run reached main (the docx-diag fixes came via the
parallel `12488fb`).
