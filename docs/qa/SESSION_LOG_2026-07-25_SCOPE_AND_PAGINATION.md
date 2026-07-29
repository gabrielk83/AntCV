# JD scope root cause, per-app pagination, and the salmon break site (2026-07-25)

Owner orders:
1. "fix the client-side stuck-JD-scope root cause (per-tab scope stuck on
   'kernel' at cold start)"; then "find all the applications whose quality is
   insufficient and either fix or let me know their numbers to delete; also make
   sure all apps have the correct colour palette".
2. "all aimpoint applications are assumed to have nothing from main in 2nd page -
   this makes no sense."
3. "fix also the salmon pagination to show the correct page break site, it needs
   to be correct both for main AND SIDEBAR."

Shipped: PWA `1.51.3762-jd-staging-consume`, `1.51.3763-pagemap-per-app`,
`1.51.3802-salmon-break-site`.

## 1. JD-SCOPE-COLDSTART-001 - the client end of the contamination family

`kernel` is the PRE-APP staging scope: a JD pasted before an application row
exists lands in `antcv:app:kernel:jdText`. Nothing ever emptied it once the
application was created. That residue (the 3Shape JD) then haunted every cold
start - a new tab boots on scope `kernel` before the active-app state hydrates,
the stale staging JD seeds React state, and auto-sync POSTs it under whatever
app is loaded next. Server-side that is exactly what the relay's
JD-CROSS-APP-GUARD-001 had been refusing since the previous day; this closes the
client end.

Fix in `antcv-jd-scope.js` (the FIRST-loaded sidecar, so the redirect is
installed before anything touches these keys):
- adopting a REAL app id now CONSUMES the staging slot. App slot empty ->
  MIGRATE all four staged keys into the app's own scope (the legitimate
  paste -> generate -> create flow). App slot occupied -> PURGE the staging
  slot once it is STALE (older than 10 minutes).
- a FRESH staging JD (under 10 minutes - another tab mid-paste) with an occupied
  app slot is left alone, so a parallel upload is never robbed.
- kernel jdText writes are freshness-stamped through the storage redirect
  (`antcv:app:kernel:jdTextAt`) to power that stale/fresh decision.
- self-healing on rollout: the first app opened on this build consumes or purges
  the existing residue.

Tests: NEW `pwa/antcv-jd-scope.staging.test.mjs` - migrate+clear, stale purge,
fresh parallel-tab protection, stamp-through-redirect, per-app scoping.

## 2. Quality and palette census (all applications)

Quality: every remaining app carries 15 CV + 9 CL sections, 3 real role_view
bullets, zero placeholder fragments, `jd_text` byte-matching the tracker's
canonical JD, and a present slogan. A cross-contamination scan using
distinctive company names returned ZERO hits. Nothing was owed for deletion -
the owner had already removed the bad rows (2734, 2747, 2743, 2754, 2755, 2656).

An early version of the cross-mention scanner reported ~20 false positives by
matching the token "Tech" inside the word "technical". Re-run with distinctive
company words only: clean. Recorded here because the first output looked
alarming and was wrong.

Palette: every app's `style_config` is NULL, i.e. all inherit the CURRENT
Copenhagen tokens - no app carries a stale pre-Copenhagen palette, and branded
apps take colour from their brand record. If an app ever LOOKS wrong-coloured on
one device that is the known device-local global brand-key leak, not cloud
state; the brand Reset control clears it.

## 3. PAGEMAP-PER-APP-001 - "nothing from main on page 2"

The EXPORT was never broken. A real CloudConvert render of app 2729 produced 3
clean pages with the experience flowing across pages 2-3.

The PREVIEW was wrong, and the cause was shared state: the sticky pagination maps
(`antcv:autoPages` / `antcv:autoPagesPreview`, deliberately sticky to stop the
page boundary oscillating) are keyed by SECTION ID and were SHARED across
applications. Switching apps kept the PREVIOUS app's page breaks. A long-main app
loaded under a shorter app's map got no break in the main column at all (CV main
sections take no break when the preview map lacks an entry - the 1.50.318
anti-dead-gap rule), so main crammed onto page 1 and page 2 rendered
sidebar-only.

Fix: both app-load sites (switch and boot restore, mirrored in `app.src.js` and
`app.js`) stamp `antcv:autoPagesApp` with the owning app id and DROP both maps
when a different app loads - the same reset the Hard Refresh button performs,
scoped to app switches. Within one app the stickiness is unchanged.

## 4. SALMON-BREAK-SITE-001 - one break line for both columns

Root cause: the two CV columns paginated the preview from DIFFERENT maps.
- MAIN read the A4-fill preview map (~1053px line): breaks LATER than the
  export, or NONE at all when the entry was missing.
- SIDEBAR preferred the preview map's FORCE-INFLATED entries
  (`SIDEBAR_PREVIEW_INFLATE`): breaks EARLIER.

So the two salmons disagreed with each other AND with the real DOCX, in opposite
directions.

Fix (`__antcvAutoPB`, both bundles): the CV now paginates BOTH columns from the
EXPORT map (`antcv:autoPages` - the one map calibrated against the real Word line
via `USABLE_PDF` / `WORD_INFLATE`), with the preview entry only as a defensive
fallback. The CL keeps preview-first (continuous single-column flow).
`__antcvEffPageLabel` reads the SAME effective bucket, so the page-number chips
can never contradict the visible salmon. This SUPERSEDES the CV DISPLAY legs of
PREVIEW-A4-FILL (1.50.316), PREVIEW-A4-FILL-SCOPE (1.50.318) and
PREVIEW-SIDEBAR-PAGINATE-001. Map writers, the export client and
`__antcvSalmon` itself (PERMANENT rule) are untouched.

LIVE-VERIFIED on the deployed build: with the measurer frozen and deliberately
DISAGREEING maps planted (export said break experience at role 2 and tools at
item 10; preview map said role 5 / item 18), main page 2 opened at role 2 and
sidebar page 2 opened at tools item 10 - both following the export map.

Tests: NEW `pwa/antcv-salmon-break-site.test.mjs` (5).

## 5. PREVIEW-SHEET-WORD-HEIGHT-001 - the follow-up the owner chose

Because the salmon now breaks at the Word line, a sheet pinned to TRUE A4
(1123px) ends well BELOW the last item the export fits, leaving dead white space.
The owner's instruction: "shrinking the preview page-box height to the
Word-equivalent line."

`antcv-page-fit.js` gained `sheetHeightPx()` = A4 divided by the MEASURER's own
inflate (1.14 Latin, 1.24 wide script, honouring the `antcv:wide-word-inflate`
live override), shared as `window.__antcvSheetHeightPx`.
`antcv-sidebar-subsection-pagebreaks-329.js` had two hard
`min-height:1123px!important` pins (page row and sidebar) that would have
re-imposed a true-A4 sheet over it; both now read the shared helper.
Kill switch: `antcv:disable-word-sheet=1`.

A stale test asserted the exact old source line (`PAGE_HEIGHT_PX`); it was
updated to assert the INTENT it always described, plus new coverage for the
helper, its kill switch and the de-pinning.
