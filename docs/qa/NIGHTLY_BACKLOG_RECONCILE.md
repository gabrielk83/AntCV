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

---

## 2026-07-08 — LIVE-GEN EVALUATION work-orders (owner drove app-gen; findings from the app-generated Trackman CV+CL)

Context: the owner generated a Trackman application through the LIVE app pipeline (not hand-built). Evaluated the exported CV (5pp) + CL. Two contamination leaks were fixed at the state layer this session (PWA 1.51.216 company via `yo`; 1.51.218 `applicationQuestions`), and two CL header bugs fixed in the worker (1.14.139: slogan reads `meta.cl_slogan`; subtitle em-dash → hyphen belt). The REMAINING items below are GENERATOR-BASELINE work (rows 59/62/66/74) — they need a FULL generation to reproduce + validate (this desktop can't complete a live gen: SSE background-stall), so they are queued here for a session that can validate:

- **(b) SIDEBAR EMPTY on page 1 + 5-PAGE CV.** The exported CV ran 5 pages with the page-1 sidebar showing only the "TOOLS & METHODS" heading and no items under it (content flowed to later pages). Root is tied to (d): the sidebar was NOT trimmed, so it's very long and the column flow strands the heading. Diagnose the sidebar heading/first-item column-break (heading-orphan) AND the page count. Reproduce with a real gen; measure the rendered sidebar per page.
- **(c) LINE-FILL missed in the LIVE pipeline.** Main-column bullets rendered justified with huge inter-word gaps + orphans + short last lines throughout — the orphan/enhance pass that works in hand-built worker payloads did NOT land in the live gen output. This is the recurring "97.5%" line-fill: the estimator (`Vi`/`__pdfMainW`, autofit finding row 74) + `fix_orphans` enrich pass must actually run and gate the export at generation. Verify the pass fires post-gen (not just the manual "Fix Orphans" button).
- **(d) SIDEBAR NOT TRIMMED → page bloat.** The LLM's `hidden:true` JD-relevance flags + the "SIDEBAR LINE ECONOMY" rule did not compress the sidebar (tools/certs/regulatory all shown), producing 5 pages vs the ~1.5-2pp target. Check the generation output's `hidden` flags and the export's respect for them; confirm the page-budget (`pageBudget`) compression is applied.
- **CONTENT (smaller):** generic "IT professional" PROFILE opener (should be the hardware-PM identity for a JD run); garbled hyphen-compressions in the CL ("sports-focused on clear execution", "applications-focused"); Meprolight merged-title order.
- **PARALLEL-GEN CONTAMINATION:** the owner's parallel "cycle" generation produced 4 identical Trackmans — parallel tabs/gens share the JD store (last-write-wins). Separate from the sequential fix (1.51.216/218); needs per-gen JD isolation (jd-scope-isolation Stage1 per-tab).
- **BACKGROUND-STALL (row 74, the mobile 97.5% blocker):** generation stream dies when the tab isn't foreground. Diagnostic-first in the sensitive stream code.

### 2026-07-08 ADD — TWO-COLUMN PAGINATION DESYNC (sidebar-photo trigger) — owner: "you have not identified it"

An UNSOLICITED CV with the PHOTO IN THE SIDEBAR (photoPosition sidebar-top, NOT the bridge/band-overlap) exposed a severe pagination desync — measured per page (PyMuPDF word extents):
- p1: main y686 + sidebar y768 (both filled) · p2: main **EMPTY** + sidebar y262 (sidebar-only) · p3: both filled · p4: main y690 + sidebar **EMPTY** (main-only) · p5: partial. → 5 pages, half-empty pages.

ROOT: the two columns paginate INDEPENDENTLY (per-page `makePageTable` slots) and drift apart when their content heights differ. The sidebar photo makes the sidebar taller on p1, kicking off the drift; thereafter the sidebar-overflow claims a page with an empty main (p2) and the main later claims a page with an empty sidebar (p4). Previous line-fill/layout work only handled the BRIDGE photo (band-overlap in the header) — the sidebar-body photo mode was NOT accounted for.

FIX PATH: the `balanceOverflow` (reflow sidebar overflow full-width) and `floatSpine` (floating continuation tables) flags (docx-worker ctx, both default OFF) are exactly for this — validate + enable for the multi-page case, OR make the main+sidebar share ONE synced flow. Reproduce with a sidebar-top-photo + long-sidebar payload (Word-COM render, measurable here), test each flag, then enable. Ties row 61 (float-spine), row 74, coordinator-sidebar-inflate. This is ALSO the root of the 5-page bloat seen on the Trackman run (row 74 (b)/(d)) — same desync, JD-run just happened to align better.
