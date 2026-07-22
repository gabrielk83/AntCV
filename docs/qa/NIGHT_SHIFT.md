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
{"id":"sh_mrvutbzu_9znm","started":"2026-07-22T09:02:21.693Z","host":"GabyPC2","worktree":null,"branch":"shift-sbink","range":"1.51.2221-1.51.2228","task":"SIDEBAR-INK-BRAND-BG-001: contrast-safe sidebar ink keyed on the brand-painted sidebar bg (dark brand sidebar had navy text)","beat":"2026-07-22T09:02:21.908Z"}
{"id":"sh_mrvuuqfc_hncc","started":"2026-07-22T09:10:28.910Z","host":"GabyPC2","worktree":null,"branch":"claude/optimistic-jang-7b06fe","range":"1.51.2290-1.51.2309","task":"RELAY-AUTH-FIX-001 relay bearer","beat":"2026-07-22T09:10:29.561Z"}
{"id":"sh_mrw0g9sq_ky5","started":"2026-07-22T11:40:10.016Z","host":"GabyPC2","worktree":null,"branch":"shift-titleheal","range":"1.51.2331-1.51.2338","task":"TITLE-LANG-HEAL-001: reset wrong-script section titles (CJK/HE/AR on a Latin-target doc) to EN canonical; ratio detector ignored short wrong-lang titles","beat":"2026-07-22T11:40:10.717Z"}
{"id":"sh_mrvv4t5g_aqt6","started":"2026-07-22T09:11:17.146Z","host":"GabyPC2","worktree":null,"branch":"shift-sbink","range":"1.51.2250-1.51.2256","task":"SIDEBAR-INK-BRAND-BG-001 (rebased)","beat":"2026-07-22T09:11:17.618Z"}
{"id":"sh_mrw39srh_fnes","started":"2026-07-22T12:59:06.850Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.2481-1.51.2500","task":"rich_block row Fit-it/Enhance per-row busy feedback (hourglass + pink row)","beat":"2026-07-22T13:00:09.743Z"}
{"id":"sh_mrw7uuxu_b1xm","started":"2026-07-22T15:07:27.910Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.2641-1.51.2660","task":"rich_block row Fit-it/Enhance: storm-proof hourglass latch + roles-storm converge","beat":"2026-07-22T15:07:28.238Z"}
{"id":"sh_mrwbhn6v_i2ha","started":"2026-07-22T16:49:09.803Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.2761-1.51.2780","task":"pink section highlight: module-level latch (storm/fast-fail proof)","beat":"2026-07-22T16:49:09.990Z"}
{"id":"sh_mrwbrn0q_4edk","started":"2026-07-22T16:56:56.147Z","host":"GabyPC2","worktree":null,"branch":"claude/optimistic-jang-7b06fe","range":"1.51.2781-1.51.2800","task":"HEADER-COLOR-CONTROLS-001 per-element colour swatches","beat":"2026-07-22T16:56:57.365Z"}
{"id":"sh_mrwi08k6_99dl","started":"2026-07-22T19:51:35.005Z","host":"GabyPC2","worktree":null,"branch":"main","range":"1.51.2921-1.51.2940","task":"LINE-DISTRIBUTION-001: measure-based bidirectional per-row Fit-it","beat":"2026-07-22T19:51:35.315Z"}
{"id":"sh_mrwm59c4_8eai","started":"2026-07-22T21:47:27.763Z","host":"GabyPC2","worktree":null,"branch":"claude/determined-cannon-8d4c64","range":"1.51.3101-1.51.3120","task":"COPENHAGEN-MOCKUP-PARITY: token fixes flagged by mockup diff (mainHead teal, year 777, sidebarLine teal, contact dbe4f0, worker ground)","beat":"2026-07-22T21:47:28.582Z"}
{"id":"sh_mrwpry8w_gy29","started":"2026-07-22T23:29:05.315Z","host":"GabyPC2","worktree":null,"branch":"claude/determined-cannon-8d4c64","range":"1.51.3302-1.51.3321","task":"CPH-BAND-SYMMETRY-002: spec glyph-middle at midline, equal gaps, name+contact full width","beat":"2026-07-22T23:29:05.595Z"}
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
