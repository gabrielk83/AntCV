# `src/` — AntCV React-islands source

Vite source tree. Builds to `pwa/antcv-react-islands.js` (single IIFE) and `pwa/antcv-react-islands.css` (when CSS exists).

## Why a separate source tree?

`pwa/app.js` is the existing AntCV React app — a single 785 KB file using `React.createElement(...)` (no JSX) and hand-edited. Replacing it wholesale is out of scope for v1.50.0. The plan in `docs/plan/AntCV_Plan_v2_LockedSources.md` §7 Pass 1 carves out four discrete features (LanguageCard, PreviewToolbar, SettingsRouter, wizardState) for proper React extraction. Those four live here.

The bundle is loaded via a `<script src="antcv-react-islands.js" defer>` tag at the bottom of `pwa/index.html`. React and ReactDOM are loaded earlier in the same file via UMD CDN (`pwa/index.html` lines 17-18), and Vite externalises them — the bundle reaches them through `window.React` / `window.ReactDOM`.

## Build

```bash
npm install        # once
npm run build      # builds pwa/antcv-react-islands.js + .css
npm run dev        # watch mode
npm run typecheck  # tsc --noEmit
```

The built bundle is **committed to the repo** so `wrangler pages deploy pwa/` works without a build step on Cloudflare.

## Layout

- `main.tsx` — entry point. Registers `window.AntcvReactIslands` and runs `mountAll()` on DOMContentLoaded.
- `islands/<Name>/` — one folder per island. Each exports a `mount<Name>Island()` function from `mount.tsx`.

## Mount strategy

Islands mount into anchors rendered by `pwa/app.js`. Because `app.js` may not have rendered its React tree when our bundle first runs, each island's `mount` function uses a short polling + scoped MutationObserver strategy (scoped to a known container — never `document.documentElement`, per §7 Pass 1 exit criteria).
