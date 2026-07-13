# CROSS-APP-EXPORT-CONTAMINATION-001 — leg (a) diagnosis (2026-07-13)

Register row 53. Scope of THIS diagnosis: leg **(a)** only — the cross-app CONTENT /
filename / header / brand leak (CV + filename + header company belonged to a different
application than the cover-letter body). Legs (b)-(f) (language, placeholders, diacritics,
partial-language, brand-fit-derivation) are tracked separately.

## Symptom (owner, real export pair, 2026-07-06)

One exported pair was internally inconsistent across TWO applications:

- CV sections + FILENAME + header company/role line = **Trackman "Projektleder, Hardware"**
- Cover-letter BODY = **KOMBIT "AI-udvikler"** (correct target)
- Brand/palette = generic navy/teal (not the target's)

Leak direction Trackman -> KOMBIT: the KOMBIT export adopted Trackman's CV content,
branding, and file naming; only the CL prose stayed the true target.

## Confirmed mechanism

The DOCX export assembles its payload from **four independently-sourced pieces that have no
single-application identity binding**. Each is a separate React state variable, hydrated
from a different per-application store, and each can drift to a different app during a
generation / cloud-restore race.

### Export call site (the assembly point)

`pwa/app.src.js:50001` (real DOCX export button `onClick`):

```js
await window.exportDocxViaWorker({
  sections: be(ro, je),   // ro = sections state  { cv:[...], cl:[...] }
  meta: io,               // io = meta state      { company, role, subtitle, ... }
  doc: Lt,                // 'cv' | 'cl'
  styleConfig: ya,        // ya = styleConfig state (brand)
  navyColor: Ke,          // Ke = navy state (brand)
  ...
});
```

Minified-mirror map (from memory `targeted-app-persistence`): `ro`=`xo` (sections),
`io`=`So` (meta), plus `ya` (styleConfig), `Ke`/`Po` (navyColor). These are four
**separate** state atoms.

### Where each piece is sourced — and how it drifts

| Payload piece | Drives | Source store | Drift mechanism |
|---|---|---|---|
| `meta.company` / `meta.role` | **filename** (`buildFilename`, `pwa/antcv-docx-client.js:2743`, uses `meta.company` + `meta.role`) AND **header band** "Application: `<role>` — `<company>`" (`buildPayload`, `pwa/antcv-docx-client.js:705-714`) | active app row `meta` / `jd_company` / `jd_role` | `META-DRIFT-GUARD-001` / `AUTO-COMMIT-001` (memory `targeted-app-persistence`): cloud-restore of an active row can overwrite the draft's meta; a targeted draft can revert company to "Unsolicited" or a stale company mid-session. |
| `sections.cv` | CV body | active app row `cv_sections` | `sections.cv` and `sections.cl` are two arrays in ONE state atom; a restore/gen race can leave them belonging to different apps (memories `nil-application-state` "meta vs sections.cl disagree", `jd-scope-isolation` "sections can split across stores"). |
| `sections.cl` | CL body | active app row `cl_sections` | same as above |
| `styleConfig` + `navyColor` | **brand** (palette) | **GLOBAL** `localStorage` keys `styleConfig` / `navyColor` — NOT per-app | `brandfit-per-app-leak`: a fresh Generate for ANY other app overwrites these global keys; the export always reflects whatever app was generated last. |

Because filename+header (`meta`), CV (`sections.cv`), CL (`sections.cl`), and brand (global
keys) each come from an independently-drifting source, a race produces exactly the reported
pair: `meta`=Trackman (-> filename + header), `sections.cv`=Trackman, brand=Trackman
(last-generated), `sections.cl`=KOMBIT.

## Evidence

### Code (file:line)

- `pwa/app.src.js:50001` — export call assembles payload from `ro`/`io`/`ya`/`Ke` (four separate atoms).
- `pwa/antcv-docx-client.js:2743-2766` `buildFilename` — filename = `meta.company` + `meta.role`.
- `pwa/antcv-docx-client.js:705-714` — header "Application:" band = `meta.role` / `meta.company`.
- `pwa/antcv-docx-client.js:1037` — brand `style: buildStyle(styleConfig, navyColor)` (the global-keyed brand).
- `pwa/antcv-jd-scope.js:37,54,152-156` — the per-app store: `antcv:activeAppCompany` -> `antcv:app:{id}:company`; `AntcvJdScope.getCompany()` / `getCurrentAppId()` expose the active-app identity.

### D1 (`ant_memory` 499c3de9-8371-428a-9b9f-5d695d58e32b)

- `application` schema: per-app `jd_company`, `jd_role`, `cv_sections`, `cl_sections`, `meta`, `style_config`. `active_application` / `active_application_device` are POINTERS only.
- Owner (`user_hash GVdLYawOzO5SmG8ehBfy0Z6m43pb_5QC`) has 28 app rows, each with its OWN `cv_sections` (13-16 KB) / `cl_sections` (~4 KB) / `meta` — i.e. the stores the flat client state is hydrated from are all distinct per app.
- **`style_config` is NULL for every one of the 28 rows** — the per-app brand column is INERT (relay read/write still on the unmerged `brandfit-per-app-scope` branch). This is the live root of leg (f): there is NO per-app brand persistence, so brand always reflects the global keys = the last-generated app.
- `meta` JSON carries per-app anchors: `urlkey` (a company slug, e.g. `"aimpoint"`, `"danfoss"`), `slogan`, and for some rows an embedded `styleConfig` (row 724 NVIDIA `#76b900`). Useful as an additional per-app identity token.

### Live (read-only, https://antcv.pages.dev, v1.51.619, unauthenticated boot)

- `window.exportDocxViaWorker` = `function` (the single exposed export boundary; `window.AntcvBuildPayload` is `undefined`).
- `window.AntcvJdScope` present with `getCurrentAppId()` + `getCompany()`.
- `styleConfig` present as a GLOBAL `localStorage` key (brand-leak axis confirmed).

### Not reproducible here (stated honestly)

The exact Trackman + KOMBIT rows are NOT in cloud D1 (they were local-only / hand-fixed
offline), and a faithful repro needs TWO authenticated targeted generations back-to-back.
The mechanism above is confirmed **structurally** from code + D1 + read-only live, not from a
live two-app repro.

## Authoritative identity for reconciliation

The single best client-side anchor available at export time is the active application:

- `AntcvJdScope.getCurrentAppId()` — the tab's active app id.
- `AntcvJdScope.getCompany()` — the active app's stamped company (`antcv:app:{id}:company`,
  written on setActive / AUTO-COMMIT).

The guard treats this as authoritative for the **company / filename / header** axis and
reconciles or blocks against it (see `pwa/antcv-export-app-scope-guard.js`).
