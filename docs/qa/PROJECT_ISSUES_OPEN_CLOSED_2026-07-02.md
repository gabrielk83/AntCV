# AntCV — Open / Closed issues — 2026-07-02 (corrections session, branch fix/role-dedup-canon → main)

State at end of session: **PWA 1.51.41** (merged to `main`, auto-deploying) · docx-worker **1.14.116**
(unchanged this session) · access-relay **1.3.2** code + **D1-WRITE-RETRY-001** (committed, **NOT yet
deployed**) · suite **607/607**.

This session ran against the owner's **LIVE** signed-in app (Chrome MCP, `antcv.pages.dev`, same-origin
localStorage) + node tests. Worked in an isolated git worktree (`.claude/worktrees/role-dedup`) because a
**second session** ran in parallel on branch `fix/focus-area-heading-ainotice`.

> **Parallel session:** the other session shipped (on `fix/focus-area-heading-ainotice`, **not yet merged
> to main**): **#4** AI-notice sidebar anchor (AI-NOTICE-SIDEBAR-ANCHOR-001, wk 1.14.117), **#5** focus-label
> EO truncation (FOCUS-LABEL-EO-001, 1.51.42), **#3b** inline-editable rich_block headings
> (SECTION-TITLE-INLINE-001, 1.51.43). Those need a rebase onto `main` (now 1.51.41) + version reconcile
> before merging.

---

## CLOSED this session (shipped to `main`, PWA 1.51.41)

| ID | Fix | Verified by |
|----|-----|-------------|
| **COMPANY-VARIANT-KEY-001** + **DROP-CANON-HIDDEN-DUP-001** (#2 role doubling) | Diagnosed on LIVE `localStorage.sections`: the "doubled" roles were **hidden (`on:false`)** dups carrying the PI long-form company beside the canon-shortened visible role. `repairExperienceCompleteness` re-created them every pass (raw `title\|company` key couldn't match a canon-shortened company). Fixed with variant-tolerant `_samePosition` (year span + title core); completeness no longer re-adds canon roles; `dropCanonHiddenDups` removes the existing 3; `dedupeRoles` company match variant-tolerant + keeps richer bullets. Voluntary-last / Rugby-before-Students-Council holds for the visible set once dups gone. | `pwa/test/role-dedup-canon.test.mjs` (5, real sidecar in a vm vs live roles) |
| **OVERLAY-EARLY-HALT-001** (#1 overlay halts mid-generation) | Owner: the unsolicited "1st-time" overlay closed partway ("keep it on ≥4 more minutes… you captured some halt in the middle"). Root cause: the KERNEL-STUCK showcase watchdog used a **fixed 2-min (`12e4`)** timer that fired during a normal 3–6 min gen. Now gated on the `__antcvGenCost` heartbeat — stays up while LLM cost moves; clears only after ~11 min idle (past the 10-min single-call cap) or a 20-min ceiling. UI-only; mirrored into minified app.js. | `pwa/test/overlay-watchdog-heartbeat.test.mjs` (6) + boot-smoke. **Needs one real regen to confirm.** |
| **GEN-CORECOMP-BROAD-001** (#1b unsolicited core-comp too narrow) | Unsolicited CORE COMPETENCIES came back niche ("EO & photonic sensors", "Imaging", "Materials & devices"). The unsolicited prompt block (`__neutralCo`) forced the PROFILE broad but said nothing about core_comp. Added a parallel rule: unsolicited Focus Areas must be the BROAD PdM/BA/process identity, not the EO/photonics niche. Mirrored byte-identical into app.js. | `pwa/test/unsolicited-corecomp-broad.test.mjs` (5). **Regen-gated.** |
| **D1-WRITE-RETRY-001** (#6 `d1_write_failed`) | Transient D1 write contention surfaced `d1_write_failed` during rapid kernel/prefs saves. Added a server-side `d1RunWithRetry` (50/100/200ms backoff, re-throws last error) around the four idempotent write sites (prefs, kernel, kernel-v2, application upsert). Server-side by design — avoids the client fetch-wrapper hazard. | `workers/access-relay/tests/d1-write-retry.test.mjs` (4). **Worker NOT deployed — needs a deploy slot.** |
| **#3 CL apply-path** — audited, **no code change** | The deployed `app.js` CL apply-path already has full guard parity: the `__clReal`/`i` placeholder guard, the `__realC` HWIC real-item guard, neutral who/why/contribute fallbacks, bring→table reset. No residual gap — the CL blanks are downstream of the #1 overlay halt. | direct app.js audit; memory `appjs-appsrc-contribute-divergence` marked reconciled |

---

## OPEN (carry forward)

1. **Verify #1 / #1b / #3 on ONE real owner regen** (not headlessly reproducible). Expected: the overlay
   stays up through the full 3–6 min; CORE COMPETENCIES comes back BROAD for an unsolicited draft;
   who/why/bring/contribute/closure all fill and both CL rules render + match on export.
2. **Deploy the access-relay worker (#6)** — the `D1-WRITE-RETRY-001` code is on `main` but the worker
   change only takes effect after `gh workflow run deploy.yml -f target=access-relay ...`. Do it in a free
   deploy slot (never in parallel with a docx-worker deploy).
3. **Merge the parallel session** (`fix/focus-area-heading-ainotice`, #4/#5/#3b at 1.51.42/43): rebase onto
   `main` (now 1.51.41) and reconcile the version files (bump above 1.51.43) before merging. Then deploy
   docx-worker for AI-NOTICE-SIDEBAR-ANCHOR-001 (wk 1.14.117) and confirm the AI-notice with a real
   CloudConvert PDF.
4. **Focus-area label content** (#5) — LLM-generated; the other session's FOCUS-LABEL-EO-001 canonicalises
   the post-process label. Confirm on a regen.

Prior open items (from `PROJECT_ISSUES_OPEN_CLOSED_2026-07-01.md`) not touched this session remain as
recorded there.

---

## Session mechanics
4 commits on `fix/role-dedup-canon`, fast-forwarded to `main` (e61ce27 → 116733b). PWA auto-deploys.
Cache-bust quintet at **1.51.41** (the branch is coherently one version; the other session took 1.51.42/43).
Suite 607/607; app.js `node --check` + boot-smoke green after every app.js edit. New tests:
`role-dedup-canon`, `overlay-watchdog-heartbeat`, `unsolicited-corecomp-broad`, `d1-write-retry`.
