# Density sweep report — GOLD-TARGET-LAYOUT-DENSITY-001 (2026-07-15)

Second sweep pass over the saved tracker applications, advancing the density
frontier toward the 97.5% quality target. Data-only `density_fit.py --apply`
(deterministic clause-boundary trims + gated multi-family LLM grow/shrink/respace,
cross-family no-new-claims verifier, numbers/acronyms verbatim, table cells
shrink-only). Every write text-verified; PUT only on measured defect reduction.
Excludes 723 (showcase, never touch), 794/796 (owner stubs). Flat-text apps
724/827/874/904/667/669/720/721 render zero measurable structured items (old
format) — vacuous 100%, not targets.

## Headline

- **16 of 46 (app × doc) jobs persisted a real improvement.** No regressions
  (PUT is gated on a measured defect drop).
- **Two things moved the needle beyond the prior (2026-07-13) sweep:**
  1. **A CL-render harness regression was found and fixed** — it had been
     silently blocking three cover letters from being measured or fitted at all
     (see "Infra fix" below). Fixing it unlocked **849 CL +5.6** and
     **1006 CL +28.5**, plus 810 CL (measurable again, already at frontier).
  2. **Four never-swept apps created 2026-07-14** (849, 914, 1006 real; 724/827/
     874/904 are flat-text stubs) got their first density fit — the largest
     single gains in the pass.

## Per-app before → after (persisted improvements only shown with Δ)

| App | Doc | Before | After | Δ | runts B/A | Levers |
|----|----|----|----|----|----|----|
| 849 | CV | 57.4 | 63.9 | **+6.5** | 23/21 | trim + 6×LLM (core_comp, exp, profile, tools) |
| 849 | CL | 72.2 | 77.8 | **+5.6** | 5/4 | 1×LLM — *unlocked by infra fix* |
| 914 | CV | 65.5 | 67.3 | +1.8 | 17/16 | 6×LLM (core_comp cells, exp) |
| 914 | CL | 55.0 | **85.0** | **+30.0** | 9/3 | 8×LLM (prose shrink; repaired a broken duplicated line) |
| 1006 | CV | 54.9 | **72.3** | **+17.4** | 42/28 | 4×trim + 33×LLM (exp bullets, pub reorder) |
| 1006 | CL | 28.6 | 57.1 | **+28.5** | 5/3 | 2×LLM — *unlocked by infra fix* |
| 792 | CV | 79.6 | 81.5 | +1.9 | 8/7 | 1×LLM |
| 793 | CV | 73.0 | 77.8 | +4.8 | 13/13 | tableRatio acceptance (cell cascade cleared) |
| 795 | CV | 77.4 | 79.2 | +1.8 | 9/8 | 2×LLM |
| 797 | CV | 75.5 | 79.2 | +3.7 | 11/11 | tableRatio acceptance |
| 799 | CV | 79.4 | 81.0 | +1.6 | 11/10 | 1×LLM |
| 800 | CL | 85.0 | **95.0** | **+10.0** | 3/1 | 2×LLM prose shrink |
| 807 | CL | 90.0 | 95.0 | +5.0 | 2/1 | 1×LLM |
| 808 | CV | 76.3 | 78.0 | +1.7 | 12/11 | 2×LLM |
| 809 | CV | 79.7 | 82.8 | +3.1 | 8/8 | 1×LLM |
| 812 | CL | 85.0 | 90.0 | +5.0 | 3/2 | 1×LLM |

**Held at frontier (0 net defect change, correctly skipped — not a failure):**
790 CV/CL, 791 CV/CL, 792 CL, 793 CL, 795 CL, 797 CL, 798 CV/CL, 799 CL, 800 CV,
801 CV/CL, 802 CV/CL, 804 CV/CL, 805 CV/CL, 806 CV/CL, 807 CV, 808 CL, 809 CL,
810 CV/CL, 811 CV/CL, 812 CV.

## Which levers moved the needle

1. **Multi-family LLM shrink of prose (cover letters).** The biggest wins are CLs
   (914 +30, 1006 +28.5, 800 +10). Cover-letter prose carries removable slack that
   tightens to full lines without dropping a fact — the cross-family verifier
   passes honest synonym shrinks and vetoes fabrication. 914 CL also *repaired* a
   broken duplicated line ("Coordinate international engineering Coordinate
   engineering…").
2. **LLM + deterministic trim on experience bullets (CVs).** 1006 CV's +17.4 came
   from 33 LLM rewrites + 4 trims across experience/pubs (pinned=0 — nothing
   blocked upstream). This is the dominant CV lever when the app has many
   rewritable 2-line bullets with short trailing lines.
3. **tableRatio acceptance (core-competency table).** 793/797 CV moved via the
   NARROW-CELL-CASCADE tableRatio ladder clearing a wrapped label while the value
   column held — a layout lever, not a text rewrite (0 text rewrites, still PUT).
4. **New frontier lever added this pass — grow-veto → shrink-only retry** (see
   below). Fires as designed; non-regressive; modest isolated effect.

## New lever: grow-veto → shrink-only retry

`density_fit.py`: when the cross-family auditor vetoes a *grow* candidate as a
NEW claim (fabrication), the item's retry previously re-offered the same grow
window — inviting the same fabrication. Now, **if an honest shrink window exists
(drop no fact, shorter synonyms, still fully gated), the retry suppresses grow and
forces the shrink** — collapsing the runt to one full line instead. It never
relaxes a gate; it only steers the retry. Default-on; kill-switch
`ANTCV_DENSITY_NO_SHRINK_RETRY=1`.

**Clean A/B (app 810 CV, thorough, no-apply, same live baseline):**

| | after quality | runts B/A | stretched B/A |
|---|---|---|---|
| lever OFF | 73.0 → 74.3 | 18→17 | 6→6 |
| lever ON  | 73.0 → 74.3 | 18→18 | 6→5 |

On this hard frontier CV the lever is a **wash on net quality** — it fired 9 times
and reached the same 74.3% by an honest shrink (fixing a stretched line) instead
of a grow (fixing a runt). Honest conclusion: **non-regressive and honest-by-design
(prefers shrinking over re-attempting fabrication), but not a silver bullet on the
hardest apps** — where runts are simultaneously un-growable (facts would be
invented) and un-shrinkable (every token is a distinct fact), no lever helps. Kept
because it is provably non-regressive (best-state + PUT-on-improvement gating) and
does convert fabrication-vetoes into real fixes wherever honest shrink slack exists.

## Infra fix (the real unlock this pass)

`scripts/job-tracker/render_payload.mjs`: the CL payload build regressed — the
docx-client's `CL-HYDRATE-EXPORT-GATE-001` belt emits `console.log("[docx-client]
…hydrated N placeholder CL section(s)…")` **to stdout**, which corrupted the
harness's JSON stdout (`JSONDecodeError: line 1 column 2`). It only triggered for
CLs needing placeholder hydration (the newer/regenerated apps: 810/849/1006),
which is why older CLs built clean and this was invisible in the 2026-07-13 sweep.
**Fix:** redirect the module's `console.log/info/debug/warn` to stderr in the
harness so stdout is JSON-only. Dev-harness-only change; no production behavior
touched. This restored measurement + fit for the three blocked CLs.

## Residue: which apps stay content-bound, and why

The 97.5% target remains unreached on every app. The ceiling is **content-bound,
not a layout-rule failure**, and the loop correctly reports rather than fabricates:

1. **Un-growable + un-shrinkable runts (the true frontier).** On CVs like 790 and
   810, the short trailing lines need either real facts not in the kernel (every
   LLM grow was a fabrication the verifier killed — "and staff", "across many
   countries", "in books and articles") OR a shrink that would drop a distinct
   fact. Neither is honest, so they stay. This is ~10–18 runts per hard CV.
2. **Verbatim-policy sections** (education, certs, languages, pubs, accessibility,
   core_comp labels, greeting/closure) are measured but never rewritten by policy.
   Their 40–60% single-line fills (e.g. "Spanish: professional",
   "B.Sc. Physics Tel Aviv University") are their nature; only owner-approved label
   rewordings can fill them.
3. **Personality lines** (interests) are grow-only and protected — "Reading:
   Technology, society and systems thinking" can't be lengthened without inventing
   a personal fact.
4. **1006 CL measurement is partial** (7 items, 4 unmatched) — its CL structure
   token-matches poorly; the +28.5 is real but the residual figure is approximate.
5. **Content-quality flag (out of density scope):** app **849** (and likely its
   Aimpoint siblings 904/874) leads its profile with *"IT professional with 15+
   years…"* for an **optical engineer** role — a generation-tailoring mismatch, not
   contamination (it is genuinely Gabriel's data: Kanzen ApS, the pubs, rugby/cats).
   Density only reworded for length; the mislead needs a **regen**, owner call.

## Standing rules honored

No cross-section dedup; no relevance reorder; hide-not-delete (no items removed —
only within-item rewording); kernel-sourced only (growth draws from the kernel
digest + role facts, never invented — verifier-enforced); banned em/en dashes and
AI-notice untouched; accessibility wording untouched (verbatim). No real candidate
data committed (all data lives in the live relay / kernel, not the repo).

## OPEN — two layout items ROUTED here from the 2026-07-14/15 CJLR/pagination session (owner-approved)

These are pagination/layout, not content-density, but they live in this exact
measure/fit code and need the render-and-measure harness — so they belong to the
next density pass, NOT a cold coordinator edit. Recorded here so a future
density-nightly is guaranteed to grab them (also in `ACTIVE_BUGS.md` top entry).

1. **PREVIEW↔EXPORT LINE-DRIFT (3 vs 4 pages).** On a real Gabriel unsolicited CV the
   PREVIEW paginates to 3 pages but the exported PDF is 4 (experience span). Root cause
   is the classic "the PREVIEW counts fewer lines per paragraph than Word actually
   renders," so the auto page-break lands one role/page late. Fix belongs in the
   **measurer** (match preview per-paragraph line counts to Word) — `measure_density.py`
   already renders byte-exact via the docx-worker + PyMuPDF, so it can quantify the
   per-paragraph drift and calibrate it. See the note in `pwa/antcv-docx-client.js`
   experience case (~line 2714). Do NOT "fix" it by dropping the export break.

2. **SIDEBAR GROUP-SWAP / PAGE-FILL PACK.** A sidebar section (e.g. TOOLS & METHODS)
   keeps its groups in stored order and overflows such that a later sidebar section
   (EDUCATION) is orphaned onto its own page with lots of empty space. Owner does NOT
   want a mid-group split (that fights the coordinator's deliberate group-boundary
   snapping + oscillation guards). Instead: reorder an overflowing sidebar section's
   groups so page-1 packs a **long group + a short group** together (best fill), pushing
   medium groups to later pages. Height source: `antcv-auto-pagebreak-block-001.js`
   already computes per-group heights (`heights = {"sid|key":px}`) and group starts from
   `items[i].grp` (~lines 288 / 1314-1427). **HARD CONSTRAINT:** this can NOT be
   preview-only — the reorder changes the rendered group order, so the **docx-worker
   sidebar render MUST apply the identical reorder** or the PDF won't match the preview
   (recreating the mismatch). One coordinated change: preview render + `workers/docx-worker`,
   measure-validated (use the harness's STRETCHED-line + per-page sidebar-gap metrics),
   no oscillation.

Context for whoever picks these up: the roles-as-rich_block cutover went default-on
(1.51.1264) and AUTOPAGES-ITEM-TO-ROLE-001 (1.51.1265) now translates the flattened
experience item-index autoPages back to role indices in `antcv-docx-client.js` — relevant
if you touch experience pagination. The under-role line already exports for every role
(docx-worker 1.14.157, deployed).
