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

- **`pwa/app.src.js` IS mirrored** — 31 sites. This corrects an earlier call in
  this session not to mirror it; see "The app.src.js question" below.
- **Deployed.** PWA push run 30450455893 (auto, from `main`), then docx-worker
  `workflow_dispatch` run 30450517787 — one deployer at a time, PWA first. Live:
  `antcv.pages.dev` serves `app.js?v=1.51.3862-hdr-type-ctrl` with `__antcvTrkStep`
  present in the deployed bundle and `sw.js` CACHE bumped; docx-worker `/health`
  reports `1.14.173-hdr-type-ctrl`.
- `workers/docx-worker/CHANGELOG.md` still has the documented 1.14.161–172 gap
  (pre-existing debt, not backfilled here); the 1.14.173 entry sits on top of it.

## The app.src.js question — regenerate, or hand-mirror?

Owner follow-up: "restructure app.src.js so it covers for app.js again."

I first judged `app.src.js` too stale to mirror mechanically and skipped it. That
call was wrong, and the fix is not the one it looks like.

**A marker census settles the staleness question.** Every one of the 68
ticket markers in `app.js` is already present in `app.src.js` — sessions have
been mirroring faithfully all along. The file was covered; only THIS change was
missing from it.

**Regeneration was built, tested, and rejected.** `app.js -> prettier ->
app.src.js` is the safe direction (it cannot touch the shipped bundle), and it
worked: gated on a normalised-AST comparison, the reformatted output was
*provably the same program* — identical sha256 over the canonical tree, once two
formatter-legal normalisations were applied (a stray no-op `;`, which prettier
drops; and redundant parens around an associative logical chain, `X || (Y || Z)`
reprinting as `X || Y || Z` — same operands, same order, same short-circuit
points). Two things killed it anyway:

1. **It deletes the engineering record.** `app.src.js` carries **444** ticket
   markers against `app.js`'s 68 — **376 exist nowhere else**. Minification
   strips comments, so a rationale written into `app.src.js` (e.g. the 20-line
   UPLOAD-SCREEN-TOP-CLIP-001 note explaining that the clip was
   `justifyContent:"center"` and not a scroll artifact) is *unrecoverable* from
   `app.js`. Regenerating would have destroyed all of it.
2. **74 assertions across 43 test files** anchor on those comments as markers.
   They failed immediately — correctly.

So `app.src.js` is not a build input at all. It is a **de-minified mirror that
doubles as the design-decision record**, hand-maintained by meaning rather than
by bytes (its short names come from an older minifier pass — fontSizes is `Yr`
there, `ca` in `app.js`). Mirroring it is manual work, and that is the cost of
having the rationale survive.

**What shipped instead:** the 31 HDR-TYPE-CONTROLS-001 sites hand-mirrored with
the local identifiers, richer rationale comments than `app.js` carries, the stale
"DIVERGENCE NOTE" replaced with an identifier note explaining the mirroring
convention, and four new mirror-lock tests that pin key-count parity between the
two files and assert the marker set may never shrink — so the next session gets a
red test instead of a judgement call.
