# SESSION LOG — 2026-07-29 · HDR-TYPE-CONTROLS-001

**Owner ask.** "For AntCV, in all modes, allow the panel [to] control the preview
(and export) for size and font compression/expansion for the Name, Application,
Specification, Contact line and Slogan. Add controls for expansion/compression in
steps of 0.05, both positive (expansion) and negative (compression). Make sure
nothing prevents the user from controlling these values, and append them both in
CV and in CL. Separate the control of specialisation and of application as they
are no longer in the same place, and add control for the slogan."

**Shipped.** PWA `1.51.3862-hdr-type-ctrl` · docx-worker `1.14.173-hdr-type-ctrl`.
Shift lane 1.51.3862–1.51.3881, worktree `AntCV-shift-1-51-3862`.

---

## What the panel looks like now

`Font sizes (pt) + letter spacing — tap to expand`

| Row | Size key | Letter-spacing key | Where it lands |
|---|---|---|---|
| Name | `nameSize` | `nameTrack` | CV + CL header band, and the `name_block` section in the figure layouts |
| Specialisation | `specialisation` | `specTrack` | CV + CL header band, `spec_block` |
| Application line | `applicationSize` **(new)** | `applicationTrack` | CL, under the slogan (`data-antcv-app-line-native`) |
| Contact line | `contactSize` | `contactTrack` | CV + CL header band, `contact_line` |
| Slogan | `sloganSize` **(new)** | `sloganTrack` | CL, top of the letter body |

Plus a bulk `All Identity Lines ↔` row that steps all five tracks together, and
`All Candidate Header ↕` widened to cover the two new sizes.

**Specialisation and Application were ONE row** (`"Specialisation / Application"`,
both on `specialisation`). They are separate controls now because they are no
longer in the same place — CL-APP-SUBTITLE-HEADING-SWAP-001 moved the application
line out of the header and under the slogan, leaving the specialisation in the
band on both documents.

## Letter-spacing semantics — why 0.05

The value is a **DELTA in points** on whatever tracking that line already had,
stepping by 0.05, signed (+ expands, − compresses), clamped to `[-2pt, +4pt]`,
readout `±0.00 / +0.15 / −0.10`.

0.05pt is **exactly one twentieth of a point** — the unit of DOCX `w:spacing`. A
panel step is therefore one `w:spacing` unit with no rounding loss anywhere on the
Word leg. Delta (not absolute) semantics mean **0 changes nothing**: a fresh
install, and every existing document, renders byte-identically to before.

## Every layer wired (the "nothing prevents the user" sweep)

`pwa/app.js` — surgical in-place edits, 30 sites (rebuild is gated,
`docs/deployment/app-js-source-and-rebuild.md`):

1. **Prelude helpers** — `__antcvFontPrefs / __antcvFontPt / __antcvTrackPt /
   __antcvTrackPx / __antcvTrkCss / __antcvTrkPtOf`, all exported on `window`.
   One source of truth: they read the same `localStorage.fontSizes` object the
   panel writes, so preview, HTML export, DOCX payload and the copenhagen fit
   sidecar can never disagree.
2. **Defaults** in all three places the fontSizes shape is declared (state seed,
   the "reset to package" path, and the section renderer's merge).
3. **`__antcvTrkStep`** — the tracking stepper, beside the existing size stepper
   `ua`; same persistence (state → `ls.set("fontSizes")` → `styleConfig.fontSizes`).
4. **Panel** — rows split, two rows added, tracking control on each identity row.
5. **Live preview band** — name / spec / contact (CV and CL both render this).
6. **Live preview CL** — slogan + application line.
7. **Header-as-sections leg** — `name_block` / `spec_block` / `contact_line`
   (what the header-left / header-right figure layouts render), preview + HTML.
8. **HTML export band** — name / spec / contact.
9. **HTML export CL** — slogan + application line.
10. **In-app DOCX stylesheet** — `<w:spacing>` on `CV_Name` / `CV_Subtitle` /
    `CV_Contact`; emitted only when non-zero so untouched docs are unchanged.

`pwa/antcv-copenhagen-v2-001.js` — the copenhagen measured fit emits
`letter-spacing … !important` for the name and had no panel escape at all. The
panel deltas are now emitted **after** the fit rules (same specificity → source
order decides), so the owner's value is the last word on name, spec and contact.
The fit's own auto-sizing already yielded to explicit `nameSize` / `specialisation`
/ `contactSize`; tracking now behaves the same way.

`pwa/antcv-docx-client.js` — `buildFontSizes()` is a **whitelist**. It dropped
every new key, which would have made all seven controls silently inert on the
DOCX/PDF leg. Added.

`pwa/antcv-pdf-preview-gate.js` — the fallback export path read
`personalInfo.fontSizes`, a legacy mirror that is usually absent, so that path
shipped without the owner's sizes at all. Falls back to the canonical
`localStorage.fontSizes` now.

`workers/docx-worker/src/index.js` (`1.14.173-hdr-type-ctrl`) — the CL slogan run
was hard-pinned at 11pt / `characterSpacing` 20 and the application line at
10.5pt / 4. Both read the payload now. Name / spec / contact add the delta on top
of their existing tracking (copenhagen `.14em` fit, spec 11, contact −2 with
`w:w=73`, bridge −10, legacy none), and `__cphNameFit` folds the delta into its
fitted track so the measured fit cannot outrank an explicit owner choice.

## Bug found and fixed on the way

**APPLINE-PARITY-001.** The CL application line was **11px in the preview and
10.5pt (14px) in the export** — a 27% split between what the owner saw and what
shipped. Both legs now default to 10.5pt and read the same panel key. The slogan
was already close (15px preview vs 11pt export) and is now exactly 11pt on both.

## Verification

- PWA suite **1504/1504** pass (13 new in `pwa/test/unit/hdr-type-controls.test.mjs`).
- Workers suite **290/290** pass.
- Render V&V **50/50** docx diags pass, including the new
  `workers/docx-worker/test/diag-hdr-type-controls.mjs` — 12 checks: each size
  key reaches its run, each track key shifts `w:spacing` by exactly `pt × 20`
  off the documented baseline, and an **all-zero payload is byte-identical to
  no payload at all**.
- `node --check` clean on `pwa/app.js` and the worker bundle.
- Cache-bust quintet applied and asserted by test: `app.js?v=`, the three changed
  sidecars, `sw.js` `CACHE`, `antcv-version-override.js` `TARGET_VERSION`
  (previous version pushed onto `STALE_VERSIONS`, invariant respected), and the
  `window.ANTCV_VERSION` boot seed.

## Debt / notes

- **`pwa/app.src.js` is NOT mirrored.** It is an older de-minification generation
  and no longer shares identifiers with the shipped bundle (fontSizes is `Yr`
  there, `ca` in `app.js`), so a mechanical mirror is impossible and a partial one
  would be misleading. A divergence note naming this change was added to its
  header instead. `pwa/app.js` is authoritative — grep it directly.
- **Deployed.** PWA push run 30450455893 (auto, from `main`), then docx-worker
  `workflow_dispatch` run 30450517787 — one deployer at a time, PWA first. Live:
  `antcv.pages.dev` serves `app.js?v=1.51.3862-hdr-type-ctrl` with `__antcvTrkStep`
  present in the deployed bundle and `sw.js` CACHE bumped; docx-worker `/health`
  reports `1.14.173-hdr-type-ctrl`.
- `workers/docx-worker/CHANGELOG.md` still has the documented 1.14.161–172 gap
  (pre-existing debt, not backfilled here); the 1.14.173 entry sits on top of it.
