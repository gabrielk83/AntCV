# AntCV CI Cloud Nightly — 2026-10-03

**Runner:** GitHub Actions (unattended), Opus 4.8. **Repo:** gabrielk83/AntCV. **Base:** `main` @ `6d6dfbe3` (synced clean; `git fetch && git pull --rebase origin main` already up to date).

## Constraints this run (CI safety override)
- `ALLOW_DEPLOY=false` → no worker deploys.
- No signed-in browser / no in-app Browser pane → no live `antcv.pages.dev` verify.
- No live LLM provider key → no real CV/CL generation.
- Playwright not installed → no headless render / salmon diag.
- `pwa/app.js`, `pwa/app.src.js`, `workers/**` → PR-only for owner review. Docs/registers → direct to main.

## Gates
- `node scripts/run-tests.mjs pwa` → **1784/1784 pass**, exit 0.
- `node --test workers/docx-worker/test/main-column-ratio-width.test.mjs` → **1/1 pass** (row 2 regression lock).
- `node scripts/check-register.mjs` → **OK — 95 ACTIVE rows, 95 detail sections**.

## Band E1 — register staleness sweep (never-skipped standing slot)
Took the 6 stalest `verified:` rows in `OPEN_REGISTER.md` (two at 2026-09-21, four at 2026-09-22),
verified each verify-first against current code at HEAD `6d6dfbe3`, refreshed all to 2026-10-03.

| Row | ID | Finding this run | Status |
|---|---|---|---|
| 2 | LINKIFY-EXPORT-001 | Worker `sidebar_ratio` derivation intact (`index.js` `__sbRatio` ~24673, `ctx.mainW`-based widths); regression lock test re-run **1/1 PASS**; SCHOLAR-LINK/LINKIFY code present in `antcv-docx-client.js` + `antcv-scholar-links.js`. Content+bullets/hyperlink legs CLOSED-locked; residual = per-line font-metric fidelity → folds into row 25 (real-PDF-gated). | No regression. Refreshed. |
| 49 | SIDEBAR-GROUP-PAGE-BREAK-001 | docx-worker page-distribution algorithm unchanged; a long focus-area group can still orphan/truncate instead of carrying under "(CONT.)". Owner-authorized design work in the project's highest-risk area; needs a dedicated diagnostic-first session with a real long-group export + worker deploy (CI has neither). | Not started (scoped). Refreshed. |
| 53 | CROSS-APP-EXPORT-CONTAMINATION-001 | Leg (a) still SHIPPED via MIRROR-LOAD-001 — marker ×2 in `app.src.js`; retired `antcv-export-app-scope-guard` 0 refs in `index.html` (correctly dead). Legs b–f (CL lang leak, placeholders, diacritics, CV partial-lang residue, brand-fit) all content/gen-quality, live-gen-gated. | a shipped; b–f live-gated. Refreshed. |
| 54 | GEN-JD-TAILOR-KERNEL-RECALL-001 | `grep -rl KERNEL-RECALL pwa/ workers/` empty; no commits on ID. Targeted gen still re-ranks the narrowed set without recalling JD-relevant items from the unsolicited kernel. | Not started; needs real targeted gen to verify (owner/live-gated). Refreshed. |
| 55 | TARGETED-OUTPUT-FURNITURE-001 | No `TARGETED-OUTPUT-FURNITURE` markers; no commits on ID. Six furniture legs hand-fixed only. Legs b/e/f are deterministic transforms that COULD be coded, but they live in the docx export path → PR + live export verify this run cannot do; not shipped speculatively (owner "no brickable mid-product"). | Not started; owner/live-gated. Refreshed. |
| 56 | GEN-JD-RELEVANCE-TRIM-001 | No `RELEVANCE-TRIM` markers; no commits on ID. Targeted CV still doesn't relevance-gate per-role bullets / hide irrelevant tools. | Not started; needs real targeted gen (owner/live-gated). Refreshed. |

## Shipped
Nothing. Every item in the stalest set is blocked on a capability this cloud CI run lacks — a
signed-in browser, a live LLM generation, or a worker deploy. Per the owner's hard rule ("an end
result, not a brickable mid-product — one solid verified fix beats several half-verified ones"),
no speculative export-furniture surgery was pushed that could not be live-verified.

## Owner / desktop follow-ups owed
- **Rows 54 / 55 / 56 / 53(b–f):** need a real targeted LLM generation (desktop or signed-in) to
  verify any fix — the fixes are content/gen-quality, not statically verifiable.
- **Row 49:** dedicated diagnostic-first docx-worker session with a real long-group export +
  worker deploy.
- **Row 2:** only residual is real-PDF table/line font-metric fidelity, tracked under row 25.
- **No post-deploy live-verify owed** — this run shipped no PWA/worker change.

## Register edits pushed with this report
- `OPEN_REGISTER.md` — 6 index `verified:` dates → 2026-10-03.
- `REGISTER_ACTIVE_DETAIL.md` — dated 2026-10-03 verify-first entries on rows 2, 49, 53, 54, 55, 56.
- `REGISTER_RUNLOG.md` — run summary at top.
- This report.
