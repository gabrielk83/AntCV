# REMINDER — job-list "Open on AntCV" routes JD into the wrong field

**For:** active desktop session
**Filed:** 2026-07-08 (owner, via cloud)
**Area:** job tracker / job list

## Bug

Clicking **Open on AntCV** on a job-list row sends the row's JD content into
the **Additional Signals** textarea instead of displaying it on the
**"uploaded application"** (the JD / uploaded-application slot).

Net effect: the JD lands in the free-text "Additional Signals" box; the
uploaded-application panel shows nothing.

## Where it is

`Vt` is the **Additional Signals** textarea setter (state defined at
`pwa/app.src.js:15062`). The Open / cloud-restore paths write the saved JD
straight into it:

- `pwa/app.src.js:16282` — `Vt(__foreignDevice ? "" : e.jd_text)`
- `pwa/app.src.js:21331` — `Vt(__foreignDevice2 ? "" : e.jd_text)`

The intended target is the JD / uploaded-application state (`Xo` — see the
adjacent branches that log `"not written to Xo"` / `"showcase template routed
to _showcaseJdRef (not Xo)"`). `e.jd_text` should route to the uploaded-
application slot, not to `Vt`.

## Note

Reminder only — not fixed here. Recent job-tracker work (1.51.218–220, Open
re-seed + Additional Signals column + Brand-fit) is the relevant neighbourhood.
Follow patch protocol + cache-bust when fixing.
