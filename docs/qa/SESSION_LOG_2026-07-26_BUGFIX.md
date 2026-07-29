# Bugfix session - 2026-07-26

Owner order: "do full bugfixes independent session starting now" / "PLEASE KICK
THE BUGFIXES SESSIONS AGAIN" / "claude dropped. continue the tasks."

Two spawned background sessions were killed by the host process exiting. The
SECOND one had already landed and DEPLOYED four items before it died; it was
stopped during its reporting phase, so its code is live but its paperwork was
missing. A third pass (inline, in the foreground session) recovered the
uncommitted remainder, fixed a pre-existing red test, and wrote this log.
Nothing was lost.

## Landed and live

### CV-3P-UNDER-STAGE4-001 - fit by compression, never deletion
`74c3f79`. gen-runner's page governor had only DELETE levers (drop sidebar rows,
a whole role, bullets down to 2). Defensible as a last resort during generation,
wrong as a repair for a SAVED application - the owner rule is compress, never
wholesale-delete. Under the taller Stage-4 header app 2733's CV spilled onto a
third page carrying nothing but the RECOMMENDATIONS heading and one line.

NEW `scripts/job-tracker/cv_fit.py`, built the way `cl_fit.py` is built:
byte-exact render -> measure_density line metrics -> targeted rewrite ->
re-render, and the ONLY acceptance is the measured page count.
- Candidates rank by RELATIVE cost. A line off a 90-char bullet costs it 45% and
  reads telegraphic; the same line out of the 760-char profile costs 6%. Gentle
  blocks pay first.
- A rewrite that frees no rendered LINE is refused as content churn (characters
  only become height at a line boundary).
- The stored source string is located by SIMILARITY, not equality (the expTense
  preference rewrites verbs inside buildPayload, so the rendered bullet is never
  byte-equal to the stored one). An ambiguous locate is a miss, never a guess.
- Gates: numbers verbatim, acronyms verbatim, no em/en dash, no dangling
  connector, plus two found on live output - NO ABBREVIATION (it bought
  characters by clipping "application-level development" to "app-level dev") and
  NO INVENTION (it returned "customer-facing teams" as "sales", which passed
  every other gate while making up a department).
- Wired into `fit_to_pages` AHEAD of the delete levers (fail-open), so future
  generations compress before they cut.

Verified live: 2733 3pg -> 2pg, PUT base_rev-guarded, re-rendered from the saved
row, 4 bullets compressed and nothing deleted. 2730 already rendered 2pg.
Tests: NEW `test_cv_fit_gates.py`, 9-case truth table from real 2733 rewrites,
plus an assertion that cv_fit carries no delete lever.

### APP-CAP-50-BULK-REGEN-001 - the cap stops eating originals
`6e1b8ab`, relay `auth-37-cap-disposable-only` (deployed, /health confirmed).
The newest-50 history cap was enforced by DELETE, so any row falling out of the
window was destroyed. Once the account actually reached 50 that made every bulk
process destructive: a regen writes new rows, each PUT re-runs the sweep, and the
OLDEST generated applications were deleted to pay for them. The 2026-07-23
full-list regen had to be stopped at 49 by hand to stop it eating originals.

A cap enforced by DELETE cannot tell a stub from a finished application, so it no
longer tries: the sweep is DISPOSABLE-ONLY. It may delete a row with no generated
content - the empty stub a crashed generation or a stray POST leaves behind - and
never a row carrying a CV or a cover letter. Going over 50 is reported to the
client as `history_over_cap` so pruning stays a deliberate act. The collection
LIST was raised 50 -> 200 in the same breath: keeping a row and then hiding it is
the same bug wearing a different hat.

### FOREIGN-NIGHT-WRITER-2026-07-23 - the stub writer names itself
Same commit. An unidentified headless automation created an empty stub
application at 04:37, moved the GLOBAL active pointer onto it, and the owner's
real active application came back blank. Nothing on the row identified the
writer. Now:
- every POST that creates a row with NO sections logs its caller (device_id,
  user-agent, origin, referer, sec-fetch-site, cf-ray, country), so the next
  occurrence names itself in the worker tail;
- only a browser-shaped caller may move the global active pointer. "You just
  pasted a JD" is a browser expectation; a headless caller has no screen to
  update. The test is device_id (the PWA always sends it) or the fetch-metadata
  headers only a real browser sends. gen-runner already treats a moved pointer as
  damage and restores it by hand - this stops the damage happening at all,
  including when the script dies before it can restore.

### CPH-RENDER-FLAGS-001 - the eight open mockup-divergence flags
`4821c9e` (PWA 1.51.3822) + docx-worker `1.14.172-cph-render-flags` (deployed),
completed by `57c5377` (PWA 1.51.3823). All gated on copenhagen-modern (preview
`__antcvCphPkg`, export `style._cph`) so every other package renders
byte-identically.
1. Rule weight: every rule/underline drew 1px CSS (0.75pt) against a 1.5pt
   mockup. One sweep, one helper (`__antcvCphRule`); export mirror border size
   8 -> 12 eighths of a point.
2. Section-head underline colour: was the teal of the head above it, mockup puts
   grey #777777 under the teal heads. Main heads only - sidebar heads keep
   sidebarHeadColor.
3. Per-role rule DROPPED. Note the follow-up: since ROLES-AS-RICHBLOCK-001 the
   role rows render in `antcv-roles-richblock-adapter.js`, NOT the app.js
   experience branch, so the first fix left the rule on screen; 1.51.3823 drops
   it in the adapter path too (same package normalisation, same fail-open, an
   explicit `row.hr` still honoured on other packages).
5. "Results:" lead-in upright with a 1.5pt grey underline (the mockup reserves
   italics for the company line).
6. {grp} sub-heads sit on their own rule - teal in main, grey in sidebar - with
   the group's years right-set in #777777, floated so the heading's own centered
   alignment is untouched, rendered only when the row carries them.
7. Body links #0563C1 -> #0B4F8A (preview + both worker sites).
8. Sidebar panel border-radius 9px in the copenhagen-v2 sidecar. No
   overflow:hidden, so a straddling photo is still never clipped.
Also in 1.51.3823: the PAGINATED continuation head draws its rule on a separate
render path from the section head, so it takes the same 1.5pt grey; AI notice
7 -> 7.5pt on copenhagen.

## Also fixed

`pwa/test/unit/jobtracker-open-jd-routing.test.mjs` matched the
supporting_context assembly with a `;\n` terminator, which never matches on a
Windows CRLF checkout (`;\r\n`) - green in Linux CI, RED on the desktop. This is
the eol-fragile-tests class. Now `;\r?\n`.

## Gates

- pwa suite: 1491 pass / 0 fail.
- docx-worker: palette + diag-bundle-palette-sync + diag-banded-rows 17 pass;
  diag-copenhagen-stage4 ALL PASS.
- Deployed and confirmed by /health: relay `auth-37-cap-disposable-only`,
  docx-worker `1.14.172-cph-render-flags`.

## Still open

- The Copenhagen spec's remaining JUDGMENT items are owner-locked by design (band
  radius 22px, panel insets, photo size) - not bugs.
- 2656 (zh) renders 4 pages; 2712 Novo has no recoverable JD (owner must
  re-paste). Both predate this session.
