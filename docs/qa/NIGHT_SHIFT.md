# NIGHT SHIFT — live coordination ledger for parallel AntCV sessions

Two or more sessions (this desktop clone + the claude.ai cloud Routine + a second local
session) push to `origin/main`. Without coordination they collide: same version number,
uncommitted `app.js` WIP bleeding across sessions in a shared working tree, two sessions
fixing the same thing. This ledger is the shift board — **claim before you work, release
when you finish.** It is committed to `main`, so `git pull` shows you everyone else's
active claim.

There is no dispatcher and no manager process. The rule set IS the coordination:

1. **SYNC FIRST** — `git fetch origin && git pull --rebase origin main`.
2. **CLAIM** — `node scripts/shift.mjs claim --task "<what>"` reserves a **version-number
   range** for you (so nobody else takes your `1.51.x`) and records it here. It prints your
   range + a ready-to-run `git worktree add` line.
3. **WORK IN A WORKTREE** — run the printed `git worktree add` so your edits live in your
   OWN working tree, never the shared clone. This is what kills the "other session's
   uncommitted `app.js` under my commits" class.
   **One claim per checkout.** The session id is stored in the gitdir of the checkout you
   ran `claim` from (`.git/shift-session-id`, or `.git/worktrees/<name>/shift-session-id`), so
   `claim` refuses when that checkout already holds a live row. If the shared main clone is
   already claimed by another session, create your worktree FIRST and run `claim` from inside
   it; it gets its own id file. `beat`/`release` must run from the checkout whose id file made
   the claim (or copy that file into your worktree's gitdir). SHIFT-SHARED-ID-001, 2026-09-06:
   two claims from one clone shared one id, the second silently replaced the first row, and
   the first session's release deleted the second's claim.
4. **HEARTBEAT** — `node scripts/shift.mjs beat` every so often (optional; marks you alive
   so a crashed claim can be reaped).
5. **RELEASE** — `node scripts/shift.mjs release` when done (or when you abandon the range).

Use only version numbers **inside your claimed range**. Never reuse another active claim's
range. A claim older than its heartbeat + 6h with no activity may be reaped by any session
(`node scripts/shift.mjs reap`).

`node scripts/shift.mjs status` prints the table below from the machine-readable block.

## ACTIVE CLAIMS

<!-- SHIFT:BEGIN — one JSON object per line; managed by scripts/shift.mjs, safe to hand-edit a line if a session died without releasing -->
{"id":"sh_mtq6jorr_haqg","started":"2026-09-06T19:03:34.754Z","host":"Gabo-PC","worktree":"interesting-bell-a5b8bd","branch":"claude/interesting-bell-a5b8bd","range":"1.51.4526-1.51.4545","task":"SLOGAN-PAPER-CONTRAST-001: CL slogan contrast-guarded against the header band, not the white paper -> white/hidden slogan on dark-band brands (preview + export sidecars)","beat":"2026-09-06T19:03:34.816Z"}
<!-- SHIFT:END -->

_No active claims when the block above is empty. Each line is
`{"id","started","host","worktree","branch","range","task","beat"}` (UTC ISO times)._

## Why this shape

- **JSONL, one claim per line** — line-oriented so two sessions claiming at once merge
  cleanly instead of conflicting; trivially machine-parseable; still human-readable.
- **Committed to `main`** — the ledger travels the same channel as the code, so a `pull`
  that gets you the latest code also gets you the latest claims. No side database.
- **Version-range reservation, not a global lock** — sessions run fully in parallel; they
  only agree not to step on each other's version numbers + to work in separate worktrees.
- **Reads are origin-authoritative** — `status`/`next-version`/`claim` read the ledger from
  `origin/main` (fetch + `git show`), NOT the local working copy, so a session with uncommitted
  WIP (which can't `pull --rebase`) still sees every active claim and can't double-claim a range.
- **Writes are re-applied on conflict** — every command rewrites the whole block, so when a
  push is rejected because `origin/main` moved, the `pull --rebase` conflicts on the block. The tool
  rebuilds the block from origin's CURRENT rows plus its own change and continues the rebase
  (a row another session pushed meanwhile survives). A conflict anywhere else aborts the rebase
  and prints `NOT PUSHED`: your change is then committed locally only — fix before continuing.
- **Released ranges are not reused** — the high-water mark advances past every claimed range
  (release/claim commit subjects carry the range end), so numbers are burned rather than recycled.
  This is deliberate: a never-reused number can never collide with an in-flight deploy of the old one.

All scheduled/recurring routines are bound by this too — see `docs/qa/SCHEDULED_ROUTINES.md`.
