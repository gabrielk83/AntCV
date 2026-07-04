# CL-SLOGAN-RICHCONTENT-001 phase 2 — design proposal (NOT implemented)

Register row 22. Phase 1 (antcv-cl-slogan-element.js, 1.51.90/91) already surfaces the
slogan as a panel element with rich_block-grade affordances (show/hide, inline edit,
CJLR), but the underlying data is still 3 standalone `localStorage` keys
(`antcv:clSlogan` / `-Hidden` / `-Align`), not a real `sections.cl` object. This is a
proposed plan for converting it to a real object — written up for review before any
code changes, per the owner's explicit ask and the existing code comment's own
"spec before splicing" note.

## Why phase 1 didn't just use a section (recap, do not re-litigate)

Cloud-restore previously clobbered section-based CL prose (sidecar-prefs-clobber-hazard).
Standalone keys survive that because restore only ever overwrites `sections` wholesale,
never touches arbitrary `localStorage` keys. Phase 1 kept the keys as the actual
source of truth for exactly this reason. **Any phase-2 design must preserve this
property or it reopens the bug phase 1 was built to avoid.**

## Current state (confirmed by reading the code, 2026-07-04)

Three independent call sites read the 3 raw keys directly and each renders its own
bespoke markup:

1. `pwa/app.src.js` ~line 27552 — one live-preview render path (`<table>` markup,
   inline styles, own uppercase/align/`•`-join logic).
2. `pwa/app.src.js` ~line 44146 — a second preview render path (appears to be a
   parallel code path, e.g. print or an alternate island — not yet confirmed which).
3. `pwa/antcv-docx-client.js` ~line 806 (`buildPayload`) — reads the same keys and
   writes them into `payload.meta.slogan` / `meta.slogan_hidden` / etc. for the
   worker.

The worker (`workers/docx-worker/src/index.js`) renders the slogan from
`ctx.meta.slogan` — there is no `sections.cl` entry for it today at all.

Each of these 3+1 sites independently re-implements: hidden-check, blank/placeholder
fallback to the specialization subtitle, `|` → ` • ` replacement, alignment
sanitization, uppercasing. That's the duplication row 22 flags.

## Proposed target shape

Add a synthetic `sections.cl` entry, generated (not stored) at the point `buildPayload`
/ the preview's section list is assembled — a **projection**, not a new independent
data store:

```js
{
  id: 'cl_slogan',
  title: '',                 // no heading — this is a standalone line, not a titled section
  loc: 'main',
  on: !isHidden,              // derived from antcv:clSloganHidden
  type: 'rich_block',
  headlineOff: true,
  align: sanitizedAlign,       // derived from antcv:clSloganAlign
  items: [{ b: '', t: effectiveSloganText }]  // derived from antcv:clSlogan / fallback
}
```

`effectiveSloganText` / `sanitizedAlign` / `isHidden` are computed by ONE shared
function (new, e.g. `clSloganModel()` in a small new sidecar or added to
`antcv-cl-slogan-element.js` since it already owns this logic) that replaces the
duplicated inline logic at all 3+ sites. **The standalone keys remain the only
place this data is written or restored** — the section is derived fresh every time
from the keys, never persisted independently, never a restore target. This is the
core restore-safety guarantee: cloud-restore can keep clobbering `sections.cl`
wholesale exactly as it always has, because the slogan was never actually stored
there — it's regenerated from the keys on every read.

## Dedupe plan (the "3 render sites + worker" problem, named explicitly in the code)

- **Preview (both app.src.js sites):** replace the bespoke `<table>`/markup blocks
  with a call into the SAME generic rich_block section renderer already used for
  every other CL section, feeding it the synthetic section object above, positioned
  first in the main column. This is the actual dedupe: today each site has its own
  copy of the uppercase/align/fallback logic; after this change there is exactly
  ONE renderer (the existing rich_block path) and ONE derivation function.
- **`buildPayload`:** stop writing `meta.slogan*` fields; splice the synthetic
  section into `payload.sections` instead (first main-column entry), same as any
  other rich_block CL section.
- **Worker (`buildLinearDocument`):** must render a `sections.cl` entry whose
  `id === 'cl_slogan'` the same way it already renders other rich_block CL
  sections — no new worker-side slogan-specific code path. **Double-render hazard
  to guard against:** the worker must NOT also read `ctx.meta.slogan` once this
  ships, or the slogan renders twice. Migration order: ship the section in the
  payload while the worker still ALSO supports `meta.slogan` as a fallback (one
  release, both present, worker prefers the section if both exist) → verify a real
  export → then remove `meta.slogan` handling from the worker and from
  `buildPayload` in a follow-up. Never ship "add section" and "remove meta.slogan"
  in the same change — that's how a double-render or a silent-blank slogan would
  slip through unverified.

## What does NOT change

- SIGN-OFF and SIGNATURE (the other 2 phase-1 elements) are explicitly out of
  scope for row 22 — the register item is scoped to the slogan only. They stay on
  their current standalone-key model.
- The kill switch pattern (`antcv:disable-cl-slogan-element`) stays; add a new
  one scoped to this migration (e.g. `antcv:disable-cl-slogan-richcontent`) so the
  projection can be turned off independently of phase 1's panel UI if something
  regresses.
- No change to how the panel UI (phase 1) reads/writes the keys — it keeps working
  exactly as today; only the RENDER side (preview + export) changes what it reads.

## Verification plan (before any of this ships)

1. Unit tests proving the projection function produces the identical rendered
   text/align/visibility as today's 3 independent implementations, for: empty
   override (falls back to subtitle), explicit override, hidden, each alignment,
   a bracket-placeholder override (must fall back, not render literally).
2. A regression test asserting the worker renders the section exactly once (no
   double-render) when both the section AND a legacy `meta.slogan` are present
   during the migration window.
3. Headless preview screenshot diff (old bespoke markup vs new rich_block render)
   for at least one non-trivial case (long slogan, non-center align) to catch any
   visual regression the unit tests wouldn't.
4. Owner regen + real export verify before the worker-side `meta.slogan` fallback
   is removed in the follow-up change.

## Open questions for the owner (need an answer before implementation starts)

1. Which of the two app.src.js sites (line ~27552, line ~44146) is the live editor
   preview vs. something else (print? a legacy path?) — needs confirming which
   render paths actually need touching, since editing app.src.js is high-risk and
   should only touch what's live.
2. OK to do this as a 2-release migration (section + meta.slogan coexist one
   release, meta.slogan removed the next) rather than one atomic change, given the
   double-render-hazard concern above?

This document is a proposal only — no code has been changed for row 22 phase 2.
