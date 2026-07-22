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
{"id":"sh_mrjan7tb_2v89","started":"2026-07-14T13:12:46.358Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.761-1.51.780","task":"photo horizontal flip control (off/on/auto) in Layout photo panel + preview + export","beat":"2026-07-14T13:12:46.440Z"}
{"id":"sh_mrkppnoa_bzvg","started":"2026-07-14T14:41:01.811Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.802-1.51.821","task":"contact-line: drop bullet when emojis + font +0.5pt (preview/srcdoc/OOXML)","beat":"2026-07-14T14:41:02.317Z"}
{"id":"sh_mrl2y64c_6npv","started":"2026-07-14T20:04:36.350Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.1164-1.51.1183","task":"slogan CJLR single-cycler + Fit-it double-cap fix + apply-corrections for standalone editables + justify-accept","beat":"2026-07-14T20:04:37.031Z"}
{"id":"sh_mrl53oqw_b48x","started":"2026-07-14T21:04:53.003Z","host":"GabyPC2","worktree":null,"branch":"HEAD","range":"1.51.1264-1.51.1283","task":"E cutover: roles-as-universal-rich_block default-on","beat":"2026-07-14T21:04:53.255Z"}
{"id":"sh_mrl5nybc_9wce","started":"2026-07-14T22:33:09.331Z","host":"GabyPC2","worktree":null,"branch":"claude/hopeful-albattani-24195b","range":"1.51.1404-1.51.1423","task":"SLOGAN-LANG-GATE-001: wrong-language slogan override gate; branded==non-branded parity","beat":"2026-07-14T22:33:10.251Z"}
{"id":"sh_mrvqtrur_by3m","started":"2026-07-22T07:10:43.787Z","host":"GabyPC2","worktree":null,"branch":"shift-v5fix","range":"1.51.2073-1.51.2084","task":"CL-V5-MIGRATE-DURABLE-002: role_view stateless re-ensure (poisoned one-shot flag left owner letters without How-I-see-the-role)","beat":"2026-07-22T07:10:44.322Z"}
{"id":"sh_mrvtabkc_6ziy","started":"2026-07-22T08:19:35.059Z","host":"GabyPC2","worktree":null,"branch":"shift-slogan","range":"1.51.2166-1.51.2173","task":"SLOGAN-HEADLINE-PROMPT-001: steer cl_slogan to a punchy 4-13 word headline, not a comma-spliced sentence that caps to a fragment","beat":"2026-07-22T08:19:35.630Z"}
{"id":"sh_mrvv0m3w_ippk","started":"2026-07-22T09:08:01.443Z","host":"GabyPC2","worktree":null,"branch":"claude/elated-wilbur-b386b8","range":"1.51.2230-1.51.2249","task":"CL-APP-SUBTITLE-NO-DOUBLE-COMPANY: strip a trailing '- <company>' from the role before the Application: subtitle appends the company (fixes doubled company e.g. 3Shape)","beat":"2026-07-22T09:08:03.004Z"}
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
- **Released ranges are not reused** — the high-water mark advances past every claimed range
  (release/claim commit subjects carry the range end), so numbers are burned rather than recycled.
  This is deliberate: a never-reused number can never collide with an in-flight deploy of the old one.

All scheduled/recurring routines are bound by this too — see `docs/qa/SCHEDULED_ROUTINES.md`.
