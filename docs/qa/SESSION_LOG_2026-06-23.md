# Session work log — 2026-06-23 (1.50.789 → 791)

Continuation of the 2026-06-22 bugfix sprint.

## Shipped to main (PWA auto-deploys; both LIVE-VERIFIED on antcv.pages.dev)
- **789 — STALE-SW de-masking + guaranteed-fresh hard refresh** (priority #1). In
  `antcv-hardrefresh-force-349.js` (now the freshness guard): cleanup (SW unregister + caches.delete)
  is AWAITED but BOUNDED (2.5s) before reload; on boot a `no-store` network probe of index.html compares
  the DEPLOYED release (its `ANTCV_VERSION` seed) to the LOADED release and, if deployed is newer,
  shows an honest "Update" banner + auto-recovers once (sessionStorage loop guard). Compares
  loaded-release vs network-fresh-release of the SAME per-release seed — NOT TARGET vs app.js?v (the old
  trap; app.js?v legitimately lags). The baked app.js const (`v="1.50.585-babel-fish"`) is unreliable
  (surgical edits never bumped it) so it is NOT used. API: AntcvForceReload/GuaranteedFresh/CheckFreshness.
  Diag: `pwa/test/diag-freshness-guard.mjs`. Live proof: a tab auto-recovered 789→790.
- **790 — FRESH-START-DELETE-001** (priority #2; clean delete → wizard, keep secrets). New sidecar
  `antcv-fresh-delete.js` (AntcvFreshErase / AntcvIsFreshStart / AntcvClearFreshStart): all 3 delete
  paths keep the API secrets, clear the relay/docx URLs, and arm the `antcv-just-deleted` fresh-start
  cookie; the minimum-sections FLOOR is suppressed, the wizard is FORCED open, and the boot relay-URL
  re-default is suppressed under fresh-start; the cookie clears on wizard completion + skip. The wizard
  ALREADY has the relay step ("Paste your Worker URL") — not a new one. app.src.js + mirrored app.js
  (different minified identifiers — mirror by site, not name). Diag: `pwa/test/diag-fresh-delete.mjs`
  (13 checks). SECURITY: relaxes the 782 blanket clear to KEEP local API secrets per owner; personal
  data (profile/sections/kernel + cloud KV+D1) still fully wiped. Skip behaviour: clearing the cookie →
  next boot the floor + relay default return (normal editor). Owner deleted their account to test the
  fix; full delete→wizard flow to be confirmed live.

## On side branch `feat/universal-table-type` (NOT merged — owner review)
- **791 — TABLE-TYPE-001** universal table editor (`antcv-table-editor.js` → window.AntcvTableEditor),
  rich_block-style. app.js delegates the editor `case "table":` to it (old inline editor kept only as a
  load fallback). Whole-table CJLR/enhance/fit, heading/rule toggles, **header-row CJLR** (the reported
  regression) + header B/I, column-ratio, space-after; per-row hide/page/CJLR/enhance/fit/up-down/
  delete + Add. Wired via existing stores (rows/hidden/rowAlign/headerAlign/pageBreakRows); new fields
  (headingOff/ruleOff/headerBold/headerItalic/spaceAfter) persisted — preview/export wiring + banded +
  settings-only gap/heading-color/2col/caps + preview column-drag are staged follow-ups. Diag:
  `pwa/test/diag-table-editor.mjs` (8 checks) + boot-smoke.

## Scoped, awaiting owner decision (in BUGFIX_KICKOFF_2026-06-22.md)
- **#4 GEN-CONTAMINATION** — D1 in `workers/access-relay/src/index.js`. Two blockers: no full-vs-quick
  signal in the worker (client must send one), and the wipe scope is ambiguous (`application` is one row
  per JD — wiping all rows deletes saved history). Owner's history is already deleted, so no history-loss
  risk now; still needs the wipe-scope decision + a real regen to verify.
