# AntCV PWA v1.40.125 — drop-in deploy

Complete PWA bundle with the CJLR alignment cycler wired in. No
ordering concerns — extract, deploy, done.

## Exact changes vs v1.40.124

Three files differ; everything else is byte-identical:

```
+ antcv-section-align.js                      (new file, 16 KB)
~ index.html                                  (+1 line)
~ sw.js                                       (cache name bump + 1 SHELL entry)
```

`index.html` diff:
```
671a672
> <script src="antcv-section-align.js?v=1.40.125" defer></script>
```

`sw.js` diff:
```
1c1
< const CACHE = 'antcv-1.40.124-showcasebackup-refactor';
---
> const CACHE = 'antcv-1.40.125-cjlr-cycler';
7a8
>   './antcv-section-align.js',
```

`app.js` is untouched.

## Why these three changes are safe

1. **Sidecar script tag in index.html** — `defer` attribute means it
   runs after parsing, after the other sidecars, in document order.
   No race with app.js bootstrap.

2. **SW cache name bump** — the activate handler in sw.js already
   deletes any cache key that doesn't match the current `CACHE`
   constant, so the old `antcv-1.40.124-showcasebackup-refactor`
   cache is purged on activation. Users on the old version get the
   new SW on their next page visit, fresh-fetch the new index.html
   and the new sidecar.

3. **SHELL precache entry** — adds the sidecar to the install-time
   precache list so first paint works offline too. Even if the
   precache fetch were to fail (it won't, the file is right there
   in the same dir), the network-first regex in sw.js catches all
   `.js` files anyway, so the sidecar would still load on first
   page request.

## Storage namespace

The sidecar writes to:

```
localStorage.personalInfo.stylePrefs.sectionAlignment
  = { [sectionId]: 'left' | 'center' | 'right' | 'justify' }
```

The other sidecars own:

```
stylePrefs.photoShape, stylePrefs.photoContour,
stylePrefs.photoShadow, stylePrefs.sectionFormats   (antcv-format-prefs.js)
```

No overlap. The sidecar listens for `antcv:sections-updated` and
filters out its own writes so there's no event-loop hazard with
format-prefs.

## Deploy

Cloudflare Pages — same as every other AntCV deploy:

```
wrangler pages deploy . --project-name=antcv
```

…from the unpacked bundle directory, or upload the zip via the
dashboard. Flat ZIP, no build step.

After deploy:

1. Open the PWA. The SW activates on next page load (or after a
   `Hard Refresh` in Settings if you want it immediately).
2. Look at any CV section in the preview. A small `L` button
   appears in the top-right corner of each section. Click to
   cycle L → C → R → J → L.
3. The alignment persists across reloads (localStorage), survives
   React re-renders, and is hidden in print output.

## Rollback

Re-deploy the v1.40.124 bundle. The SW will detect the older
cache name in the new sw.js (`antcv-1.40.124-showcasebackup-refactor`)
versus its currently-active `antcv-1.40.125-cjlr-cycler` and re-install,
purging the v1.40.125 cache.

Stranded `personalInfo.stylePrefs.sectionAlignment` localStorage
entries are inert without the sidecar. Clear them if desired:

```js
const pi = JSON.parse(localStorage.personalInfo);
delete pi.stylePrefs.sectionAlignment;
localStorage.personalInfo = JSON.stringify(pi);
```

## Tests run before packaging

24 jsdom assertions pass in `test-section-align.mjs` (in the
earlier CJLR delivery zip): injection, skip-list, per-role
activation, click cycle, persistence, re-apply after simulated
React render, idempotency, print CSS, event emission with payload.
