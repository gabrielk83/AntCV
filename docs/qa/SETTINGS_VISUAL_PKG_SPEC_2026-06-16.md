# Settings / Visual-Package — safe-subset spec (2026-06-16)

Scope: the autonomous-viable members of the Settings/visual-package cluster (reconciled backlog
`docs/qa/AntCV_old_open_reconciled_2026-06-16.md`). This spec is written AFTER reading the deployed
code, and it corrects the backlog: two of the three VISUAL-PKG rows are already shipped.

Source of truth read for this spec:
- `src/islands/PackagePicker/PackagePicker.tsx` (sha 6469ca1) + `mount.tsx` (sha e89d78f)
- deployed bundle `pwa/antcv-react-islands.js` (sha 4d7f0e7, `?v=1.50.436`)
- `pwa/index.html` (load order; islands bundle is vite-built)

## 0. Corrections to the backlog (verified in the DEPLOYED islands bundle)

- **VISUAL-PKG-002 — ALREADY SHIPPED.** `decorateNativePackageButtons` (minified `Er`) is live: it
  appends a palette swatch strip (base, primary, interactive, bullet, glyph) **and** a photo-shape
  glyph SVG (`wr`) to each native STYLE PACKAGE button, idempotent via `data-antcv-pkg-deco`,
  re-applied by the island's MutationObserver. That is the VISUAL-PKG-002 deliverable. → Close as
  shipped; owner live-verify only.
- **VISUAL-PKG-003 — ALREADY SHIPPED (descriptor relocation).** The Custom-button note
  (`data-antcv-custom-note`, "Auto when you edit beyond the package range") is live on the Custom
  button, and the package meta line ("font · shape · size") renders on the cards. The backlog's
  "descriptor relocation pending" no longer holds. → Close as shipped; owner live-verify only.
- **PackagePicker header already reads "Visual package"** — the stale label is the NATIVE app.js
  "STYLE PACKAGE" section, not the island.

Net: the safe subset is **VISUAL-PKG-001** (native relabel) + the **MERGE-DUP-001 / MERGE-DUP-003**
island bridges. The icon/descriptor work (002/003) is NOT in scope — it is done.

## 1. VISUAL-PKG-001 — relabel native "STYLE PACKAGE" → "Visual package"

- Surface: native `pwa/app.src.js` settings panel (worker has no such string — confirmed). The
  island already says "Visual package"; only the native section heading is stale.
- Change: the section heading string `STYLE PACKAGE` → `Visual package`. Match the EXACT existing
  casing/markup in `app.src.js` (it renders uppercase via CSS or literal — preserve whichever is
  there; change the text, not the styling).
- CRITICAL coupling: the islands mount code keys off this heading. `mount.tsx` uses
  `STYLE_PACKAGE_RE = /^STYLE PACKAGE$/i` (minified `yr` in the bundle) via
  `findSectionBlockBeforeNext(... STYLE_PACKAGE_RE, SIDEBAR_POSITION_RE)` to anchor the PackagePicker
  card, AND `decorateNativePackageButtons` matches buttons by package displayName (NOT by the
  heading) so button enrichment is unaffected. **But the card anchor regex WILL break if the heading
  text changes** and the island is not updated in lockstep.
  → This makes VISUAL-PKG-001 a TWO-FILE change, not a pure relabel:
    1. `pwa/app.src.js`: heading text `STYLE PACKAGE` → `Visual package` (+ mirror to minified
       `pwa/app.js` per discipline).
    2. `src/islands/PackagePicker/mount.tsx`: widen `STYLE_PACKAGE_RE` to match BOTH spellings —
       `/^(STYLE PACKAGE|Visual package)$/i` — so the anchor survives during/after rollout and for
       users on a cached app.js. Rebuild islands (`npm run build`) + bump `?v=` in index.html.
  Anchoring is a contains/exact match on the section's own text node, so the dual-accept regex is
  safe and idempotent.
- Acceptance: (a) native heading reads "Visual package"; (b) the PackagePicker island card STILL
  mounts directly under the package buttons (anchor intact) on a fresh load AND with a stale cached
  app.js still saying "STYLE PACKAGE"; (c) button swatch/glyph enrichment unchanged; (d) no second
  copy of the card (the dedupe by `#antcv-react-package-picker` id still holds).
- Risk: LOW, contingent on shipping the regex widening in the SAME change. Shipping the relabel
  WITHOUT the island change orphans the card (it falls back to the "above Advanced→Style / above
  Done" fallback anchor — visually wrong, not a crash).

## 2. MERGE-DUP-001 — hide legacy writing-style SELECT, keep the two legacy buttons, bridge to island

Owner constraint (locked): "we are using the old buttons" — the two legacy writing-style buttons
must KEEP working; only the redundant legacy `<select>` is hidden.

- Deployed reality: the WritingStylePicker island (`ta`, `data-antcv-react-island=
  "writing-style-picker"`) is live and owns the full style/chips/banned-words UI. The legacy app.js
  writing-style `<select>` is a duplicate control over the SAME `personalInfo.writingPrefs.style`.
- Change (islands-side, additive — mirrors the LanguageCard `Un` stray-hide pattern that already
  ships):
    1. In the WritingStylePicker mount (`aa`/`Ht`), after locating the settings root, find the
       legacy writing-style `<select>` (match by its option labels / the native heading that
       precedes it) and hide it with the SAME hardened pattern LanguageCard uses for
       `data-antcv-hidden-language-stray` (`display:none !important; visibility:hidden; height:0;
       margin:0; padding:0; overflow:hidden`), stamped with a new
       `data-antcv-hidden-writing-style-stray="1"`. Idempotent; never touch the two legacy BUTTONS.
    2. Bridge the two legacy buttons: they already write `personalInfo.writingPrefs.style` via
       app.js. The island listens to `antcv:writing-prefs-changed` AND `storage` (`personalInfo`),
       so a legacy-button click that updates storage already refreshes the island. VERIFY this on
       live; if a legacy button sets state WITHOUT firing a storage event the island can observe,
       add a capture-phase click listener on those two buttons that calls `setWritingStyle(...)`
       (the island's `Or`/`I` path) — but ONLY if the probe shows the passive sync is insufficient.
- Acceptance: (a) legacy `<select>` not visible; (b) BOTH legacy buttons still switch style and the
  switch reflects in the island + preview + generation (`_antcv_writing_style` payload); (c) no
  layout gap where the select was; (d) survives route changes + the island's MutationObserver.
- Risk: MEDIUM — hiding the wrong node (overshoot) is the classic failure (cf. LanguageCard stray
  hide). PROBE the exact select node on live before shipping the selector. Keep the hide scoped to
  the select element, never its container if the container also holds the two buttons.

## 3. MERGE-DUP-003 — unify "save tones" → "save customs" wording

- Deployed reality: the island "Saved tones" block (`Zr`) shows button text "+ Save current as new
  slot", section header "Saved tones", empty state "No saved tones yet…", and per-slot "Load" /
  delete. The persistence is `writingPrefs.savedSlots` (snapshot of style+chips+banned buckets).
- Change (islands-side, pure copy): update the user-facing strings to the "customs" vocabulary so it
  matches the rest of Settings (the package side already says "Custom"):
    - header "Saved tones" → "Saved customs"
    - "+ Save current as new slot" → "+ Save current as custom"
    - empty state "No saved tones yet…" → "No saved customs yet…"
    - keep the per-slot Load/rename/delete affordances and the underlying `savedSlots` key UNCHANGED
      (storage shape is untouched — this is wording only).
- Acceptance: (a) strings read "customs"; (b) save/load/rename/delete still work against the same
  `savedSlots`; (c) existing users' saved slots still load (no key rename). 
- Risk: LOW — copy-only, no storage/logic change.

## 4. Deploy mechanics (both files in play)

- `pwa/app.src.js` edit (VISUAL-PKG-001 heading): mandatory minified mirror to `pwa/app.js`
  (names differ; anchor on the string literal). Bump `app.js?v=` in `index.html`.
- Islands edits (VISUAL-PKG-001 regex widen, MERGE-DUP-001 hide+bridge, MERGE-DUP-003 copy):
  edit under `src/islands/…`, run `npm run build` to regenerate `pwa/antcv-react-islands.js`, bump
  `antcv-react-islands.js?v=` in `index.html` (currently `1.50.436`). The bundle is >50KB → it is
  built, never hand-written inline.
- Order: ship VISUAL-PKG-001's app.js relabel and the island regex-widen together (same release) so
  the card anchor never orphans.

## 5. Out of scope (defer / already done)

- VISUAL-PKG-002, VISUAL-PKG-003 — already shipped (see §0); owner live-verify, then close.
- MERGE-DUP-002 (tone-chip section merge), DEMO-WARN-001, SETTINGS-HEAD-001 — `[console]` items
  needing a live check first (lower risk than list-row, but not headless-verifiable). Not in this
  subset.
- LOCATION-001 (Location/City split) — real `[code]` item but touches data load/write, not a pure
  relabel; spec separately.
- SECTION-LAYOUT-001 — the LayoutPicker island (`ma`) already ships collapsible Commercial/Academic
  groups; the remaining ask (collapse-by-default + refresh-on-style-change) is a small island delta,
  spec separately.

## 6. One-line summary

The safe Settings subset is smaller than the backlog implies: VISUAL-PKG-002/003 are already live,
so the work is (1) a native heading relabel that MUST ship with an island anchor-regex widen,
(2) hiding the duplicate legacy writing-style select while keeping the two legacy buttons bridged,
and (3) a tones→customs copy change. All three are deterministic and build/probe-verifiable; only
the MERGE-DUP-001 select-selector needs a live probe before shipping.
