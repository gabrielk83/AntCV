# POST-DEPLOY LIVE VERIFY — in-app Browser pane (desktop runs)

Owner requirement (2026-07-10): now that a desktop Claude Code session has its **own
in-app Browser pane** (`mcp__Claude_Browser__*`), every desktop run that ships a PWA
change must **verify the change actually reached production** before calling it done.
This closes the gap the cloud routine cannot: the cloud sandbox has no signed-in
browser, so it can only static-trace + keep tests green and mark live-verify "owed".

This is the standing procedure. It is NOT a screenshot review — this PWA's Babel
compile + ~90 sidecars make full paints/screenshots time out (~30s). The reliable
path is text-based: console + `javascript_tool` + in-page `fetch()` of the built
assets. That is actually the RIGHT altitude for "did my change ship" — it proves the
deployed version, which sidecar loaded at which `?v=`, and whether a specific code
marker is present in the built bundle.

## HARD RULE — never open ?hardReset

Navigate ONLY to `https://antcv.pages.dev/`. **Never** `?hardReset=1` (and never
`?logout=1`): it signs the owner out AND wipes the extra languages back to EN-DA
(`localStorage.clear()` in `antcv-auth.js` signOut). A fresh pane also has no
signed-in session, so auth-gated flows (trigger a real generation, brand-fit apply)
can't be driven end-to-end here — source-level + loaded-version verification is the
correct scope. Entering a password to sign in is prohibited regardless.

## Procedure (after `git push` + the ~60-90s Pages auto-deploy)

1. **Open the pane** (no dev server needed):
   `preview_start({ url: "https://antcv.pages.dev/" })` → note the `tabId` (e.g. `seed`).

2. **Confirm the deploy is live** — `read_console_messages({ tabId })` and look for:
   `[freshness-guard-789] fresh — loaded <V> >= deployed <V>`
   Both `<V>` must be the version you just shipped. If `loaded < deployed`, the SW is
   serving a stale shell — wait ~30s and re-open, or the deploy hasn't finished.

3. **Confirm YOUR changed sidecar loaded at the NEW `?v=`** — `javascript_tool`:
   ```js
   (() => {
     const srcs = [...document.scripts].map(s => s.src).filter(Boolean);
     return {
       ANTCV_VERSION: window.ANTCV_VERSION,
       // repeat per file you changed:
       changedSidecarSrc: srcs.find(s => s.includes('<your-changed-file>')),
       internalGuard: window.__<yourSidecarGuardGlobal>,   // if it sets one
     };
   })();
   ```
   The `?v=` in `changedSidecarSrc` MUST be the value you bumped to — this is the exact
   check that catches the **stale-`?v` phantom-ship** regression (file edited, `?v`
   not bumped, or a concurrent merge reverted the `?v` — browsers keep the cached old
   file). See [[stale-sw-version-mask-hazard]] / the 2026-07-10 settings-sync-extra
   regression.

4. **Confirm the code marker is in the BUILT bundle** (app.js is minified — use the
   minified marker) — `javascript_tool`:
   ```js
   (async () => {
     const appSrc = [...document.scripts].map(s=>s.src).find(s=>/\/app\.js\?v=/.test(s));
     const t = await (await fetch(appSrc)).text();   // same-origin, allowed
     return { appSrc, markerPresent: t.includes('<minified-marker-from-your-edit>') };
   })();
   ```
   For sidecars, `fetch` the sidecar `src` instead. `markerPresent: true` proves the
   edit reached production, not just your working tree.

5. **Record the result** in your run report / session log: version live, each changed
   `?v` confirmed, each marker confirmed. If any check fails, the ship is not done —
   fix the cache-bust (or re-push) and re-verify.

## What this canNOT do (be honest in the report)

- Drive a signed-in generation, brand-fit, or any auth flow (no session; password
  entry prohibited). Those stay owner-verify or headless-with-keys.
- DOCX/PDF render + measure — keep using the Word-COM + PyMuPDF path
  ([[render-and-measure-capability]]).
- Replace unit tests — still run `node scripts/run-tests.mjs pwa` +
  `node pwa/test/boot-smoke.mjs` before push. This gate is ADDITIONAL, post-deploy.

## Cloud routine note

The claude.ai cloud routine has no in-app Browser pane. Cloud runs make the code
change + keep tests green + push, and explicitly flag "post-deploy live-verify owed to
a desktop run" in the report. The next desktop run picks up that owed verify using this
procedure.
