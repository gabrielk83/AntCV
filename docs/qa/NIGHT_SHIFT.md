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
4. **HEARTBEAT** — `node scripts/shift.mjs beat` every so often (optional; marks you alive
   so a crashed claim can be reaped).
5. **RELEASE** — `node scripts/shift.mjs release` when done (or when you abandon the range).

Use only version numbers **inside your claimed range**. Never reuse another active claim's
range. A claim older than its heartbeat + 6h with no activity may be reaped by any session
(`node scripts/shift.mjs reap`).

`node scripts/shift.mjs status` prints the table below from the machine-readable block.

## ACTIVE CLAIMS

<!-- SHIFT:BEGIN — one JSON object per line; managed by scripts/shift.mjs, safe to hand-edit a line if a session died without releasing -->
{"id":"sh_mrfg3zgj_6x7f","started":"2026-07-10T21:26:25.609Z","host":"GabyPC2","worktree":"versionfix","branch":"main","range":"1.51.260-1.51.279","task":"corrective cache-bust after PR#336 regressed version to 245/246","beat":"2026-07-10T21:26:26.030Z"}
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
