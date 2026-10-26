# AntCV nightly — CI (unattended) 2026-10-26

**Environment:** GitHub Actions, Opus 4.8, fresh clone. HEAD on entry `8144ec77` (already
up to date after `git fetch origin && git pull --rebase origin main`). `ALLOW_DEPLOY=false`.
No in-app Browser pane, no signed-in session, no real-LLM / render / worker-deploy path.

## What ran

1. **SYNC FIRST** — clean, already up to date on `origin/main`.
2. **Suite** — `node scripts/run-tests.mjs pwa` → **1849/1849 pass, 0 fail**.
3. **Standing E1 staleness sweep** — `node scripts/check-register.mjs --stalest` surfaced the
   six stalest ACTIVE rows (all dated 2026-10-15). Each was re-verified against the cited code
   markers at HEAD `8144ec77`; all intact. Index `verified` dates and detail sections advanced
   to 2026-10-26.

## Rows re-verified (all markers intact, all kept ACTIVE)

| Row | ID | Marker check at HEAD 8144ec77 | Remainder (why not closed) |
|---|---|---|---|
| 62 | HEADER-BANNER-DESIGN-RULES-001 | `bodyTopBorder` 3 refs + `✉` 2 refs in `workers/docx-worker/src/index.js` | render-measure loop vs KOMBIT gold + two Track-C follow-ups; needs a real docx-worker render the owner eyeballs |
| 74 | JD-SWAP-STALE-RATIONALE-001 | `JD-SWAP-STALE-RATIONALE` 2 + `CL-GHOST-COMPANY` 5 = 7 in `app.src.js`; `cl-ghost-hunt.test.mjs` green | (C) BACKGROUND-STALL — SSE-stream throttle on a backgrounded tab; needs a live foreground generation |
| 69 | CL-POLISH v2 / systemic em-dash | `__AINOTICE` map (2) + `AI-assisted - author` hyphen footer (4) in docx-worker; no em-dash in the notice path | standing-rule anchor; the three CL rules captured in checklist §3 + memory |
| 67 | CV-CORECOMP-BLANK-001 | `antcv-cl-slogan-control.js` + `-element.js` both loaded by `index.html` | (A) convergence verify, (C) perf, (D) regen-gated, (E) unsolicited-gen — all need signed-in regen / real LLM |
| 40 | SO-003 (outcomes loss-guard) | `antcv-outcomes-loss-guard.js` present; `core-comp-format-preserves-outcomes.test.mjs` green | owner-verify: change core-comp row count, confirm Selected Outcomes survives (signed-in, cloud-persisted) |
| 18 | ANITA-PERSONA-NO-PHOTO-001 | persona `photo` data URL embedded; sibling-rewrap `app.src.js:37762` list `["photo","language","navyColor",…]` mirrored `app.js:165`; `import-rewrap-keeps-photo.test.mjs` green | CL foundation/bring/interests leg on a fresh Anita gen needs live models |

## Shipped / changed

Nothing code. No `pwa/` asset touched → no cache-bust, no version consumed, no shift claim.
Docs-only: `OPEN_REGISTER.md` (6 `verified` dates), `REGISTER_ACTIVE_DETAIL.md` (6 dated
re-verify entries), `REGISTER_RUNLOG.md` (run summary), this report.

## Not done / owed (environment-gated, not code-gated)

- Every row's remainder is live/owner/regen/worker-deploy gated. CI has no browser, no signed-in
  session, no real-LLM generation, and `ALLOW_DEPLOY=false` — none drivable here. Owed to a
  desktop run or an owner session.
- No PWA change shipped this run, so **no post-deploy live-verify is owed**.

## For the owner

Nothing new. The six swept rows are all SHIPPED code with live/regen/eyeball verification still
owed — unchanged in kind from the 2026-10-15 sweep.
