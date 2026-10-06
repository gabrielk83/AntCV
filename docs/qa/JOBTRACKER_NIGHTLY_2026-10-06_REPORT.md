# Job-tracker nightly 2026-10-06 (desktop Gabo-PC, Fable 5.1)

Worktree `~/antcv-worktrees/routine-antcv-job-tracker-nightly-muwcgnbe` on `origin/main` `af8c0f02`.
No earlier JOB-TRACKER entry for today. Previous start 2026-10-05, no dispatch gap.

## Gates

| Gate | Result |
|---|---|
| Token | OK, expires 2026-10-12T16:40Z (6.4 d left) |
| Python | 3.12.10, PyMuPDF 1.28.2, openpyxl 3.1.5 |

## Step 1b sweep (`check-postings.py check --apply`)

| Count | Value |
|---|---|
| Probed | 83 (67 on 10-05; the 16 leads of the 10-05 expanded discovery joined) |
| LIVE | 80 |
| Archived | 1: Danfoss / Production Testing Engineer, GONE strike 2/2 |
| Held at strike | 0 |
| ERROR, not counted | 2: VML MAP (HTTP 500, sixth run), Continia Software (read timeout, first sight) |
| Doc rev | 281 -> 282 |

## Task 1 drain

`gen-runner.py list`: 0 eligible rows. No research, no model call, no app persisted, active pointer untouched.
Unarmed ready list: 37 rows with a real JD and the clock flag off.

The new "ARMED but already has an application" block (Task 2) names two rows:

| uk | rank | app | note |
|---|---|---|---|
| napatech | 24 | 2781 | CLOSED row, flag stale |
| veo_technologies | 75 | 3500 | status Submitted, pointer dead |

Excel mirror: pulled rev 282, 137 rows, workbook rebuilt, Proposed Inbox 89 leads. 28 local-only
`support` entries in `job_tracker_doc.json` (12 on 10-05 plus the 16 leads of 10-05); `push` is the owner's call.

Health: 53 artifact pointers vs 85 cloud apps, 1 dead (`veo_technologies` -> 3500), unchanged, expected.

## Task 2: JT-ARMED-ARTIFACT-NO-DRAIN-001 option (a)

Row 118 ADVANCED. `gen-runner.py` gained `armed_with_app_rows(doc)` and `print_armed_summary(doc)`,
called at the end of `list` and of `run`. Report-only: the eligible set is unchanged, a regen stays a
manual `run --persist --force --row <uk>`.

`test_closed_row_gate.py` 20 -> 37 checks on the real functions. Negative control by line index:

| Sabotage | Red |
|---|---|
| gen-runner.py:459 `if not queue.get(uk):` -> `if False:` | 3 |
| gen-runner.py:473 `if not armed:` -> `if True:` | 5 |
| restored | 37/37 green |

Script-only. No `pwa/` asset, no version number, no shift claim.

## Row 113 CLOSED

The Danfoss leg is moot: the posting archived today on its second strike. Celare was regenerated as app 3508
on 10-05. Apps 3504 and 3505 remain in the cloud as low-fidelity leftovers for the owner to delete.

## Tests

`run-tests.mjs`: 2223 tests, 2216 pass, 0 fail, 7 skipped, plus 18 python files, exit 0. `check-register.mjs` OK.

## Owner asks

1. Row 118: decide on (b) regen-on-arm and (c) dead pointer = never generated. The stale `queue=true` on
   `napatech` and `veo_technologies` is a doc write, not done unattended.
2. 37 unarmed rows with real JDs wait for the clock flag.
3. 28 local-only `support` entries wait for a `push`.
4. Delete apps 3504 and 3505 in the PWA if not wanted.
