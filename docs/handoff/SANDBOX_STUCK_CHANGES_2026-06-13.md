# Handoff — changes stuck in a sandbox session (2026-06-13)

For the session working on the LIVE repo. Re-implement these against the current
tree (live was `app.js?v=1.50.434`, commit `b5d7480` when this was written).

## Why this exists

A second Claude session ran against a git remote that turned out to be a
**sandbox mirror** (`http://127.0.0.1/git/gabrielk83/AntCV`), forked at
`1.50.402` (`c031c4d`). Its pushes never reached the GitHub repo Cloudflare
deploys from, so none of the work below is live. The deploy history on real
`main` runs `1.50.412 → 434` from separate development and contains none of it.

**Do not cherry-pick the sandbox commits.** They sit on a `1.50.402` base and,
for Copenhagen, on a colour architecture that has since changed (see Item B).
Re-implement against `1.50.434`. Each item below states the desired end state,
the exact levers, and what to verify.

Follow the repo's standard discipline for every code change: surgical in-place
edit to the minified `pwa/app.js` mirrored into `pwa/app.src.js`, then the
cache-bust trio (`index.html ?v=`, `sw.js CACHE`, `antcv-version-override.js
TARGET_VERSION` + add the previous version to `STALE_VERSIONS`, never the
current one). Rebuild only via the terser `build:app` and confirm the identity
round-trip.

---

## Item A — `build:app` must use terser, not esbuild  (HIGH, ship first)

Sandbox commit `2d12bc9`. One line in `package.json`.

`esbuild --minify` prepends `"use strict"` and is not behaviour-preserving for
this sloppy-mode bundle — it blue-screens the app (`APPJS-BLUESCREEN-001`). The
proven command is terser.

```diff
-    "build:app": "esbuild pwa/app.src.js --minify --legal-comments=none --outfile=pwa/app.js",
+    "build:app": "npx --yes terser pwa/app.src.js -c -m -o pwa/app.js",
```

**Verify on live first:** check whether `package.json` `build:app` on `1.50.434`
still points at esbuild. If it does, apply this. Then run the **identity
round-trip gate**: `npm run build:app` on the UNEDITED source must reproduce the
committed `pwa/app.js` byte-for-byte (`cmp` clean), `node --check pwa/app.js`
OK, file starts `(()=>{`, zero `"use strict"`. Only a rebuild that passes this
gate may be deployed (per `docs/deployment/app-js-source-and-rebuild.md`).

---

## Item B — Copenhagen Modern: pale sidebar + dark text  (the owner's actual ask)

Sandbox commits `d6f15ba` (superseded) + `5805dc6` (final). Implement the FINAL
state only.

### Desired end state

Copenhagen's sidebar, candidate band, and table headers go from dark slate-blue
to a **pale blue-grey ground** with **dark text** inverted in for readability:

| Field | Live (dark) | Target |
|---|---|---|
| `headerBg`, `sidebarBg`, `tableHeaderBg` | dark navy / `#3E5C8C` | **`#DDE6F2`** |
| `headerNameColor`, `headerSpecColor`, `headerContactColor` | `#FFFFFF` | **`#283556`** |
| `sidebarTextColor` | `#FFFFFF` | **`#283556`** |
| `tableHeaderText` | `#FFFFFF` | **`#283556`** |
| `sidebarHeadColor` (sidebar section headings) | teal `#01B7BB` | **`#00746E`** (dark teal — pops vs navy body) |
| `headerLineColor`, `sidebarLineColor` (rules) | teal `#01B7BB` | **`#283556`** (navy) |
| `photoBorderColor` | teal `#01B7BB` | **unchanged** (teal photo accent is fine on pale) |
| picker swatch first colour | `#3E5C8C` | **`#283556`** (recognisable chip) |

Main-column text colours (`mainTextColor`, `mainBulletColor`, etc.) are
unchanged — they already sit on white.

### Levers — IMPORTANT, the architecture moved

On the sandbox `1.50.402` base the sidebar colour was the literal
`va["copenhagen-modern"].style.sidebarBg` in `app.src.js`. On live `1.50.434`
the sidebar is coloured through a **palette-token system**. Apply the target
colours consistently across ALL of these (grep the live tree for each):

1. **`workers/docx-worker/src/palette.js`** — the DOCX renderer derives
   `sidebarBg: p.base`, `sidebarHeadColor: p.primary`, `mainBulletColor:
   p.bullet`, etc. from a per-package palette `p`. Find the `copenhagen-modern`
   palette entry and set `base → #DDE6F2`; make sure the text/name/heading
   colours it feeds resolve to the dark targets above (not white). This is what
   the exported DOCX uses.
2. **`pwa/antcv-sidebar-bg-token.js`** + **`pwa/antcv-packages-registry.css`** —
   the live preview recolours the sidebar via the `--package-base` CSS token to
   match the DOCX. Ensure the Copenhagen `--package-base` (and any companion
   text token) reflect the pale ground + dark ink.
3. **`pwa/app.src.js` `va["copenhagen-modern"].style`** (and the default `c`
   style object, if it still mirrors Copenhagen) — set the field values in the
   table above, so the PWA preview's own render path matches.

### The white-text-in-sidebar trap (must fix, or the candidate name goes invisible)

The candidate **name / specialisation / contact** text colour is decided by
LOCATION, not background. In the export builder:

```js
const c = "sidebar" === e.loc;     // is the candidate block in the sidebar?
// name:    color:${c ? "#fff" : "#283556"}
// spec:    color:${c ? "#fff" : "#283556"}
// contact: i = c ? "#ffffff" : "#333333";   s = c ? "#fff" : a;
```

and the same pattern in the live preview (`S ? "#fff" : "#283556"`). On a pale
sidebar these force **white text on near-white** → invisible. For the default
layout (candidate in the top bar) `c`/`S` is false so it renders navy and works;
the break only hits the candidate-in-sidebar layout.

**Fix robustly**: make the ink background-driven instead of location-driven. Add
a luminance helper once at module top and use it in both the export builder and
the preview:

```js
readableInk = (bg) => {
  try {
    const h = String(bg || "").replace("#", "");
    if (h.length < 6) return "#fff";
    const r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#283556" : "#fff";
  } catch (_) { return "#fff"; }
};
```

Then replace the location ternaries (export: name, spec, contact value `i`,
contact label `s`; preview: name, spec) so the white branch becomes
`readableInk(<the sidebar bg in scope>)` — e.g. `readableInk(Ke || t.sidebarBg)`
in the export builder, `readableInk(k.sidebarBg)` in the preview. This auto-
darkens on the pale ground in any layout and stays white if the bg is ever
re-darkened (also fixes a latent bug for any light `navyColor`).

### Verification owed (no renderer was available in the sandbox)

Check the live PREVIEW and a real **DOCX + PDF export**, candidate-in-top-bar
AND candidate-in-sidebar layouts: candidate name + sidebar section text must be
dark and readable on the pale panel; dark-teal headings distinct from navy body.
Re-pick Copenhagen (or Reset) if it was already selected.

---

## Item C — Experience tense "Auto" (per-role logic)  (LOW — likely already covered)

Sandbox commit `9c2800b` (EXP-TENSE-002). **Live already has an EXPERIENCE TENSE
control** — `TENSE-RELOCATE-001` (1.50.423) relocated it into Settings →
Personal via `window._antcvSetExpTense`, plus `antcv-tense-control-422.js`. So
the sandbox UI work is superseded.

Only port if live's control lacks the **logical per-role Auto** behaviour:

- `styleConfig.expTense = "auto" | "present" | "past"` (legacy `expPastTense:true`
  reads as `"past"`).
- **Auto** = present tense for the current/ongoing role (years ending
  Present/Now/Current or no end date; newest if several), past for every earlier
  role. **Present/Past** force one tense across all roles.
- The generation prompt's `__tenseRule` must emit the AUTO per-role logic vs
  FORCED PRESENT vs FORCED PAST accordingly.
- The 12 style reference docs under `docs/.../references/styles/` should each
  state the logical tense rule (the sandbox added it to the 6 that lacked it:
  achievement-driven, cold-outreach, credential-forward, hybrid-balanced,
  precision-formal, research-formal).

Diff against the live implementation before doing anything; this may be a no-op.

---

## Summary

| Item | Priority | Live lever | Net |
|---|---|---|---|
| A — terser build | High | `package.json` `build:app` | 1-line, verify gate |
| B — pale Copenhagen | High (owner ask) | palette.js + `--package-base` token + app.js `va` style + export/preview ink ternaries | colours + `readableInk` helper |
| C — tense Auto | Low | compare vs live tense control | likely no-op |
