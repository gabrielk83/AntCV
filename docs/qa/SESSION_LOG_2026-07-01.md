# AntCV — Session log — 2026-07-01 (nightly autonomous)

PWA **1.51.27 → 1.51.28** · docx-worker 1.14.110 (untouched) · suite **529/529 → 543/543**.

Worked the CURRENT BACKLOG (owner re-review 2026-07-01) — the three convergence / restore-reliability
failures the owner flagged (*"the way you push from memory is nok"*). Diagnosis fanned out to three
parallel subagents (disjoint files); integration + verification kept strictly serial. All three fixes
are guard/repair-logic in plain sidecars — **no `app.js` mirror**, so no minified-shadow hazard.

## CLOSED this run (guards shipped 1.51.28, node-sim verified)

- **CV-CORECOMP-BLANK-001 (#2)** — CORE COMPETENCIES rendered the me() skeleton placeholder rows after a
  generation. Diagnosed: NOT the lamination writer (always real-or-empty) nor the min-sections floor
  (needs a fully-empty husk); the bracket rows come from the stale cloud/me()-enforce restore clobbering
  the laminated `sections`, and there is no `personalInfo.core_comp_rows` to repair from. **Fix:** new
  sidecar `pwa/antcv-corecomp-loss-guard.js` — last-good snapshot/restore keyed per application, mirrors
  `antcv-cl-prose-loss-guard-985`. Only ever replaces a placeholder-only/header-only table with a real
  snapshot; never overwrites real, never crosses apps; kill-switch `antcv:disable-corecomp-guard`.
  **Verified:** `pwa/test/unit/corecomp-loss-guard.test.mjs` (6 tests — snapshot, restore of
  placeholder-only + header-only, no-op over real, no cross-app bleed, kill switch).
- **CL-BLANK-001 (#4)** — CL prose came back mostly blank on first generation. **Root cause:** the
  loss-guard's `proseOf` used `it.t || it.b`, so an empty-body-but-labelled rich_block
  (`{b:"Who I am", t:""}`) read as "real" via the surviving lead label and defeated restore. **Fix:**
  `pwa/antcv-cl-prose-loss-guard-985.js` `proseOf` now reads the BODY (`it.t`) only. The existing
  placeholder←real restore then fires on an empty body. **Verified:**
  `pwa/test/unit/cl-prose-loss-guard-empty-body.test.mjs` (3 tests; test B is the regression proof —
  fails on the old `it.t||it.b`, passes now).
- **CV-ACCESS-DROP-001 (#7)** — ACCESSIBILITY present on gen 1, gone on gen 2. **Root cause:**
  `repairAccessibilityFromPI` (415) dead-ended on `idx<0 return null` — it could only repair an existing
  section, not create one. On gen-2 the LLM routes accessibility into ADDITIONAL and ships no standalone
  section, so the repair no-op'd and the section vanished. Confirmed `personalInfo.accessibility` is NOT
  nulled by gen-2 (it is owner-entered data; the apply path writes `sections`, never PI). **Fix:** when
  the section is absent but PI holds a real line, CREATE it at the canonical sidebar position (after
  interests/languages). Runs before `explodeAdditionalToSections`, which then drops the duplicate
  ADDITIONAL row via `sectionHasContent`. Never creates an empty section. **Verified:**
  `pwa/test/unit/repair-accessibility-from-pi.test.mjs` (5 tests — create-when-absent, repair-in-place,
  no-op-on-real, no-empty-section on empty/placeholder PI).

Cache-bust quintet done for 1.51.28 (index.html `?v` on the 3 changed loaded files + ANTCV_VERSION seed
+ version-override own `?v`; sw.js CACHE; version-override TARGET 1.51.28 + STALE += 1.51.27). Full
suite 543/543; boot-smoke `glDemo=function, errors=0`.

## OPEN (carry forward)

- **Real-cycle convergence — owner-verify-pending (all three above).** Node simulation proves the
  guard/repair LOGIC heals a blank/dropped-section blob, but a real LLM generate→gate→worker→sync cycle
  cannot be reproduced headlessly. Next concrete step: owner regenerates a CV+CL once and confirms
  core_comp is populated, the CL prose is non-blank, and ACCESSIBILITY survives a 2nd generation — all
  in ONE pass (no 2–3× regenerate). If a case still slips, capture `localStorage.sections` +
  `personalInfo` at the failure for a targeted follow-up.
- **Deferred feature batch** (unchanged, after convergence): editable CL slogan section; 3-state
  What-I-Bring lead show/hide/monochrome; sign-off pinned to page bottom; refresh exportable DOCX+JSON
  templates to match me(); CV orphan tails (20–40 char); Strategic-Expertise cell overflow (worker table
  width); zoom 5% step + export-preview default 75%.
- **Worker deploy:** none needed this run (all changes are PWA sidecars; docx-worker 1.14.110 unchanged).

## Parallelised vs serial

- **Parallel:** three diagnosis subagents (CV-CORECOMP / CL-BLANK / CV-ACCESS), one per disjoint file,
  each returning an exact fix + a node test.
- **Serial:** all integration, the full-suite run after each, the single cache-bust quintet, and the one
  commit/push — one deployer, one version bump (1.51.28), the tight named bundle the owner prefers.
