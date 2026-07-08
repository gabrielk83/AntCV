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

## Standing add-on 2026-07-08 — GENERATOR-BASELINE from the Trackman review (row 66)

Owner reviewed the generated Trackman CV+CL and flagged a batch of generator
baseline gaps (OPEN_REGISTER **row 66**). Every nightly reserves effort to feed
these into the GENERATOR (they must happen automatically, not by hand — row 59A):

- **AI-notice bottom-anchor** + **sidebar-fill-to-page-end** on every page.
- **Orphan/enrich pass** (bidirectional line-fill; measure the render, not chars).
- **Mandatory sections never dropped**: ACCESSIBILITY, INTERESTS with the cats
  item + the witty reveal; sidebar list sections BULLETED; CORE STRENGTHS tabular.
- **REFERENCES** at the main-column end; **STANDARDS** + imaging standards.
- **Hyperlinks** for Scholar/LinkedIn; **light main-column tint** vs a dark sidebar.
- **CL**: application line (not specialisation) rendered ONCE; slogan; signature;
  Goal + others as orange rich_block LEAD-INS (not headings); compression targets.

**Process rule (prevention):** ANY deliverable is generated from the authoritative
master-profile kernel (NOT a re-typed export) and passes
`docs/qa/DELIVERABLE_PREFLIGHT_CHECKLIST.md` before it is handed over. A raw
docx-worker payload bypasses the app belts — so either generate through the full
pipeline or apply the belts + checklist by hand.
