# JobTracker auto-fill + fit-ranked Top-5 — build spec (JOBTRACKER-AUTOFILL-TOP5-001)

Owner spec, 2026-07-13. Turns the tracker from an insertion-ordered list into a
**fit-ranked pipeline**: every add (manual URL/PDF *or* auto-discovery) is enriched,
tiered, scored, and re-evaluated against the current Top-5. Island work
(`src/islands/JobTracker/*`), so: Vite build + cache-bust quintet + deploy + live
browser verify. Pairs with the discovery task (`discover-positions.py`) and
`docs/qa/` register.

## Current state (verified 2026-07-13)
- `appendRow` (JobTracker.tsx:302, shared by `addFromUrl`+`addFromFile`) already:
  fetches JD, runs `analyzeJd` (research + `webintel`), stores `urls/jd/support/webintel`.
  Gaps: band = flat `'E2EFDA'` (T2, no auto-tier); next = `'Not started'`; no brand;
  no Top-5 evaluation.
- Top-5 (JobTracker.tsx:167) = `rows.filter(!isClosedRow).slice(0,5)` — first 5 by
  **rank/insertion**, not fit.
- `dropFromTop5` (JobTracker.tsx:502) already prompts a reason → `classifyReason` →
  appends **envelope learning**, but **archives** the row (status `Archive/closed`,
  band `D9D9D9`). That is the single "drop" the owner wants split.
- Tier bands (TIERS map): `DDEBF7`=T1 strong, `E2EFDA`=T2 transferable, `FCE4D6`=T3
  weak/pivot, `FFF2CC`=In-progress, `D9D9D9`=Archive.
- Primitives to reuse: `fitPercent` (api.ts), `fitWatch.scoreFit` (cluster hits),
  `fetchClusterTop20`, `fetchBrandColors`, `categoryFor` (role→category).

## Requirements → implementation

### R1 — Top-5 fit-ranked, re-evaluated on every add
No separate cron needed: Top-5 is a `useMemo` recomputed on every doc change, so an
add re-evaluates automatically. Change the ordering from slice-by-rank to
**score-by-fit**:
- New pure `fitScore(row, doc, cluster)` = tier-band weight (T1>T2>T3) + cluster-demand
  hits (`scoreFit` on the row's JD) + envelope location gate (penalize on-site-abroad,
  half-credit conditional far-DK) + JD-present bonus. Base on `fitPercent`.
- `top5 = [pinned by fitScore] ++ [unpinned, non-closed, non-parked by fitScore]`, take 5.
- A new add that outscores the current #5 enters the Top-5 on the spot.

### R2 — split Park / Reject, add Pin (replaces the single drop)
- **Pin** (★): `doc.pin[uk]=true` → forced into Top-5 regardless of score; stays in the
  weekly list. Toggle off = normal candidacy.
- **Park**: `doc.park[uk]=true` → out of Top-5 candidacy but **stays LIVE** in the
  weekly list (NOT archived; `isClosedRow` stays false). Reversible.
- **Reject**: keep today's flow (reason → `classifyReason` → envelope learning → archive
  `D9D9D9`/`Archive/closed`) AND write `doc.discovered[key] = {status:'rejected', reason}`
  so the discovery ledger never re-surfaces it and future discovery sees the "why".
- Top-5 excludes closed (reject/archive) and parked; pins always in.

### R3 — auto-tier manual adds
New pure `computeTier(jd, company, role, doc, cluster)` → band:
1. Location gate first: on-site abroad → T3; conditional far-DK (Jutland/Fyn) → cap T2.
2. Domain tokens: strong EO / photonics / optical-systems → T1; product / PM /
   requirements / QC / change-control / technical-BA → T2; off-domain → T3.
3. Blend with cluster-fit strength (`scoreFit`).
Deterministic, offline, no LLM call on add. Applied in `appendRow` (covers URL + PDF).

### R4 — auto-fill the row on manual add (URL or PDF)
Extend `appendRow` to parity with discovery + learn from the list:
- **tier** = R3 `computeTier` (was flat T2).
- **next step** = state-aware default: `'Review & tailor'` when a JD is present (not bare
  `'Not started'`).
- **link to JD** = `doc.urls[uk]` (already for URL; PDF adds keep the file as a signal).
- **brand** = auto `fetchBrandColors(url, company)` → `doc.brand[uk]`, set `brandfit[uk]`
  when colours are found (today it is a manual toggle).
- **top5** = automatic via R1.
- **learn from previous applications**: seed `gen[uk]` (tier hint) and any conventional
  fields from the most similar prior row (same `categoryFor`/cluster) so a new add
  inherits the list's established conventions instead of blank defaults.

## Design decisions (defaults)
- Tier + fit scoring are **deterministic** (cluster + tokens + envelope) — fast, free,
  predictable; no LLM on add. An LLM refine can come later behind an explicit button.
- New doc fields, all back-compatible (absent = today's behavior): `pin{uk:bool}`,
  `park{uk:bool}`, `discovered[key].status/reason`.
- The discovery helper already sets `fit_tier`; both paths converge on the same band
  semantics, so a proposed lead and a manual add rank on one scale.

## Delivery checklist
1. New `src/islands/JobTracker/rank.ts` — pure `computeTier`, `fitScore`, `orderTop5`
   (+ unit tests, runnable in node).
2. Wire into `appendRow` (R3/R4), the Top-5 memo (R1), and new Pin/Park/Reject actions
   (R2) with buttons on the row + FocusCard.
3. `npx vite build`; bump VERSION in `src/main-core.tsx`; cache-bust `?v` on the island
   in `pwa/index.html` + `sw.js` CACHE.
4. Push (PWA auto-deploys); **live-verify in the Browser pane**: add a URL → row gets
   tier + brand + JD link + "Review & tailor" and lands in Top-5 if it outscores #5;
   Pin/Park/Reject behave per R2; discovery ledger records a reject.
