# AntCV — Session log — 2026-07-01 (two parallel autonomous runs, merged)

## ADDENDUM — owner live-export review (interactive, PWA 1.51.30 + 1.51.31)

Owner tested the real 1.51.29 export and reported the convergence guards did NOT fully land:
accessibility in panel+PDF but not preview; core_comp still placeholder; CL mostly empty — "all
require a 2nd generation to fix." Diagnosed on the owner's LIVE localStorage (Chrome MCP, unsolicited
doc, `meta` empty). Findings + fixes:

- **CORE COMPETENCIES was PARTIAL** — 2 real rows (Optics, Imaging) + 2 literal `[Focus area 5/6]`
  placeholder rows. The 1.51.28 guard's `isReal` (≥1 real row) passed the whole table as real, so it
  neither cleaned nor healed — and it snapshotted the placeholders. **Fixed 1.51.30:** row-level
  placeholder-aware guard — drops placeholder rows when the table has real rows, snapshots CLEAN rows
  only. 8 tests.
- **CL who/why/opening/contribute EMPTY; bring-intro + closure = literal me() template.** Read the
  deployed app.js CL apply: it is CORRECT (hard neutral fallbacks; `__clReal` present, minified `i`).
  Live who/why/opening exactly match the EMPTY Nordic me() skeleton while foundation holds real
  generated prose → a stale cloud/me()-enforce restore reverts the `.content`-applied sections
  (who/why/opening/contribute) to the empty skeleton on the FIRST gen, before the 400ms-debounced
  loss-guard snapshot ran. foundation/bring survive because they apply as DIRECT rich_block items.
  **Fixed 1.51.31:** loss-guard snapshots SYNCHRONOUSLY on `sections-updated` so real prose is captured
  the instant it appears, before the clobber. Additive + idempotent. 3 tests.
- **ACCESSIBILITY** — correct in localStorage (loc:sidebar, real content) + in the PDF; "not in
  preview" is a render nuance, not data loss. Deprioritised (browser tab flaky). Carry forward.

**Owner-verify (can't repro an LLM generate→stale-restore headlessly):** reload to 1.51.31, regen the
unsolicited CL ONCE, confirm who/why/opening survive + core_comp shows no `[Focus area N]`. If CL still
blanks, the clobber is fully synchronous with the apply → move the fix into the app.js apply path
(write prose to `items[0].t` directly, like foundation) — also needs a live regen to verify. Suite 556/556.

---

PWA **1.51.27 → 1.51.29** · docx-worker 1.14.110 (untouched) · suite **529/529 → 543/543** (pending
final re-run after merge, see note at bottom).

**Two independent sessions worked the SAME CURRENT BACKLOG concurrently** (the nightly cloud
routine + a desktop/second cloud run — see `CLAUDE.md`'s "Sync discipline" section, which exists
precisely for this scenario) and both pushed to `main` around the same time, both landing on
`1.51.28`. Per the sync discipline, the second push rebased onto the first rather than
force-overwriting it. Both sessions diagnosed the same three convergence/restore-reliability
failures the owner flagged 2026-07-01 (*"the way you push from memory is nok"* — a single
generation intermittently drops CORE COMPETENCIES, cover-letter prose, or Accessibility, forcing
2-3 regenerations) and — working from different angles, neither aware of the other — landed
**complementary, non-overlapping fixes for every item**. Both are kept; nothing was reverted.
Final version after the merge: **1.51.29**.

## CLOSED this run (both layers, per item)

- **CV-CORECOMP-BLANK-001 (#2).**
  - *Guard layer* (first push): new sidecar `pwa/antcv-corecomp-loss-guard.js` — last-good
    snapshot/restore keyed per application, mirrors `antcv-cl-prose-loss-guard-985.js`. Snapshots
    real CORE COMPETENCIES rows to a local-only key; restores them when a later state shows
    placeholder-only/header-only rows. Never overwrites real data, never crosses applications,
    kill-switch `antcv:disable-corecomp-guard`. Diagnosed the bracket rows as coming from a stale
    cloud/me()-enforce restore clobbering the laminated `sections` (not the lamination writer,
    which is always real-or-empty, and not the min-sections floor, which needs a fully-empty
    husk). 6 unit tests (`pwa/test/unit/corecomp-loss-guard.test.mjs`).
  - *Root-cause layer* (second push): `app.src.js`'s `core_comp_rows` apply (~line 25076) had no
    "keep the existing real rows" fallback rung, unlike its sibling fields (`profile`/`work_style`
    fall back to `a(e.content)`, the PREVIOUS section value, before defaulting to empty). An LLM
    response with no `core_comp_rows` and no kernel-fallback data wiped the table to header-only on
    a regeneration even when the prior real rows were sitting right there. Fixed the apply-path
    fallback chain, mirrored 1:1 into the minified `app.js` (occurrence-count-guarded string
    replace, `node --check` clean, starts with `(()=>{`, zero `"use strict"`). A duplicate
    guard originally added to `antcv-sections-normalize-415.js` for the same purpose was removed
    during the merge — `antcv-corecomp-loss-guard.js` already owns that job; keeping two
    independent guards racing on the same `antcv:coreCompGuard` key was pure redundancy, not
    defense in depth.
- **CL-BLANK-001 (#4).**
  - *Detection-layer fix* (first push): `antcv-cl-prose-loss-guard-985.js`'s `proseOf` now tests
    the BODY (`it.t`) only, ignoring the lead label `it.b`. An empty-body-but-labelled rich_block
    (`{b:"Who I am", t:""}`) previously read as "real" via `it.t||it.b`, which defeated the
    existing placeholder←real restore. 3 unit tests
    (`pwa/test/unit/cl-prose-loss-guard-empty-body.test.mjs`; one is a regression proof that fails
    on the old `it.t||it.b` and passes now).
  - *Apply-path fix* (second push): `foundation.hands_on`, `foundation.professionally`,
    `closure.content`, and `opening.content` used the narrower `a()` placeholder-stripper (matches
    only a short single bracket-block with no nested `]`, OR one containing an em-dash/`--`)
    instead of the broader `__clReal()` (strips anything starting with `[`) that `who`/`why`/
    `contribute` were already fixed to use (CL-EMPTY-BODY-FIELDS-001, an earlier session). The
    Nordic template's CLOSURE placeholder has NESTED brackets (`[Company]`, `[position/
    department]`, `[relevant scope]`) and only single hyphens — defeating both of `a()`'s branches
    — so it leaked verbatim into the saved section on a generation that returned no
    `closure_content`; the export then detects the leading `[` and blanks/drops the section, which
    reads as "the cover letter is blank". Switched all four fields to `__clReal()` in `app.src.js`,
    mirrored to `app.js`. 5 unit tests (`pwa/test/unit/cl-apply-placeholder-strip.test.mjs`),
    including a source-fixture check and a regression lock against the apply-path source.
- **CV-ACCESS-DROP-001 (#7).**
  - *Section-creation fix* (first push): `repairAccessibilityFromPI` (415) no longer dead-ends on
    `idx<0` — it could previously only repair an EXISTING section, not create one. On gen-2 the LLM
    routes accessibility into ADDITIONAL and ships no standalone section, so the repair was a no-op
    and the section vanished from the CV. Now, when the section is absent but
    `personalInfo.accessibility` holds a real line, it CREATES the section at the canonical sidebar
    position (after interests/languages), before `explodeAdditionalToSections` runs (which then
    drops the duplicate ADDITIONAL row via `sectionHasContent`). Never creates an empty section.
    5 unit tests (`pwa/test/unit/repair-accessibility-from-pi.test.mjs`).
  - *Source-of-truth fix* (second push): `pwa/antcv-generate-cloud-sync-277.js`'s Generate-button
    click gate does a PUT-then-GET cloud sync; the GET's `personalInfo` handling did a wholesale
    `localStorage.setItem('personalInfo', JSON.stringify(body.personalInfo))` REPLACE. PUT
    failures are swallowed to a `console.debug` so the user is never blocked, but the GET still
    runs regardless — so a failed PUT (network/auth/race) meant the GET clobbered every local-only
    field, including `accessibility` itself, with a stale cloud snapshot (independent of whether
    the CV *section* existed). Changed to a local-preferring MERGE (a real, non-empty local value
    always wins; cloud only fills a field the local copy is missing), matching the pattern already
    used by `antcv-personal-info-cloud-restore-282.js` / `antcv-load-from-cloud-personal-info-hook-
    283.js`. 3 unit tests (`pwa/test/unit/generate-cloud-sync-pi-merge.test.mjs`).

Both runs: syntax-checked, cache-bust quintet completed for their respective push, full suite
green at push time (543/543 and 542/542 respectively — the merge target is 1.51.29 with all tests
from both runs combined, re-verify count below). Neither run could drive a real LLM generation or
a signed-in browser (`unpkg.com`/CDN blocked or no browser session in the cloud sandbox on both
sides) — `pwa/test/boot-smoke.mjs` could not be used as a gate on the second push for that reason;
`node --check` + the `(()=>{`/no-`"use strict"` invariant + targeted `node:vm` unit tests stood in
for it.

## OPEN (carry forward)

- **Real-cycle convergence — owner-verify-pending (all three items above, all layers).** Node
  simulation proves each guard/repair/apply-path fix heals its specific failure mode in isolation,
  but a real LLM generate→gate→worker→sync cycle cannot be reproduced headlessly. Next concrete
  step: owner (or a signed-in desktop session) runs one generate→regenerate cycle — ideally a 2nd
  generation on the same application — and confirms CORE COMPETENCIES keeps its rows, the CL prose
  (especially CLOSURE/FOUNDATION) is non-blank, and ACCESSIBILITY survives, all in ONE pass. If a
  case still slips, capture `localStorage.sections` + `personalInfo` at the failure for a targeted
  follow-up — six independent fix-layers now cover the failure modes each session could find
  statically, but a live cycle may surface a seventh.
- **Deferred feature batch** (unchanged, after convergence): editable CL slogan section; 3-state
  What-I-Bring lead show/hide/monochrome toggle; sign-off pinned to page bottom (except a
  recruiter-Q&A last page); refresh the exportable DOCX + JSON templates to match current me(); CV
  orphan tails (20-40 char) in bullets/sidebar lists/table cells; Strategic-Expertise cell overflow
  (worker table width); zoom 5% step + export-preview default 75%.
- **Worker deploy check.** No worker code changed by either run (docx-worker/access-relay/proxy
  untouched), so no `deploy.yml` run was needed.
- **Two-runs-same-backlog is a process signal, not just a merge chore.** Both the desktop/first
  cloud run and this cloud run picked up the identical CURRENT BACKLOG from
  `docs/qa/CLOUD_ROUTINE_PROMPT.md` within the same window and neither saw the other's in-flight
  work (expected — they're separate sessions). The sync discipline (fetch/rebase before push,
  never force) is what made the collision harmless instead of a lost-work incident. No process
  change needed, just noting it for the record.

## Cache-bust / version record

First push bumped 1.51.27 → 1.51.28 (index.html `?v` on 3 changed loaded files + ANTCV_VERSION
seed + version-override's own `?v`; sw.js CACHE; version-override TARGET 1.51.28, STALE +=
1.51.27). This merge bumps 1.51.28 → **1.51.29** for the second push's additional changed files
(`app.js`, `antcv-generate-cloud-sync-277.js`) plus the version files touched again by the rebase
resolution: `pwa/index.html` (`app.js?v`, `antcv-sections-normalize-415.js?v`,
`antcv-version-override.js?v` × 2, `window.ANTCV_VERSION` seed), `pwa/sw.js` `CACHE`,
`pwa/antcv-version-override.js` `TARGET_VERSION` (+ added `'1.51.28'` to `STALE_VERSIONS`, not the
new version), `pwa/antcv-generate-cloud-sync-277.js`'s own independent `1.40.278` scheme.
`node scripts/check-cache-bust.mjs --range origin/main..HEAD` gates this before push.
