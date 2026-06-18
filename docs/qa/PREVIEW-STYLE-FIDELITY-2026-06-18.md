# PREVIEW-STYLE-FIDELITY cluster — owner 2026-06-18 (DOCUMENT — do not resolve yet)

Owner batch after a RESET. "document these bugs — do not resolve yet." Recorded with
root-cause hypotheses + file locations for a later deliberate fix. **No code change.**

All of these are **preview-render fidelity** defects: a setting or per-package value that the
EXPORT honours but the live PREVIEW does not reflect. Several likely share one root
(`body[data-package]` / `stylePrefs.*` not reaching the preview render after a reset or a
style switch), so they should be triaged together, not one-off-patched.

---

## A. Photo figure-shape buttons don't apply in preview (square / rounded-square → circle)

**Owner:** "the visual buttons for square and square rounded just give circle. pentagon does
show pentagon. soft edge does not show soft edge, shadow on does not give shadow on."

- The Settings shape buttons live in `pwa/antcv-format-prefs.js` (~841-890): they write
  `personalInfo.stylePrefs.photoShape` (`circle`/`rounded`/`square`), `.photoContour`
  (`line`/`soft`), `.photoShadow` (bool) and dispatch `antcv:sections-updated`.
- The preview render reads those SAME keys from localStorage — `__photoFrame` (`app.src.js`
  ~40918-40950: square→radius 0, rounded→12px, else 50%; `soft` contour→border none + glow;
  photoShadow→box-shadow) and the inline medallion path (~41799-41847, duplicate logic).
- **Pentagon works** because it is a SEPARATE sidecar (`antcv-photo-ui-427.js` /
  `antcv-photo-pentagon-shape.js`) that clips the live `<img>` element in the DOM directly
  (`data-antcv-pentagon-clip`) — it does NOT depend on the React render reading localStorage.
- **Hypothesis (why square/rounded/soft/shadow fail but pentagon works):** the write→render
  hand-off is broken. Either (a) `antcv:sections-updated` does not force the preview React
  tree to re-read localStorage (no state bump), so the medallion keeps its last-painted
  radius; or (b) the cloud-restore rewrite clobbers `stylePrefs.photoShape/photoContour/
  photoShadow` before the render reads them — the **sidecar-prefs-clobber-hazard** (memory
  `sidecar-prefs-clobber-hazard`: sidecar-written `stylePrefs.*` get wiped on the
  cloud-restore path; the fix pattern was STANDALONE localStorage keys, e.g. `cl/cvTableRatio`).
  Verify which by setting `photoShape='square'` and reading back `personalInfo.stylePrefs`
  AFTER a paint + after an export.
- **Fix direction (later):** make the shape/contour/shadow prefs survive cloud-restore (move
  to standalone LS keys OR add them to the restore allow-list) AND force a preview re-render on
  `antcv:sections-updated` (the medallion must re-read on the same event the table-ratio path
  uses). Keep ONE source of truth — `__photoFrame` and the ~41799 inline copy must stay in
  parity (two readers, same bug surface).

## B. Per-package figure shape not wired into preview (Pampas should force rounded-square)

**Owner:** "pampas is not square … moving to pampas contemporary did not move the shape in the
settings either: My expectation is that it would move from circle to round-square."

- There is a per-package shape map — `PKG_SHAPE` in `pwa/antcv-docx-client.js` (~164):
  copenhagen→circle, navy-executive→rounded, warm-terracotta→rounded, nordic-frost→circle,
  **pampas-contemporary→rounded-square**, tokyo→square, delhi→hexagon. **This map is
  EXPORT-ONLY.**
- The PREVIEW shape resolvers (`__photoFrame` ~40918, the inline medallion ~41799) read ONLY
  `stylePrefs.photoShape` with **no package fallback** — so switching package never changes the
  preview figure shape, and never writes `stylePrefs.photoShape`, so the Settings buttons'
  active state doesn't move either.
- Two distinct asks here: (1) switching to a package should set the EFFECTIVE preview shape to
  that package's `PKG_SHAPE` default (when the user hasn't overridden it); (2) the Settings
  shape control should REFLECT that effective shape (move circle→rounded-square when Pampas is
  chosen). Also note `rounded-square` and `hexagon` are NOT yet handled by the preview
  `__photoFrame` (only square/rounded/circle) — needs the extra radii + a hexagon clip
  (pentagon's sidecar is the template).
- **Coupled with the photoShape key split:** the preview reads `stylePrefs.photoShape`; confirm
  the package default writes the same key the buttons + render read (no `personalInfo.photoShape`
  vs `stylePrefs.photoShape` divergence).

## C. Candidate band + table headers stuck on navy for ALL styles

**Owner:** "the navy bg is stuck on the candidate section and table heads for all styles."

- The preview candidate band reads `background: var(--header-bg, ${Ke})` (`app.src.js` ~41208,
  ~41246; `Ke` = navyColor). `--header-bg` is defined PER package under
  `body[data-package="<id>"]` in `pwa/antcv-packages-registry.css` (copenhagen #33446F line 50,
  navy-exec #1D2B45, terracotta #8C4A32, nordic-frost #1A3A4F, pampas #1B2D5E, …).
- Diag (1.50.625) showed the band computed to `rgb(51,68,111)` = **#33446F = copenhagen-modern's**
  `--header-bg` — i.e. `body[data-package]` is **STUCK on copenhagen-modern** and not updating on
  style switch. So every style falls through to copenhagen's (or navyColor's) band/header colour.
- The pre-paint `presetPackageBand()` (`index.html` ~326) only sets `data-package` when it is
  ABSENT (`if (!document.body.getAttribute('data-package'))`) — it never UPDATES it. The update
  on style switch is owned elsewhere (the island / `antcv:package-changed` →
  `antcv-preview-header-tokens.js`). **Hypothesis:** after a reset the style-switch path that
  rewrites `body[data-package]` isn't firing (or fires before the band exists), so it stays on
  the preset. This is almost certainly a REGRESSION interacting with PALETTE-RESET-BAND-001
  Option C (1.50.625), which made `antcv-sidebar-bg-token.js` deliberately SKIP the band + TH —
  correct for "don't pale them", but it removed the only sidecar that was previously
  re-colouring them, exposing that `data-package` itself is stale.
- **Fix direction (later):** ensure `body[data-package]` is REWRITTEN on every style switch
  (not just first paint), and that the band/TH read the live `--header-bg` for the CURRENT
  package. Validate: switch styles and assert `document.body.dataset.package` changes and the
  band computed colour matches the registry `--header-bg` for that package. Do NOT revert
  Option C (that was the Copenhagen-pale fix) — fix the `data-package` staleness instead.

## D. Nordic Frost — pale sidebar washes out the sidebar headlines

**Owner:** "check that sidebar pale in norwegian frost is not hiding the sidebar headlines too
much."

- Nordic Frost va (`app.src.js` ~16870-16903): `sidebarBg #1A3A4F` (dark) but
  `sidebarHeadColor #7EC8E3` (pale blue), `sidebarTextColor #E8F4F8` (near-white). If the
  preview is rendering the sidebar PALE (a pale sidebar somewhere overrides the dark va
  `sidebarBg` — e.g. the registry `--package-base` / sidebar-bg-token fallback), then pale
  headline text on a pale sidebar = low contrast = "hiding the headlines."
- **To verify:** compute the actual rendered sidebar bg for nordic-frost in preview vs the va
  `sidebarBg #1A3A4F`. If they differ (pale), that's the bug. Then either keep the sidebar dark
  (match va) OR, if a pale sidebar is intended, darken `sidebarHeadColor`/`sidebarTextColor` for
  contrast. Tie-in: same `body[data-package]` / token path as bug C.

## E. RESET still doesn't resolve the settings-photo issue

**Owner:** "the reset did not resolve, the issue around settings-photo."

- Confirms A–C survive a reset / hard refresh. The reset (PHOTO-AUTOSIZE-185 dead-band,
  1.50.625) fixed the #185 oscillation CRASH, but did NOT address these fidelity defects — they
  are independent (render-read / data-package staleness, not the auto-sizer loop). Track them as
  the A–D items above; "reset" here is just the owner's repro entry point, not a separate bug.

## F. Personality-kernel "retake tests" card pops in then disappears; should live inside Advanced Tones

**Owner:** "the Personality kernel — retake tests appears when entering personal tab — but
disappears after the tab stabilises. should be inside advanced tones collapsable."

- SAME mechanism as TENSE-POPIN-002 (just fixed at 1.50.626). `pwa/antcv-personality-quiz-439.js`
  `injectCard()` (~264-291) appends a standalone `<details>` "Personality kernel" card to the
  Personal flex column (anchored on the LanguageCard island `#antcv-react-personal-languages`,
  `order:45`), on a `[200,700,1800,3500]ms` schedule + a MutationObserver. When the LanguageCard
  island unmounts/remounts during the Personal-tab settle, the appended sibling is dropped →
  "pops in then disappears."
- **Owner's wanted placement:** INSIDE the "Advanced Tones" collapsible, not a standalone card
  under Languages. So this is BOTH a stability fix AND a relocation: stop appending a standalone
  card; instead inject the quiz launcher into the Advanced Tones section body (find the
  Advanced-Tone collapsible anchor, append once, idempotent — same pattern the tense control now
  uses to defer to its host).
- **Fix direction (later):** re-anchor `injectCard` to the Advanced Tones collapsible; make it
  idempotent + survive remounts (re-inject if its host re-renders, but never leave a standalone
  orphan in the Personal column). Mirror the TENSE-POPIN-002 discipline: never build a card in a
  location that the React tree owns and will wipe.

## G. Figure POSITION selector loses its mark on style switch (no per-package default position)

**Owner 2026-06-18:** "moving from copenhagen modern to other style does not have a default
figure position (the blue sidebar bridge is now white while no other marked in blue). And the
figure shape select is not moving to other if relevant (stays circle)." [shape half = bug B.]

- The figure POSITION is React state `er` in `pwa/app.src.js` (~15802, PHOTO-BRIDGE-DEFAULT-001):
  `u.get("photoPosition", copenhagen-modern ? "band-overlap" : "sidebar-top")`. The package-aware
  default is evaluated **once at mount** and only when `photoPosition` is UNSET; an explicit stored
  choice wins. `band-overlap` = the "◐ Sidebar bridge" — a copenhagen-modern-specific position.
- On a style switch, `selectPackage()` in `src/islands/PackagePicker/PackagePicker.tsx` (~197)
  does `writePackageState` + `applyPackageToBody` only — it **never updates `photoPosition` nor the
  app.src.js `er` state**. So a user who never picked a position sat on copenhagen's `band-overlap`
  default (bridge marked blue); switching to a non-copenhagen package leaves `er`/`photoPosition`
  stale at `band-overlap`, which is NOT a valid/shown position for that package → the bridge
  un-marks and the package default (`sidebar-top`) is never written, so **nothing is marked**.
- The lever already exists: `window._antcvSetPhotoPosition(v)` (`pwa/app.src.js` ~15826,
  PHOTO-SIDEBAR-BRIDGE-001) updates BOTH the React `er` state AND localStorage. The shape side has
  no equivalent — shape lives in `personalInfo.photoShape` (top-level; read by the sidecar
  `antcv-photo-ui-427.js` ~411) AND `stylePrefs.photoShape` (read by the app.src.js preview ~40927/
  ~41553) — the two-location split called out in bug B.
- **Fix direction (later, couples with B):** in `selectPackage()`, on a real package CHANGE (not a
  quick-alt), set the new package's figure defaults — position via `window._antcvSetPhotoPosition(
  id === 'copenhagen-modern' ? 'band-overlap' : 'sidebar-top')`, and shape to `PACKAGES[id].shape`
  (registry: copenhagen circle / navy-exec rounded / terracotta rounded / nordic-frost circle /
  pampas rounded-square / tokyo square / delhi hexagon+square) written to BOTH photoShape keys with
  a `storage` + `antcv:photo-shape-changed` dispatch so the selector AND preview re-read. Decide the
  override policy: switching style should adopt that style's figure defaults (the owner's
  expectation), but a later explicit user choice persists until the next style switch.

---

## Status
DOCUMENT ONLY — owner-gated. A, B, C, D likely share the `body[data-package]` / `stylePrefs.*`
preview-read root and should be diagnosed together (one headless repro: switch styles + toggle
shape, assert `body.dataset.package`, the band computed colour, and the medallion radius all
track the selection). **B + G are the figure-on-style-switch pair** — both fixed in
`selectPackage()` by setting the package's default figure position (via `_antcvSetPhotoPosition`)
+ shape (`PACKAGES[id].shape`); G adds the POSITION half (selector un-marks) to B's SHAPE half.
F is an independent sidecar relocation (same family as the resolved TENSE-POPIN-002).
