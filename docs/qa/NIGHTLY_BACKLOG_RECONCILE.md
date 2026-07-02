# STANDING nightly order — backlog reconciliation (owner 2026-07-03)

Owner: "make sure nightly also covers the most recent open vs closed backlog —
older open stuff that is still open." Every nightly run (local antcv-nightly AND
the cloud Routine) reserves ONE slot for this, in addition to its dated tasks.

## Why this exists

The open/closed registers daisy-chain: each `PROJECT_ISSUES_OPEN_CLOSED_<date>.md`
ends with "prior open items remain as recorded in <previous date>" — so anything
not touched in the last few sessions silently ages out of every working set.
`MASTER_BACKLOG.md` (compiled 2026-06-04) and `FEATURES_REGISTRY.md` carry OPEN
tags that are often already shipped (memory rule: the registry is stale —
verify first).

## The slot (each nightly, ~30–60 min)

1. Open `docs/qa/OPEN_REGISTER.md` (the rolling consolidated list this order
   maintains). Take the **3–5 OLDEST rows with `verified: no`** (or `stale-check
   due` dates in the past).
2. For each: VERIFY against the CURRENT code/version — repro or test, never trust
   the tag. Outcomes:
   - already shipped → move to the register's CLOSED block with the closing
     version/commit as evidence;
   - still real → keep OPEN, refresh the row (current symptom, suspected file,
     next concrete step), set `verified: <today>`;
   - fixable inside the slot → fix it under the normal nightly rules (verify-
     first, quintet, suite green) and close it.
3. Once per week (or when the chain looks out of sync): sweep NEW sources into
   the register — the newest `PROJECT_ISSUES_OPEN_CLOSED_*` "OPEN (carry
   forward)" block, "STILL OPEN" phrases in `ACTIVE_BUGS.md` blocks older than
   ~5 days, `MASTER_BACKLOG.md` OPEN/PARTIAL/VERIFYING tags, and
   `FEATURES_REGISTRY.md` OPEN rows. Add anything missing as `verified: no`.
4. Report: the nightly report lists which register rows were verified, closed,
   or refreshed. A nightly that ships nothing from its dated tasks but closes
   two stale register rows is a GOOD nightly.

## Rules

- `OPEN_REGISTER.md` is a ROLL-UP, not a second source of truth — prose detail
  stays in the linked docs; when it and the v4 .docx disagree, the .docx wins.
- Never mark CLOSED without evidence (version/commit/test). "Probably shipped"
  → verify or leave open.
- Owner priority order applies when picking fix candidates: CONTENT & EXPORT →
  SETTINGS → FEATURES.
