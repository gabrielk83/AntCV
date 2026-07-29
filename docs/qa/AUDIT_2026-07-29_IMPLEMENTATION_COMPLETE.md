# Implementation audit - 2026-07-29

Owner: "check if anything is not implemented, implement and update .md docs."
A full audit after the desktop arc of 2026-07-23..26. Result: **everything from
that arc is implemented, deployed and green.** One piece of PRE-EXISTING debt was
found and is characterised below - it was not introduced by that work.

## Gates - all green

| Gate | Result |
|---|---|
| `node scripts/run-tests.mjs pwa` | **1491 pass / 0 fail** |
| `node --test workers/access-relay/test/*.mjs` | **12 pass / 0 fail** |
| docx-worker diag sweep (every `diag-*.mjs`) | **0 red** |
| docx-worker deploy gates (palette, bundle-sync, banded-rows) | **17 pass** |
| `diag-copenhagen-stage4.mjs` | **ALL PASS** (26 checks) |
| `scripts/job-tracker/test_why_gate.py` | **ALL PASS** |
| `scripts/job-tracker/test_cv_fit_gates.py` | **ALL PASS** |

## Deployed matches source - verified by /health, not assumed

| Surface | Source | Deployed |
|---|---|---|
| access-relay | `auth-37-cap-disposable-only` | `auth-37-cap-disposable-only` |
| docx-worker | `1.14.172-cph-render-flags` | `1.14.172-cph-render-flags` |
| PWA | `1.51.3824-tracker-notes` | `1.51.3824-tracker-notes` |

Nothing is sitting un-deployed. The working tree is clean and synced with
`origin/main`.

## The one finding: 217 by-hand diag scripts, an unknown fraction stale

`pwa/test/` holds **217 `diag-*.mjs`** scripts alongside the 202 gated
`unit/*.test.mjs`. They are NOT part of any gate: `scripts/run-tests.mjs`
discovers only `*.test.mjs` / `*.test.js`, and its own header says the diag
scripts "are run by hand". Many were written to investigate a specific past bug
and assert a design that has since been superseded.

Sampled and classified (2026-07-29), all four STALE-BY-DESIGN, none a regression:

- `diag-additional-partition` - asserts LANGUAGES / INTERESTS / ACCESSIBILITY are
  GROUPS inside an "additional" section. The app renders them as discrete
  top-level sidebar sections now (the live preview in the same run shows exactly
  that), and the `additional` section itself ships `on:false`.
- `diag-cw-canon` - asserts a compressed canonical role title and a specific
  company string; the role-merge output has moved on. Its first and third checks
  still pass, so the diag is partly current - the classic half-stale shape.
- `diag-cl-format-panel` - asserts the slogan control is RE-PARENTED into the CL
  format panel; that panel arrangement was superseded.
- `diag-demo-toggle` - fails wholesale.

**This is pre-existing debt, not a regression.** It matters because a future
session that runs one of these by hand can mistake it for a live bug - which is
exactly what happened twice this week with the docx-worker diags, where all 9
reds turned out to be stale assertions superseded by documented changes.

### Triage recipe (the one that worked on all 9 worker diags)

For each red diag, before touching any product code:
1. Read what the assertion CLAIMS, then find the documented change that
   superseded it (register entry, spec doc, or the code comment naming the
   ticket - e.g. CL-SIGNOFF-ALIGN-001, CORECOMP-TABLE-CELL-PAD-001).
2. Capture the LIVE output and compare against that documented intent.
3. Check the fixture itself before believing the failure. Two real fixture bugs
   were found this week: sections carrying `text:` where the renderer reads
   `content:` (renders EMPTY, so a titled section emits no heading at all), and
   a selector counting every `button` in a pager including a non-numeric toggle.
4. Watch for gated sub-checks: one stale selector produced a phantom SECOND
   failure because the follow-on check was skipped, not run.
5. Mind the two OOXML colour syntaxes - a RUN colour is `<w:color w:val="X"/>`,
   a BORDER colour is inline `w:color="X"`. Matching the wrong one tests the
   wrong element.
6. Only after 1-5 point at the product, treat it as a real bug.

A full triage of the 217 is its own task and is deliberately NOT claimed as done
here. Filed as PWA-DIAG-BODY-STALE-001 in `ACTIVE_BUGS.md`.

## Cross-references

- Arc index: `SESSION_LOGS_INDEX_2026-07-23_TO_26.md`
- Copenhagen spec (Status section now accurate):
  `docs/design/COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md`
