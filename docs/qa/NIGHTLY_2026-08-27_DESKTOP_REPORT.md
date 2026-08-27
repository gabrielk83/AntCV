# AntCV nightly — 2026-08-27 (desktop, Opus 5)

Second run of the day. The CI nightly (GitHub Actions, Opus 4.8) had already taken the standing
Band E1 register staleness slot and pushed its result — see `NIGHTLY_2026-08-27_CI_REPORT.md`. It
ended by naming what it could not do from CI, and two of those items were owed to a desktop run:

- **row 94** `CONTENT-LANG-STAMP-001` — an `app.js` change, PR-gated under the CI safety override.
- **row 25** `TABLE-GEOMETRY-PARITY-001` — needs the real export pipeline.

This run took row 94 and shipped it end-to-end rather than starting a second staleness sweep over
rows the CI run had just dated. One solid verified fix over several half-fixes.

## Preflight / discipline

| gate | result |
|---|---|
| `routine-preflight start` | WORKSPACE CLEAN, worktree `elated-wilbur-b386b8` |
| SYNC FIRST | `git pull --rebase origin main` — fast-forwarded onto the CI run's `6fa6b5f` |
| shift lane | claimed `1.51.4446-1.51.4465` (`sh_mtb4o9g2_6sll`), one version consumed |
| baseline suite | `node scripts/run-tests.mjs pwa` — **1662 / 1662** |
| push | fast-forward to `main`, no force, linear history |

## Band E — row 94 `CONTENT-LANG-STAMP-001`: SHIPPED

**The gap, restated from the code.** `jd_language` is the JOB DESCRIPTION's language. The language
the CV/CL CONTENT is written in was persisted **nowhere**, so three consumers each re-derived it by
script-sniffing the sections: the app-switch/boot language selector, the babel-relang heal, and
export. A **Latin** document (en/da/es) falls outside the wide-script detector, which returns `""`,
so the selector fell through to `jd_language` and could pin a ribbon the content is NOT in — and
babel-relang, seeing content that disagrees with the ribbon, would LLM-re-translate a correctly
written document. Three heuristics, no authority.

**What shipped — one value, stamped once, read back.**

| part | change |
|---|---|
| D1 `ant_memory` | `ALTER TABLE application ADD COLUMN content_language TEXT`. Additive; the 76 existing rows carry NULL and use the old chain unchanged. |
| `workers/access-relay` | `shapeApplicationRow` returns the field; `PUT /api/applications/:id` whitelists it under the same undefined-skip / explicit-null-clears convention as every other field, accepting only the six languages the app renders — anything else is dropped rather than stored as garbage the selector would later act on. Deployed `676918b5`. |
| `pwa/app.js` + `app.src.js` — leg 1 (write) | Every writer of `cv_sections`/`cl_sections` reaches the server through **one** method, `oo.update()`. The stamp lives there, derived from the sections being written. Non-mutating; confident detections only; a partial write carrying no sections is left alone, so the stamp can never CLEAR a stored value. |
| `pwa/app.js` + `app.src.js` — leg 2 (read) | Both app-load sites read the stored stamp, ranked **below** the certain wide-script detect (`__cl`) and **above** the fuzzy Latin prose-ratio sniff. A stale stamp therefore cannot re-pin a document since translated into zh/he/am, while a correct stamp beats the heuristic that was getting it wrong. |

**Why `meta` was rejected as the home.** It is the JD-analysis object, rewritten wholesale from React
state on every auto-sync, and META-DOWNGRADE-GUARD-003 deliberately WITHHOLDS it when the row context
is unknown — exactly the mid-restore path where a language stamp matters most. A dedicated column is
the only place the value survives.

### Evidence

- **Tests** — `pwa/test/unit/content-lang-stamp.test.mjs`, **15**. The stamp expression is EXTRACTED
  from the shipped `app.js` bytes and executed, so a behaviour test cannot pass against a bundle that
  no longer carries the fix. Covers: stamps from cv or cl alone; leaves a sectionless partial write
  untouched; refuses `""`; drops `fr`/`de`/`xx`/`ENGLISH`/`null`; lets an explicit caller `null` (a
  deliberate clear) through; degrades to pass-through with no detector; all six languages round-trip;
  both load sites read the stamp; the three rungs asserted **in order** at each site; a stored
  `DA`/`da-DK` normalises while `fr`/NULL/`""` fall through; relay row-shape and whitelist locks.
- **Negative control** — deleting leg 2 from `app.js` turns **2** tests red; un-wiring leg 1 turns
  **1** red. Sabotage-then-restore, both directions proved.
- **Suite** — **1677 / 1677** (was 1662). `boot-smoke` → `glDemo=function, errors=0`.
  `diag-rerender-storm` renders past sign-in with **0 app errors**.
- **Bundle integrity** — `app.js` proved byte-identical to HEAD apart from the three intended
  insertions (EOL-normalised residual identity check), still starts `(()=>{`, no `"use strict"`.
- **Live** — relay `/health` green; the deployed bundle re-read from Cloudflare carries both legs;
  the exact `UPDATE application SET content_language = ?` the relay builds validated against the live
  schema (0 rows touched). PWA live on `antcv.pages.dev` at `1.51.4446-content-lang-stamp`:
  `window.ANTCV_VERSION`, `sw.js` CACHE, `TARGET_VERSION` and all six `?v` stamps in `index.html`
  confirmed, app boots with no JS errors (the three 401s are the expected unauthenticated relay calls
  at the sign-in gate).
- **Cache-bust quintet** — `app.js` `?v` + version-override's own `?v` + `sw.js` CACHE +
  `TARGET_VERSION` + `ANTCV_VERSION` seed, plus the three assets `hdr-type-controls.test.mjs` pins to
  the app.js version (`copenhagen-v2-001`, `pdf-preview-gate`, `docx-client`). `STALE_VERSIONS`
  gained the two PREVIOUS versions (`1.51.4406-import-photo`, `1.51.4426-joblist-closed-filter`),
  never the current one — invariant asserted by the patch script.

## Register coverage this run

The standing staleness sweep ran in CI earlier today and dated rows 38 / 76 / 82 / 94; this run did
not re-sweep them. Honest accounting rather than a status word per row:

| rows | status this run |
|---|---|
| **94** `CONTENT-LANG-STAMP-001` | **SHIPPED** (code leg). Kept ACTIVE for the owner's signed-in live verify. |
| **38, 76, 82** | Verified by the CI run earlier today; not re-examined here. |
| **25** `TABLE-GEOMETRY-PARITY-001` | Still owed. It is the stalest ACTIVE row (2026-07-02) and needs a real CloudConvert PDF measured against the preview — a desktop export-pipeline run, which this run spent on row 94 instead. **Next desktop run should take it.** |
| all other ACTIVE rows | Carry their existing sweep dates; not examined this run. |

Staleness census over the index (79 rows parsed by date column): **1** at 2026-07-02, **10** at
07-03, **4** at 07-04, **9** at 07-05, **10** at 07-07, **7** at 07-08, **8** at 07-13, the rest
newer. The July 03-08 block — 40 rows — is the real backlog; it is a staleness sweep's work, not a
fix run's.

## Registers updated (rule 7)

- `docs/qa/ACTIVE_BUGS.md` — new top block, `CONTENT-LANG-STAMP-001`.
- `docs/qa/OPEN_REGISTER.md` — row 94 scope line now reads CODE SHIPPED.
- `docs/qa/REGISTER_ACTIVE_DETAIL.md` — row 94 dated ship note above the CI verify note.
- `docs/qa/REGISTER_RUNLOG.md` — this run's summary at the top.
- `docs/FEATURES_REGISTRY.md` — new **FT-CONTENT-LANG-STAMP** row; `FT-CONTENT-LANG-SELECTOR`'s
  "prevention leg = row 94" pointer closed; header increment **40**.
- `scripts/check-register.mjs` gate: `register OK — 94 ACTIVE rows, 94 detail sections, index 16.5 KB`.

## Owner-owed

1. **Live verify row 94 (~2 min, needs a signed-in session — the one step headless cannot reach).**
   Open a Danish or Spanish application, translate it, reload, then switch away and back. The
   language button must hold the CONTENT's language and `[babel-relang] content not in …` must NOT
   appear in the console. Rows saved before today carry NULL and get their stamp on the next save.
2. Carried from the CI run, unchanged: row 82's es/zh role-canon wording eyeball; row 38's mobile
   A/B plus the decompose-approach decision (A vs B); row 25's real-PDF diagnosis.

## Owner-decision

None raised this run. Nothing in this change touches a model pin, a gen prompt, or a default flag.

## Notes for the next run

- The scheduled-task prompt still points at `docs/qa/NIGHTLY_2026-07-05_REPORT.md`. Recent runs write
  a dated report instead (`NIGHTLY_<date>_CI_REPORT.md` / `_DESKTOP_REPORT.md`), which is what the
  register run-log references. This file follows that convention.
- Two nightlies now land on the same date (CI + desktop). Reading the other one's report first is
  what kept this run from re-doing a sweep that had already happened.
