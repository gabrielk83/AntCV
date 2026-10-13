# CI Nightly report — 2026-10-13 (GitHub Actions, unattended, Opus 4.8)

**Run type:** Band-E E1 register staleness sweep. No code shipped.
**HEAD:** `bbed0033` (SYNC FIRST clean — `git fetch && git pull --rebase origin main` already up to date).
**Suite:** 1821/1821 green (`node scripts/run-tests.mjs pwa`, 0 fail); `check-register.mjs` OK.
**Environment:** `ALLOW_DEPLOY=false`, no in-app Browser pane, no signed-in session. Bands A–D stay
blocked on live/device/owner/real-model gates CI cannot clear.

## E1 — 5 stalest rows (all last swept 2026-10-03), re-verified against HEAD and refreshed to 2026-10-13

| # | ID | Verdict | Evidence |
|---|---|---|---|
| 49 | SIDEBAR-GROUP-PAGE-BREAK-001 | NOT-STARTED (as scoped) | `(CONT.)` continuation is still SECTION-level only: `CONT_SUFFIX` at `workers/docx-worker/src/index.js:24658`, section headline re-emit at :26472. No per-GROUP break within a sidebar labeled-list section. The worker DID change since the last verify (e69e15c6 enriched closing-table "(Cont.)" 1.51.4873; acc0d333 theme tables, #376) but both touch the MAIN/closing-table path, not the sidebar group break this row tracks. `cantSplit` [12 refs] + `sidebar_ratio` [2 refs] still section-level. `diag-twocol-paged.mjs` green — no regression in the distribution path. |
| 53 | CROSS-APP-EXPORT-CONTAMINATION-001 | leg (a) SHIPPED; b–f OPEN | MIRROR-LOAD-001 marker present **2×** in `pwa/app.src.js`; retired `antcv-export-app-scope-guard` still **0 refs** in `pwa/index.html` (dead on disk). Legs (b) CL English lead-ins, (c) unrendered placeholders, (d) Danish diacritics, (e) CV partial-lang residue, (f) brand-fit — unchanged/OPEN, all content/gen-quality, live-gen-gated. |
| 54 | GEN-JD-TAILOR-KERNEL-RECALL-001 | NOT started | `grep -rl KERNEL-RECALL pwa/ workers/` → nothing; no commits on the ID. Targeted gen still re-ranks the narrowed set without recalling JD-relevant kernel items (military comms service, Pan Idræt). Content-quality; needs a real targeted LLM gen. |
| 55 | TARGETED-OUTPUT-FURNITURE-001 | NOT started | `grep -rl TARGETED-OUTPUT-FURNITURE pwa/ workers/` → nothing; no commits. All six furniture legs (a–f) hand-fixed only. Legs b/e/f are codeable template transforms but live in the docx export path → PR + live export verify this run can't do. |
| 56 | GEN-JD-RELEVANCE-TRIM-001 | NOT started | `grep -rl RELEVANCE-TRIM pwa/ workers/` → nothing; no commits. Targeted CV still doesn't relevance-gate per-role bullets / hide irrelevant tools. Sibling of row 54. |

All five CODE-INTACT / NOT-STARTED-as-scoped; kept ACTIVE on their live/owner/real-model gates.

## Gates before push
- Suite 1821/1821; `check-register.mjs` OK.
- Docs/registers only → no cache-bust quintet, no version consumed, no shift claim, no PR owed.

## Owed to a desktop / owner run
- **Row 49:** dedicated diagnostic-first session with a real long-group export (render + worker
  deploy) — highest-risk area, not a speculative unattended patch.
- **Rows 53(b–f) / 54 / 56:** real targeted LLM generation to verify any content-quality fix.
- **Row 55:** a PR plus a live export verify for the codeable legs (b fixed-label localization,
  e merged-role title order, f AI-notice localization).

## Post-deploy live-verify owed
None — no PWA/worker change shipped this run.
