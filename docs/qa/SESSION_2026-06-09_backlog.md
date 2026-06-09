# AntCV — Backlog entries, session 2026-06-09 (JD-URL fixes, prod restore, mobile cancel)

Canonical record of the issues reviewed in the 2026-06-09 JD-URL session. Indexed
here (in the `docs/qa/` backlog folder) because the master `ACTIVE_BUGS.md` is a
single ~186 KB file that can't be safely whole-file-rewritten through the MCP write
tools; fold these rows into the dated top section of `ACTIVE_BUGS.md` on the next
terminal/Codespaces pass. Three FIXED + deployed (prod `35a65148`, 12:43 UTC
2026-06-09), one OPEN.

## FIXED + deployed

- **JD-URL-GEN-001** — [x] FIXED (High) Generate crashed `Ut.arrayBuffer is not a
  function` after a JD **URL fetch** (file uploads unaffected). Root cause: the
  url-fetch path stored the JD text without a `fileName`, so the Generate cache-hit
  check (`zt.fileName===Bt.name`) missed and the code fell through to
  `Bt.arrayBuffer()` on a non-File url descriptor. Fix: add
  `fileName:(o.title||r).slice(0,120)` to the url-fetch object — `Jt({...})` in
  `pwa/app.js`, `Ft({...})` in `pwa/app.src.js` (both patched, `node --check` clean,
  +35 / +40 chars). Verified live. Detail: `docs/qa/JD_URL_FIXES_HANDOFF.md`.

- **JD-URL-DEMO-001** — [x] FIXED (High) Demo "Fetch JD" errored "Configure Worker
  URL in Settings → API Keys first." in demo / after a BYOK→demo switch (deleting
  keys clears `localStorage.proxyUrl`). Root cause: the relay-fallback sidecar
  `antcv-proxyurl-relay-fallback-371.js` (seeds `proxyUrl` from
  `window.ANTCV_RELAY_URL`) was registered in `antcv-357-loader.js` (entry #5) but
  `index.html` loaded the loader with an unchanged `?v=`, so caches served the old
  loader without entry #5. Fix: bumped the loader tag in `pwa/index.html` to
  `?v=1.50.332-relay-fallback` (PHOTO_B64 blob byte-unchanged); SW cache bumped
  (`antcv-1.50.332/333`) to force a purge. Demo JD now routes via access-relay →
  demo-proxy like every other JD path.

- **PROD-BLUESCREEN-001** — [x] FIXED (Critical) Landing page blue-screened with
  `Uncaught ReferenceError: PLACEHOLDER_APP_JS is not defined` at `app.js:1:1`. Root
  cause: a mis-issued `github_commit_multiple_files` call wrote an 18-byte
  placeholder to `pwa/app.js` (commit `b7d289a`); Pages deployed it. Fix: restored
  the full 848,435-byte `app.js` from parent `0c8de8a` (sha256 `0aca101b…`) via a
  Download→upload PR (merged), then re-applied JD-URL-GEN-001 (→ 848,470 B). Lesson:
  never write `pwa/app.js` (848 KB) inline through the MCP tools; use
  Codespaces/terminal or a Download→upload PR with sha256 verify-before-merge.

## OPEN

- **GEN-UI-MOBILE-CANCEL-001** — [ ] OPEN (Med) On mobile, during generation the
  "↺ Cancel & return to editor" button renders **below** the full LIVE PREVIEW
  track, so it's effectively off-screen (seen barely visible at 57% zoom). Located
  in `pwa/app.src.js` `Ue()` ~L11307-11345 (button `onClick:o`). Fix (preferred):
  move the Stuck?/Cancel block **above** the LIVE PREVIEW so it's reachable without
  scrolling; alternatives = `position:sticky` footer, or cap preview height with
  internal scroll. Apply in both `app.js` + `app.src.js`, `node --check` both, verify
  on a real mobile viewport mid-generation (desktop unaffected). Full detail:
  `docs/qa/GEN-UI-cancel-button-mobile.md`. Distinct from the older GEN-UI-001/002/003
  "redundant Fit buttons" cluster in `ACTIVE_BUGS.md`.

## Related feature (in the Feature Registry, not here)

- **SHARE-TARGET-JD-URL-001** — share a job link into AntCV → JD URL field when
  logged in. See `docs/FEATURES_REGISTRY.md` (OPEN table).

## Housekeeping

- Stray `pwa/__noop_check` left in the repo (harmless redeploy-trigger file) — delete
  when convenient.
- `docs/qa/JD_URL_FIXES_HANDOFF.md` can be marked resolved now that JD-URL-GEN-001 +
  JD-URL-DEMO-001 are live.
