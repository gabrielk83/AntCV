# JD-URL Generate + Demo Fetch-JD — handoff (2026-06-09)

Two located fixes that need a session with a local clone / git push, because
`pwa/app.js` (848 KB) is too large to write through the antcv-mcp tools inline.
Mirror of the entry added to `docs/qa/ACTIVE_BUGS.md`.

## BUG 1 — `Ut.arrayBuffer is not a function` on Generate after a JD URL fetch [OPEN]

**Repro:** BYOK mode -> paste a JD URL -> Fetch JD succeeds ("checkmark NNNN chars,
url-fetch, 1 page") -> press Generate -> red error `Failed: Ut.arrayBuffer is not a
function`. File uploads are unaffected.

**Root cause (verified in pwa/app.src.js):** the Generate JD-extraction block
(`if (Bt) { ... }`, ~line 21021 in app.src.js; minified `if(Ut){...}`) decides
between cached text and re-extraction:

    if (zt && zt.text && zt.fileName === Bt.name)   // use cached text
    else if ("pdf" === ext) { PDF.js }
    else { const e = await Bt.arrayBuffer(); mammoth.extractRawText(...) }   // crash

- Upload path sets BOTH a real File (`Dt(e)`) AND
  `Ft({text,method,pages,fileName:e.name})` -> cache-hit check passes; even on a miss
  `Bt.arrayBuffer()` works (real File).
- URL path (app.src.js ~12313-12319) sets
  `Dt({name:(o.title||r).slice(0,120),kind:"url",...})` (NOT a File, no arrayBuffer)
  and `Ft({text:o.text||"",method:"url-fetch",pages:1})` (NO fileName). So
  `zt.fileName===Bt.name` is `undefined===name` -> FALSE -> cache miss -> `else`
  branch -> `Bt.arrayBuffer()` on a plain object -> TypeError.

**Fix (one line, both files):** add `fileName` to the url-fetch text object so the
cache-hit branch fires and the already-fetched text is used (never reaching
arrayBuffer).

pwa/app.src.js — replace:

    Ft({ text: o.text || "", method: "url-fetch", pages: 1 }),

with:

    Ft({ text: o.text || "", method: "url-fetch", pages: 1, fileName: (o.title || r).slice(0, 120) }),

pwa/app.js (minified) — replace:

    Jt({text:o.text||"",method:"url-fetch",pages:1}

with:

    Jt({text:o.text||"",method:"url-fetch",pages:1,fileName:(o.title||r).slice(0,120)}

Minified var map for orientation: file-descriptor setter `Vt`, text-cache setter
`Jt`, JD file var `Ut`, text-cache var `Yt`; cache check
`if(Yt&&Yt.text&&Yt.fileName===Ut.name)`.

Both edits validated locally with `node --check` (syntax OK). Patched app.js is
+35 bytes, app.src.js +40 bytes. `(o.title||r).slice(0,120)` is byte-identical to
the value used for the descriptor `name`, so the equality holds exactly.

## BUG 2 — demo "Fetch JD" still errors "Configure Worker URL in Settings -> API Keys first." [OPEN]

**Repro:** demo PWA (Use-demo pill) -> paste JD URL -> Fetch JD -> error.

**Root cause:** the home Fetch-JD gate (app.src.js ~12288) reads `proxyUrl` and
errors if empty. The fix sidecar `antcv-proxyurl-relay-fallback-371.js` (seeds
proxyUrl from `window.ANTCV_RELAY_URL`) IS registered in `antcv-357-loader.js`
(entry #5, confirmed on main) — but `index.html` loads the loader with an UNCHANGED
cache-bust query `antcv-357-loader.js?v=1.40.357-loader`, so browsers/SW keep serving
the OLD loader without entry #5. The loader's internal VERSION string does not bust
any HTTP/SW cache; only the `?v=` in index.html does.

**Fix (prepared locally, needs push):** bump the loader tag in pwa/index.html:

    antcv-357-loader.js?v=1.40.357-loader  ->  antcv-357-loader.js?v=1.50.332-relay-fallback

Verified locally that the PHOTO_B64 blob MD5 is unchanged by this edit
(b361e8c2280d73268042a2a0e39ff586 before and after); only the query string changes
(+8 bytes). SW `CACHE` is already at `antcv-1.50.332`, which forces a one-time purge
on next activation, but the durable fix is the `?v=` bump so it survives future loads.

## NOTE / housekeeping

A stray commit `b7d289a` wrote an 18-byte placeholder to `pwa/app.js` during this
session (a mis-issued multi-file commit). It was already overwritten on main by a
later commit (main app.js is back to the full 848435-byte file as of this writing) —
but whoever lands BUG 1 should DIFF against a known-good app.js first, and confirm the
only intended app.js delta is the +35-byte fileName addition above.

## Verify after landing both

1. BYOK: paste JD URL -> Fetch JD -> Generate -> no `arrayBuffer` error; CV builds
   using the url-fetched JD text (console: `[JD] Using cached extraction (url-fetch,
   ... chars)`).
2. Demo: hard-refresh; paste JD URL -> Fetch JD -> succeeds (routes relay -> demo-proxy);
   console shows `[proxyurl-relay-fallback]` seeding proxyUrl and `[antcv-357-loader]
   injected`.
3. Both: confirm in Preview, DOCX, PDF, desktop + mobile per the QA core rule.
