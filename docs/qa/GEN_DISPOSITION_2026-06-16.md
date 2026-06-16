# GEN cluster disposition — 2026-06-16

Apply these edits to `docs/qa/ACTIVE_BUGS.md` in the next **desktop git** session (the file is
~302KB → never edit inline via the MCP github tools; this note is the instruction set).

Inspection backing this disposition is in `docs/plan/NIGHT_RUN_2026-06-16.md` (Cluster 4).

## 1. Close the two stale-OPEN rows (already shipped)
The "Stale OPEN tags — ALREADY SHIPPED" block (~line 381) already lists these as shipped; the
buried OPEN lines deeper in the file contradict it. Retag the buried lines to match:

- `HOWCONTRIBUTE-001` (buried OPEN ~line 2156) → **`[FIXED 1.50.354` (`bbf4d59`)]`**. Keep the
  one-line note; drop the `[OPEN]`.
- `GEN-UNSOL-002` (buried OPEN ~lines 1825 / 2149) → **`[FIXED 1.50.358` (`ea30b2f`); follow-up
  GEN-UNSOL-003 @ 1.50.391]`**. Drop the `[OPEN]`/`[OPEN, needs live JD test]` tags.

## 2. Reclassify the 11 meta gates
`GEN-001 … GEN-011` are §3 Definition-of-Done parity rules, not tickets. They should not sit in the
actionable backlog. Add a one-line header above them: *"GEN-001..011 are DoD parity GATES enforced
per-fix (Preview = DOCX = PDF, desktop = mobile), not standalone tickets — do not count as open
work."* Leave them in place as gates; just stop counting them.

## 3. Fold the two genuine items into their real homes
- `GEN-001b` (kernel generation underfills CV sections; add unsolicited fallback + warnings) →
  move to the **kernel-generation** worker backlog. It is worker-prompt work, not a GEN ticket.
- `GEN-002b` (CL generation drops WHAT-I-BRING table signals + WHY-THIS-POSITION bullets) → this is
  the **same bug as `CL-006`** ("capture table data in CL generation", ~line 2723). Merge GEN-002b
  into CL-006 and delete the standalone GEN-002b line.

## Net effect
Generation/content actionable count: **15 → 0** (11 gates, 2 closed, 2 relocated). The cluster
dissolves; remove it from the old-open actionable tally in
`docs/qa/AntCV_old_open_reconciled_2026-06-16.md` (drop the true-live count by 2 — the two relocated
items now live under kernel-generation and CL-006 respectively).
