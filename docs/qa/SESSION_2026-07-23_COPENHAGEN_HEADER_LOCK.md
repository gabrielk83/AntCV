# 2026-07-23 — Copenhagen header: iterated live with the owner and LOCKED

Application-history record (owner: "lock this solution ... document it in
application history"). The header band solution below is FINAL as of
**1.51.3602-header-lock**; do not re-tune without a fresh owner ask.

## The locked header (antcv-copenhagen-v2-001.js, DEFAULT ON, kill `antcv:copenhagen-v2='0'`)
- **Box**: navy `--header-bg` (#33446F), radius 22px, 1.5px cyan #01B9BD border,
  7.4px insets, min-height 200px; grid rows auto/auto/auto centered as a group,
  row-gap 18px (equal name→spec, spec→contact AND outer top/bottom gaps).
- **Photo**: 129px circle (1.4in − 0.05in), pinned ABSOLUTE on the live-measured,
  scale-corrected SIDEBAR MIDLINE, vertically centered; re-centers live on
  sidebar resize (ResizeObserver, setTimeout-debounced, >1px hysteresis).
- **Name**: 23px, tracking .14em (3.1px cap); spec 18px cyan #01B9BD at the box
  midline (specDy dial, default 0); **contact** single line, white links, fits
  the NAME's width via absolute two-stage fit (font 13→floor 10.5px at 0.88
  work-split, then scaleX floor 0.72).
- **CPH-FIT-ABS-001 stability model** (the hard-won part): the fit is computed
  ABSOLUTELY each good pass from natural width (width/fontSize is invariant) —
  idempotent, sanity-gated (band 350-1600px, per-ratio 15-120), so bad passes
  are skipped, poisoned state self-heals, and the cached values emit LAST in
  the cascade + UNCONDITIONALLY (source-order beats the static rules; a
  mid-re-render pass can't drop them). History of failure modes this replaced:
  emit-on-change (snap-back oscillation), tighten-only ratchet (one bad
  measurement locked an illegible 8px×0.55 contact).
- App line: pulled to the slogan (-7px) with 7px air over its 1.5pt teal rule
  (default ON, headerItemRule.application store); NO rules inside the box
  (header-rule defaults OFF); sign-off teal + 1.5px cyan underline.

## Version trail (all deployed 2026-07-23)
3121 header-defects → 3141 band-gap → 3161/3182 sizes → 3202 grid → 3262/3302/
3322 symmetry → 3342 sidebar-track → 3362 fit → 3382 photo-center → 3402/3422
contact-fit + photo129 → 3442/3462 gaps → 3522/3542/3562/3582 fit stability →
**3602 LOCK** (name 23px, contact 10.5px floor/0.88 split/0.72 k-floor).

## Still open after the lock
- **Stage-4 DOCX/PDF header parity** (task chip pending; spec section "Stage 4"
  in COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md is the work order). Exports do
  NOT yet carry this header.
- Full-list regen + exports (owner 2026-07-23 night order): re-run JD analysis +
  application generation across the JD list, exporting CV+CL DOCX, CV+CL PDFs
  and the analysis PDF per app (nightly hard rule 8) — queued as a task chip +
  covered by the nightly deliverables rule.
