# AntCV nightly run — 2026-07-04 (local antcv-nightly AND cloud Routine; MULTI-MODEL)

Autonomous maintenance run on `C:\Users\karpg\GitHub\AntCV` (cloud Routine: the repo clone).
Owner: Gabriel. Style: direct, compressed, no filler.
Shipped at dispatch: PWA **1.51.124** · docx-worker **wk 1.14.132** · access-relay **1.3.3/auth-26** ·
proxy **3.7.1** · suite **916/916** · session 2026-07-03 night shipped 1.51.119-124 (orphan v3, slogan-fresh,
sidebar-relevance-cut, scholar/AntCV links, brandfit sampler, 277 sequence guard + CL hydrate gate).

## MULTI-MODEL DISPATCH (owner 2026-07-03: "allow other models to run tasks")

Every task below is SELF-CONTAINED (context, files, verify steps) so ANY capable model may execute it —
Opus-class, Sonnet-class, the cloud Routine's default, or parallel subagent sessions. Rules:
- One task per session/agent; parallel sessions use **separate git worktrees** (memory:
  template-derive-and-worktree-contention — single-line app.js edits conflict; re-apply on latest base).
- SYNC FIRST in every session; the LAST session to push rebases onto the others' work.
- Cheaper models take the MECHANICAL tasks (T5 sweep verification, harness re-runs, doc reconcile);
  bundle-splicing tasks (app.js/app.src.js mirrors) and worker changes go to the strongest available model.
- A task a model cannot finish safely is REPORTED half-done with findings — never half-pushed.
  Suite green (`node scripts/run-tests.mjs pwa`) + boot-smoke before EVERY push, no exceptions.

## Hard rules (violating any = failed run)
1. **SYNC FIRST**: `git fetch origin && git pull --rebase origin main` before any edit. NEVER force-push.
2. **Verify-first / diagnostic-first**: every row gets a repro or test BEFORE a fix (registry rows are often
   already shipped). No speculative surgery (CLAUDE.md).
3. **Cache-bust quintet** on every pwa asset change: `?v=` lines in index.html (incl. version-override's OWN
   line + docx-client's module import when touched) + sw.js CACHE + TARGET_VERSION + STALE_VERSIONS
   (append PREVIOUS, never current) + ANTCV_VERSION seed.
4. `pwa/app.js` is minified-sacred: surgical in-place edits mirrored to app.src.js (names DIFFER — anchor on
   string literals), authored via Write/node scripts (NEVER bash/python heredocs — backslash-eating shipped
   bugs twice), parse-gated with `new vm.Script`. No esbuild rebuild. `__antcvSalmon` is PERMANENT.
5. Suite via the CANONICAL runner only + `node pwa/test/boot-smoke.mjs` when app.js changed. Workers deploy
   via `gh workflow run deploy.yml -f target=<worker> -f mode=deploy -f confirm=<worker>`; curl /health after.
6. Flagship gen model stays claude-opus-4-7; propose changes with evidence only.
7. Register every fix in docs/qa/ACTIVE_BUGS.md + advance docs/qa/OPEN_REGISTER.md; measure content fixes on
   FRESH generations (spec rule 38, the 97.5% loop) — hand-guided exports prove nothing.

## T1 — Row 33 EXPORT-ALIGN-PARITY (button-audit findings; highest-confidence fixes)
(a) NAME-ALIGN: verify with a payload diff — set `antcv:nameLineAlign='center'` in a vm/browser store, call
`buildPayload`, inspect `header_align.name`. If absent: read the key in docx-client as the header_align.name
fallback (sanitize left|center|right). Test in pwa/test/unit/.
(b) HEADLINE-ALIGN: `antcv.sectionHeadlineAlignment.v1` (map by sid, antcv-section-panel-211.js) is
preview-only. Forward a `headline_align` map on each section in buildPayload; worker `headingParagraph`
honors it (alignment param) — worker bump + deploy + real-PDF spot check. Same family as
WHY-RULE-EXPORT-PARITY-001 (1.51.64) — mirror its test shape.

## T2 — Row 29 leg C: app-row auto-save downgrade belt + poisoned-row repair
The auto-commit that saves the active application row must never persist a meta whose company is a
DOWNGRADE (real → empty/Unsolicited) into a row whose saved meta/display name carries a real company; and a
one-time repair pass sets a poisoned row's meta from its own display name. app.js auto-save territory —
find the row-save writer (probe: search app.src.js for the application-row upsert; the row display name is
the stable truth). Diagnostic-first: reproduce with a poisoned fixture row before patching. Low residual
risk now (writers killed 1.51.105/108, round-trip window closed 1.51.124) — belt-and-suspenders.

## T3 — Row 23 button-audit pass 2 + payload-diff leg (standing)
Re-run `node pwa/test/diag-panel-button-audit.mjs`; diff against docs/qa/PANEL_BUTTON_AUDIT_2026-07-03.*.
Extend the harness: (a) re-open menus so the 65 "not-visible" entries get clicked (track the opener that
revealed each button and re-click it before the target); (b) per-control-family PAYLOAD DIFF — for CJLR /
roller / colour families: click, then call buildPayload in-page and diff against the pre-click payload; a
control whose store write never moves the payload is a row-33-class bug. The 11 dangerous-labelled buttons
stay owner-present-only.

## T4 — Row 26 remainder: owner gold-text for Instruments / Lab & fabrication
ONLY after checking interplay with 1.51.121 (sidebar-relevance-cut) + 1.51.119 (packing) on the CURRENT
tree: encode the owner's exact gold strings as deterministic compression rules in the compress path
(rich_block — never convert): Instruments → "Optical benches, HRSEM, confocal imaging, interferometry,
Raman spectroscopy, probe stations" (HRSEM only, drop SEM when tight); Lab & fabrication ends "…SOI
MEMS/NEMS" (no trailing "fabrication"). Name-guard to Gabriel's kernel data (persona-contamination rule).
Preview+PDF parity.

## T5 — Register staleness sweep (NIGHTLY_BACKLOG_RECONCILE slot — good task for a cheaper model)
Oldest `verified: no` rows: 1 (quick-gen page convergence), 9 (cluster worker pipeline), 14 (JD-scan
needs-models leg), 16 (align-flap re-check post-1.51.94), 17 (sweep-army burst cost), 18 (Anita residuals).
Verify each against the CURRENT code (repro or test), close-with-evidence or refresh the row + set
verified date. A run that only closes two stale rows properly is a GOOD run.

## T6 — Row 30: image-aware ee() routing
`ee()` must filter vision-blind providers (mistral) from the ladder when messages contain image content
blocks, instead of per-call-site preferGPT pins (1.51.102); consider extending the output-adequacy gate to
vision extraction calls. app.src.js+app.js mirror work — strongest model only; lock with both-bundle tests
like jd-extract-hardening.test.mjs.

## T7 — Row 32: CL-PLATFORM-SIGNALS gen rule
From the owner's CTO-exchange guidance (docs/qa register row 32 + "LinkedIn Message Improvement.pdf" in
Downloads): a gen-prompt rule gated on platform-class JDs (platform|modular|reuse|product famil...) —
platform-thinking content signals, curiosity tone, buzzword bans (innovation/cutting-edge/world-class),
camera/LiDAR/tracking/EO positioning woven naturally. Injection chain precedent: __clusterRule/__brandFitRule
(app.src.js ~24519). Both-bundle splice + byte-parity lock test.

## T8 — Rows 25 / 22 / 20 (owner-gated — prep only, do not force)
Row 25 TABLE-GEOMETRY-PARITY needs measurement in a REAL CloudConvert PDF (drive the live docx-worker
/generate-pdf with a fixture payload if credentials reachable; else prep the fixture + measurement script).
Row 22 phase 2 (CL slogan as real rich_block section): SPEC FIRST in a doc — double-render hazard, three
render sites + worker; do not splice without the spec. Row 20/owner-eye items: list them in the report for
the owner's morning pass (incl. tonight's: Trackman sidebar cut + slogan drop + re-export orphans; 🎨 NIL
brand sample; research-JD Scholar link clickability).

## Report
`docs/qa/NIGHTLY_2026-07-04_REPORT.md`: per task — findings, fixes (versions), evidence, what moved in the
register; the owner-verify list; which model ran which task (multi-model accounting).
